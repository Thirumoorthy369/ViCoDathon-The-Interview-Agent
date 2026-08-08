# PRD.md — AI Interview Agent
### Product Requirements Document

> **Instruction to the IDE coding agent:** Treat this document as the source of truth for *what* to build and *why*. Read it alongside `TRD.md`, `App-Flow.md`, `UI-Design.md`, `Security.md`, and `Implementation.md` before writing any code. Do not invent product scope beyond what is written here — if something is ambiguous, choose the simplest interpretation that still satisfies the hackathon's Minimum Requirements listed below.

---

## 1. Problem Statement

The AI Cohort is a 31-day, 8-module enterprise AI engineering program (see `curriculum.json`). Learners build real systems — RAG pipelines, vector search, agents, MCP integrations, deployments — but struggle to **verbally explain** the engineering decisions behind what they built when facing a real technical interview.

We are building **the interviewer, not the interview**: an AI agent that conducts a realistic, adaptive, multi-turn *spoken-style* technical interview, personalized to each candidate's actual learning journey (what they completed, skipped, struggled with, or aced), and ends with structured, actionable feedback.

## 2. Goals

1. Conduct a **conversational, multi-turn technical interview** that feels like a real interviewer, not a quiz.
2. **Personalize** every interview to the specific candidate using `candidate.json` mission data (passed/skipped/attempts) cross-referenced against `curriculum.json`.
3. Ask **intelligent follow-up questions** that respond to what the candidate just said (probe deeper on strong answers, gently re-anchor on weak ones).
4. **Maintain context** across the whole session using the `sessionId` state model defined in `technical-spec.md`.
5. Produce **structured, actionable feedback** at the end (`summary`, `strengths`, `gaps`, `next`).
6. Satisfy the hackathon's Stage 1 Eligibility checks out of the box: public repo, working live demo, and an AI Usage Log (`PROMPTS.md`).

## 3. Non-Goals (Out of Scope)

Per the hackathon brief, explicitly **do not build**:
- Voice interaction (text-based conversational turns only)
- User authentication / login system
- Persistent user accounts or a database of past candidates
- Long-term conversation history across sessions (state lives only for the duration of one `sessionId`)
- Mobile applications

## 4. Primary User & Use Case

**Primary user:** An AI Cohort graduate who opens the app, is (in the MVP) associated with one candidate profile from `candidates.json`, and goes through a single interview session end-to-end in one sitting.

**Core use case:** Candidate starts an interview → agent asks curriculum-grounded questions weighted toward their real progress → candidate answers in a chat-style turn → agent asks smart follow-ups → after enough coverage, agent ends the interview and shows a feedback report.

## 5. Data Inputs (Ground Truth — already provided, do not fabricate schema)

### 5.1 `curriculum.json`
- `cohort`: string label ("AI Cohort · 31 days · 8 modules")
- `modules[]`: `{ n, title, days: [startDay, endDay] }` — 8 modules total:
  1. Environment & Tooling (Days 1–3)
  2. Data Foundations (Days 4–6)
  3. Embeddings & Vector Search (Days 7–10)
  4. LLM Core, Prompting & Fine-Tuning (Days 11–15)
  5. Chatbot Application Build (Days 16–20)
  6. Agentic AI & MCP (Days 21–24)
  7. Evaluation, Security & Deployment (Days 25–28)
  8. Production & Capstone (Days 29–31)
- `days[]`: `{ day, title, type (SETUP|BUILD|CAPSTONE|...), tools[], objectives[] }` — 31 entries, one per day.

### 5.2 `candidates.json`
- `candidates[]`, each with:
  - `member`: `{ id, name, jobRole, yearsExperience, education, status }`
  - `missions[]`: `{ day, title, passed?, attempts?, skipped? }` — a **subset** of the 31 curriculum days actually attempted by that candidate.
  - `signals`: `{ commitDays, missionsCompleted, missionsFirstTry }`

This is the personalization engine's raw material: a candidate who passed "Model Context Protocol (MCP)" (Day 23) on the first try should get a harder MCP question than one who skipped Day 8 (Vector Databases Overview) or needed 5 attempts on it.

### 5.3 `technical-spec.md`
Defines the **required** API contract (see `TRD.md` §2 for the full mirrored spec). The product must not deviate from this contract — the hackathon's automated Stage 1 checks depend on it.

## 6. Functional Requirements (Minimum Requirements from the hackathon brief — all mandatory)

| # | Requirement | Acceptance Criteria |
|---|---|---|
| F1 | Conversational, multi-turn interview | Session progresses via repeated `POST /api/interview` calls using the same `sessionId`; feels like dialogue, not a static form. |
| F2 | ≥ 8 questions, covering ≥ 4 distinct curriculum days | Backend must track which `day` each question maps to and refuse to end the interview until both thresholds are met. |
| F3 | Follow-up questions generated from prior answers | At least some questions must reference or probe the candidate's immediately preceding response (not just move to the next scripted topic). |
| F4 | Context maintained throughout | Full conversation history + topic coverage state persisted per `sessionId` for the session's lifetime (in-memory is acceptable per Out-of-Scope: no persistence required). |
| F5 | Structured feedback at the end | Final response includes `summary` (string), `strengths` (string[]), `gaps` (string[]), `next` (string[]) — each concise and actionable, referencing actual curriculum days discussed. |
| F6 | Required HTTP endpoint | Single `POST /api/interview` endpoint implementing all three flow states (start / turn / end) exactly as in `technical-spec.md`. |

## 7. Personalization Logic (Product-level rules, engineered further in `TRD.md`)

The interview question plan must be derived, not hardcoded, from the candidate's data:

- **Prioritize weak signals** — days that are `skipped`, `passed: false`, or have high `attempts` (≥3) are strong candidates for interview questions (probe understanding gaps directly).
- **Validate strong signals** — days passed on `attempts: 1` are candidates for harder, "why did you choose X over Y" style questions (validate depth, not just completion).
- **Spread across modules** — the ≥4 distinct days required by F2 should, where possible, span different modules (e.g., not four days all from "Agentic AI & MCP") to test breadth.
- **Respect role and experience** — `jobRole` and `yearsExperience` may modulate tone/difficulty (e.g., a "DevOps Engineer" candidate can be asked to go deeper on Day 28 "Docker & Kubernetes Deployment").
- **Capstone anchor** — Day 31 "Capstone Project & Final Demo" is present for nearly every candidate; it's a strong anchor question ("walk me through your capstone architecture") that naturally invites follow-ups into whichever underlying days the candidate discusses.

## 8. Feedback Requirements

The end-of-interview feedback must be **grounded in what was actually discussed in that session** — not generic. Each `gaps` and `strengths` entry should be traceable to a specific curriculum day/topic covered during the interview. `next` should be concrete, actionable study/practice suggestions (e.g., "Revisit Day 8: Vector Databases Overview — specifically indexing strategies," not "study more").

## 9. Success Metrics (for hackathon judging, not runtime analytics)

- Judges can run a live demo end-to-end for a sample candidate and see personalization take effect (different candidates → visibly different question sets).
- The transcript reads like a real interview (natural phrasing, follow-ups reference prior answers).
- Feedback is specific and traceable to curriculum days, not boilerplate.
- Full compliance with `technical-spec.md`'s contract (verified via a quick `curl`/Postman pass).

## 10. Hackathon Compliance Requirements (Product-level, mirrored in detail in `Security.md`)

- Repository must be public and cloneable.
- A live, reachable demo URL (Vercel/Netlify/Render/etc.) — no README-only submissions.
- A `PROMPTS.md` (AI Usage Log) must exist in the repo root and **honestly reflect the actual prompts used** to build the project — this is required for Stage 2 Authenticity Review. The IDE agent must keep this file updated as it works, not generate it retroactively as a summary.
- Commit history should show incremental development (many small commits over the build session), not one large final commit — this directly affects Stage 2 authenticity scoring.

## 11. Open Product Decisions Left to the Build Team (document your choice in code comments or README)

- Which LLM provider/model powers the interviewer (any is allowed per the brief).
- Whether candidate selection (for the MVP demo) happens via a dropdown of the 20 seeded candidates or a `candidateId` query param — either is acceptable since auth is out of scope.
- Exact question-count ceiling (minimum is 8; a reasonable max, e.g., 10–14, avoids runaway interviews).
