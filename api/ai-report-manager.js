const { sql, ensureSchema } = require("./_lib/db");
const { isCorporateEmail, computeScores } = require("./_lib/scoring");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { companyName, role, email, answers, consent } = body || {};

    if (!companyName || !String(companyName).trim()) {
      res.status(400).json({ error: "Şirket adı gerekli." });
      return;
    }
    if (!role || !String(role).trim()) {
      res.status(400).json({ error: "Rol gerekli." });
      return;
    }
    if (!email || !isCorporateEmail(email)) {
      res.status(400).json({
        error: "Lütfen kurumsal bir e-posta adresi kullanın. Ücretsiz sağlayıcılar (gmail, hotmail, outlook, yahoo, icloud, proton) kabul edilmiyor.",
      });
      return;
    }
    if (consent !== true) {
      res.status(400).json({ error: "Devam etmek için onay kutusunu işaretlemeniz gerekiyor." });
      return;
    }

    let scores;
    try {
      scores = computeScores(answers || {});
    } catch (e) {
      res.status(400).json({ error: "20 ifadenin tamamı cevaplanmalı." });
      return;
    }

    await ensureSchema();

    const rows = await sql`
      INSERT INTO ai_report_assessments
        (company_name, role, email, answers, dimension_scores, overall_score, level, consent)
      VALUES
        (${String(companyName).trim()}, ${String(role).trim()}, ${String(email).trim().toLowerCase()},
         ${JSON.stringify(answers)}, ${JSON.stringify(scores.dimensionScores)}, ${scores.overallScore},
         ${scores.level}, ${true})
      RETURNING id
    `;

    const id = rows[0].id;

    res.status(200).json({
      sessionId: id,
      overallScore: scores.overallScore,
      level: scores.level,
      priority: scores.priority,
      dimensionScores: scores.dimensionScores,
      lowestDimensionKey: scores.lowestDimensionKey,
      lowestDimensionName: scores.lowestDimensionName,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin." });
  }
};
