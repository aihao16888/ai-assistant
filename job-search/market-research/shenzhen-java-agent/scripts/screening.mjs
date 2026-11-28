// Shared pre-request and output filters for employers the user asked to omit.
export function employerExclusionReason(row = {}) {
  const companyText = [
    row.company,
    row.companyName,
    row.detailCompany,
    row.companyLegalName,
    row.companyType,
  ].filter(Boolean).join(' ');
  const title = String(row.title ?? '');
  if (/德科/i.test(companyText)) return 'known-recruiter-deke';
  if (/(猎头|外包|劳务派遣|人才服务|人才中介|人力资源服务|招聘服务)/i.test(companyText)) {
    return 'recruiter-or-outsourcing-company-name';
  }
  if (/(猎头|外包驻场|劳务派遣)/i.test(title)) return 'recruiter-or-outsourcing-job-title';
  return null;
}
