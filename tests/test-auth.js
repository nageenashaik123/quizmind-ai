"use strict";
/**
 * QuizMind AI — Auth API Test Script
 * Run: node tests/test-auth.js
 * Requires server to be running on port 5000.
 */

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

function pass(label) { console.log(`  ✅  ${label}`); }
function fail(label, detail) { console.error(`  ❌  ${label}: ${detail}`); process.exitCode = 1; }

async function run() {
  console.log("\n════════════════════════════════════════");
  console.log("  QuizMind AI — Auth Tests");
  console.log("════════════════════════════════════════\n");

  const testEmail = `test_${Date.now()}@quizmind.test`;
  let token = null;

  // ── TEST 1: Register with valid data ──────────────────────
  console.log("--- REGISTER ---");
  {
    const { status, data } = await req("POST", "/auth/register", {
      name: "Test Student",
      email: testEmail,
      password: "Test@1234",
      confirmPassword: "Test@1234",
    });
    if (status === 201 && data.success) pass(`Register new user (201)`);
    else fail(`Register new user`, `status=${status} msg=${data.message}`);
  }

  // ── TEST 2: Duplicate email ───────────────────────────────
  {
    const { status, data } = await req("POST", "/auth/register", {
      name: "Test Student",
      email: testEmail,
      password: "Test@1234",
      confirmPassword: "Test@1234",
    });
    if (status === 409 && !data.success) pass(`Duplicate email rejected (409)`);
    else fail(`Duplicate email`, `status=${status} msg=${data.message}`);
  }

  // ── TEST 3: Register — missing name ──────────────────────
  {
    const { status, data } = await req("POST", "/auth/register", {
      name: "",
      email: "another@test.com",
      password: "Test@1234",
      confirmPassword: "Test@1234",
    });
    if (status === 400 && !data.success) pass(`Missing name rejected (400)`);
    else fail(`Missing name`, `status=${status} msg=${data.message}`);
  }

  // ── TEST 4: Register — password too short ─────────────────
  {
    const { status, data } = await req("POST", "/auth/register", {
      name: "Test",
      email: "short@test.com",
      password: "abc",
      confirmPassword: "abc",
    });
    if (status === 400 && !data.success) pass(`Short password rejected (400)`);
    else fail(`Short password`, `status=${status} msg=${data.message}`);
  }

  // ── TEST 5: Register — passwords don't match ─────────────
  {
    const { status, data } = await req("POST", "/auth/register", {
      name: "Test",
      email: "mismatch@test.com",
      password: "Test@1234",
      confirmPassword: "Different1",
    });
    if (status === 400 && !data.success) pass(`Password mismatch rejected (400)`);
    else fail(`Password mismatch`, `status=${status} msg=${data.message}`);
  }

  // ── TEST 6: Login with correct credentials ────────────────
  console.log("\n--- LOGIN ---");
  {
    const { status, data } = await req("POST", "/auth/login", {
      email: testEmail,
      password: "Test@1234",
    });
    if (status === 200 && data.success && data.data.token) {
      token = data.data.token;
      pass(`Login success (200) — JWT received`);
      pass(`User name in response: ${data.data.user.name}`);
    } else {
      fail(`Login`, `status=${status} msg=${data.message}`);
    }
  }

  // ── TEST 7: Login — wrong password ───────────────────────
  {
    const { status, data } = await req("POST", "/auth/login", {
      email: testEmail,
      password: "WrongPassword1",
    });
    if (status === 401 && !data.success) pass(`Wrong password rejected (401)`);
    else fail(`Wrong password`, `status=${status} msg=${data.message}`);
  }

  // ── TEST 8: Login — non-existent email ───────────────────
  {
    const { status, data } = await req("POST", "/auth/login", {
      email: "nobody@quizmind.test",
      password: "Test@1234",
    });
    if (status === 401 && !data.success) pass(`Unknown email rejected (401)`);
    else fail(`Unknown email`, `status=${status} msg=${data.message}`);
  }

  // ── TEST 9: Protected route — GET /api/auth/me with valid token ──
  console.log("\n--- PROTECTED ROUTE ---");
  {
    const { status, data } = await req("GET", "/auth/me", null, token);
    if (status === 200 && data.success && data.data.user.email === testEmail) {
      pass(`GET /api/auth/me with valid token (200)`);
      pass(`Returned user: ${data.data.user.name} <${data.data.user.email}>`);
    } else {
      fail(`GET /me with valid token`, `status=${status} msg=${data.message}`);
    }
  }

  // ── TEST 10: Protected route — no token ──────────────────
  {
    const { status, data } = await req("GET", "/auth/me", null, null);
    if (status === 401 && !data.success) pass(`No token rejected (401)`);
    else fail(`No token`, `status=${status} msg=${data.message}`);
  }

  // ── TEST 11: Protected route — invalid token ─────────────
  {
    const { status, data } = await req("GET", "/auth/me", null, "invalid.token.here");
    if (status === 401 && !data.success) pass(`Invalid token rejected (401)`);
    else fail(`Invalid token`, `status=${status} msg=${data.message}`);
  }

  // ── TEST 12: Verify user exists in DB ────────────────────
  console.log("\n--- DATABASE ---");
  {
    require("dotenv").config();
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query(
      "SELECT id, name, email, email_verified FROM users WHERE email = $1",
      [testEmail]
    );
    await pool.end();
    const user = result.rows[0];
    if (user && user.email_verified) {
      pass(`User found in DB: id=${user.id} email_verified=${user.email_verified}`);
    } else {
      fail(`User in DB`, `not found or not verified`);
    }
  }

  console.log("\n════════════════════════════════════════");
  console.log(process.exitCode ? "  RESULT: SOME TESTS FAILED" : "  RESULT: ALL TESTS PASSED");
  console.log("════════════════════════════════════════\n");
}

run().catch((err) => {
  console.error("Test runner error:", err.message);
  process.exit(1);
});
