"use strict";
/**
 * QuizMind AI — Forgot/Reset Password Test Script
 * Run: node tests/test-reset.js
 * Requires server running on port 5000.
 */

require("dotenv").config();
const { Pool }  = require("pg");
const bcrypt    = require("bcrypt");

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
  console.log("  QuizMind AI — Password Reset Tests");
  console.log("════════════════════════════════════════\n");

  // ── Seed: create a verified test user ────────────────────
  const email       = `reset_test_${Date.now()}@quizmind.test`;
  const originalPwd = "Original@1234";
  const newPwd      = "NewPass@5678";

  // Register + auto-verify via DB (same trick as auth tests)
  await req("POST", "/auth/register", {
    name: "Reset Tester",
    email,
    password: originalPwd,
    confirmPassword: originalPwd,
  });

  // Patch OTP to known value and verify
  const knownOtp  = "654321";
  const knownHash = await bcrypt.hash(knownOtp, 10);
  await pool.query(
    `UPDATE otp_verifications
     SET otp_hash = $1, expires_at = NOW() + INTERVAL '10 minutes'
     WHERE email = $2 AND purpose = 'REGISTER' AND verified = FALSE`,
    [knownHash, email]
  );
  await req("POST", "/auth/verify-otp", { email, otp: knownOtp, purpose: "REGISTER" });

  // Confirm user is now verified + can login
  const loginCheck = await req("POST", "/auth/login", { email, password: originalPwd });
  if (loginCheck.status !== 200) {
    fail("Seed user setup", `Could not login seed user: ${loginCheck.data.message}`);
    await pool.end(); return;
  }
  pass("Seed: verified user created and login confirmed");

  // ── TEST 1: Forgot password — unknown email (silent 200) ─
  console.log("\n--- FORGOT PASSWORD ---");
  {
    const { status, data } = await req("POST", "/auth/forgot-password", {
      email: "nobody_unknown@quizmind.test",
    });
    if (status === 200 && data.success) {
      pass("Unknown email returns silent 200 (no enumeration)");
    } else {
      fail("Unknown email", `status=${status}`);
    }
  }

  // ── TEST 2: Forgot password — valid email sends OTP ──────
  {
    const { status, data } = await req("POST", "/auth/forgot-password", { email });
    if (status === 200 && data.success) {
      pass("Valid email: reset OTP sent (200)");
    } else {
      fail("Forgot password valid email", `status=${status} msg=${data.message}`);
      await pool.end(); return;
    }
  }

  // ── Verify OTP record created in DB ──────────────────────
  {
    const result = await pool.query(
      `SELECT otp_hash, expires_at FROM otp_verifications
       WHERE email = $1 AND purpose = 'RESET_PASSWORD' AND verified = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );
    if (result.rows[0]) {
      pass("RESET_PASSWORD OTP record created in DB");
    } else {
      fail("OTP record", "not found in DB");
      await pool.end(); return;
    }
  }

  // ── Patch OTP to known value for testing ─────────────────
  const resetOtp     = "789012";
  const resetOtpHash = await bcrypt.hash(resetOtp, 10);
  await pool.query(
    `UPDATE otp_verifications
     SET otp_hash = $1, expires_at = NOW() + INTERVAL '10 minutes'
     WHERE email = $2 AND purpose = 'RESET_PASSWORD' AND verified = FALSE`,
    [resetOtpHash, email]
  );
  pass("DB OTP patched to known value (789012) for test");

  // ── TEST 3: Reset with wrong OTP ─────────────────────────
  console.log("\n--- RESET PASSWORD ---");
  {
    const { status, data } = await req("POST", "/auth/reset-password", {
      email, otp: "000000",
      newPassword: newPwd, confirmPassword: newPwd,
    });
    if (status === 400 && !data.success) {
      pass("Wrong OTP rejected (400)");
    } else {
      fail("Wrong OTP", `status=${status} msg=${data.message}`);
    }
  }

  // ── TEST 4: Reset with password too short ─────────────────
  {
    const { status, data } = await req("POST", "/auth/reset-password", {
      email, otp: resetOtp,
      newPassword: "abc", confirmPassword: "abc",
    });
    if (status === 400 && !data.success) {
      pass("Short new password rejected (400)");
    } else {
      fail("Short password", `status=${status} msg=${data.message}`);
    }
  }

  // ── TEST 5: Reset with mismatched passwords ───────────────
  {
    const { status, data } = await req("POST", "/auth/reset-password", {
      email, otp: resetOtp,
      newPassword: newPwd, confirmPassword: "Different1!",
    });
    if (status === 400 && !data.success) {
      pass("Password mismatch rejected (400)");
    } else {
      fail("Password mismatch", `status=${status} msg=${data.message}`);
    }
  }

  // ── TEST 6: Reset with correct OTP + valid password ───────
  {
    const { status, data } = await req("POST", "/auth/reset-password", {
      email, otp: resetOtp,
      newPassword: newPwd, confirmPassword: newPwd,
    });
    if (status === 200 && data.success) {
      pass("Password reset with correct OTP (200)");
    } else {
      fail("Correct OTP reset", `status=${status} msg=${data.message}`);
    }
  }

  // ── TEST 7: OTP record deleted after reset ────────────────
  {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count FROM otp_verifications
       WHERE email = $1 AND purpose = 'RESET_PASSWORD'`,
      [email]
    );
    if (result.rows[0].count === 0) {
      pass("OTP records cleaned up after successful reset");
    } else {
      fail("OTP cleanup", `${result.rows[0].count} records remain`);
    }
  }

  // ── TEST 8: Login with OLD password fails ─────────────────
  console.log("\n--- LOGIN AFTER RESET ---");
  {
    const { status, data } = await req("POST", "/auth/login", {
      email, password: originalPwd,
    });
    if (status === 401 && !data.success) {
      pass("Old password rejected after reset (401)");
    } else {
      fail("Old password after reset", `status=${status} msg=${data.message}`);
    }
  }

  // ── TEST 9: Login with NEW password succeeds ──────────────
  {
    const { status, data } = await req("POST", "/auth/login", {
      email, password: newPwd,
    });
    if (status === 200 && data.success && data.data.token) {
      pass("Login with new password success (200) — JWT received");
    } else {
      fail("New password login", `status=${status} msg=${data.message}`);
    }
  }

  // ── TEST 10: Reuse same OTP fails (already cleaned up) ────
  console.log("\n--- OTP REUSE PREVENTION ---");
  {
    const { status, data } = await req("POST", "/auth/reset-password", {
      email, otp: resetOtp,
      newPassword: "AnotherPass@1", confirmPassword: "AnotherPass@1",
    });
    if (status === 400 && !data.success) {
      pass("OTP reuse blocked after successful reset (400)");
    } else {
      fail("OTP reuse", `status=${status} msg=${data.message}`);
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
