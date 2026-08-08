# AI Interview Agent 🎤

**Build the interviewer, not the interview.**

An AI-powered technical interview agent that conducts realistic, adaptive, multi-turn spoken-style technical interviews personalized to each candidate's actual learning journey through the AI Cohort program.

## What It Does

- **Conducts conversational technical interviews** — not a quiz, but a realistic multi-turn dialogue
- **Personalizes every interview** using candidate mission data (passed/skipped/attempts) cross-referenced against the 31-day, 8-module curriculum
- **Asks intelligent follow-up questions** that reference what the candidate actually said
- **Produces structured, actionable feedback** tied to specific curriculum days

## Tech Stack

- **Frontend**: React + Vite (deployed to Vercel/Netlify)
- **Backend**: Express.js (deployed as a single persistent process on Render)
- **LLM**: Groq (`llama-3.3-70b-versatile`) — exclusive provider
- **Session State**: In-memory Map (no database required)

## Local Development

### Prerequisites
- Node.js 18+
- A Groq API key ([get one here](https://console.groq.com))

### Setup
```bash
# Clone the repo
git clone <your-repo-url>
cd ai-interview-agent

# Backend
cd backend
cp .env.example .env
# Add your GROQ_API_KEY to .env
npm install
npm run dev

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

### Environment Variables
| Variable | Where | Description |
|----------|-------|-------------|
| `GROQ_API_KEY` | `backend/.env` | Your Groq API key (starts with `gsk_...`) |
| `FRONTEND_URL` | `backend/.env` | Allowed Frontend client URL for production CORS verification |
| `VITE_API_URL` | `frontend/.env` | Backend API URL (defaults to `http://localhost:3001` in dev) |


## Live Demo

🔗 **[Live Demo URL]** *(to be added after deployment)*

## Personalization Approach

The Interview Planner scores each candidate's missions:
- **Skipped days** → high priority (test transferable understanding)
- **Failed days** → high priority (probe knowledge gaps)
- **High attempts (≥3)** → medium-high priority (revisit struggles)
- **First-try passes** → medium priority (deeper "why" questions)

Questions span ≥4 distinct curriculum days across different modules, with Day 31 (Capstone) as a natural anchor for multi-topic follow-ups.

## AI Usage Log

See [PROMPTS.md](./PROMPTS.md) for a complete log of AI prompts used during development.
