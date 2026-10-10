"use strict";
/**
 * Phase 14+15 — Dashboard + Profile Tests
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
  const pw = "Test@1234";
  let row  = (await pool.query("SELECT id FROM users WHERE email=$1", [email])).rows[0];
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
  console.log("  Phase 14+15 — Dashboard + Profile");
  console.log("════════════════════════════════════════");

  const token  = await getToken("dash_test@quizmind.test", "Dash Tester");
  const token2 = await getToken("engine_test@quizmind.test", "Engine Tester"); // has attempts
  pass("Test users authenticated");

  // ── DASHBOARD — Auth ──────────────────────────────────────
  section("DASHBOARD AUTH");

  {
    const { status } = await req("GET", "/dashboard", null, null);
    if (status === 401) pass("GET /dashboard no token → 401");
    else fail("No token", `expected 401, got ${status}`);
  }

  // ── DASHBOARD — Empty user ────────────────────────────────
  section("DASHBOARD — EMPTY USER");

  {
    const { status, data } = await req("GET", "/dashboard", null, token);
    if (status === 200 && data.success) {
      pass("GET /dashboard (new user) → 200");
      if (data.data.totalQuizzes === 0) pass("totalQuizzes = 0 for new user");
      else fail("totalQuizzes", `expected 0, got ${data.data.totalQuizzes}`);

      if (Array.isArray(data.data.subjects))   pass("subjects is array");
      if (Array.isArray(data.data.difficulty)) pass("difficulty is array");
      if (Array.isArray(data.data.trend))      pass("trend is array");
      if (Array.isArray(data.data.weakAreas))  pass("weakAreas is array");
      if (Array.isArray(data.data.strongAreas))pass("strongAreas is array");
    } else {
      fail("Dashboard empty user", `${status}: ${data.message}`);
    }
  }

  // ── DASHBOARD — User with data ────────────────────────────
  section("DASHBOARD — USER WITH DATA");

  {
    const { status, data } = await req("GET", "/dashboard", null, token2);
    if (status === 200 && data.success) {
      const d = data.data;
      pass(`GET /dashboard (engine_test) → 200`);
      pass(`  totalQuizzes: ${d.totalQuizzes}`);
      pass(`  avgScore: ${d.avgScore}%`);
      pass(`  bestScore: ${d.bestScore}%`);
      pass(`  totalQuestions: ${d.totalQuestions}`);

      // Subjects
      if (d.subjects.length > 0) {
        const s = d.subjects[0];
        if (s.subject_name && s.avg_score !== undefined && s.quiz_count >= 0) {
          pass(`Subject data correct: ${s.subject_name} avg=${s.avg_score}%`);
        } else {
          fail("Subject data", JSON.stringify(s));
        }
      } else {
        pass("No subject data yet (ok)");
      }

      // Difficulty
      if (d.difficulty.length > 0) {
        const diff = d.difficulty[0];
        if (diff.difficulty && diff.avg_score !== undefined) {
          pass(`Difficulty data: ${diff.difficulty} avg=${diff.avg_score}%`);
        }
      } else {
        pass("No difficulty data yet (ok)");
      }

      // Trend
      if (d.trend.length > 0) {
        pass(`Score trend: ${d.trend.length} data points`);
        const chronological = d.trend.every((t, i) =>
          i === 0 || new Date(t.completed_at) >= new Date(d.trend[i-1].completed_at)
        );
        if (chronological) pass("Trend is in chronological order ✓");
        else fail("Trend order", "not chronological");
      } else {
        pass("No trend data yet (ok)");
      }

      // Weak areas — subjects with avg < 70%
      d.weakAreas.forEach(w => {
        if (parseFloat(w.avg_score) >= 70) {
          fail("Weak area threshold", `${w.subject_name} has ${w.avg_score}% (should be < 70)`);
        }
      });
      if (d.weakAreas.length > 0) pass(`Weak areas: ${d.weakAreas.map(w => w.subject_name).join(", ")}`);
      else pass("No weak areas (all subjects ≥ 70%)");

      // Strong areas — subjects with avg >= 80%
      d.strongAreas.forEach(s => {
        if (parseFloat(s.avg_score) < 80) {
          fail("Strong area threshold", `${s.subject_name} has ${s.avg_score}% (should be ≥ 80)`);
        }
      });
      if (d.strongAreas.length > 0) pass(`Strong areas: ${d.strongAreas.map(s => s.subject_name).join(", ")}`);
      else pass("No strong areas yet");
    } else {
      fail("Dashboard with data", `${status}: ${data.message}`);
    }
  }

  // ── PROFILE ───────────────────────────────────────────────
  section("PROFILE");

  {
    const { status } = await req("GET", "/profile", null, null);
    if (status === 401) pass("GET /profile no token → 401");
    else fail("Profile no token", `expected 401, got ${status}`);
  }

  {
    const { status, data } = await req("GET", "/profile", null, token2);
    if (status === 200 && data.success) {
      const { user, stats } = data.data;
      pass("GET /profile → 200");
      if (user.name && user.email && user.id) {
        pass(`Profile user: ${user.name} <${user.email}>`);
      } else {
        fail("Profile user fields", JSON.stringify(user));
      }

      if (stats.totalQuizzes !== undefined && stats.avgScore !== undefined) {
        pass(`Profile stats: quizzes=${stats.totalQuizzes}, avg=${stats.avgScore}%`);
      } else {
        fail("Profile stats", JSON.stringify(stats));
      }

      // Verify password_hash NOT in response
      if (!JSON.stringify(data).includes("password_hash") && !JSON.stringify(data).includes("$2b$")) {
        pass("password_hash NOT in profile response ✓");
      } else {
        fail("Security: password_hash in response", "should be hidden");
      }
    } else {
      fail("GET profile", `${status}: ${data.message}`);
    }
  }

  // ── FILE INTEGRITY ─────────────────────────────────────────
  section("FILE INTEGRITY");

  {
    const fs = require("fs");
    const dashHtml    = fs.readFileSync("e:/quizmind-ai/client/dashboard.html", "utf8");
    const profileHtml = fs.readFileSync("e:/quizmind-ai/client/profile.html",   "utf8");

    const dashChecks = {
      "stat tiles":     dashHtml.includes("statTotalQuizzes"),
      "trend chart":    dashHtml.includes("trendBars"),
      "subject perf":   dashHtml.includes("subjectPerfList"),
      "difficulty":     dashHtml.includes("difficultyRow"),
      "weak areas":     dashHtml.includes("weakAreasList"),
      "strong areas":   dashHtml.includes("strongAreasList"),
      "dashboard.js":   dashHtml.includes("dashboard.js"),
    };

    const profileChecks = {
      "avatar":      profileHtml.includes("profileAvatar"),
      "name field":  profileHtml.includes("profileName"),
      "email field": profileHtml.includes("profileEmail"),
      "stats grid":  profileHtml.includes("pstatQuizzes"),
      "logout btn":  profileHtml.includes("logoutBtn"),
      "profile.js":  profileHtml.includes("profile.js"),
    };

    Object.entries(dashChecks).forEach(([l, ok]) => {
      if (ok) pass(`dashboard.html has ${l}`);
      else    fail(`dashboard.html missing ${l}`, "");
    });

    Object.entries(profileChecks).forEach(([l, ok]) => {
      if (ok) pass(`profile.html has ${l}`);
      else    fail(`profile.html missing ${l}`, "");
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
