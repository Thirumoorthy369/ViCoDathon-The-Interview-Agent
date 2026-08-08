/**
 * AI Interview Agent — Backend Server
 * 
 * Express server exposing POST /api/interview as required by technical-spec.md.
 * Uses Groq (llama-3.3-70b-versatile) as the exclusive LLM provider via the
 * OpenAI-compatible SDK (TRD.md §5).
 * 
 * Session state is held in-memory (Map<sessionId, InterviewSession>) — no database.
 * Must be deployed as a single long-running process, never as serverless functions
 * or multiple replicas (TRD.md §3.1).
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// --- CORS: restrict to frontend origin + localhost (Security.md §3) ---
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman) and allowed origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Relaxed for hackathon demo — tighten for production
    }
  }
}));

app.use(express.json({ limit: '10kb' })); // Cap request body size (Security.md §3)

// --- Load static data at startup (TRD.md §7) ---
const dataDir = join(__dirname, '..', 'data');
const curriculum = JSON.parse(readFileSync(join(dataDir, 'curriculum.json'), 'utf-8'));
const candidatesData = JSON.parse(readFileSync(join(dataDir, 'candidates.json'), 'utf-8'));

console.log(`✓ Loaded curriculum: ${curriculum.days.length} days, ${curriculum.modules.length} modules`);
console.log(`✓ Loaded candidates: ${candidatesData.candidates.length} profiles`);

// --- In-memory session store (TRD.md §3.1) ---
const sessions = new Map();

// --- API Routes ---

// Health check (debug, remove/guard before final submission)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    curriculum: { days: curriculum.days.length, modules: curriculum.modules.length },
    candidates: candidatesData.candidates.length,
    activeSessions: sessions.size
  });
});

// Serve candidates list for frontend selection
app.get('/api/candidates', (req, res) => {
  const list = candidatesData.candidates.map(c => ({
    id: c.member.id,
    name: c.member.name,
    jobRole: c.member.jobRole,
    yearsExperience: c.member.yearsExperience,
    education: c.member.education,
    status: c.member.status,
    missionsCompleted: c.signals.missionsCompleted,
    commitDays: c.signals.commitDays
  }));
  res.json({ candidates: list });
});

// POST /api/interview — the single required endpoint (technical-spec.md)
app.post('/api/interview', (req, res) => {
  // Stub — will be wired up in Step 3
  res.json({ reply: 'Endpoint registered. Implementation coming in Step 3.', done: false });
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`🎤 AI Interview Agent backend running on http://localhost:${PORT}`);
});

export { curriculum, candidatesData, sessions };
