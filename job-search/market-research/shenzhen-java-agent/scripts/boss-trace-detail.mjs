import { readFile, readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const ignoredTextTags = new Set(['script', 'style', 'noscript']);

function decodeEntities(value) {
  return value.replace(/&(#(?:x[\da-f]+|\d+)|amp|apos|gt|lt|nbsp|quot|middot|bull|ndash|mdash|lsquo|rsquo|ldquo|rdquo);/gi, (match, entity) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith('#x')) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    if (lower.startsWith('#')) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    return ({ amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"', middot: '·', bull: '•', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' })[lower] ?? match;
  });
}

function parseAttributes(source) {
  const attributes = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = pattern.exec(source))) attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  return attributes;
}

function readTag(source, start) {
  let quote = '';
  for (let end = start + 1; end < source.length; end += 1) {
    const char = source[end];
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '>') return source.slice(start, end + 1);
  }
  return source.slice(start);
}

function parseHtml(source) {
  const root = { tag: 'root', attributes: {}, children: [], parent: null };
  const stack = [root];
  let cursor = 0;
  while (cursor < source.length) {
    const open = source.indexOf('<', cursor);
    const textEnd = open < 0 ? source.length : open;
    if (textEnd > cursor) stack.at(-1).children.push(decodeEntities(source.slice(cursor, textEnd)));
    if (open < 0) break;
    if (source.startsWith('<!--', open)) {
      const end = source.indexOf('-->', open + 4);
      cursor = end < 0 ? source.length : end + 3;
      continue;
    }
    const token = readTag(source, open);
    const close = token.match(/^<\s*\/\s*([\w:-]+)/);
    if (close) {
      const tag = close[1].toLowerCase();
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      cursor = open + token.length;
      continue;
    }
    const start = token.match(/^<\s*([\w:-]+)([\s\S]*?)\/?\s*>$/);
    if (!start) {
      cursor = open + 1;
      continue;
    }
    const tag = start[1].toLowerCase();
    const node = { tag, attributes: parseAttributes(start[2]), children: [], parent: stack.at(-1) };
    stack.at(-1).children.push(node);
    cursor = open + token.length;
    if (ignoredTextTags.has(tag)) {
      const endTagStart = source.toLowerCase().indexOf(`</${tag}`, cursor);
      if (endTagStart < 0) break;
      const endToken = readTag(source, endTagStart);
      cursor = endTagStart + endToken.length;
    } else if (!voidTags.has(tag) && !/\/\s*>$/.test(token)) {
      stack.push(node);
    }
  }
  return root;
}

function classList(node) {
  return new Set((node.attributes.class ?? '').split(/\s+/).filter(Boolean));
}

function hasClass(node, ...names) {
  const classes = classList(node);
  return names.every((name) => classes.has(name));
}

function descendants(node, predicate) {
  const matches = [];
  const visit = (current) => {
    for (const child of current.children) {
      if (typeof child === 'string') continue;
      if (predicate(child)) matches.push(child);
      visit(child);
    }
  };
  visit(node);
  return matches;
}

function textContent(node) {
  return node.children.map((child) => typeof child === 'string' ? child : textContent(child)).join(' ').replace(/\s+/g, ' ').trim();
}

function first(node, predicate) {
  return descendants(node, predicate)[0] ?? null;
}

function value(node) {
  return node ? textContent(node) || null : null;
}

function valueWithIcon(parent, iconClass) {
  const icon = first(parent, (node) => hasClass(node, iconClass));
  return icon?.parent ? textContent(icon.parent) || null : null;
}

function labelValue(node) {
  const label = first(node, (child) => child.tag === 'span');
  const labelText = label ? textContent(label) : '';
  const full = textContent(node);
  return full.startsWith(labelText) ? full.slice(labelText.length).trim() || null : full || null;
}

export function parseBossDetailHtml(html, url = '') {
  const root = parseHtml(html);
  const primary = first(root, (node) => hasClass(node, 'job-primary'));
  const page = first(root, (node) => hasClass(node, 'job-detail'));
  const companyCard = first(root, (node) => hasClass(node, 'sider-company'));
  if (!primary || !page) return null;

  const heading = first(primary, (node) => node.tag === 'h1');
  const salary = first(primary, (node) => hasClass(node, 'salary'));
  const city = first(primary, (node) => hasClass(node, 'text-city'));
  const experience = first(primary, (node) => hasClass(node, 'text-experiece'));
  const degree = first(primary, (node) => hasClass(node, 'text-degree'));
  const descriptionSection = first(page, (node) => hasClass(node, 'job-detail-section'));
  const descriptionNode = descriptionSection && first(descriptionSection, (node) => hasClass(node, 'job-sec-text'));
  const tagContainer = first(primary, (node) => hasClass(node, 'tag-container-new'));
  const tagsNode = tagContainer && first(tagContainer, (node) => hasClass(node, 'job-tags'));
  const welfare = tagsNode
    ? descendants(tagsNode, (node) => node.tag === 'span').map(textContent).filter(Boolean)
    : [];
  const companyInfo = companyCard && first(companyCard, (node) => hasClass(node, 'company-info'));
  const companyNameLink = companyInfo && descendants(companyInfo, (node) => node.tag === 'a').find((node) => textContent(node));
  const clientCompanyNode = first(primary, (node) => hasClass(node, 'brand-name'));
  const clientCompanyLabel = value(clientCompanyNode);
  const clientCompany = clientCompanyLabel?.match(/^客户公司\s*[:：]\s*(.+)$/)?.[1]?.trim() ?? null;
  const company = value(companyNameLink) ?? clientCompany;
  const companyBusiness = first(root, (node) => hasClass(node, 'business-info-box'));
  const businessItems = companyBusiness ? descendants(companyBusiness, (node) => node.tag === 'li') : [];
  const businessValue = (className) => {
    const item = businessItems.find((node) => hasClass(node, className));
    return item ? labelValue(item) : null;
  };
  const companyIntroSection = first(root, (node) => hasClass(node, 'company-info-box'));
  const companyIntro = companyIntroSection && first(companyIntroSection, (node) => hasClass(node, 'job-sec-text'));
  const address = first(root, (node) => hasClass(node, 'location-address'));
  const keywordList = first(descriptionSection, (node) => hasClass(node, 'job-keyword-list'));
  const skills = keywordList ? descendants(keywordList, (node) => node.tag === 'li').map(textContent).filter(Boolean) : [];
  const certificationList = first(descriptionSection, (node) => hasClass(node, 'certification-tags'));
  const companyCertifications = certificationList ? descendants(certificationList, (node) => node.tag === 'li').map(textContent).filter(Boolean) : [];

  const detail = {
    title: heading?.attributes.title || value(heading),
    salary: value(salary),
    city: value(city),
    address: value(address),
    experience: value(experience),
    degree: value(degree),
    description: value(descriptionNode),
    skills: skills.length ? [...new Set(skills)] : null,
    welfare: welfare.length ? [...new Set(welfare)] : null,
    company,
    industry: companyCard ? valueWithIcon(companyCard, 'icon-industry') : null,
    companyScale: companyCard ? valueWithIcon(companyCard, 'icon-scale') : null,
    companyStage: companyCard ? valueWithIcon(companyCard, 'icon-stage') : null,
    companyLegalName: businessValue('company-name'),
    companyType: businessValue('company-type'),
    companyFoundedDate: businessValue('res-time'),
    companyStatus: businessValue('manage-state'),
    registeredCapital: businessValue('company-fund'),
    companyIntro: value(companyIntro),
    companyRelationship: clientCompany ? '详情页标注“客户公司”' : null,
    companyCertifications: companyCertifications.length ? [...new Set(companyCertifications)] : null,
    url: url || null,
  };
  if (!detail.title || !detail.description) return null;
  detail.detailLevel = detail.description.length < 80 ? 'short-summary' : 'full-text';
  detail.detailedRequirementsProvided = /任职要求|岗位要求|工作要求/.test(detail.description);
  return detail;
}

export async function findBossDetailTrace(securityId, { traceRoot } = {}) {
  const root = traceRoot ?? path.join(os.homedir(), '.opencli', 'profiles', process.env.OPENCLI_PROFILE || 'default', 'traces');
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return null;
  }
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const networkPath = path.join(root, entry.name, 'network.jsonl');
    try {
      const metadata = await stat(networkPath);
      candidates.push({ networkPath, mtimeMs: metadata.mtimeMs });
    } catch { /* Ignore trace folders without a network capture. */ }
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const expectedPathPart = `/job_detail/${securityId}.html`;
  for (const candidate of candidates) {
    const content = await readFile(candidate.networkPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      if (!line.includes(expectedPathPart)) continue;
      let record;
      try { record = JSON.parse(line); } catch { continue; }
      if (record.status !== 200 || !String(record.contentType ?? '').includes('text/html') || typeof record.responseBody !== 'string') continue;
      const detail = parseBossDetailHtml(record.responseBody, record.url);
      if (detail) {
        return {
          detail,
          traceFile: candidate.networkPath,
          responseStatus: record.status,
          responseCapturedAt: record.ts ?? null,
        };
      }
    }
  }
  return null;
}
