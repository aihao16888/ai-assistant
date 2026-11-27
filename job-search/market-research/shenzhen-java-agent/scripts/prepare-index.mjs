#!/usr/bin/env node
// Build source-linked search and detail indexes from sanitized BOSS JSONL snapshots.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const rawDir = path.join(projectRoot, 'raw');
const outDir = path.join(projectRoot, 'out');
await mkdir(outDir, { recursive: true });

const readJsonl = async (file) => (await readFile(file, 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);

function positionKey(row) {
  const id = String(row.securityId ?? '').trim();
  if (id) return `id:${id}`;
  const rawUrl = String(row.url ?? '').trim();
  if (rawUrl) {
    try {
      const url = new URL(rawUrl);
      return `url:${url.origin}${url.pathname.replace(/\/+$/, '')}`;
    } catch {
      return `url:${rawUrl.split(/[?#]/, 1)[0].replace(/\/+$/, '')}`;
    }
  }
  return `fields:${[row.company, row.title, row.salary, row.area].map((value) => String(value ?? '').trim()).join('|')}`;
}

const searchFiles = (await readdir(rawDir)).filter((name) => /^boss-search_.*\.jsonl$/.test(name)).sort();
if (!searchFiles.length) throw new Error('No BOSS search snapshots found in raw/');
const inputFile = path.join(rawDir, searchFiles.at(-1));
const records = await readJsonl(inputFile);
const manifest = records.find((record) => record.type === 'manifest') ?? {};
const slices = records.filter((record) => record.type === 'slice');
const minSalaryFloorK = Number(manifest.minSalaryFloorK ?? 20);
const maxSalaryFloorK = Number(manifest.maxSalaryFloorK ?? 40);
const maxExperienceYears = Number(manifest.maxExperienceYears ?? 5);

const jobsByKey = new Map();
for (const slice of slices) {
  for (const row of slice.rows ?? []) {
    const key = positionKey(row);
    const source = { query: slice.query, salaryBucket: slice.salaryBucket, page: Number(slice.page ?? 1) };
    const existing = jobsByKey.get(key);
    if (existing) {
      if (!existing.sources.some((item) => item.query === source.query && item.salaryBucket === source.salaryBucket && item.page === source.page)) existing.sources.push(source);
      existing.resultCount += 1;
      if (Date.parse(slice.collectedAt ?? '') >= Date.parse(existing.searchCollectedAt ?? '')) {
        Object.assign(existing, row, { searchCollectedAt: slice.collectedAt });
      }
    } else jobsByKey.set(key, { ...row, sources: [source], resultCount: 1, searchCollectedAt: slice.collectedAt });
  }
}

function salaryFloorK(salary) {
  if (typeof salary !== 'string') return null;
  const range = salary.match(/(\d+(?:\.\d+)?)\s*-\s*\d+(?:\.\d+)?\s*K/i);
  if (range) return Number(range[1]);
  const single = salary.match(/(\d+(?:\.\d+)?)\s*K(?:以上|\+)?/i);
  return single ? Number(single[1]) : null;
}

function experienceMinimumYears(experience) {
  const value = String(experience ?? '').trim();
  if (!value) return null;
  if (/不限|应届|在校|实习|无经验/.test(value)) return 0;
  if (/\d+(?:\.\d+)?\s*年\s*(?:以内|以下)/.test(value)) return 0;
  const range = value.match(/(\d+(?:\.\d+)?)\s*(?:-|~|～|至)\s*\d+(?:\.\d+)?\s*年/);
  if (range) return Number(range[1]);
  const minimum = value.match(/(\d+(?:\.\d+)?)\s*年\s*(?:以上|及以上|\+)/);
  if (minimum) return Number(minimum[1]);
  const single = value.match(/(\d+(?:\.\d+)?)\s*年/);
  return single ? Number(single[1]) : null;
}

function requirementStatus(detail) {
  if (typeof detail?.detailedRequirementsProvided === 'boolean') return detail.detailedRequirementsProvided;
  return /任职要求|岗位要求|工作要求/.test(String(detail?.description ?? ''));
}

function detailCompleteness(detail) {
  if (!detail || typeof detail !== 'object') return 'missing';
  const description = String(detail.description ?? '').trim();
  if (!description) return 'metadata-only';
  if (detail.detailLevel === 'short-summary' || description.length < 80) return 'short-summary';
  return 'full-text';
}

function detailScore(record) {
  const detail = record.detail ?? {};
  const completeness = detailCompleteness(detail);
  return [
    requirementStatus(detail) ? 1 : 0,
    completeness === 'full-text' ? 1 : 0,
    String(detail.description ?? '').length,
    [detail.company, detail.industry, detail.companyScale, detail.companyStage, detail.address].filter(Boolean).length,
    Date.parse(record.collectedAt ?? '') || 0,
  ];
}

function compareScore(a, b) {
  const left = detailScore(a);
  const right = detailScore(b);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] ?? 0) !== (right[index] ?? 0)) return (left[index] ?? 0) - (right[index] ?? 0);
  }
  return 0;
}

const detailFiles = (await readdir(rawDir)).filter((name) => /^boss-details[-_].*\.jsonl$/.test(name)).sort();
const detailsById = new Map();
const errorsById = new Map();
let detailRows = 0;
for (const name of detailFiles) {
  const file = path.join(rawDir, name);
  for (const record of await readJsonl(file)) {
    const id = String(record.search?.securityId ?? record.securityId ?? '');
    if (record.type === 'detail' && record.search?.securityId) {
      detailRows += 1;
      const key = String(record.search.securityId);
      const candidate = { ...record, sourceFile: name };
      const current = detailsById.get(key);
      if (!current || compareScore(candidate, current) > 0) detailsById.set(key, candidate);
    } else if (['error', 'unavailable'].includes(record.type) && id) {
      const list = errorsById.get(id) ?? [];
      list.push(record);
      errorsById.set(id, list);
    }
  }
}

function companyScreening(detail, searchCompany) {
  const evidence = [];
  if (detail?.companyRelationship) evidence.push('详情页标注客户公司');
  if (Array.isArray(detail?.companyCertifications) && detail.companyCertifications.length) {
    evidence.push(`详情页公司资质：${detail.companyCertifications.join('、')}`);
  }
  if (/(外包|猎头|德科|人力资源|劳务派遣|人才服务)/i.test(`${detail?.company ?? ''} ${detail?.companyLegalName ?? ''} ${searchCompany ?? ''}`)) {
    evidence.push('公司名称命中中介/外包线索，尚未核实用工关系');
  }
  if (detail?.companyRelationship && detail?.companyCertifications?.some((item) => /人力资源服务许可证/.test(item))) {
    return { status: '排除候选，待核实', evidence };
  }
  if (evidence.length) return { status: '优先复核外包/猎头线索', evidence };
  return { status: '待核实招聘主体和用工关系', evidence: ['详情页未提供足够证据判断是否为外包/猎头'] };
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(' | ') : value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function writeCsv(rows, columns) {
  return [columns.map(csvCell).join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\n') + '\n';
}

const allJobs = [...jobsByKey.values()].map((job) => {
  const id = String(job.securityId ?? '');
  const record = detailsById.get(id);
  const detail = record?.detail ?? null;
  const listedFloor = salaryFloorK(job.salary);
  const actualFloor = salaryFloorK(detail?.salary);
  const floor = actualFloor ?? listedFloor;
  const salarySource = actualFloor != null ? '职位详情页' : listedFloor != null ? '搜索列表（待详情复核）' : '无法解析';
  const salaryGate = floor == null ? '待核薪资' : floor < 20 ? '不满足下限' : actualFloor != null ? '详情薪资通过' : '列表薪资初筛通过';
  const statusErrors = errorsById.get(id) ?? [];
  const detailStatus = detail
    ? detailCompleteness(detail) === 'short-summary' ? '仅短摘要，未提供完整任职要求' : requirementStatus(detail) ? '详情及要求已采集' : '详情已采集，未识别到任职要求段落'
    : statusErrors.length ? '详情未恢复，需人工查看跟踪/页面' : '待详情采集';
  const screening = companyScreening(detail, job.company);
  const matchedQueries = [...new Set(job.sources.map((source) => source.query))];
  const salaryBuckets = [...new Set(job.sources.map((source) => source.salaryBucket))];
  const matchedPages = [...new Set(job.sources.map((source) => source.page))].sort((a, b) => a - b);
  return {
    company: job.company,
    detailCompany: detail?.company,
    companyLegalName: detail?.companyLegalName,
    title: job.title,
    salary: detail?.salary ?? job.salary,
    salaryFloorK: floor,
    salarySource,
    salaryGate,
    area: job.area,
    detailCity: detail?.city,
    address: detail?.address,
    experience: detail?.experience ?? job.experience,
    degree: detail?.degree ?? job.degree,
    skills: detail?.skills ?? job.skills,
    welfare: detail?.welfare,
    description: detail?.description,
    detailLevel: detailCompleteness(detail),
    detailedRequirementsProvided: detail ? requirementStatus(detail) : null,
    industry: detail?.industry,
    companyScale: detail?.companyScale,
    companyStage: detail?.companyStage,
    companyType: detail?.companyType,
    companyFoundedDate: detail?.companyFoundedDate,
    companyStatus: detail?.companyStatus,
    registeredCapital: detail?.registeredCapital,
    companyIntro: detail?.companyIntro,
    companyRelationship: detail?.companyRelationship,
    companyCertifications: detail?.companyCertifications,
    companyScreeningStatus: screening.status,
    companyScreeningEvidence: screening.evidence,
    detailStatus,
    collectionMethod: record?.collectionMethod ?? 'OpenCLI adapter output',
    traceFile: record?.traceFile,
    detailSourceFile: record?.sourceFile,
    matchedQueries,
    salaryBuckets,
    matchedPages,
    resultCount: job.resultCount,
    securityId: job.securityId,
    url: job.url ?? detail?.url,
  };
}).sort((a, b) => String(a.company).localeCompare(String(b.company), 'zh') || String(a.title).localeCompare(String(b.title), 'zh'));

const jobs = allJobs.filter((job) => {
  const floor = salaryFloorK(job.salary);
  const years = experienceMinimumYears(job.experience);
  return floor !== null && floor >= minSalaryFloorK && floor <= maxSalaryFloorK
    && (years === null || years <= maxExperienceYears);
});
const eligibleJobs = jobs;
const companiesByName = new Map();
for (const job of jobs) {
  const name = job.company || '公司名未提供';
  const company = companiesByName.get(name) ?? {
    company: name,
    postingCount: 0,
    titles: [],
    salaryRanges: [],
    matchedQueries: [],
    officialNames: [],
    industries: [],
    scales: [],
    stages: [],
    screeningStatuses: [],
    screeningEvidence: [],
    postingUrls: [],
    identityStatus: name.includes('某') ? '列表页名称含匿名占位，待核实' : '列表页显示名称，待详情核实',
  };
  company.postingCount += 1;
  for (const [value, key] of [[job.title, 'titles'], [job.salary, 'salaryRanges'], [job.detailCompany, 'officialNames'], [job.industry, 'industries'], [job.companyScale, 'scales'], [job.companyStage, 'stages'], [job.companyScreeningStatus, 'screeningStatuses'], ...(job.companyScreeningEvidence ?? []).map((item) => [item, 'screeningEvidence'])]) {
    if (value && !company[key].includes(value)) company[key].push(value);
  }
  for (const query of job.matchedQueries) if (!company.matchedQueries.includes(query)) company.matchedQueries.push(query);
  if (job.url && !company.postingUrls.includes(job.url)) company.postingUrls.push(job.url);
  companiesByName.set(name, company);
}
const companies = [...companiesByName.values()].sort((a, b) => a.company.localeCompare(b.company, 'zh'));

const totalRaw = slices.reduce((sum, slice) => sum + (slice.responseCount ?? slice.count ?? slice.rows?.length ?? 0), 0);
const retainedRows = slices.reduce((sum, slice) => sum + (slice.count ?? slice.rows?.length ?? 0), 0);
const excludedHits = slices.reduce((total, slice) => {
  for (const [reason, count] of Object.entries(slice.excluded ?? {})) total[reason] = (total[reason] ?? 0) + count;
  return total;
}, {});
const pagesScanned = [...new Set(slices.map((slice) => Number(slice.page ?? 1)))].sort((a, b) => a - b);
const paginationSummary = records.find((record) => record.type === 'pagination-summary') ?? null;
const searchDate = (manifest.collectedAt ?? new Date().toISOString()).slice(0, 10);
const detailCount = eligibleJobs.filter((job) => job.description).length;
const shortCount = eligibleJobs.filter((job) => job.detailLevel === 'short-summary').length;
const requirementCount = eligibleJobs.filter((job) => job.detailedRequirementsProvided).length;
const missingEligible = eligibleJobs.filter((job) => !job.description);
const outOfScopeUnique = allJobs.length - jobs.length;
const screeningCandidates = eligibleJobs.filter((job) => job.companyScreeningStatus === '排除候选，待核实');

const technicalTerms = [
  ['Java', /\bJava\b/i],
  ['Spring Boot', /Spring\s*Boot/i],
  ['Spring Cloud', /Spring\s*Cloud/i],
  ['MySQL', /MySQL/i],
  ['Redis', /Redis/i],
  ['消息队列（Kafka/RabbitMQ/RocketMQ/MQ）', /Kafka|RabbitMQ|RocketMQ|消息队列|\bMQ\b/i],
  ['微服务', /微服务|microservice/i],
  ['Docker/Kubernetes', /Docker|Kubernetes|\bK8s\b/i],
  ['Python', /\bPython\b/i],
  ['AI Agent/智能体', /Agent|智能体/i],
  ['LLM/大模型', /LLM|大模型|大型语言模型/i],
  ['RAG/检索增强', /\bRAG\b|检索增强/i],
  ['向量数据库', /向量库|向量数据库|Milvus|Pinecone|Weaviate|Chroma|FAISS|pgvector/i],
  ['LangChain/LangGraph/Dify/Coze', /LangChain|LangGraph|Dify|Coze/i],
];
const requirementCorpus = eligibleJobs.filter((job) => job.description);
const termCounts = technicalTerms.map(([term, pattern]) => ({ term, count: requirementCorpus.filter((job) => pattern.test(`${job.description ?? ''} ${job.skills ?? ''}`)).length }));

const positionColumns = [
  'company', 'detailCompany', 'companyLegalName', 'title', 'salary', 'salaryFloorK', 'salarySource', 'salaryGate', 'area', 'detailCity', 'address',
  'experience', 'degree', 'skills', 'welfare', 'description', 'detailLevel', 'detailedRequirementsProvided', 'industry', 'companyScale', 'companyStage',
  'companyType', 'companyFoundedDate', 'companyStatus', 'registeredCapital', 'companyIntro', 'companyRelationship', 'companyCertifications',
  'companyScreeningStatus', 'companyScreeningEvidence', 'detailStatus', 'collectionMethod', 'traceFile', 'detailSourceFile', 'matchedQueries', 'salaryBuckets', 'matchedPages',
  'resultCount', 'securityId', 'url',
];
await writeFile(path.join(outDir, 'positions-index.csv'), writeCsv(jobs, [
  'company', 'title', 'salary', 'salaryFloorK', 'salaryGate', 'area', 'experience', 'degree', 'skills', 'matchedQueries', 'salaryBuckets', 'matchedPages', 'resultCount', 'securityId', 'url', 'detailStatus', 'companyScreeningStatus',
]), 'utf8');
await writeFile(path.join(outDir, 'job-details.csv'), writeCsv(eligibleJobs, positionColumns), 'utf8');
await writeFile(path.join(outDir, 'companies-index.csv'), writeCsv(companies, [
  'company', 'postingCount', 'titles', 'salaryRanges', 'matchedQueries', 'officialNames', 'industries', 'scales', 'stages', 'screeningStatuses', 'screeningEvidence', 'identityStatus', 'postingUrls',
]), 'utf8');

const report = `# 深圳 Java 后端与 AI Agent 岗位：数据概览

> 调研日期：${searchDate} 至 2026-11-27  
> 关联工作区：[\`job-search\`](../../../README.md)  
> 招聘来源：Boss 直聘职位页，经本机 OpenCLI 读取；每条职位保留来源 URL。  
> 统计边界：当前快照纳入薪资下限 20–40K、最低经验要求不超过 5 年的职位；下表技能频次仅统计详情已采集的 ${requirementCorpus.length} 个岗位。

## 采集覆盖

- 搜索接口返回：${totalRaw} 条结果行；按薪资/经验筛选后保留 ${retainedRows} 条命中，职位 ID 去重后 ${jobs.length} 个职位、${companies.length} 个列表公司名称。
- 范围规则：职位薪资区间下限为 ${minSalaryFloorK}–${maxSalaryFloorK}K；明确最低经验要求超过 ${maxExperienceYears} 年的岗位不纳入索引；不请求薪资下限超过 ${maxSalaryFloorK}K 的薪资档。
- 搜索结果行过滤次数（包含跨关键词重复）：薪资低于下限 ${excludedHits['salary-below-min'] ?? 0}，薪资下限超过上限 ${excludedHits['salary-above-max'] ?? 0}，薪资无法解析 ${excludedHits['salary-unparsed'] ?? 0}，最低经验超过上限 ${excludedHits['experience-above-max'] ?? 0}。
- 已读取搜索页：${pagesScanned.length ? pagesScanned.join('、') : '无'}；${paginationSummary ? `分页器状态：${paginationSummary.complete ? '按空页/重复页规则结束' : `未穷尽（页数上限 ${paginationSummary.lastPage}，${paginationSummary.cappedSlices} 个筛选组合触顶）`}` : '该快照没有分页穷尽状态记录'}。
- 范围内职位：${eligibleJobs.length} 个；详情描述已采集 ${detailCount} 个，覆盖 ${detailCount}/${eligibleJobs.length}。
- 详情仅有短摘要：${shortCount} 个；详情文本包含明确“任职/岗位/工作要求”段落：${requirementCount} 个。
- 详情未恢复：${missingEligible.length} 个；按职位列表/详情数据核验后有 ${outOfScopeUnique} 个唯一职位不符合当前薪资或经验范围，不纳入职位与详情索引。
- 公司有“客户公司”或人力资源服务资质证据、列为排除复核候选：${screeningCandidates.length} 个。原始行仍保留；该筛选提示是依据页面证据作出的分析判断，不等于已核验用工关系。

## 高频要求关键词

以下数字表示详情文本或技能标签中至少出现一次的岗位数；不同关键词可在同一职位重复出现，不代表熟练程度或要求强度。

| 关键词 | 职位数 |
|---|---:|
${termCounts.map(({ term, count }) => `| ${term} | ${count} |`).join('\n')}

### 初步解读

- Java 后端主线优先看 Java、Spring Boot/Cloud、MySQL、Redis、消息队列、微服务、容器部署等重复项；逐岗原文在 [\`job-details.csv\`](./job-details.csv)。
- Agent/LLM 岗位要求跨度较大，包含 RAG、向量检索、Agent 框架和 Python；需按职责区分后端工程、模型应用、算法、产品/讲师等岗位。
- 这里是关键词覆盖统计，不是岗位质量排序，也还没有与你的简历和真实项目经历做匹配。

## 公司筛选提示

- “客户公司”字段与“人力资源服务许可证”来自职位详情页；二者同时出现的职位标为“排除候选，待核实”。
- 名称里出现外包、猎头、人力资源、劳务派遣等词只列为核验线索；不据此单独断言公司性质。
- 匿名公司名、招聘主体、实际用工关系与企业公开业务信息仍需核实。公司原始字段和职位链接见 [\`companies-index.csv\`](./companies-index.csv)。

## 数据文件

- [\`positions-index.csv\`](./positions-index.csv)：所有搜索列表职位、薪资初筛和详情状态。
- [\`job-details.csv\`](./job-details.csv)：符合列表薪资初筛的职位详情、完整职责/要求文本、公司字段、来源和筛选证据。
- [\`companies-index.csv\`](./companies-index.csv)：按列表公司名汇总职位、详情公司信息和筛选线索。
- [\`raw/\`](../raw/)：只追加的 OpenCLI JSONL 搜索/详情原始记录和本地 trace 恢复记录。

## 未完成

- ${missingEligible.length ? `尚有 ${missingEligible.length} 个列表薪资初筛通过的职位详情未恢复；` : '列表薪资初筛职位均已有详情文本；'}短摘要岗位不含完整任职要求，需要人工查看或后续补充。
- 公司是否为外包、猎头或客户代招需基于招聘主体与用工关系进一步核验。
- 个人匹配分析、公司公开信息研究和最终投递优先级尚未完成。

## 更新记录

- 2026-11-27：修复 OpenCLI 空白页采集链路；完成详情解析回退、脱敏和职位/公司数据索引；新增要求关键词初步统计。
`;
await writeFile(path.join(outDir, 'requirements-summary.md'), report, 'utf8');
const searchReport = `# 深圳 Java 后端与 AI Agent 岗位：搜索索引

> 采集日期：${searchDate} 至 2026-11-27  
> 数据源：Boss 直聘搜索切片，经本机 OpenCLI 读取。  
> 状态：列表索引按职位 ID 幂等去重，并应用薪资/经验过滤；职位要求统计见 [\`requirements-summary.md\`](./requirements-summary.md)。

- 搜索结果行：${totalRaw} 条；范围内 ${retainedRows} 条，去重后 ${jobs.length} 个职位、${companies.length} 个列表公司名。
- 筛选：薪资下限 ${minSalaryFloorK}–${maxSalaryFloorK}K，最低经验要求不超过 ${maxExperienceYears} 年。
- 已读取页码：${pagesScanned.length ? pagesScanned.join('、') : '无'}；${paginationSummary ? `分页状态：${paginationSummary.complete ? '按终止规则结束' : `未穷尽，${paginationSummary.cappedSlices} 个筛选组合触及页数上限`}` : '无分页终止记录'}。
- 列表薪资初筛至少 20K：${eligibleJobs.length} 个职位；已获得详情文本 ${detailCount} 个，另有 ${missingEligible.length} 个待核实。
- 职位列表见 [\`positions-index.csv\`](./positions-index.csv)；详情全文和公司页面字段见 [\`job-details.csv\`](./job-details.csv)；公司汇总见 [\`companies-index.csv\`](./companies-index.csv)。
- 原始 JSONL 与来源记录见 [\`raw/\`](../raw/)。

本文件用于兼容旧索引入口；完整覆盖、统计口径和限制以 [\`requirements-summary.md\`](./requirements-summary.md) 为准。
`;
await writeFile(path.join(outDir, 'search-index.md'), searchReport, 'utf8');

process.stdout.write(`${JSON.stringify({
  inputFile: path.relative(projectRoot, inputFile), rawRows: totalRaw, uniqueJobs: jobs.length, companies: companies.length,
  salaryEligibleJobs: eligibleJobs.length, detailsFound: detailCount, requirementsProvided: requirementCount, shortSummaries: shortCount,
  missingEligible: missingEligible.length, duplicateDetailRows: detailRows - detailsById.size, screeningCandidates: screeningCandidates.length,
  output: ['out/positions-index.csv', 'out/job-details.csv', 'out/companies-index.csv', 'out/requirements-summary.md', 'out/search-index.md'],
})}\n`);
