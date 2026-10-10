"use strict";

const { query } = require("../../config/db");

// ─────────────────────────────────────────────
// Quiz queries
// ─────────────────────────────────────────────

/**
 * Create a new quiz record.
 * @param {number}  userId
 * @param {number}  subjectId
 * @param {string}  difficulty       — "easy"|"medium"|"hard"
 * @param {number}  questionCount
 * @param {boolean} timerEnabled
 * @param {number|null} timeLimitSeconds
 * @returns {Promise<object>} inserted quiz row
 */
async function createQuiz(userId, subjectId, difficulty, questionCount, timerEnabled, timeLimitSeconds) {
  const result = await query(
    `INSERT INTO quizzes
       (user_id, subject_id, difficulty, question_count, timer_enabled, time_limit_seconds)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, user_id, subject_id, difficulty, question_count,
               timer_enabled, time_limit_seconds, created_at`,
    [userId, subjectId, difficulty, questionCount, timerEnabled, timeLimitSeconds]
  );
  return result.rows[0];
}

/**
 * Insert a single question belonging to a quiz.
 * @param {number} quizId
 * @param {object} q — { question, option_a, option_b, option_c, option_d, correct_answer, explanation }
 * @returns {Promise<object>} inserted question row (WITHOUT correct_answer — never returned to frontend)
 */
async function createQuestion(quizId, q) {
  const result = await query(
    `INSERT INTO questions
       (quiz_id, question_text, option_a, option_b, option_c, option_d,
        correct_answer, explanation)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, quiz_id, question_text, option_a, option_b, option_c, option_d`,
    [
      quizId,
      q.question,
      q.option_a,
      q.option_b,
      q.option_c,
      q.option_d,
      q.correct_answer,  // stored but NOT returned to frontend
      q.explanation,     // stored but NOT returned until review phase
    ]
  );
  // Return row WITHOUT correct_answer and explanation
  return result.rows[0];
}

/**
 * Get a quiz by ID. Verifies it belongs to the given user.
 * @param {number} quizId
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
async function getQuizByIdAndUser(quizId, userId) {
  const result = await query(
    `SELECT q.id, q.user_id, q.subject_id, q.difficulty, q.question_count,
            q.timer_enabled, q.time_limit_seconds, q.created_at,
            s.name AS subject_name, s.domain_id,
            d.name AS domain_name, d.icon AS domain_icon
     FROM quizzes q
     JOIN subjects s ON s.id = q.subject_id
     JOIN domains  d ON d.id = s.domain_id
     WHERE q.id = $1 AND q.user_id = $2`,
    [quizId, userId]
  );
  return result.rows[0] || null;
}

/**
 * Get all questions for a quiz — WITHOUT correct_answer or explanation.
 * This is safe to send to the frontend during quiz-taking.
 * @param {number} quizId
 * @returns {Promise<Array>}
 */
async function getQuestionsByQuizId(quizId) {
  const result = await query(
    `SELECT id, quiz_id, question_text, option_a, option_b, option_c, option_d
     FROM questions
     WHERE quiz_id = $1
     ORDER BY id ASC`,
    [quizId]
  );
  return result.rows;
}

/**
 * Get all questions INCLUDING correct_answer and explanation.
 * Used ONLY by the backend when scoring or generating review data.
 * Never called from a public endpoint.
 * @param {number} quizId
 * @returns {Promise<Array>}
 */
async function getQuestionsWithAnswers(quizId) {
  const result = await query(
    `SELECT id, quiz_id, question_text, option_a, option_b, option_c, option_d,
            correct_answer, explanation
     FROM questions
     WHERE quiz_id = $1
     ORDER BY id ASC`,
    [quizId]
  );
  return result.rows;
}

/**
 * Delete a quiz and all its questions (cascade).
 * Used to clean up a quiz if storage fails mid-generation.
 * @param {number} quizId
 */
async function deleteQuiz(quizId) {
  await query("DELETE FROM quizzes WHERE id = $1", [quizId]);
}

module.exports = {
  createQuiz,
  createQuestion,
  getQuizByIdAndUser,
  getQuestionsByQuizId,
  getQuestionsWithAnswers,
  deleteQuiz,
};
