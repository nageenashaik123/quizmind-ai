"use strict";
/**
 * Minimal Gemini key test using @google/genai SDK v2
 * Run: node tests/test-gemini-key.js
 * Key is never printed.
 */
require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

async function run() {
  const key   = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";

  if (!key) { console.error("❌ GEMINI_API_KEY not set in .env"); process.exit(1); }

  console.log(`SDK         : @google/genai v2.28.0`);
  console.log(`Model       : ${model}`);
  console.log(`Key prefix  : ${key.slice(0, 6)}... (${key.length} chars)`);

  try {
    const ai = new GoogleGenAI({ apiKey: key });

    const response = await Promise.race([
      ai.models.generateContent({
        model,
        contents: "Say only the word: working",
        config:   { maxOutputTokens: 200 },
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timed out after 30s")), 30000)
      ),
    ]);

    // gemini-3.8-flash returns thoughtSignature alongside text — extract manually
    const text = response.text ||
      response?.candidates?.[0]?.content?.parts
        ?.map(p => p.text || "").join("") || "";

    if (text.trim()) {
      console.log(`✅ Gemini OK — response: "${text.trim().slice(0, 80)}"`);
      console.log(`   Model version: ${response.modelVersion}`);
    } else {
      console.log(`❌ Empty response. finishReason: ${response?.candidates?.[0]?.finishReason}`);
      process.exitCode = 1;
    }
  } catch (err) {
    const msg = (err.message || "").slice(0, 200);
    console.error(`❌ Gemini error: ${msg}`);
    process.exitCode = 1;
  }
}

run();
