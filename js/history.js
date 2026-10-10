/* ============================================================
   QuizMind AI — Quiz History Page (Phase 13)
   Features:
   - Auth guard
   - Load attempts from GET /api/attempts with filters
   - Subject filter dropdown (from GET /api/domains subjects)
   - Difficulty filter
   - Date range filter
   - Active filter badges with remove buttons
   - Summary stats (total, avg, best, questions solved)
   - Paginated attempt cards
   - Skeleton loading states
   - Empty + error states
   - Links to result and review pages
   ============================================================ */

requireAuth();

/* ----------------------------------------------------------
   State
   ---------------------------------------------------------- */
const PAGE_SIZE  = 10;
let currentPage  = 1;
let totalAttempts= 0;
let activeFilters= { subjectId: "", difficulty: "", dateFrom: "", dateTo: "" };
let allSubjects  = [];

/* ----------------------------------------------------------
   DOM refs
   ---------------------------------------------------------- */
const skeletonList    = document.getElementById("skeletonList");
const attemptsList    = document.getElementById("attemptsList");
const emptyState      = document.getElementById("emptyState");
const errorState      = document.getElementById("errorState");
const errorMsg        = document.getElementById("errorMsg");
const activeFiltersEl = document.getElementById("activeFilters");
const paginationEl    = document.getElementById("pagination");
const prevPageBtn     = document.getElementById("prevPageBtn");
const nextPageBtn     = document.getElementById("nextPageBtn");
const pageInfo        = document.getElementById("pageInfo");

const filterSubject    = document.getElementById("filterSubject");
const filterDifficulty = document.getElementById("filterDifficulty");
const filterDateFrom   = document.getElementById("filterDateFrom");
const filterDateTo     = document.getElementById("filterDateTo");
const applyFiltersBtn  = document.getElementById("applyFiltersBtn");
const clearFiltersBtn  = document.getElementById("clearFiltersBtn");
const retryBtn         = document.getElementById("retryBtn");

/* ----------------------------------------------------------
   Load subjects for filter dropdown
   ---------------------------------------------------------- */
async function loadSubjectOptions() {
  try {
    // Get all domains then their subjects
    const data    = await apiGet("/domains");
    const domains = data.data;

    for (const domain of domains) {
      const subData = await apiGet(`/domains/${domain.id}/subjects`);
      const subjects= subData.data.subjects;
      allSubjects.push(...subjects.map(s => ({ ...s, domainName: domain.name })));
    }

    // Group by domain in the dropdown
    const grouped = {};
    allSubjects.forEach(s => {
      if (!grouped[s.domainName]) grouped[s.domainName] = [];
      grouped[s.domainName].push(s);
    });

    Object.entries(grouped).forEach(([domainName, subjects]) => {
      const group = document.createElement("optgroup");
      group.label = domainName;
      subjects.forEach(s => {
        const opt     = document.createElement("option");
        opt.value     = s.id;
        opt.textContent = s.name;
        group.appendChild(opt);
      });
      filterSubject.appendChild(group);
    });
  } catch {
    // Non-critical — filter just won't have subject options
  }
}

/* ----------------------------------------------------------
   Load attempts from API
   ---------------------------------------------------------- */
async function loadAttempts(page = 1) {
  currentPage = page;
  const offset = (page - 1) * PAGE_SIZE;

  // Show skeletons
  skeletonList.style.display  = "block";
  attemptsList.style.display  = "none";
  emptyState.style.display    = "none";
  errorState.style.display    = "none";
  paginationEl.style.display  = "none";

  // Build query string
  const params = new URLSearchParams({
    limit:  PAGE_SIZE,
    offset,
  });

  if (activeFilters.subjectId)  params.set("subjectId",  activeFilters.subjectId);
  if (activeFilters.difficulty) params.set("difficulty", activeFilters.difficulty);
  if (activeFilters.dateFrom)   params.set("dateFrom",   activeFilters.dateFrom);
  if (activeFilters.dateTo)     params.set("dateTo",     activeFilters.dateTo + "T23:59:59Z");

  try {
    const data     = await apiGet(`/attempts?${params.toString()}`);
    const attempts = data.data;
    totalAttempts  = data.meta?.total || attempts.length;

    skeletonList.style.display = "none";

    if (attempts.length === 0) {
      const hasFilters = Object.values(activeFilters).some(Boolean);
      document.getElementById("emptyTitle").textContent = hasFilters
        ? "No quizzes match your filters"
        : "No quizzes yet";
      document.getElementById("emptyMsg").textContent = hasFilters
        ? "Try adjusting or clearing your filters."
        : "You haven't taken any quizzes yet. Start practising!";
      emptyState.style.display = "flex";
      emptyState.style.flexDirection = "column";
      emptyState.style.alignItems    = "center";
      updateSummaryStats([]);
      return;
    }

    renderAttempts(attempts);
    updateSummaryStats(attempts);
    updatePagination();
    renderActiveBadges();
  } catch (err) {
    skeletonList.style.display = "none";
    errorMsg.textContent       = err.message || "Failed to load history.";
    errorState.style.display   = "flex";
    errorState.style.flexDirection = "column";
    errorState.style.alignItems    = "center";
  }
}

/* ----------------------------------------------------------
   Render attempt cards
   ---------------------------------------------------------- */
function renderAttempts(attempts) {
  attemptsList.style.display = "block";
  attemptsList.innerHTML     = "";

  const list = document.createElement("div");
  list.className = "attempts-list";

  attempts.forEach(attempt => {
    const score     = Math.round(parseFloat(attempt.score) || 0);
    const ringClass = score >= 80 ? "score-ring-high" : score >= 50 ? "score-ring-medium" : "score-ring-low";
    const dateStr   = formatDate(attempt.completed_at);
    const timeStr   = attempt.time_taken_seconds ? formatTime(attempt.time_taken_seconds) : "—";

    const card = document.createElement("article");
    card.className = "attempt-card";
    card.innerHTML = `
      <!-- Score ring -->
      <div class="attempt-score-ring ${ringClass}" aria-label="Score: ${score}%">
        <span>${score}%</span>
      </div>

      <!-- Info -->
      <div class="attempt-info">
        <div class="attempt-subject">${escapeHtml(attempt.subject_name)}</div>
        <div class="attempt-meta">
          <span class="attempt-meta-item">${capitalize(attempt.difficulty)}</span>
          <span class="attempt-meta-dot" aria-hidden="true"></span>
          <span class="attempt-meta-item">${attempt.question_count} Questions</span>
          <span class="attempt-meta-dot" aria-hidden="true"></span>
          <span class="attempt-meta-item">⏱ ${timeStr}</span>
        </div>
        <div class="attempt-date">${dateStr}</div>
      </div>

      <!-- Mini stats -->
      <div class="attempt-stats" aria-label="Stats">
        <div class="attempt-stat-mini">
          <div class="attempt-stat-mini-value stat-correct">${attempt.correct_count}</div>
          <div class="attempt-stat-mini-label">Correct</div>
        </div>
        <div class="attempt-stat-mini">
          <div class="attempt-stat-mini-value stat-wrong">${attempt.wrong_count}</div>
          <div class="attempt-stat-mini-label">Wrong</div>
        </div>
        <div class="attempt-stat-mini">
          <div class="attempt-stat-mini-value stat-skip">${attempt.unanswered_count}</div>
          <div class="attempt-stat-mini-label">Skipped</div>
        </div>
      </div>

      <!-- Actions -->
      <div class="attempt-actions">
        <a href="result.html?attemptId=${attempt.id}"
           class="btn-attempt btn-attempt-primary" aria-label="View result">
          📊 Result
        </a>
        <a href="review.html?attemptId=${attempt.id}"
           class="btn-attempt btn-attempt-secondary" aria-label="Review answers">
          📖 Review
        </a>
      </div>
    `;

    list.appendChild(card);
  });

  attemptsList.appendChild(list);
}

/* ----------------------------------------------------------
   Summary stats (computed from current page data)
   ---------------------------------------------------------- */
function updateSummaryStats(attempts) {
  document.getElementById("summaryTotal").textContent = totalAttempts;

  if (attempts.length === 0) {
    ["summaryAvg","summaryBest","summaryQuestions"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = "—";
    });
    return;
  }

  // Explicitly parse to numbers — PostgreSQL NUMERIC comes back as string
  const scores = attempts.map(a => parseFloat(a.score) || 0);
  const counts = attempts.map(a => parseInt(a.question_count, 10) || 0);

  const avg  = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  const best = Math.round(Math.max(...scores));
  const qs   = counts.reduce((s, v) => s + v, 0);

  const avgEl  = document.getElementById("summaryAvg");
  const bestEl = document.getElementById("summaryBest");
  const qsEl   = document.getElementById("summaryQuestions");

  if (avgEl)  avgEl.textContent  = isNaN(avg)  ? "—" : `${avg}%`;
  if (bestEl) bestEl.textContent = isNaN(best) ? "—" : `${best}%`;
  if (qsEl)   qsEl.textContent   = qs;
}

/* ----------------------------------------------------------
   Pagination
   ---------------------------------------------------------- */
function updatePagination() {
  const totalPages = Math.ceil(totalAttempts / PAGE_SIZE);
  if (totalPages <= 1) { paginationEl.style.display = "none"; return; }

  paginationEl.style.display = "flex";
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage >= totalPages;
}

prevPageBtn?.addEventListener("click", () => loadAttempts(currentPage - 1));
nextPageBtn?.addEventListener("click", () => loadAttempts(currentPage + 1));

/* ----------------------------------------------------------
   Active filter badges
   ---------------------------------------------------------- */
function renderActiveBadges() {
  activeFiltersEl.innerHTML = "";

  const labels = {
    subjectId:  v => `Subject: ${allSubjects.find(s => String(s.id) === String(v))?.name || v}`,
    difficulty: v => `Difficulty: ${capitalize(v)}`,
    dateFrom:   v => `From: ${v}`,
    dateTo:     v => `To: ${v}`,
  };

  Object.entries(activeFilters).forEach(([key, value]) => {
    if (!value) return;

    const badge  = document.createElement("span");
    badge.className = "filter-badge";
    badge.innerHTML = `
      ${escapeHtml(labels[key]?.(value) || value)}
      <button class="filter-badge-remove" aria-label="Remove ${key} filter">✕</button>
    `;
    badge.querySelector("button").addEventListener("click", () => {
      activeFilters[key] = "";
      // Clear the corresponding form input
      if (key === "subjectId")  filterSubject.value    = "";
      if (key === "difficulty") filterDifficulty.value = "";
      if (key === "dateFrom")   filterDateFrom.value   = "";
      if (key === "dateTo")     filterDateTo.value     = "";
      loadAttempts(1);
    });

    activeFiltersEl.appendChild(badge);
  });
}

/* ----------------------------------------------------------
   Filter buttons
   ---------------------------------------------------------- */
applyFiltersBtn?.addEventListener("click", () => {
  activeFilters.subjectId  = filterSubject.value;
  activeFilters.difficulty = filterDifficulty.value;
  activeFilters.dateFrom   = filterDateFrom.value;
  activeFilters.dateTo     = filterDateTo.value;
  loadAttempts(1);
});

clearFiltersBtn?.addEventListener("click", () => {
  activeFilters = { subjectId: "", difficulty: "", dateFrom: "", dateTo: "" };
  filterSubject.value    = "";
  filterDifficulty.value = "";
  filterDateFrom.value   = "";
  filterDateTo.value     = "";
  loadAttempts(1);
});

retryBtn?.addEventListener("click", () => loadAttempts(currentPage));

/* ----------------------------------------------------------
   Utilities
   ---------------------------------------------------------- */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

/* ----------------------------------------------------------
   Boot
   ---------------------------------------------------------- */
async function init() {
  await loadSubjectOptions();
  await loadAttempts(1);
}

init();
