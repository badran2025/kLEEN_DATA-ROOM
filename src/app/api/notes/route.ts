import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getDb, nowIso, plain, uid } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const nodeId = req.nextUrl.searchParams.get("nodeId");
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT n.*, u.firstName, u.lastName, u.email, d.name as nodeName, d.dotIndex as nodeIndex, d.parentDriveId
       FROM document_notes n
       JOIN users u ON u.id = n.authorId
       JOIN drive_nodes d ON d.id = n.nodeId
       WHERE n.projectId = ? ${nodeId ? "AND n.nodeId = ?" : ""}
       ORDER BY n.createdAt DESC`
    )
    .all(...(nodeId ? [session.project.id, nodeId] : [session.project.id])) as Array<Record<string, unknown>>;

  const visible = rows
    .map((r) => plain(r))
    .filter((n) => n.noteType === "Shared" || n.authorId === session.user.id || session.isAdmin);

  return NextResponse.json({ notes: visible });
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const nodeId = String(body.nodeId || "");
  const content = String(body.content || "").trim();
  const noteType = body.noteType === "Shared" ? "Shared" : "Private";
  if (!nodeId || !content) return NextResponse.json({ error: "Node and content required" }, { status: 400 });

  const db = getDb();
  const now = nowIso();
  const noteId = uid("not");

  db.prepare(
    "INSERT INTO document_notes (id, projectId, nodeId, authorId, content, noteType, repliesJson, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, '[]', ?, ?)"
  ).run(noteId, session.project.id, nodeId, session.user.id, content, noteType, now, now);

  db.prepare(
    "INSERT INTO activity_logs (id, projectId, userId, groupId, nodeId, actorName, actorEmail, groupName, category, action, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    uid("log"),
    session.project.id,
    session.user.id,
    session.effectiveGroup.id,
    nodeId,
    `${session.user.firstName} ${session.user.lastName}`.trim(),
    session.user.email,
    session.effectiveGroup.name,
    "Documents",
    "Note added",
    `${noteType} note: ${content.slice(0, 80)}`,
    now
  );

  return NextResponse.json({ ok: true, id: noteId });
}

export async function DELETE(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Note ID required" }, { status: 400 });

  const db = getDb();
  db.prepare("DELETE FROM document_notes WHERE id = ? AND projectId = ? AND (authorId = ? OR ? = 1)").run(
    id,
    session.project.id,
    session.user.id,
    session.isAdmin ? 1 : 0
  );
  return NextResponse.json({ ok: true });
}
