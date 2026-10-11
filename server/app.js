"use strict";

const express = require("express");
const cors    = require("cors");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

// ─────────────────────────────────────────────
// Core middleware
// ─────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    const allowed = [
      "https://quizmind-ai-three.vercel.app",
      "http://localhost:5500",
      "http://127.0.0.1:5500",
      "http://localhost:3000",
      // Allow any Vercel preview deployment
      /\.vercel\.app$/,
    ];

    const isAllowed = allowed.some(a =>
      typeof a === "string" ? a === origin : a.test(origin)
    );

    // Also allow custom FRONTEND_URL from env
    const envUrl = process.env.FRONTEND_URL;
    if (envUrl && envUrl !== "*" && origin === envUrl) return callback(null, true);
    if (envUrl === "*") return callback(null, true);

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[cors] Blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// ─────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success:     true,
    message:     "QuizMind AI backend is running",
    timestamp:   new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// ─────────────────────────────────────────────
// API routes
// ─────────────────────────────────────────────

// Auth (register, login, verify-otp, forgot/reset password)
app.use("/api/auth", require("./routes/authRoutes"));

// Domains + subjects (public)
app.use("/api/domains", require("./routes/domainRoutes"));

// Quizzes (AI generation + retrieval + submit)
app.use("/api/quizzes", require("./routes/quizRoutes"));

// Attempts (history + result + review)
app.use("/api/attempts", require("./routes/attemptRoutes"));

// Dashboard analytics
app.use("/api/dashboard", require("./routes/dashboardRoutes"));

// Profile
app.use("/api/profile", require("./routes/profileRoutes"));

// Placeholders — registered in later phases:
//   app.use("/api/attempts",  require("./routes/attemptRoutes"));
//   app.use("/api/dashboard", require("./routes/dashboardRoutes"));
//   app.use("/api/profile",   require("./routes/profileRoutes"));

// ─────────────────────────────────────────────
// Error handling — must be LAST
// ─────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
