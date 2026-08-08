# Security.md — AI Interview Agent
### Security, Privacy & Hackathon-Compliance Requirements

> **Instruction to the IDE coding agent:** This project has no authentication and handles only synthetic data, so security work here is intentionally scoped to (a) sane engineering hygiene, (b) protecting the LLM integration from abuse, and (c) satisfying the hackathon's Stage 1/Stage 2 verification requirements — which are treated as hard compliance gates, not optional polish.

---

## 1. Data Sensitivity

- All data in `candidates.json` and `curriculum.json` is explicitly **synthetic** (per the technical spec's Notes section) and provided solely for this hackathon. No real PII is involved.
- Do not add any data collection, analytics, or third-party tracking beyond what's needed to run the app — there is no product requirement for it, and it adds needless surface area.
- No persistent storage of interview transcripts is required (Out-of-Scope in `PRD.md` §3); keep session data in memory and let it expire naturally with process/server lifecycle.

## 2. API Key & Secret Management

- The Groq API key (`GROQ_API_KEY`) must **never** be committed to the repository, hardcoded in frontend code, or exposed in any client-side bundle.
- Use environment variables (`.env`, excluded via `.gitignore`) on the backend only. The frontend must never call Groq's API directly — all LLM calls go through the backend's `/api/interview` endpoint, which then calls Groq server-side (see `TRD.md` §5).
- Provide a `.env.example` (no real values) in the repo so judges/graders can run the project themselves if needed — at minimum:
  ```
  GROQ_API_KEY=
  ```
- If deploying to Vercel/Netlify/Render, set the key via that platform's secret/environment variable manager, not in code.

## 3. Endpoint Hardening (lightweight, proportionate to scope)

- **Input validation**: validate the shape of incoming request bodies (`sessionId` present and a string; `candidate` object present on Start; `message` present and a reasonable length on Turn calls) before touching the LLM or session store. Reject malformed requests with a clear 4xx, not a 500.
- **Session ID handling**: treat `sessionId` as an opaque identifier only — never use it to construct file paths, database queries, or shell commands (avoids injection classes entirely by design, even though no DB is required here).
- **Rate/size limits**: cap `message` length (e.g., a few thousand characters) before forwarding to the LLM, to avoid pathological cost/latency from a single oversized request.
- **CORS**: restrict allowed origins to the deployed frontend's own origin (and `localhost` during development) rather than leaving it wide open, even though there's no auth to bypass.
- **No authentication required** per the technical spec — do not add a login system; that would be scope creep against the explicit Out-of-Scope list.

## 4. LLM-Specific Safety

- **Prompt injection resilience**: since candidate free-text answers are inserted into LLM calls, do not let candidate input alter the interviewer's system-level instructions. Keep the system prompt and the user-turn content in clearly separated roles (`system` vs `user` messages), and do not string-concatenate candidate text into instruction-bearing parts of the prompt.
- **Output validation**: the final `feedback` object returned by the LLM must be parsed and schema-validated server-side (matching `summary: string`, `strengths: string[]`, `gaps: string[]`, `next: string[]`) before being sent to the client. If parsing fails, retry once with a corrective instruction rather than forwarding malformed JSON or raw text to the frontend.
- **Scope containment**: system prompt should instruct the model to stay within the interview's purpose (technical interviewing grounded in the provided curriculum) and to decline gracefully if a candidate tries to redirect it into unrelated tasks.

## 5. Hackathon-Specific Compliance Requirements (treat as release gates)

These map directly to the rubric in the hackathon rules and must be verified before submission:

| Requirement | Where it's verified | What the coding agent must do |
|---|---|---|
| Public, cloneable repository | Stage 1 (automatic) | Ensure repo visibility is public before submission; no required files should be gitignored (verify `.env` is ignored but `.env.example` is committed). |
| Live Demo URL functional | Stage 1 (automatic) | Deploy the full stack (frontend + backend) to a reachable host; confirm `POST /api/interview` works against the live URL, not just localhost, before submitting. |
| AI Usage Log (`PROMPTS.md`) present and accessible | Stage 1 (automatic) + Stage 2 (manual authenticity review) | Maintain `PROMPTS.md` at the repo root **throughout the build**, logging real prompts used, in chronological order. This must correspond to actually-implemented features — do not fabricate or backfill a generic log after the fact; Stage 2 explicitly flags logs that don't match implemented features. |
| Belongs to a registered team, submitted before deadline | Submission process | Non-technical, but confirm before final push. |
| Repository not pre-existing / no imported codebase | Stage 2 (authenticity) | Initialize the repo fresh for this hackathon; do not scaffold from a pre-built private template that predates kickoff. |
| Commit history shows real incremental work | Stage 2 (authenticity) | Commit incrementally as features are built (e.g., after scaffolding, after the planner, after the LLM orchestration, after the UI, after feedback rendering) rather than a single "final" commit — this is explicitly called out as a red flag. |

## 6. Recommended `.gitignore` Baseline

```
node_modules/
.env
.env.local
__pycache__/
*.pyc
dist/
build/
.DS_Store
```

## 7. Explicitly Out of Scope for Security

- User authentication/authorization (no accounts exist).
- Encryption at rest for candidate data (no persistence layer exists).
- GDPR/compliance tooling (synthetic hackathon data only).
- Rate limiting infrastructure beyond basic input-size guards (no real-world traffic/abuse concern for a hackathon demo).
