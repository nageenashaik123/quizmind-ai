"use strict";

require("dotenv").config();

// Validate required environment variables on startup.
const required = ["PORT", "DATABASE_URL", "JWT_SECRET", "JWT_EXPIRES_IN", "EMAIL_FROM", "EMAIL_API_KEY"];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`[env] FATAL: Missing required environment variable: ${key}`);
    console.error(`[env] Copy .env.example to .env and fill in the values.`);
    process.exit(1);
  }
}

// Warn (don't crash) if no AI providers configured
const hasAI = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.OLLAMA_BASE_URL;
if (!hasAI) {
  console.warn("[env] WARNING: No AI provider configured. Quiz generation will not work.");
}

const env = {
  // Server
  PORT:     parseInt(process.env.PORT, 10) || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",

  // Database
  DATABASE_URL: process.env.DATABASE_URL,

  // JWT
  JWT_SECRET:    process.env.JWT_SECRET,
  JWT_EXPIRES_IN:process.env.JWT_EXPIRES_IN,

  // Email
  EMAIL_API_KEY: process.env.EMAIL_API_KEY || "",
  EMAIL_FROM:    process.env.EMAIL_FROM    || "",

  // AI — Gemini (primary)
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  GEMINI_MODEL:   process.env.GEMINI_MODEL   || "gemini-1.5-flash",

  // AI — Groq (fallback #1)
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
  GROQ_MODEL:   process.env.GROQ_MODEL   || "llama-3.1-8b-instant",

  // AI — Ollama (fallback #2, local)
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  OLLAMA_MODEL:    process.env.OLLAMA_MODEL    || "phi3:mini",
};

module.exports = env;
