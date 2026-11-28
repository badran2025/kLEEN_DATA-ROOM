import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { Pool, types as pgTypes, type PoolClient } from "pg";
import { seedIfEmpty } from "./seed";

// Ensure PostgreSQL BIGINT (OID 20) such as COUNT(*) and sizeBytes parses to JS number
pgTypes.setTypeParser(20, (val: string) => Number(val));

const require = createRequire(import.meta.url);

export function uid(prefix = "id"): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function plain<T>(row: T): T {
  if (row === null || row === undefined) return row;
  if (Array.isArray(row)) return row.map((item) => plain(item)) as unknown as T;
  if (typeof row === "object") return { ...(row as Record<string, unknown>) } as T;
  return row;
}

export interface DbStatement {
  get<T = Record<string, unknown>>(...params: unknown[]): Promise<T | undefined>;
  all<T = Record<string, unknown>>(...params: unknown[]): Promise<T[]>;
  run(...params: unknown[]): Promise<{ changes: number }>;
}

export interface AppDb {
  prepare(sql: string): DbStatement;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: AppDb) => Promise<T>): Promise<T>;
  isPostgres: boolean;
}

const CANONICAL_COLUMNS = [
  "acceptedAt",
  "acceptedContent",
  "accessEnabled",
  "accessEnd",
  "accessStart",
  "accessType",
  "action",
  "actorEmail",
  "actorName",
  "addedBy",
  "adminEmail",
  "adminPhone",
  "aiIntegrationsJson",
  "aiRedaction",
  "aiSearch",
  "aiSimilarQna",
  "aiToolsEnabled",
  "aiTranslation",
  "allowedDomains",
  "allowedIps",
  "answer",
  "assignedGroupId",
  "assignedGroupIds",
  "assignedTo",
  "authorId",
  "autoIndexing",
  "autoSyncIntervalMin",
  "autoTimezone",
  "body",
  "c",
  "category",
  "code",
  "company",
  "configJson",
  "content",
  "createdAt",
  "createdBy",
  "currentGroupName",
  "customInvitations",
  "demoContentText",
  "description",
  "displayMode",
  "docNotifications",
  "docUpdateFrequency",
  "domain",
  "dotIndex",
  "driveApiKey",
  "driveAuthMode",
  "driveCreatedAt",
  "driveFileId",
  "driveModifiedAt",
  "driveOAuthTokensJson",
  "driveRootFolderId",
  "driveRootFolderName",
  "driveServiceAccountJson",
  "driveWebViewLink",
  "durationSeconds",
  "email",
  "emailVerification",
  "enabled",
  "exclusionPatterns",
  "expiresAt",
  "extension",
  "featurePermissionsJson",
  "feedbackCount",
  "filtersJson",
  "firstName",
  "format",
  "frequency",
  "groupId",
  "groupName",
  "groupRole",
  "id",
  "invitationLanguage",
  "inviteToken",
  "isDefaultAdmin",
  "isDeleted",
  "isFaq",
  "isFavorite",
  "isFolder",
  "isPublished",
  "isRedacted",
  "isTrashed",
  "jobTitle",
  "key",
  "labelId",
  "language",
  "lastName",
  "lastSignInAt",
  "lastSyncError",
  "lastSyncStatus",
  "lastSyncedAt",
  "lastViewedAt",
  "level",
  "linkedNodeId",
  "loginBgUrl",
  "logoUrl",
  "metadataJson",
  "mimeType",
  "nodeId",
  "nodeIndex",
  "nodeName",
  "note",
  "noteType",
  "notifyDocChanges",
  "notifyOnVisit",
  "notifyStorageLimit",
  "pageCount",
  "parentDriveId",
  "partId",
  "passcode",
  "passwordChangedAt",
  "passwordHash",
  "phone",
  "priority",
  "projectCode",
  "projectId",
  "projectName",
  "projectType",
  "publishedAt",
  "publishing",
  "redactionStatus",
  "repliesJson",
  "reportType",
  "require2fa",
  "requirePasscode",
  "role",
  "signersJson",
  "sizeBytes",
  "slug",
  "sortOrder",
  "startAt",
  "status",
  "storageLocation",
  "subject",
  "supportAccess",
  "termsContent",
  "termsId",
  "termsTitle",
  "termsType",
  "termsUpdatedAt",
  "themeColor",
  "timezone",
  "title",
  "token",
  "trashedAt",
  "twoFactorEnabled",
  "twoFactorRequired",
  "type",
  "updatedAt",
  "updatedBy",
  "userId",
  "value",
  "valuesJson",
  "versioning",
  "visitsCount",
  "watermarkColor",
  "watermarkCustomText",
  "watermarkEnabled",
  "watermarkFieldsJson",
  "watermarkOnDownload",
  "watermarkOnPrint",
  "watermarkOnView",
  "watermarkOpacity",
  "watermarkPosition",
];

const LOWER_TO_CAMEL = new Map<string, string>(
  CANONICAL_COLUMNS.map((c) => [c.toLowerCase(), c])
);

function normalizeRow<T = Record<string, unknown>>(row: Record<string, unknown> | undefined): T | undefined {
  if (!row) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[LOWER_TO_CAMEL.get(k.toLowerCase()) || k] = v;
  }
  return out as T;
}

function toPgSql(sql: string): string {
  let idx = 0;
  let inSingleQuote = false;
  let out = "";
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" && sql[i - 1] !== "\\") {
      inSingleQuote = !inSingleQuote;
      out += ch;
    } else if (ch === "?" && !inSingleQuote) {
      idx++;
      out += `$${idx}`;
    } else {
      out += ch;
    }
  }
  return out;
}

function wrapPgRunner(runner: { query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> }, poolForTx?: Pool): AppDb {
  return {
    isPostgres: true,
    prepare(sql: string): DbStatement {
      const pgSql = toPgSql(sql);
      return {
        async get<T = Record<string, unknown>>(...params: unknown[]) {
          const res = await runner.query(pgSql, params);
          return normalizeRow<T>(res.rows[0]);
        },
        async all<T = Record<string, unknown>>(...params: unknown[]) {
          const res = await runner.query(pgSql, params);
          return res.rows.map((r) => normalizeRow<T>(r) as T);
        },
        async run(...params: unknown[]) {
          const res = await runner.query(pgSql, params);
          return { changes: res.rowCount ?? 0 };
        },
      };
    },
    async exec(sql: string) {
      await runner.query(sql);
    },
    async transaction<T>(fn: (tx: AppDb) => Promise<T>): Promise<T> {
      if (!poolForTx) {
        return fn(this);
      }
      const client: PoolClient = await poolForTx.connect();
      try {
        await client.query("BEGIN");
        const txDb = wrapPgRunner(client);
        const result = await fn(txDb);
        await client.query("COMMIT");
        return result;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => null);
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

function wrapSqlite(sqliteDb: DatabaseSyncType): AppDb {
  const adapter: AppDb = {
    isPostgres: false,
    prepare(sql: string): DbStatement {
      const stmt = sqliteDb.prepare(sql);
      return {
        async get<T = Record<string, unknown>>(...params: unknown[]) {
          return stmt.get(...(params as never[])) as T | undefined;
        },
        async all<T = Record<string, unknown>>(...params: unknown[]) {
          return stmt.all(...(params as never[])) as T[];
        },
        async run(...params: unknown[]) {
          const info = stmt.run(...(params as never[])) as { changes?: number };
          return { changes: Number(info?.changes ?? 0) };
        },
      };
    },
    async exec(sql: string) {
      sqliteDb.exec(sql);
    },
    async transaction<T>(fn: (tx: AppDb) => Promise<T>): Promise<T> {
      sqliteDb.exec("BEGIN");
      try {
        const res = await fn(adapter);
        sqliteDb.exec("COMMIT");
        return res;
      } catch (e) {
        sqliteDb.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return adapter;
}

const SCHEMA_STATEMENTS = `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    projectCode TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Live',
    projectType TEXT NOT NULL DEFAULT 'Fundraising',
    storageLocation TEXT NOT NULL DEFAULT 'Google Drive Mirror',
    themeColor TEXT NOT NULL DEFAULT '#007AFF',
    logoUrl TEXT,
    loginBgUrl TEXT,
    customInvitations INTEGER NOT NULL DEFAULT 0,
    autoIndexing INTEGER NOT NULL DEFAULT 1,
    versioning INTEGER NOT NULL DEFAULT 1,
    publishing INTEGER NOT NULL DEFAULT 0,
    supportAccess INTEGER NOT NULL DEFAULT 0,
    twoFactorRequired INTEGER NOT NULL DEFAULT 0,
    allowedDomains TEXT NOT NULL DEFAULT '',
    allowedIps TEXT NOT NULL DEFAULT '',
    emailVerification INTEGER NOT NULL DEFAULT 0,
    aiToolsEnabled INTEGER NOT NULL DEFAULT 0,
    aiRedaction INTEGER NOT NULL DEFAULT 0,
    aiSearch INTEGER NOT NULL DEFAULT 0,
    aiTranslation INTEGER NOT NULL DEFAULT 0,
    aiSimilarQna INTEGER NOT NULL DEFAULT 0,
    watermarkEnabled INTEGER NOT NULL DEFAULT 1,
    watermarkOnView INTEGER NOT NULL DEFAULT 1,
    watermarkOnPrint INTEGER NOT NULL DEFAULT 1,
    watermarkOnDownload INTEGER NOT NULL DEFAULT 1,
    watermarkColor TEXT NOT NULL DEFAULT 'gray',
    watermarkOpacity INTEGER NOT NULL DEFAULT 45,
    watermarkPosition TEXT NOT NULL DEFAULT 'diagonal',
    watermarkFieldsJson TEXT NOT NULL DEFAULT '["projectName","email","fullName","dateTime"]',
    watermarkCustomText TEXT NOT NULL DEFAULT '',
    driveRootFolderId TEXT NOT NULL DEFAULT '',
    driveRootFolderName TEXT NOT NULL DEFAULT 'Kleen_2025 (Google Drive Mirror)',
    driveAuthMode TEXT NOT NULL DEFAULT 'demo',
    driveServiceAccountJson TEXT NOT NULL DEFAULT '',
    driveOAuthTokensJson TEXT NOT NULL DEFAULT '',
    driveApiKey TEXT NOT NULL DEFAULT '',
    lastSyncedAt TEXT,
    lastSyncStatus TEXT NOT NULL DEFAULT 'synced',
    lastSyncError TEXT,
    autoSyncIntervalMin INTEGER NOT NULL DEFAULT 5,
    exclusionPatterns TEXT NOT NULL DEFAULT '.DS_Store,Thumbs.db,~$',
    adminEmail TEXT NOT NULL DEFAULT 'ahmed.badran@kleen.sa',
    adminPhone TEXT NOT NULL DEFAULT '+966530262716',
    isFavorite INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS project_status_history (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    actorName TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS project_integrations (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    UNIQUE(projectId, key)
  );

  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'User',
    isDefaultAdmin INTEGER NOT NULL DEFAULT 0,
    accessEnabled INTEGER NOT NULL DEFAULT 1,
    accessStart TEXT,
    accessEnd TEXT,
    require2fa INTEGER NOT NULL DEFAULT 0,
    allowedIps TEXT NOT NULL DEFAULT '',
    featurePermissionsJson TEXT NOT NULL DEFAULT '{}',
    aiIntegrationsJson TEXT NOT NULL DEFAULT '{}',
    docNotifications INTEGER NOT NULL DEFAULT 1,
    docUpdateFrequency TEXT NOT NULL DEFAULT 'Daily in the morning',
    isDeleted INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    company TEXT NOT NULL DEFAULT 'Kleen',
    jobTitle TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'en',
    timezone TEXT NOT NULL DEFAULT 'Asia/Riyadh',
    autoTimezone INTEGER NOT NULL DEFAULT 1,
    twoFactorEnabled INTEGER NOT NULL DEFAULT 0,
    passwordChangedAt TEXT NOT NULL,
    notifyDocChanges INTEGER NOT NULL DEFAULT 0,
    notifyStorageLimit INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS project_participants (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    groupId TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'Invited',
    accessEnabled INTEGER NOT NULL DEFAULT 1,
    accessStart TEXT,
    accessEnd TEXT,
    require2fa INTEGER NOT NULL DEFAULT 0,
    allowedIps TEXT NOT NULL DEFAULT '',
    docNotifications INTEGER NOT NULL DEFAULT 1,
    docUpdateFrequency TEXT NOT NULL DEFAULT 'Daily in the morning',
    invitationLanguage TEXT NOT NULL DEFAULT 'English (United States)',
    lastSignInAt TEXT,
    addedBy TEXT NOT NULL DEFAULT 'Ahmed Badran',
    inviteToken TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    UNIQUE(projectId, userId)
  );

  CREATE TABLE IF NOT EXISTS drive_nodes (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    driveFileId TEXT NOT NULL,
    parentDriveId TEXT,
    name TEXT NOT NULL,
    isFolder INTEGER NOT NULL DEFAULT 0,
    mimeType TEXT NOT NULL DEFAULT 'application/pdf',
    extension TEXT NOT NULL DEFAULT 'pdf',
    category TEXT NOT NULL DEFAULT 'Documents',
    sizeBytes BIGINT NOT NULL DEFAULT 0,
    pageCount INTEGER NOT NULL DEFAULT 0,
    dotIndex TEXT NOT NULL DEFAULT '1',
    sortOrder INTEGER NOT NULL DEFAULT 0,
    driveWebViewLink TEXT,
    driveModifiedAt TEXT NOT NULL,
    driveCreatedAt TEXT NOT NULL,
    isPublished INTEGER NOT NULL DEFAULT 1,
    isTrashed INTEGER NOT NULL DEFAULT 0,
    trashedAt TEXT,
    isRedacted INTEGER NOT NULL DEFAULT 0,
    redactionStatus TEXT NOT NULL DEFAULT 'none',
    demoContentText TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    UNIQUE(projectId, driveFileId)
  );

  CREATE TABLE IF NOT EXISTS document_permissions (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    groupId TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    nodeId TEXT NOT NULL REFERENCES drive_nodes(id) ON DELETE CASCADE,
    level TEXT NOT NULL DEFAULT 'view',
    updatedBy TEXT NOT NULL DEFAULT 'Ahmed Badran',
    updatedAt TEXT NOT NULL,
    UNIQUE(projectId, groupId, nodeId)
  );

  CREATE TABLE IF NOT EXISTS document_notes (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    nodeId TEXT NOT NULL REFERENCES drive_nodes(id) ON DELETE CASCADE,
    authorId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    noteType TEXT NOT NULL DEFAULT 'Private',
    repliesJson TEXT NOT NULL DEFAULT '[]',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS document_favorites (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nodeId TEXT NOT NULL REFERENCES drive_nodes(id) ON DELETE CASCADE,
    createdAt TEXT NOT NULL,
    UNIQUE(projectId, userId, nodeId)
  );

  CREATE TABLE IF NOT EXISTS label_definitions (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    groupName TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Single',
    valuesJson TEXT NOT NULL DEFAULT '[]',
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS document_labels (
    id TEXT PRIMARY KEY,
    nodeId TEXT NOT NULL REFERENCES drive_nodes(id) ON DELETE CASCADE,
    labelId TEXT NOT NULL REFERENCES label_definitions(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    UNIQUE(nodeId, labelId, value)
  );

  CREATE TABLE IF NOT EXISTS external_links (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    nodeId TEXT NOT NULL REFERENCES drive_nodes(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    accessType TEXT NOT NULL DEFAULT 'Anyone with link',
    requirePasscode INTEGER NOT NULL DEFAULT 0,
    passcode TEXT NOT NULL DEFAULT '',
    notifyOnVisit INTEGER NOT NULL DEFAULT 1,
    visitsCount INTEGER NOT NULL DEFAULT 0,
    feedbackCount INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    expiresAt TEXT,
    createdBy TEXT NOT NULL DEFAULT 'Ahmed Badran',
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS signature_requests (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    nodeId TEXT NOT NULL REFERENCES drive_nodes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    signersJson TEXT NOT NULL DEFAULT '[]',
    createdBy TEXT NOT NULL DEFAULT 'Ahmed Badran',
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS terms_of_access (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'NDA',
    displayMode TEXT NOT NULL DEFAULT 'On first sign-in',
    assignedGroupIds TEXT NOT NULL DEFAULT '[]',
    content TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS terms_acceptances (
    id TEXT PRIMARY KEY,
    termsId TEXT NOT NULL REFERENCES terms_of_access(id) ON DELETE CASCADE,
    userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    acceptedContent TEXT,
    groupName TEXT,
    publishedAt TEXT,
    acceptedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS qna_questions (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    answer TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Submitted',
    priority TEXT NOT NULL DEFAULT 'Medium',
    category TEXT NOT NULL DEFAULT 'Finance',
    authorId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assignedTo TEXT NOT NULL DEFAULT 'Administrators',
    nodeId TEXT REFERENCES drive_nodes(id) ON DELETE SET NULL,
    isFaq INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS checklist_items (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Medium',
    status TEXT NOT NULL DEFAULT 'Pending',
    assignedGroupId TEXT REFERENCES groups(id) ON DELETE SET NULL,
    linkedNodeId TEXT REFERENCES drive_nodes(id) ON DELETE SET NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    userId TEXT REFERENCES users(id) ON DELETE SET NULL,
    groupId TEXT,
    nodeId TEXT REFERENCES drive_nodes(id) ON DELETE SET NULL,
    actorName TEXT NOT NULL,
    actorEmail TEXT NOT NULL,
    groupName TEXT NOT NULL DEFAULT 'Administrators',
    category TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    metadataJson TEXT NOT NULL DEFAULT '{}',
    durationSeconds INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS report_subscriptions (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    reportType TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'PDF',
    frequency TEXT NOT NULL DEFAULT 'Weekly',
    startAt TEXT NOT NULL,
    filtersJson TEXT NOT NULL DEFAULT '{}',
    enabled INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS archive_orders (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Completed',
    configJson TEXT NOT NULL DEFAULT '{}',
    createdAt TEXT NOT NULL
  );
`;

const globalForDb = globalThis as unknown as {
  kleenAppDb: AppDb | undefined;
  kleenInitPromise: Promise<AppDb> | undefined;
};

async function resolvePostgresUrl(): Promise<string | null> {
  if (process.env.NETLIFY_DB_URL) return process.env.NETLIFY_DB_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const { getConnectionString } = await import("@netlify/database");
    const url = getConnectionString();
    if (url) return url;
  } catch {
    // Not in Netlify Database environment
  }
  return null;
}

async function initAppDb(): Promise<AppDb> {
  const pgUrl = await resolvePostgresUrl();

  if (pgUrl) {
    const pool = new Pool({
      connectionString: pgUrl,
      ssl: pgUrl.includes("localhost") || pgUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
    });
    const db = wrapPgRunner(pool, pool);
    await db.exec(SCHEMA_STATEMENTS);
    await db.exec(`
      ALTER TABLE project_participants ADD COLUMN IF NOT EXISTS inviteToken TEXT;
      ALTER TABLE terms_acceptances ADD COLUMN IF NOT EXISTS acceptedContent TEXT;
      ALTER TABLE terms_acceptances ADD COLUMN IF NOT EXISTS groupName TEXT;
      ALTER TABLE terms_acceptances ADD COLUMN IF NOT EXISTS publishedAt TEXT;
    `);
    await seedIfEmpty(db);
    return db;
  }

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, "kleen.db");
  const sqlite = require("node:sqlite") as { DatabaseSync: new (p: string) => DatabaseSyncType };
  const sqliteDb = new sqlite.DatabaseSync(dbPath);
  sqliteDb.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  sqliteDb.exec(SCHEMA_STATEMENTS);

  const cols = sqliteDb.prepare("PRAGMA table_info(project_participants)").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "inviteToken")) {
    sqliteDb.exec("ALTER TABLE project_participants ADD COLUMN inviteToken TEXT;");
  }
  const accCols = sqliteDb.prepare("PRAGMA table_info(terms_acceptances)").all() as Array<{ name: string }>;
  if (!accCols.some((c) => c.name === "acceptedContent")) {
    sqliteDb.exec("ALTER TABLE terms_acceptances ADD COLUMN acceptedContent TEXT;");
  }
  if (!accCols.some((c) => c.name === "groupName")) {
    sqliteDb.exec("ALTER TABLE terms_acceptances ADD COLUMN groupName TEXT;");
  }
  if (!accCols.some((c) => c.name === "publishedAt")) {
    sqliteDb.exec("ALTER TABLE terms_acceptances ADD COLUMN publishedAt TEXT;");
  }

  const db = wrapSqlite(sqliteDb);
  await seedIfEmpty(db);
  return db;
}

export async function getDb(): Promise<AppDb> {
  if (globalForDb.kleenAppDb) return globalForDb.kleenAppDb;
  if (!globalForDb.kleenInitPromise) {
    globalForDb.kleenInitPromise = initAppDb()
      .then((db) => {
        globalForDb.kleenAppDb = db;
        return db;
      })
      .catch((err) => {
        globalForDb.kleenInitPromise = undefined;
        throw err;
      });
  }
  return globalForDb.kleenInitPromise;
}
