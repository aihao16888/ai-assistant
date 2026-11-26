#!/usr/bin/env node
// Requires OpenCLI >=2.0.0 and an extension that supports close-owned-tab.
// Collect a bounded BOSS job-search sample through isolated OpenCLI sessions.
// Up to two requests run per batch; each result is persisted before the next batch starts.
// Keeps only job/company fields; recruiter names and online-status fields are deliberately omitted.

import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const defaultOutDir = path.join(projectRoot, 'raw');

function parseArgs(argv) {
  const parsed = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    const values = parsed.get(key) ?? [];
    values.push(value);
    parsed.set(key, values);
    i += 1;
  }
  return parsed;
}

const options = parseArgs(process.argv.slice(2));
const values = (key, fallback) => options.get(key) ?? fallback;
const one = (key, fallback) => values(key, [fallback])[0];
const city = one('city', '深圳');
const queries = values('query', ['Java后端', 'AI Agent', '智能体']);
const salaryBuckets = values('salary-bucket', ['20-30K', '30-50K', '50K以上']);
const page = Number(one('page', '1'));
const limit = Number(one('limit', '10'));
const concurrency = Number(one('concurrency', '2'));
const intervalMs = Number(one('interval-ms', '15000'));
const outDir = path.resolve(one('out-dir', defaultOutDir));
const resumeFile = one('resume', '');

if (!Number.isInteger(page) || page < 1) throw new Error('--page must be a positive integer');
if (!Number.isInteger(limit) || limit < 1 || limit > 15) throw new Error('--limit must be between 1 and 15');
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 2) throw new Error('--concurrency must be 1 or 2');
if (!Number.isInteger(intervalMs) || intervalMs < 10000 || intervalMs > 120000) throw new Error('--interval-ms must be between 10000 and 120000');

function timestamp() {
  return new Date().toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}/, '');
}

function parseJsonOutput(stdout) {
  const text = stdout.trim();
  try {
    return JSON.parse(text);
  } catch {
    // Some CLI versions may print a status line around JSON. Extract one complete JSON value.
    for (let start = 0; start < text.length; start += 1) {
      if (text[start] !== '[' && text[start] !== '{') continue;
      const open = text[start];
      const close = open === '[' ? ']' : '}';
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let end = start; end < text.length; end += 1) {
        const char = text[end];
        if (inString) {
          if (escaped) escaped = false;
          else if (char === '\\') escaped = true;
          else if (char === '"') inString = false;
          continue;
        }
        if (char === '"') inString = true;
        else if (char === open || (open === '{' && char === '[') || (open === '[' && char === '{')) depth += 1;
        else if (char === close || (open === '{' && char === ']') || (open === '[' && char === '}')) {
          depth -= 1;
          if (depth === 0) {
            try { return JSON.parse(text.slice(start, end + 1)); } catch { break; }
          }
        }
      }
    }
    throw new Error('OpenCLI output was not valid JSON');
  }
}

function resultRows(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ['data', 'jobs', 'results', 'list', 'items']) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  throw new Error(`Unexpected OpenCLI JSON shape (${Object.keys(payload ?? {}).join(', ')})`);
}

function field(row, names) {
  for (const name of names) {
    const value = row?.[name];
    if (typeof value === 'string' || typeof value === 'number') return value;
    if (Array.isArray(value)) return value.filter((item) => typeof item === 'string' || typeof item === 'number');
    if (value && typeof value === 'object') {
      for (const nested of ['name', 'text', 'label', 'url']) {
        if (typeof value[nested] === 'string') return value[nested];
      }
    }
  }
  return null;
}

function cleanRow(row) {
  return {
    title: field(row, ['name', 'title', 'jobName']),
    salary: field(row, ['salary']),
    company: field(row, ['company', 'companyName']),
    area: field(row, ['area', 'location', 'district']),
    experience: field(row, ['experience', 'experienceRequirement']),
    degree: field(row, ['degree', 'education']),
    skills: field(row, ['skills', 'skillTags']),
    securityId: field(row, ['security_id', 'securityId']),
    url: field(row, ['url', 'jobUrl']),
  };
}

function runOpenCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('opencli', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, OPENCLI_CLOSE_OWNED_TAB: '1', OPENCLI_BROWSER_COMMAND_TIMEOUT: '180' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.once('error', (error) => {
      reject(error);
    });
    child.once('close', (code, signal) => {
      if (code === 0) resolve(stdout);
      else {
        const diagnostic = stderr.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(-4).join(' | ')
          .replace(/(cookie|authorization|token|password)(\s*[:=]\s*)\S+/gi, '$1$2<REDACTED>')
          .replace(/(https?:\/\/[^\s?]+)\?[^\s]+/gi, '$1?<QUERY_REDACTED>')
          .slice(0, 500);
        let stdoutDiagnostic = '';
        try {
          const payload = JSON.parse(stdout.trim());
          const error = payload?.error;
          if (error && typeof error === 'object') {
            stdoutDiagnostic = [error.code, error.message, error.hint].filter((value) => typeof value === 'string' && value.trim()).join(': ');
          }
        } catch { /* CLI versions may emit non-JSON failures; retain stderr instead. */ }
        stdoutDiagnostic = stdoutDiagnostic
          .replace(/(cookie|authorization|token|password)(\s*[:=]\s*)\S+/gi, '$1$2<REDACTED>')
          .replace(/(https?:\/\/[^\s?]+)\?[^\s]+/gi, '$1?<QUERY_REDACTED>')
          .slice(0, 500);
        const detail = [diagnostic, stdoutDiagnostic].filter(Boolean).join(' | ');
        reject(new Error(`opencli exited with code ${code ?? 'null'}${signal ? ` (${signal})` : ''}${detail ? `: ${detail}` : ''}`));
      }
    });
    // Let OpenCLI's own browser timeout run so its finally path can release
    // the page lease; killing this process early can leave about:blank behind.
  });
}

async function assertOwnedTabCleanupSupport() {
  const versionText = await runOpenCli(['--version']);
  const match = versionText.match(/\b(\d+)\.(\d+)\.(\d+)\b/);
  if (!match || Number(match[1]) < 2) {
    throw new Error(`OpenCLI >= 2.0.0 is required for owned-tab cleanup; got ${versionText.trim() || 'unknown version'}`);
  }
}

await assertOwnedTabCleanupSupport();

await mkdir(outDir, { recursive: true });
const outFile = resumeFile ? path.resolve(resumeFile) : path.join(outDir, `boss-search_${timestamp()}.jsonl`);
const taskKey = (query, salaryBucket) => `${query}\u001f${salaryBucket}\u001f${page}`;
const tasks = queries.flatMap((query) => salaryBuckets.map((salaryBucket) => ({ query, salaryBucket })));
let completedKeys = new Set();
let totalRows = 0;

if (resumeFile) {
  const priorLines = (await readFile(outFile, 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const manifest = priorLines.find((record) => record.type === 'manifest');
  if (!manifest) throw new Error('--resume file has no collection manifest');
  const expected = { city, page, limit, queries, salaryBuckets };
  for (const key of Object.keys(expected)) {
    if (JSON.stringify(manifest[key]) !== JSON.stringify(expected[key])) throw new Error(`--resume settings do not match saved manifest field: ${key}`);
  }
  completedKeys = new Set(priorLines.filter((record) => record.type === 'slice').map((record) => taskKey(record.query, record.salaryBucket)));
  totalRows = priorLines.filter((record) => record.type === 'slice').reduce((sum, record) => sum + (record.count ?? record.rows?.length ?? 0), 0);
} else {
  await appendFile(outFile, `${JSON.stringify({
    type: 'manifest',
    source: 'BOSS直聘 via OpenCLI',
    collectedAt: new Date().toISOString(),
    city,
    jobType: '全职',
    page,
    limit,
    queries,
    salaryBuckets,
    concurrency,
    intervalMs,
    siteSession: 'ephemeral',
    fieldsKept: ['title', 'salary', 'company', 'area', 'experience', 'degree', 'skills', 'securityId', 'url'],
    fieldsOmitted: ['boss', 'bossOnline'],
  })}\n`, 'utf8');
}

let writeQueue = Promise.resolve();
function appendRecord(record) {
  writeQueue = writeQueue.then(() => appendFile(outFile, `${JSON.stringify(record)}\n`, 'utf8'));
  return writeQueue;
}

const pending = tasks.filter((task) => !completedKeys.has(taskKey(task.query, task.salaryBucket)));
let completedSlices = completedKeys.size;
let stop = false;
for (let offset = 0; offset < pending.length && !stop; offset += concurrency) {
  const batch = pending.slice(offset, offset + concurrency);
  const results = await Promise.all(batch.map(async ({ query, salaryBucket }) => {
    const sliceTime = new Date().toISOString();
    const cliArgs = [
      'boss', 'search', query,
      '--city', city,
      '--salary', salaryBucket,
      '--jobType', '全职',
      '--page', String(page),
      '--limit', String(limit),
      '-f', 'json',
      '--window', 'background',
      '--site-session', 'ephemeral',
    ];
    try {
      const payload = parseJsonOutput(await runOpenCli(cliArgs));
      const rows = resultRows(payload).map(cleanRow);
      await appendRecord({ type: 'slice', collectedAt: sliceTime, query, salaryBucket, page, count: rows.length, rows });
      completedSlices += 1;
      totalRows += rows.length;
      process.stdout.write(`${JSON.stringify({ query, salaryBucket, count: rows.length, completedSlices, totalRows, output: path.basename(outFile) })}\n`);
      return { ok: true };
    } catch (error) {
      await appendRecord({ type: 'error', collectedAt: sliceTime, query, salaryBucket, page, message: error.message });
      process.stderr.write(`Failed query=${query}, salary=${salaryBucket}: ${error.message}\n`);
      return { ok: false };
    }
  }));
  if (results.some((result) => !result.ok)) {
    stop = true;
    process.stderr.write(`Stopped after the current batch. Partial output saved: ${outFile} (${completedSlices} slices, ${totalRows} jobs). Resume with --resume "${outFile}" after reviewing the error.\n`);
    process.exitCode = 1;
  } else if (offset + concurrency < pending.length) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

if (!stop) process.stdout.write(`${JSON.stringify({ complete: true, completedSlices, totalRows, output: outFile })}\n`);
