"use strict";

const { query } = require("../../config/db");

// ─────────────────────────────────────────────
// OTP verification queries
// ─────────────────────────────────────────────

/**
 * Create a new OTP record.
 * Any previous unverified OTPs for this email+purpose are deleted first
 * to prevent accumulation and enforce one-at-a-time.
 * @param {string} email
 * @param {string} otpHash    — bcrypt hash of the OTP
 * @param {string} purpose    — 'REGISTER' | 'RESET_PASSWORD'
 * @param {Date}   expiresAt
 * @returns {Promise<object>}
 */
async function createOTP(email, otpHash, purpose, expiresAt) {
  // Delete old unverified OTPs for this email + purpose
  await query(
    `DELETE FROM otp_verifications
     WHERE email = $1 AND purpose = $2 AND verified = FALSE`,
    [email, purpose]
  );

  const result = await query(
    `INSERT INTO otp_verifications (email, otp_hash, purpose, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, purpose, expires_at, verified, created_at`,
    [email, otpHash, purpose, expiresAt]
  );
  return result.rows[0];
}

/**
 * Find the latest unverified OTP for a given email and purpose.
 * Returns null if none found.
 * @param {string} email
 * @param {string} purpose
 * @returns {Promise<object|null>}
 */
async function findLatestOTP(email, purpose) {
  const result = await query(
    `SELECT id, email, otp_hash, purpose, expires_at, verified, created_at
     FROM otp_verifications
     WHERE email = $1 AND purpose = $2 AND verified = FALSE
     ORDER BY created_at DESC
     LIMIT 1`,
    [email, purpose]
  );
  return result.rows[0] || null;
}

/**
 * Mark an OTP record as verified.
 * @param {number} id — OTP record id
 * @returns {Promise<void>}
 */
async function markOTPVerified(id) {
  await query(
    `UPDATE otp_verifications SET verified = TRUE WHERE id = $1`,
    [id]
  );
}

/**
 * Count how many OTPs have been created for an email+purpose
 * in the last N minutes. Used to prevent resend abuse.
 * @param {string} email
 * @param {string} purpose
 * @param {number} withinMinutes
 * @returns {Promise<number>}
 */
async function countRecentOTPs(email, purpose, withinMinutes = 10) {
  const result = await query(
    `SELECT COUNT(*)::int AS count
     FROM otp_verifications
     WHERE email = $1
       AND purpose = $2
       AND created_at > NOW() - ($3 || ' minutes')::interval`,
    [email, purpose, String(withinMinutes)]
  );
  return result.rows[0].count;
}

/**
 * Delete all OTP records for an email + purpose.
 * Called after successful verification to clean up.
 * @param {string} email
 * @param {string} purpose
 */
async function deleteOTPs(email, purpose) {
  await query(
    `DELETE FROM otp_verifications WHERE email = $1 AND purpose = $2`,
    [email, purpose]
  );
}

module.exports = {
  createOTP,
  findLatestOTP,
  markOTPVerified,
  countRecentOTPs,
  deleteOTPs,
};
