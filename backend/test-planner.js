/**
 * Test script for the Interview Planner — verify personalization works
 * Run: node test-planner.js
 */

import { buildInterviewPlan, summarizePlan } from './planner.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
const curriculum = JSON.parse(readFileSync(join(dataDir, 'curriculum.json'), 'utf-8'));
const candidatesData = JSON.parse(readFileSync(join(dataDir, 'candidates.json'), 'utf-8'));

function testCandidate(candidateId) {
  const candidate = candidatesData.candidates.find(c => c.member.id === candidateId);
  if (!candidate) {
    console.error(`Candidate ${candidateId} not found`);
    return;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`CANDIDATE: ${candidate.member.name} (${candidate.member.jobRole}, ${candidate.member.yearsExperience}yr exp)`);
  console.log(`${'='.repeat(60)}`);

  const plan = buildInterviewPlan(candidate, curriculum);
  const summary = summarizePlan(plan);

  console.log(`\nPlan: ${summary.totalEntries} entries, ${summary.distinctDays} distinct days, ${summary.distinctModules} distinct modules`);
  console.log(`Modules covered: ${summary.moduleNames.join(', ')}`);
  console.log(`\nQuestion Order:`);
  
  for (let i = 0; i < summary.entries.length; i++) {
    const e = summary.entries[i];
    console.log(`  ${i + 1}. Day ${e.day}: ${e.title}`);
    console.log(`     Module: ${e.module} | Rationale: ${e.rationale} | Type: ${e.questionType} | Priority: ${e.priority}`);
  }
}

// Test Case 1: Sarah Johnson — should surface Day 29 (skipped) prominently
console.log('\n🧪 TEST 1: Sarah Johnson should have Day 29 (Monitoring, Logging) as high priority (skipped)');
testCandidate('CAND-001');

// Test Case 2: Emily Chen — nearly all first-try, should lean toward "why" questions
console.log('\n🧪 TEST 2: Emily Chen should have mostly tradeoff/deep "why" questions (all first-try passes)');
testCandidate('CAND-003');

// Test Case 3: Gerald Combs — multiple failures, should have foundational questions
console.log('\n🧪 TEST 3: Gerald Combs should have foundational questions for failed days (8, 10, 22)');
testCandidate('CAND-010');

// Test Case 4: Michael Brown (DevOps) — should boost deployment days
console.log('\n🧪 TEST 4: Michael Brown (DevOps, 10yr) — deployment days should get priority boost');
testCandidate('CAND-005');

// Test Case 5: Mia Alvarez — many skipped, should have lots of foundational questions
console.log('\n🧪 TEST 5: Mia Alvarez — 5 skipped missions, should have highest-priority foundational questions');
testCandidate('CAND-011');

console.log('\n✅ All planner tests completed. Verify output above for correctness.');
