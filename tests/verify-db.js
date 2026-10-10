"use strict";

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verify() {
  // Test 1: domain count and names
  const domains = await pool.query("SELECT id, name FROM domains ORDER BY id");
  console.log("\n--- Domains (" + domains.rowCount + ") ---");
  domains.rows.forEach((r) => console.log("  " + r.id + ". " + r.name));

  // Test 2: subject count per domain
  const subjects = await pool.query(`
    SELECT d.name AS domain, COUNT(s.id)::int AS count
    FROM domains d
    LEFT JOIN subjects s ON s.domain_id = d.id
    GROUP BY d.id, d.name
    ORDER BY d.id
  `);
  console.log("\n--- Subjects per domain ---");
  subjects.rows.forEach((r) =>
    console.log("  " + r.domain + ": " + r.count + " subjects")
  );

  // Test 3: all 8 expected tables exist
  const tables = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  console.log("\n--- Tables (" + tables.rowCount + ") ---");
  tables.rows.forEach((r) => console.log("  " + r.tablename));

  const expected = [
    "attempt_answers",
    "attempts",
    "domains",
    "otp_verifications",
    "questions",
    "quizzes",
    "subjects",
    "users",
  ];
  const found = tables.rows.map((r) => r.tablename);
  const missing = expected.filter((t) => !found.includes(t));

  if (missing.length > 0) {
    console.error("\nMISSING TABLES:", missing);
    process.exitCode = 1;
  } else {
    console.log("\nAll 8 tables present.");
  }

  // Summary
  const totalSubjects = subjects.rows.reduce((sum, r) => sum + r.count, 0);
  console.log("\n--- Summary ---");
  console.log("  Domains  : " + domains.rowCount + " (expected 4)");
  console.log("  Subjects : " + totalSubjects + " (expected 25)");
  console.log("  Tables   : " + tables.rowCount + " (expected 8)");

  if (domains.rowCount === 4 && totalSubjects === 25 && tables.rowCount === 8) {
    console.log("\n  RESULT: ALL CHECKS PASSED");
  } else {
    console.error("\n  RESULT: SOME CHECKS FAILED");
    process.exitCode = 1;
  }

  await pool.end();
}

verify().catch((err) => {
  console.error("DB verification error:", err.message);
  process.exit(1);
});
