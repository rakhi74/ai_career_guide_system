const norm = value => String(value || '').trim().toLowerCase();
const words = values => (values || []).map(norm).filter(Boolean);

export function scoreJob(profile = {}, job = {}) {
  const userSkills = words(profile.skills);
  const needed = words(job.requiredSkills);
  const matchedSkills = needed.filter(skill => userSkills.some(own => own === skill || own.includes(skill) || skill.includes(own)));
  const missingSkills = needed.filter(skill => !matchedSkills.includes(skill));
  const skills = needed.length ? Math.round(matchedSkills.length / needed.length * 100) : 70;

  const edu = norm(profile.education);
  const requirement = norm(job.education);
  let education = 70;
  if (!requirement || requirement.includes('any')) education = 100;
  else if (edu && (edu.includes(requirement) || requirement.includes(edu))) education = 100;
  else if (edu && (edu.includes('bachelor') || edu.includes('degree') || edu.includes('graduate')) &&
           (requirement.includes('bachelor') || requirement.includes('degree') || requirement.includes('graduate'))) education = 80;
  else if (!edu) education = 35;
  else education = 45;

  const userLoc = norm(profile.location);
  const jobLoc = norm(job.location);
  const remote = norm(job.workMode) === 'remote' || jobLoc.includes('remote');
  const location = remote ? 100 : !userLoc ? 40 : (jobLoc.includes(userLoc) || userLoc.includes(jobLoc) ? 100 : 25);

  const years = Number(profile.experienceYears || 0);
  const min = Number(job.experienceMin || 0);
  const experience = min === 0 ? 100 : Math.min(100, Math.round(years / min * 100));

  const score = Math.round(skills * .5 + education * .2 + location * .15 + experience * .15);
  const reasons = [];
  if (matchedSkills.length) reasons.push(`Your skills match ${matchedSkills.length} of ${needed.length} listed requirements.`);
  if (remote) reasons.push('Remote work is compatible with your location preference.');
  else if (location === 100) reasons.push('The role location aligns with your profile.');
  if (experience === 100) reasons.push('Your experience meets the stated minimum.');
  if (education >= 80) reasons.push('Your education appears aligned with the listing.');
  if (!reasons.length) reasons.push('This is a starting-point match; review the requirements carefully.');

  return {
    score, breakdown: { skills, education, location, experience },
    matchedSkills, missingSkills, reasons,
    disclaimer: 'Match score is a transparent guidance estimate, not a hiring probability or guarantee.'
  };
}
