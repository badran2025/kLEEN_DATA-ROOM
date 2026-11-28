import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";

const pgUrl = process.env.NETLIFY_DB_URL || process.env.DATABASE_URL;
if (!pgUrl) {
  console.error("Set NETLIFY_DB_URL or DATABASE_URL before running this migration script.");
  process.exit(1);
}

const TABLES_IN_ORDER = [
  "users",
  "projects",
  "project_status_history",
  "project_integrations",
  "groups",
  "project_participants",
  "drive_nodes",
  "document_permissions",
  "document_notes",
  "document_favorites",
  "label_definitions",
  "document_labels",
  "external_links",
  "signature_requests",
  "terms_of_access",
  "terms_acceptances",
  "qna_questions",
  "checklist_items",
  "activity_logs",
  "report_subscriptions",
  "archive_orders",
];

async function main() {
  const sqlite = new DatabaseSync("data/kleen.db");
  const pool = new Pool({
    connectionString: pgUrl,
    ssl: pgUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const table of TABLES_IN_ORDER) {
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
      if (rows.length === 0) continue;

      const cols = Object.keys(rows[0]);
      const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(", ");
      const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`;

      for (const row of rows) {
        await client.query(
          sql,
          cols.map((c) => row[c])
        );
      }
      console.log(`Migrated ${rows.length} row(s) -> ${table}`);
    }
    await client.query("COMMIT");
    console.log("Migration completed cleanly.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
