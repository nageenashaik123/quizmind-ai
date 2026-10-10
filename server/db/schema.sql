-- ============================================================
-- QuizMind AI — Database Schema
-- PostgreSQL
-- Run this file once to create all tables.
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS.
-- ============================================================

-- ------------------------------------------------------------
-- 1. users
-- Stores student account information.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id               SERIAL        PRIMARY KEY,
  name             VARCHAR(100)  NOT NULL,
  email            VARCHAR(255)  NOT NULL UNIQUE,
  password_hash    TEXT          NOT NULL,
  email_verified   BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by email (used on every login)
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);


-- ------------------------------------------------------------
-- 2. otp_verifications
-- Stores hashed OTPs for email verification and password reset.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_verifications (
  id           SERIAL       PRIMARY KEY,
  email        VARCHAR(255) NOT NULL,
  otp_hash     TEXT         NOT NULL,
  purpose      VARCHAR(20)  NOT NULL CHECK (purpose IN ('REGISTER', 'RESET_PASSWORD')),
  expires_at   TIMESTAMPTZ  NOT NULL,
  verified     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by email + purpose when verifying OTP
CREATE INDEX IF NOT EXISTS idx_otp_email_purpose ON otp_verifications (email, purpose);


-- ------------------------------------------------------------
-- 3. domains
-- The four top-level quiz categories.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS domains (
  id            SERIAL        PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL UNIQUE,
  description   TEXT,
  icon          VARCHAR(10),  -- emoji icon e.g. 🧠
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ------------------------------------------------------------
-- 4. subjects
-- Subjects that belong to a domain.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subjects (
  id           SERIAL        PRIMARY KEY,
  domain_id    INTEGER       NOT NULL REFERENCES domains (id) ON DELETE CASCADE,
  name         VARCHAR(150)  NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (domain_id, name)   -- no duplicate subject names within the same domain
);

-- Index for fast subject lookup by domain
CREATE INDEX IF NOT EXISTS idx_subjects_domain_id ON subjects (domain_id);


-- ------------------------------------------------------------
-- 5. quizzes
-- One row per quiz session a student configures and generates.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quizzes (
  id                   SERIAL        PRIMARY KEY,
  user_id              INTEGER       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  subject_id           INTEGER       NOT NULL REFERENCES subjects (id) ON DELETE RESTRICT,
  difficulty           VARCHAR(10)   NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_count       INTEGER       NOT NULL CHECK (question_count IN (10, 15, 20, 25)),
  timer_enabled        BOOLEAN       NOT NULL DEFAULT FALSE,
  time_limit_seconds   INTEGER,      -- NULL when timer_enabled = FALSE
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes for history and analytics queries
CREATE INDEX IF NOT EXISTS idx_quizzes_user_id   ON quizzes (user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_subject_id ON quizzes (subject_id);


-- ------------------------------------------------------------
-- 6. questions
-- AI-generated MCQ questions that belong to a quiz.
-- Correct answers are stored here — never sent raw to the frontend.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS questions (
  id              SERIAL   PRIMARY KEY,
  quiz_id         INTEGER  NOT NULL REFERENCES quizzes (id) ON DELETE CASCADE,
  question_text   TEXT     NOT NULL,
  option_a        TEXT     NOT NULL,
  option_b        TEXT     NOT NULL,
  option_c        TEXT     NOT NULL,
  option_d        TEXT     NOT NULL,
  correct_answer  CHAR(1)  NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
  explanation     TEXT     NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast retrieval of all questions for a quiz
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions (quiz_id);


-- ------------------------------------------------------------
-- 7. attempts
-- One row per completed quiz submission by a student.
-- Score is calculated by the backend — never trusted from frontend.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attempts (
  id                  SERIAL        PRIMARY KEY,
  user_id             INTEGER       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  quiz_id             INTEGER       NOT NULL REFERENCES quizzes (id) ON DELETE CASCADE,
  score               NUMERIC(5,2)  NOT NULL CHECK (score >= 0 AND score <= 100), -- percentage
  correct_count       INTEGER       NOT NULL DEFAULT 0,
  wrong_count         INTEGER       NOT NULL DEFAULT 0,
  unanswered_count    INTEGER       NOT NULL DEFAULT 0,
  time_taken_seconds  INTEGER,      -- NULL if no timer was used
  completed_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  -- Prevent a student from submitting the same quiz twice
  UNIQUE (user_id, quiz_id)
);

-- Indexes for history and dashboard analytics
CREATE INDEX IF NOT EXISTS idx_attempts_user_id  ON attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_quiz_id  ON attempts (quiz_id);
CREATE INDEX IF NOT EXISTS idx_attempts_completed_at ON attempts (completed_at DESC);


-- ------------------------------------------------------------
-- 8. attempt_answers
-- Every answer a student selected during a quiz attempt.
-- This table powers both Quiz History and Review Answers.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attempt_answers (
  id                SERIAL   PRIMARY KEY,
  attempt_id        INTEGER  NOT NULL REFERENCES attempts (id) ON DELETE CASCADE,
  question_id       INTEGER  NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  selected_answer   CHAR(1)  CHECK (selected_answer IN ('A', 'B', 'C', 'D')), -- NULL = unanswered
  is_correct        BOOLEAN  NOT NULL DEFAULT FALSE,
  UNIQUE (attempt_id, question_id)  -- one answer per question per attempt
);

-- Index for fast retrieval of all answers for a given attempt
CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt_id ON attempt_answers (attempt_id);
