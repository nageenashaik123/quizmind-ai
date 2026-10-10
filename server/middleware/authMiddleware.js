"use strict";

const { verifyToken } = require("../utils/jwt");
const { findUserById } = require("../db/queries/userQueries");

/**
 * protect — JWT authentication middleware.
 *
 * Extracts the Bearer token from the Authorization header,
 * verifies it, fetches the user from the database, and
 * attaches the user object to req.user.
 *
 * Usage: add to any route that requires authentication.
 *   router.get("/profile", protect, profileController.getProfile);
 */
async function protect(req, res, next) {
  try {
    // 1. Extract token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Please log in.",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    // 2. Verify token signature and expiry
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Session expired. Please log in again.",
        });
      }
      return res.status(401).json({
        success: false,
        message: "Invalid token. Please log in again.",
      });
    }

    // 3. Confirm the user still exists in the database
    // This prevents a deleted user's token from working
    const user = await findUserById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists. Please register again.",
      });
    }

    // 4. Attach the user to the request — controllers can use req.user
    // Important: we attach only safe fields, NOT password_hash
    req.user = {
      id:            user.id,
      name:          user.name,
      email:         user.email,
      emailVerified: user.email_verified,
      createdAt:     user.created_at,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * requireVerified — ensures the logged-in user's email is verified.
 * Must be used AFTER protect middleware.
 *
 * Usage:
 *   router.post("/quizzes/generate", protect, requireVerified, quizController.generate);
 */
function requireVerified(req, res, next) {
  if (!req.user || !req.user.emailVerified) {
    return res.status(403).json({
      success: false,
      message: "Please verify your email address before continuing.",
    });
  }
  next();
}

module.exports = { protect, requireVerified };
