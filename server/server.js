"use strict";

// Load and validate environment variables first — before anything else.
// If a required variable is missing, env.js will exit the process immediately
// with a clear message rather than letting the server start in a broken state.
const env = require("./config/env");

const app = require("./app");
const { testConnection } = require("./config/db");
const { ensureBankTable } = require("./db/queries/questionBankQueries");

// ─────────────────────────────────────────────
// Start the HTTP server
// ─────────────────────────────────────────────
const server = app.listen(env.PORT, async () => {
  console.log("─────────────────────────────────────────");
  console.log("  🧠 QuizMind AI — Backend Server");
  console.log("─────────────────────────────────────────");
  console.log(`  Environment : ${env.NODE_ENV}`);
  console.log(`  Port        : ${env.PORT}`);
  console.log(`  Health      : http://localhost:${env.PORT}/api/health`);
  console.log("─────────────────────────────────────────");

  // Verify database is reachable immediately after server starts
  await testConnection();
  // Ensure question bank table exists (idempotent — safe to run every startup)
  await ensureBankTable();
});

// ─────────────────────────────────────────────
// Graceful shutdown
// Handles Ctrl+C and process termination signals cleanly.
// ─────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n[server] ${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log("[server] HTTP server closed.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Catch unhandled promise rejections so they don't silently swallow errors
process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled Promise Rejection:", reason);
});
