"use strict";

const { query } = require("../../config/db");

// ─────────────────────────────────────────────
// User queries
// All SQL is parameterised — never string-concatenated with user input.
// ─────────────────────────────────────────────

/**
 * Create a new user.
 * @param {string} name
 * @param {string} email
 * @param {string} passwordHash  — bcrypt hash, never plaintext
 * @returns {Promise<object>}    — the newly inserted user row
 */
async function createUser(name, email, passwordHash) {
  const result = await query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, email_verified, created_at`,
    [name, email, passwordHash]
  );
  return result.rows[0];
}

/**
 * Find a user by email address.
 * Used during login and OTP verification.
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function findUserByEmail(email) {
  const result = await query(
    `SELECT id, name, email, password_hash, email_verified, created_at
     FROM users
     WHERE email = $1`,
    [email]
  );
  return result.rows[0] || null;
}

/**
 * Find a user by their primary key id.
 * Used by the auth middleware to validate JWT payload.
 * @param {number} id
 * @returns {Promise<object|null>}
 */
async function findUserById(id) {
  const result = await query(
    `SELECT id, name, email, email_verified, created_at
     FROM users
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Mark a user's email as verified.
 * Called after successful OTP verification.
 * @param {string} email
 * @returns {Promise<object|null>} — updated user row
 */
async function markEmailVerified(email) {
  const result = await query(
    `UPDATE users
     SET email_verified = TRUE
     WHERE email = $1
     RETURNING id, name, email, email_verified`,
    [email]
  );
  return result.rows[0] || null;
}

/**
 * Update a user's password hash.
 * Called after a successful password reset.
 * @param {string} email
 * @param {string} passwordHash  — new bcrypt hash
 * @returns {Promise<object|null>}
 */
async function updatePassword(email, passwordHash) {
  const result = await query(
    `UPDATE users
     SET password_hash = $2
     WHERE email = $1
     RETURNING id, name, email`,
    [email, passwordHash]
  );
  return result.rows[0] || null;
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  markEmailVerified,
  updatePassword,
};
