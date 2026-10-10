"use strict";
require("dotenv").config();

async function testGemini() {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  console.log(`\nTesting Gemini (${model})...`);
  console.log(`Key starts with: ${key.slice(0, 8)}...`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const body = {
    contents: [{ parts: [{ text: "Say only the word: working" }] }],
    generationConfig: { maxOutputTokens: 20 },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json();
    if (!res.ok) {
      console.log(`❌ Gemini HTTP ${res.status}: ${data?.error?.message || JSON.stringify(data)}`);
      return false;
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log(`✅ Gemini response: "${text?.trim()}"`);
    return true;
  } catch (err) {
    console.log(`❌ Gemini error: ${err.message}`);
    return false;
  }
}

async function testGroq() {
  const key   = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
  console.log(`\nTesting Groq (${model})...`);
  console.log(`Key starts with: ${key.slice(0, 8)}...`);

  const body = {
    model,
    messages: [{ role: "user", content: "Say only the word: working" }],
    max_tokens: 20,
    stream: false,
  };

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json();
    if (!res.ok) {
      console.log(`❌ Groq HTTP ${res.status}: ${data?.error?.message || JSON.stringify(data)}`);
      return false;
    }
    const text = data?.choices?.[0]?.message?.content;
    console.log(`✅ Groq response: "${text?.trim()}"`);
    return true;
  } catch (err) {
    console.log(`❌ Groq error: ${err.message}`);
    return false;
  }
}

(async () => {
  const geminiOk = await testGemini();
  const groqOk   = await testGroq();

  console.log(`\n── Summary ──`);
  console.log(`Gemini: ${geminiOk ? "✅ Working" : "❌ Failed"}`);
  console.log(`Groq:   ${groqOk   ? "✅ Working" : "❌ Failed"}`);

  if (!geminiOk && !groqOk) {
    console.log("\n⚠️  Both providers failed. Please check your API keys in .env");
    process.exit(1);
  }
})();
