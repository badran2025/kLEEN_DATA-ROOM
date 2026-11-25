import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getDb, nowIso, uid } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const nodeIds: string[] = Array.isArray(body.nodeIds) ? body.nodeIds : body.nodeId ? [String(body.nodeId)] : [];

  const db = getDb();
  const now = nowIso();
  for (const nodeId of nodeIds) {
    const existing = db
      .prepare("SELECT id FROM document_favorites WHERE projectId = ? AND userId = ? AND nodeId = ?")
      .get(session.project.id, session.user.id, nodeId) as { id: string } | undefined;
    if (existing) {
      db.prepare("DELETE FROM document_favorites WHERE id = ?").run(existing.id);
    } else {
      db.prepare("INSERT INTO document_favorites (id, projectId, userId, nodeId, createdAt) VALUES (?, ?, ?, ?, ?)").run(
        uid("fav"),
        session.project.id,
        session.user.id,
        nodeId,
        now
      );
    }
  }
  return NextResponse.json({ ok: true });
}
