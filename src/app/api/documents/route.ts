import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getDb, nowIso, plain, uid } from "@/lib/db";
import { ensureAutoSyncDaemon, isProjectSyncing, syncProjectWithGoogleDrive } from "@/lib/drive-sync";
import { compareDotIndex } from "@/lib/format";
import { canAccessNode, resolveEffectivePermission } from "@/lib/permissions";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  ensureAutoSyncDaemon();
  const db = getDb();

  if (session.project.driveAuthMode !== "demo" && session.project.driveRootFolderId) {
    const realCount = db
      .prepare(
        "SELECT COUNT(*) as c FROM drive_nodes WHERE projectId = ? AND isTrashed = 0 AND driveFileId NOT LIKE 'demo-%'"
      )
      .get(session.project.id) as { c: number };
    const lastMs = session.project.lastSyncedAt ? new Date(session.project.lastSyncedAt).getTime() : 0;
    const staleMs = Date.now() - lastMs;

    if (realCount.c === 0 || session.project.lastSyncStatus === "error") {
      await syncProjectWithGoogleDrive(session.project.id).catch(() => null);
    } else if (staleMs > 60_000 && !isProjectSyncing(session.project.id)) {
      void syncProjectWithGoogleDrive(session.project.id).catch(() => null);
    }
  }

  const rawNodes = db
    .prepare("SELECT * FROM drive_nodes WHERE projectId = ? AND isTrashed = 0")
    .all(session.project.id) as Array<Record<string, unknown>>;

  const availableLabels = (
    db
      .prepare("SELECT id, groupName, valuesJson FROM label_definitions WHERE projectId = ? ORDER BY createdAt ASC")
      .all(session.project.id) as Array<Record<string, unknown>>
  ).map((l) => ({
    id: String(l.id),
    groupName: String(l.groupName),
    values: JSON.parse(String(l.valuesJson || "[]")) as string[],
  }));

  const trashedNodes = db
    .prepare("SELECT * FROM drive_nodes WHERE projectId = ? AND isTrashed = 1 ORDER BY trashedAt DESC")
    .all(session.project.id) as Array<Record<string, unknown>>;

  const permRows = db
    .prepare("SELECT nodeId, level FROM document_permissions WHERE projectId = ? AND groupId = ?")
    .all(session.project.id, session.effectiveGroup.id) as Array<{ nodeId: string; level: string }>;
  const permMap = new Map(permRows.map((p) => [p.nodeId, p.level]));

  const noteRows = db
    .prepare("SELECT nodeId, noteType, authorId FROM document_notes WHERE projectId = ?")
    .all(session.project.id) as Array<{ nodeId: string; noteType: string; authorId: string }>;

  const favRows = db
    .prepare("SELECT nodeId FROM document_favorites WHERE projectId = ? AND userId = ?")
    .all(session.project.id, session.user.id) as Array<{ nodeId: string }>;
  const favSet = new Set(favRows.map((f) => f.nodeId));

  const viewLogs = db
    .prepare(
      "SELECT nodeId, MAX(createdAt) as lastViewedAt FROM activity_logs WHERE projectId = ? AND userId = ? AND nodeId IS NOT NULL GROUP BY nodeId"
    )
    .all(session.project.id, session.user.id) as Array<{ nodeId: string; lastViewedAt: string }>;
  const viewMap = new Map(viewLogs.map((v) => [v.nodeId, v.lastViewedAt]));

  const labelRows = db
    .prepare(
      `SELECT dl.nodeId, ld.id as labelId, ld.groupName, dl.value
       FROM document_labels dl
       JOIN label_definitions ld ON ld.id = dl.labelId
       WHERE ld.projectId = ?`
    )
    .all(session.project.id) as Array<{ nodeId: string; labelId: string; groupName: string; value: string }>;

  const labelsByNode = new Map<string, Array<{ id: string; groupName: string; value: string }>>();
  for (const lr of labelRows) {
    const arr = labelsByNode.get(lr.nodeId) ?? [];
    arr.push({ id: lr.labelId, groupName: lr.groupName, value: lr.value });
    labelsByNode.set(lr.nodeId, arr);
  }

  const nodeLookup = new Map<string, { id: string; driveFileId: string; parentDriveId: string | null }>();
  const driveIdToNodeId = new Map<string, string>();
  for (const r of rawNodes) {
    const id = String(r.id);
    const driveFileId = String(r.driveFileId);
    const parentDriveId = r.parentDriveId ? String(r.parentDriveId) : null;
    nodeLookup.set(id, { id, driveFileId, parentDriveId });
    driveIdToNodeId.set(driveFileId, id);
  }

  // Compute subfolder, file, and totalBytes aggregates per folder
  const childrenByParent = new Map<string, Array<Record<string, unknown>>>();
  for (const r of rawNodes) {
    const key = r.parentDriveId ? String(r.parentDriveId) : "__ROOT__";
    const list = childrenByParent.get(key) ?? [];
    list.push(r);
    childrenByParent.set(key, list);
  }

  function calcStats(driveId: string): { subfolders: number; files: number; bytes: number } {
    const children = childrenByParent.get(driveId) ?? [];
    let subfolders = 0;
    let files = 0;
    let bytes = 0;
    for (const c of children) {
      if (c.isFolder === 1) {
        subfolders++;
        const sub = calcStats(String(c.driveFileId));
        files += sub.files;
        bytes += sub.bytes;
      } else {
        files++;
        bytes += Number(c.sizeBytes || 0);
      }
    }
    return { subfolders, files, bytes };
  }

  const visibleNodes: Array<Record<string, unknown>> = [];
  for (const r of rawNodes) {
    const node = plain(r);
    const id = String(node.id);
    const isPublished = node.isPublished === 1;
    if (session.project.publishing && !isPublished && !session.isAdmin) continue;

    const eff = resolveEffectivePermission(id, session.effectiveGroup.role, nodeLookup, driveIdToNodeId, permMap);
    if (!canAccessNode(eff)) continue;

    const notesCount = noteRows.filter(
      (n) => n.nodeId === id && (n.noteType === "Shared" || n.authorId === session.user.id || session.isAdmin)
    ).length;

    const stats = node.isFolder === 1 ? calcStats(String(node.driveFileId)) : { subfolders: 0, files: 0, bytes: Number(node.sizeBytes || 0) };

    visibleNodes.push({
      ...node,
      isFolder: node.isFolder === 1,
      isPublished,
      isTrashed: node.isTrashed === 1,
      isRedacted: node.isRedacted === 1,
      effectivePermission: eff,
      notesCount: session.isViewingAs && !session.isAdmin ? 0 : notesCount,
      isFavorite: favSet.has(id),
      viewedByMe: viewMap.has(id),
      lastViewedAt: viewMap.get(id) ?? null,
      subfolderCount: stats.subfolders,
      fileCount: stats.files,
      totalBytes: stats.bytes,
      labels: labelsByNode.get(id) ?? [],
    });
  }

  visibleNodes.sort((a, b) => compareDotIndex(String(a.dotIndex), String(b.dotIndex)));

  const latestProj = db
    .prepare("SELECT lastSyncedAt, lastSyncStatus, lastSyncError FROM projects WHERE id = ?")
    .get(session.project.id) as { lastSyncedAt: string | null; lastSyncStatus: string; lastSyncError: string | null } | undefined;

  return NextResponse.json({
    nodes: visibleNodes,
    availableLabels,
    syncInfo: {
      lastSyncedAt: latestProj?.lastSyncedAt || session.project.lastSyncedAt,
      lastSyncStatus: latestProj?.lastSyncStatus || session.project.lastSyncStatus,
      lastSyncError: latestProj?.lastSyncError || null,
      syncingNow: isProjectSyncing(session.project.id),
    },
    trashedNodes: session.isAdmin
      ? trashedNodes.map((t) => ({ ...plain(t), isFolder: t.isFolder === 1 }))
      : [],
  });
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const db = getDb();
  const now = nowIso();

  if (body.action === "set-label" && body.nodeId && body.labelId && body.value) {
    if (!session.isAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });
    const existing = db
      .prepare("SELECT id, value FROM document_labels WHERE nodeId = ? AND labelId = ?")
      .get(String(body.nodeId), String(body.labelId)) as { id: string; value: string } | undefined;

    if (existing && existing.value === String(body.value)) {
      db.prepare("DELETE FROM document_labels WHERE id = ?").run(existing.id);
      return NextResponse.json({ ok: true, removed: true });
    }
    if (existing) {
      db.prepare("UPDATE document_labels SET value = ? WHERE id = ?").run(String(body.value), existing.id);
    } else {
      db.prepare("INSERT INTO document_labels (id, nodeId, labelId, value, createdAt) VALUES (?, ?, ?, ?, ?)").run(
        uid("dlb"),
        String(body.nodeId),
        String(body.labelId),
        String(body.value),
        now
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "toggle-publish" && body.nodeId) {
    if (!session.isTrueAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });
    const row = db
      .prepare("SELECT id, isPublished, name FROM drive_nodes WHERE id = ? AND projectId = ?")
      .get(String(body.nodeId), session.project.id) as { id: string; isPublished: number; name: string } | undefined;
    if (!row) return NextResponse.json({ error: "Node not found" }, { status: 404 });
    const nextPub = row.isPublished === 1 ? 0 : 1;
    db.prepare("UPDATE drive_nodes SET isPublished = ?, updatedAt = ? WHERE id = ?").run(nextPub, now, row.id);
    return NextResponse.json({ ok: true, isPublished: nextPub === 1 });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
