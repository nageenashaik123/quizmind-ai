"use strict";

const express = require("express");
const router  = express.Router();
const { getDashboard, getProfile } = require("../controllers/dashboardController");
const { protect } = require("../middleware/authMiddleware");

// GET /api/dashboard  — full analytics
router.get("/", protect, getDashboard);

module.exports = router;
