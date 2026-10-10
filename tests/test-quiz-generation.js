"use strict";
/**
 * QuizMind AI — Phase 9: AI Quiz Generation Tests
 * Tests:
 *   1.  Validation helpers (no API calls)
 *   2.  Prompt builder output
 *   3.  POST /api/quizzes/generate — no token → 401
 *   4.  POST /api/quizzes/generate — invalid body → 400
 *   5.  POST /api/quizzes/generate — with valid token → real AI call → 201
 *   6.  Questions stored in DB (no correct_answer in API response)
 *   7.  GET  /api/quizzes/:id — retrieve quiz + questions
 *   8.  GET  /api/quizzes/:id — wrong user → 404
 *   9.  POST /generate — bad subjectId → 400
 *   10. POST /generate — bad difficulty → 400
 */

require("dotenv").config();
const { Pool }   = require("pg");
const bcrypt     = require("bcrypt");
const pool       = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE       = "http://localhost:5000/api";

// ── inline aiService helpers for unit tests ──────────────────
const { validateQuestions, buildPrompt, extractJSON } =
  require("../server/services/aiService");

let passed = 0; let failed = 0;
function pass(l)      { console.log(`  ✅  ${l}`); passed++; }
function fail(l, d)   { console.error(`  ❌  ${l}: ${d}`); failed++; }
function section(t)   { console.log(`\n--- ${t} ---`); }

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

/* ── get or create a verified test user and return their JWT ── */
async function getToken() {
  const email    = "ai_test@quizmind.test";
  const password = "Test@1234";

  let row = (await pool.query(
    "SELECT id FROM users WHERE email=$1", [email]
  )).rows[0];

  if (!row) {
    const hash = await bcrypt.hash(password, 10);
    row = (await pool.query(
      `INSERT INTO users (name, email, password_hash, email_verified)
       VALUES ('AI Tester', $1, $2, TRUE) RETURNING id`,
      [email, hash]
    )).rows[0];
  } else {
    // ensure verified
    await pool.query("UPDATE users SET email_verified=TRUE WHERE id=$1", [row.id]);
  }

  const { data } = await req("POST", "/auth/login", { email, password });
  if (!data.data?.token) throw new Error("Could not obtain test token");
  return { token: data.data.token, userId: row.id };
}

/* ── get a real subject id from DB ── */
async function getSubjectId(name = "Computer Networks") {
  const r = await pool.query("SELECT id FROM subjects WHERE name=$1 LIMIT 1", [name]);
  if (!r.rows[0]) throw new Error(`Subject "${name}" not found in DB`);
  return r.rows[0].id;
}

async function run() {
  console.log("\n════════════════════════════════════════");
  console.log("  Phase 9 — AI Quiz Generation Tests");
  console.log("════════════════════════════════════════");

  /* ════════ UNIT TESTS — no network ════════ */
  section("UNIT: validateQuestions");

  // Valid input
  {
    const good = Array.from({ length: 5 }, (_, i) => ({
      question: `Question ${i + 1}?`,
      options:  { A: "opt1", B: "opt2", C: "opt3", D: "opt4" },
      correct_answer: "B",
      explanation: "Because B is correct.",
    }));
    const r = validateQuestions(good, 5);
    if (r.valid && r.questions.length === 5) pass("Valid questions → passes");
    else fail("Valid questions", r.error || "unexpected");
  }

  // Not an array
  {
    const r = validateQuestions({}, 5);
    if (!r.valid) pass("Non-array → fails validation");
    else fail("Non-array", "should have failed");
  }

  // Too few questions
  {
    const r = validateQuestions([{ question:"Q", options:{A:"a",B:"b",C:"c",D:"d"}, correct_answer:"A", explanation:"x" }], 5);
    if (!r.valid) pass("Too few questions → fails");
    else fail("Too few questions", "should have failed");
  }

  // Wrong correct_answer
  {
    const bad = [{
      question: "Q?",
      options:  { A: "a", B: "b", C: "c", D: "d" },
      correct_answer: "E",
      explanation: "x",
    }];
    const r = validateQuestions(bad, 1);
    if (!r.valid) pass("Invalid correct_answer (E) → fails");
    else fail("Invalid answer", "should have failed");
  }

  // Missing explanation
  {
    const bad = [{
      question:       "Q?",
      options:        { A: "a", B: "b", C: "c", D: "d" },
      correct_answer: "A",
      explanation:    "",
    }];
    const r = validateQuestions(bad, 1);
    if (!r.valid) pass("Empty explanation → fails");
    else fail("Empty explanation", "should have failed");
  }

  section("UNIT: extractJSON");

  {
    const json = JSON.stringify([{ test: 1 }]);
    const r = extractJSON(json);
    if (Array.isArray(r)) pass("Clean JSON string → parsed");
    else fail("Clean JSON", "not array");
  }

  {
    const wrapped = "```json\n[{\"test\":1}]\n```";
    const r = extractJSON(wrapped);
    if (Array.isArray(r)) pass("Markdown fenced JSON → extracted");
    else fail("Fenced JSON", "not array");
  }

  {
    const messy = "Here is your quiz:\n[{\"question\":\"Q?\",\"options\":{\"A\":\"a\"},\"correct_answer\":\"A\",\"explanation\":\"e\"}]\nEnd.";
    const r = extractJSON(messy);
    if (Array.isArray(r)) pass("Prose-wrapped JSON → extracted");
    else fail("Prose JSON", "not array");
  }

  section("UNIT: buildPrompt");

  {
    const p = buildPrompt("Computer Networks", "hard", 15);
    if (p.includes("15") && p.includes("Computer Networks") && p.includes("hard")) {
      pass("Prompt contains subject, count, difficulty");
    } else fail("buildPrompt", "missing required content");
  }

  {
    const p = buildPrompt("DBMS", "easy", 10);
    if (p.includes("JSON") && p.includes("correct_answer")) {
      pass("Prompt includes JSON format instructions");
    } else fail("buildPrompt format", "missing JSON instructions");
  }

  /* ════════ API TESTS — requires running server ════════ */
  section("API: Authentication checks");

  // No token → 401
  {
    const { status } = await req("POST", "/quizzes/generate", {
      subjectId: 1, difficulty: "easy", questionCount: 10,
    }, null);
    if (status === 401) pass("POST /generate no token → 401");
    else fail("No token", `expected 401, got ${status}`);
  }

  section("API: Input validation");

  let token, userId;
  try {
    ({ token, userId } = await getToken());
    pass("Test user authenticated");
  } catch (err) {
    fail("Get token", err.message);
    await pool.end();
    return;
  }

  // Bad difficulty
  {
    const { status, data } = await req("POST", "/quizzes/generate", {
      subjectId: 1, difficulty: "extreme", questionCount: 10,
      timerEnabled: false,
    }, token);
    if (status === 400) pass("Bad difficulty → 400");
    else fail("Bad difficulty", `status=${status} msg=${data.message}`);
  }

  // Bad questionCount
  {
    const { status, data } = await req("POST", "/quizzes/generate", {
      subjectId: 1, difficulty: "easy", questionCount: 7,
      timerEnabled: false,
    }, token);
    if (status === 400) pass("Bad questionCount (7) → 400");
    else fail("Bad questionCount", `status=${status} msg=${data.message}`);
  }

  // Bad subjectId
  {
    const { status, data } = await req("POST", "/quizzes/generate", {
      subjectId: "abc", difficulty: "easy", questionCount: 10,
      timerEnabled: false,
    }, token);
    if (status === 400) pass("Bad subjectId (string) → 400");
    else fail("Bad subjectId", `status=${status} msg=${data.message}`);
  }

  // Non-existent subjectId
  {
    const { status, data } = await req("POST", "/quizzes/generate", {
      subjectId: 9999, difficulty: "easy", questionCount: 10,
      timerEnabled: false,
    }, token);
    if (status === 404) pass("Non-existent subject → 404");
    else fail("Non-existent subject", `status=${status} msg=${data.message}`);
  }

  section("API: Real AI generation (Gemini → Groq fallback)");

  let quizId = null;
  let subjectId;
  try {
    subjectId = await getSubjectId("Computer Networks");
    pass(`Subject "Computer Networks" found in DB (id=${subjectId})`);
  } catch (err) {
    fail("Get subject", err.message);
    await pool.end();
    return;
  }

  console.log("  ⏳  Calling AI (Gemini first) — this may take 10-30 seconds...");
  {
    const start = Date.now();
    const { status, data } = await req("POST", "/quizzes/generate", {
      subjectId,
      difficulty:       "medium",
      questionCount:    10,
      timerEnabled:     true,
      timeLimitSeconds: 900,
    }, token);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    if (status === 201 && data.success) {
      quizId = data.data.quizId;
      pass(`AI generation success (201) in ${elapsed}s — quizId=${quizId}`);
      pass(`Questions returned: ${data.data.questions.length}`);
      pass(`Subject: ${data.data.subjectName}`);

      // Verify correct_answer is NOT in the response
      const hasAnswer = data.data.questions.some(q => q.correct_answer);
      if (!hasAnswer) pass("correct_answer NOT exposed in API response ✓");
      else fail("Security: correct_answer exposed", "should be hidden");

      // Verify question structure
      const q0 = data.data.questions[0];
      if (q0.question_text && q0.option_a && q0.option_b && q0.option_c && q0.option_d) {
        pass("Question structure valid (text + 4 options)");
      } else {
        fail("Question structure", JSON.stringify(q0));
      }
    } else {
      fail(`AI generation`, `status=${status} msg=${data.message || JSON.stringify(data)}`);
    }
  }

  section("API: GET quiz + questions");

  if (quizId) {
    const { status, data } = await req("GET", `/quizzes/${quizId}`, null, token);
    if (status === 200 && data.data.questions.length === 10) {
      pass(`GET /quizzes/${quizId} → 200, ${data.data.questions.length} questions`);
    } else {
      fail("GET quiz", `status=${status}`);
    }

    // Wrong user: create second token
    const email2    = "ai_test2@quizmind.test";
    const password2 = "Test@1234";
    let row2 = (await pool.query("SELECT id FROM users WHERE email=$1", [email2])).rows[0];
    if (!row2) {
      const hash2 = await bcrypt.hash(password2, 10);
      row2 = (await pool.query(
        `INSERT INTO users (name, email, password_hash, email_verified)
         VALUES ('AI Tester 2', $1, $2, TRUE) RETURNING id`,
        [email2, hash2]
      )).rows[0];
    } else {
      await pool.query("UPDATE users SET email_verified=TRUE WHERE id=$1", [row2.id]);
    }
    const { data: d2 } = await req("POST", "/auth/login", { email: email2, password: password2 });
    const token2 = d2.data?.token;

    if (token2) {
      const { status: s2 } = await req("GET", `/quizzes/${quizId}`, null, token2);
      if (s2 === 404) pass("GET quiz wrong user → 404 (ownership check works)");
      else fail("Ownership check", `expected 404, got ${s2}`);
    }
  } else {
    pass("Skipping GET test (AI generation failed — expected if no API keys)");
  }

  section("DB: Questions stored with correct_answer");

  if (quizId) {
    const r = await pool.query(
      `SELECT id, correct_answer, explanation FROM questions WHERE quiz_id=$1`,
      [quizId]
    );
    if (r.rows.length === 10) {
      pass(`DB: 10 questions stored for quiz ${quizId}`);
    } else {
      fail("DB question count", `expected 10, got ${r.rows.length}`);
    }

    const allHaveAnswers = r.rows.every(q =>
      ["A","B","C","D"].includes(q.correct_answer)
    );
    if (allHaveAnswers) pass("DB: All questions have valid correct_answer (A/B/C/D)");
    else fail("DB correct_answer", "some invalid");

    const allHaveExplanations = r.rows.every(q => q.explanation && q.explanation.length > 5);
    if (allHaveExplanations) pass("DB: All questions have explanations");
    else fail("DB explanations", "some missing");
  } else {
    pass("Skipping DB test (quiz not generated)");
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`  Passed: ${passed}   Failed: ${failed}`);
  console.log(failed === 0 ? "  RESULT: ALL TESTS PASSED" : "  RESULT: SOME TESTS FAILED");
  console.log(`════════════════════════════════════════\n`);

  await pool.end();
  if (failed > 0) process.exitCode = 1;
}

run().catch(err => { console.error("Runner error:", err.message); process.exit(1); });
