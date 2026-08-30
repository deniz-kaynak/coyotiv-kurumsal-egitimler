// Shared scoring logic for the AI Readiness Gap Scorecard.
// Kept as the single source of truth so the server always recomputes
// (never trusts) scores sent by a client.

const DIMENSIONS = [
  { key: "leadership", name: "Liderlik ve strateji", questions: [1, 2, 3, 4] },
  { key: "human_trust", name: "İnsan ve güven", questions: [5, 6, 7, 8] },
  { key: "workflows", name: "İş akışları", questions: [9, 10, 11, 12] },
  { key: "technology", name: "Teknoloji ve uygulama", questions: [13, 14, 15, 16] },
  { key: "governance", name: "Yönetişim ve ölçüm", questions: [17, 18, 19, 20] },
];

const LEVELS = [
  { min: 0, max: 25, name: "Başlangıç", priority: "Envanter, sahiplik, veri ve güvenlik sınırları" },
  { min: 26, max: 50, name: "Dağınık kullanım", priority: "Ortak okuryazarlık, politika ve tek ölçülebilir pilot" },
  { min: 51, max: 75, name: "Yapılandırılmış", priority: "Rol bazlı uygulama, prototipten üretime geçiş, değer ölçümü" },
  { min: 76, max: 100, name: "Ölçeklenmiş", priority: "Uçtan uca iş akışı tasarımı, ajan yönetişimi, sürekli iyileştirme" },
];

const DIFF_BANDS = [
  { min: 0, max: 0.5, meaning: "Algılar görece hizalı", action: "Ortalama puana ve süreç verisine bakın" },
  { min: 0.5, max: 1.0, meaning: "Karar veya iletişim sahaya tam inmemiş olabilir", action: "Öncelikleri, kuralları ve sahipliği tek sayfada netleştirin" },
  { min: 1.0, max: 1.5, meaning: "Uygulama açığı olabilir", action: "Süreci yöneten ekiplerle iş akışı doğrulaması yapın" },
  { min: 1.5, max: Infinity, meaning: "Kritik algı farkı", action: "Yeni ölçekleme kararından önce envanter ve saha görüşmesi yapın" },
];

const NEGATIVE_DIFF = {
  meaning: "Çalışan deneyimi yönetim algısının önünde olabilir",
  action: "Onaysız kullanımı ve yerel iyi örnekleri araştırın; önce görünürlük kurun",
};

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
]);

const MIN_TEAM_RESPONSES = 5;

function isCorporateEmail(email) {
  const at = String(email || "").trim().toLowerCase();
  const parts = at.split("@");
  if (parts.length !== 2 || !parts[1]) return false;
  const domain = parts[1];
  if (FREE_EMAIL_DOMAINS.has(domain)) return false;
  // very light shape check; full validation happens via the required/type=email input
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain);
}

// answers: object like {"1": 3, "2": 0, ..., "20": 4}
function computeScores(answers) {
  for (let i = 1; i <= 20; i++) {
    const v = answers[String(i)];
    if (typeof v !== "number" || v < 0 || v > 4 || !Number.isInteger(v)) {
      throw new Error(`Invalid answer for question ${i}`);
    }
  }

  const dimensionScores = {};
  for (const dim of DIMENSIONS) {
    const vals = dim.questions.map((q) => answers[String(q)]);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    dimensionScores[dim.key] = Math.round(avg * 100) / 100;
  }

  const allVals = Array.from({ length: 20 }, (_, i) => answers[String(i + 1)]);
  const overallAvg = allVals.reduce((a, b) => a + b, 0) / 20;
  const overallScore = Math.round(overallAvg * 25 * 100) / 100;

  const level = LEVELS.find((l) => overallScore >= l.min && overallScore <= l.max) || LEVELS[0];

  let lowestDim = DIMENSIONS[0];
  for (const dim of DIMENSIONS) {
    if (dimensionScores[dim.key] < dimensionScores[lowestDim.key]) lowestDim = dim;
  }

  return {
    dimensionScores,
    overallScore,
    level: level.name,
    priority: level.priority,
    lowestDimensionKey: lowestDim.key,
    lowestDimensionName: lowestDim.name,
  };
}

// Both the per-dimension and the "genel" (overall) diff are expressed on the
// same 0-4 raw-answer scale, since the band thresholds (0.5 / 1.0 / 1.5) are
// calibrated for that scale, not the 0-100 display score. Because every
// dimension has exactly 4 questions, the average of the 5 dimension averages
// is mathematically identical to the average of all 20 raw answers.
function computeDiff(managerDimensionScores, teamDimensionScores) {
  const perDimension = {};
  let managerSum = 0;
  let teamSum = 0;
  for (const dim of DIMENSIONS) {
    const mVal = managerDimensionScores[dim.key];
    const tVal = teamDimensionScores[dim.key];
    managerSum += mVal;
    teamSum += tVal;
    perDimension[dim.key] = {
      name: dim.name,
      diff: Math.round((mVal - tVal) * 100) / 100,
    };
  }
  const managerAvg = managerSum / DIMENSIONS.length;
  const teamAvg = teamSum / DIMENSIONS.length;
  const overallDiff = Math.round((managerAvg - teamAvg) * 100) / 100;

  function bandFor(diff) {
    if (diff < 0) return NEGATIVE_DIFF;
    return DIFF_BANDS.find((b) => diff >= b.min && diff < b.max) || DIFF_BANDS[DIFF_BANDS.length - 1];
  }

  return {
    overallDiff,
    overallBand: bandFor(overallDiff),
    perDimension: Object.fromEntries(
      Object.entries(perDimension).map(([k, v]) => [k, { ...v, band: bandFor(v.diff) }])
    ),
  };
}

function deriveFromDimensionScores(dimensionScores, overallScore) {
  const level = LEVELS.find((l) => overallScore >= l.min && overallScore <= l.max) || LEVELS[0];
  let lowestDim = DIMENSIONS[0];
  for (const dim of DIMENSIONS) {
    if (dimensionScores[dim.key] < dimensionScores[lowestDim.key]) lowestDim = dim;
  }
  return {
    level: level.name,
    priority: level.priority,
    lowestDimensionKey: lowestDim.key,
    lowestDimensionName: lowestDim.name,
  };
}

module.exports = {
  DIMENSIONS,
  LEVELS,
  DIFF_BANDS,
  NEGATIVE_DIFF,
  MIN_TEAM_RESPONSES,
  isCorporateEmail,
  computeScores,
  computeDiff,
  deriveFromDimensionScores,
};
