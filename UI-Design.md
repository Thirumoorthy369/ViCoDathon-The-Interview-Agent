# UI-Design.md — AI Interview Agent
### UI / Visual Design Specification

> **Instruction to the IDE coding agent:** Build a focused, single-purpose chat interface. Do not over-build screens beyond what's listed here — the hackathon rewards a working, polished MVP over broad but shallow scope. This app is judged live, so first impressions and clarity matter as much as functionality.

---

## 1. Design Principles

1. **Feels like a real interview, not a form.** Chat-first, conversational, minimal chrome.
2. **Calm, professional, focus-mode aesthetic.** Interviews are slightly high-stakes emotionally for the candidate — avoid playful/gamified visuals (no confetti, no game-show styling).
3. **Personalization should be visible, not just felt.** The candidate's name, role, and a lightweight progress indicator make the personalization tangible to judges watching a demo.
4. **No dead ends.** Every screen has an obvious next action.

## 2. Screens / Views

### 2.1 Landing / Candidate Select Screen
- Purpose: since there's no auth, this is where a candidate (or a judge, during demo) picks who is interviewing.
- Contents:
  - App name/title ("AI Interview Agent" or a chosen product name) + one-line tagline ("Build the interviewer, not the interview.").
  - A searchable/selectable list or dropdown of the 20 candidates from `candidates.json`, showing `name`, `jobRole`, `yearsExperience`.
  - A "Start Interview" primary button, disabled until a candidate is selected.
- This screen generates a new `sessionId` (client-side UUID) and fires the Start request from `technical-spec.md` §1 on click.

### 2.2 Interview (Chat) Screen — the core screen
- Layout: single-column chat transcript, input box pinned to the bottom (standard chat UX — familiar to any candidate).
- Header bar (persistent, subtle):
  - Candidate name + role (small, left-aligned).
  - A lightweight **progress indicator**: e.g., "Question 3 of ~10" or a dot/segment tracker for topics covered — helps judges see the ≥8 question / ≥4 day requirement being satisfied live without exposing raw JSON.
- Message bubbles:
  - Interviewer messages: left-aligned, distinct background, labeled "Interviewer".
  - Candidate messages: right-aligned, distinct background/accent color, labeled with candidate's first name.
  - Typing/thinking indicator while waiting for the next `reply` (three-dot pulse or similar).
- Input area: multi-line-capable textarea + Send button; Enter-to-send with Shift+Enter for newline is a good default.
- No visible mention of `sessionId`, `done`, or raw JSON — those are protocol details, not UI.

### 2.3 Feedback / Results Screen
- Triggered automatically when a response arrives with `done: true`.
- Contents, in this order:
  1. A clear "Interview Complete" state (checkmark or similar, understated — not celebratory).
  2. `summary` — shown as a short paragraph, prominent.
  3. `strengths` — rendered as a bulleted list under a "Strengths" heading, positive-toned visual accent (e.g., green marker).
  4. `gaps` — rendered as a bulleted list under a "Areas to Improve" heading, neutral/amber accent (never red/alarming — this is coaching, not a failing grade).
  5. `next` — rendered as a bulleted, action-oriented list under "Recommended Next Steps".
  6. A "Start New Interview" button that returns to the Landing screen with a fresh `sessionId`.
- Optional (nice-to-have, not required): a small chip/tag row showing which curriculum days were covered in this session, reusing `day`/`title` data.

## 3. Visual Language

### 3.1 Brand Color — Explicit Direction (do not deviate)

**Do not use purple, indigo, or blue-to-purple gradients as the primary/brand color.** That palette is the default, overused "AI product" look (nearly every LLM-wrapper app defaults to it), and it works against this product's whole premise — this is a *human* interview experience personalized to one candidate's real journey, not a generic chatbot skin. The color choice should feel confident, warm, and professional, like a real interviewer's presence, not a sci-fi assistant.

**Chosen primary/brand color: a deep, warm amber/terracotta.**

- **Primary**: `#C2540A` (burnt amber / terracotta) — used for primary buttons, active states, the candidate's own chat bubble accent, progress indicator fill, and links.
- **Primary hover/pressed**: `#A6440A` (slightly deeper).
- **Primary tint (light backgrounds, e.g. selected candidate card, subtle highlights)**: `#FDEEE0`.
- **Neutrals** (structure, text, borders): a warm-leaning gray scale rather than a cold blue-gray, so it harmonizes with the amber instead of fighting it:
  - Background: `#FAF8F5` (warm off-white, light mode default)
  - Surface/card: `#FFFFFF`
  - Border/divider: `#E8E2DA`
  - Body text: `#2B2622`
  - Muted/secondary text: `#7A7169`
- **Semantic accents (feedback screen only, used sparingly — text/icon color, not full backgrounds)**:
  - Strengths: `#2E7D4F` (muted forest green)
  - Gaps / areas to improve: the primary amber `#C2540A` itself (keeps it coaching-toned, not alarming; avoid red entirely — this is not a failing grade)
  - Neutral info: `#7A7169`
- **Rationale to preserve in code/design tokens**: amber/terracotta reads as warm, direct, and human — closer to "a good interviewer's energy" — and is visually distinct from the sea of blue/purple AI-chat products a judge will have already seen that day. Keep it as the *single* dominant brand hue; do not introduce a second competing bright accent color elsewhere in the UI.
- Implement as design tokens/CSS variables (e.g., `--color-primary`, `--color-primary-hover`, `--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-success`, `--color-attention`) so the palette is defined once and reused everywhere — never hardcode hex values inline in components.

### 3.2 Typography & Spacing

- **Typography**: one clean sans-serif (e.g., Inter, system-ui stack). Clear hierarchy: candidate/interviewer labels small and muted, message text normal weight, headings on the feedback screen bolder.
- **Spacing**: generous whitespace in the chat transcript; avoid cramped bubbles.
- **Motion**: minimal — a subtle fade/slide-in for new messages and the typing indicator is enough. No heavy animation.

## 4. Responsive Design Requirements (mandatory — all device classes)

The product brief lists mobile *apps* as out of scope, but that only excludes a native app — the **website itself must be fully responsive** and usable on any device via its browser (phone, tablet, laptop, desktop, and shared/projector displays for live judging). Build mobile-first or with a mobile-inclusive breakpoint strategy from the start; do not treat responsiveness as a late polish pass.

### 4.1 Required Breakpoints (minimum set — adjust exact px as the chosen CSS framework prefers, but cover these device classes)

| Class | Approx. width | Key layout behavior |
|---|---|---|
| Small mobile | 360–479px | Single column throughout; chat bubbles use ~85–90% width; header collapses candidate name/role onto one compact line; progress indicator becomes a slim bar instead of a dotted tracker; input box and Send button stack full-width. |
| Large mobile | 480–767px | Same single-column structure as small mobile with slightly more breathing room; touch targets (buttons, Send, candidate list rows) minimum 44×44px tap area. |
| Tablet | 768–1023px | Chat column can cap at a comfortable reading width (e.g., ~600–680px) and center itself rather than stretching edge-to-edge; landing screen's candidate list can move to a 2-column grid. |
| Small laptop | 1024–1279px | Chat column remains centered/capped; feedback screen's strengths/gaps/next lists can sit in a 2-column layout if content allows. |
| Desktop / shared display | 1280px+ | Full layout as designed in §2; content column stays capped (do not stretch chat bubbles or feedback text edge-to-edge on ultra-wide screens — cap at ~720–840px and center, for readability during live demo/judging). |

### 4.2 Cross-Cutting Responsive Rules

- **Fluid typography**: base font size should scale modestly between smallest and largest breakpoints (e.g., via `clamp()`) rather than jumping abruptly.
- **Touch-first on small/large mobile**: all interactive elements (candidate selection rows, Send button, "Start New Interview") must meet a minimum 44×44px touch target.
- **No horizontal scrolling at any breakpoint** — this is a hard requirement, not a nice-to-have. Test explicitly at 360px width (smallest common phone) before submission.
- **Chat input behavior on mobile**: the input area must remain reachable when the on-screen keyboard is open (avoid fixed-height layouts that push the Send button off-screen).
- **Progress indicator adapts**: the "Question X of ~N" / topic tracker from §2.2 should degrade gracefully to a simple slim progress bar on narrow screens rather than being hidden or broken.
- **Images/icons**: use scalable (SVG) icons only, no fixed-pixel raster assets that blur or overflow at different densities.
- **Testing checklist addition**: verify all three screens (Landing, Interview Chat, Feedback) at minimum at 360px, 768px, 1024px, and 1440px widths before submission — add this to `Implementation.md`'s pre-submission testing checklist.

## 5. States to Handle Explicitly

- **Loading state** while waiting for a reply (don't let the input feel unresponsive).
- **Error state** if the backend call fails (e.g., "Something went wrong — try again" with a retry action, not a raw stack trace).
- **Empty candidate list** (defensive, unlikely given bundled data, but avoid a blank screen).
- **Long candidate answers** — textarea and chat bubbles should scroll/wrap gracefully, not truncate silently.

## 6. Accessibility Baseline

- Sufficient color contrast for text on all backgrounds — verify the amber primary (`#C2540A`) against both white/light surfaces and its own tint (`#FDEEE0`) meets WCAG AA for text/interactive elements; use the darker `#A6440A` where contrast on light backgrounds is borderline.
- Chat input reachable and submittable via keyboard alone.
- Semantic HTML (proper heading levels, `<button>` not `<div onClick>`) where the chosen frontend stack allows it.
- Touch targets meet the 44×44px minimum described in §4.2 for anyone using assistive pointer devices, not just mobile.

## 7. Explicitly Out of Scope for UI

- Login/signup screens (no auth).
- Candidate history / past interviews list (no persistence).
- Settings/preferences screens.
- Voice input/output UI.
- Native mobile apps — a responsive **website** is required (§4); a packaged native app is not.
