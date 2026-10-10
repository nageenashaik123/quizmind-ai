"use strict";
/**
 * QuizMind AI — Quiz Config Logic Tests
 * Tests timer calculation and validation rules from quiz-config.js
 * Run: node tests/test-quiz-config.js
 */

let passed = 0;
let failed = 0;

function pass(label) { console.log(`  ✅  ${label}`); passed++; }
function fail(label, detail) { console.error(`  ❌  ${label}: ${detail}`); failed++; }
function section(title) { console.log(`\n--- ${title} ---`); }

// ── Reproduce the timer logic from quiz-config.js ──────────
const SECONDS_PER_QUESTION = { easy: 90, medium: 90, hard: 120 };

function calcTotalSeconds(difficulty, count) {
  if (!difficulty || !count) return null;
  return count * SECONDS_PER_QUESTION[difficulty];
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (seconds === 0) return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  return `${minutes} min ${seconds} sec`;
}

function validate(subject, difficulty, count) {
  if (!subject)    return "No subject selected.";
  if (!difficulty) return "Please select a difficulty level.";
  if (!count)      return "Please select the number of questions.";
  return null; // valid
}

// ── Timer Calculation Tests ────────────────────────────────
section("TIMER CALCULATION");

// Easy × 10 = 900s = 15 min
{
  const t = calcTotalSeconds("easy", 10);
  if (t === 900) pass("Easy × 10 = 900s");
  else fail("Easy × 10", `expected 900, got ${t}`);
}

// Medium × 15 = 1350s = 22 min 30 sec
{
  const t = calcTotalSeconds("medium", 15);
  if (t === 1350) pass("Medium × 15 = 1350s");
  else fail("Medium × 15", `expected 1350, got ${t}`);
}

// Hard × 15 = 1800s = 30 min
{
  const t = calcTotalSeconds("hard", 15);
  if (t === 1800) pass("Hard × 15 = 1800s (30 minutes)");
  else fail("Hard × 15", `expected 1800, got ${t}`);
}

// Hard × 20 = 2400s = 40 min
{
  const t = calcTotalSeconds("hard", 20);
  if (t === 2400) pass("Hard × 20 = 2400s (40 minutes)");
  else fail("Hard × 20", `expected 2400, got ${t}`);
}

// Hard × 25 = 3000s = 50 min
{
  const t = calcTotalSeconds("hard", 25);
  if (t === 3000) pass("Hard × 25 = 3000s (50 minutes)");
  else fail("Hard × 25", `expected 3000, got ${t}`);
}

// Missing difficulty → null
{
  const t = calcTotalSeconds(null, 10);
  if (t === null) pass("Missing difficulty → null");
  else fail("Missing difficulty", `expected null, got ${t}`);
}

// Missing count → null
{
  const t = calcTotalSeconds("hard", null);
  if (t === null) pass("Missing count → null");
  else fail("Missing count", `expected null, got ${t}`);
}

// ── Format Duration Tests ──────────────────────────────────
section("FORMAT DURATION");

{
  const r = formatDuration(900);
  if (r === "15 minutes") pass(`900s → "${r}"`);
  else fail("900s format", `expected "15 minutes", got "${r}"`);
}

{
  const r = formatDuration(1800);
  if (r === "30 minutes") pass(`1800s → "${r}"`);
  else fail("1800s format", `expected "30 minutes", got "${r}"`);
}

{
  const r = formatDuration(1350);
  if (r === "22 min 30 sec") pass(`1350s → "${r}"`);
  else fail("1350s format", `expected "22 min 30 sec", got "${r}"`);
}

// ── Validation Tests ───────────────────────────────────────
section("VALIDATION");

const mockSubject = { id: 21, name: "Computer Networks", domainId: 4 };

{
  const err = validate(null, "medium", 15);
  if (err && err.includes("subject")) pass("No subject → validation error");
  else fail("No subject", `expected subject error, got: ${err}`);
}

{
  const err = validate(mockSubject, null, 15);
  if (err && err.includes("difficulty")) pass("No difficulty → validation error");
  else fail("No difficulty", `expected difficulty error, got: ${err}`);
}

{
  const err = validate(mockSubject, "hard", null);
  if (err && err.includes("questions")) pass("No count → validation error");
  else fail("No count", `expected count error, got: ${err}`);
}

{
  const err = validate(mockSubject, "hard", 15);
  if (err === null) pass("All valid → no error");
  else fail("All valid", `expected null, got: ${err}`);
}

// ── Allowed values check ───────────────────────────────────
section("ALLOWED VALUES");

{
  const valid = ["easy", "medium", "hard"].every(d => SECONDS_PER_QUESTION[d] > 0);
  if (valid) pass("All 3 difficulties have timer values");
  else fail("Difficulty values", "one or more missing");
}

{
  const counts = [10, 15, 20, 25];
  const allValid = counts.every(c => calcTotalSeconds("hard", c) !== null);
  if (allValid) pass("All 4 question counts work with hard difficulty");
  else fail("Question counts", "one or more failed");
}

{
  // Easy and Medium should have the same seconds per question (90)
  if (SECONDS_PER_QUESTION.easy === SECONDS_PER_QUESTION.medium) {
    pass("Easy = Medium timer (90s/question) — matches spec");
  } else {
    fail("Easy vs Medium timer", `Easy=${SECONDS_PER_QUESTION.easy}, Medium=${SECONDS_PER_QUESTION.medium}`);
  }
}

{
  // Hard should be 120
  if (SECONDS_PER_QUESTION.hard === 120) {
    pass("Hard timer = 120s/question — matches spec");
  } else {
    fail("Hard timer", `expected 120, got ${SECONDS_PER_QUESTION.hard}`);
  }
}

// ── Summary ───────────────────────────────────────────────
console.log(`\n════════════════════════════════════════`);
console.log(`  Passed: ${passed}   Failed: ${failed}`);
console.log(failed === 0 ? "  RESULT: ALL TESTS PASSED" : "  RESULT: SOME TESTS FAILED");
console.log(`════════════════════════════════════════\n`);

if (failed > 0) process.exitCode = 1;
