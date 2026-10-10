"use strict";

const { query } = require("../../config/db");

// ─────────────────────────────────────────────────────────────
// Question Bank
//
// Every AI-generated question is saved here permanently,
// keyed by subject_id + difficulty.
//
// Purpose:
//   - Build up a reusable pool over time so quizzes get
//     richer the more the app is used.
//   - Serve as fallback when all AI providers are unavailable.
//   - Avoid exact duplicate questions per subject+difficulty.
// ─────────────────────────────────────────────────────────────

/**
 * Create the question_bank table if it does not already exist.
 * Called once at startup via ensureBankTable().
 */
async function ensureBankTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS question_bank (
      id             SERIAL        PRIMARY KEY,
      subject_id     INTEGER       NOT NULL REFERENCES subjects (id) ON DELETE CASCADE,
      difficulty     VARCHAR(10)   NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
      question_text  TEXT          NOT NULL,
      option_a       TEXT          NOT NULL,
      option_b       TEXT          NOT NULL,
      option_c       TEXT          NOT NULL,
      option_d       TEXT          NOT NULL,
      correct_answer CHAR(1)       NOT NULL CHECK (correct_answer IN ('A','B','C','D')),
      explanation    TEXT          NOT NULL,
      created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      UNIQUE (subject_id, difficulty, question_text)
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_qbank_subject_difficulty
    ON question_bank (subject_id, difficulty)
  `);

  console.log("[questionBank] Table ready.");
}

/**
 * Save a batch of AI-generated questions to the bank.
 * Skips exact duplicates (same subject + difficulty + question text).
 *
 * @param {number}  subjectId
 * @param {string}  difficulty
 * @param {Array}   questions   — validated question objects
 * @returns {Promise<number>}   number of new rows inserted
 */
async function saveToBank(subjectId, difficulty, questions) {
  let saved = 0;

  for (const q of questions) {
    try {
      const result = await query(
        `INSERT INTO question_bank
           (subject_id, difficulty, question_text, option_a, option_b,
            option_c, option_d, correct_answer, explanation)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT DO NOTHING`,
        [
          subjectId,
          difficulty,
          q.question,
          q.option_a,
          q.option_b,
          q.option_c,
          q.option_d,
          q.correct_answer,
          q.explanation,
        ]
      );
      if (result.rowCount > 0) saved++;
    } catch (err) {
      // Log but don't crash — bank save is best-effort
      console.warn("[questionBank] Failed to save question:", err.message);
    }
  }

  console.log(`[questionBank] Saved ${saved} new questions (subject=${subjectId}, difficulty=${difficulty}).`);
  return saved;
}

/**
 * Draw a random sample of questions from the bank.
 * Returns fewer than requested if the bank doesn't have enough.
 *
 * @param {number} subjectId
 * @param {string} difficulty
 * @param {number} count        — how many questions needed
 * @returns {Promise<Array>}    array of question objects (may be empty)
 */
async function drawFromBank(subjectId, difficulty, count) {
  const result = await query(
    `SELECT id, question_text, option_a, option_b, option_c, option_d,
            correct_answer, explanation
     FROM   question_bank
     WHERE  subject_id = $1
       AND  difficulty = $2
     ORDER  BY RANDOM()
     LIMIT  $3`,
    [subjectId, difficulty, count]
  );

  return result.rows.map(r => ({
    question:       r.question_text,
    option_a:       r.option_a,
    option_b:       r.option_b,
    option_c:       r.option_c,
    option_d:       r.option_d,
    correct_answer: r.correct_answer,
    explanation:    r.explanation,
  }));
}

/**
 * Count how many questions exist in the bank for a given subject+difficulty.
 * @param {number} subjectId
 * @param {string} difficulty
 * @returns {Promise<number>}
 */
async function countInBank(subjectId, difficulty) {
  const result = await query(
    `SELECT COUNT(*)::int AS count
     FROM   question_bank
     WHERE  subject_id = $1 AND difficulty = $2`,
    [subjectId, difficulty]
  );
  return result.rows[0].count;
}

module.exports = { ensureBankTable, saveToBank, drawFromBank, countInBank };
