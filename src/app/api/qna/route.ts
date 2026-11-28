import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getDb, nowIso, plain, uid } from "@/lib/db";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const rows = (await db
    .prepare(
      `SELECT q.*, u.firstName, u.lastName, u.email, d.name as nodeName, d.dotIndex as nodeIndex
       FROM qna_questions q
       JOIN users u ON u.id = q.authorId
       LEFT JOIN drive_nodes d ON d.id = q.nodeId
       WHERE q.projectId = ?
       ORDER BY q.createdAt DESC`
    )
    .all(session.project.id)) as Array<Record<string, unknown>>;

  return NextResponse.json({
    questions: rows.map((r) => ({ ...plain(r), isFaq: r.isFaq === 1 })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const subject = String(body.subject || "").trim();
  const questionBody = String(body.body || "").trim();
  if (!subject) return NextResponse.json({ error: "Subject is required" }, { status: 400 });

  const db = await getDb();
  const countRow = (await db.prepare("SELECT COUNT(*) as c FROM qna_questions WHERE projectId = ?").get(session.project.id)) as { c: number };
  const code = `B${100 + Number(countRow?.c || 0)}`;
  const now = nowIso();
  const id = uid("qna");

  await db.prepare(
    `INSERT INTO qna_questions (id, projectId, code, subject, body, status, priority, category, authorId, assignedTo, nodeId, isFaq, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    id,
    session.project.id,
    code,
    subject,
    questionBody,
    body.status === "Draft" ? "Draft" : "Submitted",
    String(body.priority || "Medium"),
    String(body.category || "Finance"),
    session.user.id,
    String(body.assignedTo || "Administrators"),
    body.nodeId ? String(body.nodeId) : null,
    now,
    now
  );

  await db.prepare(
    "INSERT INTO activity_logs (id, projectId, userId, actorName, actorEmail, groupName, category, action, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    uid("log"),
    session.project.id,
    session.user.id,
    `${session.user.firstName} ${session.user.lastName}`,
    session.user.email,
    session.effectiveGroup.name,
    "Q&A",
    "Question submitted",
    `${code}: ${subject}`,
    now
  );

  return NextResponse.json({ ok: true, id, code });
}

export async function PATCH(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "Question ID required" }, { status: 400 });

  const db = await getDb();
  const now = nowIso();
  await db.prepare(
    `UPDATE qna_questions SET
      answer = COALESCE(?, answer),
      status = COALESCE(?, status),
      priority = COALESCE(?, priority),
      category = COALESCE(?, category),
      isFaq = COALESCE(?, isFaq),
      updatedAt = ?
    WHERE id = ? AND projectId = ?`
  ).run(
    body.answer ?? null,
    body.status ?? null,
    body.priority ?? null,
    body.category ?? null,
    body.isFaq === undefined ? null : body.isFaq ? 1 : 0,
    now,
    id,
    session.project.id
  );

  return NextResponse.json({ ok: true });
}
