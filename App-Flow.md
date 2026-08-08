# App-Flow.md — AI Interview Agent
### Application & Conversation Flow

> **Instruction to the IDE coding agent:** This document defines both the *screen-to-screen* flow and the *conversational logic* the interviewer LLM must follow turn by turn. Implement the state machine in §2 exactly — it's what guarantees F1–F4 in `PRD.md` §6 are met.

---

## 1. End-to-End User Journey

```
[Landing: select candidate]
        │  (generate sessionId, POST /api/interview {sessionId, candidate})
        ▼
[Interview Screen: opening message shown]  ← reply: "Welcome. Let's begin..."
        │
        │  candidate types answer → POST /api/interview {sessionId, message}
        ▼
[Interview Screen: interviewer reply shown]  ← reply, done:false
        │
        │  ... repeats N times (N >= 8, spanning >= 4 curriculum days) ...
        ▼
[Interview Screen: final turn triggers completion]
        │  reply: "Interview completed.", done:true, feedback:{...}
        ▼
[Feedback Screen: summary / strengths / gaps / next shown]
        │
        │  "Start New Interview"
        ▼
[Landing: select candidate]  (fresh sessionId)
```

## 2. Backend Conversation State Machine

```
STATE: NEW
  on Start request (sessionId, candidate):
    1. Validate candidate object shape.
    2. Run Interview Planner (TRD.md §4) → questionPlan.
    3. Initialize session { transcript: [], askedDays: {}, questionCount: 0, status: in_progress }.
    4. Compose opening reply (fixed friendly welcome + first question, OR
       welcome first and first question as the very next turn — either is
       acceptable, but the Start response body must still match
       technical-spec.md §1 exactly).
    5. Store session. Return { reply, done: false }.
    → transition to IN_PROGRESS

STATE: IN_PROGRESS
  on Turn request (sessionId, message):
    1. Look up session by sessionId. If missing → 4xx error (see TRD.md §6).
    2. Append candidate's message to transcript.
    3. Evaluate last answer quality via LLM/heuristic:
         - shallow/vague/incorrect → generate a FOLLOW-UP on the same
           questionPlan entry (do not advance askedDays yet).
         - sufficiently answered → mark current day as covered
           (askedDays.add(day)), advance to next questionPlan entry,
           generate a NEW question (increment questionCount).
    4. Append interviewer's new message to transcript.
    5. Check completion condition (TRD.md §3):
         if questionCount >= 8 AND askedDays.size >= 4
           AND (planner has no more high-priority topics OR ceiling reached):
             → go to STATE: ENDING
         else:
             → return { reply, done: false }, remain IN_PROGRESS

STATE: ENDING
  on this same Turn request (no extra round trip needed):
    1. Call LLM with full transcript + candidate profile to produce the
       structured feedback object (summary, strengths, gaps, next).
    2. Validate the returned JSON against the schema in technical-spec.md
       (retry once with a corrective prompt if invalid — see
       Implementation.md).
    3. Mark session.status = done.
    4. Return { reply: "Interview completed.", done: true, feedback }.
    → transition to DONE

STATE: DONE
  any further request with this sessionId:
    → return a clear 4xx/409-style error ("This interview has already
      ended.") rather than silently restarting or crashing.
```

## 3. Conversational Behavior Rules (Interviewer Persona)

These rules govern what the system prompt (`TRD.md` §5) must enforce, so the interview *feels* real:

1. **One question at a time.** Never bundle multiple questions in a single `reply`.
2. **Acknowledge before pivoting.** Briefly acknowledge the candidate's previous answer (a sentence, not a paragraph) before asking the next question or follow-up — this is what separates a real interview from a scripted quiz.
3. **Follow-ups must reference specifics.** A follow-up should quote or paraphrase something the candidate actually said, e.g., "You mentioned using cosine similarity for retrieval — why that over dot product for your use case?" — not a generic "Can you elaborate?"
4. **Difficulty adapts to signal.** For a day the candidate passed on `attempts: 1`, ask a trade-off/why-not-alternative question. For a `skipped` or low-pass day, ask a foundational explain-it-to-me question and judge understanding from first principles.
5. **Natural transitions between topics.** When moving from one curriculum day to the next, use a brief bridging sentence ("Let's shift to how you handled deployment...") rather than an abrupt topic jump.
6. **Time-box follow-ups.** No more than ~2 follow-ups per topic before moving on, so the interview doesn't stall on one subject and fails to reach the ≥4-day minimum.
7. **Stay in curriculum scope.** Questions must map to real `curriculum.json` days/objectives/tools — never invent technologies the cohort didn't cover.
8. **Closing tone.** The final "Interview completed." message and the feedback that follows should read as constructive coaching, never as a pass/fail verdict.

## 4. Sequence Diagram (Illustrative Example)

```
Candidate           Frontend                Backend                  LLM
   │                    │                        │                    │
   │ selects candidate  │                        │                    │
   │───────────────────▶│  POST Start            │                    │
   │                    │───────────────────────▶│  build plan        │
   │                    │                        │───────────────────▶│
   │                    │◀───────────────────────│◀───────────────────│
   │◀───────────────────│  reply, done:false     │                    │
   │ types answer #1    │                        │                    │
   │───────────────────▶│  POST Turn             │                    │
   │                    │───────────────────────▶│  eval + next Q     │
   │                    │                        │───────────────────▶│
   │                    │◀───────────────────────│◀───────────────────│
   │◀───────────────────│  reply, done:false     │                    │
   │        ...          repeats ~8-14 times...                       │
   │ types final answer │                        │                    │
   │───────────────────▶│  POST Turn             │                    │
   │                    │───────────────────────▶│  completion check  │
   │                    │                        │  → generate         │
   │                    │                        │    feedback JSON    │
   │                    │                        │───────────────────▶│
   │                    │◀───────────────────────│◀───────────────────│
   │◀───────────────────│  done:true, feedback   │                    │
   │  sees Feedback UI  │                        │                    │
```

## 5. Edge Cases the Flow Must Handle

- Candidate gives a one-word/empty answer → interviewer should gently prompt for elaboration rather than immediately advancing (counts as a follow-up, not a new question).
- Candidate's `missions[]` has fewer than 4 usable days (rare, sparse profile) → planner falls back to asking about curriculum objectives generally for under-covered modules, still respecting the ≥4-day / ≥8-question minimum using curriculum context even where mission-level signal is thin.
- Network/LLM failure mid-turn → return an error response the frontend can show without losing the transcript already rendered client-side.
- Candidate reloads the page mid-interview → since there's no persistence requirement, it's acceptable for the frontend to keep transcript in local component state; document this limitation rather than over-engineering persistence that's out of scope.
