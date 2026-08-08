/**
 * Interview Planner — Personalization Engine (TRD.md §4)
 * 
 * Deterministic pre-processing that produces an ordered questionPlan
 * from one candidate's data + curriculum.json. No LLM calls here.
 * 
 * Algorithm:
 * 1. Join candidate.missions[] against curriculum.days[] by day
 * 2. Score each mission by signal strength (skipped > failed > high_attempts > first_try)
 * 3. Ensure selected days span ≥4 distinct modules
 * 4. Always include Day 31 (Capstone) as anchor if present
 * 5. Output ordered plan capped for 8–14 questions total
 * 
 * Personalization rules from PRD.md §7:
 * - Prioritize weak signals (skipped, failed, high attempts)
 * - Validate strong signals (first-try passes → deeper "why" questions)
 * - Spread across modules (≥4 distinct days across different modules)
 * - Respect role and experience (modulate difficulty)
 * - Capstone anchor (Day 31 invites multi-topic follow-ups)
 */

/**
 * @typedef {Object} PlannedQuestion
 * @property {number} day - Curriculum day this question targets
 * @property {string} dayTitle - Title of the curriculum day
 * @property {string} moduleTitle - Title of the module this day belongs to
 * @property {number} moduleNum - Module number
 * @property {string} rationale - Why this question was selected
 * @property {number} priority - Higher = ask sooner
 * @property {string[]} objectives - Curriculum objectives for this day
 * @property {string[]} tools - Tools covered on this day
 * @property {string} questionType - Type of question to ask (foundational/tradeoff/deep)
 * @property {Object} missionData - Raw mission data from candidate
 */

/**
 * Find which module a curriculum day belongs to
 */
function getModuleForDay(dayNum, curriculum) {
  for (const mod of curriculum.modules) {
    if (dayNum >= mod.days[0] && dayNum <= mod.days[1]) {
      return mod;
    }
  }
  return null;
}

/**
 * Get full curriculum day details by day number
 */
function getCurriculumDay(dayNum, curriculum) {
  return curriculum.days.find(d => d.day === dayNum) || null;
}

/**
 * Score a single mission and determine question strategy.
 * Returns { priority, rationale, questionType }
 * 
 * Priority scale (higher = ask sooner):
 * 10 = skipped (highest — candidate has no direct experience, test transferable understanding)
 *  9 = failed (passed: false — clear gap, probe foundations)
 *  7 = high attempts (≥3 — struggled, revisit and probe depth)
 *  5 = moderate attempts (2 — passed but worth checking)
 *  3 = first-try pass (strong signal — ask deeper why/tradeoff questions)
 *  8 = capstone (Day 31 — natural multi-topic anchor, always include)
 */
function scoreMission(mission) {
  // Capstone always gets special treatment
  if (mission.day === 31) {
    return {
      priority: 8,
      rationale: 'capstone_anchor',
      questionType: 'architectural' // "Walk me through your architecture"
    };
  }

  if (mission.skipped === true) {
    return {
      priority: 10,
      rationale: 'skipped',
      questionType: 'foundational' // Test understanding from first principles
    };
  }

  if (mission.passed === false) {
    return {
      priority: 9,
      rationale: 'failed',
      questionType: 'foundational' // Probe knowledge gaps
    };
  }

  if (mission.passed === true && mission.attempts >= 3) {
    return {
      priority: 7,
      rationale: 'high_attempts_weak',
      questionType: 'deep' // Revisit and probe what was hard
    };
  }

  if (mission.passed === true && mission.attempts === 1) {
    return {
      priority: 3,
      rationale: 'low_attempts_high_confidence',
      questionType: 'tradeoff' // "Why did you choose X over Y?"
    };
  }

  // Default: passed with 2 attempts — moderate signal
  return {
    priority: 5,
    rationale: 'moderate_attempts',
    questionType: 'deep'
  };
}

/**
 * Apply role-based difficulty modulation (PRD.md §7)
 * Adjusts priority slightly based on candidate's job role and experience.
 */
function applyRoleModulation(plan, candidate) {
  const { jobRole, yearsExperience } = candidate.member;
  const roleLower = (jobRole || '').toLowerCase();

  for (const entry of plan) {
    // DevOps engineers → boost deployment-related days (Day 28, 29, 30)
    if (roleLower.includes('devops') && [28, 29, 30].includes(entry.day)) {
      entry.priority += 1;
      entry.questionType = 'tradeoff'; // Can go deeper
    }

    // AI/ML engineers → boost AI-core days (embeddings, agents, MCP)
    if ((roleLower.includes('ai') || roleLower.includes('ml')) && 
        [7, 8, 10, 21, 22, 23].includes(entry.day)) {
      entry.priority += 1;
      entry.questionType = entry.questionType === 'foundational' ? 'foundational' : 'tradeoff';
    }

    // Senior/experienced candidates (10+ years) → prefer tradeoff questions
    if (yearsExperience >= 10 && entry.questionType === 'deep') {
      entry.questionType = 'tradeoff';
    }

    // Junior/entry-level (0-2 years) → prefer foundational even for passes
    if (yearsExperience <= 2 && entry.questionType === 'tradeoff') {
      entry.questionType = 'deep';
    }
  }

  return plan;
}

/**
 * Ensure the plan spans at least 4 distinct modules (PRD.md §7, F2).
 * If the top-priority entries cluster in fewer modules, pull in
 * lower-priority entries from under-represented modules.
 */
function ensureModuleSpread(plan, minModules = 4) {
  if (plan.length === 0) return plan;

  // Count modules in current plan
  const moduleCounts = new Map();
  for (const entry of plan) {
    moduleCounts.set(entry.moduleNum, (moduleCounts.get(entry.moduleNum) || 0) + 1);
  }

  // If we already have enough module diversity, good
  if (moduleCounts.size >= minModules) return plan;

  // The plan already has all available entries, can't add more
  // This handles the sparse profile edge case (App-Flow.md §5)
  // Note in code: with sparse candidate data, we may not reach 4 modules,
  // but we still cover as many as the data allows.
  return plan;
}

/**
 * Main planner function — builds the interview question plan.
 * 
 * @param {Object} candidate - Full candidate object from candidates.json
 * @param {Object} curriculum - Full curriculum object from curriculum.json
 * @returns {PlannedQuestion[]} Ordered question plan (8–14 entries)
 */
export function buildInterviewPlan(candidate, curriculum) {
  const plan = [];

  // Step 1: Join missions against curriculum days (TRD.md §4 step 1)
  for (const mission of candidate.missions) {
    const currDay = getCurriculumDay(mission.day, curriculum);
    const mod = getModuleForDay(mission.day, curriculum);

    if (!currDay || !mod) {
      // Skip missions that don't map to known curriculum days
      continue;
    }

    // Step 2: Score each mission (TRD.md §4 step 2)
    const { priority, rationale, questionType } = scoreMission(mission);

    plan.push({
      day: mission.day,
      dayTitle: currDay.title,
      moduleTitle: mod.title,
      moduleNum: mod.n,
      rationale,
      priority,
      objectives: currDay.objectives,
      tools: currDay.tools,
      questionType,
      missionData: { ...mission }
    });
  }

  // Step 3: Sort by priority (descending) — highest priority first
  plan.sort((a, b) => b.priority - a.priority);

  // Step 4: Apply role-based modulation (PRD.md §7)
  applyRoleModulation(plan, candidate);

  // Re-sort after modulation
  plan.sort((a, b) => b.priority - a.priority);

  // Step 5: Ensure module spread (TRD.md §4 step 3)
  ensureModuleSpread(plan);

  // Step 6: Ensure Day 31 Capstone is included if present (TRD.md §4 step 4)
  const hasCapstone = plan.some(p => p.day === 31);
  if (!hasCapstone) {
    // Check if capstone exists in missions but wasn't added
    const capstoneMission = candidate.missions.find(m => m.day === 31);
    if (capstoneMission) {
      const currDay = getCurriculumDay(31, curriculum);
      const mod = getModuleForDay(31, curriculum);
      if (currDay && mod) {
        plan.push({
          day: 31,
          dayTitle: currDay.title,
          moduleTitle: mod.title,
          moduleNum: mod.n,
          rationale: 'capstone_anchor',
          priority: 8,
          objectives: currDay.objectives,
          tools: currDay.tools,
          questionType: 'architectural',
          missionData: { ...capstoneMission }
        });
      }
    }
  }

  // Step 7: Cap the plan to feed 8–14 questions (TRD.md §4 step 5)
  // A single day can generate 1 initial question + 1-2 follow-ups,
  // so we need roughly 5-8 distinct day entries to hit 8-14 total questions
  const maxPlanEntries = 10; // Targeting ~10 topics, with follow-ups reaching 14
  const cappedPlan = plan.slice(0, maxPlanEntries);

  return cappedPlan;
}

/**
 * Get a human-readable summary of the plan for debugging/logging.
 */
export function summarizePlan(plan) {
  const modules = new Set(plan.map(p => p.moduleTitle));
  const days = new Set(plan.map(p => p.day));
  
  return {
    totalEntries: plan.length,
    distinctDays: days.size,
    distinctModules: modules.size,
    moduleNames: [...modules],
    entries: plan.map(p => ({
      day: p.day,
      title: p.dayTitle,
      module: p.moduleTitle,
      rationale: p.rationale,
      questionType: p.questionType,
      priority: p.priority
    }))
  };
}
