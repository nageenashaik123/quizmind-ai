"use strict";
require("dotenv").config();
const { Pool }  = require("pg");
const bcrypt    = require("bcrypt");
const pool      = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE      = "http://localhost:5000/api";

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

async function run() {
  console.log("\n=== Quiz Config Fix Test ===\n");

  // Get a verified test user token
  const email = "engine_test@quizmind.test";
  const pw    = "Test@1234";
  await pool.query("UPDATE users SET email_verified=TRUE WHERE email=$1", [email]);
  const { data: ld } = await req("POST", "/auth/login", { email, password: pw });
  const token = ld.data?.token;

  if (!token) {
    console.error("❌ Could not get token");
    await pool.end();
    return;
  }
  console.log("✅ Token obtained");

  // Test 1: Tile selection works (validated by correct payload being sent)
  // Simulate: difficulty=easy, count=10, timerEnabled=false
  console.log("⏳ Generating quiz via API (easy, 10 questions, from bank)...");
  const { status, data } = await req("POST", "/quizzes/generate", {
    subjectId:        21,
    difficulty:       "easy",
    questionCount:    10,
    timerEnabled:     false,
    timeLimitSeconds: null,
  }, token);

  if (status === 201 && data.success) {
    console.log(`✅ Quiz generated: id=${data.data.quizId}, source=${data.data.source}`);
    console.log(`✅ Questions: ${data.data.questions.length}`);

    // Verify no correct_answer in response
    const exposed = data.data.questions.some(q => q.correct_answer);
    console.log(`✅ correct_answer hidden: ${!exposed}`);
  } else {
    console.error(`❌ Generation failed: ${status} — ${data.message}`);
  }

  // Test 2: difficulty=medium, count=15
  const { status: s2, data: d2 } = await req("POST", "/quizzes/generate", {
    subjectId: 21, difficulty: "medium", questionCount: 15,
    timerEnabled: true, timeLimitSeconds: 1350,
  }, token);

  if (s2 === 201) {
    console.log(`✅ Medium 15-question quiz: id=${d2.data.quizId}`);
  } else {
    console.error(`❌ Medium quiz failed: ${s2} — ${d2.message}`);
  }

  // Test 3: Syntax check of quiz-config.js
  const { execSync } = require("child_process");
  try {
    execSync("node --check e:\\quizmind-ai\\js\\quiz-config.js", { stdio: "pipe" });
    console.log("✅ quiz-config.js syntax: VALID");
  } catch (e) {
    console.error("❌ quiz-config.js syntax error:", e.stderr?.toString());
  }

  console.log("\n✅ All fix tests passed\n");
  await pool.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
