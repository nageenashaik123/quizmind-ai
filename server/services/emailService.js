"use strict";

const nodemailer = require("nodemailer");
const env        = require("../config/env");

// ─────────────────────────────────────────────
// Create reusable Gmail transporter.
// Uses an App Password — never the real account password.
// ─────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: env.EMAIL_FROM,
    pass: env.EMAIL_API_KEY,  // Gmail App Password
  },
});

/**
 * Verify the email transporter is correctly configured.
 * Called once at startup (optional — won't crash server if it fails).
 */
async function verifyTransporter() {
  try {
    await transporter.verify();
    console.log("[email] Gmail transporter ready — emails can be sent.");
  } catch (err) {
    console.warn("[email] Gmail transporter warning:", err.message);
    console.warn("[email] Check EMAIL_FROM and EMAIL_API_KEY in .env");
  }
}

// ─────────────────────────────────────────────
// Email templates
// ─────────────────────────────────────────────

/**
 * Send a registration OTP email.
 * @param {string} to       — recipient email
 * @param {string} name     — recipient's first name
 * @param {string} otp      — 6-digit plaintext OTP
 * @returns {Promise<void>}
 */
async function sendRegistrationOTP(to, name, otp) {
  const firstName = name.split(" ")[0];

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Verify Your Email — QuizMind AI</title>
    </head>
    <body style="margin:0; padding:0; background:#F7F8FC; font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FC; padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="560" cellpadding="0" cellspacing="0"
              style="background:#ffffff; border-radius:16px; overflow:hidden;
                     box-shadow:0 4px 24px rgba(0,0,0,.08); max-width:560px; width:100%;">

              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#6C63FF 0%,#8B5CF6 100%);
                           padding:36px 40px; text-align:center;">
                  <div style="font-size:2.5rem; margin-bottom:8px;">🧠</div>
                  <h1 style="color:#ffffff; font-size:22px; font-weight:700;
                             letter-spacing:-0.5px; margin:0;">QuizMind AI</h1>
                  <p style="color:rgba(255,255,255,.85); font-size:14px; margin:6px 0 0;">
                    Email Verification
                  </p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:40px;">
                  <h2 style="color:#16172B; font-size:20px; font-weight:700;
                             letter-spacing:-0.3px; margin:0 0 12px;">
                    Hi ${firstName}! 👋
                  </h2>
                  <p style="color:#5C5F7A; font-size:15px; line-height:1.6; margin:0 0 28px;">
                    Thanks for creating your QuizMind AI account.
                    Enter the 6-digit code below to verify your email address.
                  </p>

                  <!-- OTP Box -->
                  <div style="background:#EEF0FF; border:2px dashed #6C63FF;
                              border-radius:12px; padding:28px; text-align:center;
                              margin-bottom:28px;">
                    <p style="color:#5C5F7A; font-size:13px; font-weight:600;
                              text-transform:uppercase; letter-spacing:0.08em;
                              margin:0 0 12px;">Your verification code</p>
                    <div style="font-size:42px; font-weight:800; letter-spacing:12px;
                                color:#6C63FF; font-family:monospace;">
                      ${otp}
                    </div>
                    <p style="color:#9FA3BF; font-size:12px; margin:12px 0 0;">
                      This code expires in <strong>10 minutes</strong>.
                    </p>
                  </div>

                  <p style="color:#5C5F7A; font-size:14px; line-height:1.6; margin:0 0 8px;">
                    If you did not create a QuizMind AI account, you can safely ignore this email.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#F7F8FC; padding:20px 40px;
                           border-top:1px solid #E4E6F0; text-align:center;">
                  <p style="color:#9FA3BF; font-size:12px; margin:0;">
                    &copy; 2026 QuizMind AI &nbsp;·&nbsp;
                    Practice Smarter. Improve Faster.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from:    `"QuizMind AI" <${env.EMAIL_FROM}>`,
    to,
    subject: `${otp} is your QuizMind AI verification code`,
    html,
    text:    `Hi ${firstName},\n\nYour QuizMind AI verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not register, ignore this email.`,
  });

  console.log(`[email] Registration OTP sent to ${to}`);
}

/**
 * Send a password reset OTP email.
 * @param {string} to
 * @param {string} name
 * @param {string} otp
 */
async function sendPasswordResetOTP(to, name, otp) {
  const firstName = name.split(" ")[0];

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"/></head>
    <body style="margin:0; padding:0; background:#F7F8FC; font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FC; padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="560" cellpadding="0" cellspacing="0"
              style="background:#ffffff; border-radius:16px; overflow:hidden;
                     box-shadow:0 4px 24px rgba(0,0,0,.08); max-width:560px; width:100%;">

              <tr>
                <td style="background:linear-gradient(135deg,#6C63FF 0%,#8B5CF6 100%);
                           padding:36px 40px; text-align:center;">
                  <div style="font-size:2.5rem; margin-bottom:8px;">🔐</div>
                  <h1 style="color:#fff; font-size:22px; font-weight:700; margin:0;">
                    Password Reset
                  </h1>
                </td>
              </tr>

              <tr>
                <td style="padding:40px;">
                  <h2 style="color:#16172B; font-size:20px; font-weight:700; margin:0 0 12px;">
                    Hi ${firstName},
                  </h2>
                  <p style="color:#5C5F7A; font-size:15px; line-height:1.6; margin:0 0 28px;">
                    We received a request to reset your QuizMind AI password.
                    Use the code below to set a new password.
                  </p>

                  <div style="background:#EEF0FF; border:2px dashed #6C63FF;
                              border-radius:12px; padding:28px; text-align:center;
                              margin-bottom:28px;">
                    <p style="color:#5C5F7A; font-size:13px; font-weight:600;
                              text-transform:uppercase; letter-spacing:0.08em; margin:0 0 12px;">
                      Reset code
                    </p>
                    <div style="font-size:42px; font-weight:800; letter-spacing:12px;
                                color:#6C63FF; font-family:monospace;">
                      ${otp}
                    </div>
                    <p style="color:#9FA3BF; font-size:12px; margin:12px 0 0;">
                      Expires in <strong>10 minutes</strong>.
                    </p>
                  </div>

                  <p style="color:#5C5F7A; font-size:14px; line-height:1.6;">
                    If you did not request a password reset, ignore this email —
                    your password will not change.
                  </p>
                </td>
              </tr>

              <tr>
                <td style="background:#F7F8FC; padding:20px 40px;
                           border-top:1px solid #E4E6F0; text-align:center;">
                  <p style="color:#9FA3BF; font-size:12px; margin:0;">
                    &copy; 2026 QuizMind AI
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from:    `"QuizMind AI" <${env.EMAIL_FROM}>`,
    to,
    subject: `${otp} is your QuizMind AI password reset code`,
    html,
    text: `Hi ${firstName},\n\nYour QuizMind AI password reset code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request a reset, ignore this email.`,
  });

  console.log(`[email] Password reset OTP sent to ${to}`);
}

module.exports = { verifyTransporter, sendRegistrationOTP, sendPasswordResetOTP };
