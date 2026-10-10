"use strict";

const express = require("express");
const router  = express.Router();
const { getAttempt, getReview, listAttempts } = require("../controllers/quizController");
const { protect } = require("../middleware/authMiddleware");

// GET  /api/attempts              — list user's quiz history
router.get("/",            protect, listAttempts);

// GET  /api/attempts/:id          — single attempt result
router.get("/:id",         protect, getAttempt);

// GET  /api/attempts/:id/review   — full answer review
router.get("/:id/review",  protect, getReview);

module.exports = router;
