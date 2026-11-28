import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentSession } from "@/lib/auth";
import { getDb, nowIso, plain, uid } from "@/lib/db";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const statusHistory = (
    db.prepare("SELECT * FROM project_status_history WHERE projectId = ? ORDER BY createdAt DESC").all(session.project.id) as Array<Record<string, unknown>>
  ).map((h) => plain(h));

  const integrations = (
    db.prepare("SELECT * FROM project_integrations WHERE projectId = ? ORDER BY name ASC").all(session.project.id) as Array<Record<string, unknown>>
  ).map((i) => ({ ...plain(i), enabled: i.enabled === 1 }));

  const labels = (
    db.prepare("SELECT * FROM label_definitions WHERE projectId = ? ORDER BY createdAt ASC").all(session.project.id) as Array<Record<string, unknown>>
  ).map((l) => plain(l));

  const terms = (
    db.prepare("SELECT * FROM terms_of_access WHERE projectId = ? ORDER BY createdAt DESC").all(session.project.id) as Array<Record<string, unknown>>
  ).map((t) => ({ ...plain(t), enabled: t.enabled === 1 }));

  const acceptances = (
    db
      .prepare(
        `SELECT ta.id, ta.termsId, ta.acceptedAt, u.email, u.firstName, u.lastName, t.title as termsTitle
         FROM terms_acceptances ta
         JOIN users u ON u.id = ta.userId
         JOIN terms_of_access t ON t.id = ta.termsId
         WHERE t.projectId = ?
         ORDER BY ta.acceptedAt DESC`
      )
      .all(session.project.id) as Array<Record<string, unknown>>
  ).map((a) => plain(a));

  const archives = (
    db.prepare("SELECT * FROM archive_orders WHERE projectId = ? ORDER BY createdAt DESC").all(session.project.id) as Array<Record<string, unknown>>
  ).map((a) => plain(a));

  return NextResponse.json({ statusHistory, integrations, labels, terms, acceptances, archives });
}

export async function PATCH(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const db = getDb();
  const now = nowIso();
  const actor = `${session.user.firstName} ${session.user.lastName}`.trim();

  if (body.scope === "personal") {
    if (body.action === "change-password" && body.newPassword) {
      const hash = await bcrypt.hash(String(body.newPassword), 10);
      db.prepare("UPDATE users SET passwordHash = ?, passwordChangedAt = ?, updatedAt = ? WHERE id = ?").run(
        hash,
        now,
        now,
        session.user.id
      );
      return NextResponse.json({ ok: true });
    }

    db.prepare(
      `UPDATE users SET
        firstName = COALESCE(?, firstName),
        lastName = COALESCE(?, lastName),
        company = COALESCE(?, company),
        jobTitle = COALESCE(?, jobTitle),
        phone = COALESCE(?, phone),
        language = COALESCE(?, language),
        timezone = COALESCE(?, timezone),
        autoTimezone = COALESCE(?, autoTimezone),
        twoFactorEnabled = COALESCE(?, twoFactorEnabled),
        notifyDocChanges = COALESCE(?, notifyDocChanges),
        notifyStorageLimit = COALESCE(?, notifyStorageLimit),
        updatedAt = ?
      WHERE id = ?`
    ).run(
      body.firstName ?? null,
      body.lastName ?? null,
      body.company ?? null,
      body.jobTitle ?? null,
      body.phone ?? null,
      body.language ?? null,
      body.timezone ?? null,
      body.autoTimezone === undefined ? null : body.autoTimezone ? 1 : 0,
      body.twoFactorEnabled === undefined ? null : body.twoFactorEnabled ? 1 : 0,
      body.notifyDocChanges === undefined ? null : body.notifyDocChanges ? 1 : 0,
      body.notifyStorageLimit === undefined ? null : body.notifyStorageLimit ? 1 : 0,
      now,
      session.user.id
    );
    return NextResponse.json({ ok: true });
  }

  if (body.scope === "accept-terms" && body.termsId) {
    db.prepare("INSERT INTO terms_acceptances (id, termsId, userId, acceptedAt) VALUES (?, ?, ?, ?)").run(
      uid("acc"),
      String(body.termsId),
      session.user.id,
      now
    );
    return NextResponse.json({ ok: true });
  }

  if (!session.isTrueAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  if (body.scope === "project-fields") {
    const allowed: Record<string, unknown> = body.fields || {};
    const sets: string[] = [];
    const params: Array<string | number | null> = [];
    const boolCols = new Set([
      "customInvitations",
      "autoIndexing",
      "versioning",
      "publishing",
      "supportAccess",
      "twoFactorRequired",
      "emailVerification",
      "aiToolsEnabled",
      "aiRedaction",
      "aiSearch",
      "aiTranslation",
      "aiSimilarQna",
      "watermarkEnabled",
      "watermarkOnView",
      "watermarkOnPrint",
      "watermarkOnDownload",
      "isFavorite",
    ]);
    const strCols = new Set([
      "name",
      "status",
      "projectType",
      "storageLocation",
      "themeColor",
      "logoUrl",
      "loginBgUrl",
      "allowedDomains",
      "allowedIps",
      "watermarkColor",
      "watermarkPosition",
      "watermarkFieldsJson",
      "watermarkCustomText",
      "adminEmail",
      "adminPhone",
    ]);
    const intCols = new Set(["watermarkOpacity"]);

    for (const [k, v] of Object.entries(allowed)) {
      if (boolCols.has(k)) {
        sets.push(`${k} = ?`);
        params.push(v ? 1 : 0);
      } else if (strCols.has(k)) {
        sets.push(`${k} = ?`);
        params.push(v === null ? null : String(v));
      } else if (intCols.has(k)) {
        sets.push(`${k} = ?`);
        params.push(Number(v));
      }
    }

    if (sets.length > 0) {
      sets.push("updatedAt = ?");
      params.push(now, session.project.id);
      db.prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`).run(...params);

      if (typeof allowed.status === "string" && allowed.status !== session.project.status) {
        db.prepare(
          "INSERT INTO project_status_history (id, projectId, status, actorName, note, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
        ).run(uid("hist"), session.project.id, `Project status: ${allowed.status}`, actor, "", now);
      }

      db.prepare(
        "INSERT INTO activity_logs (id, projectId, userId, actorName, actorEmail, groupName, category, action, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        uid("log"),
        session.project.id,
        session.user.id,
        actor,
        session.user.email,
        session.actualGroup.name,
        "Project settings",
        "Settings updated",
        `Updated fields: ${Object.keys(allowed).join(", ")}`,
        now
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (body.scope === "toggle-integration" && body.key) {
    db.prepare("UPDATE project_integrations SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END WHERE projectId = ? AND key = ?").run(
      session.project.id,
      String(body.key)
    );
    return NextResponse.json({ ok: true });
  }

  if (body.scope === "create-label") {
    db.prepare(
      "INSERT INTO label_definitions (id, projectId, groupName, type, valuesJson, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      uid("lbl"),
      session.project.id,
      String(body.groupName || "Custom"),
      body.type === "Multiple" ? "Multiple" : "Single",
      JSON.stringify(Array.isArray(body.values) ? body.values : []),
      now
    );
    return NextResponse.json({ ok: true });
  }

  if (body.scope === "create-terms") {
    db.prepare(
      "INSERT INTO terms_of_access (id, projectId, title, type, displayMode, assignedGroupIds, content, enabled, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)"
    ).run(
      uid("trm"),
      session.project.id,
      String(body.title || "NDA"),
      String(body.type || "NDA"),
      String(body.displayMode || "On first sign-in"),
      JSON.stringify(Array.isArray(body.assignedGroupIds) ? body.assignedGroupIds : []),
      String(body.content || ""),
      now,
      now
    );
    return NextResponse.json({ ok: true });
  }

  if (body.scope === "update-terms" && body.id) {
    db.prepare(
      `UPDATE terms_of_access SET
        title = COALESCE(?, title),
        type = COALESCE(?, type),
        displayMode = COALESCE(?, displayMode),
        assignedGroupIds = COALESCE(?, assignedGroupIds),
        content = COALESCE(?, content),
        updatedAt = ?
      WHERE id = ? AND projectId = ?`
    ).run(
      body.title ?? null,
      body.type ?? null,
      body.displayMode ?? null,
      Array.isArray(body.assignedGroupIds) ? JSON.stringify(body.assignedGroupIds) : null,
      body.content ?? null,
      now,
      String(body.id),
      session.project.id
    );
    return NextResponse.json({ ok: true });
  }

  if (body.scope === "toggle-terms" && body.id) {
    db.prepare("UPDATE terms_of_access SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END, updatedAt = ? WHERE id = ? AND projectId = ?").run(
      now,
      String(body.id),
      session.project.id
    );
    return NextResponse.json({ ok: true });
  }

  if (body.scope === "delete-terms" && body.id) {
    db.prepare("DELETE FROM terms_of_access WHERE id = ? AND projectId = ?").run(String(body.id), session.project.id);
    return NextResponse.json({ ok: true });
  }

  if (body.scope === "archive-order") {
    const id = uid("arc");
    db.prepare("INSERT INTO archive_orders (id, projectId, type, status, configJson, createdAt) VALUES (?, ?, ?, 'Completed', ?, ?)").run(
      id,
      session.project.id,
      String(body.type || "Downloadable"),
      JSON.stringify(body.config || {}),
      now
    );
    if (body.type === "Online") {
      db.prepare("UPDATE projects SET status = 'Archived', updatedAt = ? WHERE id = ?").run(now, session.project.id);
    }
    db.prepare(
      "INSERT INTO activity_logs (id, projectId, userId, actorName, actorEmail, groupName, category, action, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      uid("log"),
      session.project.id,
      session.user.id,
      actor,
      session.user.email,
      session.actualGroup.name,
      "Project archiving",
      `${body.type || "Downloadable"} archive created`,
      `Archive order ${id}`,
      now
    );
    return NextResponse.json({ ok: true, id });
  }

  if (body.scope === "create-project") {
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Project name required" }, { status: 400 });
    const pid = uid("prj");
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
    const code = `5_${Math.floor(10000 + Math.random() * 89999)}`;
    db.prepare(
      `INSERT INTO projects (id, name, slug, projectCode, status, projectType, storageLocation, driveRootFolderName, adminEmail, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'Live', ?, ?, ?, ?, ?, ?)`
    ).run(
      pid,
      name,
      slug,
      code,
      String(body.projectType || "Fundraising"),
      String(body.storageLocation || "Google Drive Mirror"),
      name,
      session.user.email,
      now,
      now
    );
    const gid = uid("grp");
    db.prepare("INSERT INTO groups (id, projectId, name, role, isDefaultAdmin, createdAt, updatedAt) VALUES (?, ?, 'Administrators', 'Administrator', 1, ?, ?)").run(
      gid,
      pid,
      now,
      now
    );
    db.prepare("INSERT INTO project_participants (id, projectId, userId, groupId, status, addedBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'Engaged', ?, ?, ?)").run(
      uid("prt"),
      pid,
      session.user.id,
      gid,
      actor,
      now,
      now
    );
    return NextResponse.json({ ok: true, id: pid, slug });
  }

  return NextResponse.json({ error: "Invalid settings scope" }, { status: 400 });
}
