const { sql, ensureSchema } = require("./_lib/db");
const { computeScores, computeDiff, MIN_TEAM_RESPONSES } = require("./_lib/scoring");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { sessionId, answers } = body || {};

    if (!sessionId || typeof sessionId !== "string") {
      res.status(400).json({ error: "Geçersiz link." });
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

    const assessmentRows = await sql`
      SELECT id, dimension_scores, overall_score
      FROM ai_report_assessments
      WHERE id = ${sessionId}
    `;
    if (assessmentRows.length === 0) {
      res.status(404).json({ error: "Bu link artık geçerli değil." });
      return;
    }
    const assessment = assessmentRows[0];

    // No identity fields are stored for team responses by design.
    await sql`
      INSERT INTO ai_report_team_responses (assessment_id, answers, dimension_scores, overall_score)
      VALUES (${sessionId}, ${JSON.stringify(answers)}, ${JSON.stringify(scores.dimensionScores)}, ${scores.overallScore})
    `;

    const countRows = await sql`
      SELECT COUNT(*)::int AS count FROM ai_report_team_responses WHERE assessment_id = ${sessionId}
    `;
    const count = countRows[0].count;

    if (count < MIN_TEAM_RESPONSES) {
      res.status(200).json({ count, ready: false, minResponses: MIN_TEAM_RESPONSES });
      return;
    }

    const teamAgg = await aggregateTeam(sessionId);
    const managerDimensionScores = assessment.dimension_scores;
    const managerOverall = Number(assessment.overall_score);
    const diff = computeDiff(managerDimensionScores, teamAgg.dimensionScores);

    res.status(200).json({
      count,
      ready: true,
      minResponses: MIN_TEAM_RESPONSES,
      diff,
      managerScores: { dimensionScores: managerDimensionScores, overallScore: managerOverall },
      teamScores: teamAgg,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin." });
  }
};

async function aggregateTeam(sessionId) {
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
  const dimensionScores = Object.fromEntries(dims.map((d) => [d, Math.round((sums[d] / n) * 100) / 100]));
  const overallScore = Math.round((overallSum / n) * 100) / 100;
  return { dimensionScores, overallScore, responseCount: n };
}
