# Implementation.md — AI Interview Agent
### Implementation & Build Plan

> **Instruction to the IDE coding agent:** Follow this build order. Commit after each numbered step (not each sub-bullet) so the git history demonstrates genuine incremental development, per `Security.md` §5. Update `PROMPTS.md` with the real prompt(s) used for each step as you go.

---

## 1. Recommended Stack (a suggestion, not a restriction — any stack satisfying `TRD.md` is valid)

- **Frontend**: React + Vite (matches the cohort's own Day 3 stack, fast to scaffold, deploys easily to Vercel/Netlify).
- **Backend**: FastAPI (Python) or Express (Node) — either is fine; FastAPI pairs naturally if using an OpenAI-compatible SDK, Express if the team is more JS-native.
- **LLM provider**: **Groq only** (`GROQ_API_KEY`, model `llama-3.3-70b-versatile`) — see `TRD.md` §5 for exact SDK setup, connection details, and rate-limit notes. Do not add other providers.
- **Hosting**: frontend on Vercel/Netlify; backend on Render/Railway/Fly.io, or both together if the framework supports a combined deploy.

## 2. Build Order

### Step 1 — Repo & Project Scaffolding
- Initialize a fresh public git repository (not from a pre-existing template — see `Security.md` §5).
- Create `PROMPTS.md` immediately, with the first entry being the prompt used to scaffold the project.
- Scaffold frontend (`npm create vite@latest`) and backend (FastAPI/Express skeleton) in a monorepo layout, e.g.:
  ```
  /frontend
  /backend
  /data
    curriculum.json
    candidates.json
  /technical-spec.md
  /PROMPTS.md
  /README.md
  ```
- Add `.gitignore` per `Security.md` §6. Commit.

### Step 2 — Static Data Loading
- Copy the provided `curriculum.json` and `candidates.json` into `/data`.
- Backend: load both into memory at server startup (simple `readFileSync`/`open()` + `json.load` — no DB needed).
- Add a throwaway internal debug route (or a quick script) to confirm both files parse and the 31 days / 20 candidates are all present. Remove/guard the debug route before final submission. Commit.

### Step 3 — Session Store & API Skeleton
- Implement the `POST /api/interview` route per `TRD.md` §2 exactly.
- Implement the in-memory session store (`Map<sessionId, InterviewSession>` or dict) per `TRD.md` §3.
- Wire up request routing for the three shapes: Start (has `candidate`), Turn (has `message`), and handle the "unknown sessionId" and "session already done" error cases from `App-Flow.md` §2 & §5.
- At this point, stub the `reply` with a hardcoded string to verify the contract end-to-end with curl/Postman before adding any LLM logic. Commit.

### Step 4 — Interview Planner (Personalization Engine)
- Implement the join + scoring algorithm from `TRD.md` §4: cross-reference `candidate.missions[]` with `curriculum.json.days[]`, score by `skipped`/`passed`/`attempts`, and produce an ordered `questionPlan`.
- Unit-test this in isolation (no LLM needed yet) against a couple of the 20 seeded candidates to confirm the plan looks personalized (e.g., Sarah Johnson's plan should surface Day 29 "Monitoring, Logging & Observability" since it was `skipped`; Emily Chen's plan, with nearly all first-try passes, should lean toward deeper "why" questions). Commit.

### Step 5 — Groq Orchestration for Turns
- Set up the Groq client per `TRD.md` §5.2 (official `groq` Python SDK, or the OpenAI SDK pointed at Groq's base URL for Node), reading `GROQ_API_KEY` from environment variables only — never hardcoded.
- Build the system prompt template per `TRD.md` §5.4 and the persona rules in `App-Flow.md` §3.
- Implement the per-turn LLM call using `llama-3.3-70b-versatile`: given session transcript + current `questionPlan` pointer + latest candidate message, produce the next `reply` and decide (via the model's own judgment, or a lightweight heuristic/classifier step) whether to follow up or advance to the next planned topic.
- Update `askedDays` / `questionCount` accordingly.
- Test manually via the API (curl/Postman) through several turns for one candidate before touching the frontend. Commit.

### Step 6 — Completion & Structured Feedback
- Implement the completion check (`questionCount >= 8 && askedDays.size >= 4`, plus the ceiling) per `TRD.md` §3.2.
- Implement the feedback-generation Groq call, using `response_format: { type: "json_object" }` to request strict JSON output matching the schema in `technical-spec.md` (see `TRD.md` §5.4).
- Add server-side JSON parsing with a single corrective retry on failure (per `Security.md` §4) — never forward invalid JSON to the client.
- Test a full session end-to-end via API calls only, confirming the final response matches the contract in `technical-spec.md` §3 exactly. Commit.

### Step 7 — Frontend: Landing / Candidate Select
- Build the screen from `UI-Design.md` §2.1: list/select from the 20 seeded candidates (fetch `candidates.json` via a small backend read-only endpoint, or bundle it directly in the frontend build — either is fine since it's public synthetic data).
- Generate a client-side `sessionId` (e.g., `crypto.randomUUID()`) on candidate selection and fire the Start request. Commit.

### Step 8 — Frontend: Interview Chat Screen
- Build the chat UI from `UI-Design.md` §2.2: transcript, input box, progress indicator, loading/typing state, error state.
- Wire Turn requests to the backend; render `reply` messages as they arrive; watch for `done: true` to transition screens. Commit.

### Step 9 — Frontend: Feedback Screen
- Build the screen from `UI-Design.md` §2.3, rendering `summary`/`strengths`/`gaps`/`next` and offering "Start New Interview". Commit.

### Step 10 — Polish Pass
- Apply the visual language from `UI-Design.md` §3 (typography, color, spacing, motion) consistently across all three screens.
- Handle the edge cases in `App-Flow.md` §5 (empty/short answers, sparse candidate profiles, network failure).
- Cross-check every functional requirement in `PRD.md` §6 (F1–F6) against the running app. Commit.

### Step 11 — Deployment & Compliance Pass
- Deploy the backend to a **persistent single-instance host only** (Render, Railway, or Fly.io) — never as serverless functions and never with multiple replicas/autoscaling, per `TRD.md` §3.1, since the in-memory session store depends on one process handling every request for a given `sessionId`.
- Deploy the frontend to Vercel/Netlify (static, no such restriction) pointed at the live backend URL.
- Set `GROQ_API_KEY` via the backend host's secret/environment variable manager, not in code.
- Smoke-test the live demo URL end-to-end (not just localhost) — including a full multi-turn interview, to confirm session state survives across the real network round trips of a deployed environment.
- Verify `.gitignore` excludes secrets, `PROMPTS.md` is complete and accurate, repo visibility is public, and README explains how to run locally and where the live demo is. Final commit.

## 3. Testing Checklist Before Submission

- [ ] `POST /api/interview` Start response matches `technical-spec.md` §1 exactly (field names, `done: false`).
- [ ] At least 8 total questions are asked in a full session.
- [ ] At least 4 distinct curriculum `day` values are covered in a full session.
- [ ] At least one follow-up question visibly references the candidate's prior answer content.
- [ ] Final response has `done: true` and a `feedback` object with all four required fields, correctly typed.
- [ ] Two different candidates produce visibly different question sets (personalization is real, not cosmetic).
- [ ] All three screens are verified with no horizontal scrolling and no broken layout at 360px, 768px, 1024px, and 1440px widths (see `UI-Design.md` §4).
- [ ] Brand color palette matches `UI-Design.md` §3.1 (amber/terracotta primary) — no purple/blue AI-cliché palette introduced anywhere in the build.
- [ ] Backend is deployed as a single persistent process (not serverless, not multi-replica) — confirmed by running a full interview against the live URL, not just localhost (see `TRD.md` §3.1).
- [ ] Live demo URL works from a fresh browser session (not just the dev machine).
- [ ] `PROMPTS.md` is present, complete, and matches what was actually built.
- [ ] No API keys or secrets (including `GROQ_API_KEY`) appear anywhere in the committed repo.
- [ ] Git history shows multiple incremental commits, not one large final commit.

## 4. Suggested Repo README Contents (for judges)

- One-paragraph product description ("the interviewer, not the interview").
- Local run instructions (backend + frontend, env vars needed).
- Live demo link.
- Short note on the personalization approach (so judges know where to look for it live).
- Link to `PROMPTS.md`.
