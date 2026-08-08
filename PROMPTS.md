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

