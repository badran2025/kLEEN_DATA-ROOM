import { google, drive_v3 } from "googleapis";
import { getDb, nowIso, plain, uid } from "./db";
import { classifyFile, compareDotIndex } from "./format";
import { generateDemoPdfBuffer } from "./pdf-utils";
import { mapProject } from "./auth";

const GOOGLE_EXPORT_MAP: Record<string, { mimeType: string; ext: string }> = {
  "application/vnd.google-apps.document": { mimeType: "application/pdf", ext: "pdf" },
  "application/vnd.google-apps.spreadsheet": {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: "xlsx",
  },
  "application/vnd.google-apps.presentation": { mimeType: "application/pdf", ext: "pdf" },
  "application/vnd.google-apps.drawing": { mimeType: "application/pdf", ext: "pdf" },
};

export function extractDriveFolderId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const idParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParam) return idParam[1];
  return trimmed;
}

export async function createDriveClient(project: {
  driveAuthMode: string;
  driveServiceAccountJson: string;
  driveOAuthTokensJson: string;
  driveApiKey: string;
}): Promise<drive_v3.Drive | null> {
  const mode = project.driveAuthMode;

  if (mode === "service_account") {
    const raw = project.driveServiceAccountJson || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "";
    if (!raw) return null;
    const creds = JSON.parse(raw);
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    return google.drive({ version: "v3", auth });
  }

  if (mode === "oauth") {
    const rawTokens = project.driveOAuthTokensJson;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/drive/oauth/callback";
    if (!rawTokens || !clientId || !clientSecret) return null;
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2.setCredentials(JSON.parse(rawTokens));
    return google.drive({ version: "v3", auth: oauth2 });
  }

  if (mode === "api_key") {
    const key = project.driveApiKey || process.env.GOOGLE_API_KEY || "";
    if (!key) return null;
    return google.drive({ version: "v3", auth: key });
  }

  return null;
}

function isExcluded(name: string, patternsCsv: string): boolean {
  const patterns = patternsCsv
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return patterns.some((pat) => name === pat || name.startsWith(pat) || name.endsWith(pat));
}

function extractLeadingIndex(name: string): string | null {
  const match = name.trim().match(/^(\d+(?:\.\d+)*)(?:\.)?\s+/);
  if (!match) return null;
  const token = match[1];
  // Ignore bare 4-digit years like "2025 Audit.pdf"
  if (!token.includes(".") && Number(token) >= 1900 && Number(token) <= 2199) {
    return null;
  }
  return token;
}

export function rebuildProjectIndices(projectId: string, preserveLeading = true) {
  const db = getDb();
  const nodes = db
    .prepare("SELECT id, driveFileId, parentDriveId, name, isFolder FROM drive_nodes WHERE projectId = ? AND isTrashed = 0")
    .all(projectId) as Array<{ id: string; driveFileId: string; parentDriveId: string | null; name: string; isFolder: number }>;

  const validFolderIds = new Set(nodes.filter((n) => n.isFolder === 1).map((n) => n.driveFileId));
  const childrenByParent = new Map<string, typeof nodes>();
  for (const node of nodes) {
    const parentKey = node.parentDriveId && validFolderIds.has(node.parentDriveId) ? node.parentDriveId : "__ROOT__";
    const list = childrenByParent.get(parentKey) ?? [];
    list.push(node);
    childrenByParent.set(parentKey, list);
  }

  const updateStmt = db.prepare("UPDATE drive_nodes SET dotIndex = ?, sortOrder = ? WHERE id = ?");
  let count = 0;

  function assign(parentKey: string, prefix: string) {
    const list = childrenByParent.get(parentKey) ?? [];
    list.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      const ia = extractLeadingIndex(a.name);
      const ib = extractLeadingIndex(b.name);
      if (ia && ib) {
        const cmp = compareDotIndex(ia, ib);
        if (cmp !== 0) return cmp;
      }
      if (ia && !ib) return -1;
      if (!ia && ib) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });

    const usedIndices = new Set<string>();
    let seq = 1;
    list.forEach((node, idx) => {
      const parsed = preserveLeading ? extractLeadingIndex(node.name) : null;
      let dotIndex = parsed || "";
      if (!dotIndex || usedIndices.has(dotIndex)) {
        while (usedIndices.has(prefix ? `${prefix}.${seq}` : `${seq}`)) {
          seq++;
        }
        dotIndex = prefix ? `${prefix}.${seq}` : `${seq}`;
        seq++;
      }
      usedIndices.add(dotIndex);
      updateStmt.run(dotIndex, idx + 1, node.id);
      count++;
      if (node.isFolder) {
        assign(node.driveFileId, dotIndex);
      }
    });
  }

  db.exec("BEGIN");
  try {
    assign("__ROOT__", "");
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  return count;
}

const activeSyncMap = new Map<
  string,
  Promise<{ mode: string; syncedCount: number; trashedCount: number; project: ReturnType<typeof mapProject> }>
>();

export function isProjectSyncing(projectId: string): boolean {
  return activeSyncMap.has(projectId);
}

const g = globalThis as typeof globalThis & { __kleenAutoSyncTimer?: NodeJS.Timeout };

export function ensureAutoSyncDaemon() {
  if (g.__kleenAutoSyncTimer) return;
  g.__kleenAutoSyncTimer = setInterval(() => {
    void runDueAutoSyncs();
  }, 60_000);
}

export async function runDueAutoSyncs() {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, driveAuthMode, driveRootFolderId, lastSyncedAt, autoSyncIntervalMin
         FROM projects
         WHERE driveAuthMode != 'demo' AND driveRootFolderId IS NOT NULL AND driveRootFolderId != ''`
      )
      .all() as Array<{
      id: string;
      driveAuthMode: string;
      driveRootFolderId: string;
      lastSyncedAt: string | null;
      autoSyncIntervalMin: number | null;
    }>;

    const nowMs = Date.now();
    for (const r of rows) {
      if (activeSyncMap.has(r.id)) continue;
      const intervalMs = Math.max(1, Number(r.autoSyncIntervalMin || 1)) * 60_000;
      const lastMs = r.lastSyncedAt ? new Date(r.lastSyncedAt).getTime() : 0;
      if (!lastMs || nowMs - lastMs >= intervalMs) {
        await syncProjectWithGoogleDrive(r.id).catch(() => null);
      }
    }
  } catch {
    // Keep background daemon resilient
  }
}

export async function syncProjectWithGoogleDrive(
  projectId: string,
  actor?: { id?: string; name: string; email: string }
) {
  const existingPromise = activeSyncMap.get(projectId);
  if (existingPromise) return existingPromise;

  const task = runSyncProjectWithGoogleDrive(projectId, actor).finally(() => {
    activeSyncMap.delete(projectId);
  });
  activeSyncMap.set(projectId, task);
  return task;
}

async function runSyncProjectWithGoogleDrive(
  projectId: string,
  actor?: { id?: string; name: string; email: string }
) {
  const db = getDb();
  const projectRow = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as Record<string, unknown> | undefined;
  if (!projectRow) throw new Error("Project not found");
  const project = mapProject(plain(projectRow));

  const now = nowIso();

  if (project.driveAuthMode === "demo" || !project.driveRootFolderId) {
    const reindexed = rebuildProjectIndices(project.id, project.autoIndexing);
    db.prepare("UPDATE projects SET lastSyncedAt = ?, lastSyncStatus = 'synced', lastSyncError = NULL, updatedAt = ? WHERE id = ?").run(
      now,
      now,
      project.id
    );
    db.prepare(
      "INSERT INTO activity_logs (id, projectId, userId, actorName, actorEmail, groupName, category, action, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      uid("log"),
      project.id,
      actor?.id ?? null,
      actor?.name || "System Sync",
      actor?.email || project.adminEmail,
      "Administrators",
      "Drive sync",
      "Drive mirror refreshed",
      `Mode: Demo Mirror | Re-indexed ${reindexed} mirrored items`,
      now
    );
    const updatedRow = db.prepare("SELECT * FROM projects WHERE id = ?").get(project.id) as Record<string, unknown>;
    return { mode: "demo", syncedCount: reindexed, trashedCount: 0, project: mapProject(plain(updatedRow)) };
  }

  db.prepare("UPDATE projects SET lastSyncStatus = 'syncing', lastSyncError = NULL, updatedAt = ? WHERE id = ?").run(now, project.id);

  try {
    const drive = await createDriveClient(project);
    if (!drive) {
      throw new Error("Google Drive credentials are missing or invalid for the selected authentication mode.");
    }

    const rootFolderId = extractDriveFolderId(project.driveRootFolderId);
    const rootMeta = await drive.files.get({
      fileId: rootFolderId,
      fields: "id,name,mimeType",
      supportsAllDrives: true,
    });

    const rootName = rootMeta.data.name || project.driveRootFolderName || project.name;
    const discovered: Array<{
      driveFileId: string;
      parentDriveId: string | null;
      name: string;
      isFolder: boolean;
      mimeType: string;
      extension: string;
      category: string;
      sizeBytes: number;
      driveWebViewLink: string | null;
      driveModifiedAt: string;
      driveCreatedAt: string;
    }> = [];

    const folderQueue: string[] = [rootFolderId];
    const visitedFolders = new Set<string>([rootFolderId]);
    const discoveredDriveIds = new Set<string>();
    let inFlight = 0;

    async function listFolderWithRetry(folderId: string) {
      let pageToken: string | undefined;
      do {
        let attempt = 0;
        let resData: drive_v3.Schema$FileList | null = null;
        while (attempt < 3) {
          try {
            const res = await drive!.files.list({
              q: `'${folderId}' in parents and trashed = false`,
              fields:
                "nextPageToken, files(id,name,mimeType,size,webViewLink,createdTime,modifiedTime,parents,shortcutDetails)",
              pageSize: 1000,
              pageToken,
              supportsAllDrives: true,
              includeItemsFromAllDrives: true,
            });
            resData = res.data;
            break;
          } catch (e) {
            attempt++;
            if (attempt >= 3) throw e;
            await new Promise((r) => setTimeout(r, 350 * attempt));
          }
        }

        for (const f of resData?.files || []) {
          if (!f.id || !f.name) continue;
          if (isExcluded(f.name, project.exclusionPatterns)) continue;

          const isShortcut = f.mimeType === "application/vnd.google-apps.shortcut";
          const effectiveMime = isShortcut && f.shortcutDetails?.targetMimeType ? f.shortcutDetails.targetMimeType : f.mimeType || "";
          const effectiveId = isShortcut && f.shortcutDetails?.targetId ? f.shortcutDetails.targetId : f.id;
          const isFolder = effectiveMime === "application/vnd.google-apps.folder";

          if (discoveredDriveIds.has(effectiveId)) continue;
          discoveredDriveIds.add(effectiveId);

          const { extension, category } = classifyFile(f.name, effectiveMime, isFolder);

          discovered.push({
            driveFileId: effectiveId,
            parentDriveId: folderId === rootFolderId ? null : folderId,
            name: f.name,
            isFolder,
            mimeType: effectiveMime || "application/octet-stream",
            extension,
            category,
            sizeBytes: Number(f.size || 0),
            driveWebViewLink: f.webViewLink || null,
            driveModifiedAt: f.modifiedTime || now,
            driveCreatedAt: f.createdTime || now,
          });

          if (isFolder && !visitedFolders.has(effectiveId)) {
            visitedFolders.add(effectiveId);
            folderQueue.push(effectiveId);
          }
        }
        pageToken = resData?.nextPageToken || undefined;
      } while (pageToken);
    }

    await new Promise<void>((resolve, reject) => {
      let failed = false;
      const maxWorkers = 12;

      function pump() {
        if (failed) return;
        if (folderQueue.length === 0 && inFlight === 0) {
          resolve();
          return;
        }
        while (inFlight < maxWorkers && folderQueue.length > 0 && !failed) {
          const nextFolderId = folderQueue.shift()!;
          inFlight++;
          listFolderWithRetry(nextFolderId)
            .then(() => {
              inFlight--;
              pump();
            })
            .catch((err) => {
              failed = true;
              reject(err);
            });
        }
      }

      pump();
    });

    const discoveredIds = new Set(discovered.map((d) => d.driveFileId));
    const existingRows = db
      .prepare("SELECT id, driveFileId, isTrashed FROM drive_nodes WHERE projectId = ?")
      .all(project.id) as Array<{ id: string; driveFileId: string; isTrashed: number }>;
    const existingByDriveId = new Map(existingRows.map((r) => [r.driveFileId, r]));

    const insertNode = db.prepare(`
      INSERT INTO drive_nodes (
        id, projectId, driveFileId, parentDriveId, name, isFolder, mimeType, extension, category,
        sizeBytes, pageCount, dotIndex, sortOrder, driveWebViewLink, driveModifiedAt, driveCreatedAt,
        isPublished, isTrashed, trashedAt, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '1', 0, ?, ?, ?, ?, 0, NULL, ?, ?)
    `);
    const updateNode = db.prepare(`
      UPDATE drive_nodes SET
        parentDriveId = ?, name = ?, isFolder = ?, mimeType = ?, extension = ?, category = ?,
        sizeBytes = CASE WHEN ? > 0 THEN ? ELSE sizeBytes END,
        driveWebViewLink = ?, driveModifiedAt = ?, isTrashed = 0, trashedAt = NULL, updatedAt = ?
      WHERE id = ?
    `);

    db.exec("BEGIN");
    try {
      // Remove any leftover demo rows cleanly when mirroring a real Drive root
      db.prepare("DELETE FROM drive_nodes WHERE projectId = ? AND driveFileId LIKE 'demo-%'").run(project.id);

      for (const item of discovered) {
        const prev = existingByDriveId.get(item.driveFileId);
        if (prev) {
          updateNode.run(
            item.parentDriveId,
            item.name,
            item.isFolder ? 1 : 0,
            item.mimeType,
            item.extension,
            item.category,
            item.sizeBytes,
            item.sizeBytes,
            item.driveWebViewLink,
            item.driveModifiedAt,
            now,
            prev.id
          );
        } else {
          insertNode.run(
            uid("nod"),
            project.id,
            item.driveFileId,
            item.parentDriveId,
            item.name,
            item.isFolder ? 1 : 0,
            item.mimeType,
            item.extension,
            item.category,
            item.sizeBytes,
            item.isFolder ? 0 : item.category === "PDF" ? 4 : 1,
            item.driveWebViewLink,
            item.driveModifiedAt,
            item.driveCreatedAt,
            project.publishing ? 0 : 1,
            now,
            now
          );
        }
      }

      let trashedCount = 0;
      const trashStmt = db.prepare("UPDATE drive_nodes SET isTrashed = 1, trashedAt = ?, updatedAt = ? WHERE id = ?");
      for (const row of existingRows) {
        if (row.driveFileId.startsWith("demo-")) continue;
        if (!row.isTrashed && !discoveredIds.has(row.driveFileId)) {
          trashStmt.run(now, now, row.id);
          trashedCount++;
        }
      }
      db.exec("COMMIT");

      rebuildProjectIndices(project.id, project.autoIndexing);

      db.prepare(
        "UPDATE projects SET driveRootFolderId = ?, driveRootFolderName = ?, lastSyncedAt = ?, lastSyncStatus = 'synced', lastSyncError = NULL, updatedAt = ? WHERE id = ?"
      ).run(rootFolderId, rootName, now, now, project.id);

      db.prepare(
        "INSERT INTO activity_logs (id, projectId, userId, actorName, actorEmail, groupName, category, action, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        uid("log"),
        project.id,
        actor?.id ?? null,
        actor?.name || "System Sync",
        actor?.email || project.adminEmail,
        "Administrators",
        "Drive sync",
        "Google Drive synced",
        `Folder: ${rootName} | Synced: ${discovered.length} items | Removed: ${trashedCount}`,
        now
      );

      const updatedRow = db.prepare("SELECT * FROM projects WHERE id = ?").get(project.id) as Record<string, unknown>;
      return {
        mode: project.driveAuthMode,
        syncedCount: discovered.length,
        trashedCount,
        project: mapProject(plain(updatedRow)),
      };
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Google Drive sync error";
    db.prepare("UPDATE projects SET lastSyncStatus = 'error', lastSyncError = ?, updatedAt = ? WHERE id = ?").run(
      message,
      now,
      project.id
    );
    throw err;
  }
}

export async function getNodeContentBuffer(
  project: {
    driveAuthMode: string;
    driveServiceAccountJson: string;
    driveOAuthTokensJson: string;
    driveApiKey: string;
  },
  node: {
    driveFileId: string;
    name: string;
    mimeType: string;
    dotIndex: string;
    category: string;
    sizeBytes: number;
    pageCount: number;
    demoContentText: string | null;
  },
  preferPdf = true
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const isDemoNode = project.driveAuthMode === "demo" || node.driveFileId.startsWith("demo-");
  if (!isDemoNode) {
    const drive = await createDriveClient(project);
    if (drive) {
      const exportTarget = GOOGLE_EXPORT_MAP[node.mimeType];
      if (exportTarget) {
        const res = await drive.files.export(
          { fileId: node.driveFileId, mimeType: preferPdf ? "application/pdf" : exportTarget.mimeType },
          { responseType: "arraybuffer" }
        );
        const buf = Buffer.from(res.data as ArrayBuffer);
        return {
          buffer: buf,
          contentType: preferPdf ? "application/pdf" : exportTarget.mimeType,
          filename: preferPdf ? `${node.name}.pdf` : `${node.name}.${exportTarget.ext}`,
        };
      }

      const res = await drive.files.get(
        { fileId: node.driveFileId, alt: "media", supportsAllDrives: true },
        { responseType: "arraybuffer" }
      );
      return {
        buffer: Buffer.from(res.data as ArrayBuffer),
        contentType: node.mimeType || "application/octet-stream",
        filename: node.name,
      };
    }
  }

  const pdfBuf = await generateDemoPdfBuffer({
    title: node.name,
    dotIndex: node.dotIndex,
    category: node.category,
    sizeBytes: node.sizeBytes,
    pageCount: node.pageCount || 4,
    bodyText: node.demoContentText,
  });

  return {
    buffer: pdfBuf,
    contentType: "application/pdf",
    filename: node.name.toLowerCase().endsWith(".pdf") ? node.name : `${node.name}.pdf`,
  };
}
