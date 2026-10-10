"use strict";

const { Pool } = require("pg");
const env = require("./env");

// ─────────────────────────────────────────────
// PostgreSQL connection pool
//
// A Pool maintains multiple reusable connections so the app doesn't
// have to open/close a fresh TCP connection on every database query.
// pg will manage the pool size automatically.
// ─────────────────────────────────────────────
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // In production (Neon) we will need SSL. In local dev we don't.
  // This handles both automatically.
  ssl:
    env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  max: 10,               // maximum number of connections in the pool
  idleTimeoutMillis: 30000,  // close idle connections after 30s
  connectionTimeoutMillis: 5000, // error if connection takes > 5s
});

// Log when a new client connects (helpful during development)
pool.on("connect", () => {
  if (env.NODE_ENV === "development") {
    console.log("[db] New client connected to PostgreSQL pool");
  }
});

// Log and handle pool-level errors
pool.on("error", (err) => {
  console.error("[db] Unexpected PostgreSQL pool error:", err.message);
});

// ─────────────────────────────────────────────
// query helper
//
// All database queries in this project go through this function.
// Benefits:
//   - Centralised error logging
//   - Parameterised queries prevent SQL injection
//   - Easy to add query timing or tracing later
//
// Usage:
//   const { rows } = await query("SELECT * FROM users WHERE id = $1", [id]);
// ─────────────────────────────────────────────
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (env.NODE_ENV === "development") {
      console.log(`[db] query (${duration}ms):`, text.substring(0, 80));
    }
    return result;
  } catch (err) {
    console.error("[db] Query error:", err.message);
    console.error("[db] Query text:", text);
    throw err; // Re-throw so the controller/service can handle it
  }
}

// ─────────────────────────────────────────────
// testConnection
//
// Called once at server startup to confirm the database is reachable.
// ─────────────────────────────────────────────
async function testConnection() {
  try {
    const result = await pool.query("SELECT NOW() AS now");
    console.log(
      `[db] PostgreSQL connected successfully — server time: ${result.rows[0].now}`
    );
    return true;
  } catch (err) {
    console.error("[db] PostgreSQL connection FAILED:", err.message);
    return false;
  }
}

module.exports = { pool, query, testConnection };
