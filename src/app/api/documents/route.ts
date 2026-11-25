import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getDb, plain } from "@/lib/db";
import { compareDotIndex } from "@/lib/format";
import { canAccessNode, resolveEffectivePermission } from "@/lib/permissions";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const rawNodes = db
    .prepare("SELECT * FROM drive_nodes WHERE projectId = ? AND isTrashed = 0")
    .all(session.project.id) as Array<Record<string, unknown>>;

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

  return NextResponse.json({
    nodes: visibleNodes,
    trashedNodes: session.isAdmin
      ? trashedNodes.map((t) => ({ ...plain(t), isFolder: t.isFolder === 1 }))
      : [],
  });
}
