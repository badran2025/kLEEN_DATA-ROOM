import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession, mapGroup, setSessionCookie } from "@/lib/auth";
import { getDb, nowIso, plain, uid } from "@/lib/db";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const db = getDb();
  const activeTerms = db
    .prepare("SELECT * FROM terms_of_access WHERE projectId = ? AND enabled = 1")
    .all(session.project.id) as Array<{
    id: string;
    title: string;
    type: string;
    displayMode: string;
    assignedGroupIds: string;
    content: string;
  }>;

  const pendingTerms = [];
  for (const t of activeTerms) {
    const assignedIds: string[] = JSON.parse(t.assignedGroupIds || "[]");
    const applies =
      assignedIds.length === 0
        ? session.effectiveGroup.role !== "Administrator"
        : assignedIds.includes(session.effectiveGroup.id);
    if (!applies) continue;

    if (t.displayMode === "On each sign-in") {
      const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString();
      const recent = db
        .prepare("SELECT id FROM terms_acceptances WHERE termsId = ? AND userId = ? AND acceptedAt >= ?")
        .get(t.id, session.user.id, cutoff);
      if (!recent) pendingTerms.push(plain(t));
    } else {
      const accepted = db
        .prepare("SELECT id FROM terms_acceptances WHERE termsId = ? AND userId = ?")
        .get(t.id, session.user.id);
      if (!accepted) pendingTerms.push(plain(t));
    }
  }

  const allProjects = (
    db
      .prepare("SELECT id, name, slug, status, isFavorite, updatedAt FROM projects ORDER BY createdAt ASC")
      .all() as Array<Record<string, unknown>>
  ).map((p) => ({
    ...plain(p),
    isFavorite: p.isFavorite === 1,
  }));

  const groupRows = db
    .prepare("SELECT * FROM groups WHERE projectId = ? AND isDeleted = 0 ORDER BY name ASC")
    .all(session.project.id) as Array<Record<string, unknown>>;

  const groups = groupRows.map((g) => {
    const mapped = mapGroup(plain(g));
    const members = db
      .prepare(
        `SELECT u.id, u.firstName, u.lastName, u.email, pp.status
         FROM project_participants pp
         JOIN users u ON u.id = pp.userId
         WHERE pp.projectId = ? AND pp.groupId = ?`
      )
      .all(session.project.id, mapped.id) as Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      status: string;
    }>;
    return { ...mapped, members: members.map((m) => plain(m)) };
  });

  return NextResponse.json({
    authenticated: true,
    user: session.user,
    project: {
      ...session.project,
      driveServiceAccountJson: session.project.driveServiceAccountJson ? "***CONFIGURED***" : "",
      driveOAuthTokensJson: session.project.driveOAuthTokensJson ? "***CONNECTED***" : "",
      driveApiKey: session.project.driveApiKey ? "***CONFIGURED***" : "",
    },
    actualGroup: session.actualGroup,
    effectiveGroup: session.effectiveGroup,
    isViewingAs: session.isViewingAs,
    isAdmin: session.isAdmin,
    isTrueAdmin: session.isTrueAdmin,
    pendingTerms,
    allProjects,
    groups,
  });
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const db = getDb();

  if (body.action === "view-as") {
    if (!session.isTrueAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const groupId = body.groupId ? String(body.groupId) : null;
    await setSessionCookie({
      userId: session.user.id,
      email: session.user.email,
      projectId: session.project.id,
      viewAsGroupId: groupId,
    });
    if (groupId) {
      const targetGroup = db.prepare("SELECT name FROM groups WHERE id = ?").get(groupId) as { name: string } | undefined;
      db.prepare(
        "INSERT INTO activity_logs (id, projectId, userId, actorName, actorEmail, groupName, category, action, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        uid("log"),
        session.project.id,
        session.user.id,
        `${session.user.firstName} ${session.user.lastName}`,
        session.user.email,
        session.actualGroup.name,
        "Documents",
        "View as preview started",
        `Previewing Data Room as ${targetGroup?.name || groupId}`,
        nowIso()
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "switch-project" && body.projectId) {
    const targetProject = db.prepare("SELECT id FROM projects WHERE id = ?").get(String(body.projectId));
    if (!targetProject) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    await setSessionCookie({
      userId: session.user.id,
      email: session.user.email,
      projectId: String(body.projectId),
      viewAsGroupId: null,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
