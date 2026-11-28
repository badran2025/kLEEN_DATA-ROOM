import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getCurrentSession } from "@/lib/auth";
import { getDb, nowIso, plain, uid } from "@/lib/db";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const links = (
    db
      .prepare(
        `SELECT el.*, d.name as nodeName, d.dotIndex as nodeIndex
         FROM external_links el
         JOIN drive_nodes d ON d.id = el.nodeId
         WHERE el.projectId = ?
         ORDER BY el.createdAt DESC`
      )
      .all(session.project.id) as Array<Record<string, unknown>>
  ).map((l) => ({
    ...plain(l),
    requirePasscode: l.requirePasscode === 1,
    notifyOnVisit: l.notifyOnVisit === 1,
    enabled: l.enabled === 1,
  }));

  const signatures = (
    db
      .prepare(
        `SELECT sr.*, d.name as nodeName, d.dotIndex as nodeIndex
         FROM signature_requests sr
         JOIN drive_nodes d ON d.id = sr.nodeId
         WHERE sr.projectId = ?
         ORDER BY sr.createdAt DESC`
      )
      .all(session.project.id) as Array<Record<string, unknown>>
  ).map((s) => plain(s));

  return NextResponse.json({ links, signatures });
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const db = getDb();
  const now = nowIso();
  const actor = `${session.user.firstName} ${session.user.lastName}`.trim();

  if (body.action === "create-link") {
    const id = uid("lnk");
    const token = crypto.randomBytes(12).toString("hex");
    db.prepare(
      `INSERT INTO external_links (id, projectId, nodeId, token, accessType, requirePasscode, passcode, notifyOnVisit, enabled, createdBy, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`
    ).run(
      id,
      session.project.id,
      String(body.nodeId),
      token,
      String(body.accessType || "Anyone with link"),
      body.requirePasscode ? 1 : 0,
      String(body.passcode || ""),
      actor,
      now
    );
    return NextResponse.json({ ok: true, id, token });
  }

  if (body.action === "toggle-link" && body.id) {
    db.prepare("UPDATE external_links SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END WHERE id = ? AND projectId = ?").run(
      String(body.id),
      session.project.id
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "create-signature") {
    const id = uid("sig");
    db.prepare(
      "INSERT INTO signature_requests (id, projectId, nodeId, title, status, signersJson, createdBy, createdAt) VALUES (?, ?, ?, ?, 'Pending', ?, ?, ?)"
    ).run(
      id,
      session.project.id,
      String(body.nodeId),
      String(body.title || "Signature Request"),
      JSON.stringify(Array.isArray(body.signers) ? body.signers : []),
      actor,
      now
    );
    return NextResponse.json({ ok: true, id });
  }

  if (body.action === "update-signature" && body.id) {
    const status = ["Pending", "Signed", "Declined"].includes(body.status) ? String(body.status) : "Signed";
    db.prepare("UPDATE signature_requests SET status = ? WHERE id = ? AND projectId = ?").run(
      status,
      String(body.id),
      session.project.id
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
