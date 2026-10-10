"use strict";

const express  = require("express");
const router   = express.Router();
const { register, login, getMe, verifyOtp, resendOtp, forgotPassword, resetPassword } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

// POST /api/auth/register       — create account + send OTP
router.post("/register",    register);

// POST /api/auth/verify-otp     — verify 6-digit code
router.post("/verify-otp",  verifyOtp);

// POST /api/auth/resend-otp     — resend OTP (rate limited)
router.post("/resend-otp",  resendOtp);

// POST /api/auth/login          — authenticate + get JWT
router.post("/login",       login);

// GET  /api/auth/me             — get current user (protected)
router.get("/me",  protect, getMe);

// POST /api/auth/forgot-password  — send reset OTP
router.post("/forgot-password",  forgotPassword);

// POST /api/auth/reset-password   — verify OTP + set new password
router.post("/reset-password",   resetPassword);

module.exports = router;
