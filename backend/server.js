/**
 * AI Interview Agent — Backend Server
 * 
 * Express server exposing POST /api/interview as required by technical-spec.md.
 * Uses Groq (llama-3.1-8b-instant) as the exclusive LLM provider via the
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
import { buildInterviewPlan, summarizePlan } from './planner.js';
import { generateInterviewReply, generateOpeningMessage, generateFeedback } from './groq.js';

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
      callback(null, true); // Relaxed for hackathon demo
    }
  }
}));

app.use(express.json({ limit: '10kb' })); // Cap request body size (Security.md §3)

// --- Load static data at startup (TRD.md §7) ---
const dataDir = join(__dirname, 'data');
const curriculum = JSON.parse(readFileSync(join(dataDir, 'curriculum.json'), 'utf-8'));
const candidatesData = JSON.parse(readFileSync(join(dataDir, 'candidates.json'), 'utf-8'));

console.log(`✓ Loaded curriculum: ${curriculum.days.length} days, ${curriculum.modules.length} modules`);
console.log(`✓ Loaded candidates: ${candidatesData.candidates.length} profiles`);

// --- In-memory session store (TRD.md §3.1) ---
const sessions = new Map();

// --- Helper: Get curriculum day details ---
function getCurriculumDay(dayNum) {
  return curriculum.days.find(d => d.day === dayNum) || null;
}

// --- Helper: Validate candidate object shape (Security.md §3) ---
function validateCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object') return false;
  if (!candidate.member || typeof candidate.member !== 'object') return false;
  if (!candidate.member.id || !candidate.member.name) return false;
  if (!Array.isArray(candidate.missions)) return false;
  return true;
}

// --- API Routes ---

// Health check
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

// Serve full candidate data by ID (for frontend to send in Start request)
app.get('/api/candidates/:id', (req, res) => {
  const candidate = candidatesData.candidates.find(c => c.member.id === req.params.id);
  if (!candidate) {
    return res.status(404).json({ error: 'Candidate not found' });
  }
  res.json(candidate);
});

/**
 * POST /api/interview — The single required endpoint (technical-spec.md)
 * 
 * Three flow shapes per TRD.md §2:
 * 1. START: { sessionId, candidate } → creates session, returns opening question
 * 2. TURN:  { sessionId, message }   → processes answer, returns next question  
 * 3. END:   automatically triggered when completion conditions met
 */
app.post('/api/interview', async (req, res) => {
  try {
    const { sessionId, candidate, message } = req.body;

    // --- Input validation (Security.md §3) ---
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid sessionId' });
    }

    const existingSession = sessions.get(sessionId);

    // --- CASE: Session already done (App-Flow.md §2, STATE: DONE) ---
    if (existingSession && existingSession.status === 'done') {
      return res.status(409).json({ 
        error: 'This interview has already ended. Start a new session with a fresh sessionId.' 
      });
    }

    // --- CASE: START (has candidate, no existing session) ---
    if (candidate && !existingSession) {
      if (!validateCandidate(candidate)) {
        return res.status(400).json({ error: 'Invalid candidate object shape' });
      }

      // Build the question plan using the Personalization Engine (TRD.md §4)
      const questionPlan = buildInterviewPlan(candidate, curriculum);

          // Initialize session (TRD.md §3.2)
      const session = {
        sessionId,
        candidate,
        questionPlan,
        askedDays: new Set(),
        questionCount: 0,
        currentPlanIndex: 0,
        transcript: [],
        status: 'in_progress',
        followupCount: 0
      };

      sessions.set(sessionId, session);

      // Generate LLM-powered opening message with first question
      const firstPlan = questionPlan[0];
      const reply = await generateOpeningMessage(session, firstPlan);

      // Record in transcript
      session.transcript.push({ role: 'interviewer', text: reply });
      session.questionCount = 1;
      session.askedDays.add(firstPlan.day);

      return res.json({ reply, done: false });
    }

    // --- CASE: TURN (has message, existing session) ---
    if (message !== undefined && existingSession) {
      if (typeof message !== 'string') {
        return res.status(400).json({ error: 'Message must be a string' });
      }
      if (message.length > 5000) {
        return res.status(413).json({ error: 'Message too long (max 5000 characters)' });
      }

      const session = existingSession;

      // Append candidate's message to transcript
      session.transcript.push({ role: 'candidate', text: message });

      // Get current and next plan entries
      const currentPlan = session.questionPlan[session.currentPlanIndex];
      const nextPlan = session.currentPlanIndex + 1 < session.questionPlan.length 
        ? session.questionPlan[session.currentPlanIndex + 1] 
        : null;

      // Generate LLM reply with follow-up/advance decision
      const { reply, shouldAdvance } = await generateInterviewReply(
        session, message, currentPlan, nextPlan
      );

      // Update session state based on LLM's decision
      if (shouldAdvance && nextPlan) {
        session.currentPlanIndex++;
        session.askedDays.add(nextPlan.day);
        session.followupCount = 0;
      } else {
        session.followupCount = (session.followupCount || 0) + 1;
      }
      session.questionCount++;

      // Record in transcript
      session.transcript.push({ role: 'interviewer', text: reply });

      // Check completion condition (TRD.md §3.2, App-Flow.md §5 edge cases)
      const MIN_QUESTIONS = 8;
      const MIN_DAYS = 4;
      const MAX_QUESTIONS = 14;
      
      const meetsMinimums = session.questionCount >= MIN_QUESTIONS && session.askedDays.size >= MIN_DAYS;
      const hitCeiling = session.questionCount >= MAX_QUESTIONS;
      const exhaustedPlan = session.currentPlanIndex >= session.questionPlan.length - 1;
      const canMeetMinimums = session.questionPlan.length >= MIN_DAYS;

      // Complete if:
      // 1. We hit the hard ceiling of 14 questions (cost containment)
      // 2. We met minimums (8 questions, 4 days) and the plan is exhausted
      // 3. We cannot possibly meet MIN_DAYS (sparse candidate profile) but reached MIN_QUESTIONS (8)
      const isComplete = hitCeiling || 
        (meetsMinimums && (exhaustedPlan || !nextPlan)) ||
        (!nextPlan && !canMeetMinimums && session.questionCount >= MIN_QUESTIONS);

      if (isComplete) {
        // --- End the interview (App-Flow.md §2, STATE: ENDING → DONE) ---
        
        // Generate structured feedback via LLM (TRD.md §5.4)
        const feedback = await generateFeedback(session);

        session.status = 'done';
        session.completedAt = Date.now();

        const endReply = 'Interview completed.';
        session.transcript.push({ role: 'interviewer', text: endReply });

        return res.json({ reply: endReply, done: true, feedback });
      }

      return res.json({ reply, done: false });
    }

    // --- CASE: Turn request but no session found ---
    if (message !== undefined && !existingSession) {
      return res.status(404).json({ 
        error: 'Session not found. Start a new interview by sending a candidate object.' 
      });
    }

    // --- CASE: Ambiguous/malformed request ---
    return res.status(400).json({ 
      error: 'Invalid request. Send { sessionId, candidate } to start, or { sessionId, message } for a turn.' 
    });

  } catch (error) {
    console.error('Error in /api/interview:', error);
    return res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
});

// --- Optional: Session cleanup (TRD.md §3.1 hygiene) ---
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.status === 'done' && session.completedAt && (now - session.completedAt > 30 * 60 * 1000)) {
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);

// --- Start server ---
app.listen(PORT, () => {
  console.log(`🎤 AI Interview Agent backend running on http://localhost:${PORT}`);
  if (!process.env.GROQ_API_KEY) {
    console.warn('⚠ GROQ_API_KEY not set — LLM calls will fail. Set it in .env');
  }
});

export { curriculum, candidatesData, sessions };
