"use strict";

const { generateAndStoreQuiz } = require("../services/quizService");
const {
  getQuizByIdAndUser,
  getQuestionsByQuizId,
  getQuestionsWithAnswers,
} = require("../db/queries/quizQueries");
const {
  createAttempt,
  saveAttemptAnswer,
  getAttemptByIdAndUser,
  getAttemptReview,
  getUserAttempts,
  getExistingAttempt,
} = require("../db/queries/attemptQueries");

// ─────────────────────────────────────────────
// POST /api/quizzes/generate
// ─────────────────────────────────────────────
async function generateQuiz(req, res, next) {
  try {
    const {
      subjectId,
      difficulty,
      questionCount,
      timerEnabled     = false,
      timeLimitSeconds = null,
    } = req.body;

    if (!subjectId || typeof subjectId !== "number") {
      return res.status(400).json({ success: false, message: "subjectId is required and must be a number." });
    }

    const validDifficulties = ["easy", "medium", "hard"];
    if (!difficulty || !validDifficulties.includes(difficulty)) {
      return res.status(400).json({ success: false, message: `difficulty must be one of: ${validDifficulties.join(", ")}.` });
    }

    const validCounts = [10, 15, 20, 25];
    if (!questionCount || !validCounts.includes(questionCount)) {
      return res.status(400).json({ success: false, message: `questionCount must be one of: ${validCounts.join(", ")}.` });
    }

    if (timerEnabled && (!timeLimitSeconds || timeLimitSeconds <= 0)) {
      return res.status(400).json({ success: false, message: "timeLimitSeconds must be positive when timerEnabled is true." });
    }

    const result = await generateAndStoreQuiz(
      req.user.id, subjectId, difficulty, questionCount,
      Boolean(timerEnabled), timeLimitSeconds || null
    );

    return res.status(201).json({ success: true, message: "Quiz generated successfully.", data: result });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────
// GET /api/quizzes/:id
// Returns quiz + questions WITHOUT correct answers
// ─────────────────────────────────────────────
async function getQuiz(req, res, next) {
  try {
    const quizId = parseInt(req.params.id, 10);
    if (isNaN(quizId) || quizId < 1) {
      return res.status(400).json({ success: false, message: "Invalid quiz ID." });
    }

    const quiz = await getQuizByIdAndUser(quizId, req.user.id);
    if (!quiz) return res.status(404).json({ success: false, message: "Quiz not found." });

    const questions = await getQuestionsByQuizId(quizId);

    return res.status(200).json({ success: true, data: { quiz, questions } });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────
// POST /api/quizzes/:id/submit
//
// Body: { answers: { questionId: "A"|"B"|"C"|"D"|null, ... }, timeTakenSeconds }
//
// Backend calculates score — NEVER trusts frontend values.
// Prevents duplicate submission.
// ─────────────────────────────────────────────
async function submitQuiz(req, res, next) {
  try {
    const quizId = parseInt(req.params.id, 10);
    if (isNaN(quizId) || quizId < 1) {
      return res.status(400).json({ success: false, message: "Invalid quiz ID." });
    }

    const { answers = {}, timeTakenSeconds = null } = req.body;

    // Ownership check
    const quiz = await getQuizByIdAndUser(quizId, req.user.id);
    if (!quiz) return res.status(404).json({ success: false, message: "Quiz not found." });

    // Prevent duplicate submission
    const existing = await getExistingAttempt(req.user.id, quizId);
    if (existing) {
      return res.status(409).json({
        success:   false,
        message:   "This quiz has already been submitted.",
        attemptId: existing.id,
      });
    }

    // Get questions WITH correct answers (backend only — never sent to frontend directly)
    const questions = await getQuestionsWithAnswers(quizId);

    // ── Score calculation ─────────────────────────────────
    let correctCount   = 0;
    let wrongCount     = 0;
    let unansweredCount= 0;

    const answerResults = questions.map((q) => {
      const selected = answers[String(q.id)] || null;
      const valid    = ["A", "B", "C", "D"].includes(selected);

      if (!valid || selected === null) {
        unansweredCount++;
        return { questionId: q.id, selected: null, isCorrect: false };
      }

      const isCorrect = selected === q.correct_answer;
      if (isCorrect) correctCount++;
      else wrongCount++;

      return { questionId: q.id, selected, isCorrect };
    });

    const score = questions.length > 0
      ? Math.round((correctCount / questions.length) * 100 * 100) / 100
      : 0;

    // ── Save attempt ──────────────────────────────────────
    const attempt = await createAttempt(
      req.user.id, quizId, score, correctCount, wrongCount,
      unansweredCount, timeTakenSeconds
    );

    // ── Save individual answers ───────────────────────────
    for (const ar of answerResults) {
      await saveAttemptAnswer(attempt.id, ar.questionId, ar.selected, ar.isCorrect);
    }

    return res.status(201).json({
      success: true,
      message: "Quiz submitted successfully.",
      data: {
        attemptId:       attempt.id,
        score:           attempt.score,
        correctCount:    attempt.correct_count,
        wrongCount:      attempt.wrong_count,
        unansweredCount: attempt.unanswered_count,
        timeTakenSeconds:attempt.time_taken_seconds,
        completedAt:     attempt.completed_at,
        totalQuestions:  questions.length,
      },
    });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────
// GET /api/attempts/:id   — result page data
// ─────────────────────────────────────────────
async function getAttempt(req, res, next) {
  try {
    const attemptId = parseInt(req.params.id, 10);
    if (isNaN(attemptId) || attemptId < 1) {
      return res.status(400).json({ success: false, message: "Invalid attempt ID." });
    }

    const attempt = await getAttemptByIdAndUser(attemptId, req.user.id);
    if (!attempt) return res.status(404).json({ success: false, message: "Attempt not found." });

    return res.status(200).json({ success: true, data: { attempt } });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────
// GET /api/attempts/:id/review  — review answers
// ─────────────────────────────────────────────
async function getReview(req, res, next) {
  try {
    const attemptId = parseInt(req.params.id, 10);
    if (isNaN(attemptId) || attemptId < 1) {
      return res.status(400).json({ success: false, message: "Invalid attempt ID." });
    }

    const review = await getAttemptReview(attemptId, req.user.id);
    if (!review) return res.status(404).json({ success: false, message: "Attempt not found." });

    return res.status(200).json({ success: true, data: { review } });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────
// GET /api/attempts  — quiz history with optional filters
// Query params: subjectId, difficulty, dateFrom, dateTo, limit, offset
// ─────────────────────────────────────────────
async function listAttempts(req, res, next) {
  try {
    const limit  = Math.min(parseInt(req.query.limit  || "20", 10), 50);
    const offset = parseInt(req.query.offset || "0",  10);

    // Filters — sanitised before passing to DB
    const subjectId  = req.query.subjectId  ? parseInt(req.query.subjectId, 10) : null;
    const difficulty = ["easy","medium","hard"].includes(req.query.difficulty)
      ? req.query.difficulty : null;
    const dateFrom   = req.query.dateFrom || null;
    const dateTo     = req.query.dateTo   || null;

    const { attempts, total } = await getUserAttempts(req.user.id, {
      subjectId, difficulty, dateFrom, dateTo, limit, offset,
    });

    return res.status(200).json({
      success: true,
      data:    attempts,
      meta:    { total, limit, offset },
    });
  } catch (err) { next(err); }
}

module.exports = { generateQuiz, getQuiz, submitQuiz, getAttempt, getReview, listAttempts };
