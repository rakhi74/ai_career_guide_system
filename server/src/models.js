import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  profile: {
    education: { type: String, default: '' },
    skills: { type: [String], default: [] },
    experienceYears: { type: Number, min: 0, max: 60, default: 0 },
    interests: { type: [String], default: [] },
    preferredRoles: { type: [String], default: [] },
    location: { type: String, default: '' },
    summary: { type: String, default: '' }
  },
  savedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job' }]
}, { timestamps: true });

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  company: { type: String, required: true, trim: true, maxlength: 120 },
  location: { type: String, required: true, trim: true, maxlength: 120 },
  workMode: { type: String, enum: ['Remote', 'Hybrid', 'On-site'], default: 'On-site' },
  description: { type: String, required: true, maxlength: 5000 },
  requiredSkills: { type: [String], default: [] },
  education: { type: String, default: 'Any relevant degree' },
  experienceMin: { type: Number, min: 0, default: 0 },
  salaryRange: { type: String, default: 'Not specified' },
  jobType: { type: String, default: 'Full-time' },
  sourceLabel: { type: String, default: 'DEMO SAMPLE — NOT A VERIFIED VACANCY' },
  isDemo: { type: Boolean, default: true },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const applicationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  status: { type: String, enum: ['Interested', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Withdrawn'], default: 'Interested' },
  notes: { type: String, maxlength: 2000, default: '' },
  appliedAt: { type: Date, default: Date.now }
}, { timestamps: true });
applicationSchema.index({ user: 1, job: 1 }, { unique: true });

export const User = mongoose.model('User', userSchema);
export const Job = mongoose.model('Job', jobSchema);
export const Application = mongoose.model('Application', applicationSchema);
