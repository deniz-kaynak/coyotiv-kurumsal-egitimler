const { sql, ensureSchema } = require("./_lib/db");
const { computeDiff, deriveFromDimensionScores, MIN_TEAM_RESPONSES } = require("./_lib/scoring");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const sessionId = req.query && req.query.session;
    if (!sessionId || typeof sessionId !== "string") {
      res.status(400).json({ error: "Geçersiz link." });
      return;
    }

    await ensureSchema();

    const assessmentRows = await sql`
      SELECT id, company_name, dimension_scores, overall_score, level
      FROM ai_report_assessments
      WHERE id = ${sessionId}
    `;
    if (assessmentRows.length === 0) {
      res.status(404).json({ error: "Bu değerlendirme bulunamadı." });
      return;
    }
    const assessment = assessmentRows[0];

    const countRows = await sql`
      SELECT COUNT(*)::int AS count FROM ai_report_team_responses WHERE assessment_id = ${sessionId}
    `;
    const count = countRows[0].count;

    const derived = deriveFromDimensionScores(assessment.dimension_scores, Number(assessment.overall_score));

    const base = {
      sessionId: assessment.id,
      companyName: assessment.company_name,
      managerScores: {
        dimensionScores: assessment.dimension_scores,
        overallScore: Number(assessment.overall_score),
        level: assessment.level,
        priority: derived.priority,
        lowestDimensionName: derived.lowestDimensionName,
      },
      count,
      minResponses: MIN_TEAM_RESPONSES,
    };

    if (count < MIN_TEAM_RESPONSES) {
      res.status(200).json({ ...base, ready: false });
      return;
    }

    const rows = await sql`
      SELECT dimension_scores, overall_score
      FROM ai_report_team_responses
      WHERE assessment_id = ${sessionId}
    `;
    const dims = ["leadership", "human_trust", "workflows", "technology", "governance"];
    const sums = Object.fromEntries(dims.map((d) => [d, 0]));
    let overallSum = 0;
    for (const r of rows) {
      for (const d of dims) sums[d] += Number(r.dimension_scores[d]);
      overallSum += Number(r.overall_score);
    }
    const n = rows.length;
    const teamDimensionScores = Object.fromEntries(dims.map((d) => [d, Math.round((sums[d] / n) * 100) / 100]));
    const teamOverallScore = Math.round((overallSum / n) * 100) / 100;

    const diff = computeDiff(base.managerScores.dimensionScores, teamDimensionScores);

    res.status(200).json({
      ...base,
      ready: true,
      diff,
      teamScores: { dimensionScores: teamDimensionScores, overallScore: teamOverallScore, responseCount: n },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Beklenmeyen bir hata oluştu." });
  }
};
