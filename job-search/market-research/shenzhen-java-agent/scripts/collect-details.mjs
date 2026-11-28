#!/usr/bin/env node
// Requires OpenCLI >=2.0.0 and an extension that supports close-owned-tab.
// Collect detailed postings for the bounded search sample in isolated two-request batches.
// Each response is persisted before the next batch; recruiter personal fields are omitted.

import { appendFile, mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findBossDetailTrace } from './boss-trace-detail.mjs';
import { employerExclusionReason } from './screening.mjs';
import { DEFAULT_SCOPE, scopeExclusionReason } from './scope.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const defaultRawDir = path.join(projectRoot, 'raw');

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
const values = (key) => options.get(key) ?? [];
const one = (key, fallback) => values(key)[0] ?? fallback;
const rawDir = path.resolve(one('raw-dir', defaultRawDir));
const concurrency = Number(one('concurrency', '2'));
const intervalMs = Number(one('interval-ms', '60000'));
const requestedMax = Number(one('max-jobs', '0'));
const explicitlySkippedIds = new Set(values('skip-id').map((value) => String(value).trim()).filter(Boolean));
const explicitlyRetriedAuthIds = new Set(values('retry-auth-id').map((value) => String(value).trim()).filter(Boolean));
const explicitlyRetriedUnavailableIds = new Set(values('retry-unavailable-id').map((value) => String(value).trim()).filter(Boolean));
const minSalaryK = Number(one('min-salary-k', String(DEFAULT_SCOPE.minSalaryK)));
const maxSalaryK = Number(one('max-salary-k', String(DEFAULT_SCOPE.maxSalaryK)));
const maxExperienceYears = Number(one('max-experience-years', String(DEFAULT_SCOPE.maxExperienceYears)));
const scope = { minSalaryK, maxSalaryK, maxExperienceYears };
const outDir = path.resolve(one('out-dir', rawDir));

if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 2) throw new Error('--concurrency must be 1 or 2');
if (!Number.isInteger(intervalMs) || intervalMs < 10000 || intervalMs > 120000) throw new Error('--interval-ms must be between 10000 and 120000');
if (!Number.isInteger(requestedMax) || requestedMax < 0) throw new Error('--max-jobs must be zero (all) or a positive integer');
if (!Number.isFinite(minSalaryK) || !Number.isFinite(maxSalaryK) || minSalaryK > maxSalaryK) throw new Error('Invalid salary range');
if (!Number.isFinite(maxExperienceYears) || maxExperienceYears < 0) throw new Error('--max-experience-years must be a non-negative number');

function timestamp() {
  return new Date().toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}/, '');
}

function parseJsonOutput(stdout) {
  const text = stdout.trim();
  try {
    return JSON.parse(text);
  } catch {
    for (let start = 0; start < text.length; start += 1) {
      if (text[start] !== '[' && text[start] !== '{') continue;
      const open = text[start];
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
        else if (char === '{' || char === '[') depth += 1;
        else if (char === '}' || char === ']') {
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

function detailRecord(payload) {
  if (Array.isArray(payload)) return payload[0] ?? null;
  for (const key of ['data', 'job', 'detail', 'result', 'item']) {
    const value = payload?.[key];
    if (Array.isArray(value)) return value[0] ?? null;
    if (value && typeof value === 'object') return value;
  }
  if (payload && typeof payload === 'object') return payload;
  return null;
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

function cleanDetail(row) {
  return {
    title: field(row, ['name', 'title', 'jobName']),
    salary: field(row, ['salary']),
    city: field(row, ['city', 'area']),
    address: field(row, ['address', 'location']),
    experience: field(row, ['experience', 'experienceRequirement']),
    degree: field(row, ['degree', 'education']),
    description: field(row, ['description', 'jobDescription', 'content']),
    skills: field(row, ['skills', 'skillTags']),
    welfare: field(row, ['welfare', 'benefits']),
    company: field(row, ['company', 'companyName']),
    industry: field(row, ['industry']),
    companyScale: field(row, ['scale', 'companyScale']),
    companyStage: field(row, ['stage', 'companyStage']),
    companyLegalName: field(row, ['companyLegalName', 'registeredName']),
    companyType: field(row, ['companyType']),
    companyFoundedDate: field(row, ['companyFoundedDate', 'foundedDate']),
    companyStatus: field(row, ['companyStatus']),
    registeredCapital: field(row, ['registeredCapital']),
    companyIntro: field(row, ['companyIntro', 'companyDescription']),
    companyRelationship: field(row, ['companyRelationship']),
    companyCertifications: field(row, ['companyCertifications']),
    detailLevel: field(row, ['detailLevel']),
    detailedRequirementsProvided: field(row, ['detailedRequirementsProvided']),
    url: field(row, ['url', 'jobUrl']),
  };
}

function detailEmployerFilter(job, detail) {
  return employerExclusionReason({
    ...job,
    detailCompany: detail.company,
    companyLegalName: detail.companyLegalName,
    companyType: detail.companyType,
    companyCertifications: detail.companyCertifications,
  });
}

function searchReference(job) {
  return { title: job.title, salary: job.salary, company: job.company, area: job.area, securityId: job.securityId, url: job.url, searchSources: job.searchSources };
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
        const diagnostic = stderr
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(-4)
          .join(' | ')
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
    // Do not SIGTERM the CLI from this collector: OpenCLI's adapter promise is
    // intentionally not cancelled on its own timeout, and process termination
    // bypasses lease cleanup, leaving an about:blank placeholder in Chrome.
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

const files = (await readdir(rawDir)).filter((name) => /^boss-search_.*\.jsonl$/.test(name)).sort();
const inputFile = path.resolve(one('input', files.length ? path.join(rawDir, files.at(-1)) : ''));
if (!inputFile || inputFile === path.resolve('.')) throw new Error('No search JSONL found; pass --input <file>');

const searchLines = (await readFile(inputFile, 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const slices = searchLines.filter((line) => line.type === 'slice');
const jobsByKey = new Map();
for (const slice of slices) {
  for (const row of slice.rows ?? []) {
    const id = String(row.securityId ?? '').trim();
    const url = String(row.url ?? '').trim();
    const key = id ? `id:${id}` : url ? `url:${url.split(/[?#]/, 1)[0].replace(/\/+$/, '')}` : `fields:${[row.company, row.title, row.salary, row.area].map((value) => String(value ?? '').trim()).join('|')}`;
    const existing = jobsByKey.get(key);
    const source = { query: slice.query, salaryBucket: slice.salaryBucket, page: Number(slice.page ?? 1), searchCollectedAt: slice.collectedAt };
    if (existing) {
      if (!existing.searchSources.some((item) => item.query === source.query && item.salaryBucket === source.salaryBucket && item.page === source.page)) existing.searchSources.push(source);
    }
    else jobsByKey.set(key, { ...row, searchSources: [source] });
  }
}

const searchUniqueJobs = [...jobsByKey.values()].filter((job) => job.securityId);
const employerExcludedJobs = searchUniqueJobs.filter((job) => employerExclusionReason(job));
const salaryEligibleJobs = searchUniqueJobs.filter((job) => {
  if (employerExclusionReason(job)) return false;
  return scopeExclusionReason(job, scope) === null;
});
const excludedByScope = searchUniqueJobs.filter((job) => scopeExclusionReason(job, scope));
const scopeExclusionCounts = excludedByScope.reduce((counts, job) => {
  const reason = scopeExclusionReason(job, scope);
  counts[reason] = (counts[reason] ?? 0) + 1;
  return counts;
}, {});
let jobs = salaryEligibleJobs;
if (requestedMax > 0) jobs = jobs.slice(0, requestedMax);
if (!jobs.length) throw new Error('No deduplicated jobs with security IDs were found');

await mkdir(outDir, { recursive: true });
const existingFiles = (await readdir(outDir)).filter((name) => /^boss-details[-_].*\.jsonl$/.test(name));
const doneIds = new Set();
const unavailableIds = new Set();
const employerExcludedIds = new Set();
const authFailureCounts = new Map();
for (const name of existingFiles) {
  const text = await readFile(path.join(outDir, name), 'utf8');
  for (const line of text.split(/\r?\n/).filter(Boolean)) {
    try {
      const record = JSON.parse(line);
      if (record.type === 'detail' && record.search?.securityId) doneIds.add(String(record.search.securityId));
      if (record.type === 'filtered' && record.search?.securityId) employerExcludedIds.add(String(record.search.securityId));
      if (record.type === 'error' && record.securityId && /AUTH_REQUIRED/.test(String(record.message ?? ''))) {
        const id = String(record.securityId);
        authFailureCounts.set(id, (authFailureCounts.get(id) ?? 0) + 1);
      }
      if ((record.type === 'unavailable' || record.type === 'error') && record.securityId && String(record.message ?? '').includes('BOSS detail page did not expose a complete job posting')) {
        unavailableIds.add(String(record.securityId));
      }
    } catch {
      // Ignore malformed partial lines; a later run can collect that detail again.
    }
  }
}
const pendingJobs = jobs.filter((job) => !doneIds.has(String(job.securityId))
  && (!unavailableIds.has(String(job.securityId)) || explicitlyRetriedUnavailableIds.has(String(job.securityId)))
  && !employerExcludedIds.has(String(job.securityId))
  && ((authFailureCounts.get(String(job.securityId)) ?? 0) < 2 || explicitlyRetriedAuthIds.has(String(job.securityId)))
  && !explicitlySkippedIds.has(String(job.securityId)));
const outFile = path.join(outDir, `boss-details_${timestamp()}.jsonl`);
await appendFile(outFile, `${JSON.stringify({
  type: 'manifest',
  source: 'BOSS直聘 via OpenCLI',
  collectedAt: new Date().toISOString(),
  inputFile: path.relative(projectRoot, inputFile),
  searchUniqueJobs: searchUniqueJobs.length,
  scopeExclusionCounts,
  employerExcludedCount: employerExcludedJobs.length,
  minSalaryK,
  maxSalaryK,
  maxExperienceYears,
  selectionRule: 'Only listings whose entire displayed salary range is within the configured salary bounds and whose displayed experience upper bound does not exceed the configured maximum are expanded; missing experience is retained for later verification.',
  uniqueJobs: jobs.length,
  alreadyCollected: jobs.filter((job) => doneIds.has(String(job.securityId))).length,
  previouslyUnavailable: unavailableIds.size,
  previouslyFilteredCount: employerExcludedIds.size,
  explicitlySkippedIds: [...explicitlySkippedIds],
  explicitlyRetriedUnavailableIds: [...explicitlyRetriedUnavailableIds],
  explicitlySkippedCount: jobs.filter((job) => explicitlySkippedIds.has(String(job.securityId))).length,
  previouslyAuthFailedCount: [...authFailureCounts.values()].filter((count) => count > 0).length,
  explicitlyRetriedAuthIds: [...explicitlyRetriedAuthIds],
  pendingDetails: pendingJobs.length,
  concurrency,
  intervalMs,
  browserCommandTimeoutSeconds: 180,
  siteSession: 'ephemeral',
  detailsKept: ['title', 'salary', 'city', 'address', 'experience', 'degree', 'description', 'detailLevel', 'detailedRequirementsProvided', 'skills', 'welfare', 'company', 'industry', 'companyScale', 'companyStage', 'companyLegalName', 'companyType', 'companyFoundedDate', 'companyStatus', 'registeredCapital', 'companyIntro', 'companyRelationship', 'companyCertifications', 'url'],
  fieldsOmitted: ['boss_name', 'boss_title', 'contact details'],
})}\n`, 'utf8');

let completed = 0;
const successfulIds = new Set();
let writeQueue = Promise.resolve();
function appendRecord(record) {
  writeQueue = writeQueue.then(() => appendFile(outFile, `${JSON.stringify(record)}\n`, 'utf8'));
  return writeQueue;
}

let stopped = false;
for (let offset = 0; offset < pendingJobs.length && !stopped; offset += concurrency) {
  const batch = pendingJobs.slice(offset, offset + concurrency);
  const results = await Promise.all(batch.map(async (job, batchIndex) => {
    const index = offset + batchIndex + 1;
    const startedAt = new Date().toISOString();
    try {
      const stdout = await runOpenCli(['boss', 'detail', String(job.securityId), '-f', 'json', '--window', 'background', '--site-session', 'ephemeral', '--trace', 'retain-on-failure']);
      const detail = cleanDetail(detailRecord(parseJsonOutput(stdout)) ?? {});
      if (!detail.title && !detail.description && !detail.company) throw new Error('Detail response contained no expected job/company fields');
      const exclusionReason = detailEmployerFilter(job, detail);
      if (exclusionReason) {
        await appendRecord({ type: 'filtered', filteredAt: startedAt, reason: exclusionReason, source: 'detail-page', search: searchReference(job), companyEvidence: { detailCompany: detail.company, companyLegalName: detail.companyLegalName, companyType: detail.companyType, companyCertifications: detail.companyCertifications } });
        employerExcludedIds.add(String(job.securityId));
        process.stdout.write(`${JSON.stringify({ index, total: pendingJobs.length, title: job.title, company: job.company, ok: true, excluded: exclusionReason, output: path.basename(outFile) })}\n`);
        return { ok: true, excluded: true };
      }
      await appendRecord({ type: 'detail', collectedAt: startedAt, search: searchReference(job), detail });
      completed += 1;
      successfulIds.add(String(job.securityId));
      process.stdout.write(`${JSON.stringify({ index, total: pendingJobs.length, title: job.title, company: job.company, ok: true, output: path.basename(outFile) })}\n`);
      return { ok: true };
    } catch (error) {
      let trace = null;
      try { trace = await findBossDetailTrace(String(job.securityId)); } catch { /* Keep the original CLI error if local trace recovery fails. */ }
      if (trace) {
        const detail = { ...trace.detail, url: job.url ?? trace.detail.url };
        const exclusionReason = detailEmployerFilter(job, detail);
        if (exclusionReason) {
          await appendRecord({ type: 'filtered', filteredAt: trace.responseCapturedAt ?? startedAt, reason: exclusionReason, source: 'retained-detail-trace', traceFile: trace.traceFile, search: searchReference(job), companyEvidence: { detailCompany: detail.company, companyLegalName: detail.companyLegalName, companyType: detail.companyType, companyCertifications: detail.companyCertifications } });
          employerExcludedIds.add(String(job.securityId));
          process.stdout.write(`${JSON.stringify({ index, total: pendingJobs.length, title: job.title, company: job.company, ok: true, excluded: exclusionReason, recoveredFromTrace: true, output: path.basename(outFile) })}\n`);
          return { ok: true, excluded: true };
        }
        await appendRecord({ type: 'detail', collectedAt: trace.responseCapturedAt ?? startedAt, collectionMethod: 'opencli-retained-html-trace', traceFile: trace.traceFile, responseStatus: trace.responseStatus, search: searchReference(job), detail });
        completed += 1;
        successfulIds.add(String(job.securityId));
        process.stdout.write(`${JSON.stringify({ index, total: pendingJobs.length, title: job.title, company: job.company, ok: true, recoveredFromTrace: true, output: path.basename(outFile) })}\n`);
        return { ok: true, recoveredFromTrace: true };
      }
      const unavailable = error.message.includes('BOSS detail page did not expose a complete job posting');
      await appendRecord({ type: unavailable ? 'unavailable' : 'error', collectedAt: startedAt, index, title: job.title, company: job.company, securityId: job.securityId, message: error.message });
      if (unavailable) {
        unavailableIds.add(String(job.securityId));
        process.stderr.write(`Unavailable detail at ${index}/${pendingJobs.length}, title=${job.title}, company=${job.company}; recorded and continuing.\n`);
        return { ok: true, unavailable: true };
      }
      const authRequired = /AUTH_REQUIRED: BOSS redirected the job detail page to the login flow/.test(error.message);
      if (authRequired) authFailureCounts.set(String(job.securityId), (authFailureCounts.get(String(job.securityId)) ?? 0) + 1);
      process.stderr.write(`${unavailable ? 'Incomplete detail page' : 'Detail request failed'} at ${index}/${pendingJobs.length}, title=${job.title}, company=${job.company}: ${error.message}\n`);
      return { ok: false, authRequired };
    }
  }));

  const authFailures = results.filter((result) => result.authRequired);
  const hardFailures = results.filter((result) => !result.ok && !result.authRequired);
  if (hardFailures.length > 0 || authFailures.length === batch.length) {
    stopped = true;
    process.stderr.write(`Stopped after this batch; no further BOSS requests will be sent. Inspect any retained trace before resuming. Partial output: ${outFile} (${completed} details)\n`);
    process.exitCode = 1;
  } else if (authFailures.length > 0) {
    process.stderr.write(`Deferred ${authFailures.length} isolated AUTH_REQUIRED job(s); continuing other jobs. A job with two recorded auth failures will be skipped unless --retry-auth-id is supplied.\n`);
  }
  if (!stopped && offset + concurrency < pendingJobs.length) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

const unresolvedAuthIds = [...authFailureCounts.keys()].filter((id) => jobs.some((job) => String(job.securityId) === id)
  && !doneIds.has(id) && !successfulIds.has(id) && !employerExcludedIds.has(id));
const unresolvedUnavailableIds = [...unavailableIds].filter((id) => jobs.some((job) => String(job.securityId) === id)
  && !doneIds.has(id) && !successfulIds.has(id) && !employerExcludedIds.has(id));
const unresolvedExplicitSkipIds = [...explicitlySkippedIds].filter((id) => jobs.some((job) => String(job.securityId) === id)
  && !doneIds.has(id) && !successfulIds.has(id) && !employerExcludedIds.has(id));
const complete = !stopped && unresolvedAuthIds.length === 0 && unresolvedUnavailableIds.length === 0 && unresolvedExplicitSkipIds.length === 0;
await appendRecord({
  type: 'details-summary',
  completedAt: new Date().toISOString(),
  complete,
  requestedJobs: pendingJobs.length,
  collectedThisRun: completed,
  alreadyCollected: jobs.filter((job) => doneIds.has(String(job.securityId))).length,
  excludedEmployerCount: employerExcludedJobs.length + employerExcludedIds.size,
  deferredAuthIds: unresolvedAuthIds,
  unavailableIds: unresolvedUnavailableIds,
  explicitlySkippedIds: unresolvedExplicitSkipIds,
  stopped,
});
process.stdout.write(`${JSON.stringify({ complete, stopped, completed, requestedJobs: pendingJobs.length, alreadyCollected: jobs.filter((job) => doneIds.has(String(job.securityId))).length, deferredAuth: unresolvedAuthIds.length, unavailable: unresolvedUnavailableIds.length, explicitlySkipped: unresolvedExplicitSkipIds.length, output: outFile })}\n`);
if (!complete) process.exitCode = 1;
