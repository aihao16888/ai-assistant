// User-defined salary and experience bounds shared by collection and indexing.
export const DEFAULT_SCOPE = Object.freeze({ minSalaryK: 20, maxSalaryK: 40, maxExperienceYears: 5 });

export function salaryRangeK(salary) {
  if (typeof salary !== 'string') return null;
  const value = salary.trim();
  const range = value.match(/(\d+(?:\.\d+)?)\s*[-–—~～至到]\s*(\d+(?:\.\d+)?)\s*K/i);
  if (range) return [Number(range[1]), Number(range[2])];
  const single = value.match(/(\d+(?:\.\d+)?)\s*K(\s*(?:以上|及以上|\+))?/i);
  if (single) return [Number(single[1]), single[2] ? Number.POSITIVE_INFINITY : Number(single[1])];
  return null;
}

export function experienceRangeYears(experience) {
  const value = String(experience ?? '').trim();
  if (!value) return null;
  if (/不限|应届|在校|实习|无经验/.test(value)) return [0, 0];
  const upperBound = value.match(/(\d+(?:\.\d+)?)\s*年\s*(?:以内|以下)/);
  if (upperBound) return [0, Number(upperBound[1])];
  const range = value.match(/(\d+(?:\.\d+)?)\s*[-–—~～至到]\s*(\d+(?:\.\d+)?)\s*年/);
  if (range) return [Number(range[1]), Number(range[2])];
  const minimum = value.match(/(\d+(?:\.\d+)?)\s*年\s*(?:以上|及以上|\+)/);
  if (minimum) return [Number(minimum[1]), Number.POSITIVE_INFINITY];
  const single = value.match(/(\d+(?:\.\d+)?)\s*年/);
  return single ? [Number(single[1]), Number(single[1])] : null;
}

export function scopeExclusionReasons(job, scope = DEFAULT_SCOPE) {
  const reasons = [];
  const salary = salaryRangeK(job?.salary);
  if (!salary) reasons.push('salary-unparsed');
  else {
    if (salary[0] < scope.minSalaryK) reasons.push('salary-below-min');
    if (salary[1] > scope.maxSalaryK) reasons.push('salary-above-max');
  }
  const experience = experienceRangeYears(job?.experience);
  if (experience && experience[1] > scope.maxExperienceYears) reasons.push('experience-above-max');
  return reasons;
}

export function scopeExclusionReason(job, scope = DEFAULT_SCOPE) {
  return scopeExclusionReasons(job, scope)[0] ?? null;
}
