/* ============================================================
   QuizMind AI — Quiz Configuration JavaScript
   Responsibilities:
     - Auth guard (must be logged in to configure a quiz)
     - Read selected subject from sessionStorage
     - Populate subject name, icon, domain badge in header
     - Difficulty tile selection logic
     - Question count tile selection logic
     - Timer toggle logic
     - Calculate total time limit (difficulty × count × seconds/q)
     - Live update time summary box
     - Live update config summary row
     - Validate all selections before submitting
     - POST /api/quizzes/generate (stub returns 501 until Phase 9)
     - On success: store quiz in sessionStorage + redirect to quiz.html
   ============================================================ */

requireAuth();

/* ----------------------------------------------------------
   Timer constants — from spec:
   Easy   = 90 seconds / question
   Medium = 90 seconds / question
   Hard   = 120 seconds / question
   ---------------------------------------------------------- */
const SECONDS_PER_QUESTION = { easy: 90, medium: 90, hard: 120 };

/* ----------------------------------------------------------
   State
   ---------------------------------------------------------- */
let selectedDifficulty = null;  // "easy" | "medium" | "hard"
let selectedCount      = null;  // 10 | 15 | 20 | 25
let timerEnabled       = false; // true | false
let subject            = null;  // object from sessionStorage

/* ----------------------------------------------------------
   DOM references
   ---------------------------------------------------------- */
const subjectIcon      = document.getElementById("subjectIcon");
const subjectName      = document.getElementById("subjectName");
const domainIcon       = document.getElementById("domainIcon");
const domainName       = document.getElementById("domainName");
const backBtn          = document.getElementById("backBtn");
const configAlert      = document.getElementById("configAlert");
const alertMessage     = document.getElementById("alertMessage");
const timeSummary      = document.getElementById("timeSummary");
const timeSummaryText  = document.getElementById("timeSummaryText");
const configSummary    = document.getElementById("configSummary");
const summarySubject   = document.getElementById("summarySubject");
const summaryDifficulty= document.getElementById("summaryDifficulty");
const summaryCount     = document.getElementById("summaryCount");
const summaryTimer     = document.getElementById("summaryTimer");
const generateBtn      = document.getElementById("generateBtn");

// Difficulty tiles
const difficultyTiles = {
  easy:   document.getElementById("tile-easy"),
  medium: document.getElementById("tile-medium"),
  hard:   document.getElementById("tile-hard"),
};

// Question count tiles
const countTiles = {
  10: document.getElementById("tile-10"),
  15: document.getElementById("tile-15"),
  20: document.getElementById("tile-20"),
  25: document.getElementById("tile-25"),
};

// Timer radio labels
const timerOffLabel = document.getElementById("timer-off-label");
const timerOnLabel  = document.getElementById("timer-on-label");
const timerOffInput = document.getElementById("timerOff");
const timerOnInput  = document.getElementById("timerOn");

/* ----------------------------------------------------------
   1. Load subject from sessionStorage
   ---------------------------------------------------------- */
function loadSubject() {
  const raw = sessionStorage.getItem("selectedSubject");

  if (!raw) {
    // No subject selected — redirect back to home
    redirectTo("/client/home.html");
    return;
  }

  try {
    subject = JSON.parse(raw);
  } catch {
    redirectTo("/client/home.html");
    return;
  }

  // Populate header
  if (subjectIcon) subjectIcon.textContent = subject.domainIcon || "📚";
  if (subjectName) subjectName.textContent = subject.name       || "Quiz";
  if (domainIcon)  domainIcon.textContent  = subject.domainIcon || "🧠";
  if (domainName)  domainName.textContent  = subject.domainName || "Domain";

  // Update back button to go back to home (domain/subject selection)
  if (backBtn) backBtn.href = "/client/home.html";

  // Update page title
  document.title = `Configure: ${subject.name} — QuizMind AI`;
}

/* ----------------------------------------------------------
   2. Difficulty tile selection
   ---------------------------------------------------------- */
Object.entries(difficultyTiles).forEach(([value, tile]) => {
  if (!tile) return;

  tile.addEventListener("click", () => selectDifficulty(value));

  // Keyboard: Enter / Space
  tile.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectDifficulty(value);
    }
  });
});

function selectDifficulty(value) {
  selectedDifficulty = value;
  hideAlert();

  // Update tile styles
  Object.entries(difficultyTiles).forEach(([v, tile]) => {
    if (!tile) return;
    // Remove all selected classes
    tile.classList.remove("selected-easy", "selected-medium", "selected-hard");
    tile.setAttribute("aria-checked", "false");
  });

  const selected = difficultyTiles[value];
  if (selected) {
    selected.classList.add(`selected-${value}`);
    selected.setAttribute("aria-checked", "true");
  }

  updateTimeSummary();
  updateConfigSummary();
}

/* ----------------------------------------------------------
   3. Question count tile selection
   ---------------------------------------------------------- */
Object.entries(countTiles).forEach(([value, tile]) => {
  if (!tile) return;

  tile.addEventListener("click", () => selectCount(Number(value)));

  tile.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectCount(Number(value));
    }
  });
});

function selectCount(value) {
  selectedCount = value;
  hideAlert();

  Object.values(countTiles).forEach((tile) => {
    if (!tile) return;
    tile.classList.remove("selected-count");
    tile.setAttribute("aria-checked", "false");
  });

  const selected = countTiles[value];
  if (selected) {
    selected.classList.add("selected-count");
    // Tiny bounce on selection
    selected.style.transform = "scale(1.05)";
    setTimeout(() => { selected.style.transform = ""; }, 200);
  }
    selected.setAttribute("aria-checked", "true");
  }

  updateTimeSummary();
  updateConfigSummary();
}

/* ----------------------------------------------------------
   4. Timer toggle
   ---------------------------------------------------------- */
function handleTimerChange() {
  timerEnabled = timerOnInput.checked;

  // Update label styles
  if (timerOffLabel) timerOffLabel.classList.toggle("selected", !timerEnabled);
  if (timerOnLabel)  timerOnLabel.classList.toggle("selected",  timerEnabled);

  updateTimeSummary();
  updateConfigSummary();
}

timerOffInput?.addEventListener("change", handleTimerChange);
timerOnInput?.addEventListener("change",  handleTimerChange);

// Set initial state (No Timer selected by default)
if (timerOffLabel) timerOffLabel.classList.add("selected");

/* ----------------------------------------------------------
   5. Time summary calculation
      Total = question_count × seconds_per_question(difficulty)
   ---------------------------------------------------------- */
function calcTotalSeconds() {
  if (!selectedDifficulty || !selectedCount) return null;
  return selectedCount * SECONDS_PER_QUESTION[selectedDifficulty];
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (seconds === 0) return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  return `${minutes} min ${seconds} sec`;
}

function updateTimeSummary() {
  if (!timeSummary || !timeSummaryText) return;

  if (!timerEnabled) {
    timeSummary.classList.remove("visible");
    return;
  }

  const total = calcTotalSeconds();

  if (!total) {
    timeSummary.classList.add("visible");
    timeSummaryText.textContent = "Select difficulty and question count to see total time.";
    return;
  }

  const secsPerQ = SECONDS_PER_QUESTION[selectedDifficulty];

  timeSummary.classList.add("visible");
  timeSummaryText.innerHTML =
    `<strong>${selectedCount} questions</strong> × ` +
    `<strong>${secsPerQ}s</strong> per question = ` +
    `<strong>${formatDuration(total)}</strong> total`;
}

/* ----------------------------------------------------------
   6. Config summary row (shown when all selections made)
   ---------------------------------------------------------- */
function updateConfigSummary() {
  if (!configSummary) return;

  const allSet = selectedDifficulty && selectedCount && subject;

  if (!allSet) {
    configSummary.style.display = "none";
    return;
  }

  configSummary.style.display = "flex";

  if (summarySubject)    summarySubject.textContent    = subject.name;
  if (summaryDifficulty) summaryDifficulty.textContent = capitalize(selectedDifficulty);
  if (summaryCount)      summaryCount.textContent      = `${selectedCount} questions`;

  // Make generate button pulse when all config is complete
  if (generateBtn) generateBtn.classList.add("ready");

  if (summaryTimer) {
    if (!timerEnabled) {
      summaryTimer.textContent = "No Timer";
    } else {
      const total = calcTotalSeconds();
      summaryTimer.textContent = total ? formatDuration(total) : "Enabled";
    }
  }
}

/* ----------------------------------------------------------
   7. Alert helpers
   ---------------------------------------------------------- */
function showAlert(message) {
  if (!configAlert || !alertMessage) return;
  alertMessage.textContent = message;
  configAlert.classList.add("show");
  configAlert.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideAlert() {
  configAlert?.classList.remove("show");
}

/* ----------------------------------------------------------
   8. Validate all selections
   ---------------------------------------------------------- */
function validate() {
  if (!subject) {
    showAlert("No subject selected. Please go back and choose a subject.");
    return false;
  }
  if (!selectedDifficulty) {
    showAlert("Please select a difficulty level.");
    return false;
  }
  if (!selectedCount) {
    showAlert("Please select the number of questions.");
    return false;
  }
  return true;
}

/* ----------------------------------------------------------
   9. Generate quiz — POST /api/quizzes/generate
      Phase 9 will implement the AI service.
      Phase 8 just wires the request and handles responses.
   ---------------------------------------------------------- */
generateBtn?.addEventListener("click", async () => {
  hideAlert();

  if (!validate()) return;

  // Build config object
  const timerEnabled_ = timerEnabled;
  const totalSeconds  = timerEnabled_ ? calcTotalSeconds() : null;

  const payload = {
    subjectId:          subject.id,
    difficulty:         selectedDifficulty,
    questionCount:      selectedCount,
    timerEnabled:       timerEnabled_,
    timeLimitSeconds:   totalSeconds,
  };

  // UI: loading state
  generateBtn.classList.add("loading");
  generateBtn.disabled = true;
  generateBtn.innerHTML = `<span aria-hidden="true">✨</span> Generating your quiz…`;

  try {
    const data = await apiPost("/quizzes/generate", payload);

    // Success — store quiz info and navigate to quiz page
    sessionStorage.setItem("activeQuiz", JSON.stringify({
      quizId:           data.data.quizId,
      subjectName:      subject.name,
      domainName:       subject.domainName,
      difficulty:       selectedDifficulty,
      questionCount:    selectedCount,
      timerEnabled:     timerEnabled_,
      timeLimitSeconds: totalSeconds,
    }));

    redirectTo(`/client/quiz.html?quizId=${data.data.quizId}`);
  } catch (err) {
    // Phase 8 — AI not integrated yet: show friendly message
    if (err.status === 501 || err.status === 404) {
      showAlert("AI quiz generation will be available in Phase 9. Your configuration has been saved.");
      // Store config for later
      sessionStorage.setItem("pendingQuizConfig", JSON.stringify(payload));
    } else if (err.status === 0) {
      showAlert("Cannot connect to the server. Please make sure the server is running.");
    } else {
      showAlert(err.message || "Quiz generation failed. Please try again.");
    }

    // Restore button
    generateBtn.classList.remove("loading");
    generateBtn.disabled = false;
    generateBtn.innerHTML = `<span aria-hidden="true">✨</span> Generate Quiz`;
  }
});

/* ----------------------------------------------------------
   10. Keyboard accessibility for tiles
       Tiles use role="radio" so arrow keys should work
   ---------------------------------------------------------- */
function setupArrowNav(tilesObj) {
  const entries = Object.entries(tilesObj).filter(([, el]) => el);

  entries.forEach(([, tile], idx) => {
    tile.addEventListener("keydown", (e) => {
      let next = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        next = entries[(idx + 1) % entries.length][1];
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        next = entries[(idx + entries.length - 1) % entries.length][1];
      }
      next?.focus();
    });
  });
}

setupArrowNav(difficultyTiles);
setupArrowNav(countTiles);

/* ----------------------------------------------------------
   Utility — capitalize first letter (from api.js)
   Defined locally in case api.js version not available
   ---------------------------------------------------------- */
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ----------------------------------------------------------
   Boot
   ---------------------------------------------------------- */
loadSubject();
