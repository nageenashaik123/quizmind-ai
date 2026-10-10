"use strict";

const express = require("express");
const router  = express.Router();
const { getProfile } = require("../controllers/dashboardController");
const { protect } = require("../middleware/authMiddleware");

// GET /api/profile
router.get("/", protect, getProfile);

module.exports = router;
