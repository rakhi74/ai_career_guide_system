import 'dotenv/config';
import mongoose from 'mongoose';
import { Job } from './models.js';

const roles = [
  ['Frontend Developer Intern','Northstar Labs','Remote',['React','JavaScript','HTML','CSS'],0,'Bachelor’s degree or currently pursuing'],
  ['Frontend Developer Trainee','PixelSpring','Delhi, India',['React','JavaScript','CSS','Git'],0,'Bachelor’s degree or equivalent'],
  ['Junior React Developer','BlueKite Digital','Bengaluru, India',['React','JavaScript','REST APIs','Git'],1,'Bachelor’s degree'],
  ['Backend Developer Intern','CedarStack','Remote',['Node.js','Express','MongoDB','REST APIs'],0,'Bachelor’s degree or currently pursuing'],
  ['Junior Backend Developer','CloudHarbor','Pune, India',['Node.js','SQL','Git','API design'],1,'Bachelor’s degree'],
  ['Full Stack Developer Trainee','OrbitWorks','Hyderabad, India',['React','Node.js','MongoDB','JavaScript'],0,'Bachelor’s degree'],
  ['Data Analyst Intern','InsightFoundry','Remote',['SQL','Excel','Python','Data visualization'],0,'Bachelor’s degree or currently pursuing'],
  ['Junior Data Analyst','MetricMint','Delhi, India',['SQL','Excel','Power BI','Statistics'],1,'Bachelor’s degree'],
  ['Business Intelligence Trainee','VistaMetrics','Mumbai, India',['SQL','Power BI','Excel','Data visualization'],0,'Bachelor’s degree'],
  ['Software Engineer Trainee','CodeCove','Noida, India',['Java','Data structures','Git','SQL'],0,'Bachelor’s degree'],
  ['QA Engineer Intern','TestNest','Remote',['Manual testing','Test cases','API testing','SQL'],0,'Bachelor’s degree or currently pursuing'],
  ['Product Support Associate','HelpOrbit','Gurugram, India',['Communication','Troubleshooting','SQL','Documentation'],0,'Any relevant degree'],
  ['UX Research Assistant','HumanLayer','Delhi, India',['User research','Interviews','Figma','Analysis'],0,'Bachelor’s degree'],
  ['Digital Marketing Associate','BrightLoop','Remote',['SEO','Content writing','Analytics','Social media'],0,'Any relevant degree'],
  ['Technical Content Writer','DocsCraft','Remote',['Technical writing','Research','Editing','Markdown'],0,'Bachelor’s degree or equivalent'],
  ['Cybersecurity Analyst Trainee','ShieldPath','Chennai, India',['Networking','Linux','Security fundamentals','Python'],0,'Bachelor’s degree'],
  ['Cloud Support Trainee','NimbusBase','Bengaluru, India',['Linux','Networking','Cloud fundamentals','Troubleshooting'],0,'Bachelor’s degree'],
  ['Python Developer Intern','PyTrail','Remote',['Python','Git','SQL','REST APIs'],0,'Bachelor’s degree or currently pursuing'],
  ['Operations Analyst','FlowPilot','Jaipur, India',['Excel','Problem solving','Data analysis','Communication'],1,'Bachelor’s degree'],
  ['Research Assistant — Policy Tech','CivicSignal','Delhi, India',['Research','Data analysis','Writing','Excel'],0,'Bachelor’s degree or currently pursuing'],
  ['HR Operations Associate','PeopleSpring','Mumbai, India',['Communication','Excel','Documentation','Coordination'],0,'Any relevant degree'],
  ['Junior Java Developer','StackBridge','Pune, India',['Java','OOP','SQL','Data structures'],1,'Bachelor’s degree'],
  ['Mobile App Developer Intern','PocketForge','Remote',['Flutter','Dart','Git','REST APIs'],0,'Bachelor’s degree or currently pursuing'],
  ['Product Analyst Intern','LaunchLens','Bengaluru, India',['SQL','Excel','Product analytics','Communication'],0,'Bachelor’s degree or currently pursuing'],
  ['IT Helpdesk Trainee','DeskPilot','Kolkata, India',['Troubleshooting','Networking','Windows','Communication'],0,'Any relevant degree']
];

await mongoose.connect(process.env.MONGODB_URI);
const operations = roles.map(([title, company, location, requiredSkills, experienceMin, education], i) => ({
  updateOne: {
    filter: { title, company, isDemo: true },
    update: { $setOnInsert: {
      title, company, location, requiredSkills, experienceMin, education,
      workMode: location === 'Remote' ? 'Remote' : (i % 4 === 0 ? 'Hybrid' : 'On-site'),
      description: `${title} sample listing. This demonstration role is designed to help test profile matching and job discovery. Verify employer, compensation, eligibility and availability independently before applying.`,
      salaryRange: 'Demo estimate — not verified',
      jobType: title.includes('Intern') ? 'Internship' : 'Full-time',
      sourceLabel: 'DEMO SAMPLE — NOT A VERIFIED VACANCY',
      isDemo: true,
      active: true
    } },
    upsert: true
  }
}));
const result = await Job.bulkWrite(operations, { ordered: false });
console.log(`Seed complete: added ${result.upsertedCount || 0} new demo listings; existing demo listings were left unchanged.`);
console.log('All seeded listings are marked DEMO SAMPLE — NOT A VERIFIED VACANCY.');
await mongoose.disconnect();
