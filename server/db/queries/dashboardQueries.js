"use strict";

const { query } = require("../../config/db");

// ─────────────────────────────────────────────────────────────
// Dashboard analytics queries
// All queries are scoped to a single user — no cross-user data.
// ─────────────────────────────────────────────────────────────

/**
 * Overall stats: total quizzes, avg score, best score, total questions.
 */
async function getOverallStats(userId) {
  const result = await query(
    `SELECT
       COUNT(a.id)::int                          AS total_quizzes,
       COALESCE(ROUND(AVG(a.score)::numeric, 1), 0)  AS avg_score,
       COALESCE(ROUND(MAX(a.score)::numeric, 1), 0)  AS best_score,
       COALESCE(SUM(q.question_count)::int, 0)       AS total_questions
     FROM  attempts a
     JOIN  quizzes  q ON q.id = a.quiz_id
     WHERE a.user_id = $1`,
    [userId]
  );
  return result.rows[0];
}

/**
 * Subject-wise performance: avg score per subject, sorted by most quizzes taken.
 */
async function getSubjectPerformance(userId) {
  const result = await query(
    `SELECT
       s.id                                           AS subject_id,
       s.name                                         AS subject_name,
       d.name                                         AS domain_name,
       d.icon                                         AS domain_icon,
       COUNT(a.id)::int                               AS quiz_count,
       ROUND(AVG(a.score)::numeric, 1)                AS avg_score,
       ROUND(MAX(a.score)::numeric, 1)                AS best_score,
       ROUND(MIN(a.score)::numeric, 1)                AS lowest_score
     FROM  attempts a
     JOIN  quizzes  q ON q.id = a.quiz_id
     JOIN  subjects s ON s.id = q.subject_id
     JOIN  domains  d ON d.id = s.domain_id
     WHERE a.user_id = $1
     GROUP BY s.id, s.name, d.name, d.icon
     ORDER BY quiz_count DESC, avg_score DESC`,
    [userId]
  );
  return result.rows;
}

/**
 * Difficulty-wise performance: avg score per difficulty level.
 */
async function getDifficultyPerformance(userId) {
  const result = await query(
    `SELECT
       q.difficulty,
       COUNT(a.id)::int                 AS quiz_count,
       ROUND(AVG(a.score)::numeric, 1)  AS avg_score,
       ROUND(MAX(a.score)::numeric, 1)  AS best_score
     FROM  attempts a
     JOIN  quizzes q ON q.id = a.quiz_id
     WHERE a.user_id = $1
     GROUP BY q.difficulty
     ORDER BY CASE q.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 END`,
    [userId]
  );
  return result.rows;
}

/**
 * Recent quiz score trend — last 10 attempts in chronological order.
 */
async function getScoreTrend(userId) {
  const result = await query(
    `SELECT
       a.id, a.score, a.completed_at,
       s.name AS subject_name, q.difficulty
     FROM  attempts a
     JOIN  quizzes  q ON q.id = a.quiz_id
     JOIN  subjects s ON s.id = q.subject_id
     WHERE a.user_id = $1
     ORDER BY a.completed_at DESC
     LIMIT 10`,
    [userId]
  );
  // Return in chronological order (oldest first) for chart display
  return result.rows.reverse();
}

/**
 * Weak areas: subjects where avg_score < 70%, at least 1 attempt.
 */
async function getWeakAreas(userId) {
  const result = await query(
    `SELECT
       s.id                                          AS subject_id,
       s.name                                        AS subject_name,
       d.name                                        AS domain_name,
       COUNT(a.id)::int                              AS quiz_count,
       ROUND(AVG(a.score)::numeric, 1)               AS avg_score
     FROM  attempts a
     JOIN  quizzes  q ON q.id = a.quiz_id
     JOIN  subjects s ON s.id = q.subject_id
     JOIN  domains  d ON d.id = s.domain_id
     WHERE a.user_id = $1
     GROUP BY s.id, s.name, d.name
     HAVING AVG(a.score) < 70
     ORDER BY avg_score ASC
     LIMIT 5`,
    [userId]
  );
  return result.rows;
}

/**
 * Strong areas: subjects where avg_score >= 80%, at least 1 attempt.
 */
async function getStrongAreas(userId) {
  const result = await query(
    `SELECT
       s.id                                          AS subject_id,
       s.name                                        AS subject_name,
       d.name                                        AS domain_name,
       COUNT(a.id)::int                              AS quiz_count,
       ROUND(AVG(a.score)::numeric, 1)               AS avg_score
     FROM  attempts a
     JOIN  quizzes  q ON q.id = a.quiz_id
     JOIN  subjects s ON s.id = q.subject_id
     JOIN  domains  d ON d.id = s.domain_id
     WHERE a.user_id = $1
     GROUP BY s.id, s.name, d.name
     HAVING AVG(a.score) >= 80
     ORDER BY avg_score DESC
     LIMIT 5`,
    [userId]
  );
  return result.rows;
}

module.exports = {
  getOverallStats,
  getSubjectPerformance,
  getDifficultyPerformance,
  getScoreTrend,
  getWeakAreas,
  getStrongAreas,
};
