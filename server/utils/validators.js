"use strict";

/**
 * Validate an email address format.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  // RFC-5322 simplified pattern — covers all realistic email formats
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email.trim());
}

/**
 * Validate password meets minimum requirements.
 * @param {string} password
 * @returns {{ valid: boolean, message: string }}
 */
function validatePassword(password) {
  if (!password || typeof password !== "string") {
    return { valid: false, message: "Password is required." };
  }
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters." };
  }
  if (password.length > 128) {
    return { valid: false, message: "Password must be under 128 characters." };
  }
  return { valid: true, message: "" };
}

/**
 * Validate a name field.
 * @param {string} name
 * @returns {{ valid: boolean, message: string }}
 */
function validateName(name) {
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return { valid: false, message: "Name is required." };
  }
  if (name.trim().length < 2) {
    return { valid: false, message: "Name must be at least 2 characters." };
  }
  if (name.trim().length > 100) {
    return { valid: false, message: "Name must be under 100 characters." };
  }
  return { valid: true, message: "" };
}

/**
 * Sanitise a string — trim and remove dangerous characters.
 * Use on all user-supplied text before storing.
 * @param {string} str
 * @returns {string}
 */
function sanitiseString(str) {
  if (!str || typeof str !== "string") return "";
  return str.trim().replace(/[<>]/g, "");
}

module.exports = {
  isValidEmail,
  validatePassword,
  validateName,
  sanitiseString,
};
