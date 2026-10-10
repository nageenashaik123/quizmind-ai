/* ============================================================
   QuizMind AI — Dashboard JavaScript (Phase 14)
   ============================================================ */

requireAuth();

/* ----------------------------------------------------------
   Boot
   ---------------------------------------------------------- */
async function loadDashboard() {
  const loading  = document.getElementById("loadingState");
  const content  = document.getElementById("dashContent");
  const noData   = document.getElementById("noDataState");
  const errState = document.getElementById("errorState");

  loading.style.display  = "block";
  content.style.display  = "none";
  noData.style.display   = "none";
  errState.style.display = "none";

  try {
    const res  = await apiGet("/dashboard");
    const data = res.data;

    loading.style.display = "none";

    // First-time user — no quizzes yet
    if (data.totalQuizzes === 0) {
      noData.style.display = "flex";
      noData.style.flexDirection = "column";
      noData.style.alignItems    = "center";
      return;
    }

    content.style.display = "block";

    renderStatTiles(data);
    renderTrend(data.trend);
    renderSubjectPerformance(data.subjects);
    renderDifficultyBreakdown(data.difficulty);
    renderWeakAreas(data.weakAreas);
    renderStrongAreas(data.strongAreas);
  } catch (err) {
    loading.style.display  = "none";
    errState.style.display = "block";
    document.getElementById("errorMsg").textContent =
      err.message || "Could not load dashboard. Please try again.";
  }
}

/* ----------------------------------------------------------
   Stat tiles
   ---------------------------------------------------------- */
function renderStatTiles(data) {
  setText("statTotalQuizzes",   data.totalQuizzes);
  setText("statAvgScore",       data.avgScore   != null ? `${Math.round(data.avgScore)}%`   : "—");
  setText("statBestScore",      data.bestScore  != null ? `${Math.round(data.bestScore)}%`  : "—");
  setText("statTotalQuestions", data.totalQuestions);
}

/* ----------------------------------------------------------
   Score trend chart (CSS bar chart)
   ---------------------------------------------------------- */
function renderTrend(trend) {
  const container = document.getElementById("trendBars");
  const empty     = document.getElementById("trendEmpty");

  if (!trend || trend.length === 0) {
    container.style.display = "none";
    empty.style.display     = "flex";
    return;
  }

  container.style.display = "flex";
  empty.style.display     = "none";
  container.innerHTML     = "";

  const maxScore = 100;

  trend.forEach((item, idx) => {
    const score  = Math.round(item.score);
    const pct    = (score / maxScore) * 100;
    const cls    = score >= 80 ? "trend-bar-high" : score >= 50 ? "trend-bar-medium" : "trend-bar-low";
    const height = Math.max(pct, 4); // min height so bars are always visible

    const wrap = document.createElement("div");
    wrap.className = "trend-bar-wrap";
    wrap.setAttribute("title", `Quiz ${idx + 1}: ${item.subject_name} — ${score}%`);
    wrap.setAttribute("aria-label", `Quiz ${idx + 1}: ${score}%`);

    wrap.innerHTML = `
      <span class="trend-bar-score" aria-hidden="true">${score}%</span>
      <div class="trend-bar ${cls}" style="height:${height}%;" role="img"
        aria-label="Score ${score}%"></div>
      <span class="trend-bar-label" aria-hidden="true">Q${idx + 1}</span>
    `;

    container.appendChild(wrap);
  });
}

/* ----------------------------------------------------------
   Subject performance bars
   ---------------------------------------------------------- */
function renderSubjectPerformance(subjects) {
  const list   = document.getElementById("subjectPerfList");
  const noData = document.getElementById("subjectNoData");

  if (!subjects || subjects.length === 0) {
    noData.style.display = "block";
    return;
  }

  noData.style.display = "none";
  list.innerHTML       = "";

  subjects.forEach(sub => {
    const score  = Math.round(sub.avg_score);
    const cls    = score >= 80 ? "bar-fill-high" : score >= 50 ? "bar-fill-medium" : "bar-fill-low";

    const item = document.createElement("div");
    item.className = "subject-perf-item";
    item.innerHTML = `
      <div class="subject-perf-row">
        <span class="subject-perf-name" title="${escapeHtml(sub.subject_name)}">
          ${escapeHtml(sub.subject_name)}
        </span>
        <span class="subject-perf-score">${score}%</span>
      </div>
      <div class="subject-perf-bar-wrap" role="progressbar"
        aria-valuenow="${score}" aria-valuemin="0" aria-valuemax="100">
        <div class="subject-perf-bar-fill ${cls}" style="width:${score}%"></div>
      </div>
      <div class="subject-perf-meta">
        Best: ${Math.round(sub.best_score)}% · ${sub.quiz_count} quiz${sub.quiz_count !== 1 ? "es" : ""}
      </div>
    `;

    list.appendChild(item);
  });
}

/* ----------------------------------------------------------
   Difficulty breakdown
   ---------------------------------------------------------- */
function renderDifficultyBreakdown(difficulty) {
  const container = document.getElementById("difficultyRow");
  const noData    = document.getElementById("diffNoData");

  if (!difficulty || difficulty.length === 0) {
    noData.style.display = "block";
    return;
  }

  noData.style.display = "none";
  container.innerHTML  = "";

  const icons  = { easy: "🟢", medium: "🟡", hard: "🔴" };
  const labels = { easy: "Easy",   medium: "Medium",  hard: "Hard" };

  difficulty.forEach(d => {
    const score = Math.round(d.avg_score);
    const item  = document.createElement("div");
    item.className = `difficulty-item diff-${d.difficulty}`;
    item.innerHTML = `
      <div class="difficulty-icon" aria-hidden="true">${icons[d.difficulty] || "🔵"}</div>
      <div class="difficulty-info">
        <div class="difficulty-name">${labels[d.difficulty] || capitalize(d.difficulty)}</div>
        <div class="difficulty-count">${d.quiz_count} quiz${d.quiz_count !== 1 ? "es" : ""}</div>
      </div>
      <div>
        <div class="difficulty-score">${score}%</div>
      </div>
    `;
    container.appendChild(item);
  });
}

/* ----------------------------------------------------------
   Weak areas
   ---------------------------------------------------------- */
function renderWeakAreas(weak) {
  const list   = document.getElementById("weakAreasList");
  const noData = document.getElementById("weakNoData");

  if (!weak || weak.length === 0) {
    noData.style.display = "block";
    return;
  }

  noData.style.display = "none";
  list.innerHTML       = "";

  weak.forEach(area => {
    const item = document.createElement("div");
    item.className = "area-item weak";
    item.innerHTML = `
      <span class="area-icon" aria-hidden="true">⚠️</span>
      <span class="area-name" title="${escapeHtml(area.subject_name)}">
        ${escapeHtml(area.subject_name)}
      </span>
      <span class="area-score">${Math.round(area.avg_score)}%</span>
    `;
    list.appendChild(item);
  });
}

/* ----------------------------------------------------------
   Strong areas
   ---------------------------------------------------------- */
function renderStrongAreas(strong) {
  const list   = document.getElementById("strongAreasList");
  const noData = document.getElementById("strongNoData");

  if (!strong || strong.length === 0) {
    noData.style.display = "block";
    return;
  }

  noData.style.display = "none";
  list.innerHTML       = "";

  strong.forEach(area => {
    const item = document.createElement("div");
    item.className = "area-item strong";
    item.innerHTML = `
      <span class="area-icon" aria-hidden="true">⭐</span>
      <span class="area-name" title="${escapeHtml(area.subject_name)}">
        ${escapeHtml(area.subject_name)}
      </span>
      <span class="area-score">${Math.round(area.avg_score)}%</span>
    `;
    list.appendChild(item);
  });
}

/* ----------------------------------------------------------
   Utilities
   ---------------------------------------------------------- */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "—";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

loadDashboard();
