const { neon } = require("@neondatabase/serverless");

function getConnectionString() {
  // Neon-via-Vercel-Marketplace and vercel-postgres have used different
  // env var names across versions; check the common ones in priority order.
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING
  );
}

let sqlClient = null;
function sql(strings, ...values) {
  if (!sqlClient) {
    const conn = getConnectionString();
    if (!conn) {
      throw new Error("No database connection string found in environment variables.");
    }
    sqlClient = neon(conn);
  }
  return sqlClient(strings, ...values);
}

let migrated = false;
async function ensureSchema() {
  if (migrated) return;
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
  await sql`
    CREATE TABLE IF NOT EXISTS ai_report_assessments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_name TEXT NOT NULL,
      role TEXT NOT NULL,
      email TEXT NOT NULL,
      answers JSONB NOT NULL,
      dimension_scores JSONB NOT NULL,
      overall_score NUMERIC(5,2) NOT NULL,
      level TEXT NOT NULL,
      consent BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS ai_report_team_responses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_id UUID NOT NULL REFERENCES ai_report_assessments(id) ON DELETE CASCADE,
      answers JSONB NOT NULL,
      dimension_scores JSONB NOT NULL,
      overall_score NUMERIC(5,2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS ai_report_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_name TEXT NOT NULL,
      session_id UUID,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  migrated = true;
}

module.exports = { sql, ensureSchema };
