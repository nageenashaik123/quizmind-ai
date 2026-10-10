/* ============================================================
   QuizMind AI — Profile Page (Phase 15)
   ============================================================ */

requireAuth();

async function init() {
  try {
    const res    = await apiGet("/profile");
    const { user, stats } = res.data;

    document.getElementById("loadingState").style.display  = "none";
    document.getElementById("profileContent").style.display = "block";

    // Avatar initial
    const initial = (user.name || "U").charAt(0).toUpperCase();
    document.getElementById("profileAvatar").textContent = initial;

    // Header
    document.getElementById("profileName").textContent  = user.name  || "—";
    document.getElementById("profileEmail").textContent = user.email || "—";

    // Fields
    document.getElementById("profileNameField").textContent  = user.name  || "—";
    document.getElementById("profileEmailField").textContent = user.email || "—";
    document.getElementById("profileJoined").textContent     = user.created_at
      ? new Date(user.created_at).toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" })
      : "—";

    // Stats
    document.getElementById("pstatQuizzes").textContent   = stats.totalQuizzes ?? "0";
    document.getElementById("pstatAvg").textContent       = stats.avgScore  != null ? `${Math.round(stats.avgScore)}%`  : "—";
    document.getElementById("pstatBest").textContent      = stats.bestScore != null ? `${Math.round(stats.bestScore)}%` : "—";
    document.getElementById("pstatQuestions").textContent = stats.totalQuestions ?? "0";

    document.title = `${user.name} — QuizMind AI`;
  } catch (err) {
    document.getElementById("loadingState").innerHTML = `
      <div style="font-size:2.5rem;margin-bottom:12px;">⚠️</div>
      <p style="color:#64748B;">${err.message || "Could not load profile."}</p>
      <a href="home.html" style="color:#6C63FF;font-weight:600;display:inline-block;margin-top:12px;">← Home</a>
    `;
  }
}

// Logout
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  clearAuth();
  redirectTo("/client/login.html");
});

// Profile doesn't expose created_at from /api/auth/me,
// so we fetch it from /api/profile which has full user data.
// If created_at isn't there, we skip it gracefully.

init();
