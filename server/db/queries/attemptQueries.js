"use strict";

const { query } = require("../../config/db");

// ─────────────────────────────────────────────
// Attempt queries
// ─────────────────────────────────────────────

/**
 * Create a new attempt record after quiz submission.
 * Score is ALWAYS calculated by the backend — never trusted from frontend.
 */
async function createAttempt(userId, quizId, score, correctCount, wrongCount, unansweredCount, timeTakenSeconds) {
  const result = await query(
    `INSERT INTO attempts
       (user_id, quiz_id, score, correct_count, wrong_count, unanswered_count, time_taken_seconds)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, user_id, quiz_id, score, correct_count, wrong_count,
               unanswered_count, time_taken_seconds, completed_at`,
    [userId, quizId, score, correctCount, wrongCount, unansweredCount, timeTakenSeconds]
  );
  return result.rows[0];
}

/**
 * Save one answer per question for an attempt.
 */
async function saveAttemptAnswer(attemptId, questionId, selectedAnswer, isCorrect) {
  await query(
    `INSERT INTO attempt_answers (attempt_id, question_id, selected_answer, is_correct)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (attempt_id, question_id) DO UPDATE
       SET selected_answer = $3, is_correct = $4`,
    [attemptId, questionId, selectedAnswer, isCorrect]
  );
}

/**
 * Get a single attempt — verify it belongs to user.
 */
async function getAttemptByIdAndUser(attemptId, userId) {
  const result = await query(
    `SELECT a.id, a.user_id, a.quiz_id, a.score, a.correct_count,
            a.wrong_count, a.unanswered_count, a.time_taken_seconds, a.completed_at,
            q.difficulty, q.question_count, q.timer_enabled, q.time_limit_seconds,
            s.name AS subject_name, s.id AS subject_id,
            d.name AS domain_name, d.icon AS domain_icon
     FROM   attempts a
     JOIN   quizzes  q ON q.id = a.quiz_id
     JOIN   subjects s ON s.id = q.subject_id
     JOIN   domains  d ON d.id = s.domain_id
     WHERE  a.id = $1 AND a.user_id = $2`,
    [attemptId, userId]
  );
  return result.rows[0] || null;
}

/**
 * Get all attempt answers with question text and correct answer — for review.
 */
async function getAttemptReview(attemptId, userId) {
  // First verify ownership
  const check = await query(
    `SELECT id FROM attempts WHERE id=$1 AND user_id=$2`,
    [attemptId, userId]
  );
  if (!check.rows[0]) return null;

  const result = await query(
    `SELECT aa.id, aa.question_id, aa.selected_answer, aa.is_correct,
            q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
            q.correct_answer, q.explanation
     FROM   attempt_answers aa
     JOIN   questions q ON q.id = aa.question_id
     WHERE  aa.attempt_id = $1
     ORDER  BY q.id ASC`,
    [attemptId]
  );
  return result.rows;
}

/**
 * Get attempts for a user with optional filters.
 * Filters: subjectId, difficulty, dateFrom, dateTo
 * Returns total count for pagination too.
 */
async function getUserAttemptsFiltered(userId, { subjectId, difficulty, dateFrom, dateTo, limit = 20, offset = 0 } = {}) {
  const params  = [userId];
  const clauses = [];
  let   p       = 2;

  if (subjectId) {
    clauses.push(`s.id = $${p++}`);
    params.push(subjectId);
  }
  if (difficulty) {
    clauses.push(`q.difficulty = $${p++}`);
    params.push(difficulty);
  }
  if (dateFrom) {
    clauses.push(`a.completed_at >= $${p++}`);
    params.push(dateFrom);
  }
  if (dateTo) {
    clauses.push(`a.completed_at <= $${p++}`);
    params.push(dateTo);
  }

  const where = clauses.length ? `AND ${clauses.join(" AND ")}` : "";

  // Total count for pagination
  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM   attempts a
     JOIN   quizzes  q ON q.id = a.quiz_id
     JOIN   subjects s ON s.id = q.subject_id
     JOIN   domains  d ON d.id = s.domain_id
     WHERE  a.user_id = $1 ${where}`,
    params
  );
  const total = countResult.rows[0].total;

  // Paginated results
  const dataParams = [...params, limit, offset];
  const result = await query(
    `SELECT a.id, a.quiz_id, a.score, a.correct_count, a.wrong_count, a.unanswered_count,
            a.time_taken_seconds, a.completed_at,
            q.difficulty, q.question_count,
            s.id AS subject_id, s.name AS subject_name,
            d.name AS domain_name, d.icon AS domain_icon
     FROM   attempts a
     JOIN   quizzes  q ON q.id = a.quiz_id
     JOIN   subjects s ON s.id = q.subject_id
     JOIN   domains  d ON d.id = s.domain_id
     WHERE  a.user_id = $1 ${where}
     ORDER  BY a.completed_at DESC
     LIMIT  $${p++} OFFSET $${p++}`,
    dataParams
  );

  return { attempts: result.rows, total };
}

/**
 * Check if a quiz already has an attempt from this user.
 */
async function getExistingAttempt(userId, quizId) {
  const result = await query(
    `SELECT id FROM attempts WHERE user_id=$1 AND quiz_id=$2 LIMIT 1`,
    [userId, quizId]
  );
  return result.rows[0] || null;
}

module.exports = {
  createAttempt,
  saveAttemptAnswer,
  getAttemptByIdAndUser,
  getAttemptReview,
  getUserAttempts: getUserAttemptsFiltered,  // updated — supports filters
  getExistingAttempt,
};
