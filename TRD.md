# TRD.md — AI Interview Agent
### Technical Requirements Document

> **Instruction to the IDE coding agent:** This document is the binding API and architecture contract. The `POST /api/interview` contract in §2 is copied verbatim from `technical-spec.md` and must not be altered — the hackathon's automated Stage 1 verification depends on exact compliance.

---

## 1. Architecture Overview

```
┌──────────────┐      POST /api/interview       ┌───────────────────────┐
│   Frontend    │ ───────────────────────────▶  │   Backend (API layer)  │
│  (chat UI)    │ ◀───────────────────────────  │                        │
└──────────────┘      { reply, done, ... }       │  ┌──────────────────┐ │
                                                  │  │ Session Store    │ │
                                                  │  │ (in-memory map:  │ │
                                                  │  │ sessionId → state)│ │
                                                  │  └──────────────────┘ │
                                                  │  ┌──────────────────┐ │
                                                  │  │ Interview Planner │ │
                                                  │  │ (curriculum.json  │ │
                                                  │  │  + candidate.json │ │
                                                  │  │  → question plan) │ │
                                                  │  └──────────────────┘ │
                                                  │  ┌──────────────────┐ │
                                                  │  │ LLM Orchestrator  │ │
                                                  │  │ (system prompt +  │ │
                                                  │  │  conversation log)│ │
                                                  │  └──────────────────┘ │
                                                  └───────────────────────┘
```

- **Frontend**: any framework (React recommended, per curriculum's own Day 3 stack — reuse familiarity). Single-page chat interface.
- **Backend**: any framework (FastAPI/Node/Express acceptable). Must expose exactly one public endpoint: `POST /api/interview`.
- **Session state**: in-memory (dict/Map) keyed by `sessionId`. No database required — long-term persistence is explicitly out of scope. See §3.1 for exactly how this must be stored and what it means for deployment.
- **LLM**: **Groq only** (see §5) — used for (a) generating the next interview question/follow-up given state, and (b) generating the final structured feedback.

## 2. API Contract (authoritative — mirrored from `technical-spec.md`)

### 2.1 Endpoint
```
POST /api/interview
```
No authentication required.

### 2.2 Start Interview (first request for a `sessionId`)
Request:
```json
{
  "sessionId": "abc-123",
  "candidate": { ...candidate.json }
}
```
Response:
```json
{
  "reply": "Welcome. Let's begin your interview.",
  "done": false
}
```

### 2.3 Conversation Turn (every subsequent request)
Request:
```json
{
  "sessionId": "abc-123",
  "message": "..."
}
```
Response:
```json
{
  "reply": "...",
  "done": false
}
```

### 2.4 End Interview
Response when the interview concludes:
```json
{
  "reply": "Interview completed.",
  "done": true,
  "feedback": {
    "summary": "...",
    "strengths": [],
    "gaps": [],
    "next": []
  }
}
```

### 2.5 Feedback Field Types

| Field | Type | Notes |
|---|---|---|
| `summary` | `string` | 2–4 sentence overview of performance |
| `strengths` | `string[]` | Concise, actionable, tied to specific curriculum days |
| `gaps` | `string[]` | Concise, actionable, tied to specific curriculum days |
| `next` | `string[]` | Concrete next steps / study recommendations |

## 3. Server-Side State Model

### 3.1 How to store it, and why the hosting choice matters

**How to store it (local dev and simplest production form):**
- Use a single in-process data structure on the backend server — a plain JavaScript `Map<string, InterviewSession>` (Node/Express) or a Python `dict[str, InterviewSession]` (FastAPI) held as a module-level variable.
- No external database, Redis, or ORM is required or expected. This is intentional: the hackathon brief explicitly puts "long-term conversation history" and "persistent user accounts" out of scope, and a plain in-memory map is the correct, simplest implementation of that.
- Nothing is written to disk. When the process stops, all sessions disappear — that's acceptable and expected behavior, not a bug to engineer around.
- Optional hygiene (not required, but cheap to add): sweep/delete sessions with `status: "done"` after a short TTL (e.g., 30–60 minutes) so memory doesn't grow unbounded during a long demo/judging period.

**Why the hosting choice matters — this is the part that actually affects deployment:**
An in-memory `Map`/`dict` only works correctly if **the same process handles every request for a given `sessionId`**. This rules out one very common deployment shape:

- ❌ **Do not deploy the backend as serverless functions** (e.g., Vercel Serverless/Edge Functions, Netlify Functions, AWS Lambda behind API Gateway with no session affinity). Each invocation can spin up in a fresh, isolated execution context with an empty `Map`, so a Turn request might hit an instance that never saw the matching Start request — the session simply won't be found, and the interview breaks silently or throws a "session not found" error.
- ✅ **Do deploy the backend as a single long-running server process** on a host that keeps one process alive and routes all traffic to it: **Render, Railway, Fly.io, a plain VM, or a Heroku-style dyno** all work correctly, because the process (and its in-memory `Map`) persists across requests for as long as it's running.
- ⚠️ If you scale the backend to **multiple instances/replicas** behind a load balancer (not necessary for a hackathon demo, but worth knowing), a `sessionId` could land on a different instance than the one holding its state. For this project's scope, **run exactly one backend instance/replica** — do not enable autoscaling or multiple dynos for the API service. This is the single most important deployment constraint in this whole document; violating it is the most common way this architecture breaks in production despite working perfectly in local dev.
- The frontend, by contrast, is fully static and has no state — deploy it anywhere (Vercel/Netlify are fine and recommended) with no such restriction.

### 3.2 Session Shape

Per `sessionId`, maintain:

```ts
interface InterviewSession {
  sessionId: string;
  candidate: Candidate;              // from request body on Start
  questionPlan: PlannedQuestion[];   // derived from candidate + curriculum
  askedDays: Set<number>;            // curriculum days already covered
  questionCount: number;             // total questions asked so far
  transcript: { role: "interviewer" | "candidate"; text: string }[];
  status: "in_progress" | "done";
}

interface PlannedQuestion {
  day: number;          // curriculum day this question targets
  moduleTitle: string;
  rationale: "skipped" | "low_attempts_high_confidence" | "high_attempts_weak" | "failed" | "capstone_anchor";
  priority: number;     // higher = ask sooner
}
```

- `questionPlan` is computed once at Start using the personalization rules in `PRD.md` §7, then consumed turn by turn.
- Completion condition (must both be true before `done: true` can be returned):
  - `questionCount >= 8`
  - `askedDays.size >= 4` (distinct curriculum days)
- A hard ceiling (e.g., `questionCount <= 14`) prevents runaway sessions; once both minimums are satisfied, the agent may choose to end after the current natural conversational beat rather than mechanically stopping mid-thread.

## 4. Interview Planner (Personalization Engine)

Input: one `candidate` object + full `curriculum.json`.

Algorithm (deterministic pre-processing before any LLM call):
1. Join `candidate.missions[]` against `curriculum.json.days[]` by `day` to get full topic/objective/tool context for every attempted day.
2. Score each mission:
   - `skipped: true` → high priority (candidate can be asked to explain the topic anyway, from first principles, to test transferable understanding).
   - `passed: false` → high priority (gap-probing question).
   - `passed: true, attempts >= 3` → medium-high priority (struggled, revisit).
   - `passed: true, attempts === 1` → medium priority, but flagged for a *deeper* "why" / trade-off question rather than a recall question.
3. Ensure the selected day set spans ≥ 4 distinct modules where the candidate's data allows it (fallback to same-module if the candidate's data is too sparse — rare edge case, note in code comments).
4. Always include Day 31 (Capstone) as an anchor if present in `candidate.missions[]`, since it naturally elicits multi-topic follow-ups.
5. Output ordered `questionPlan`, capped to feed 8–14 questions total (a single day can generate an initial question + 1–2 follow-ups, which is how "8 questions across 4 days" naturally happens without needing 8 distinct days).

## 5. LLM Orchestration — Groq (exclusive provider)

This project uses **Groq** as its only LLM provider — do not add OpenAI, Anthropic, or any other provider as a fallback or option. Groq's API is **OpenAI-compatible**, so any OpenAI-SDK-based code needs only a base URL and key swap.

### 5.1 Connection Details

| Setting | Value |
|---|---|
| Base URL | `https://api.groq.com/openai/v1` |
| Chat endpoint | `POST /chat/completions` (reached automatically via the SDK) |
| Auth | Bearer token via `Authorization: Bearer $GROQ_API_KEY` header (handled by the SDK) |
| Env var name | `GROQ_API_KEY` (set locally in `backend/.env`, and in the hosting platform's secret manager in production — see `Security.md` §2) |
| API key format | starts with `gsk_...` — get it from the GroqCloud Console after signing up at groq.com |

### 5.2 Setup (pick whichever matches the backend framework chosen in `Implementation.md`)

**Python (FastAPI) — using the official `groq` SDK:**
```bash
pip install groq
```
```python
import os
from groq import Groq

client = Groq(api_key=os.environ["GROQ_API_KEY"])

response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[
        {"role": "system", "content": system_prompt},
        *conversation_history,
        {"role": "user", "content": candidate_message},
    ],
)
reply_text = response.choices[0].message.content
```

**Node/Express — using the OpenAI SDK pointed at Groq (equally valid, no separate SDK needed):**
```bash
npm install openai
```
```js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const response = await client.chat.completions.create({
  model: "llama-3.3-70b-versatile",
  messages: [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: candidateMessage },
  ],
});
const replyText = response.choices[0].message.content;
```

### 5.3 Model Choice

Use **`llama-3.3-70b-versatile`** as the default model for both per-turn interview replies and the final feedback generation — it has the strongest reasoning quality on Groq's free tier, which matters for judging follow-up questions and producing coherent, non-generic feedback. If latency becomes a concern during live judging, `llama-3.1-8b-instant` is a faster fallback with somewhat lighter reasoning — note the trade-off in code comments if you switch.

### 5.4 System Prompt Construction

- Constructed server-side, never client-side, and never includes the raw `GROQ_API_KEY`.
- Must include:
  - Interviewer persona and tone instructions (see `App-Flow.md` §3 for exact voice guidance).
  - The current `questionPlan` entry being covered (day title, objectives, tools, rationale).
  - Rules: ask one question at a time; generate a follow-up if the candidate's last answer was shallow, vague, or incorrect; move to the next planned topic once a topic feels sufficiently probed (roughly 1–2 follow-ups per topic).
  - Instruction to never fabricate curriculum content not present in `curriculum.json`.
- **Per-turn call**: send system prompt + running transcript (or a summarized window of it) + latest candidate message → get next `reply`.
- **Final call**: once completion condition is met, send full transcript + candidate profile → request a structured JSON feedback object matching the exact `feedback` schema in §2.5. Ask Groq for JSON directly by adding `response_format: { type: "json_object" }` to the request (supported on Groq's OpenAI-compatible endpoint) — this significantly reduces malformed output compared to parsing free text.
- Validate/parse the returned JSON server-side before returning it to the client regardless (never trust raw LLM output to already be well-formed — see `Security.md` §4 and `Implementation.md` for the retry-once pattern).

### 5.5 Rate Limits (free tier — plan around these, don't design past them)

Groq's free tier is generous for a hackathon demo but not unlimited — `llama-3.3-70b-versatile` has daily request/token caps on the free tier. For a single live demo session (roughly 8–14 turns plus one feedback call), usage stays well within free-tier limits; just avoid looping test runs against the live deployment dozens of times right before judging without checking the GroqCloud Console dashboard for remaining quota.

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Reliability | Endpoint must not crash on malformed `sessionId` reuse — return a clear 4xx error instead of a 500. |
| Latency | Each turn should respond in a few seconds; stream if the chosen framework/LLM SDK supports it (optional enhancement, not required). |
| Statelessness across sessions | No data persists after the process restarts — acceptable per Out-of-Scope. |
| Portability | Must deploy to a free/low-cost host reachable publicly. Frontend: Vercel/Netlify (static, no restrictions). Backend: a persistent single-instance host only — Render, Railway, or Fly.io — never serverless functions (see §3.1). A live demo URL is mandatory for Stage 1. |
| Framework freedom | Any AI model, framework, vector DB, or architecture is permitted per the hackathon brief — this TRD's specifics are implementation guidance, not a restriction beyond the API contract in §2. |

## 7. Data Files Bundled With the App

The app must ship with (read-only, bundled as static JSON, not user-uploaded):
- `curriculum.json` — full 31-day, 8-module curriculum.
- `candidates.json` — 20 seeded candidate profiles used for demo/judging.

These are loaded server-side at startup or on first request; they are **not** re-uploaded per API call except that the `candidate` object is echoed into the Start request body per the contract in §2.2.
