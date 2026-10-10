"use strict";

const env = require("../config/env");

// ─────────────────────────────────────────────────────────────
// PROMPT BUILDER
// Produces a strict prompt that asks the AI to return ONLY
// a JSON array — no markdown, no explanation text.
// ─────────────────────────────────────────────────────────────

/**
 * Build the MCQ generation prompt.
 * @param {string} subject     - e.g. "Computer Networks"
 * @param {string} difficulty  - "easy" | "medium" | "hard"
 * @param {number} count       - 10 | 15 | 20 | 25
 * @returns {string}
 */
function buildPrompt(subject, difficulty, count) {
  return `You are an expert quiz creator. Generate exactly ${count} multiple-choice questions about "${subject}" at ${difficulty} difficulty level.

STRICT RULES:
1. Return ONLY a valid JSON array. No markdown, no code fences, no explanation.
2. Each question must have exactly 4 options labeled A, B, C, D.
3. The correct_answer field must be exactly one of: "A", "B", "C", or "D".
4. Every question must have a non-empty explanation (1-2 sentences).
5. Questions must be factually accurate and relevant to the subject.
6. Do NOT repeat questions or options.

Required JSON format:
[
  {
    "question": "Question text here?",
    "options": {
      "A": "First option",
      "B": "Second option",
      "C": "Third option",
      "D": "Fourth option"
    },
    "correct_answer": "B",
    "explanation": "Brief explanation of why B is correct."
  }
]

Generate exactly ${count} questions now. Return ONLY the JSON array.`;
}

// ─────────────────────────────────────────────────────────────
// RESPONSE VALIDATOR
// ─────────────────────────────────────────────────────────────

/**
 * Validate and clean AI-generated question array.
 * Returns { valid: true, questions } or { valid: false, error }
 * @param {any}    raw          - parsed JSON from AI
 * @param {number} expectedCount
 */
function validateQuestions(raw, expectedCount) {
  if (!Array.isArray(raw)) {
    return { valid: false, error: "Response is not a JSON array." };
  }

  if (raw.length < expectedCount) {
    return {
      valid: false,
      error: `Expected ${expectedCount} questions, got ${raw.length}.`,
    };
  }

  const validAnswers = new Set(["A", "B", "C", "D"]);
  const cleaned = [];

  for (let i = 0; i < expectedCount; i++) {
    const q = raw[i];

    if (!q || typeof q !== "object") {
      return { valid: false, error: `Question ${i + 1} is not an object.` };
    }

    if (!q.question || typeof q.question !== "string" || q.question.trim().length < 5) {
      return { valid: false, error: `Question ${i + 1} has invalid question text.` };
    }

    if (!q.options || typeof q.options !== "object") {
      return { valid: false, error: `Question ${i + 1} is missing options.` };
    }

    for (const key of ["A", "B", "C", "D"]) {
      if (!q.options[key] || typeof q.options[key] !== "string" || q.options[key].trim().length === 0) {
        return { valid: false, error: `Question ${i + 1} is missing option ${key}.` };
      }
    }

    const answer = String(q.correct_answer || "").trim().toUpperCase();
    if (!validAnswers.has(answer)) {
      return {
        valid: false,
        error: `Question ${i + 1} has invalid correct_answer: "${q.correct_answer}".`,
      };
    }

    if (!q.explanation || typeof q.explanation !== "string" || q.explanation.trim().length < 5) {
      return { valid: false, error: `Question ${i + 1} is missing explanation.` };
    }

    cleaned.push({
      question:       q.question.trim(),
      option_a:       q.options.A.trim(),
      option_b:       q.options.B.trim(),
      option_c:       q.options.C.trim(),
      option_d:       q.options.D.trim(),
      correct_answer: answer,
      explanation:    q.explanation.trim(),
    });
  }

  return { valid: true, questions: cleaned };
}

/**
 * Extract a JSON array from raw text that may contain markdown or prose.
 * Tries multiple strategies.
 * @param {string} text
 * @returns {any} parsed value or throws
 */
function extractJSON(text) {
  if (!text || typeof text !== "string") throw new Error("Empty response from AI.");

  // Strategy 1: direct parse (ideal case — model returned clean JSON)
  try {
    return JSON.parse(text.trim());
  } catch { /* continue */ }

  // Strategy 2: extract first [...] block
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch { /* continue */ }
  }

  // Strategy 3: strip markdown code fences
  const fenced = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(fenced);
  } catch { /* continue */ }

  // Strategy 4: find first [ to last ]
  const start = text.indexOf("[");
  const end   = text.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch { /* continue */ }
  }

  throw new Error("Could not extract valid JSON from AI response.");
}

// ─────────────────────────────────────────────────────────────
// PROVIDER 1: GEMINI (primary)
// Uses @google/genai SDK v2 — supports AQ. key format
// ai.models.generateContent is the correct public method
// ─────────────────────────────────────────────────────────────
async function callGemini(prompt) {
  if (!env.GEMINI_API_KEY) throw new Error("Gemini API key not configured.");

  // Lazy-load SDK so server still starts if package missing
  let GoogleGenAI;
  try {
    ({ GoogleGenAI } = require("@google/genai"));
  } catch {
    throw new Error("@google/genai package not installed. Run: npm install @google/genai");
  }

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

  let response;
  try {
    response = await Promise.race([
      ai.models.generateContent({
        model:    env.GEMINI_MODEL,
        contents: prompt,
        config: {
          temperature:     0.7,
          maxOutputTokens: 16384,
        },
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Gemini timeout after 45s")), 45000)
      ),
    ]);
  } catch (err) {
    // Map common SDK error codes
    const msg = err.message || "";
    if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
      throw Object.assign(new Error("Gemini quota exceeded."), { isQuota: true });
    }
    throw new Error(`Gemini SDK error: ${msg}`);
  }

  const text = response.text ||
    response?.candidates?.[0]?.content?.parts
      ?.map(p => p.text || "")
      .join("") || "";

  if (!text) throw new Error("Gemini returned empty content.");

  console.log(`[ai] Gemini response length: ${text.length} chars`);
  return extractJSON(text);
}

// ─────────────────────────────────────────────────────────────
// PROVIDER 2: GROQ (fallback #1)
// Uses Groq chat completions API — OpenAI-compatible format
// ─────────────────────────────────────────────────────────────
async function callGroq(prompt) {
  if (!env.GROQ_API_KEY) throw new Error("Groq API key not configured.");

  const body = {
    model:       env.GROQ_MODEL,
    messages: [
      {
        role:    "system",
        content: "You are an expert quiz creator. You always respond with valid JSON only — no markdown, no explanations, just the JSON array.",
      },
      {
        role:    "user",
        content: prompt,
      },
    ],
    temperature:    0.7,
    max_tokens:     8192,
    stream:         false,
  };

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${env.GROQ_API_KEY}`,
    },
    body:   JSON.stringify(body),
    signal: AbortSignal.timeout(60000), // 60 second timeout
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || `HTTP ${response.status}`;

    if (response.status === 429) throw Object.assign(new Error("Groq quota exceeded."), { isQuota: true });
    throw new Error(`Groq error: ${msg}`);
  }

  const data = await response.json();
  let text = data?.choices?.[0]?.message?.content;

  if (!text) throw new Error("Groq returned empty content.");

  // Qwen models sometimes prefix output with <think>...</think> — strip it
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  console.log(`[ai] Groq response length: ${text.length} chars`);
  return extractJSON(text);
}

// ─────────────────────────────────────────────────────────────
// PROVIDER 3: OLLAMA (fallback #2 — local)
// ─────────────────────────────────────────────────────────────
async function callOllama(prompt) {
  const body = {
    model:  env.OLLAMA_MODEL,
    prompt,
    stream: false,
    options: { temperature: 0.7 },
  };

  const response = await fetch(`${env.OLLAMA_BASE_URL}/api/generate`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(180000), // 3 min for local CPU
  });

  if (!response.ok) {
    throw new Error(`Ollama error: HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data?.response;

  if (!text) throw new Error("Ollama returned empty content.");

  console.log(`[ai] Ollama response length: ${text.length} chars`);
  return extractJSON(text);
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT: generateQuestions
// Tries providers in order: Gemini → Groq → Ollama
// Each provider gets up to 2 attempts (for transient failures).
// Validates output before returning.
// ─────────────────────────────────────────────────────────────

/**
 * Generate MCQ questions using the best available AI provider.
 * @param {string} subject
 * @param {string} difficulty
 * @param {number} count
 * @returns {Promise<Array>} validated question objects
 * @throws {Error} if all providers fail
 */
async function generateQuestions(subject, difficulty, count) {
  const prompt = buildPrompt(subject, difficulty, count);

  const providers = [
    { name: "Gemini", fn: callGemini,  enabled: Boolean(env.GEMINI_API_KEY) },
    { name: "Groq",   fn: callGroq,    enabled: Boolean(env.GROQ_API_KEY)   },
    { name: "Ollama", fn: callOllama,  enabled: true },
  ].filter((p) => p.enabled);

  const MAX_ATTEMPTS_PER_PROVIDER = 2;
  const errors = [];

  for (const provider of providers) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_PROVIDER; attempt++) {
      try {
        console.log(`[ai] Trying ${provider.name} (attempt ${attempt})...`);

        const raw = await provider.fn(prompt);

        const result = validateQuestions(raw, count);

        if (!result.valid) {
          console.warn(`[ai] ${provider.name} attempt ${attempt} failed validation: ${result.error}`);
          if (attempt === MAX_ATTEMPTS_PER_PROVIDER) {
            errors.push(`${provider.name}: validation failed — ${result.error}`);
          }
          continue; // retry with same provider
        }

        console.log(`[ai] ✅ ${provider.name} generated ${result.questions.length} valid questions.`);
        return result.questions;
      } catch (err) {
        console.warn(`[ai] ${provider.name} attempt ${attempt} error: ${err.message}`);
        errors.push(`${provider.name}: ${err.message}`);

        // Don't retry quota errors — move to next provider immediately
        if (err.isQuota) break;
      }
    }

    console.log(`[ai] Moving to next provider...`);
  }

  // All providers failed
  const summary = errors.join(" | ");
  console.error(`[ai] All providers failed: ${summary}`);

  throw new Error(
    "Quiz generation failed. All AI providers are currently unavailable. Please try again in a few minutes."
  );
}

module.exports = { generateQuestions, buildPrompt, validateQuestions, extractJSON };
