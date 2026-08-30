/* Shared data + rendering helpers for the AI Readiness Gap Scorecard
   (manager form: ai-hazirlik-raporu.html, team form: takim-degerlendirmesi.html) */

window.AIReport = (function () {
  const QUESTIONS = [
    { id: 1, dim: "leadership", text: "Yapay zekâdan beklediğimiz iş sonuçları yazılı olarak tanımlı." },
    { id: 2, dim: "leadership", text: "Her öncelikli kullanım alanının birincil hedefi net: büyüme, verimlilik, kalite veya risk azaltma." },
    { id: 3, dim: "leadership", text: "Hangi kullanım alanlarına yatırım yapılacağı ve hangilerinin erteleneceği belli." },
    { id: 4, dim: "leadership", text: "Yapay zekâ gündeminde karar verme yetkisi olan açık bir sahip var." },
    { id: 5, dim: "human_trust", text: "Ekiplerin mevcut yapay zekâ beceri seviyesi ölçüldü." },
    { id: 6, dim: "human_trust", text: "Kurum, çalışanların hâlihazırda kullandığı onaylı ve onaysız araçlar hakkında görünürlük sahibi." },
    { id: 7, dim: "human_trust", text: "Öğrenme ve uygulama için mesai içinde zaman ayrılıyor." },
    { id: 8, dim: "human_trust", text: "Tanımlı sınırlar içinde yeni bir çalışma biçimini denemek, ilk sonuç bekleneni vermese bile destekleniyor." },
    { id: 9, dim: "workflows", text: "En fazla süre, hata veya maliyet üreten süreçleri veriye dayanarak biliyoruz." },
    { id: 10, dim: "workflows", text: "Pilot için iş değeri yüksek ve hata maliyeti yönetilebilir süreçler seçildi." },
    { id: 11, dim: "workflows", text: "Seçilen süreçlerin başlangıç performansı ölçüldü." },
    { id: 12, dim: "workflows", text: "Başarılı bir pilotu günlük işe ve kurum geneline taşımanın yolu tanımlı." },
    { id: 13, dim: "technology", text: "Öncelikli kullanım alanları için gereken veri erişilebilir, güncel ve yeterli kalitede." },
    { id: 14, dim: "technology", text: "Çözüm mevcut sistemlere bağlanabiliyor; süreç kalıcı olarak kopyala-yapıştır işlemine dayanmıyor." },
    { id: 15, dim: "technology", text: "Araç seçimi ihtiyaca, veri sınırlarına ve toplam maliyete göre yapılıyor." },
    { id: 16, dim: "technology", text: "Kullanım, maliyet, kalite ve performans izleniyor." },
    { id: 17, dim: "governance", text: "Onaylı araçlar listesi var ve güncel tutuluyor." },
    { id: 18, dim: "governance", text: "Hangi verinin hangi sistemle paylaşılabileceği yazılı." },
    { id: 19, dim: "governance", text: "İnsan onayının zorunlu olduğu karar ve işlem noktaları tanımlı." },
    { id: 20, dim: "governance", text: "Hata ve ihlaller için cezalandırıcı olmayan, izlenebilir bir bildirim ve müdahale süreci var." },
  ];

  const DIMENSION_LABELS = {
    leadership: "Liderlik ve strateji",
    human_trust: "İnsan ve güven",
    workflows: "İş akışları",
    technology: "Teknoloji ve uygulama",
    governance: "Yönetişim ve ölçüm",
  };

  const DIMENSION_ORDER = ["leadership", "human_trust", "workflows", "technology", "governance"];

  const SCALE_LABELS = [
    "Hiç yok",
    "Konuşuluyor",
    "Kısmen var",
    "Büyük ölçüde var",
    "Tanımlı, yazılı ve işliyor",
  ];

  function renderQuestions(container, namePrefix) {
    let html = "";
    let lastDim = null;
    for (const q of QUESTIONS) {
      if (q.dim !== lastDim) {
        html += `<p class="assessment-dimension-label">${DIMENSION_LABELS[q.dim]}</p>`;
        lastDim = q.dim;
      }
      html += `
        <div class="assessment-question" data-question="${q.id}">
          <p class="assessment-question-text">${q.id}. ${q.text}</p>
          <div class="scale-group" role="radiogroup">
            ${SCALE_LABELS.map(
              (label, i) => `
              <div class="scale-option">
                <input type="radio" name="${namePrefix}-q${q.id}" id="${namePrefix}-q${q.id}-${i}" value="${i}" required>
                <label for="${namePrefix}-q${q.id}-${i}">
                  <span class="scale-num">${i}</span>
                  <span class="scale-text">${label}</span>
                </label>
              </div>`
            ).join("")}
          </div>
        </div>`;
    }
    container.innerHTML = html;
  }

  function collectAnswers(root, namePrefix) {
    const answers = {};
    for (const q of QUESTIONS) {
      const checked = root.querySelector(`input[name="${namePrefix}-q${q.id}"]:checked`);
      if (!checked) return null;
      answers[String(q.id)] = parseInt(checked.value, 10);
    }
    return answers;
  }

  function countAnswered(root, namePrefix) {
    let n = 0;
    for (const q of QUESTIONS) {
      if (root.querySelector(`input[name="${namePrefix}-q${q.id}"]:checked`)) n++;
    }
    return n;
  }

  function watchProgress(root, namePrefix, fillEl) {
    root.addEventListener("change", () => {
      const n = countAnswered(root, namePrefix);
      fillEl.style.width = Math.round((n / QUESTIONS.length) * 100) + "%";
    });
  }

  function renderDimensionBars(container, dimensionScores) {
    let html = "";
    for (const dim of DIMENSION_ORDER) {
      const score = dimensionScores[dim];
      html += `
        <div class="result-dimension-row">
          <div class="result-dimension-header">
            <span>${DIMENSION_LABELS[dim]}</span>
            <span>${score.toFixed(2)} / 4</span>
          </div>
          <div class="result-dimension-track">
            <div class="result-dimension-fill" style="width:${(score / 4) * 100}%"></div>
          </div>
        </div>`;
    }
    container.innerHTML = html;
  }

  function renderDiffBars(container, diff, managerScores, teamScores) {
    let html = "";
    for (const dim of DIMENSION_ORDER) {
      const d = diff.perDimension[dim];
      const mVal = managerScores[dim];
      const tVal = teamScores[dim];
      html += `
        <div class="diff-dimension-row">
          <div class="diff-dimension-header">
            <span>${DIMENSION_LABELS[dim]}</span>
            <span>fark: ${d.diff > 0 ? "+" : ""}${d.diff.toFixed(2)}</span>
          </div>
          <div class="diff-bar-pair">
            <div class="diff-bar-label">
              <span style="color:var(--color-fuchsia)">●</span> Yönetim (${mVal.toFixed(2)})
            </div>
            <div class="diff-bar-track"><div class="diff-bar-fill manager" style="width:${(mVal / 4) * 100}%"></div></div>
          </div>
          <div class="diff-bar-pair">
            <div class="diff-bar-label">
              <span style="color:var(--color-turquoise)">●</span> Ekip (${tVal.toFixed(2)})
            </div>
            <div class="diff-bar-track"><div class="diff-bar-fill team" style="width:${(tVal / 4) * 100}%"></div></div>
          </div>
          <p class="diff-band-note">${d.band.meaning} — ${d.band.action}</p>
        </div>`;
    }
    container.innerHTML = html;
  }

  function trackEvent(eventName, sessionId, metadata) {
    try {
      fetch("/api/ai-report-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventName, sessionId, metadata }),
        keepalive: true,
      }).catch(() => {});
    } catch (e) {
      /* never let instrumentation break the UI */
    }
  }

  return {
    QUESTIONS,
    DIMENSION_LABELS,
    DIMENSION_ORDER,
    SCALE_LABELS,
    renderQuestions,
    collectAnswers,
    countAnswered,
    watchProgress,
    renderDimensionBars,
    renderDiffBars,
    trackEvent,
  };
})();
