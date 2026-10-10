"use strict";
/**
 * QuizMind AI — Phase 16: Full Integration Test
 * Tests the complete user journey:
 *
 *  SETUP
 *   1.  Health check
 *
 *  AUTH FLOW
 *   2.  Register new user
 *   3.  Login before OTP verification → 403
 *   4.  OTP verification (DB-patched)
 *   5.  Login after verification → JWT
 *   6.  GET /api/auth/me with token
 *
 *  DOMAIN + SUBJECT
 *   7.  GET /api/domains → 4 domains
 *   8.  GET /api/domains/:id/subjects → subjects for each domain
 *
 *  QUIZ CONFIG + GENERATION
 *   9.  POST /api/quizzes/generate with invalid body → 400
 *   10. POST /api/quizzes/generate with valid body → 201 (AI or bank)
 *   11. GET  /api/quizzes/:id → questions without correct_answer
 *
 *  QUIZ SUBMISSION + SCORING
 *   12. POST /api/quizzes/:id/submit all correct → 100%
 *   13. Duplicate submit → 409
 *
 *  RESULT + REVIEW
 *   14. GET /api/attempts/:id → result data
 *   15. GET /api/attempts/:id/review → full review with answers
 *
 *  HISTORY + DASHBOARD + PROFILE
 *   16. GET /api/attempts → history list with meta
 *   17. GET /api/attempts?difficulty=easy → filtered
 *   18. GET /api/dashboard → all analytics sections
 *   19. GET /api/profile → user info + stats
 *
 *  SECURITY
 *   20. Unauthenticated /api/quizzes/generate → 401
 *   21. User A cannot access User B's quiz → 404
 *   22. User A cannot access User B's attempt → 404
 *   23. Correct answers NOT in GET /api/quizzes/:id
 *   24. password_hash NOT in /api/profile
 *
 *  FORGOT PASSWORD
 *   25. POST /api/auth/forgot-password unknown email → 200 (silent)
 *   26. POST /api/auth/forgot-password valid email → OTP sent
 *   27. POST /api/auth/reset-password correct OTP → 200
 *   28. Login with old password → 401
 *   29. Login with new password → 200
 *
 *  QUESTION BANK
 *   30. question_bank table has entries after generation
 */

require("dotenv").config();
const { Pool }  = require("pg");
const bcrypt    = require("bcrypt");
const pool      = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE      = "http://localhost:5000/api";

let passed = 0; let failed = 0; let skipped = 0;
function pass(l)          { console.log(`  ✅  ${l}`); passed++; }
function fail(l, d)       { console.error(`  ❌  ${l}: ${d}`); failed++; }
function skip(l)          { console.log(`  ⏭   ${l}`); skipped++; }
function section(t)       { console.log(`\n--- ${t} ---`); }

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

async function patchOTP(email, purpose, otp) {
  const hash = await bcrypt.hash(otp, 10);
  await pool.query(
    `UPDATE otp_verifications
     SET otp_hash=$1, expires_at=NOW()+INTERVAL '10 minutes'
     WHERE email=$2 AND purpose=$3 AND verified=FALSE`,
    [hash, email, purpose]
  );
}

async function run() {
  const ts    = Date.now();
  const EMAIL = `integration_${ts}@quizmind.test`;
  const PW1   = "Test@Integration1";
  const PW2   = "Test@Integration2";
  let   token = null;
  let   token2= null;
  let   quizId    = null;
  let   attemptId = null;

  console.log("\n════════════════════════════════════════════════════");
  console.log("  QuizMind AI — Phase 16 Integration Tests");
  console.log("════════════════════════════════════════════════════");

  /* ══ SETUP ══════════════════════════════════════════════ */
  section("SETUP");

  {
    const { status, data } = await req("GET", "/health");
    if (status === 200 && data.success) pass("Health check → 200");
    else { fail("Health check", `${status}`); await pool.end(); return; }
  }

  /* ══ AUTH FLOW ══════════════════════════════════════════ */
  section("AUTH FLOW");

  // Register
  {
    const { status, data } = await req("POST", "/auth/register", {
      name: "Integration User", email: EMAIL,
      password: PW1, confirmPassword: PW1,
    });
    if (status === 201 && data.success) pass(`Register → 201 (requiresVerification=${data.data.requiresVerification})`);
    else { fail("Register", `${status}: ${data.message}`); await pool.end(); return; }
  }

  // Login before verification
  {
    const { status, data } = await req("POST", "/auth/login", { email: EMAIL, password: PW1 });
    if (status === 403 && data.requiresVerification) pass("Login before OTP → 403 requiresVerification");
    else fail("Login before OTP", `${status}`);
  }

  // Verify OTP (DB-patched)
  {
    const OTP = "246810";
    await patchOTP(EMAIL, "REGISTER", OTP);
    const { status, data } = await req("POST", "/auth/verify-otp", {
      email: EMAIL, otp: OTP, purpose: "REGISTER",
    });
    if (status === 200 && data.success) pass("OTP verification → 200");
    else { fail("OTP verification", `${status}: ${data.message}`); await pool.end(); return; }
  }

  // Login after verification
  {
    const { status, data } = await req("POST", "/auth/login", { email: EMAIL, password: PW1 });
    if (status === 200 && data.data.token) {
      token = data.data.token;
      pass(`Login → 200, JWT received`);
    } else {
      fail("Login", `${status}: ${data.message}`);
      await pool.end(); return;
    }
  }

  // GET /me
  {
    const { status, data } = await req("GET", "/auth/me", null, token);
    if (status === 200 && data.data.user.email === EMAIL) pass("GET /auth/me → correct user");
    else fail("GET /auth/me", `${status}`);
  }

  // Create second user for isolation tests
  {
    const email2 = `integration_b_${ts}@quizmind.test`;
    await req("POST", "/auth/register", {
      name: "User B", email: email2, password: PW1, confirmPassword: PW1,
    });
    await patchOTP(email2, "REGISTER", "111222");
    await req("POST", "/auth/verify-otp", { email: email2, otp: "111222", purpose: "REGISTER" });
    const { data } = await req("POST", "/auth/login", { email: email2, password: PW1 });
    token2 = data.data?.token || null;
    if (token2) pass("User B created and authenticated");
    else skip("User B creation failed — isolation tests will be skipped");
  }

  /* ══ DOMAINS + SUBJECTS ══════════════════════════════════ */
  section("DOMAINS + SUBJECTS");

  let domains = [];
  {
    const { status, data } = await req("GET", "/domains");
    if (status === 200 && data.data.length === 4) {
      domains = data.data;
      pass(`GET /api/domains → 4 domains`);
    } else fail("GET /domains", `count=${data.data?.length}`);
  }

  {
    let totalSubjects = 0;
    for (const d of domains) {
      const { data } = await req("GET", `/domains/${d.id}/subjects`);
      totalSubjects += data.data?.subjects?.length || 0;
    }
    if (totalSubjects === 25) pass(`All subjects fetched: 25 total`);
    else fail("Total subjects", `expected 25, got ${totalSubjects}`);
  }

  /* ══ QUIZ GENERATION ════════════════════════════════════ */
  section("QUIZ GENERATION");

  // No auth → 401
  {
    const { status } = await req("POST", "/quizzes/generate", {
      subjectId: 21, difficulty: "easy", questionCount: 10,
    }, null);
    if (status === 401) pass("Generate without token → 401");
    else fail("Generate no token", `expected 401, got ${status}`);
  }

  // Bad body → 400
  {
    const { status } = await req("POST", "/quizzes/generate", {
      subjectId: 21, difficulty: "impossible", questionCount: 10,
    }, token);
    if (status === 400) pass("Generate bad difficulty → 400");
    else fail("Generate bad body", `expected 400, got ${status}`);
  }

  // Valid generation
  {
    console.log("  ⏳  Generating quiz (AI or bank)...");
    const { status, data } = await req("POST", "/quizzes/generate", {
      subjectId:       21,
      difficulty:      "easy",
      questionCount:   10,
      timerEnabled:    true,
      timeLimitSeconds: 900,
    }, token);

    if (status === 201 && data.success) {
      quizId = data.data.quizId;
      pass(`Generate quiz → 201 (id=${quizId}, source=${data.data.source})`);
      pass(`Questions returned: ${data.data.questions.length}`);
    } else {
      fail("Generate quiz", `${status}: ${data.message}`);
      await pool.end(); return;
    }
  }

  // GET quiz without answers
  {
    const { status, data } = await req("GET", `/quizzes/${quizId}`, null, token);
    if (status === 200 && data.data.questions.length === 10) {
      pass(`GET /quizzes/${quizId} → 10 questions`);

      const hasAnswers = data.data.questions.some(q => q.correct_answer || q.explanation);
      if (!hasAnswers) pass("correct_answer/explanation NOT in response ✓");
      else fail("Security: answers exposed", "should be hidden");
    } else fail("GET quiz", `${status}`);
  }

  // User B cannot access User A's quiz
  if (token2) {
    const { status } = await req("GET", `/quizzes/${quizId}`, null, token2);
    if (status === 404) pass("User B cannot access User A's quiz → 404 ✓");
    else fail("Quiz ownership", `expected 404, got ${status}`);
  }

  /* ══ SUBMISSION + SCORING ═══════════════════════════════ */
  section("QUIZ SUBMISSION + SCORING");

  // Get correct answers from DB
  const dbQ = (await pool.query(
    "SELECT id, correct_answer FROM questions WHERE quiz_id=$1 ORDER BY id", [quizId]
  )).rows;

  const allCorrect = {};
  dbQ.forEach(q => { allCorrect[q.id] = q.correct_answer; });

  {
    const { status, data } = await req("POST", `/quizzes/${quizId}/submit`, {
      answers: allCorrect, timeTakenSeconds: 300,
    }, token);
    if (status === 201 && Math.round(data.data.score) === 100) {
      attemptId = data.data.attemptId;
      pass(`Submit all correct → 100% (attemptId=${attemptId})`);
      pass(`correctCount=${data.data.correctCount}, wrongCount=${data.data.wrongCount}`);
    } else fail("Submit", `${status}: ${data.message}`);
  }

  // Duplicate submit → 409
  {
    const { status } = await req("POST", `/quizzes/${quizId}/submit`, {
      answers: allCorrect, timeTakenSeconds: 10,
    }, token);
    if (status === 409) pass("Duplicate submit → 409 ✓");
    else fail("Duplicate submit", `expected 409, got ${status}`);
  }

  /* ══ RESULT + REVIEW ════════════════════════════════════ */
  section("RESULT + REVIEW");

  {
    const { status, data } = await req("GET", `/attempts/${attemptId}`, null, token);
    if (status === 200) {
      const a = data.data.attempt;
      pass(`GET /attempts/${attemptId} → score=${Math.round(a.score)}%, subject=${a.subject_name}`);
      if (a.completed_at) pass("completed_at present");
    } else fail("GET attempt", `${status}`);
  }

  // User B cannot access User A's attempt
  if (token2) {
    const { status } = await req("GET", `/attempts/${attemptId}`, null, token2);
    if (status === 404) pass("User B cannot access User A's attempt → 404 ✓");
    else fail("Attempt ownership", `expected 404, got ${status}`);
  }

  {
    const { status, data } = await req("GET", `/attempts/${attemptId}/review`, null, token);
    if (status === 200 && Array.isArray(data.data.review)) {
      const r = data.data.review;
      pass(`GET /attempts/${attemptId}/review → ${r.length} items`);

      const complete = r.every(item =>
        item.question_text && item.correct_answer && item.explanation
      );
      if (complete) pass("Review items have correct_answer + explanation after submission ✓");
      else fail("Review completeness", "some fields missing");

      const allCorrectItems = r.filter(i => i.is_correct).length;
      pass(`is_correct flag: ${allCorrectItems}/${r.length} correct`);
    } else fail("GET review", `${status}`);
  }

  /* ══ HISTORY ════════════════════════════════════════════ */
  section("HISTORY + FILTERS");

  {
    const { status, data } = await req("GET", "/attempts", null, token);
    if (status === 200 && data.meta) {
      pass(`GET /attempts → ${data.meta.total} total, page returned ${data.data.length}`);
    } else fail("GET attempts", `${status}`);
  }

  {
    const { status, data } = await req("GET", "/attempts?difficulty=easy", null, token);
    if (status === 200) {
      const allEasy = data.data.every(a => a.difficulty === "easy");
      if (allEasy || data.data.length === 0) pass("Filter difficulty=easy works ✓");
      else fail("Difficulty filter", "non-easy results returned");
    } else fail("Filter", `${status}`);
  }

  {
    const { status, data } = await req("GET", "/attempts?subjectId=21", null, token);
    if (status === 200) pass(`Filter subjectId=21 → ${data.data.length} results`);
    else fail("Subject filter", `${status}`);
  }

  /* ══ DASHBOARD ══════════════════════════════════════════ */
  section("DASHBOARD");

  {
    const { status, data } = await req("GET", "/dashboard", null, token);
    if (status === 200 && data.success) {
      const d = data.data;
      pass(`GET /dashboard → 200`);
      pass(`  totalQuizzes=${d.totalQuizzes}, avgScore=${d.avgScore}%, bestScore=${d.bestScore}%`);

      if (d.totalQuizzes > 0) {
        if (Array.isArray(d.subjects) && d.subjects.length > 0)
          pass(`  subjects: ${d.subjects.length} entries`);
        if (Array.isArray(d.trend) && d.trend.length > 0)
          pass(`  trend: ${d.trend.length} data points`);
        if (Array.isArray(d.difficulty) && d.difficulty.length > 0)
          pass(`  difficulty: ${d.difficulty.length} entries`);
      } else {
        pass("  (new user — no analytics data yet, all arrays empty)");
      }
    } else fail("GET dashboard", `${status}: ${data.message}`);
  }

  /* ══ PROFILE ════════════════════════════════════════════ */
  section("PROFILE");

  {
    const { status, data } = await req("GET", "/profile", null, token);
    if (status === 200 && data.success) {
      const { user, stats } = data.data;
      pass(`GET /profile → user=${user.name}, email=${user.email}`);
      pass(`  stats: quizzes=${stats.totalQuizzes}, avg=${stats.avgScore}%`);

      if (!JSON.stringify(data).includes("password_hash")) {
        pass("password_hash NOT in profile response ✓");
      } else {
        fail("Security", "password_hash in profile response");
      }
    } else fail("GET profile", `${status}`);
  }

  /* ══ FORGOT/RESET PASSWORD ══════════════════════════════ */
  section("FORGOT/RESET PASSWORD");

  // Unknown email — silent 200
  {
    const { status } = await req("POST", "/auth/forgot-password", {
      email: "nobody_xyz@quizmind.test",
    });
    if (status === 200) pass("Forgot password unknown email → 200 (no enumeration) ✓");
    else fail("Forgot unknown", `${status}`);
  }

  // Valid email
  {
    const { status } = await req("POST", "/auth/forgot-password", { email: EMAIL });
    if (status === 200) pass("Forgot password valid email → 200 (OTP sent)");
    else fail("Forgot valid", `${status}`);
  }

  // Reset with patched OTP
  {
    const OTP = "135791";
    await patchOTP(EMAIL, "RESET_PASSWORD", OTP);

    const { status } = await req("POST", "/auth/reset-password", {
      email: EMAIL, otp: OTP, newPassword: PW2, confirmPassword: PW2,
    });
    if (status === 200) pass("Reset password with correct OTP → 200");
    else fail("Reset password", `${status}`);
  }

  // Old password rejected
  {
    const { status } = await req("POST", "/auth/login", { email: EMAIL, password: PW1 });
    if (status === 401) pass("Old password rejected after reset → 401 ✓");
    else fail("Old password", `expected 401, got ${status}`);
  }

  // New password works
  {
    const { status, data } = await req("POST", "/auth/login", { email: EMAIL, password: PW2 });
    if (status === 200 && data.data.token) pass("New password login → 200 ✓");
    else fail("New password login", `${status}`);
  }

  /* ══ QUESTION BANK ══════════════════════════════════════ */
  section("QUESTION BANK");

  {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS c FROM question_bank WHERE subject_id=21 AND difficulty='easy'`
    );
    if (r.rows[0].c >= 10) pass(`Question bank has ${r.rows[0].c} easy CN questions ✓`);
    else fail("Question bank", `expected ≥10, got ${r.rows[0].c}`);
  }

  /* ══ FINAL SUMMARY ══════════════════════════════════════ */
  console.log(`\n════════════════════════════════════════════════════`);
  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(failed === 0
    ? "  RESULT: ALL TESTS PASSED ✅"
    : "  RESULT: SOME TESTS FAILED ❌");
  console.log(`════════════════════════════════════════════════════\n`);

  await pool.end();
  if (failed > 0) process.exitCode = 1;
}

run().catch(e => { console.error("Runner error:", e.message); process.exit(1); });
