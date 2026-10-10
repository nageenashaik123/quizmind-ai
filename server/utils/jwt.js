"use strict";

const jwt = require("jsonwebtoken");
const env = require("../config/env");

/**
 * Generate a signed JWT for a user.
 * @param {object} payload  — data to embed (id, email, name)
 * @returns {string}        — signed token string
 */
function generateToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN, // e.g. "7d"
  });
}

/**
 * Verify a JWT and return its decoded payload.
 * @param {string} token
 * @returns {object}  — decoded payload
 * @throws            — JsonWebTokenError | TokenExpiredError
 */
function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

module.exports = { generateToken, verifyToken };
