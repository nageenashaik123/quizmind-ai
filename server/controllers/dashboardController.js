"use strict";

const {
  getOverallStats,
  getSubjectPerformance,
  getDifficultyPerformance,
  getScoreTrend,
  getWeakAreas,
  getStrongAreas,
} = require("../db/queries/dashboardQueries");

// ─────────────────────────────────────────────
// GET /api/dashboard
// Returns complete dashboard data in one request
// ─────────────────────────────────────────────
async function getDashboard(req, res, next) {
  try {
    const userId = req.user.id;

    // Run all queries in parallel for speed
    const [overall, subjects, difficulty, trend, weak, strong] = await Promise.all([
      getOverallStats(userId),
      getSubjectPerformance(userId),
      getDifficultyPerformance(userId),
      getScoreTrend(userId),
      getWeakAreas(userId),
      getStrongAreas(userId),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalQuizzes:   overall.total_quizzes,
        avgScore:       parseFloat(overall.avg_score),
        bestScore:      parseFloat(overall.best_score),
        totalQuestions: overall.total_questions,
        subjects,
        difficulty,
        trend,
        weakAreas:   weak,
        strongAreas: strong,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────
// GET /api/profile  — user profile + stats
// ─────────────────────────────────────────────
async function getProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const overall = await getOverallStats(userId);

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id:         req.user.id,
          name:       req.user.name,
          email:      req.user.email,
          created_at: req.user.createdAt || null,
        },
        stats: {
          totalQuizzes:   overall.total_quizzes,
          avgScore:       parseFloat(overall.avg_score),
          bestScore:      parseFloat(overall.best_score),
          totalQuestions: overall.total_questions,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboard, getProfile };
