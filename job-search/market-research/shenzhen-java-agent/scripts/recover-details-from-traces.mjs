#!/usr/bin/env node
// Offline-only recovery for complete BOSS detail HTML already retained by OpenCLI.

import { appendFile, mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBossDetailTrace } from './boss-trace-detail.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const rawDir = path.join(projectRoot, 'raw');
const args = new Map();
const cliArgs = process.argv.slice(2);
for (let i = 0; i < cliArgs.length; i += 2) {
  const key = cliArgs[i]?.replace(/^--/, '');
  const value = cliArgs[i + 1];
  if (!key || !value || key.startsWith('-') || !cliArgs[i].startsWith('--')) throw new Error('Use --input <failed-details.jsonl>');
  args.set(key, value);
}

const files = (await readdir(rawDir)).filter((name) => /^boss-details[-_].*\.jsonl$/.test(name)).sort();
const inputFile = path.resolve(args.get('input') ?? (files.length ? path.join(rawDir, files.at(-1)) : ''));
if (!inputFile || inputFile === path.resolve('.')) throw new Error('No detail JSONL found; pass --input <file>');
const sourceLines = (await readFile(inputFile, 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const manifest = sourceLines.find((row) => row.type === 'manifest');
const searchInput = manifest?.inputFile ? path.resolve(projectRoot, manifest.inputFile) : null;
if (!searchInput) throw new Error(`Source manifest does not identify its search input: ${inputFile}`);

const searchLines = (await readFile(searchInput, 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const jobs = new Map();
for (const slice of searchLines.filter((row) => row.type === 'slice')) {
  for (const job of slice.rows ?? []) {
    if (job.securityId) jobs.set(String(job.securityId), { ...job, searchSources: [{ query: slice.query, salaryBucket: slice.salaryBucket, searchCollectedAt: slice.collectedAt }] });
  }
}

const succeeded = new Set(sourceLines.filter((row) => row.type === 'detail').map((row) => String(row.search?.securityId ?? '')));
const failures = sourceLines.filter((row) => ['error', 'unavailable'].includes(row.type) && row.securityId && !succeeded.has(String(row.securityId)));
const recoverable = [...new Map(failures.map((row) => [String(row.securityId), row])).values()];
const stamp = new Date().toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}/, '');
const outFile = path.join(rawDir, `boss-details-recovered_${stamp}.jsonl`);
await mkdir(rawDir, { recursive: true });
await appendFile(outFile, `${JSON.stringify({ type: 'recovery-manifest', source: 'OpenCLI retained HTML trace (offline)', collectedAt: new Date().toISOString(), inputFile: path.relative(projectRoot, inputFile), searchInput: path.relative(projectRoot, searchInput), attempted: recoverable.length, requestsSent: 0 })}\n`, 'utf8');

let recovered = 0;
for (const failure of recoverable) {
  const securityId = String(failure.securityId);
  const search = jobs.get(securityId);
  if (!search) continue;
  const trace = await findBossDetailTrace(securityId);
  if (!trace) continue;
  const detail = { ...trace.detail, url: search.url ?? trace.detail.url };
  await appendFile(outFile, `${JSON.stringify({ type: 'detail', collectedAt: trace.responseCapturedAt ?? new Date().toISOString(), collectionMethod: 'opencli-retained-html-trace', traceFile: trace.traceFile, responseStatus: trace.responseStatus, search: { title: search.title, salary: search.salary, company: search.company, area: search.area, securityId, url: search.url, searchSources: search.searchSources }, detail })}\n`, 'utf8');
  recovered += 1;
  process.stdout.write(`${JSON.stringify({ recovered: true, title: search.title, company: search.company, salary: detail.salary, output: path.basename(outFile) })}\n`);
}
process.stdout.write(`${JSON.stringify({ complete: true, recovered, attempted: recoverable.length, requestsSent: 0, output: outFile })}\n`);
