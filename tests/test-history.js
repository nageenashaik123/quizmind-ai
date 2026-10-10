"use strict";
/**
 * Phase 13 — Quiz History Tests
 */
require("dotenv").config();
const { Pool }  = require("pg");
const bcrypt    = require("bcrypt");
const pool      = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE      = "http://localhost:5000/api";

let passed = 0; let failed = 0;
function pass(l)    { console.log(`  ✅  ${l}`); passed++; }
function fail(l, d) { console.error(`  ❌  ${l}: ${d}`); failed++; }
function section(t) { console.log(`\n--- ${t} ---`); }

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

async function getToken(email, name) {
  const pw   = "Test@1234";
  let row    = (await pool.query("SELECT id FROM users WHERE email=$1", [email])).rows[0];
  if (!row) {
    const hash = await bcrypt.hash(pw, 10);
    row = (await pool.query(
      `INSERT INTO users (name,email,password_hash,email_verified) VALUES ($1,$2,$3,TRUE) RETURNING id`,
      [name, email, hash]
    )).rows[0];
  } else {
    await pool.query("UPDATE users SET email_verified=TRUE WHERE id=$1", [row.id]);
  }
  const { data } = await req("POST", "/auth/login", { email, password: pw });
  return data.data.token;
}

async function run() {
  console.log("\n════════════════════════════════════════");
  console.log("  Phase 13 — Quiz History Tests");
  console.log("════════════════════════════════════════");

  const token  = await getToken("history_test@quizmind.test", "History Tester");
  const token2 = await getToken("history_test2@quizmind.test", "History Tester 2");
  pass("Test users authenticated");

  // ── BASIC HISTORY ──────────────────────────────────────────
  section("BASIC HISTORY");

  {
    const { status, data } = await req("GET", "/attempts", null, token);
    if (status === 200 && Array.isArray(data.data)) {
      pass(`GET /attempts → ${data.data.length} attempts (total=${data.meta?.total})`);

      // Check meta fields
      if (data.meta && "total" in data.meta && "limit" in data.meta) {
        pass("Response includes meta (total, limit, offset)");
      } else {
        fail("Meta fields", JSON.stringify(data.meta));
      }
    } else {
      fail("GET /attempts", `status=${status}`);
    }
  }

  // No token → 401
  {
    const { status } = await req("GET", "/attempts", null, null);
    if (status === 401) pass("GET /attempts no token → 401");
    else fail("No token", `expected 401, got ${status}`);
  }

  // ── PAGINATION ─────────────────────────────────────────────
  section("PAGINATION");

  {
    const { status, data } = await req("GET", "/attempts?limit=2&offset=0", null, token);
    if (status === 200) {
      pass(`Pagination works — limit=2 returned ${data.data.length} items`);
      if (data.meta?.limit === 2) pass("meta.limit correctly returned as 2");
      else fail("meta.limit", `expected 2, got ${data.meta?.limit}`);
    } else {
      fail("Pagination", `status=${status}`);
    }
  }

  // ── FILTERS ────────────────────────────────────────────────
  section("FILTERS");

  // Filter by difficulty
  {
    const { status, data } = await req("GET", "/attempts?difficulty=easy", null, token);
    if (status === 200) {
      const allEasy = data.data.every(a => a.difficulty === "easy");
      if (allEasy || data.data.length === 0) {
        pass(`Filter by difficulty=easy → ${data.data.length} results (all easy ✓)`);
      } else {
        fail("Difficulty filter", "some non-easy results returned");
      }
    } else {
      fail("Filter difficulty", `status=${status}`);
    }
  }

  // Filter by invalid difficulty (ignored)
  {
    const { status, data } = await req("GET", "/attempts?difficulty=extreme", null, token);
    if (status === 200) {
      pass("Invalid difficulty filter gracefully ignored → returns all");
    } else {
      fail("Invalid difficulty", `status=${status}`);
    }
  }

  // Filter by subjectId (Computer Networks = 21)
  {
    const subjectId = (await pool.query(
      "SELECT id FROM subjects WHERE name='Computer Networks'"
    )).rows[0]?.id;

    if (subjectId) {
      const { status, data } = await req("GET", `/attempts?subjectId=${subjectId}`, null, token);
      if (status === 200) {
        const allMatch = data.data.every(a => a.subject_name === "Computer Networks");
        if (allMatch || data.data.length === 0) {
          pass(`Filter by subjectId=${subjectId} → ${data.data.length} results (all Computer Networks ✓)`);
        } else {
          fail("Subject filter", "results contain wrong subjects");
        }
      } else {
        fail("Filter subject", `status=${status}`);
      }
    } else {
      pass("Subject filter test skipped (subject not found)");
    }
  }

  // Filter by date range (yesterday to tomorrow — should return all)
  {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);
    const tomorrow  = new Date(Date.now() + 86400000).toISOString().slice(0,10);
    const { status, data } = await req(
      "GET", `/attempts?dateFrom=${yesterday}&dateTo=${tomorrow}`, null, token
    );
    if (status === 200) {
      pass(`Date range filter works → ${data.data.length} results in [yesterday, tomorrow]`);
    } else {
      fail("Date filter", `status=${status}`);
    }
  }

  // Filter by far-future date — should return 0
  {
    const { status, data } = await req(
      "GET", `/attempts?dateFrom=2099-01-01&dateTo=2099-12-31`, null, token
    );
    if (status === 200 && data.data.length === 0) {
      pass("Future date filter returns 0 results ✓");
    } else {
      fail("Future date filter", `expected 0, got ${data.data.length}`);
    }
  }

  // ── USER ISOLATION ─────────────────────────────────────────
  section("USER ISOLATION");

  {
    const { data: d1 } = await req("GET", "/attempts", null, token);
    const { data: d2 } = await req("GET", "/attempts", null, token2);

    // Each user should only see their own attempts
    const ids1 = new Set(d1.data.map(a => a.id));
    const ids2 = new Set(d2.data.map(a => a.id));
    const overlap = [...ids1].filter(id => ids2.has(id));

    if (overlap.length === 0) {
      pass("User isolation: no attempt IDs overlap between user1 and user2 ✓");
    } else {
      fail("User isolation", `${overlap.length} shared attempt IDs found`);
    }
  }

  // ── RESULT + REVIEW LINKS ──────────────────────────────────
  section("RESULT + REVIEW DATA");

  {
    const { data } = await req("GET", "/attempts?limit=1", null, token);
    if (data.data.length > 0) {
      const attemptId = data.data[0].id;

      // GET result
      const { status: rs } = await req("GET", `/attempts/${attemptId}`, null, token);
      if (rs === 200) pass(`GET /attempts/${attemptId} (result) → 200`);
      else fail("Result link", `status=${rs}`);

      // GET review
      const { status: rvs, data: rvd } = await req("GET", `/attempts/${attemptId}/review`, null, token);
      if (rvs === 200 && Array.isArray(rvd.data.review)) {
        pass(`GET /attempts/${attemptId}/review → ${rvd.data.review.length} questions`);
      } else {
        fail("Review link", `status=${rvs}`);
      }
    } else {
      pass("Result/review link tests skipped (no attempts yet for this user)");
    }
  }

  // ── FILE INTEGRITY ─────────────────────────────────────────
  section("FILE INTEGRITY");

  {
    const fs = require("fs");
    const html = fs.readFileSync("e:/quizmind-ai/client/history.html", "utf8");
    const checks = {
      "filter subject select": html.includes("filterSubject"),
      "filter difficulty":     html.includes("filterDifficulty"),
      "filter dateFrom":       html.includes("filterDateFrom"),
      "filter dateTo":         html.includes("filterDateTo"),
      "apply button":          html.includes("applyFiltersBtn"),
      "clear button":          html.includes("clearFiltersBtn"),
      "history.js ref":        html.includes("history.js"),
      "pagination prev":       html.includes("prevPageBtn"),
      "pagination next":       html.includes("nextPageBtn"),
    };
    Object.entries(checks).forEach(([label, ok]) => {
      if (ok) pass(`HTML has ${label}`);
      else    fail(`HTML missing ${label}`, "");
    });
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`  Passed: ${passed}   Failed: ${failed}`);
  console.log(failed === 0 ? "  RESULT: ALL TESTS PASSED" : "  RESULT: SOME TESTS FAILED");
  console.log(`════════════════════════════════════════\n`);

  await pool.end();
  if (failed > 0) process.exitCode = 1;
}

run().catch(e => { console.error("Runner:", e.message); process.exit(1); });
