"use strict";

// Only load .env file in development — Render/Vercel inject env vars directly
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// Required in all environments
const required = [
  "PORT",
  "DATABASE_URL",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
  "EMAIL_FROM",
  "EMAIL_API_KEY",
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`[env] FATAL: Missing required environment variable: ${key}`);
    console.error(`[env] In development: copy .env.example → .env and fill values.`);
    console.error(`[env] In production: set environment variables in your hosting dashboard.`);
    process.exit(1);
  }
}

// Warn if no AI provider configured
const hasAI =
  process.env.GEMINI_API_KEY ||
  process.env.GROQ_API_KEY   ||
  process.env.OLLAMA_BASE_URL;
if (!hasAI) {
  console.warn("[env] WARNING: No AI provider configured. Quiz generation will fall back to question bank only.");
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
  GEMINI_MODEL:   process.env.GEMINI_MODEL   || "gemini-flash-latest",

  // AI — Groq (fallback #1)
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
  GROQ_MODEL:   process.env.GROQ_MODEL   || "qwen/qwen3.8-27b",

  // AI — Ollama (fallback #2, local only — empty string disables it in production)
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || "",
  OLLAMA_MODEL:    process.env.OLLAMA_MODEL    || "phi3:mini",

  // Production frontend URL (for CORS)
  FRONTEND_URL: process.env.FRONTEND_URL || "*",
};

module.exports = env;
