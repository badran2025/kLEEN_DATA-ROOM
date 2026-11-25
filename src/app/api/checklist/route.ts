import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getDb, nowIso, plain, uid } from "@/lib/db";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const items = db
    .prepare(
      `SELECT c.*, g.name as groupName, d.name as nodeName, d.dotIndex as nodeIndex
       FROM checklist_items c
       LEFT JOIN groups g ON g.id = c.assignedGroupId
       LEFT JOIN drive_nodes d ON d.id = c.linkedNodeId
       WHERE c.projectId = ?
       ORDER BY c.code ASC`
    )
    .all(session.project.id) as Array<Record<string, unknown>>;

  return NextResponse.json({ items: items.map((i) => plain(i)) });
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isTrueAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const body = await req.json();
  const db = getDb();
  const now = nowIso();

  if (Array.isArray(body.bulkItems)) {
    const countRow = db.prepare("SELECT COUNT(*) as c FROM checklist_items WHERE projectId = ?").get(session.project.id) as { c: number };
    let idx = (countRow?.c || 0) + 1;
    const ins = db.prepare(
      "INSERT INTO checklist_items (id, projectId, code, category, title, priority, status, assignedGroupId, linkedNodeId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const item of body.bulkItems) {
      if (!item.title) continue;
      ins.run(
        uid("chk"),
        session.project.id,
        item.code || `DD-${String(idx).padStart(2, "0")}`,
        String(item.category || "General"),
        String(item.title),
        String(item.priority || "Medium"),
        String(item.status || "Pending"),
        item.assignedGroupId || null,
        item.linkedNodeId || null,
        now,
        now
      );
      idx++;
    }
    return NextResponse.json({ ok: true });
  }

  const countRow = db.prepare("SELECT COUNT(*) as c FROM checklist_items WHERE projectId = ?").get(session.project.id) as { c: number };
  const code = `DD-${String((countRow?.c || 0) + 1).padStart(2, "0")}`;
  const id = uid("chk");
  db.prepare(
    "INSERT INTO checklist_items (id, projectId, code, category, title, priority, status, assignedGroupId, linkedNodeId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    session.project.id,
    code,
    String(body.category || "General"),
    String(body.title || "Untitled item"),
    String(body.priority || "Medium"),
    String(body.status || "Pending"),
    body.assignedGroupId || null,
    body.linkedNodeId || null,
    now,
    now
  );

  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const db = getDb();
  db.prepare(
    "UPDATE checklist_items SET status = COALESCE(?, status), linkedNodeId = ?, updatedAt = ? WHERE id = ? AND projectId = ?"
  ).run(body.status ?? null, body.linkedNodeId ?? null, nowIso(), String(body.id), session.project.id);

  return NextResponse.json({ ok: true });
}
