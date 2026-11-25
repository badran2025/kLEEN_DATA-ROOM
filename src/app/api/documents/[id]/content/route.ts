import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getDb, nowIso, plain, uid } from "@/lib/db";
import { getNodeContentBuffer } from "@/lib/drive-sync";
import { canAccessNode, resolveEffectivePermission } from "@/lib/permissions";

async function resolvePermissionForNode(projectId: string, groupId: string, groupRole: string, nodeId: string) {
  const db = getDb();
  const rawNodes = db
    .prepare("SELECT id, driveFileId, parentDriveId FROM drive_nodes WHERE projectId = ? AND isTrashed = 0")
    .all(projectId) as Array<{ id: string; driveFileId: string; parentDriveId: string | null }>;
  const permRows = db
    .prepare("SELECT nodeId, level FROM document_permissions WHERE projectId = ? AND groupId = ?")
    .all(projectId, groupId) as Array<{ nodeId: string; level: string }>;

  const nodeMap = new Map(rawNodes.map((n) => [n.id, n]));
  const driveIdToNodeId = new Map(rawNodes.map((n) => [n.driveFileId, n.id]));
  const permMap = new Map(permRows.map((p) => [p.nodeId, p.level]));
  return resolveEffectivePermission(nodeId, groupRole, nodeMap, driveIdToNodeId, permMap);
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const db = getDb();
  const nodeRow = db
    .prepare("SELECT * FROM drive_nodes WHERE id = ? AND projectId = ? AND isTrashed = 0")
    .get(id, session.project.id) as Record<string, unknown> | undefined;
  if (!nodeRow) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const node = plain(nodeRow);
  const eff = await resolvePermissionForNode(
    session.project.id,
    session.effectiveGroup.id,
    session.effectiveGroup.role,
    id
  );
  if (!canAccessNode(eff)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { buffer, contentType, filename } = await getNodeContentBuffer(
    session.project,
    {
      driveFileId: String(node.driveFileId),
      name: String(node.name),
      mimeType: String(node.mimeType),
      dotIndex: String(node.dotIndex),
      category: String(node.category),
      sizeBytes: Number(node.sizeBytes || 0),
      pageCount: Number(node.pageCount || 4),
      demoContentText: node.demoContentText ? String(node.demoContentText) : null,
    },
    true
  );

  // Log view event
  const logId = uid("log");
  const now = nowIso();
  db.prepare(
    "INSERT INTO activity_logs (id, projectId, userId, groupId, nodeId, actorName, actorEmail, groupName, category, action, description, durationSeconds, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    logId,
    session.project.id,
    session.user.id,
    session.effectiveGroup.id,
    id,
    `${session.user.firstName} ${session.user.lastName}`.trim(),
    session.user.email,
    session.effectiveGroup.name,
    "Documents",
    "Document viewed",
    `${node.dotIndex} ${node.name}`,
    15,
    now
  );

  db.prepare("UPDATE project_participants SET status = 'Engaged', updatedAt = ? WHERE projectId = ? AND userId = ?").run(
    now,
    session.project.id,
    session.user.id
  );

  const responseBytes = new Uint8Array(buffer);
  return new NextResponse(responseBytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "X-Kleen-Log-Id": logId,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const logId = body.logId ? String(body.logId) : null;
  const addSeconds = Math.max(1, Math.min(60, Number(body.seconds || 10)));

  const db = getDb();
  if (logId) {
    db.prepare("UPDATE activity_logs SET durationSeconds = durationSeconds + ? WHERE id = ? AND projectId = ? AND nodeId = ?").run(
      addSeconds,
      logId,
      session.project.id,
      id
    );
  }
  return NextResponse.json({ ok: true });
}
