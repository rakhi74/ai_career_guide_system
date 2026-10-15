# AI Career Guide

A full-stack career recommendation platform supporting SDG 8: Decent Work and Economic Growth.

## Stack
- Frontend: React + Vite + Tailwind CSS + Chart.js
- Backend: Node.js + Express + Mongoose
- Auth: JWT + bcryptjs
- AI: Groq API (optional; core matching works without it)

## Features in this starter
- Register/login with JWT and bcrypt password hashing
- User profile with skills, education, experience, preferred roles and location
- Transparent weighted job matching: skills 50%, education 20%, location 15%, experience 15%
- Search/filter, save jobs, track application status
- Admin-only job CRUD APIs (set a user's role to `admin` manually in MongoDB)
- Resume builder and PDF export via browser print-to-PDF
- Resume text analysis and skill-gap recommendations
- Optional Groq-powered career assistant; deterministic fallback if no API key
- Sample listings clearly marked as demo data, never verified vacancies
- Rate limiting, helmet, CORS, validation, centralized error handling

## Requirements
- Node.js 20+
- MongoDB Atlas connection string (or local MongoDB)
- Optional Groq API key

## Quick start

### 1. Backend
```bash
cd server
cp .env.example .env
# Set MONGODB_URI and JWT_SECRET in .env
npm install
npm run seed
npm run dev
```
API runs at `http://localhost:5000`.

### 2. Frontend
In a second terminal:
```bash
cd client
cp .env.example .env
npm install
npm run dev
```
Open the Vite URL printed in the terminal (normally `http://localhost:5173`).

## Environment
See `server/.env.example` and `client/.env.example`. Never put Groq or JWT secrets in the frontend.

## Demo data and admin
Seeded jobs are demo/sample data and are not verified vacancies. To enable admin CRUD, register a user and update that user's `role` field to `admin` in MongoDB Atlas (`users` collection). Never expose an admin registration toggle publicly.

## API overview
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PATCH /api/users/profile`
- `GET /api/jobs` (search/filter)
- `GET /api/jobs/recommended`
- `GET /api/jobs/saved`
- `POST /api/jobs/:id/save`
- `POST /api/applications`
- `GET /api/applications`
- `PATCH /api/applications/:id`
- `POST /api/resume/analyze`
- `POST /api/ai/chat`
- `GET /api/skills/gap?role=...`
- Admin: `POST /api/jobs`, `PATCH /api/jobs/:id`, `DELETE /api/jobs/:id`

## Matching logic
Each criterion returns a 0–100 subscore, weighted as:
- Skills: 50%
- Education: 20%
- Location: 15%
- Experience: 15%

The total is the weighted sum. Skill matching is based on overlap between the user's listed skills and job-required skills. Education is a transparent keyword/level heuristic; location treats Remote as compatible; experience uses years compared with the stated requirement. The score is a guidance signal, not a hiring probability.

## Deploy
- Deploy `server` to Render/Railway/Fly.io; set all server environment variables.
- Deploy `client` to Vercel/Netlify; set `VITE_API_URL` to the deployed API origin, e.g. `https://your-api.example.com/api`.
- Set backend `CLIENT_ORIGIN` to the deployed frontend URL.
- Provision MongoDB Atlas network access and a least-privilege database user.
- Use a strong unique `JWT_SECRET`; enable HTTPS; never commit `.env`.
- Configure a real job API only after reviewing its terms, licensing, attribution and freshness requirements.

## Important scope notes
This is a runnable starter, not a third-party job-board integration or production security audit. Resume analysis accepts pasted text in this version; PDF/DOCX parsing and uploaded-file storage are intentionally not included. PDF export uses the browser print dialog. AI features are optional and fall back to deterministic guidance.
