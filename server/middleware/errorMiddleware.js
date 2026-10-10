"use strict";

/**
 * 404 handler — catches any request that didn't match a route.
 * Must be registered AFTER all routes in app.js.
 */
function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

/**
 * Central error handler — catches errors passed via next(err).
 * Express identifies this as an error handler because it has 4 parameters.
 * Must be the LAST middleware registered in app.js.
 */
function errorHandler(err, req, res, next) {
  // Log the full error in development so we can debug easily
  console.error("[errorHandler]", err);

  // Use the status code set on the error, or fall back to 500
  const statusCode = err.statusCode || err.status || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || "An unexpected server error occurred.",
    // Only expose stack trace in development — never in production
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
