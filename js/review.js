/* ============================================================
   QuizMind AI — Review Answers Page (Phase 12)
   ============================================================ */

requireAuth();

async function init() {
  const params    = new URLSearchParams(window.location.search);
  const attemptId = params.get("attemptId");

  if (!attemptId) { redirectTo("/client/history.html"); return; }

  try {
    // Fetch review + attempt metadata in parallel
    const [reviewRes, attemptRes] = await Promise.all([
      apiGet(`/attempts/${attemptId}/review`),
      apiGet(`/attempts/${attemptId}`),
    ]);

    const review  = reviewRes.data.review;
    const attempt = attemptRes.data.attempt;

    document.getElementById("loadingState").style.display  = "none";
    document.getElementById("reviewContent").style.display = "block";

    // Meta line
    document.getElementById("reviewMeta").textContent =
      `${attempt.subject_name} · ${capitalize(attempt.difficulty)} · ` +
      `Score: ${Math.round(attempt.score)}%`;

    // Summary bar
    const correct    = attempt.correct_count;
    const wrong      = attempt.wrong_count;
    const unanswered = attempt.unanswered_count;

    document.getElementById("reviewSummaryBar").innerHTML = `
      <span style="color:#059669;">✓ Correct: ${correct}</span>
      <span style="color:#DC2626;">✕ Incorrect: ${wrong}</span>
      <span style="color:#94A3B8;">— Skipped: ${unanswered}</span>
      <span style="color:#475569;">Total: ${correct + wrong + unanswered}</span>
    `;

    // Render each question
    const list = document.getElementById("questionsList");
    review.forEach((item, idx) => {
      const isCorrect    = item.is_correct;
      const isUnanswered = !item.selected_answer;
      const statusClass  = isCorrect ? "correct-q" : isUnanswered ? "skip-q" : "wrong-q";
      const statusText   = isCorrect ? "✓ Correct" : isUnanswered ? "— Skipped" : "✕ Incorrect";
      const statusCls    = isCorrect ? "status-correct" : isUnanswered ? "status-unanswered" : "status-wrong";

      const options = [
        { key: "A", text: item.option_a },
        { key: "B", text: item.option_b },
        { key: "C", text: item.option_c },
        { key: "D", text: item.option_d },
      ];

      const optionsHtml = options.map(opt => {
        const isCorrectOpt = opt.key === item.correct_answer;
        const isUserWrong  = opt.key === item.selected_answer && !isCorrect;
        let cls = "review-option";
        if (isCorrectOpt)  cls += " correct-ans";
        if (isUserWrong)   cls += " user-wrong";

        return `
          <div class="${cls}">
            <div class="review-option-letter">${opt.key}</div>
            <div>${escapeHtml(opt.text)}
              ${isCorrectOpt ? ' <span style="font-size:11px;font-weight:700;">(Correct)</span>' : ""}
              ${isUserWrong  ? ' <span style="font-size:11px;font-weight:700;">(Your answer)</span>' : ""}
              ${opt.key === item.selected_answer && isCorrect ? ' <span style="font-size:11px;font-weight:700;">(Your answer ✓)</span>' : ""}
            </div>
          </div>
        `;
      }).join("");

      const card = document.createElement("div");
      card.className = `review-q ${statusClass}`;
      card.innerHTML = `
        <div class="review-q-header">
          <span class="review-q-num">Question ${idx + 1}</span>
          <span class="review-q-status ${statusCls}">${statusText}</span>
        </div>
        <p class="review-q-text">${escapeHtml(item.question_text)}</p>
        <div class="review-options">${optionsHtml}</div>
        <div class="review-explanation">
          <strong>Explanation</strong>
          ${escapeHtml(item.explanation)}
        </div>
      `;

      list.appendChild(card);
    });

    document.title = `Review — ${attempt.subject_name} — QuizMind AI`;
  } catch (err) {
    document.getElementById("loadingState").innerHTML = `
      <div style="font-size:2.5rem;margin-bottom:12px;">⚠️</div>
      <p style="color:#64748B;">${err.message || "Could not load review."}</p>
      <a href="history.html" style="color:#6C63FF;font-weight:600;display:inline-block;margin-top:12px;">← History</a>
    `;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

init();
