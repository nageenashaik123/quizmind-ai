/* ============================================================
   QuizMind AI — Home Page JavaScript
   Spec: two-panel layout, real API data, no hardcoded names/stats
   ============================================================ */

/* ── Guard: only redirect if page is protected ──────────────
   The home page is public but shows different content
   when authenticated. We don't hard-redirect unauthenticated
   users so they can see the page with Login/Register CTAs.
   ---------------------------------------------------------- */
const IS_LOGGED_IN = isLoggedIn();

/* ----------------------------------------------------------
   ICONS / ILLUSTRATIONS per domain
   (fetched from API — these are decorative only)
   ---------------------------------------------------------- */
const DOMAIN_ILLUSTRATIONS = { 1: "🌏", 2: "📖", 3: "📊", 4: "💻" };

const DOMAIN_DESCRIPTIONS = {
  1: "History, Polity, Geography, Science, Current Affairs and more",
  2: "Grammar, Vocabulary, Reading Comprehension, Para Jumbles and more",
  3: "Aptitude, Reasoning, Data Interpretation and more",
  4: "DSA, DBMS, Operating Systems, Computer Networks, AI, ML and more",
};

const SUBJECT_ICONS = [
  "💻","🤖","🌐","🗄️","⚙️","🧠","📐","📖",
  "🔬","📊","🎯","📝","🔢","💡","🛡️",
];

/* ----------------------------------------------------------
   DOM references
   ---------------------------------------------------------- */
const userDropdownWrap = document.getElementById("userDropdownWrap");
const userTrigger      = document.getElementById("userTrigger");
const userDropdownMenu = document.getElementById("userDropdownMenu");
const navAuthButtons   = document.getElementById("navAuthButtons");
const dropdownName     = document.getElementById("dropdownName");
const dropdownEmail    = document.getElementById("dropdownEmail");
const logoutBtn        = document.getElementById("logoutBtn");

const statsGrid        = document.getElementById("statsGrid");
const statsGuestMsg    = document.getElementById("statsGuestMsg");
const statQuizzes      = document.getElementById("statQuizzes");
const statAvgScore     = document.getElementById("statAvgScore");
const statQuestions    = document.getElementById("statQuestions");
const statBestScore    = document.getElementById("statBestScore");

const continueContent  = document.getElementById("continueContent");
const ccEmpty          = document.getElementById("ccEmpty");

const skeletonGrid     = document.getElementById("skeletonGrid");
const domainsGrid      = document.getElementById("domainsGrid");
const domainsError     = document.getElementById("domainsError");
const homeLayout       = document.getElementById("homeLayout");
const subjectsView     = document.getElementById("subjectsView");
const subjectsGrid     = document.getElementById("subjectsGrid");
const subjectsError    = document.getElementById("subjectsError");
const subjectsDomainIcon = document.getElementById("subjectsDomainIcon");
const subjectsDomainName = document.getElementById("subjectsDomainName");
const subjectsDomainDesc = document.getElementById("subjectsDomainDesc");
const subjectsCountPill  = document.getElementById("subjectsCountPill");
const backBtn          = document.getElementById("backBtn");
const retryDomainsBtn  = document.getElementById("retryDomainsBtn");
const retrySubjectsBtn = document.getElementById("retrySubjectsBtn");

let currentDomainId = null;

/* ----------------------------------------------------------
   1. Navbar auth state
      - Logged in:  show User dropdown, keep Login/Register visible
      - Logged out: hide dropdown, show Login/Register only
   ---------------------------------------------------------- */
function initNavAuth() {
  if (IS_LOGGED_IN) {
    const user = getUser();
    // Show user dropdown
    if (userDropdownWrap) userDropdownWrap.style.display = "block";
    // Populate dropdown info + REAL NAME in trigger button
    if (user) {
      const firstName = user.name ? user.name.split(" ")[0] : "User";

      // Navbar trigger: shows real first name
      const triggerName = document.getElementById("userTriggerName");
      if (triggerName) triggerName.textContent = firstName;

      // Dropdown header
      if (dropdownName)  dropdownName.textContent  = user.name  || "User";
      if (dropdownEmail) dropdownEmail.textContent = user.email || "";

      // Sidebar welcome: "Welcome Back, Nageena 👋"
      const welcomeName = document.getElementById("welcomeName");
      if (welcomeName) welcomeName.textContent = firstName;
    }
    // Login/Register still visible per spec
  } else {
    // Not logged in — hide dropdown
    if (userDropdownWrap) userDropdownWrap.style.display = "none";
    // Stats show guest message
    showGuestStats();
  }
}

function showGuestStats() {
  if (statsGrid)    statsGrid.style.display    = "none";
  if (statsGuestMsg) statsGuestMsg.style.display = "block";
}

/* ----------------------------------------------------------
   2. User dropdown toggle
   ---------------------------------------------------------- */
userTrigger?.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = userDropdownWrap.classList.toggle("open");
  userTrigger.setAttribute("aria-expanded", String(isOpen));
  const chevron = userTrigger.querySelector(".chevron");
  if (chevron) chevron.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)";
});

document.addEventListener("click", () => {
  userDropdownWrap?.classList.remove("open");
  userTrigger?.setAttribute("aria-expanded", "false");
  const chevron = userTrigger?.querySelector(".chevron");
  if (chevron) chevron.style.transform = "rotate(0deg)";
});

userDropdownMenu?.addEventListener("click", (e) => e.stopPropagation());

/* ----------------------------------------------------------
   3. Logout
   ---------------------------------------------------------- */
logoutBtn?.addEventListener("click", () => {
  clearAuth();
  redirectTo("/client/login.html");
});

/* ----------------------------------------------------------
   4. "Start a Quiz" and "Take a Quiz Now" buttons
      — scroll to domain section
   ---------------------------------------------------------- */
document.getElementById("startQuizBtn")?.addEventListener("click", () => {
  document.getElementById("domainsSection")?.scrollIntoView({ behavior: "smooth" });
});

document.getElementById("takeQuizBtn")?.addEventListener("click", () => {
  document.getElementById("domainsSection")?.scrollIntoView({ behavior: "smooth" });
});

/* ----------------------------------------------------------
   5. Load stats from /api/dashboard
      Only attempt if logged in. Show — dashes if unavailable.
   ---------------------------------------------------------- */
async function loadStats() {
  if (!IS_LOGGED_IN) return;

  try {
    const data = await apiGet("/dashboard");
    const s    = data.data;

    animateCount(statQuizzes,   s.totalQuizzes   || 0, "");
    animateCount(statQuestions, s.totalQuestions || 0, "");
    if (statAvgScore)  statAvgScore.textContent  = s.avgScore  != null ? `${Math.round(s.avgScore)}%`  : "—";
    if (statBestScore) statBestScore.textContent = s.bestScore != null ? `${Math.round(s.bestScore)}%` : "—";
  } catch {
    // Dashboard API not yet available — keep dashes, no error shown
    // This is expected until Phase 14
  }
}

function animateCount(el, target, suffix) {
  if (!el || !target) return;
  let current = 0;
  const steps = 20;
  const step  = target / steps;
  const timer = setInterval(() => {
    current += step;
    if (current >= target) { el.textContent = target + suffix; clearInterval(timer); }
    else el.textContent = Math.floor(current) + suffix;
  }, 600 / steps);
}

/* ----------------------------------------------------------
   6. Continue Learning — fetch last attempt from /api/attempts
      Show empty state if no attempts exist.
      Show "View Result" if attempt is completed.
   ---------------------------------------------------------- */
async function loadContinueLearning() {
  if (!IS_LOGGED_IN) return;

  try {
    const data     = await apiGet("/attempts?limit=1");
    const attempts = data.data || [];

    if (!attempts.length) return; // keep empty state

    const last = attempts[0];
    const pct  = Math.round(last.score || 0);

    // Build the continue-learning inner content
    if (ccEmpty)  ccEmpty.style.display = "none";

    continueContent.innerHTML = `
      <div class="cc-item">
        <div class="cc-item-icon" aria-hidden="true">💻</div>
        <div>
          <div class="cc-item-name">${escapeHtml(last.subject_name || "Quiz")}</div>
          <div class="cc-item-meta">
            ${last.question_count || "—"} Questions
            ${last.difficulty ? " · " + capitalize(last.difficulty) : ""}
          </div>
        </div>
      </div>
      <div class="cc-progress-row">
        <div class="cc-progress-bar">
          <div class="cc-progress-fill" style="width:${pct}%"></div>
        </div>
        <span class="cc-pct">${pct}%</span>
      </div>
      <a href="result.html?attemptId=${last.id}" class="cc-btn">
        View Result →
      </a>
    `;
  } catch {
    // Attempts API not yet ready — keep empty state
  }
}

/* ----------------------------------------------------------
   7. Load and render domain cards
   ---------------------------------------------------------- */
async function loadDomains() {
  skeletonGrid.style.display = "grid";
  domainsGrid.style.display  = "none";
  domainsError.style.display = "none";

  try {
    const data    = await apiGet("/domains");
    const domains = data.data;

    skeletonGrid.style.display = "none";

    if (!domains || domains.length === 0) {
      domainsError.style.display = "block";
      return;
    }

    domainsGrid.style.display = "grid";
    renderDomainCards(domains);
  } catch (err) {
    skeletonGrid.style.display = "none";
    domainsError.style.display = "block";
    console.error("[home] loadDomains:", err.message);
  }
}

function renderDomainCards(domains) {
  domainsGrid.innerHTML = "";

  domains.forEach((domain) => {
    const illustration = DOMAIN_ILLUSTRATIONS[domain.id] || "📚";
    const description  = DOMAIN_DESCRIPTIONS[domain.id]  || domain.description || "";

    const card = document.createElement("article");
    card.className = "domain-card";
    card.setAttribute("role", "listitem");
    card.setAttribute("tabindex", "0");
    card.setAttribute("data-domain", domain.id);
    card.setAttribute("aria-label", `${domain.name} — click to view subjects`);

    card.innerHTML = `
      <div class="dc-icon-box" aria-hidden="true">${domain.icon || "📚"}</div>
      <div class="dc-title">${escapeHtml(domain.name)}</div>
      <div class="dc-illustration" aria-hidden="true">${illustration}</div>
      <div class="dc-desc">${escapeHtml(description)}</div>
      <div class="dc-footer">
        <span class="dc-badge" id="dc-count-${domain.id}">Loading…</span>
        <span class="dc-arrow" aria-hidden="true">→</span>
      </div>
    `;

    card.addEventListener("click",   () => handleDomainClick(domain));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleDomainClick(domain); }
    });

    domainsGrid.appendChild(card);
  });

  // Load subject counts in parallel
  domains.forEach((d) => loadSubjectCount(d.id));
}

async function loadSubjectCount(domainId) {
  try {
    const data  = await apiGet(`/domains/${domainId}/subjects`);
    const count = data.data.subjects.length;
    const el    = document.getElementById(`dc-count-${domainId}`);
    if (el) el.textContent = `${count} subject${count !== 1 ? "s" : ""}`;
  } catch {
    const el = document.getElementById(`dc-count-${domainId}`);
    if (el) el.textContent = "View subjects";
  }
}

/* ----------------------------------------------------------
   8. Domain click → show subject selection
   ---------------------------------------------------------- */
async function handleDomainClick(domain) {
  // Require login before configuring a quiz
  if (!IS_LOGGED_IN) {
    sessionStorage.setItem("redirectAfterLogin", "/client/home.html");
    redirectTo("/client/login.html");
    return;
  }
  currentDomainId = domain.id;
  await loadSubjects(domain.id);
}

async function loadSubjects(domainId) {
  // Switch to subject view
  homeLayout.style.display = "none";
  subjectsView.classList.add("visible");
  window.scrollTo({ top: 0, behavior: "smooth" });

  subjectsGrid.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:60px 0;">
      <div class="spinner spinner-lg" style="margin:0 auto;"></div>
      <p style="margin-top:16px;color:#64748B;font-size:13px;font-weight:500;">Loading subjects…</p>
    </div>
  `;
  subjectsError.style.display = "none";

  try {
    const data               = await apiGet(`/domains/${domainId}/subjects`);
    const { domain, subjects } = data.data;

    subjectsDomainIcon.textContent = domain.icon || "📚";
    subjectsDomainName.textContent = domain.name;
    subjectsDomainDesc.textContent = domain.description || "";
    subjectsCountPill.textContent  = `${subjects.length} Subject${subjects.length !== 1 ? "s" : ""}`;

    renderSubjectCards(subjects, domain);
  } catch (err) {
    subjectsGrid.innerHTML      = "";
    subjectsError.style.display = "block";
    console.error("[home] loadSubjects:", err.message);
  }
}

function renderSubjectCards(subjects, domain) {
  subjectsGrid.innerHTML = "";

  if (subjects.length === 0) {
    subjectsGrid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#64748B;">
        <div style="font-size:2.5rem;margin-bottom:12px;">📭</div>
        <h3 style="font-size:16px;font-weight:600;">No subjects found</h3>
        <p style="font-size:13px;margin-top:6px;">This domain has no subjects yet.</p>
      </div>
    `;
    return;
  }

  subjects.forEach((subject, idx) => {
    const icon = SUBJECT_ICONS[idx % SUBJECT_ICONS.length];
    const card = document.createElement("article");
    card.className = "subject-card";
    card.setAttribute("role", "listitem");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `${subject.name} — click to configure quiz`);

    card.innerHTML = `
      <div class="subject-icon" aria-hidden="true">${icon}</div>
      <div class="subject-name">${escapeHtml(subject.name)}</div>
      <div class="subject-start">Start →</div>
    `;

    card.addEventListener("click",   () => goToQuizConfig(subject, domain));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goToQuizConfig(subject, domain); }
    });

    subjectsGrid.appendChild(card);
  });
}

/* ----------------------------------------------------------
   9. Navigate to quiz config — requires login
   ---------------------------------------------------------- */
function goToQuizConfig(subject, domain) {
  // Guard: must be logged in to take a quiz
  if (!IS_LOGGED_IN) {
    sessionStorage.setItem("redirectAfterLogin", "/client/home.html");
    redirectTo("/client/login.html");
    return;
  }

  sessionStorage.setItem("selectedSubject", JSON.stringify({
    id:          subject.id,
    name:        subject.name,
    description: subject.description,
    domainId:    domain.id,
    domainName:  domain.name,
    domainIcon:  domain.icon,
  }));
  redirectTo("/client/quiz-config.html");
}

/* ----------------------------------------------------------
   10. View switching
   ---------------------------------------------------------- */
function showHomeView() {
  homeLayout.style.display = "block";
  subjectsView.classList.remove("visible");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

backBtn?.addEventListener("click", showHomeView);

retryDomainsBtn?.addEventListener("click", loadDomains);

retrySubjectsBtn?.addEventListener("click", () => {
  if (currentDomainId) loadSubjects(currentDomainId);
});

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
function init() {
  initNavAuth();
  loadDomains();

  if (IS_LOGGED_IN) {
    loadStats();
    loadContinueLearning();
  }
}

init();
