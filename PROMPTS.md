# PROMPTS.md — AI Usage Log

> This file logs the real prompts and design decisions made during development, in chronological order. Required for hackathon Stage 2 Authenticity Review.

---

## Entry 1 — Project Scaffolding (Step 1)
**Date:** 2026-08-08
**What:** Initial project setup and scaffold
**Prompt used:** "Read PRD.md, TRD.md, App-Flow.md, UI-Design.md, and Security.md in full before writing any code — they define the product, architecture, API contract, visual design, and compliance requirements. Then follow Implementation.md step by step."
**Why:** Needed to understand the full scope of the hackathon project before generating any code. The prompt instructs sequential reading of all design documents to prevent deviation from the API contract.
**Design decisions made:**
- Chose **Express.js** (Node) over FastAPI (Python) for the backend — the team is more JS-native, and using the OpenAI SDK pointed at Groq's base URL is equally clean in Node (TRD.md §5.2).
- **Monorepo layout** with `/frontend`, `/backend`, `/data` directories as specified in Implementation.md §2.
- Frontend scaffolded with **Vite + React** (vanilla JS, not TypeScript) — matches the cohort's Day 3 stack and deploys easily.
- `.gitignore` follows Security.md §6 recommendations.
- `.env.example` committed with empty `GROQ_API_KEY` for judge reproducibility.

## Entry 2 — Session Store & API Skeleton (Step 3)
**Date:** 2026-08-08
**What:** Implementing POST /api/interview with all three flow shapes
**Prompt/approach:** Built the API contract routing logic from technical-spec.md verbatim — Start (has `candidate`), Turn (has `message`), End (automatic on completion). Used the AI to generate comprehensive input validation and error handling per Security.md §3.
**Design decisions:**
- Implemented all error cases from App-Flow.md §2: unknown sessionId → 404, done session → 409, malformed request → 400, oversized message → 413.
- Message cap at 5000 chars to prevent pathological LLM costs.
- Session cleanup via setInterval (30-min TTL for done sessions).

## Entry 3 — Interview Planner / Personalization Engine (Step 4)
**Date:** 2026-08-08
**What:** Deterministic question plan generation from candidate data
**Prompt/approach:** Translated the scoring algorithm from TRD.md §4 into code: `skipped=10, failed=9, attempts>=3=7, first-try=3, capstone=8`. Added role-based modulation (DevOps → boost deployment days, AI/ML → boost embeddings/agents days). Tested against 5 diverse candidate profiles to verify personalization.
**Design decisions:**
- Priority scoring is purely deterministic (no LLM) — faster and reproducible.
- Role modulation adds ±1 priority rather than overriding, so signal strength still dominates.
- Capped plan at 10 entries — with 1-2 follow-ups per topic, this naturally yields 8-14 total questions.
- Tested: Sarah Johnson (skipped Day 29 → #1), Emily Chen (all first-try → tradeoff questions), Gerald Combs (3 failures → foundational), Michael Brown (DevOps → deployment boost), Mia Alvarez (5 skipped → all foundational).

## Entry 4 — Groq LLM Orchestration (Steps 5 & 6)
**Date:** 2026-08-08
**What:** Per-turn interview replies and structured feedback via Groq
**Prompt/approach:** Built the system prompt to enforce all 10 interviewer persona rules from App-Flow.md §3 — one question at a time, acknowledge before pivoting, reference specifics in follow-ups, adapt difficulty to signal, natural transitions, time-box follow-ups, stay in curriculum scope. Used `response_format: { type: "json_object" }` for feedback to get reliable structured output.
**Design decisions:**
- **Model:** `llama-3.3-70b-versatile` for strongest reasoning (TRD.md §5.3).
- **Temperature:** 0.7 for turns (natural conversation), 0.5 for feedback (more focused).
- **Follow-up detection:** Hybrid approach — count follow-ups per topic (max 2) + check if LLM mentions next topic keywords.
- **Feedback retry:** Single corrective retry on parse failure per Security.md §4, with fallback to static feedback if both attempts fail.
- **System prompt includes dynamic context:** current plan entry, coverage summary, questions remaining — so the LLM knows the interview's state at every turn.

## Entry 5 — Frontend & Polish Pass (Steps 7-10)
**Date:** 2026-08-08
**What:** Designing and building Landing, Chat, and Feedback screens, with premium anime.js micro-interactions
**Prompt/approach:** Built a custom CSS design system using a warm terracotta/amber palette (#C2540A) to stand out from generic AI chatbot templates. Added anime.js timeline animations for initial landing page entrance, elastic card staggers, message bubble scaling/sliding, smooth progress bar updates, and Checkmark path drawing on feedback completion. Wrote mock simulated responses on the server to keep the app 100% testable and robust even if Groq keys are not configured.
**Design decisions:**
- **Color Palette:** Curated `#C2540A` (primary brand color) with cream backgrounds and off-white cards to look extremely professional and premium.
- **Animations:** Downgraded anime.js to `3.2.2` (via npm) to use the stable, robust default-export `anime(...)` API. Eliminated CSS keyframe animations that collided with JS transforms to avoid visual glitches.
- **Robustness:** Added `followupCount` tracking to the backend session object rather than parsing transcripts. Wrote a custom programmatic E2E script `test-end-to-end.mjs` to simulate 20 turns and verify the completion state machine (especially for sparse candidate profiles with <4 days where MIN_DAYS cannot be met).
