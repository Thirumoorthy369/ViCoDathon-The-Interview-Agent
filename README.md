# ViCoDathon — The AI Interview Agent 🎤

> **"Build the interviewer, not the interview."**

[![AI Usage Log](https://img.shields.io/badge/AI_Usage_Log-PROMPTS.md-blue?style=for-the-badge&logo=gitbook&logoColor=white)](./PROMPTS.md)
[![Vercel Deployment](https://img.shields.io/badge/Frontend-Deployed_on_Vercel-black?style=for-the-badge&logo=vercel&logoColor=white)](https://vicodathon-the-interview-agent.vercel.app/)
[![Railway Backend](https://img.shields.io/badge/Backend-Hosted_on_Railway-1e1e24?style=for-the-badge&logo=railway&logoColor=white)](https://vicodathon-the-interview-agent-production.up.railway.app/)
[![AI Model](https://img.shields.io/badge/Model-Llama_3.1_8B_Instant-F26A36?style=for-the-badge&logo=meta&logoColor=white)](https://console.groq.com)

> [!IMPORTANT]
> 📑 **JUDGES QUICK LINK: AI Usage & Prompt Log**
> The required AI Usage Log documenting all prompt sequences, prompts, and results of our AI-assisted developer pairing session is located at:
> 🔗 **[PROMPTS.md](./PROMPTS.md)** (Includes links to PRD, TRD, App-Flow, and all 33 incremental development steps).

An enterprise-grade, AI-powered technical interviewer that conducts realistic, adaptive, multi-turn dialogues tailored to each candidate's learning journey. Built explicitly for the enterprise AI engineering program, it analyzes learning signals (skipped days, struggles, capstone status) to conduct a rigorous and personalized technical assessment.

---

## 🎯 The Product Vision

### 🔍 The Problem
In modern AI engineering cohorts, developers learn to build complex systems (RAG pipelines, Vector databases, Multi-agent orchestrators). However, when transitioning to technical interviews, they face two massive challenges:
1. **Articulating architectural decisions:** Explaining *why* they chose specific tools, similarity metrics, or prompts under pressure.
2. **The Feedback Gap:** Generic mock interviews fail because they don't align with the candidate's individual progress, skipped lessons, or past struggles.

### 💡 The Solution: ViCoDathon - The Interview Agent
ViCoDathon - The Interview Agent acts as an adaptive **Senior Engineering Manager** simulator. It ingests the cohort's 31-day curriculum alongside the candidate's metadata and designs a custom-tailored technical review. 

Instead of generic questions, it drills the candidate on the exact days they skipped or failed, and challenges their first-try passes with advanced system design trade-offs.

---

## 🎭 The Core User Journey

1. **Profile Selection & Assessment Plan:**
   Review candidate profiles in a premium glassmorphic dashboard. Once selected, the personalization planner determines the curriculum gaps (such as a skipped Observability day or multiple attempts on Vector search) and maps a custom questioning path.
2. **Interactive Mock Interview:**
   Conduct a realistic, multi-turn technical conversation. The interviewer adapts dynamically to responses, asking deep, text-anchored follow-ups that reference the candidate's exact words.
3. **Structured Actionable Scorecard:**
   At completion, the agent renders a comprehensive final report detailing key technical strengths, critical knowledge gaps, and direct study guide suggestions linked back to specific curriculum days.

---

## 🔗 Live Application Links

* 🌐 **Live Demo (Frontend):** [https://vicodathon-the-interview-agent.vercel.app/](https://vicodathon-the-interview-agent.vercel.app/)
* ⚡ **API Status (Backend):** [https://vicodathon-the-interview-agent-production.up.railway.app/](https://vicodathon-the-interview-agent-production.up.railway.app/)

---

## 💎 Core Architecture & Features

### 1. The Personalization Engine
Instead of asking static, boilerplate questions, the system reviews candidate metadata at boot and compiles a **prioritized, custom interview plan** containing exactly 8–14 questions across at least 4 curriculum modules:
* 🔴 **Skipped Days (Weight: 10/10):** Probes understanding of critical topics skipped during the cohort.
* 🟡 **Failed Days (Weight: 7/10):** Explores struggles and checks if the developer filled their knowledge gaps.
* 🔵 **Passed First-Try (Weight: 3/10):** Challenges the candidate with advanced architectural trade-off questions.
* 🟢 **Capstone Day 31 (Weight: 8/10):** Automatically included as an anchor for multi-topic system design questions.

### 2. Conversational Turn Adaptation
* **Specific Follow-Ups:** Uses context history to cite and probe the candidate's exact responses (e.g., *"You mentioned using cosine similarity for retrieval — why that over dot product for your use case?"*) instead of dry, generic follow-ups.
* **Smart Concluding Logic:** The interviewer adapts dynamically, deciding whether to dig deeper or advance to the next module. It wraps up the interview exactly at the 8th turn if requirements are met, writing a natural, warm closing statement.

### 3. High-End UI/UX (Terracotta & Glassmorphic Aesthetic)
* **Glassmorphic Grid:** Displays candidates in a responsive, blurred glass grid with colorful status indicators.
* **Floating Status Bar:** A sticky bottom action bar slides up on candidate selection, complete with a pulsing green connection indicator and micro-animations.
* **Auto-Focus Input:** The chat console dynamically shifts keyboard focus to the input textarea on mount and as soon as the interviewer finishes typing, creating a frictionless conversational flow.
* **Page Refresh Immunity:** Powered by React-based `localStorage` state synchronization, active sessions and transcripts survive browser reloads and hard refreshes.

---

## 🛠 Tech Stack

* **Frontend:** React, Vite, CSS (curated Terracotta palette, HSL spacing, Glassmorphic blurs), Anime.js
* **Backend:** Express.js running as a persistent Node process (retaining in-memory sessions)
* **LLM Engine:** Groq SDK (`llama-3.1-8b-instant`) for fast, low-latency conversational turns
* **Session Persistence:** In-memory caching with a 30-minute idle eviction daemon

---

## ⚙️ Environment Configuration

### Backend variables (`backend/.env`)
Create a `.env` file in the `backend/` directory:
```env
GROQ_API_KEY=gsk_your_real_groq_key
FRONTEND_URL=https://vicodathon-the-interview-agent.vercel.app
PORT=3001
```

### Frontend variables (`frontend/.env`)
Create a `.env` file in the `frontend/` directory:
```env
VITE_API_URL=https://vicodathon-the-interview-agent-production.up.railway.app
```

---

## 🏃 Local Quickstart

### 1. Install & Launch Backend
```bash
cd backend
npm install
npm run dev # Runs node --watch server.js on port 3001
```

### 2. Install & Launch Frontend
```bash
cd ../frontend
npm install
npm run dev # Runs Vite dev server on port 5173
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🧡 Acknowledgments

* Built with passion for the **ViCoDathon** Hackathon.
* Special thanks to the Google **Antigravity** developer pairing system.
* Powered by Groq's high-speed **Llama-3.1-8b-instant** and **Llama-3.3-70b-versatile** models.
