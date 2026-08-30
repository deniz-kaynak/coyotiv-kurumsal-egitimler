const { sql, ensureSchema } = require("./_lib/db");

const ALLOWED_EVENTS = new Set([
  "report_download",
  "manager_form_start",
  "manager_form_complete",
  "team_link_requested",
  "team_response_submitted",
  "meeting_cta_click",
]);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  // Fire-and-forget instrumentation: never let this block or break the UI.
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { eventName, sessionId, metadata } = body || {};
    if (!ALLOWED_EVENTS.has(eventName)) {
      res.status(204).end();
      return;
    }
    await ensureSchema();
    await sql`
      INSERT INTO ai_report_events (event_name, session_id, metadata)
      VALUES (${eventName}, ${sessionId || null}, ${metadata ? JSON.stringify(metadata) : null})
    `;
  } catch (err) {
    console.error("event log failed", err);
  }
  res.status(204).end();
};
