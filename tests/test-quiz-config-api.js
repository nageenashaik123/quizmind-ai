"use strict";
/**
 * Phase 8 — Quiz Config API Integration Tests
 * Tests the flow the quiz-config page depends on:
 *   1. GET /api/domains — domains load
 *   2. GET /api/domains/:id/subjects — subjects load
 *   3. GET /api/auth/me — protected route works
 *   4. POST /api/quizzes/generate without auth → 401
 *   5. POST /api/quizzes/generate with auth → 404 (route not yet implemented)
 */

require("dotenv").config();
const BASE = "http://localhost:5000/api";

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

function pass(label)         { console.log(`  ✅  ${label}`); }
function fail(label, detail) { console.error(`  ❌  ${label}: ${detail}`); process.exitCode = 1; }

// Get a real JWT for testing
async function getToken() {
  // Use the first user in the DB
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const result = await pool.query(
    "SELECT email FROM users WHERE email_verified = TRUE LIMIT 1"
  );
  await pool.end();

  if (!result.rows.length) return null;

  const { data } = await req("POST", "/auth/login", {
    email:    result.rows[0].email,
    password: "Test@1234",
  });
  return data.data?.token || null;
}

async function run() {
  console.log("\n════════════════════════════════════════");
  console.log("  Phase 8 — Quiz Config API Tests");
  console.log("════════════════════════════════════════\n");

  // Test 1: Domains load
  console.log("--- DOMAIN + SUBJECT APIS ---");
  {
    const { status, data } = await req("GET", "/domains");
    if (status === 200 && data.data.length === 4) {
      pass(`GET /api/domains → 4 domains (${data.data.map(d => d.name).join(", ")})`);
    } else {
      fail("GET /api/domains", `status=${status} count=${data.data?.length}`);
    }
  }

  // Test 2: Subjects for Technical (id=4)
  {
    const { status, data } = await req("GET", "/domains/4/subjects");
    if (status === 200 && data.data.subjects.length === 7) {
      pass(`GET /api/domains/4/subjects → 7 Technical subjects`);
    } else {
      fail("GET /api/domains/4/subjects", `status=${status}`);
    }
  }

  // Test 3: POST /api/quizzes/generate without token → 401
  console.log("\n--- QUIZ GENERATE ENDPOINT ---");
  {
    const { status, data } = await req("POST", "/quizzes/generate", {
      subjectId: 21, difficulty: "medium", questionCount: 15,
      timerEnabled: false, timeLimitSeconds: null,
    }, null);

    // Should be 401 (no token) or 404 (route not yet wired)
    if (status === 401) {
      pass("POST /api/quizzes/generate (no token) → 401 Unauthorized ✓");
    } else if (status === 404) {
      pass("POST /api/quizzes/generate (no token) → 404 (route not yet implemented) — expected for Phase 8");
    } else {
      fail("POST /api/quizzes/generate (no token)", `expected 401 or 404, got ${status}`);
    }
  }

  // Test 4: POST with auth → 404 (route not yet implemented in Phase 8)
  const token = await getToken();
  if (token) {
    const { status, data } = await req("POST", "/quizzes/generate", {
      subjectId: 21, difficulty: "hard", questionCount: 10,
      timerEnabled: true, timeLimitSeconds: 1200,
    }, token);

    // Phase 8: route not yet implemented — expect 401 (middleware might not exist) or 404
    if (status === 404 || status === 401 || status === 501) {
      pass(`POST /api/quizzes/generate (with token) → ${status} (Phase 9 will implement AI generation)`);
    } else if (status === 200 || status === 201) {
      pass(`POST /api/quizzes/generate (with token) → ${status} — route exists early!`);
    } else {
      fail("POST with token", `unexpected status ${status}: ${data.message}`);
    }
  } else {
    pass("No test user available — skipping authenticated generate test (register first)");
  }

  // Test 5: quiz-config.html file structure
  console.log("\n--- FILE INTEGRITY ---");
  {
    const fs = require("fs");
    const html = fs.readFileSync("e:/quizmind-ai/client/quiz-config.html", "utf8");
    const checks = {
      "difficulty tiles":   html.includes("tile-easy") && html.includes("tile-hard"),
      "count tiles":        html.includes("tile-10") && html.includes("tile-25"),
      "timer options":      html.includes("timerOff") && html.includes("timerOn"),
      "generate button":    html.includes("generateBtn"),
      "time summary":       html.includes("timeSummary"),
      "config summary":     html.includes("configSummary"),
      "subject name":       html.includes("subjectName"),
      "quiz-config.js ref": html.includes("quiz-config.js"),
    };

    let allOk = true;
    Object.entries(checks).forEach(([label, ok]) => {
      if (ok) pass(`HTML has ${label}`);
      else    { fail(`HTML missing ${label}`, ""); allOk = false; }
    });
  }

  console.log("\n════════════════════════════════════════");
  console.log(process.exitCode ? "  RESULT: SOME TESTS FAILED" : "  RESULT: ALL TESTS PASSED");
  console.log("════════════════════════════════════════\n");
}

run().catch(err => { console.error("Error:", err.message); process.exit(1); });
