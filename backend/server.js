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
import { buildInterviewPlan, summarizePlan } from './planner.js';

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
const dataDir = join(__dirname, '..', 'data');
const curriculum = JSON.parse(readFileSync(join(dataDir, 'curriculum.json'), 'utf-8'));
const candidatesData = JSON.parse(readFileSync(join(dataDir, 'candidates.json'), 'utf-8'));

console.log(`✓ Loaded curriculum: ${curriculum.days.length} days, ${curriculum.modules.length} modules`);
console.log(`✓ Loaded candidates: ${candidatesData.candidates.length} profiles`);

// --- In-memory session store (TRD.md §3.1) ---
// Map<string, InterviewSession>
// InterviewSession shape defined in TRD.md §3.2
const sessions = new Map();

// --- Helper: Find which module a curriculum day belongs to ---
function getModuleForDay(dayNum) {
  for (const mod of curriculum.modules) {
    if (dayNum >= mod.days[0] && dayNum <= mod.days[1]) {
      return mod;
    }
  }
  return null;
}

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
 * 
 * Error cases:
 * - Missing/invalid sessionId → 400
 * - Unknown sessionId on Turn → 404  
 * - Session already done → 409
 * - Missing candidate on Start → 400
 * - Message too long → 413
 */
app.post('/api/interview', async (req, res) => {
  try {
    const { sessionId, candidate, message } = req.body;

    // --- Input validation (Security.md §3) ---
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid sessionId' });
    }

    // Determine flow shape: START vs TURN
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
      console.log(`✓ Plan for ${candidate.member.name}:`, summarizePlan(questionPlan));

      // Initialize session (TRD.md §3.2)
      const session = {
        sessionId,
        candidate,
        questionPlan,
        askedDays: new Set(),
        questionCount: 0,
        currentPlanIndex: 0,
        transcript: [],
        status: 'in_progress'
      };

      sessions.set(sessionId, session);

      // Generate opening message (stubbed — Step 5 will use Groq)
      const firstQuestion = questionPlan[0];
      const currDay = getCurriculumDay(firstQuestion.day);
      const reply = `Welcome, ${candidate.member.name}. I'm your technical interviewer today. Let's explore your experience with the AI Cohort program.\n\nLet's start with ${currDay ? currDay.title : 'your first topic'}. ${getOpeningQuestion(firstQuestion, currDay, candidate)}`;

      // Record in transcript
      session.transcript.push({ role: 'interviewer', text: reply });
      session.questionCount = 1;
      session.askedDays.add(firstQuestion.day);

      return res.json({ reply, done: false });
    }

    // --- CASE: TURN (has message, existing session) ---
    if (message !== undefined && existingSession) {
      // Validate message (Security.md §3)
      if (typeof message !== 'string') {
        return res.status(400).json({ error: 'Message must be a string' });
      }
      if (message.length > 5000) {
        return res.status(413).json({ error: 'Message too long (max 5000 characters)' });
      }

      const session = existingSession;

      // Append candidate's message to transcript
      session.transcript.push({ role: 'candidate', text: message });

      // Generate next reply (stubbed — Step 5 will use Groq LLM)
      // For now, advance through the question plan mechanically
      session.currentPlanIndex++;
      session.questionCount++;

      // Check completion condition (TRD.md §3.2)
      const minQuestions = 8;
      const minDays = 4;
      const maxQuestions = 14;
      const isComplete = (
        session.questionCount >= minQuestions &&
        session.askedDays.size >= minDays
      ) || session.questionCount >= maxQuestions;

      if (isComplete || session.currentPlanIndex >= session.questionPlan.length) {
        // End the interview (Step 6 will generate real feedback via Groq)
        session.status = 'done';
        const feedback = {
          summary: `Interview with ${session.candidate.member.name} covered ${session.askedDays.size} curriculum areas across ${session.questionCount} questions. Full feedback will be generated by the LLM in Step 6.`,
          strengths: ['Placeholder — real feedback pending LLM integration'],
          gaps: ['Placeholder — real feedback pending LLM integration'],
          next: ['Placeholder — real feedback pending LLM integration']
        };
        
        const reply = 'Interview completed.';
        session.transcript.push({ role: 'interviewer', text: reply });

        return res.json({ reply, done: true, feedback });
      }

      // Ask next question
      const nextPlan = session.questionPlan[session.currentPlanIndex];
      const nextDay = getCurriculumDay(nextPlan.day);
      session.askedDays.add(nextPlan.day);

      const reply = `Thank you for that response. Let me ask you about ${nextDay ? nextDay.title : 'the next topic'}. ${getOpeningQuestion(nextPlan, nextDay, session.candidate)}`;
      session.transcript.push({ role: 'interviewer', text: reply });

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
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Question plan is now built by planner.js (Step 4 — Personalization Engine)

/**
 * Generate a stub opening question based on the plan rationale.
 * Step 5 will replace this with proper LLM-generated questions.
 */
function getOpeningQuestion(planEntry, currDay, candidate) {
  const objectives = currDay ? currDay.objectives.join(', ') : '';
  
  switch (planEntry.rationale) {
    case 'skipped':
      return `I noticed you skipped this module. Can you tell me what you understand about ${currDay ? currDay.title : 'this topic'} and its core concepts?`;
    case 'failed':
      return `This was a challenging area. Can you walk me through your understanding of the key concepts in ${currDay ? currDay.title : 'this topic'}?`;
    case 'high_attempts_weak':
      return `You worked through this area over several attempts. What were the main challenges you faced, and how did you eventually approach ${currDay ? currDay.title : 'this topic'}?`;
    case 'low_attempts_high_confidence':
      return `You seemed to grasp this quickly. Can you explain why you chose the approach you did for ${currDay ? currDay.title : 'this topic'}, and what alternatives you considered?`;
    case 'capstone_anchor':
      return `Walk me through your capstone project architecture. What were the key technical decisions you made, and why?`;
    default:
      return `Tell me about your experience with ${currDay ? currDay.title : 'this topic'}.`;
  }
}

// --- Optional: Session cleanup (TRD.md §3.1 hygiene) ---
// Sweep done sessions after 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.status === 'done' && session.completedAt && (now - session.completedAt > 30 * 60 * 1000)) {
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// --- Start server ---
app.listen(PORT, () => {
  console.log(`🎤 AI Interview Agent backend running on http://localhost:${PORT}`);
});

export { curriculum, candidatesData, sessions };
