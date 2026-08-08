/**
 * Groq LLM Orchestrator (TRD.md §5)
 * 
 * Handles all LLM interactions via Groq's OpenAI-compatible API.
 * Uses llama-3.1-8b-instant as the default free-tier model.
 * 
 * Two main functions:
 * 1. generateInterviewReply() — per-turn question/follow-up generation
 * 2. generateFeedback() — structured feedback at interview end
 * 
 * System prompt construction follows TRD.md §5.4 and App-Flow.md §3.
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Groq client via OpenAI SDK (TRD.md §5.2)
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || 'placeholder_key_to_prevent_boot_crash',
  baseURL: 'https://api.groq.com/openai/v1',
});

// Resilient fallback models loop for hackathon durability (Llama 3.1 8B -> Qwen 3.6 27B -> Llama 3.3 70B -> GPT-OSS 20B)
const MODELS = [
  'llama-3.1-8b-instant',
  'qwen/qwen3.6-27b',
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-20b'
];

/**
 * Helper to call Groq API with robust model fallback failover (TRD.md §5.5)
 */
async function callGroqWithFallback(options) {
  let lastError;
  for (const model of MODELS) {
    try {
      console.log(`[LLM] Attempting API call using model: ${model}`);
      const response = await client.chat.completions.create({
        ...options,
        model: model
      });
      console.log(`[LLM] Successfully completed call using: ${model}`);
      return response;
    } catch (err) {
      console.error(`[LLM] Error with model ${model}:`, err.message);
      lastError = err;
      
      // Do not retry on 401 Authentication errors (invalid API key)
      if (err.status === 401 || err.message.includes('401') || err.message.includes('API key')) {
        throw err;
      }
      
      console.warn(`[LLM] Rate limited or server error with ${model}. Trying next fallback...`);
    }
  }
  throw lastError;
}

/**
 * Build the interviewer system prompt (TRD.md §5.4, App-Flow.md §3)
 * 
 * Constructed server-side only, never includes raw API keys.
 * Includes: persona, current topic, rules, curriculum scope containment.
 */
function buildSystemPrompt(session, currentPlanEntry) {
  const { candidate } = session;
  const { member } = candidate;
  
  // Get the curriculum context for the current topic
  const topicContext = currentPlanEntry ? `
CURRENT TOPIC TO DISCUSS:
- Day ${currentPlanEntry.day}: ${currentPlanEntry.dayTitle}
- Module: ${currentPlanEntry.moduleTitle}
- Objectives: ${currentPlanEntry.objectives.join('; ')}
- Tools covered: ${currentPlanEntry.tools.join(', ')}
- Why this topic was selected: ${getRationaleExplanation(currentPlanEntry.rationale)}
- Suggested question approach: ${currentPlanEntry.questionType}
` : '';

  // Build coverage summary
  const coveredDays = [...session.askedDays].map(d => `Day ${d}`).join(', ');
  const questionsAsked = session.questionCount;
  const questionsRemaining = Math.max(0, 8 - questionsAsked);

  return `You are a professional, warm, and direct technical interviewer conducting a one-on-one interview with ${member.name}, a ${member.jobRole} with ${member.yearsExperience} years of experience (${member.education}).

This candidate completed the AI Cohort (31 days, 8 modules) covering: Environment & Tooling, Data Foundations, Embeddings & Vector Search, LLM Core/Prompting/Fine-Tuning, Chatbot Application Build, Agentic AI & MCP, Evaluation/Security/Deployment, and Production & Capstone.

YOUR INTERVIEWER PERSONA AND RULES (follow these strictly):

1. ONE QUESTION AT A TIME. Never bundle multiple questions in a single response.

2. ACKNOWLEDGE BEFORE PIVOTING. Briefly acknowledge the candidate's previous answer (one sentence, not a paragraph) before asking the next question or follow-up. This separates a real interview from a scripted quiz.

3. FOLLOW-UPS MUST REFERENCE SPECIFICS. When following up, quote or paraphrase something the candidate actually said. Example: "You mentioned using cosine similarity for retrieval — why that over dot product for your use case?" — not a generic "Can you elaborate?"

4. DIFFICULTY ADAPTS TO SIGNAL:
   - For topics the candidate passed on first try → ask trade-off/why-not-alternative questions
   - For skipped or low-pass topics → ask foundational explain-it-to-me questions
   - For high-attempt topics → probe what was challenging and how they worked through it

5. NATURAL TRANSITIONS. When moving between curriculum topics, use a brief bridging sentence rather than an abrupt topic jump.

6. TIME-BOX FOLLOW-UPS. Maximum ~2 follow-ups per topic before moving on, to ensure coverage of at least 4 distinct curriculum days.

7. STAY IN CURRICULUM SCOPE. Questions must map to real curriculum days/objectives/tools. Never invent technologies the cohort didn't cover.

8. CLOSING TONE. Be constructive and coaching, never pass/fail judgmental.

9. Keep responses conversational and concise (2-4 sentences for the question part, not long paragraphs).

10. If the candidate gives a one-word or empty answer, gently prompt for elaboration rather than immediately advancing.

${topicContext}

INTERVIEW PROGRESS:
- Questions asked so far: ${questionsAsked}
- Curriculum days covered: ${coveredDays || 'none yet'}
- Minimum questions remaining: ${questionsRemaining > 0 ? questionsRemaining : 'minimum met'}
- Total distinct days needed: at least 4 (currently: ${session.askedDays.size})

IMPORTANT: You are ONLY the interviewer. Do not break character. Do not discuss your own implementation, training, or capabilities. Stay focused on the technical interview about the candidate's AI Cohort experience.`;
}

/**
 * Get human-readable explanation of why a topic was selected
 */
function getRationaleExplanation(rationale) {
  switch (rationale) {
    case 'skipped':
      return 'Candidate skipped this topic — test transferable understanding from first principles';
    case 'failed':
      return 'Candidate did not pass this topic — probe knowledge gaps gently';
    case 'high_attempts_weak':
      return 'Candidate needed many attempts — revisit and probe what was challenging';
    case 'low_attempts_high_confidence':
      return 'Candidate passed on first try — ask deeper why/trade-off questions';
    case 'moderate_attempts':
      return 'Candidate passed with moderate effort — standard depth question';
    case 'capstone_anchor':
      return 'Capstone project — natural anchor for multi-topic follow-ups';
    default:
      return 'Standard topic coverage';
  }
}

/**
 * Convert session transcript to OpenAI message format
 */
function transcriptToMessages(transcript) {
  return transcript.map(entry => ({
    role: entry.role === 'interviewer' ? 'assistant' : 'user',
    content: entry.text
  }));
}

/**
 * Generate the next interview reply using Groq LLM.
 * 
 * Decision logic:
 * - If the candidate's answer seems shallow/vague → follow-up on same topic
 * - If sufficiently answered → advance to next planned topic
 * - The LLM itself decides via the system prompt guidance
 * 
 * @param {Object} session - Current interview session
 * @param {string} candidateMessage - Latest candidate response
 * @param {Object} currentPlanEntry - Current question plan entry
 * @param {Object|null} nextPlanEntry - Next question plan entry (or null if no more)
 * @returns {Promise<{reply: string, shouldAdvance: boolean}>}
 */
export async function generateInterviewReply(session, candidateMessage, currentPlanEntry, nextPlanEntry) {
  const systemPrompt = buildSystemPrompt(session, currentPlanEntry);

  // Build conversation history for context
  const conversationMessages = transcriptToMessages(session.transcript);

  // Count how many follow-ups we've done on the current topic
  const currentTopicFollowups = session.followupCount || 0;
  
  // Check if this turn will complete the interview (meets minimums of 8 questions and 4 days)
  const MIN_QUESTIONS = 8;
  const MIN_DAYS = 4;
  const willComplete = (session.questionCount >= MIN_QUESTIONS - 1 && session.askedDays.size >= MIN_DAYS);

  let advanceInstruction = '';
  if (willComplete) {
    advanceInstruction = `\n\nIMPORTANT: The interview is ending. This is your final response. Acknowledge the candidate's last answer, conclude the interview warmly, and do NOT ask any more questions.`;
  } else if (currentTopicFollowups >= 2) {
    // Time-boxed: move to next topic (App-Flow.md §3 rule 6)
    if (nextPlanEntry) {
      advanceInstruction = `\n\nIMPORTANT: You've already asked ${currentTopicFollowups} follow-ups on this topic. Time to move on. Briefly acknowledge the candidate's response, then transition naturally to the next topic: Day ${nextPlanEntry.day} — ${nextPlanEntry.dayTitle} (${nextPlanEntry.moduleTitle}). The question approach should be: ${nextPlanEntry.questionType}.`;
    } else {
      advanceInstruction = `\n\nIMPORTANT: You've covered enough follow-ups. Acknowledge the candidate's response and prepare to wrap up the interview.`;
    }
  } else if (nextPlanEntry) {
    advanceInstruction = `\n\nBased on the candidate's response, decide whether to:
(a) Ask a follow-up on the current topic (Day ${currentPlanEntry.day}: ${currentPlanEntry.dayTitle}) if their answer was shallow, vague, or incorrect — reference something specific they said.
(b) Move to the next topic (Day ${nextPlanEntry.day}: ${nextPlanEntry.dayTitle}, ${nextPlanEntry.moduleTitle}) if the current topic feels sufficiently explored — use a natural transition.

Choose (a) or (b) based on the quality and depth of the candidate's response.`;
  }

  try {
    const response = await callGroqWithFallback({
      messages: [
        { role: 'system', content: systemPrompt + advanceInstruction },
        ...conversationMessages
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const reply = response.choices[0].message.content;

    // Determine if the LLM advanced to a new topic by checking if the reply
    // mentions the next topic's keywords
    const shouldAdvance = nextPlanEntry ? 
      replyMentionsNewTopic(reply, nextPlanEntry) || currentTopicFollowups >= 2 : 
      false;

    return { reply, shouldAdvance };
  } catch (error) {
    console.error('Groq API error:', error.message);
    if (error.status === 401 || error.message.includes('401') || error.message.includes('API key')) {
      throw new Error('Invalid Groq API Key. Please check the GROQ_API_KEY in your backend/.env file and ensure it matches a valid key from https://console.groq.com.');
    }
    throw new Error(`LLM call failed: ${error.message}`);
  }
}

/**
 * Generate the opening interview message with first question.
 */
export async function generateOpeningMessage(session, firstPlanEntry) {
  const { candidate } = session;
  const { member } = candidate;



  const systemPrompt = `You are a professional, warm, and direct technical interviewer. You are about to begin an interview with ${member.name}, a ${member.jobRole} with ${member.yearsExperience} years of experience.

They completed the AI Cohort program (31 days, 8 modules). Your job is to greet them warmly and ask your FIRST question.

The first topic to cover is Day ${firstPlanEntry.day}: ${firstPlanEntry.dayTitle} (Module: ${firstPlanEntry.moduleTitle}).
Objectives of this day: ${firstPlanEntry.objectives.join('; ')}
Tools covered: ${firstPlanEntry.tools.join(', ')}
Why selected: ${getRationaleExplanation(firstPlanEntry.rationale)}
Question approach: ${firstPlanEntry.questionType}

Rules:
- Start with a brief, warm welcome (1 sentence max)
- Then ask ONE clear, focused opening question based on the topic and approach above
- Keep it conversational, not intimidating
- Do NOT bundle multiple questions
- Total response should be 3-5 sentences max`;

  try {
    const response = await callGroqWithFallback({
      messages: [
        { role: 'system', content: systemPrompt }
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Groq API error on opening:', error.message);
    // Fallback to a static opening if LLM fails
    return `Welcome, ${member.name}. Let's explore your experience with the AI Cohort program. To start, can you tell me about your work with ${firstPlanEntry.dayTitle}?`;
  }
}

/**
 * Count how many consecutive follow-ups have been on the current topic.
 * Looks back through the transcript from the end.
 */
function countFollowupsOnCurrentTopic(session, currentPlanEntry) {
  // Simple heuristic: count interviewer turns since the last topic transition
  // A topic transition is when askedDays grew
  let followups = 0;
  const entries = session.transcript;
  
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].role === 'interviewer') {
      followups++;
    } else {
      // Stop counting after we hit a candidate message that was followed by 
      // an interviewer message (the pair counts as one exchange)
      if (followups > 0) break;
    }
  }
  
  // The first question on a topic doesn't count as a follow-up
  return Math.max(0, followups - 1);
}

/**
 * Check if the LLM's reply mentions the next planned topic
 * (heuristic for detecting topic advancement)
 */
function replyMentionsNewTopic(reply, nextPlanEntry) {
  if (!nextPlanEntry) return false;
  const replyLower = reply.toLowerCase();
  const titleWords = nextPlanEntry.dayTitle.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  
  // Check if at least 2 significant words from the next topic title appear
  const matchCount = titleWords.filter(word => replyLower.includes(word)).length;
  return matchCount >= 2;
}

/**
 * Generate structured feedback at the end of the interview (TRD.md §5.4)
 * 
 * Uses response_format: { type: "json_object" } for strict JSON output.
 * Includes a single corrective retry on parse failure (Security.md §4).
 * 
 * @param {Object} session - Complete interview session with transcript
 * @returns {Promise<Object>} Feedback object { summary, strengths, gaps, next }
 */
export async function generateFeedback(session) {
  const { candidate, transcript } = session;
  const { member } = candidate;

  // Build the full transcript as a readable string
  const transcriptText = transcript.map(entry => 
    `${entry.role === 'interviewer' ? 'Interviewer' : member.name}: ${entry.text}`
  ).join('\n\n');

  // Build the coverage summary
  const coveredDays = [...session.askedDays].map(day => {
    const currDay = session.questionPlan.find(p => p.day === day);
    return currDay ? `Day ${day}: ${currDay.dayTitle}` : `Day ${day}`;
  }).join(', ');

  const feedbackPrompt = `You are evaluating a technical interview that just concluded. Analyze the following interview transcript and produce structured feedback.

CANDIDATE PROFILE:
- Name: ${member.name}
- Role: ${member.jobRole}
- Experience: ${member.yearsExperience} years
- Education: ${member.education}

CURRICULUM DAYS COVERED: ${coveredDays}
TOTAL QUESTIONS ASKED: ${session.questionCount}

FULL INTERVIEW TRANSCRIPT:
${transcriptText}

Produce a JSON object with exactly this structure:
{
  "summary": "A 2-4 sentence overview of the candidate's interview performance. Be specific about what they demonstrated well and where they struggled.",
  "strengths": ["Array of 3-5 concise, specific strengths. Each MUST reference a specific curriculum day/topic discussed. Example: 'Strong understanding of vector database indexing strategies (Day 8)'"],
  "gaps": ["Array of 2-4 concise, specific areas for improvement. Each MUST reference a specific curriculum day/topic. Frame as coaching, never as failure. Example: 'Could deepen understanding of MCP server architecture patterns (Day 23)'"],
  "next": ["Array of 3-5 concrete, actionable study recommendations. Each should reference specific curriculum days. Example: 'Revisit Day 8: Vector Databases Overview — specifically indexing strategies and query optimization'"]
}

IMPORTANT RULES:
- Every entry in strengths, gaps, and next MUST reference at least one specific curriculum day or topic
- Be constructive and coaching-toned, never harsh or judgmental
- Base ALL feedback on what was ACTUALLY discussed in the transcript, not on generic advice
- Each array item should be a concise sentence (1-2 lines max)
- Do NOT include any text outside the JSON object`;



  try {
    const response = await callGroqWithFallback({
      messages: [
        { role: 'system', content: 'You are an expert technical interview evaluator. Respond only with valid JSON.' },
        { role: 'user', content: feedbackPrompt }
      ],
      temperature: 0.5,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const rawContent = response.choices[0].message.content;
    const feedback = JSON.parse(rawContent);

    // Validate schema (Security.md §4)
    if (!validateFeedbackSchema(feedback)) {
      console.warn('Feedback schema validation failed, retrying with corrective prompt...');
      return await retryFeedbackGeneration(session, rawContent);
    }

    return feedback;

  } catch (error) {
    console.error('Feedback generation error:', error.message);
    
    // If it's a parse error, retry once (Security.md §4)
    if (error instanceof SyntaxError) {
      console.warn('JSON parse failed, retrying with corrective prompt...');
      return await retryFeedbackGeneration(session, '');
    }

    // Return a safe fallback rather than crashing
    return getFallbackFeedback(session);
  }
}

/**
 * Retry feedback generation with a corrective prompt (Security.md §4)
 */
async function retryFeedbackGeneration(session, previousOutput) {
  try {
    const response = await callGroqWithFallback({
      messages: [
        { role: 'system', content: 'You are an expert technical interview evaluator. You MUST respond with ONLY a valid JSON object, nothing else.' },
        { role: 'user', content: `Your previous response was not valid JSON or did not match the required schema. Please try again.

Required schema:
{
  "summary": "string (2-4 sentences)",
  "strengths": ["string array, 3-5 items"],
  "gaps": ["string array, 2-4 items"],
  "next": ["string array, 3-5 items"]
}

${previousOutput ? `Your previous invalid output was: ${previousOutput.substring(0, 500)}` : ''}

Please produce valid JSON matching the schema above, based on an interview with ${session.candidate.member.name} (${session.candidate.member.jobRole}).` }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const feedback = JSON.parse(response.choices[0].message.content);
    if (validateFeedbackSchema(feedback)) {
      return feedback;
    }
  } catch (retryError) {
    console.error('Retry also failed:', retryError.message);
  }

  return getFallbackFeedback(session);
}

/**
 * Validate the feedback object matches the required schema (technical-spec.md §3)
 */
function validateFeedbackSchema(feedback) {
  if (!feedback || typeof feedback !== 'object') return false;
  if (typeof feedback.summary !== 'string') return false;
  if (!Array.isArray(feedback.strengths) || feedback.strengths.length === 0) return false;
  if (!Array.isArray(feedback.gaps) || feedback.gaps.length === 0) return false;
  if (!Array.isArray(feedback.next) || feedback.next.length === 0) return false;
  if (!feedback.strengths.every(s => typeof s === 'string')) return false;
  if (!feedback.gaps.every(s => typeof s === 'string')) return false;
  if (!feedback.next.every(s => typeof s === 'string')) return false;
  return true;
}

/**
 * Fallback feedback when LLM fails entirely — never forward invalid JSON
 */
function getFallbackFeedback(session) {
  const coveredTopics = [...session.askedDays].map(day => {
    const plan = session.questionPlan.find(p => p.day === day);
    return plan ? `Day ${day}: ${plan.dayTitle}` : `Day ${day}`;
  });

  return {
    summary: `Interview with ${session.candidate.member.name} covered ${session.askedDays.size} curriculum areas across ${session.questionCount} questions. The candidate demonstrated engagement with the AI Cohort material.`,
    strengths: [`Engaged with ${coveredTopics.length} different curriculum topics`, 'Completed the full interview session'],
    gaps: ['Detailed feedback could not be generated — please review the transcript directly'],
    next: coveredTopics.map(t => `Review ${t} for deeper understanding`)
  };
}
