"use strict";
/**
 * QuizMind AI — OTP + Auth Flow Test Script
 * Run: node tests/test-otp.js
 * Requires server running on port 5000.
 *
 * Tests:
 *  1.  Register new user → 201, requiresVerification true
 *  2.  Login before verification → 403
 *  3.  Verify OTP with wrong code → 400
 *  4.  Read actual OTP from DB and verify it → 200 + email verified
 *  5.  Login after verification → 200 + JWT
 *  6.  Duplicate registration on verified email → 409
 *  7.  Resend OTP on verified email → 400
 *  8.  GET /me with valid token → 200
 */

require("dotenv").config();
const { Pool }    = require("pg");
const bcrypt      = require("bcrypt");

const BASE = "http://localhost:5000/api";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

function pass(label)        { console.log(`  ✅  ${label}`); }
function fail(label, detail){ console.error(`  ❌  ${label}: ${detail}`); process.exitCode = 1; }

async function run() {
  console.log("\n════════════════════════════════════════");
  console.log("  QuizMind AI — OTP Flow Tests");
  console.log("════════════════════════════════════════\n");

  const email = `otp_test_${Date.now()}@quizmind.test`;
  let token   = null;

  // ── TEST 1: Register new user ─────────────────────────────
  console.log("--- REGISTER + OTP SEND ---");
  {
    const { status, data } = await req("POST", "/auth/register", {
      name: "OTP Tester",
      email,
      password: "Test@1234",
      confirmPassword: "Test@1234",
    });
    if (status === 201 && data.success && data.data.requiresVerification) {
      pass("Register returns 201 with requiresVerification=true");
    } else {
      fail("Register", `status=${status} msg=${data.message}`);
      await pool.end(); return;
    }
  }

  // ── TEST 2: Login before OTP verification ─────────────────
  console.log("\n--- LOGIN BEFORE VERIFICATION ---");
  {
    const { status, data } = await req("POST", "/auth/login", {
      email, password: "Test@1234",
    });
    if (status === 403 && data.requiresVerification) {
      pass("Login before verification blocked (403)");
    } else {
      fail("Login before verification", `status=${status} msg=${data.message}`);
    }
  }

  // ── TEST 3: Verify with wrong OTP ────────────────────────
  console.log("\n--- OTP VERIFICATION ---");
  {
    const { status, data } = await req("POST", "/auth/verify-otp", {
      email, otp: "000000", purpose: "REGISTER",
    }, null);
    if (status === 400 && !data.success) {
      pass("Wrong OTP rejected (400)");
    } else {
      fail("Wrong OTP", `status=${status} msg=${data.message}`);
    }
  }

  // ── TEST 4: Read real OTP from DB and verify ──────────────
  {
    // Read the stored OTP hash from DB
    const otpRow = await pool.query(
      `SELECT otp_hash, expires_at FROM otp_verifications
       WHERE email = $1 AND purpose = 'REGISTER' AND verified = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );

    if (!otpRow.rows[0]) {
      fail("OTP record in DB", "not found");
      await pool.end(); return;
    }
    pass("OTP record found in database");

    // We can't reverse the hash — so we generate a fresh OTP through the resend
    // endpoint, then read the NEW hash and brute-check "000000"-"999999"
    // That would take too long. Instead: call resend to get a new OTP,
    // then intercept it by reading the DB hash and comparing known candidates.
    //
    // Simplest approach for testing: resend, then read the raw hash and use
    // bcrypt.compare with incrementing candidates until we find the match.
    // We'll try up to 10 sequential values near a known starting point.
    // Better approach: temporarily log OTP to console for test only.
    //
    // ACTUAL approach used: call /resend-otp, which creates a new OTP record.
    // Then scan the DB for the hash and brute-force compare. Since this is a
    // 6-digit number (1M possibilities) we can't brute force in a test.
    //
    // PRAGMATIC TEST APPROACH:
    // We patch the DB directly — set a known OTP hash — then verify it.
    const knownOtp  = "123456";
    const knownHash = await bcrypt.hash(knownOtp, 10);
    const futureExp = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `UPDATE otp_verifications
       SET otp_hash = $1, expires_at = $2
       WHERE email = $3 AND purpose = 'REGISTER' AND verified = FALSE`,
      [knownHash, futureExp, email]
    );
    pass("DB OTP patched to known value (123456) for test");

    const { status, data } = await req("POST", "/auth/verify-otp", {
      email, otp: knownOtp, purpose: "REGISTER",
    });
    if (status === 200 && data.success) {
      pass("Correct OTP accepted (200) — email verified");
    } else {
      fail("Correct OTP", `status=${status} msg=${data.message}`);
    }
  }

  // ── TEST 5: Verify email_verified = true in DB ────────────
  {
    const result = await pool.query(
      "SELECT email_verified FROM users WHERE email = $1", [email]
    );
    if (result.rows[0] && result.rows[0].email_verified) {
      pass("email_verified = true in database");
    } else {
      fail("email_verified in DB", "still false");
    }
  }

  // ── TEST 6: Login after verification ─────────────────────
  console.log("\n--- LOGIN AFTER VERIFICATION ---");
  {
    const { status, data } = await req("POST", "/auth/login", {
      email, password: "Test@1234",
    });
    if (status === 200 && data.success && data.data.token) {
      token = data.data.token;
      pass("Login after verification success (200) — JWT received");
    } else {
      fail("Login after verification", `status=${status} msg=${data.message}`);
    }
  }

  // ── TEST 7: Duplicate registration on verified email ──────
  console.log("\n--- DUPLICATE / RESEND EDGE CASES ---");
  {
    const { status, data } = await req("POST", "/auth/register", {
      name: "Dup User",
      email,
      password: "Test@1234",
      confirmPassword: "Test@1234",
    });
    if (status === 409 && !data.success) {
      pass("Duplicate verified email rejected (409)");
    } else {
      fail("Duplicate email", `status=${status} msg=${data.message}`);
    }
  }

  // ── TEST 8: Resend OTP on verified email ──────────────────
  {
    const { status, data } = await req("POST", "/auth/resend-otp", {
      email, purpose: "REGISTER",
    });
    if (status === 400 && !data.success) {
      pass("Resend OTP on verified email blocked (400)");
    } else {
      fail("Resend on verified", `status=${status} msg=${data.message}`);
    }
  }

  // ── TEST 9: GET /me with JWT ──────────────────────────────
  console.log("\n--- PROTECTED ROUTE ---");
  {
    const { status, data } = await req("GET", "/auth/me", null, token);
    if (status === 200 && data.success && data.data.user.email === email) {
      pass("GET /me with valid token (200)");
    } else {
      fail("GET /me", `status=${status} msg=${data.message}`);
    }
  }

  console.log("\n════════════════════════════════════════");
  console.log(process.exitCode ? "  RESULT: SOME TESTS FAILED" : "  RESULT: ALL TESTS PASSED");
  console.log("════════════════════════════════════════\n");

  await pool.end();
}

run().catch((err) => {
  console.error("Test runner error:", err.message);
  pool.end();
  process.exit(1);
});
