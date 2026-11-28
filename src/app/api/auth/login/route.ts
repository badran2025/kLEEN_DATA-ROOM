import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb, nowIso, uid } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const projectSlug = body.projectSlug ? String(body.projectSlug) : null;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const db = await getDb();
    const user = (await db.prepare("SELECT * FROM users WHERE email = ?").get(email)) as
      | { id: string; email: string; passwordHash: string; firstName: string; lastName: string }
      | undefined;
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const project = (projectSlug
      ? await db.prepare("SELECT * FROM projects WHERE slug = ?").get(projectSlug)
      : await db.prepare("SELECT * FROM projects ORDER BY createdAt ASC LIMIT 1").get()) as
      | { id: string; slug: string; status: string }
      | undefined;

    if (!project) {
      return NextResponse.json({ error: "No Data Room project found." }, { status: 404 });
    }

    const participation = (await db
      .prepare("SELECT * FROM project_participants WHERE projectId = ? AND userId = ?")
      .get(project.id, user.id)) as
      | { id: string; groupId: string; status: string; accessEnabled: number; accessStart: string | null; accessEnd: string | null }
      | undefined;

    if (!participation || !participation.accessEnabled) {
      return NextResponse.json({ error: "Your access to this Data Room is currently disabled." }, { status: 403 });
    }

    const nowMs = Date.now();
    if (participation.accessStart && new Date(participation.accessStart).getTime() > nowMs) {
      return NextResponse.json(
        { error: `Your Data Room access starts on ${new Date(participation.accessStart).toLocaleString()}.` },
        { status: 403 }
      );
    }
    if (participation.accessEnd && new Date(participation.accessEnd).getTime() < nowMs) {
      return NextResponse.json(
        { error: `Your Data Room access expired on ${new Date(participation.accessEnd).toLocaleString()}.` },
        { status: 403 }
      );
    }

    const group = (await db.prepare("SELECT * FROM groups WHERE id = ?").get(participation.groupId)) as
      | { id: string; name: string; role: string; accessEnabled: number; isDeleted: number }
      | undefined;

    if (!group || !group.accessEnabled || group.isDeleted) {
      return NextResponse.json({ error: "Your group access is currently disabled." }, { status: 403 });
    }

    if (project.status === "Closed" && group.role !== "Administrator") {
      return NextResponse.json({ error: "This Data Room is currently closed." }, { status: 403 });
    }

    const now = nowIso();
    await db.prepare("UPDATE project_participants SET lastSignInAt = ?, status = ?, updatedAt = ? WHERE id = ?").run(
      now,
      participation.status === "Invited" ? "Signed in" : participation.status,
      now,
      participation.id
    );

    await db.prepare(
      "INSERT INTO activity_logs (id, projectId, userId, groupId, actorName, actorEmail, groupName, category, action, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      uid("log"),
      project.id,
      user.id,
      group.id,
      `${user.firstName} ${user.lastName}`.trim(),
      user.email,
      group.name,
      "Participants",
      "Signed in",
      `Browser session started (${group.name})`,
      now
    );

    await setSessionCookie({
      userId: user.id,
      email: user.email,
      projectId: project.id,
      viewAsGroupId: null,
    });

    return NextResponse.json({ ok: true, projectSlug: project.slug });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Failed to sign in." }, { status: 500 });
  }
}
