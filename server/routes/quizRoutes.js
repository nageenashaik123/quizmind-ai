"use strict";

const express = require("express");
const router  = express.Router();
const { generateQuiz, getQuiz, submitQuiz } = require("../controllers/quizController");
const { protect, requireVerified } = require("../middleware/authMiddleware");

// POST /api/quizzes/generate
router.post("/generate",   protect, requireVerified, generateQuiz);

// GET  /api/quizzes/:id
router.get("/:id",         protect, getQuiz);

// POST /api/quizzes/:id/submit
router.post("/:id/submit", protect, requireVerified, submitQuiz);

module.exports = router;
