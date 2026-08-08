# PROMPTS.md — AI Usage Log

This log records every meaningful AI prompt used to plan and build the AI Interview Agent, in chronological order, across both **Claude** (planning/spec docs) and **Google Antigravity** (implementation). It exists to satisfy the hackathon's Stage 1 (must be present) and Stage 2 (must genuinely correspond to what was built) requirements.

---

## Phase 1 — Planning & Specification (Claude)

### 2026-08-08 09:15 AM — Claude — Generate initial spec suite
**Prompt:** Analyze the AI Interview Agent hackathon idea, curriculum.json, candidates.json, and technical-spec.md; produce PRD.md, TRD.md, UI-Design.md, App-Flow.md, Security.md, and Implementation.md as prompt files to drive an IDE coding agent, compliant with the hackathon rules.
**Result:** Six markdown specification documents created, grounded in the curriculum (31 days/8 modules), candidate schema, and API contract.
**Files touched:** PRD.md, TRD.md, UI-Design.md, App-Flow.md, Security.md, Implementation.md

### 2026-08-08 09:30 AM — Claude — Refine UI color and responsiveness
**Prompt:** Update UI-Design.md so the brand color is not the typical AI purple/blue, chosen deliberately as one attractive suitable color, and add full responsive design requirements across all device types.
**Result:** Added (amber/terracotta brand palette with rationale) and  (breakpoint table + responsive rules) to UI-Design.md; added matching checklist items to Implementation.md.
**Files touched:** UI-Design.md, Implementation.md

---

## Phase 2 — Implementation (Google Antigravity)

### 2026-08-08 10:10 AM — Antigravity — Project Scaffolding
**Prompt:** Read PRD.md, TRD.md, App-Flow.md, UI-Design.md, and Security.md in full before writing any code — they define the product, architecture, API contract, visual design, and compliance requirements. Then follow Implementation.md step by step. Commit to git after each numbered step in Implementation.md, not after every small change — I need incremental commit history for hackathon authenticity review.
**Result:** Created the backend/frontend folder scaffolds, initialized package.json files, added standard npm dependencies (Express, Cors, Dotenv, OpenAI SDK), created .gitignore and configured port listeners.
**Files touched:** backend/package.json, backend/server.js, frontend/package.json, .gitignore, backend/.env.example

### 2026-08-08 10:35 AM — Antigravity — Interview planner (personalization engine)
**Prompt:** Read curriculum.json and candidates.json. Implement the deterministic candidate scoring logic and plan generator from TRD.md §4. Support skipped, failed, attempts count, and capstone anchor. Add role-based modulation boosting relevant days.
**Result:** Wrote the core scoring logic inside planner.js and created a dry-run planner script backend/test-planner.js to verify personalization plans for Sarah Johnson, Emily Chen, Gerald Combs, Michael Brown, and Mia Alvarez.
**Files touched:** backend/planner.js, backend/test-planner.js

### 2026-08-08 10:55 AM — Antigravity — API skeleton and session store
**Prompt:** Implement the POST /api/interview endpoint matching technical-spec.md §2 exactly. Maintain session state in-memory, validate requests, handle unknown sessions, and set up automatic TTL cleanups.
**Result:** Built the Express.js route with full validation schemas (checking sessionId types, candidacy profile mappings, message text constraints) and a 30-minute interval cache cleaner.
**Files touched:** backend/server.js

### 2026-08-08 11:15 AM — Antigravity — LLM orchestration for turns
**Prompt:** Implement the Groq LLM integration inside groq.js. Construct the conversational system prompt with all 10 interviewer rules from App-Flow.md §3, and implement the dialogue turn handler.
**Result:** Created groq.js. Built the system prompt containing interviewer persona constraints (conciseness, natural transitions, one question at a time, quote candidate details, adjust difficulty) and wired the chat completions route to llama-3.3-70b-versatile.
**Files touched:** backend/groq.js

### 2026-08-08 11:35 AM — Antigravity — Completion logic and structured feedback
**Prompt:** Add the interview conclusion logic when question count and days count are met. Generate structured JSON feedback containing summary, strengths, gaps, and next. Implement the schema check and a retry-once parsing loop.
**Result:** Added response_format: { type: "json_object" } evaluation logic in groq.js. Integrated standard json validation schema checking, corrective retry on syntax failures, and final session wrap-up handling.
**Files touched:** backend/groq.js, backend/server.js

### 2026-08-08 11:55 AM — Antigravity — Frontend: landing/candidate select
**Prompt:** Build the landing page from UI-Design.md §2.1. Expose the candidate selection list, searchable by name/role, and add the Start Interview button.
**Result:** Created LandingScreen component, loaded candidate lists via backend api call, wired the search filtering logic, and configured candidate ID selection callbacks.
**Files touched:** frontend/src/components/LandingScreen.jsx, frontend/src/components/LandingScreen.css, frontend/src/App.jsx

### 2026-08-08 12:15 PM — Antigravity — Frontend: interview chat screen
**Prompt:** Build the Interview chat screen from UI-Design.md §2.2. Integrate scroll-to-bottom, auto-growing textarea, typing indicators, and connect candidate message turns to backend.
**Result:** Built InterviewScreen component. Exposed left-aligned interviewer bubbles, right-aligned candidate bubbles, progress bar fills, typing dots animation, and text input handles.
**Files touched:** frontend/src/components/InterviewScreen.jsx, frontend/src/components/InterviewScreen.css

### 2026-08-08 12:35 PM — Antigravity — Frontend: feedback screen
**Prompt:** Build the Feedback screen from UI-Design.md §2.3. Display the summary paragraph, strengths, gaps, and recommended next steps cards with appropriate color highlights.
**Result:** Created FeedbackScreen component displaying complete review cards (green strengths, amber gaps, brand-accented study tasks) and the "Start New Interview" refresh button.
**Files touched:** frontend/src/components/FeedbackScreen.jsx, frontend/src/components/FeedbackScreen.css

### 2026-08-08 12:55 PM — Antigravity — Polish pass (visual language, responsive breakpoints)
**Prompt:** Clean up layout styles. Integrate anime.js 3.2.2. Animate landing card staggers, message bubble scaling/slides on mount, progress bar increments, and SVG path drawing on the feedback checkmark icon.
**Result:** Configured the HSL terracotta colors (#C2540A) and viewport breakpoint layout CSS. Removed conflicting CSS transitions and implemented dynamic animejs timelines inside React life cycle hooks.
**Files touched:** frontend/src/components/LandingScreen.jsx, frontend/src/components/LandingScreen.css, frontend/src/components/InterviewScreen.jsx, frontend/src/components/FeedbackScreen.jsx, frontend/src/components/FeedbackScreen.css, frontend/index.html, frontend/package.json

### 2026-08-08 01:10 PM — Antigravity — Robustness & Deployment fixes
**Prompt:** Improve interview ending state machine to handle sparse candidate profiles and avoid infinite loops. Add followupCount to the session object and use it in groq.js.
**Result:** Handled edge cases where candidates completed less than 4 missions. Wrote a programmatic integration script test-end-to-end.mjs to verify 14-turn ceiling completion.
**Files touched:** backend/server.js, backend/groq.js, backend/package.json, C:\Users\mrthi\.gemini\antigravity-ide\brain\f44d8b0d-291b-46bf-a896-d8ff58a59638\scratch\test-end-to-end.mjs

### 2026-08-08 01:30 PM — Antigravity — Clean Mocks
**Prompt:** so if you created mock type of anything related to AI - please delete it and provide where i need to put my groq apikey (where i need to create .env file)
**Result:** Overwrote groq.js to remove the client-null checking mock response simulation helpers. The orchestrator now calls the OpenAI client directly, prompting for env configuration.
**Files touched:** backend/groq.js

### 2026-08-08 02:00 PM — Antigravity — Redesign UI for Production
**Prompt:** see this and update - UI is not at all good and also it is not fit for production
**Result:** Redesigned LandingScreen.css and LandingScreen.jsx to transition from flat vertical rows to a responsive 3-column glassmorphic candidate profile card grid layout, including visual gradient avatars, stat pills, selected tags, and slow-pulsing background mesh circles.
**Files touched:** frontend/src/components/LandingScreen.jsx, frontend/src/components/LandingScreen.css

### 2026-08-08 02:10 PM — Antigravity — Layout and spacing adjustments
**Prompt:** Just think like a professional web designer and ui ux designer and see that ui If it this ui is fit for this product as it is used for hapatha If it is yes or not make that you at least need and professional look start interview is going under Not like it'll be like a professional day just cheque with the heating everything
**Result:** Fixed the Flexbox viewport cutoff bug by allowing body-level vertical scrolling, centered the search bar to keep horizontal balance on wide monitors, and converted candidate experience descriptions into clean primary-colored tag badges.
**Files touched:** frontend/src/components/LandingScreen.css

