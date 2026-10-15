import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User, Job, Application } from './models.js';
import { requireAuth, requireAdmin, signToken } from './auth.js';
import { scoreJob } from './matching.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 250, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 }));

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const cleanUser = user => ({ id: user._id, name: user.name, email: user.email, role: user.role, profile: user.profile, savedJobs: user.savedJobs });

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'AI Career Guide API' }));

const authSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(128)
});

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
  const { name, email, password } = parsed.data;
  if (!name) return res.status(400).json({ message: 'Name is required.' });
  if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ message: 'An account with this email already exists.' });
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
  res.status(201).json({ token: signToken(user), user: cleanUser(user) });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1).max(128) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter a valid email and password.' });
  const user = await User.findOne({ email: parsed.data.email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ message: 'Incorrect email or password.' });
  res.json({ token: signToken(user), user: cleanUser(user) });
}));

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: cleanUser(req.user) }));
app.post('/api/auth/logout', requireAuth, (_req, res) => res.json({ message: 'Logged out. Clear the token in the client.' }));

app.patch('/api/users/profile', requireAuth, asyncRoute(async (req, res) => {
  const schema = z.object({
    education: z.string().max(160).optional(),
    skills: z.array(z.string().trim().min(1).max(60)).max(60).optional(),
    experienceYears: z.number().min(0).max(60).optional(),
    interests: z.array(z.string().trim().max(80)).max(30).optional(),
    preferredRoles: z.array(z.string().trim().max(100)).max(20).optional(),
    location: z.string().max(120).optional(),
    summary: z.string().max(1000).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
  req.user.profile = { ...req.user.profile.toObject(), ...parsed.data };
  await req.user.save();
  res.json({ user: cleanUser(req.user) });
}));

app.get('/api/jobs', asyncRoute(async (req, res) => {
  const filter = { active: true };
  if (req.query.q) filter.$or = [
    { title: { $regex: String(req.query.q).slice(0, 80), $options: 'i' } },
    { company: { $regex: String(req.query.q).slice(0, 80), $options: 'i' } },
    { requiredSkills: { $regex: String(req.query.q).slice(0, 80), $options: 'i' } }
  ];
  if (req.query.location) filter.location = { $regex: String(req.query.location).slice(0, 80), $options: 'i' };
  if (req.query.workMode && ['Remote', 'Hybrid', 'On-site'].includes(req.query.workMode)) filter.workMode = req.query.workMode;
  const jobs = await Job.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ jobs });
}));

app.get('/api/jobs/recommended', requireAuth, asyncRoute(async (req, res) => {
  const jobs = await Job.find({ active: true }).lean();
  res.json({ jobs: jobs.map(job => ({ ...job, match: scoreJob(req.user.profile, job) })).sort((a, b) => b.match.score - a.match.score) });
}));

app.get('/api/jobs/saved', requireAuth, asyncRoute(async (req, res) => {
  const user = await User.findById(req.user._id).populate({ path: 'savedJobs', match: { active: true } });
  res.json({ jobs: user.savedJobs });
}));

app.post('/api/jobs/:id/save', requireAuth, asyncRoute(async (req, res) => {
  const job = await Job.findOne({ _id: req.params.id, active: true });
  if (!job) return res.status(404).json({ message: 'Job not found.' });
  const has = req.user.savedJobs.some(id => id.toString() === job._id.toString());
  req.user.savedJobs = has ? req.user.savedJobs.filter(id => id.toString() !== job._id.toString()) : [...req.user.savedJobs, job._id];
  await req.user.save();
  res.json({ saved: !has });
}));

const jobSchema = z.object({
  title: z.string().trim().min(2).max(120), company: z.string().trim().min(2).max(120),
  location: z.string().trim().min(2).max(120), workMode: z.enum(['Remote', 'Hybrid', 'On-site']).optional(),
  description: z.string().trim().min(10).max(5000), requiredSkills: z.array(z.string().max(60)).max(40).optional(),
  education: z.string().max(160).optional(), experienceMin: z.number().min(0).max(60).optional(),
  salaryRange: z.string().max(120).optional(), jobType: z.string().max(60).optional()
});
app.post('/api/jobs', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const parsed = jobSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
  const job = await Job.create({ ...parsed.data, isDemo: false, sourceLabel: 'ADMIN-ADDED LISTING — VERIFY BEFORE APPLYING', createdBy: req.user._id });
  res.status(201).json({ job });
}));
app.patch('/api/jobs/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const parsed = jobSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
  const job = await Job.findByIdAndUpdate(req.params.id, parsed.data, { new: true, runValidators: true });
  if (!job) return res.status(404).json({ message: 'Job not found.' });
  res.json({ job });
}));
app.delete('/api/jobs/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const job = await Job.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
  if (!job) return res.status(404).json({ message: 'Job not found.' });
  res.json({ message: 'Listing archived.' });
}));

app.post('/api/applications', requireAuth, asyncRoute(async (req, res) => {
  const parsed = z.object({ jobId: z.string().min(1), status: z.enum(['Interested','Applied','Interviewing','Offer','Rejected','Withdrawn']).optional(), notes: z.string().max(2000).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid application details.' });
  if (!await Job.exists({ _id: parsed.data.jobId, active: true })) return res.status(404).json({ message: 'Job not found.' });
  const application = await Application.findOneAndUpdate(
    { user: req.user._id, job: parsed.data.jobId },
    { $set: { status: parsed.data.status || 'Interested', notes: parsed.data.notes || '' }, $setOnInsert: { user: req.user._id, job: parsed.data.jobId } },
    { upsert: true, new: true, runValidators: true }
  ).populate('job');
  res.status(201).json({ application });
}));
app.get('/api/applications', requireAuth, asyncRoute(async (req, res) => {
  const applications = await Application.find({ user: req.user._id }).populate('job').sort({ updatedAt: -1 });
  res.json({ applications });
}));
app.patch('/api/applications/:id', requireAuth, asyncRoute(async (req, res) => {
  const parsed = z.object({ status: z.enum(['Interested','Applied','Interviewing','Offer','Rejected','Withdrawn']), notes: z.string().max(2000).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid status.' });
  const application = await Application.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { $set: parsed.data }, { new: true, runValidators: true }).populate('job');
  if (!application) return res.status(404).json({ message: 'Application not found.' });
  res.json({ application });
}));

const roleSkills = {
  'frontend developer': ['HTML','CSS','JavaScript','React','Git','Accessibility'],
  'backend developer': ['Node.js','Express','MongoDB','SQL','REST APIs','Authentication'],
  'data analyst': ['SQL','Excel','Python','Statistics','Power BI','Data visualization'],
  'software engineer trainee': ['Data structures','Algorithms','Git','SQL','OOP','Testing'],
  'ux researcher': ['User research','Interviews','Usability testing','Analysis','Figma']
};
app.get('/api/skills/gap', requireAuth, (req, res) => {
  const role = String(req.query.role || '').toLowerCase();
  const key = Object.keys(roleSkills).find(k => role.includes(k) || k.includes(role));
  if (!key) return res.status(404).json({ message: 'No curated skill path found for that role yet.' });
  const skills = roleSkills[key];
  const own = (req.user.profile.skills || []).map(s => s.toLowerCase());
  const missing = skills.filter(s => !own.some(o => o.includes(s.toLowerCase()) || s.toLowerCase().includes(o)));
  const resources = [
    { name: 'MDN Web Docs', url: 'https://developer.mozilla.org/', for: ['HTML','CSS','JavaScript','Accessibility'] },
    { name: 'freeCodeCamp', url: 'https://www.freecodecamp.org/learn/', for: ['React','Node.js','SQL','Testing','REST APIs'] },
    { name: 'Kaggle Learn', url: 'https://www.kaggle.com/learn', for: ['Python','Statistics','Data visualization'] },
    { name: 'Microsoft Learn', url: 'https://learn.microsoft.com/training/', for: ['Power BI','Authentication','Azure'] }
  ];
  res.json({ role: key, requiredSkills: skills, missingSkills: missing, resources, projectIdea: `Build a small portfolio project that demonstrates ${missing.slice(0, 3).join(', ') || 'the role’s core skills'}, document your decisions, and publish a README with screenshots.` });
});

app.post('/api/resume/analyze', requireAuth, asyncRoute(async (req, res) => {
  const parsed = z.object({ resumeText: z.string().min(40).max(20000), targetRole: z.string().max(120).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Paste resume text (at least 40 characters, up to 20,000).' });
  const text = parsed.data.resumeText;
  const profileSkills = [...(req.user.profile.skills || [])];
  const vocabulary = ['JavaScript','React','Node.js','Python','SQL','Excel','Power BI','MongoDB','Git','Communication','Research','Writing','Leadership','Project management','HTML','CSS','Java','Figma'];
  const detectedSkills = vocabulary.filter(s => text.toLowerCase().includes(s.toLowerCase()));
  const missingProfileSkills = profileSkills.filter(s => !text.toLowerCase().includes(s.toLowerCase()));
  const suggestions = [];
  if (!/summary|profile|objective/i.test(text)) suggestions.push('Add a concise professional summary tailored to your target role.');
  if (!/\b\d+%|\b\d+\s?(users|clients|projects|reports|sales|hours)\b/i.test(text)) suggestions.push('Quantify impact with credible numbers (e.g., volume, time saved, growth or project scope).');
  if (!/experience|internship|employment/i.test(text)) suggestions.push('Add an experience section with action verbs and outcomes.');
  if (!/education|degree|university|college/i.test(text)) suggestions.push('Make education and expected graduation date easy to find.');
  if (!/project/i.test(text)) suggestions.push('Include 2–3 relevant projects with your contribution, tools and outcome.');
  if (!/linkedin|github|portfolio/i.test(text)) suggestions.push('Add a relevant LinkedIn, GitHub or portfolio link where appropriate.');
  res.json({ targetRole: parsed.data.targetRole || '', detectedSkills, missingProfileSkills, suggestions, wordCount: text.trim().split(/\s+/).length, disclaimer: 'Automated feedback is heuristic; verify all advice and never invent qualifications or results.' });
}));

app.post('/api/ai/chat', requireAuth, asyncRoute(async (req, res) => {
  const parsed = z.object({ message: z.string().trim().min(2).max(2000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter a question under 2,000 characters.' });
  const fallback = `Here is a practical way to approach your question: ${parsed.data.message}\n\nStart by identifying the target role, compare its requirements with evidence from your skills and projects, and choose one concrete next step. I can give more specific advice if you share the role or job description.`;
  if (!process.env.GROQ_API_KEY) return res.json({ answer: fallback, mode: 'rule-based fallback' });
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', temperature: 0.4, max_tokens: 700,
        messages: [
          { role: 'system', content: 'You are AI Career Guide, a practical, inclusive career coach. Give actionable advice on careers, skills, resumes and interviews. Do not fabricate job vacancies or guarantee outcomes. Be clear when advice is general.' },
          { role: 'user', content: `User profile: ${JSON.stringify({ education: req.user.profile.education, skills: req.user.profile.skills, experienceYears: req.user.profile.experienceYears, interests: req.user.profile.interests })}\nQuestion: ${parsed.data.message}` }
        ] })
    });
    if (!response.ok) throw new Error('Groq request failed');
    const data = await response.json();
    res.json({ answer: data.choices?.[0]?.message?.content || fallback, mode: 'Groq AI' });
  } catch {
    res.json({ answer: fallback, mode: 'rule-based fallback', notice: 'AI is temporarily unavailable; showing general guidance.' });
  }
}));

app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` }));
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.code === 11000) return res.status(409).json({ message: 'This record already exists.' });
  if (err?.name === 'CastError') return res.status(400).json({ message: 'Invalid record identifier.' });
  res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Something went wrong.' : (err.message || 'Internal server error.') });
});

const port = process.env.PORT || 5000;
if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
  console.error('MONGODB_URI and JWT_SECRET are required. Copy .env.example to .env and configure them.');
  process.exit(1);
}
await mongoose.connect(process.env.MONGODB_URI);
app.listen(port, () => console.log(`AI Career Guide API listening on port ${port}`));
