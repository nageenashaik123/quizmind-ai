/* ============================================================
   QuizMind AI — Common API Utility
   All backend communication goes through this file.
   Every other JS file calls these functions instead of
   writing raw fetch() calls everywhere.
   ============================================================ */

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

// Base URL of the Express backend.
// Automatically picks production URL when deployed, localhost in development.
const API_BASE_URL = (() => {
  // When running locally via Live Server or file://
  const isLocal =
    window.location.hostname === "localhost"       ||
    window.location.hostname === "127.0.0.1"       ||
    window.location.hostname === ""                ||
    window.location.hostname.endsWith(".local");

  if (isLocal) {
    return "http://localhost:5000/api";
  }

  // Production: Render backend
  return "https://quizmind-ai-backend-jsp2.onrender.com/api";
})();

// ─────────────────────────────────────────────
// Token helpers
// JWT is stored in localStorage under this key.
// ─────────────────────────────────────────────
const TOKEN_KEY = "quizmind_token";
const USER_KEY  = "quizmind_user";

/**
 * Save the JWT and user object after a successful login/register.
 * @param {string} token
 * @param {object} user
 */
function saveAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Retrieve the stored JWT, or null if not logged in.
 * @returns {string|null}
 */
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Retrieve the stored user object, or null.
 * @returns {object|null}
 */
function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Clear auth data — called on logout.
 */
function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Returns true if the user is currently logged in (token present).
 * Note: this does NOT verify the token with the server.
 * Protected pages call a real API to verify on every load.
 * @returns {boolean}
 */
function isLoggedIn() {
  return Boolean(getToken());
}

// ─────────────────────────────────────────────
// Core request function
// ─────────────────────────────────────────────

/**
 * Make an API request to the Express backend.
 *
 * @param {string} endpoint   — e.g. "/auth/login"
 * @param {object} [options]  — fetch options
 * @param {string} [options.method]   — HTTP method (default: "GET")
 * @param {object} [options.body]     — request body (will be JSON-stringified)
 * @param {boolean} [options.auth]    — whether to attach JWT header (default: true)
 * @returns {Promise<object>}         — parsed JSON response
 * @throws  {Error}                   — with .message and optional .status
 */
async function apiRequest(endpoint, options = {}) {
  const {
    method = "GET",
    body   = null,
    auth   = true,
  } = options;

  const headers = {
    "Content-Type": "application/json",
  };

  // Attach JWT if available and requested
  if (auth) {
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const config = {
    method,
    headers,
  };

  if (body !== null) {
    config.body = JSON.stringify(body);
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  } catch (networkError) {
    // Network failure (server down, no internet, etc.)
    const err = new Error(
      "Cannot connect to the server. Please check your connection."
    );
    err.status = 0;
    throw err;
  }

  // Parse response body as JSON regardless of status code
  // so we can read the error message from the server
  let data;
  try {
    data = await response.json();
  } catch {
    const err = new Error("Server returned an unexpected response.");
    err.status = response.status;
    throw err;
  }

  // If the response is not OK (2xx), throw with the server's message
  if (!response.ok) {
    const err = new Error(
      data.message || `Request failed with status ${response.status}`
    );
    err.status  = response.status;
    err.data    = data;

    // 401 means the JWT is invalid/expired — clear auth and redirect to login
    if (response.status === 401) {
      clearAuth();
      // Only redirect if not already on an auth page
      const authPages = ["/login.html", "/register.html", "/verify-otp.html",
                         "/forgot-password.html", "/reset-password.html", "/index.html"];
      const isAuthPage = authPages.some((p) => window.location.pathname.endsWith(p));
      if (!isAuthPage) {
        window.location.href = "/client/login.html";
      }
    }

    throw err;
  }

  return data;
}

// ─────────────────────────────────────────────
// Convenience wrappers
// ─────────────────────────────────────────────

/**
 * GET request.
 * @param {string} endpoint
 * @param {object} [opts]
 */
function apiGet(endpoint, opts = {}) {
  return apiRequest(endpoint, { method: "GET", ...opts });
}

/**
 * POST request.
 * @param {string} endpoint
 * @param {object} body
 * @param {object} [opts]
 */
function apiPost(endpoint, body, opts = {}) {
  return apiRequest(endpoint, { method: "POST", body, ...opts });
}

/**
 * PUT request.
 * @param {string} endpoint
 * @param {object} body
 * @param {object} [opts]
 */
function apiPut(endpoint, body, opts = {}) {
  return apiRequest(endpoint, { method: "PUT", body, ...opts });
}

/**
 * PATCH request.
 * @param {string} endpoint
 * @param {object} body
 * @param {object} [opts]
 */
function apiPatch(endpoint, body, opts = {}) {
  return apiRequest(endpoint, { method: "PATCH", body, ...opts });
}

/**
 * DELETE request.
 * @param {string} endpoint
 * @param {object} [opts]
 */
function apiDelete(endpoint, opts = {}) {
  return apiRequest(endpoint, { method: "DELETE", ...opts });
}

// ─────────────────────────────────────────────
// UI helpers (used by all page JS files)
// ─────────────────────────────────────────────

/**
 * Show an alert banner on an auth page.
 * @param {string} elementId   — id of the alert element
 * @param {string} message     — text to display
 * @param {'error'|'success'|'info'|'warning'} type
 */
function showAlert(elementId, message, type = "error") {
  const el = document.getElementById(elementId);
  if (!el) return;

  const icons = {
    error:   "❌",
    success: "✅",
    info:    "ℹ️",
    warning: "⚠️",
  };

  el.className = `auth-alert alert alert-${type} show`;
  el.innerHTML = `<span>${icons[type] || ""}</span> <span>${message}</span>`;

  // Scroll alert into view on mobile
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/**
 * Hide an alert banner.
 * @param {string} elementId
 */
function hideAlert(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.className = "auth-alert";
}

/**
 * Set a form field into an error state with a message.
 * @param {string} inputId     — id of the <input>
 * @param {string} errorId     — id of the error <span>
 * @param {string} message
 */
function setFieldError(inputId, errorId, message) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);
  if (input) input.classList.add("error");
  if (error) error.textContent = message;
}

/**
 * Clear a form field's error state.
 * @param {string} inputId
 * @param {string} errorId
 */
function clearFieldError(inputId, errorId) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);
  if (input) input.classList.remove("error");
  if (error) error.textContent = "";
}

/**
 * Clear all field errors in a form.
 * @param {string} formId
 */
function clearAllErrors(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.querySelectorAll(".form-input.error").forEach((el) =>
    el.classList.remove("error")
  );
  form.querySelectorAll(".form-error").forEach((el) =>
    (el.textContent = "")
  );
}

/**
 * Set a button to loading state (disabled + spinner).
 * @param {string} btnId
 * @param {string} [loadingText]
 */
function setButtonLoading(btnId, loadingText = "Please wait") {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = true;
  btn.dataset.originalText = btn.textContent;
  btn.textContent = loadingText;
  btn.classList.add("btn-loading");
}

/**
 * Restore a button from loading state.
 * @param {string} btnId
 */
function setButtonReady(btnId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = btn.dataset.originalText || btn.textContent;
  btn.classList.remove("btn-loading");
}

/**
 * Redirect helper.
 * @param {string} path — e.g. "/client/home.html"
 */
function redirectTo(path) {
  window.location.href = path;
}

/**
 * Guard: redirect to login if not authenticated.
 * Call this at the top of every protected page script.
 */
function requireAuth() {
  if (!isLoggedIn()) {
    redirectTo("/client/login.html");
  }
}

/**
 * Guard: redirect to home if already authenticated.
 * Call this on login/register pages to avoid showing them to logged-in users.
 */
function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    redirectTo("/client/home.html");
  }
}

/**
 * Calculate password strength score (0–4).
 * @param {string} password
 * @returns {0|1|2|3|4}
 */
function getPasswordStrength(password) {
  let score = 0;
  if (!password) return score;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, 4);
}

/**
 * Update the password strength UI bars and label.
 * @param {number} score — 0 to 4
 */
function updateStrengthUI(score) {
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const classes = ["", "weak", "fair", "good", "strong"];

  for (let i = 1; i <= 4; i++) {
    const bar = document.getElementById(`bar${i}`);
    if (!bar) continue;
    bar.className = "strength-bar";
    if (i <= score) bar.classList.add(classes[score]);
  }

  const label = document.getElementById("strengthLabel");
  if (label) {
    label.textContent = score > 0 ? `Password strength: ${labels[score]}` : "";
  }
}

// ─────────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────────

/**
 * Format seconds into mm:ss string.
 * @param {number} totalSeconds
 * @returns {string} e.g. "18:32"
 */
function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Format a date string into a readable format.
 * @param {string} isoString
 * @returns {string} e.g. "Oct 8, 2026"
 */
function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString("en-US", {
    year:  "numeric",
    month: "short",
    day:   "numeric",
  });
}

/**
 * Capitalise first letter of a string.
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
