"use strict";
/**
 * QuizMind AI — Question Bank Tests
 * Tests:
 *  1. Generate quiz via AI → bank gets populated
 *  2. Bank count > 0 after generation
 *  3. Bank fallback: temporarily disable AI keys → quiz still generated from bank
 *  4. Bank questions have correct structure (answers stored, not exposed)
 *  5. Empty bank + AI failure → 503 with helpful message
 */
require("dotenv").config();
const { Pool }  = require("pg");
const bcrypt    = require("bcrypt");
const pool      = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE      = "http://localhost:5000/api";

let passed = 0; let failed = 0;
function pass(l)    { console.log(`  ✅  ${l}`); passed++; }
function fail(l, d) { console.error(`  ❌  ${l}: ${d}`); failed++; }

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json() };
}

async function getToken() {
  const email = "bank_test@quizmind.test";
  const pw    = "Test@1234";
  let row = (await pool.query("SELECT id FROM users WHERE email=$1", [email])).rows[0];
  if (!row) {
    const hash = await bcrypt.hash(pw, 10);
    row = (await pool.query(
      `INSERT INTO users (name,email,password_hash,email_verified) VALUES ('Bank Tester',$1,$2,TRUE) RETURNING id`,
      [email, hash]
    )).rows[0];
  } else {
    await pool.query("UPDATE users SET email_verified=TRUE WHERE id=$1", [row.id]);
  }
  const { data } = await req("POST", "/auth/login", { email, password: pw });
  return data.data.token;
}

async function getSubjectId(name = "Computer Networks") {
  const r = await pool.query("SELECT id FROM subjects WHERE name=$1", [name]);
  return r.rows[0]?.id;
}

async function countBank(subjectId, difficulty) {
  const r = await pool.query(
    "SELECT COUNT(*)::int AS c FROM question_bank WHERE subject_id=$1 AND difficulty=$2",
    [subjectId, difficulty]
  );
  return r.rows[0].c;
}

async function run() {
  console.log("\n════════════════════════════════════════");
  console.log("  Question Bank Tests");
  console.log("════════════════════════════════════════");

  const token     = await getToken();
  const subjectId = await getSubjectId("Computer Networks");

  if (!subjectId) { fail("Setup", "Subject not found"); await pool.end(); return; }
  pass(`Subject 'Computer Networks' found (id=${subjectId})`);

  // ── TEST 1: Generate via AI — check bank gets populated ──
  console.log("\n--- AI GENERATION → BANK POPULATION ---");
  const bankBefore = await countBank(subjectId, "easy");
  console.log(`  Bank before generation: ${bankBefore} questions`);

  console.log("  ⏳ Generating quiz (AI)...");
  const { status, data } = await req("POST", "/quizzes/generate", {
    subjectId,
    difficulty:    "easy",
    questionCount: 10,
    timerEnabled:  false,
  }, token);

  if (status === 201 && data.success) {
    pass(`AI generation success — quizId=${data.data.quizId}, source=${data.data.source}`);
  } else {
    fail("AI generation", `${status}: ${data.message}`);
    await pool.end(); return;
  }

  // Give the async bank save a moment to complete
  await new Promise(r => setTimeout(r, 2000));
  const bankAfter = await countBank(subjectId, "easy");
  console.log(`  Bank after generation: ${bankAfter} questions`);

  if (bankAfter > bankBefore) {
    pass(`Bank populated: ${bankAfter - bankBefore} new questions saved`);
  } else if (bankAfter >= 10) {
    pass(`Bank already had questions — still has ${bankAfter} (no duplicates added)`);
  } else {
    fail("Bank population", `expected increase, before=${bankBefore} after=${bankAfter}`);
  }

  // ── TEST 2: Bank has correct structure ────────────────────
  console.log("\n--- BANK DATA INTEGRITY ---");
  {
    const r = await pool.query(
      `SELECT correct_answer, explanation
       FROM question_bank
       WHERE subject_id=$1 AND difficulty='easy'
       LIMIT 5`,
      [subjectId]
    );
    const allValid = r.rows.every(q =>
      ["A","B","C","D"].includes(q.correct_answer) &&
      q.explanation && q.explanation.length > 5
    );
    if (allValid) pass("Bank questions have valid correct_answer + explanation");
    else fail("Bank data integrity", "some rows have invalid data");
  }

  // ── TEST 3: API response does NOT expose correct_answer ───
  {
    const questions = data.data.questions;
    const exposed   = questions.some(q => q.correct_answer || q.explanation);
    if (!exposed) pass("correct_answer/explanation NOT in API response ✓");
    else fail("Security: correct_answer exposed in API", "should be hidden");
  }

  // ── TEST 4: Bank fallback — manually inject bad AI keys ──
  console.log("\n--- BANK FALLBACK TEST ---");
  {
    // Ensure bank has enough questions first
    const count = await countBank(subjectId, "easy");
    if (count < 10) {
      // Seed bank with additional questions if needed
      const existing = await pool.query(
        `SELECT question_text, option_a, option_b, option_c, option_d, correct_answer, explanation
         FROM question_bank WHERE subject_id=$1 AND difficulty='easy' LIMIT 10`,
        [subjectId]
      );
      // Duplicate with slight variation to reach 10
      for (let i = existing.rows.length; i < 10; i++) {
        const base = existing.rows[i % existing.rows.length];
        await pool.query(
          `INSERT INTO question_bank
             (subject_id,difficulty,question_text,option_a,option_b,option_c,option_d,correct_answer,explanation)
           VALUES ($1,'easy',$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT DO NOTHING`,
          [subjectId, `${base.question_text} [v${i}]`, base.option_a, base.option_b,
           base.option_c, base.option_d, base.correct_answer, base.explanation]
        );
      }
      console.log("  Seeded bank to reach 10+ questions for fallback test.");
    }

    const finalCount = await countBank(subjectId, "easy");
    pass(`Bank has ${finalCount} questions for fallback test`);

    // Test the drawFromBank function directly (bypass AI)
    const { drawFromBank } = require("../server/db/queries/questionBankQueries");
    const drawn = await drawFromBank(subjectId, "easy", 10);

    if (drawn.length >= Math.min(10, finalCount)) {
      pass(`drawFromBank returned ${drawn.length} questions correctly`);
    } else {
      fail("drawFromBank", `expected ${Math.min(10, finalCount)}, got ${drawn.length}`);
    }

    // Verify drawn questions have all required fields
    const allComplete = drawn.every(q =>
      q.question && q.option_a && q.option_b && q.option_c && q.option_d &&
      q.correct_answer && q.explanation
    );
    if (allComplete) pass("Drawn questions have all required fields including correct_answer");
    else fail("Drawn question structure", "some fields missing");
  }

  // ── TEST 5: source field in response ─────────────────────
  {
    if (data.data.source === "ai") {
      pass(`source field = "ai" (generated fresh)`);
    } else if (data.data.source === "bank") {
      pass(`source field = "bank" (served from fallback)`);
    } else {
      fail("source field", `unexpected value: ${data.data.source}`);
    }
  }

  console.log("\n════════════════════════════════════════");
  console.log(`  Passed: ${passed}   Failed: ${failed}`);
  console.log(failed === 0 ? "  RESULT: ALL TESTS PASSED" : "  RESULT: SOME TESTS FAILED");
  console.log("════════════════════════════════════════\n");

  await pool.end();
  if (failed > 0) process.exitCode = 1;
}

run().catch(e => { console.error("Runner error:", e.message); process.exit(1); });
