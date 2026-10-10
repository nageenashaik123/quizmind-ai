/* ============================================================
   QuizMind AI — Quiz Engine (Phase 10)
   Responsibilities:
   - Auth guard
   - Read quizId from URL params
   - Fetch quiz + questions from GET /api/quizzes/:id
   - Display one question at a time
   - Track selected answers in memory (never sent to server until submit)
   - Progress bar + question palette
   - Timer (countdown, auto-submit on 0)
   - Previous / Next navigation
   - Manual submit with confirmation
   - POST /api/quizzes/:id/submit with answers + timeTaken
   - Redirect to result page on success
   ============================================================ */

requireAuth();

/* ----------------------------------------------------------
   State
   ---------------------------------------------------------- */
let quiz          = null;   // quiz metadata
let questions     = [];     // array of question objects
let answers       = {};     // { questionId: "A"|"B"|"C"|"D" }
let currentIndex  = 0;      // 0-based current question index
let timerInterval = null;   // setInterval ref
let secondsLeft   = 0;      // countdown
let startTime     = Date.now();
let submitted     = false;

/* ----------------------------------------------------------
   DOM refs
   ---------------------------------------------------------- */
const loadingState    = document.getElementById("loadingState");
const quizContent     = document.getElementById("quizContent");
const navSubject      = document.getElementById("navSubject");
const navProgress     = document.getElementById("navProgress");
const timerDisplay    = document.getElementById("timerDisplay");
const timerText       = document.getElementById("timerText");
const progressBar     = document.getElementById("progressBar");
const progressBarWrap = document.getElementById("progressBarWrap");
const questionLabel   = document.getElementById("questionLabel");
const difficultyBadge = document.getElementById("difficultyBadge");
const questionText    = document.getElementById("questionText");
const optionsList     = document.getElementById("optionsList");
const prevBtn         = document.getElementById("prevBtn");
const nextBtn         = document.getElementById("nextBtn");
const submitBtn       = document.getElementById("submitBtn");
const paletteMini     = document.getElementById("paletteMini");
const timesUpOverlay  = document.getElementById("timesUpOverlay");

/* ----------------------------------------------------------
   Boot — read quizId from URL and load quiz
   ---------------------------------------------------------- */
async function init() {
  const params = new URLSearchParams(window.location.search);
  const quizId = params.get("quizId");

  if (!quizId) {
    redirectTo("/client/home.html");
    return;
  }

  try {
    const data = await apiGet(`/quizzes/${quizId}`);
    quiz      = data.data.quiz;
    questions = data.data.questions;

    if (!questions.length) {
      showError("This quiz has no questions. Please go back and try again.");
      return;
    }

    // Populate navbar
    if (navSubject) navSubject.textContent = quiz.subject_name || "Quiz";

    // Set difficulty badge
    if (difficultyBadge) {
      difficultyBadge.textContent = capitalize(quiz.difficulty);
      difficultyBadge.className   = `badge badge-${quiz.difficulty}`;
    }

    // Start timer if enabled
    if (quiz.timer_enabled && quiz.time_limit_seconds) {
      secondsLeft = quiz.time_limit_seconds;
      startTimer();
    }

    // Record start time
    startTime = Date.now();

    // Show first question
    loadingState.style.display = "none";
    quizContent.style.display  = "block";
    renderQuestion(0);
  } catch (err) {
    showError(err.message || "Failed to load quiz. Please try again.");
  }
}

/* ----------------------------------------------------------
   Timer
   ---------------------------------------------------------- */
function startTimer() {
  if (!timerDisplay) return;
  timerDisplay.style.display = "flex";
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    secondsLeft--;
    updateTimerDisplay();

    if (secondsLeft <= 0) {
      clearInterval(timerInterval);
      handleTimesUp();
    }
  }, 1000);
}

function updateTimerDisplay() {
  if (!timerText) return;
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  timerText.textContent = `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;

  // Warning state when under 60 seconds
  if (timerDisplay) {
    timerDisplay.classList.toggle("warning", secondsLeft <= 60 && secondsLeft > 0);
  }
}

function handleTimesUp() {
  if (submitted) return;
  // Show overlay
  if (timesUpOverlay) timesUpOverlay.style.display = "flex";
  // Auto-submit after 1.5s
  setTimeout(() => submitQuiz(true), 1500);
}

/* ----------------------------------------------------------
   Render a question
   ---------------------------------------------------------- */
function renderQuestion(index) {
  if (!questions[index]) return;
  currentIndex = index;

  const q = questions[index];
  const total = questions.length;

  // Labels
  if (questionLabel)
    questionLabel.textContent = `Question ${index + 1} of ${total}`;
  if (navProgress)
    navProgress.textContent = `${index + 1} / ${total}`;

  // Progress bar
  const pct = Math.round(((index + 1) / total) * 100);
  if (progressBar)     progressBar.style.width = `${pct}%`;
  if (progressBarWrap) progressBarWrap.setAttribute("aria-valuenow", pct);

  // Question text
  if (questionText) questionText.textContent = q.question_text;

  // Options
  if (optionsList) {
    const optionKeys = ["A", "B", "C", "D"];
    const optionValues = [q.option_a, q.option_b, q.option_c, q.option_d];
    const selected = answers[String(q.id)];

    optionsList.innerHTML = "";

    optionKeys.forEach((key, i) => {
      const item = document.createElement("div");
      item.className = `option-item${selected === key ? " selected" : ""}`;
      item.setAttribute("role", "radio");
      item.setAttribute("aria-checked", selected === key ? "true" : "false");
      item.setAttribute("tabindex", "0");
      item.setAttribute("data-key", key);
      item.setAttribute("aria-label", `Option ${key}: ${optionValues[i]}`);

      item.innerHTML = `
        <div class="option-letter">${key}</div>
        <div class="option-text">${escapeHtml(optionValues[i])}</div>
      `;

      item.addEventListener("click", () => selectAnswer(q.id, key));
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectAnswer(q.id, key); }
      });

      optionsList.appendChild(item);
    });
  }

  // Nav buttons
  if (prevBtn) prevBtn.disabled = index === 0;
  if (nextBtn) nextBtn.style.display = index === total - 1 ? "none" : "inline-flex";
  if (submitBtn) submitBtn.style.display = index === total - 1 ? "inline-flex" : "none";

  // Update palette
  renderPalette();
}

/* ----------------------------------------------------------
   Select an answer
   ---------------------------------------------------------- */
function selectAnswer(questionId, key) {
  answers[String(questionId)] = key;
  renderQuestion(currentIndex); // re-render to update selection UI
}

/* ----------------------------------------------------------
   Question palette (mini dots)
   ---------------------------------------------------------- */
function renderPalette() {
  if (!paletteMini) return;
  paletteMini.innerHTML = "";

  questions.forEach((q, idx) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = `palette-dot${idx === currentIndex ? " current" : answers[String(q.id)] ? " answered" : ""}`;
    dot.textContent = idx + 1;
    dot.setAttribute("aria-label", `Question ${idx + 1}${answers[String(q.id)] ? " (answered)" : ""}`);
    dot.addEventListener("click", () => renderQuestion(idx));
    paletteMini.appendChild(dot);
  });
}

/* ----------------------------------------------------------
   Navigation
   ---------------------------------------------------------- */
prevBtn?.addEventListener("click", () => {
  if (currentIndex > 0) renderQuestion(currentIndex - 1);
});

nextBtn?.addEventListener("click", () => {
  if (currentIndex < questions.length - 1) renderQuestion(currentIndex + 1);
});

/* ----------------------------------------------------------
   Submit
   ---------------------------------------------------------- */
submitBtn?.addEventListener("click", () => {
  const unanswered = questions.filter(q => !answers[String(q.id)]).length;
  if (unanswered > 0) {
    const ok = confirm(
      `You have ${unanswered} unanswered question${unanswered > 1 ? "s" : ""}.\n\nSubmit anyway?`
    );
    if (!ok) return;
  }
  submitQuiz(false);
});

/* ----------------------------------------------------------
   Submit quiz to API
   ---------------------------------------------------------- */
async function submitQuiz(autoSubmit = false) {
  if (submitted) return;
  submitted = true;

  // Stop timer
  if (timerInterval) clearInterval(timerInterval);

  // Calculate time taken
  const timeTakenSeconds = Math.round((Date.now() - startTime) / 1000);

  // Disable buttons
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Submitting…"; }
  if (nextBtn)   nextBtn.disabled   = true;
  if (prevBtn)   prevBtn.disabled   = true;

  try {
    const data = await apiPost(`/quizzes/${quiz.id}/submit`, {
      answers,
      timeTakenSeconds,
    });

    const attemptId = data.data.attemptId;

    // Store for result page
    sessionStorage.setItem("lastAttempt", JSON.stringify({
      subjectName:   quiz.subject_name,
      difficulty:    quiz.difficulty,
      questionCount: questions.length,
      score:         data.data.score,
    }));

    redirectTo(`/client/result.html?attemptId=${attemptId}`);
  } catch (err) {
    submitted = false;
    if (timesUpOverlay) timesUpOverlay.style.display = "none";
    if (submitBtn) {
      submitBtn.disabled    = false;
      submitBtn.textContent = "Submit Quiz ✓";
    }
    alert(`Submission failed: ${err.message}\n\nPlease try again.`);
  }
}

/* ----------------------------------------------------------
   Error display
   ---------------------------------------------------------- */
function showError(message) {
  if (loadingState) {
    loadingState.innerHTML = `
      <div style="font-size:2.5rem;margin-bottom:12px;" aria-hidden="true">⚠️</div>
      <h3 style="font-size:16px;font-weight:600;color:#0F172A;margin-bottom:8px;">Error</h3>
      <p style="color:#64748B;font-size:13px;margin-bottom:20px;">${escapeHtml(message)}</p>
      <a href="home.html" style="color:#6C63FF;font-weight:600;">← Back to Home</a>
    `;
  }
}

/* ----------------------------------------------------------
   Keyboard shortcuts
   ---------------------------------------------------------- */
document.addEventListener("keydown", (e) => {
  if (submitted) return;
  if (["A","B","C","D"].includes(e.key.toUpperCase()) && questions[currentIndex]) {
    selectAnswer(questions[currentIndex].id, e.key.toUpperCase());
  }
  if (e.key === "ArrowRight" && currentIndex < questions.length - 1) renderQuestion(currentIndex + 1);
  if (e.key === "ArrowLeft"  && currentIndex > 0)                    renderQuestion(currentIndex - 1);
});

/* Utility */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

init();
