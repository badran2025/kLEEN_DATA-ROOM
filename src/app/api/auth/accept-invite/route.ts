import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb, nowIso, uid } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!token) return NextResponse.json({ error: "Invitation token missing." }, { status: 400 });

  const db = await getDb();
  const row = (await db
    .prepare(
      `SELECT pp.id, pp.projectId, pp.userId, pp.accessEnabled, pp.accessStart, pp.accessEnd,
              u.email, u.firstName, u.lastName, p.name as projectName, g.name as groupName
       FROM project_participants pp
       JOIN users u ON u.id = pp.userId
       JOIN projects p ON p.id = pp.projectId
       JOIN groups g ON g.id = pp.groupId
       WHERE pp.inviteToken = ?`
    )
    .get(token)) as
    | {
        id: string;
        projectId: string;
        userId: string;
        accessEnabled: number;
        accessStart: string | null;
        accessEnd: string | null;
        email: string;
        firstName: string;
        lastName: string;
        projectName: string;
        groupName: string;
      }
    | undefined;

  if (!row) {
    return NextResponse.json({ error: "Invalid or expired invitation link." }, { status: 404 });
  }
  if (!row.accessEnabled) {
    return NextResponse.json({ error: "Your access has been deactivated by the administrator." }, { status: 403 });
  }

  return NextResponse.json({
    valid: true,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    projectName: row.projectName,
    groupName: row.groupName,
    accessStart: row.accessStart,
    accessEnd: row.accessEnd,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token || "");
  const password = String(body.password || "");
  const firstName = body.firstName ? String(body.firstName).trim() : null;
  const lastName = body.lastName ? String(body.lastName).trim() : null;

  if (!token || password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const db = await getDb();
  const row = (await db
    .prepare(
      `SELECT pp.id as partId, pp.projectId, pp.userId, pp.groupId, pp.accessEnabled, pp.accessStart, pp.accessEnd,
              u.email, u.firstName, u.lastName, g.name as groupName
       FROM project_participants pp
       JOIN users u ON u.id = pp.userId
       JOIN groups g ON g.id = pp.groupId
       WHERE pp.inviteToken = ?`
    )
    .get(token)) as
    | {
        partId: string;
        projectId: string;
        userId: string;
        groupId: string;
        accessEnabled: number;
        accessStart: string | null;
        accessEnd: string | null;
        email: string;
        firstName: string;
        lastName: string;
        groupName: string;
      }
    | undefined;

  if (!row) return NextResponse.json({ error: "Invalid invitation link." }, { status: 404 });
  if (!row.accessEnabled) return NextResponse.json({ error: "Access is disabled." }, { status: 403 });

  const nowMs = Date.now();
  if (row.accessStart && new Date(row.accessStart).getTime() > nowMs) {
    return NextResponse.json(
      { error: `Your access period begins on ${new Date(row.accessStart).toLocaleString()}.` },
      { status: 403 }
    );
  }
  if (row.accessEnd && new Date(row.accessEnd).getTime() < nowMs) {
    return NextResponse.json({ error: "Your access period has expired." }, { status: 403 });
  }

  const now = nowIso();
  const hash = await bcrypt.hash(password, 10);
  await db.prepare(
    `UPDATE users SET
      passwordHash = ?,
      firstName = COALESCE(?, firstName),
      lastName = COALESCE(?, lastName),
      passwordChangedAt = ?,
      updatedAt = ?
    WHERE id = ?`
  ).run(hash, firstName, lastName, now, now, row.userId);

  await db.prepare(
    "UPDATE project_participants SET status = 'Signed in', lastSignInAt = ?, inviteToken = NULL, updatedAt = ? WHERE id = ?"
  ).run(now, now, row.partId);

  const displayName = `${firstName || row.firstName} ${lastName ?? row.lastName}`.trim();
  await db.prepare(
    "INSERT INTO activity_logs (id, projectId, userId, groupId, actorName, actorEmail, groupName, category, action, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    uid("log"),
    row.projectId,
    row.userId,
    row.groupId,
    displayName,
    row.email,
    row.groupName,
    "Participants",
    "Invitation accepted & signed in",
    `Activated account via invitation link (${row.groupName})`,
    now
  );

  await setSessionCookie({
    userId: row.userId,
    email: row.email,
    projectId: row.projectId,
    viewAsGroupId: null,
  });

  return NextResponse.json({ ok: true });
}
