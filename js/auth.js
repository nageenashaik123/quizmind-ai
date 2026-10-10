/* ============================================================
   QuizMind AI â€” Auth JavaScript  (Phase 6 â€” Real OTP)
   Handles: register, login, OTP verification, resend,
            password toggles, strength indicator, logout
   Depends on: js/api.js (must be loaded first)
   ============================================================ */

(function init() {
  const path = window.location.pathname;
  if (path.includes("login.html"))              initLogin();
  else if (path.includes("register.html"))      initRegister();
  else if (path.includes("verify-otp.html"))    initVerifyOtp();
  else if (path.includes("forgot-password.html")) initForgotPassword();
  else if (path.includes("reset-password.html"))  initResetPassword();
})();

/* ============================================================
   LOGIN
   ============================================================ */
function initLogin() {
  redirectIfLoggedIn();

  const form = document.getElementById("loginForm");
  if (!form) return;

  document.getElementById("togglePassword")?.addEventListener("click", () =>
    togglePasswordVisibility("password", "togglePassword")
  );
  document.getElementById("email")?.addEventListener("input",    () => clearFieldError("email",    "emailError"));
  document.getElementById("password")?.addEventListener("input", () => clearFieldError("password", "passwordError"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert("authAlert");
    clearAllErrors("loginForm");

    const email    = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    let hasError = false;
    if (!email || !isValidEmailFrontend(email)) {
      setFieldError("email", "emailError", "Please enter a valid email address.");
      hasError = true;
    }
    if (!password) {
      setFieldError("password", "passwordError", "Password is required.");
      hasError = true;
    }
    if (hasError) return;

    setButtonLoading("submitBtn", "Logging inâ€¦");

    try {
      const data = await apiPost("/auth/login", { email, password }, { auth: false });
      saveAuth(data.data.token, data.data.user);

      // If user was redirected here from a protected page, send them back
      const redirect = sessionStorage.getItem("redirectAfterLogin") || "/client/home.html";
      sessionStorage.removeItem("redirectAfterLogin");
      redirectTo(redirect);
    } catch (err) {
      if (err.data && err.data.requiresVerification) {
        sessionStorage.setItem("pendingEmail", err.data.email || email);
        redirectTo("/client/verify-otp.html");
        return;
      }
      showAlert("authAlert", err.message || "Login failed. Please try again.", "error");
      setButtonReady("submitBtn");
    }
  });
}

/* ============================================================
   REGISTER
   ============================================================ */
function initRegister() {
  redirectIfLoggedIn();

  const form = document.getElementById("registerForm");
  if (!form) return;

  document.getElementById("togglePassword")?.addEventListener("click",        () => togglePasswordVisibility("password",        "togglePassword"));
  document.getElementById("toggleConfirmPassword")?.addEventListener("click", () => togglePasswordVisibility("confirmPassword", "toggleConfirmPassword"));

  document.getElementById("password")?.addEventListener("input", (e) => {
    clearFieldError("password", "passwordError");
    updateStrengthUI(getPasswordStrength(e.target.value));
  });

  document.getElementById("name")?.addEventListener("input",            () => clearFieldError("name",            "nameError"));
  document.getElementById("email")?.addEventListener("input",           () => clearFieldError("email",           "emailError"));
  document.getElementById("confirmPassword")?.addEventListener("input", () => clearFieldError("confirmPassword", "confirmPasswordError"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert("authAlert");
    clearAllErrors("registerForm");

    const name            = document.getElementById("name").value.trim();
    const email           = document.getElementById("email").value.trim();
    const password        = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    let hasError = false;
    if (!name || name.length < 2) {
      setFieldError("name", "nameError", "Please enter your full name (at least 2 characters).");
      hasError = true;
    }
    if (!email || !isValidEmailFrontend(email)) {
      setFieldError("email", "emailError", "Please enter a valid email address.");
      hasError = true;
    }
    if (!password || password.length < 8) {
      setFieldError("password", "passwordError", "Password must be at least 8 characters.");
      hasError = true;
    }
    if (password !== confirmPassword) {
      setFieldError("confirmPassword", "confirmPasswordError", "Passwords do not match.");
      hasError = true;
    }
    if (hasError) return;

    setButtonLoading("submitBtn", "Creating accountâ€¦");

    try {
      const data = await apiPost("/auth/register", { name, email, password, confirmPassword }, { auth: false });

      // Phase 6: registration sends OTP â†’ go to verify page
      sessionStorage.setItem("pendingEmail", email);
      sessionStorage.setItem("authSuccess",
        data.message || "Account created! Check your email for the verification code."
      );
      redirectTo("/client/verify-otp.html");
    } catch (err) {
      showAlert("authAlert", err.message || "Registration failed. Please try again.", "error");
      setButtonReady("submitBtn");
    }
  });
}

/* ============================================================
   VERIFY OTP  (Phase 6 â€” real implementation)
   ============================================================ */
function initVerifyOtp() {
  const email = sessionStorage.getItem("pendingEmail") || "";

  // Populate email display fields
  const emailDisplay    = document.getElementById("otpEmailDisplay");
  const emailDisplayTop = document.getElementById("emailDisplay");
  if (emailDisplay)    emailDisplay.textContent  = email || "your email address";
  if (emailDisplayTop) emailDisplayTop.textContent = email || "your email address";

  // Show any success message from register page
  const msg = sessionStorage.getItem("authSuccess");
  if (msg) {
    sessionStorage.removeItem("authSuccess");
    setTimeout(() => showAlert("authAlert", msg, "info"), 100);
  }

  // Wire OTP digit boxes
  wireOtpInputs();

  // Start resend cooldown timer
  startResendTimer("resendBtn", "resendTimer", 120);

  // OTP form submit
  const otpForm = document.getElementById("otpForm");
  otpForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert("authAlert");

    const otp = getOtpValue();

    if (!email) {
      showAlert("authAlert", "Email not found. Please register again.", "error");
      return;
    }

    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      // Mark all boxes red
      for (let i = 1; i <= 6; i++) {
        document.getElementById(`otp${i}`)?.classList.add("error");
      }
      showAlert("authAlert", "Please enter the complete 6-digit code.", "error");
      return;
    }

    setButtonLoading("submitBtn", "Verifyingâ€¦");

    try {
      await apiPost("/auth/verify-otp", { email, otp, purpose: "REGISTER" }, { auth: false });

      // Success â€” show success view
      const verifyView  = document.getElementById("verifyView");
      const successView = document.getElementById("successView");
      if (verifyView)  verifyView.style.display  = "none";
      if (successView) successView.style.display = "block";

      sessionStorage.removeItem("pendingEmail");
    } catch (err) {
      // Clear OTP boxes on failure
      for (let i = 1; i <= 6; i++) {
        const box = document.getElementById(`otp${i}`);
        if (box) { box.value = ""; box.classList.remove("filled"); box.classList.add("error"); }
      }
      document.getElementById("otp1")?.focus();

      if (err.data && err.data.expired) {
        showAlert("authAlert",
          "This code has expired. Click Resend OTP to get a new one.", "warning");
      } else {
        showAlert("authAlert", err.message || "Incorrect code. Please try again.", "error");
      }
      setButtonReady("submitBtn");
    }
  });

  // Resend OTP button
  document.getElementById("resendBtn")?.addEventListener("click", async () => {
    if (!email) return;

    const resendBtn = document.getElementById("resendBtn");
    resendBtn.disabled = true;

    try {
      await apiPost("/auth/resend-otp", { email, purpose: "REGISTER" }, { auth: false });
      showAlert("authAlert", "A new code has been sent to your email.", "success");

      // Clear existing OTP boxes
      for (let i = 1; i <= 6; i++) {
        const box = document.getElementById(`otp${i}`);
        if (box) { box.value = ""; box.classList.remove("filled", "error"); }
      }
      document.getElementById("otp1")?.focus();

      // Restart the resend timer
      startResendTimer("resendBtn", "resendTimer", 120);
    } catch (err) {
      showAlert("authAlert", err.message || "Could not resend code. Please try again.", "error");
      resendBtn.disabled = false;
    }
  });
}

/* ============================================================
   FORGOT PASSWORD  (Phase 7 â€” real implementation)
   Two-step flow on forgot-password.html:
     Step 1 (#emailView)  â€” enter email â†’ POST /forgot-password
     Step 2 (#resetView)  â€” enter OTP + new password â†’ POST /reset-password
   ============================================================ */
function initForgotPassword() {
  // â”€â”€ Step 1: email form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const forgotForm = document.getElementById("forgotForm");
  if (!forgotForm) return;

  document.getElementById("email")?.addEventListener("input", () =>
    clearFieldError("email", "emailError")
  );

  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert("authAlert");
    clearAllErrors("forgotForm");

    const email = document.getElementById("email")?.value.trim();

    if (!email || !isValidEmailFrontend(email)) {
      setFieldError("email", "emailError", "Please enter a valid email address.");
      return;
    }

    setButtonLoading("submitBtn", "Sending codeâ€¦");

    try {
      await apiPost("/auth/forgot-password", { email }, { auth: false });

      // Store email for step 2
      sessionStorage.setItem("resetEmail", email);

      // Populate OTP email box and transition to step 2
      const otpEmailBox = document.getElementById("otpEmailBox");
      if (otpEmailBox) otpEmailBox.textContent = `Sent to: ${email}`;

      document.getElementById("emailView").style.display  = "none";
      document.getElementById("resetView").style.display  = "block";

      // Wire OTP inputs and start timer
      wireOtpInputs();
      startResendTimer("resendResetBtn", "resendTimer", 120);

      // Show confirmation
      showAlert("resetAlert",
        "A reset code has been sent to your email. Check your inbox.", "info"
      );
    } catch (err) {
      showAlert("authAlert", err.message || "Could not send reset code. Please try again.", "error");
      setButtonReady("submitBtn");
    }
  });

  // â”€â”€ Step 2: OTP + new password form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const resetForm = document.getElementById("resetForm");
  if (!resetForm) return;

  // Password visibility toggles
  document.getElementById("toggleNewPassword")?.addEventListener("click",        () =>
    togglePasswordVisibility("newPassword", "toggleNewPassword")
  );
  document.getElementById("toggleConfirmNewPassword")?.addEventListener("click", () =>
    togglePasswordVisibility("confirmNewPassword", "toggleConfirmNewPassword")
  );

  // Clear field errors on input
  document.getElementById("newPassword")?.addEventListener("input",        () => clearFieldError("newPassword",        "newPasswordError"));
  document.getElementById("confirmNewPassword")?.addEventListener("input", () => clearFieldError("confirmNewPassword", "confirmNewPasswordError"));

  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert("resetAlert");

    const email           = sessionStorage.getItem("resetEmail") || "";
    const otp             = getOtpValue();
    const newPassword     = document.getElementById("newPassword")?.value;
    const confirmPassword = document.getElementById("confirmNewPassword")?.value;

    // â”€â”€ Validate â”€â”€
    let hasError = false;

    if (!email) {
      showAlert("resetAlert", "Session expired. Please start over.", "error");
      return;
    }

    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      for (let i = 1; i <= 6; i++) {
        document.getElementById(`otp${i}`)?.classList.add("error");
      }
      showAlert("resetAlert", "Please enter the complete 6-digit code.", "error");
      hasError = true;
    }

    if (!newPassword || newPassword.length < 8) {
      setFieldError("newPassword", "newPasswordError", "Password must be at least 8 characters.");
      hasError = true;
    }

    if (newPassword !== confirmPassword) {
      setFieldError("confirmNewPassword", "confirmNewPasswordError", "Passwords do not match.");
      hasError = true;
    }

    if (hasError) return;

    setButtonLoading("resetSubmitBtn", "Resetting passwordâ€¦");

    try {
      await apiPost("/auth/reset-password", {
        email, otp, newPassword, confirmPassword,
      }, { auth: false });

      // Clear session and redirect to login with success message
      sessionStorage.removeItem("resetEmail");
      sessionStorage.setItem("authSuccess", "Password reset successfully! You can now log in.");
      redirectTo("/client/login.html");
    } catch (err) {
      // Clear OTP boxes on wrong code
      for (let i = 1; i <= 6; i++) {
        const box = document.getElementById(`otp${i}`);
        if (box) { box.value = ""; box.classList.remove("filled"); box.classList.add("error"); }
      }
      document.getElementById("otp1")?.focus();

      if (err.data && err.data.expired) {
        showAlert("resetAlert", "This code has expired. Click Resend Code to get a new one.", "warning");
      } else {
        showAlert("resetAlert", err.message || "Reset failed. Please try again.", "error");
      }
      setButtonReady("resetSubmitBtn");
    }
  });

  // â”€â”€ Resend reset OTP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  document.getElementById("resendResetBtn")?.addEventListener("click", async () => {
    const email = sessionStorage.getItem("resetEmail") || "";
    if (!email) return;

    const btn = document.getElementById("resendResetBtn");
    btn.disabled = true;

    try {
      await apiPost("/auth/forgot-password", { email }, { auth: false });
      showAlert("resetAlert", "A new reset code has been sent.", "success");

      for (let i = 1; i <= 6; i++) {
        const box = document.getElementById(`otp${i}`);
        if (box) { box.value = ""; box.classList.remove("filled", "error"); }
      }
      document.getElementById("otp1")?.focus();

      startResendTimer("resendResetBtn", "resendTimer", 120);
    } catch (err) {
      showAlert("resetAlert", err.message || "Could not resend code.", "error");
      btn.disabled = false;
    }
  });
}

/* ============================================================
   RESET PASSWORD  (Phase 7 â€” standalone page, e.g. from email link)
   reset-password.html is used when arriving directly (not via
   forgot-password.html two-step flow). It reads resetEmail from
   sessionStorage; if not present it redirects to forgot-password.
   ============================================================ */
function initResetPassword() {
  // If no email in session, redirect to forgot-password
  const email = sessionStorage.getItem("resetEmail") || "";
  if (!email) {
    redirectTo("/client/forgot-password.html");
    return;
  }

  // Password visibility toggles
  document.getElementById("togglePassword")?.addEventListener("click",        () =>
    togglePasswordVisibility("password", "togglePassword")
  );
  document.getElementById("toggleConfirmPassword")?.addEventListener("click", () =>
    togglePasswordVisibility("confirmPassword", "toggleConfirmPassword")
  );

  // Password strength
  document.getElementById("password")?.addEventListener("input", (e) => {
    clearFieldError("password", "passwordError");
    updateStrengthUI(getPasswordStrength(e.target.value));
  });

  document.getElementById("confirmPassword")?.addEventListener("input", () =>
    clearFieldError("confirmPassword", "confirmPasswordError")
  );

  const form = document.getElementById("resetPasswordForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert("authAlert");

    const password        = document.getElementById("password")?.value;
    const confirmPassword = document.getElementById("confirmPassword")?.value;

    let hasError = false;
    if (!password || password.length < 8) {
      setFieldError("password", "passwordError", "Password must be at least 8 characters.");
      hasError = true;
    }
    if (password !== confirmPassword) {
      setFieldError("confirmPassword", "confirmPasswordError", "Passwords do not match.");
      hasError = true;
    }
    if (hasError) return;

    // This page requires a previously verified OTP â€” get it from sessionStorage
    const otp = sessionStorage.getItem("resetOtp") || "";
    if (!otp) {
      showAlert("authAlert", "Session expired. Please request a new reset code.", "error");
      return;
    }

    setButtonLoading("submitBtn", "Resetting passwordâ€¦");

    try {
      await apiPost("/auth/reset-password", {
        email, otp,
        newPassword: password,
        confirmPassword,
      }, { auth: false });

      sessionStorage.removeItem("resetEmail");
      sessionStorage.removeItem("resetOtp");
      sessionStorage.setItem("authSuccess", "Password reset successfully! You can now log in.");
      redirectTo("/client/login.html");
    } catch (err) {
      showAlert("authAlert", err.message || "Reset failed. Please try again.", "error");
      setButtonReady("submitBtn");
    }
  });
}

/* ============================================================
   SHARED HELPERS
   ============================================================ */

function togglePasswordVisibility(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn   = document.getElementById(btnId);
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    if (btn) { btn.textContent = "ðŸ™ˆ"; btn.setAttribute("aria-label", "Hide password"); }
  } else {
    input.type = "password";
    if (btn) { btn.textContent = "ðŸ‘";  btn.setAttribute("aria-label", "Show password"); }
  }
}

function isValidEmailFrontend(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function wireOtpInputs() {
  const inputs = Array.from({ length: 6 }, (_, i) =>
    document.getElementById(`otp${i + 1}`)
  ).filter(Boolean);

  inputs.forEach((input, idx) => {
    input.addEventListener("input", (e) => {
      const val = e.target.value.replace(/\D/g, "");
      e.target.value = val.slice(-1);
      e.target.classList.remove("error");
      e.target.classList.toggle("filled", Boolean(val));
      if (val && idx < inputs.length - 1) inputs[idx + 1].focus();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && idx > 0) {
        inputs[idx - 1].focus();
        inputs[idx - 1].value = "";
        inputs[idx - 1].classList.remove("filled");
      }
    });

    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData)
        .getData("text").replace(/\D/g, "").slice(0, 6);
      pasted.split("").forEach((digit, i) => {
        if (inputs[i]) { inputs[i].value = digit; inputs[i].classList.add("filled"); }
      });
      const lastIdx = Math.min(pasted.length, inputs.length - 1);
      inputs[lastIdx].focus();
    });
  });
}

function getOtpValue() {
  return Array.from({ length: 6 }, (_, i) => {
    const el = document.getElementById(`otp${i + 1}`);
    return el ? el.value : "";
  }).join("");
}

function startResendTimer(btnId, timerId, seconds) {
  const btn   = document.getElementById(btnId);
  const timer = document.getElementById(timerId);
  if (!btn || !timer) return;

  btn.disabled      = true;
  let remaining     = seconds;
  timer.textContent = `(${seconds}s)`;

  const interval = setInterval(() => {
    remaining--;
    timer.textContent = `(${remaining}s)`;
    if (remaining <= 0) {
      clearInterval(interval);
      btn.disabled      = false;
      timer.textContent = "";
    }
  }, 1000);
}

/* Show success message on login page after redirect from register */
(function checkAuthSuccess() {
  const msg = sessionStorage.getItem("authSuccess");
  if (msg && window.location.pathname.includes("login.html")) {
    sessionStorage.removeItem("authSuccess");
    setTimeout(() => showAlert("authAlert", msg, "success"), 100);
  }
})();

