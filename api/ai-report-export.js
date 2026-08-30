const { sql, ensureSchema } = require("./_lib/db");

function toCsvValue(v) {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(rows, columns) {
  const header = columns.join(",");
  const lines = rows.map((r) => columns.map((c) => toCsvValue(r[c])).join(","));
  return [header, ...lines].join("\n");
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const expected = process.env.AI_REPORT_EXPORT_TOKEN;
  const provided = req.query && req.query.token;
  if (!expected || provided !== expected) {
    res.status(401).json({ error: "Yetkisiz." });
    return;
  }

  const type = (req.query && req.query.type) || "assessments";

  try {
    await ensureSchema();

    if (type === "assessments") {
      const rows = await sql`
        SELECT id, company_name, role, email, overall_score, level,
               dimension_scores, consent, created_at
        FROM ai_report_assessments
        ORDER BY created_at DESC
      `;
      const csv = toCsv(rows, [
        "id", "company_name", "role", "email", "overall_score", "level",
        "dimension_scores", "consent", "created_at",
      ]);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=ai-report-assessments.csv");
      res.status(200).send(csv);
      return;
    }

    if (type === "team_responses") {
      const rows = await sql`
        SELECT id, assessment_id, overall_score, dimension_scores, created_at
        FROM ai_report_team_responses
        ORDER BY created_at DESC
      `;
      const csv = toCsv(rows, ["id", "assessment_id", "overall_score", "dimension_scores", "created_at"]);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=ai-report-team-responses.csv");
      res.status(200).send(csv);
      return;
    }

    if (type === "events") {
      const rows = await sql`
        SELECT id, event_name, session_id, metadata, created_at
        FROM ai_report_events
        ORDER BY created_at DESC
      `;
      const csv = toCsv(rows, ["id", "event_name", "session_id", "metadata", "created_at"]);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=ai-report-events.csv");
      res.status(200).send(csv);
      return;
    }

    res.status(400).json({ error: "Geçersiz type. assessments, team_responses veya events kullanın." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Beklenmeyen bir hata oluştu." });
  }
};
