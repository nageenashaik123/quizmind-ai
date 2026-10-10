#!/usr/bin/env node
"use strict";
/**
 * QuizMind AI — Production Database Setup
 * Run ONCE against Neon after setting DATABASE_URL.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node server/db/setup-production.js
 *
 * What it does:
 *   1. Creates all 9 tables (schema.sql)
 *   2. Seeds 4 domains + 25 subjects (seed.sql)
 *   3. Verifies the data
 */

// Load env only if not in production (Render injects vars)
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Required for Neon
});

async function run() {
  console.log("🚀 QuizMind AI — Production DB Setup");
  console.log("Database:", process.env.DATABASE_URL?.split("@")[1] || "unknown");

  try {
    // 1. Run schema
    console.log("\n📋 Creating tables...");
    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    await pool.query(schema);
    console.log("✅ Tables created");

    // 2. Run seed
    console.log("\n🌱 Seeding domains and subjects...");
    const seed = fs.readFileSync(path.join(__dirname, "seed.sql"), "utf8");
    await pool.query(seed);
    console.log("✅ Seed data inserted");

    // 3. Verify
    const domains  = await pool.query("SELECT COUNT(*)::int AS c FROM domains");
    const subjects = await pool.query("SELECT COUNT(*)::int AS c FROM subjects");
    const tables   = await pool.query(
      "SELECT COUNT(*)::int AS c FROM pg_tables WHERE schemaname='public'"
    );

    console.log("\n📊 Verification:");
    console.log(`  Tables:   ${tables.rows[0].c} (expected 9)`);
    console.log(`  Domains:  ${domains.rows[0].c} (expected 4)`);
    console.log(`  Subjects: ${subjects.rows[0].c} (expected 25)`);

    if (domains.rows[0].c === 4 && subjects.rows[0].c === 25) {
      console.log("\n✅ Production database ready!");
    } else {
      console.error("\n❌ Data mismatch — check seed.sql");
      process.exitCode = 1;
    }
  } catch (err) {
    console.error("\n❌ Setup failed:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
