"use strict";

const { generateQuestions }           = require("./aiService");
const { createQuiz, createQuestion, deleteQuiz } = require("../db/queries/quizQueries");
const { getSubjectById }              = require("../db/queries/domainQueries");
const { saveToBank, drawFromBank, countInBank } = require("../db/queries/questionBankQueries");

// ─────────────────────────────────────────────────────────────
// generateAndStoreQuiz
//
// Full flow:
//   1. Validate subject
//   2. Try AI providers (Gemini → Groq → Ollama)
//        a. On success → save to question bank + create quiz
//   3. If ALL AI providers fail → fall back to question bank
//        a. Pull random questions for subject + difficulty
//        b. If bank has enough → create quiz from bank questions
//        c. If bank too empty → throw helpful error
// ─────────────────────────────────────────────────────────────

async function generateAndStoreQuiz(
  userId,
  subjectId,
  difficulty,
  questionCount,
  timerEnabled,
  timeLimitSeconds
) {
  // ── 1. Validate subject ──────────────────────────────────
  const subject = await getSubjectById(subjectId);
  if (!subject) {
    const err = new Error("Subject not found.");
    err.statusCode = 404;
    throw err;
  }

  console.log(
    `[quizService] Generating ${questionCount} ${difficulty} questions` +
    ` for "${subject.name}" (user=${userId})...`
  );

  // ── 2. Try AI providers ───────────────────────────────────
  let questions = null;
  let fromBank  = false;

  try {
    questions = await generateQuestions(subject.name, difficulty, questionCount);

    // ── 2a. Save fresh questions to bank (async, non-blocking) ──
    saveToBank(subjectId, difficulty, questions).catch((err) =>
      console.warn("[quizService] Bank save warning:", err.message)
    );
  } catch (aiError) {
    console.warn(`[quizService] All AI providers failed: ${aiError.message}`);
    console.log("[quizService] Attempting question bank fallback...");

    // ── 3. Fallback to question bank ──────────────────────────
    const available = await countInBank(subjectId, difficulty);
    console.log(
      `[quizService] Bank has ${available} questions` +
      ` for subject=${subjectId} difficulty=${difficulty}.`
    );

    if (available === 0) {
      // Bank is empty — nothing we can do
      const err = new Error(
        "Quiz generation failed and no stored questions are available yet for this subject. " +
        "Please try again later."
      );
      err.statusCode = 503;
      throw err;
    }

    if (available < questionCount) {
      // Partial bank — use what we have
      console.log(
        `[quizService] Bank has fewer than ${questionCount} questions` +
        ` — serving ${available} available.`
      );
    }

    questions = await drawFromBank(
      subjectId,
      difficulty,
      Math.min(questionCount, available)
    );
    fromBank = true;

    console.log(
      `[quizService] ✅ Serving ${questions.length} questions from bank (fallback).`
    );
  }

  // ── 4. Create quiz record in DB ───────────────────────────
  let quiz;
  try {
    quiz = await createQuiz(
      userId,
      subjectId,
      difficulty,
      questions.length, // may differ if bank had fewer than requested
      timerEnabled,
      timeLimitSeconds
    );
  } catch (err) {
    console.error("[quizService] Failed to create quiz record:", err.message);
    const e = new Error("Failed to save quiz. Please try again.");
    e.statusCode = 500;
    throw e;
  }

  // ── 5. Insert questions for this quiz ─────────────────────
  const savedQuestions = [];
  try {
    for (const q of questions) {
      const saved = await createQuestion(quiz.id, q);
      savedQuestions.push(saved);
    }
  } catch (err) {
    console.error("[quizService] Failed to save questions, rolling back:", err.message);
    await deleteQuiz(quiz.id).catch(() => {});
    const e = new Error("Failed to save quiz questions. Please try again.");
    e.statusCode = 500;
    throw e;
  }

  console.log(
    `[quizService] ✅ Quiz ${quiz.id} ready —` +
    ` ${savedQuestions.length} questions` +
    ` (source: ${fromBank ? "question bank" : "AI"}).`
  );

  return {
    quizId:           quiz.id,
    subjectId:        quiz.subject_id,
    subjectName:      subject.name,
    domainName:       subject.domain_name,
    difficulty:       quiz.difficulty,
    questionCount:    quiz.question_count,
    timerEnabled:     quiz.timer_enabled,
    timeLimitSeconds: quiz.time_limit_seconds,
    createdAt:        quiz.created_at,
    source:           fromBank ? "bank" : "ai",
    questions:        savedQuestions, // id, question_text, options — no answers
  };
}

module.exports = { generateAndStoreQuiz };
