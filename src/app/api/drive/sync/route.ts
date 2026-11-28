import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import {
  ensureAutoSyncDaemon,
  extractDriveFolderId,
  isProjectSyncing,
  rebuildProjectIndices,
  syncProjectWithGoogleDrive,
} from "@/lib/drive-sync";
import { getDb, nowIso, uid } from "@/lib/db";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  ensureAutoSyncDaemon();

  return NextResponse.json({
    driveAuthMode: session.project.driveAuthMode,
    driveRootFolderId: session.project.driveRootFolderId,
    driveRootFolderName: session.project.driveRootFolderName,
    lastSyncedAt: session.project.lastSyncedAt,
    lastSyncStatus: session.project.lastSyncStatus,
    lastSyncError: session.project.lastSyncError,
    autoSyncIntervalMin: session.project.autoSyncIntervalMin,
    syncingNow: isProjectSyncing(session.project.id),
  });
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isTrueAdmin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));
    const db = getDb();

    if (body.action === "rebuild-index") {
      const count = rebuildProjectIndices(session.project.id, Boolean(body.preserveLeading ?? true));
      db.prepare(
        "INSERT INTO activity_logs (id, projectId, userId, actorName, actorEmail, groupName, category, action, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        uid("log"),
        session.project.id,
        session.user.id,
        `${session.user.firstName} ${session.user.lastName}`,
        session.user.email,
        session.actualGroup.name,
        "Documents",
        "Project index rebuilt",
        `Rebuilt hierarchical dot-index across ${count} items`,
        nowIso()
      );
      return NextResponse.json({ ok: true, count });
    }

    if (body.action === "configure-drive") {
      const folderId = extractDriveFolderId(String(body.driveRootFolderId || ""));
      const authMode = String(body.driveAuthMode || session.project.driveAuthMode);
      const updates: string[] = [
        "driveRootFolderId = ?",
        "driveAuthMode = ?",
        "autoSyncIntervalMin = ?",
        "exclusionPatterns = ?",
        "updatedAt = ?",
      ];
      const params: Array<string | number> = [
        folderId,
        authMode,
        Number(body.autoSyncIntervalMin || 5),
        String(body.exclusionPatterns || ".DS_Store,Thumbs.db,~$"),
        nowIso(),
      ];

      if (typeof body.driveServiceAccountJson === "string" && body.driveServiceAccountJson.trim() && body.driveServiceAccountJson !== "***CONFIGURED***") {
        updates.push("driveServiceAccountJson = ?");
        params.push(body.driveServiceAccountJson.trim());
      }
      if (typeof body.driveApiKey === "string" && body.driveApiKey.trim() && body.driveApiKey !== "***CONFIGURED***") {
        updates.push("driveApiKey = ?");
        params.push(body.driveApiKey.trim());
      }

      params.push(session.project.id);
      db.prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`).run(...params);

      if (body.syncImmediately !== false) {
        const result = await syncProjectWithGoogleDrive(session.project.id, {
          id: session.user.id,
          name: `${session.user.firstName} ${session.user.lastName}`,
          email: session.user.email,
        });
        return NextResponse.json({ ok: true, ...result });
      }
      return NextResponse.json({ ok: true });
    }

    const result = await syncProjectWithGoogleDrive(session.project.id, {
      id: session.user.id,
      name: `${session.user.firstName} ${session.user.lastName}`,
      email: session.user.email,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
