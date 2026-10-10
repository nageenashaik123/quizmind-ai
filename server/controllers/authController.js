"use strict";

const { createUser, findUserByEmail, markEmailVerified, updatePassword } = require("../db/queries/userQueries");
const { hashPassword, comparePassword } = require("../utils/password");
const { generateToken }                 = require("../utils/jwt");
const { generateOTP, hashOTP, verifyOTP, getOTPExpiry, isOTPExpired } = require("../utils/otp");
const { createOTP, findLatestOTP, markOTPVerified, countRecentOTPs, deleteOTPs } = require("../db/queries/otpQueries");
const { sendRegistrationOTP }           = require("../services/emailService");
const {
  isValidEmail,
  validatePassword,
  validateName,
  sanitiseString,
} = require("../utils/validators");

// Max OTP attempts in a 10-minute window (anti-abuse)
const MAX_OTP_RESENDS = 5;

// ─────────────────────────────────────────────
// POST /api/auth/register
//
// Phase 6 flow:
//   1. Validate all fields
//   2. Check email not already taken
//   3. Hash password, create user (email_verified = FALSE)
//   4. Generate + hash OTP
//   5. Store OTP in otp_verifications
//   6. Send OTP email
//   7. Return success with email (frontend redirects to verify-otp)
// ─────────────────────────────────────────────
async function register(req, res, next) {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // ── Validate inputs ───────────────────────
    const nameCheck = validateName(name);
    if (!nameCheck.valid) {
      return res.status(400).json({ success: false, message: nameCheck.message });
    }

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }

    const passCheck = validatePassword(password);
    if (!passCheck.valid) {
      return res.status(400).json({ success: false, message: passCheck.message });
    }

    if (!confirmPassword || password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match." });
    }

    const cleanName  = sanitiseString(name);
    const cleanEmail = sanitiseString(email).toLowerCase();

    // ── Check duplicate email ─────────────────
    const existing = await findUserByEmail(cleanEmail);
    if (existing) {
      // If already registered but unverified — allow re-sending OTP
      if (!existing.email_verified) {
        await sendNewOTP(cleanEmail, existing.name, "REGISTER");
        return res.status(200).json({
          success: true,
          message: "A verification code has been sent to your email.",
          data:    { email: cleanEmail, requiresVerification: true },
        });
      }
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // ── Create user (unverified) ──────────────
    const passwordHash = await hashPassword(password);
    const newUser      = await createUser(cleanName, cleanEmail, passwordHash);

    // ── Send OTP ──────────────────────────────
    await sendNewOTP(cleanEmail, cleanName, "REGISTER");

    return res.status(201).json({
      success: true,
      message: "Account created. Please check your email for a verification code.",
      data:    { email: cleanEmail, requiresVerification: true },
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────
// POST /api/auth/verify-otp
//
// Flow:
//   1. Validate email + OTP fields
//   2. Find latest unverified OTP record
//   3. Check not expired
//   4. Verify OTP hash
//   5. Mark OTP verified + mark email verified
//   6. Return success (frontend redirects to login)
// ─────────────────────────────────────────────
async function verifyOtp(req, res, next) {
  try {
    const { email, otp, purpose = "REGISTER" } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Valid email is required." });
    }

    if (!otp || String(otp).length !== 6) {
      return res.status(400).json({ success: false, message: "Please enter the 6-digit code." });
    }

    const cleanEmail = sanitiseString(email).toLowerCase();

    // ── Find OTP record ───────────────────────
    const record = await findLatestOTP(cleanEmail, purpose);
    if (!record) {
      return res.status(400).json({
        success: false,
        message: "No verification code found. Please request a new one.",
      });
    }

    // ── Check expiry ──────────────────────────
    if (isOTPExpired(record.expires_at)) {
      return res.status(400).json({
        success: false,
        message: "This code has expired. Please request a new one.",
        expired: true,
      });
    }

    // ── Verify hash ───────────────────────────
    const isMatch = await verifyOTP(String(otp), record.otp_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Incorrect code. Please try again.",
      });
    }

    // ── Mark verified ─────────────────────────
    await markOTPVerified(record.id);

    if (purpose === "REGISTER") {
      await markEmailVerified(cleanEmail);
      await deleteOTPs(cleanEmail, purpose);

      return res.status(200).json({
        success: true,
        message: "Email verified successfully! You can now log in.",
      });
    }

    // For RESET_PASSWORD: OTP is verified but password hasn't been changed yet.
    // The reset-password endpoint will handle setting the new password.
    return res.status(200).json({
      success: true,
      message: "Code verified. You can now set a new password.",
      data:    { email: cleanEmail, otpVerified: true },
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────
// POST /api/auth/resend-otp
//
// Rate-limited: max 5 resends per 10 minutes per email.
// ─────────────────────────────────────────────
async function resendOtp(req, res, next) {
  try {
    const { email, purpose = "REGISTER" } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Valid email is required." });
    }

    const cleanEmail = sanitiseString(email).toLowerCase();

    // ── Check user exists ─────────────────────
    const user = await findUserByEmail(cleanEmail);
    if (!user) {
      // Security: don't reveal if email is registered
      return res.status(200).json({
        success: true,
        message: "If that email is registered, a new code has been sent.",
      });
    }

    if (purpose === "REGISTER" && user.email_verified) {
      return res.status(400).json({
        success: false,
        message: "This email is already verified.",
      });
    }

    // ── Rate limit check ──────────────────────
    const recentCount = await countRecentOTPs(cleanEmail, purpose, 10);
    if (recentCount >= MAX_OTP_RESENDS) {
      return res.status(429).json({
        success: false,
        message: "Too many code requests. Please wait 10 minutes before trying again.",
      });
    }

    // ── Send new OTP ──────────────────────────
    await sendNewOTP(cleanEmail, user.name, purpose);

    return res.status(200).json({
      success: true,
      message: "A new verification code has been sent to your email.",
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }

    if (!password) {
      return res.status(400).json({ success: false, message: "Password is required." });
    }

    const cleanEmail = sanitiseString(email).toLowerCase();
    const user       = await findUserByEmail(cleanEmail);

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const passwordMatch = await comparePassword(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    if (!user.email_verified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in.",
        requiresVerification: true,
        email: user.email,
      });
    }

    const token = generateToken({ id: user.id, email: user.email, name: user.name });

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email },
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────
// GET /api/auth/me  (protected)
// ─────────────────────────────────────────────
async function getMe(req, res) {
  return res.status(200).json({ success: true, data: { user: req.user } });
}

// ─────────────────────────────────────────────
// Internal helper — generate, store and email an OTP
// ─────────────────────────────────────────────
async function sendNewOTP(email, name, purpose) {
  const otp       = generateOTP();
  const otpHash   = await hashOTP(otp);
  const expiresAt = getOTPExpiry();

  await createOTP(email, otpHash, purpose, expiresAt);
  await sendRegistrationOTP(email, name, otp);
}

// ─────────────────────────────────────────────
// POST /api/auth/forgot-password
//
// Flow:
//   1. Validate email
//   2. Silently succeed if email not registered (prevents enumeration)
//   3. Rate-limit resend attempts
//   4. Generate + hash OTP with purpose = RESET_PASSWORD
//   5. Send password reset email
// ─────────────────────────────────────────────
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }

    const cleanEmail = sanitiseString(email).toLowerCase();

    // Find user — but always return the same response to prevent email enumeration
    const user = await findUserByEmail(cleanEmail);

    const silentOk = {
      success: true,
      message: "If that email is registered, a reset code has been sent.",
    };

    if (!user) return res.status(200).json(silentOk);

    // Rate limit: max 5 OTPs per 10 minutes
    const recentCount = await countRecentOTPs(cleanEmail, "RESET_PASSWORD", 10);
    if (recentCount >= MAX_OTP_RESENDS) {
      return res.status(429).json({
        success: false,
        message: "Too many reset requests. Please wait 10 minutes before trying again.",
      });
    }

    // Generate OTP and send email
    const otp       = generateOTP();
    const otpHash   = await hashOTP(otp);
    const expiresAt = getOTPExpiry();

    await createOTP(cleanEmail, otpHash, "RESET_PASSWORD", expiresAt);

    // Use the password reset email template
    const { sendPasswordResetOTP } = require("../services/emailService");
    await sendPasswordResetOTP(cleanEmail, user.name, otp);

    return res.status(200).json(silentOk);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────
// POST /api/auth/reset-password
//
// Flow:
//   1. Validate email, OTP, new password
//   2. Find latest RESET_PASSWORD OTP
//   3. Check not expired
//   4. Verify OTP hash
//   5. Hash new password + update in users table
//   6. Mark OTP verified + delete all reset OTPs for this email
// ─────────────────────────────────────────────
async function resetPassword(req, res, next) {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Valid email is required." });
    }

    if (!otp || String(otp).length !== 6) {
      return res.status(400).json({ success: false, message: "Please enter the 6-digit reset code." });
    }

    const passCheck = validatePassword(newPassword);
    if (!passCheck.valid) {
      return res.status(400).json({ success: false, message: passCheck.message });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match." });
    }

    const cleanEmail = sanitiseString(email).toLowerCase();

    // ── Find OTP record ───────────────────────
    const record = await findLatestOTP(cleanEmail, "RESET_PASSWORD");
    if (!record) {
      return res.status(400).json({
        success: false,
        message: "No reset code found. Please request a new one.",
      });
    }

    // ── Check expiry ──────────────────────────
    if (isOTPExpired(record.expires_at)) {
      return res.status(400).json({
        success: false,
        message: "This reset code has expired. Please request a new one.",
        expired: true,
      });
    }

    // ── Verify OTP ────────────────────────────
    const isMatch = await verifyOTP(String(otp), record.otp_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Incorrect reset code. Please try again.",
      });
    }

    // ── Update password ───────────────────────
    const passwordHash = await hashPassword(newPassword);
    const updated      = await updatePassword(cleanEmail, passwordHash);

    if (!updated) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // ── Clean up OTP records ──────────────────
    await markOTPVerified(record.id);
    await deleteOTPs(cleanEmail, "RESET_PASSWORD");

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now log in with your new password.",
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getMe, verifyOtp, resendOtp, forgotPassword, resetPassword };
