/* ============================================================
   QuizMind AI — Result Page (Phase 11)
   ============================================================ */

requireAuth();

async function init() {
  const params    = new URLSearchParams(window.location.search);
  const attemptId = params.get("attemptId");

  if (!attemptId) { redirectTo("/client/home.html"); return; }

  try {
    const data    = await apiGet(`/attempts/${attemptId}`);
    const attempt = data.data.attempt;

    // Hide loading, show card
    document.getElementById("loadingState").style.display = "none";
    const card = document.getElementById("resultCard");
    card.style.display = "block";

    // Score
    const score = Math.round(attempt.score);

    // Emoji + subtitle based on score
    const emoji    = score >= 80 ? "🎉" : score >= 50 ? "👍" : "💪";
    const subtitle = score >= 80 ? "Excellent work!" : score >= 50 ? "Good effort!" : "Keep practising!";

    document.getElementById("resultEmoji").textContent    = emoji;
    document.getElementById("resultSubtitle").textContent = subtitle;

    // Score circle
    const circle = document.getElementById("scoreCircle");
    circle.classList.add(score >= 80 ? "high" : score >= 50 ? "medium" : "low");
    document.getElementById("scoreMain").textContent     = `${score}%`;
    document.getElementById("scoreFraction").textContent =
      `${attempt.correct_count} / ${attempt.correct_count + attempt.wrong_count + attempt.unanswered_count}`;

    // Stats
    document.getElementById("statCorrect").textContent    = attempt.correct_count;
    document.getElementById("statWrong").textContent      = attempt.wrong_count;
    document.getElementById("statUnanswered").textContent = attempt.unanswered_count;

    // Meta
    document.getElementById("metaSubject").textContent    = attempt.subject_name || "—";
    document.getElementById("metaDifficulty").textContent = capitalize(attempt.difficulty || "");
    document.getElementById("metaQuestions").textContent  = attempt.question_count || "—";
    document.getElementById("metaTime").textContent       = attempt.time_taken_seconds
      ? formatTime(attempt.time_taken_seconds)
      : "No timer";

    // Review button
    document.getElementById("reviewBtn").href = `/client/review.html?attemptId=${attemptId}`;

    // Update page title
    document.title = `${score}% — ${attempt.subject_name} — QuizMind AI`;
  } catch (err) {
    document.getElementById("loadingState").innerHTML = `
      <div style="font-size:2.5rem;margin-bottom:12px;">⚠️</div>
      <p style="color:#64748B;">${err.message || "Could not load result."}</p>
      <a href="home.html" style="color:#6C63FF;font-weight:600;display:inline-block;margin-top:12px;">← Home</a>
    `;
  }
}

init();
