"use strict";

const crypto = require("crypto");
const bcrypt = require("bcrypt");

// OTP configuration
const OTP_LENGTH      = 6;
const OTP_EXPIRY_MINS = 10;   // OTP expires after 10 minutes
const OTP_SALT_ROUNDS = 10;   // lower than password — OTP is short-lived

/**
 * Generate a cryptographically secure 6-digit OTP.
 * Uses crypto.randomInt so it is uniformly distributed.
 * @returns {string} e.g. "483921"
 */
function generateOTP() {
  const min = Math.pow(10, OTP_LENGTH - 1);   // 100000
  const max = Math.pow(10, OTP_LENGTH) - 1;   // 999999
  return String(crypto.randomInt(min, max + 1)).padStart(OTP_LENGTH, "0");
}

/**
 * Hash a plaintext OTP with bcrypt.
 * We never store the raw OTP — only its hash.
 * @param {string} otp
 * @returns {Promise<string>} — bcrypt hash
 */
async function hashOTP(otp) {
  return bcrypt.hash(otp, OTP_SALT_ROUNDS);
}

/**
 * Compare a submitted OTP against a stored bcrypt hash.
 * @param {string} otp       — plaintext from user
 * @param {string} otpHash   — bcrypt hash from DB
 * @returns {Promise<boolean>}
 */
async function verifyOTP(otp, otpHash) {
  return bcrypt.compare(otp, otpHash);
}

/**
 * Calculate the OTP expiry timestamp (current time + OTP_EXPIRY_MINS).
 * @returns {Date}
 */
function getOTPExpiry() {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + OTP_EXPIRY_MINS);
  return expiry;
}

/**
 * Check if an OTP record has expired.
 * @param {Date|string} expiresAt
 * @returns {boolean}
 */
function isOTPExpired(expiresAt) {
  return new Date() > new Date(expiresAt);
}

module.exports = {
  generateOTP,
  hashOTP,
  verifyOTP,
  getOTPExpiry,
  isOTPExpired,
  OTP_EXPIRY_MINS,
};
