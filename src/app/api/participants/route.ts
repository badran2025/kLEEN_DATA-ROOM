import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import { getCurrentSession, mapGroup } from "@/lib/auth";
import { getDb, nowIso, plain, uid } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const format = req.nextUrl.searchParams.get("format");

  const groupRows = db
    .prepare("SELECT * FROM groups WHERE projectId = ? AND isDeleted = 0 ORDER BY isDefaultAdmin DESC, name ASC")
    .all(session.project.id) as Array<Record<string, unknown>>;

  const partRows = db
    .prepare(
      `SELECT pp.*, u.email, u.firstName, u.lastName, u.company, u.jobTitle, u.twoFactorEnabled
       FROM project_participants pp
       JOIN users u ON u.id = pp.userId
       WHERE pp.projectId = ?
       ORDER BY pp.createdAt ASC`
    )
    .all(session.project.id) as Array<Record<string, unknown>>;

  const groups = groupRows.map((g) => {
    const mapped = mapGroup(plain(g));
    const members = partRows
      .filter((p) => String(p.groupId) === mapped.id)
      .map((p) => ({
        ...plain(p),
        accessEnabled: p.accessEnabled === 1,
        require2fa: p.require2fa === 1,
        docNotifications: p.docNotifications === 1,
        twoFactorEnabled: p.twoFactorEnabled === 1,
      }));
    return { ...mapped, members };
  });

  if (format === "xlsx") {
    const exportRows = partRows.map((p) => {
      const grp = groups.find((g) => g.id === String(p.groupId));
      return {
        Group: grp?.name || "",
        Role: grp?.role || "",
        Name: `${String(p.firstName)} ${String(p.lastName)}`.trim(),
        Email: String(p.email),
        Status: String(p.status),
        "Project Access": p.accessEnabled === 1 ? "Enabled" : "Disabled",
        "Last Sign-In": p.lastSignInAt ? String(p.lastSignInAt) : "Never",
      };
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, ws, "Participants");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(session.project.name)}-participants.xlsx"`,
      },
    });
  }

  return NextResponse.json({ groups });
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isTrueAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const body = await req.json();
  const db = getDb();
  const now = nowIso();

  if (body.action === "create-group") {
    const name = String(body.name || "").trim();
    const role = ["Administrator", "User", "Custom"].includes(body.role) ? String(body.role) : "User";
    if (!name) return NextResponse.json({ error: "Group name is required" }, { status: 400 });

    const gid = uid("grp");
    db.prepare(
      `INSERT INTO groups (id, projectId, name, role, featurePermissionsJson, aiIntegrationsJson, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      gid,
      session.project.id,
      name,
      role,
      JSON.stringify(body.featurePermissions || {}),
      JSON.stringify(body.aiIntegrations || {}),
      now,
      now
    );

    db.prepare(
      "INSERT INTO activity_logs (id, projectId, userId, actorName, actorEmail, groupName, category, action, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      uid("log"),
      session.project.id,
      session.user.id,
      `${session.user.firstName} ${session.user.lastName}`,
      session.user.email,
      session.actualGroup.name,
      "Participants",
      "Group created",
      `Group: ${name} (${role})`,
      now
    );

    return NextResponse.json({ ok: true, id: gid });
  }

  if (body.action === "add-participants") {
    const groupId = String(body.groupId || "");
    const entries: Array<{ email: string; fullName?: string }> = Array.isArray(body.entries) ? body.entries : [];
    const invitationLanguage = String(body.invitationLanguage || "English (United States)");
    const docNotifications = body.docNotifications !== false ? 1 : 0;
    const accessEnabled = body.accessEnabled !== false ? 1 : 0;
    const accessStart = body.accessStart ? String(body.accessStart) : null;
    const accessEnd = body.accessEnd ? String(body.accessEnd) : null;
    const require2fa = body.require2fa ? 1 : 0;
    const allowedIps = String(body.allowedIps || "");
    const customPassword = body.initialPassword ? String(body.initialPassword).trim() : "";

    if (!groupId || entries.length === 0) {
      return NextResponse.json({ error: "Group and at least one email are required" }, { status: 400 });
    }

    const passwordToUse = customPassword || "kleen2026";
    const defaultHash = await bcrypt.hash(passwordToUse, 10);
    let addedCount = 0;
    const invites: Array<{ email: string; fullName: string; inviteToken: string }> = [];

    for (const entry of entries) {
      const email = String(entry.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) continue;

      const nameParts = String(entry.fullName || email.split("@")[0]).trim().split(/\s+/);
      const firstName = nameParts[0] || "Participant";
      const lastName = nameParts.slice(1).join(" ") || "";

      let user = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: string } | undefined;
      if (!user) {
        const newUid = uid("usr");
        db.prepare(
          "INSERT INTO users (id, email, passwordHash, firstName, lastName, passwordChangedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(newUid, email, defaultHash, firstName, lastName, now, now, now);
        user = { id: newUid };
      }

      const inviteToken = crypto.randomBytes(18).toString("hex");
      const exists = db
        .prepare("SELECT id FROM project_participants WHERE projectId = ? AND userId = ?")
        .get(session.project.id, user.id) as { id: string } | undefined;

      if (!exists) {
        db.prepare(
          `INSERT INTO project_participants (
            id, projectId, userId, groupId, status, accessEnabled, accessStart, accessEnd,
            require2fa, allowedIps, docNotifications, invitationLanguage, addedBy, inviteToken, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, 'Invited', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          uid("prt"),
          session.project.id,
          user.id,
          groupId,
          accessEnabled,
          accessStart,
          accessEnd,
          require2fa,
          allowedIps,
          docNotifications,
          invitationLanguage,
          `${session.user.firstName} ${session.user.lastName}`,
          inviteToken,
          now,
          now
        );
        addedCount++;
      } else {
        db.prepare(
          "UPDATE project_participants SET groupId = ?, accessEnabled = ?, accessStart = ?, accessEnd = ?, require2fa = ?, allowedIps = ?, inviteToken = ?, updatedAt = ? WHERE id = ?"
        ).run(groupId, accessEnabled, accessStart, accessEnd, require2fa, allowedIps, inviteToken, now, exists.id);
      }
      invites.push({ email, fullName: `${firstName} ${lastName}`.trim(), inviteToken });
    }

    if (Array.isArray(body.assignedTermsIds) && body.assignedTermsIds.length > 0) {
      for (const tid of body.assignedTermsIds as string[]) {
        const termRow = db
          .prepare("SELECT id, assignedGroupIds FROM terms_of_access WHERE id = ? AND projectId = ?")
          .get(String(tid), session.project.id) as { id: string; assignedGroupIds: string } | undefined;
        if (termRow) {
          const currentGroups: string[] = JSON.parse(termRow.assignedGroupIds || "[]");
          if (currentGroups.length > 0 && !currentGroups.includes(groupId)) {
            currentGroups.push(groupId);
            db.prepare("UPDATE terms_of_access SET assignedGroupIds = ?, enabled = 1, updatedAt = ? WHERE id = ?").run(
              JSON.stringify(currentGroups),
              now,
              termRow.id
            );
          } else {
            db.prepare("UPDATE terms_of_access SET enabled = 1, updatedAt = ? WHERE id = ?").run(now, termRow.id);
          }
        }
      }
    }

    db.prepare(
      "INSERT INTO activity_logs (id, projectId, userId, actorName, actorEmail, groupName, category, action, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      uid("log"),
      session.project.id,
      session.user.id,
      `${session.user.firstName} ${session.user.lastName}`,
      session.user.email,
      session.actualGroup.name,
      "Participants",
      "Participants invited",
      `Invited ${addedCount} participant(s)${accessStart ? ` (from ${accessStart})` : ""}`,
      now
    );

    return NextResponse.json({
      ok: true,
      addedCount,
      invites,
      usedCustomPassword: Boolean(customPassword),
    });
  }

  if (body.action === "resend-invite" && body.participantId) {
    const inviteToken = crypto.randomBytes(18).toString("hex");
    db.prepare("UPDATE project_participants SET inviteToken = ?, updatedAt = ? WHERE id = ? AND projectId = ?").run(
      inviteToken,
      now,
      String(body.participantId),
      session.project.id
    );
    const row = db
      .prepare(
        "SELECT u.email FROM project_participants pp JOIN users u ON u.id = pp.userId WHERE pp.id = ?"
      )
      .get(String(body.participantId)) as { email: string } | undefined;
    return NextResponse.json({ ok: true, inviteToken, email: row?.email || "" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isTrueAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const body = await req.json();
  const db = getDb();
  const now = nowIso();

  if (body.targetType === "group" && body.groupId) {
    const gid = String(body.groupId);
    if (body.action === "rename" && body.name) {
      db.prepare("UPDATE groups SET name = ?, updatedAt = ? WHERE id = ? AND projectId = ?").run(
        String(body.name),
        now,
        gid,
        session.project.id
      );
    } else if (body.action === "deactivate") {
      db.prepare("UPDATE groups SET accessEnabled = 0, updatedAt = ? WHERE id = ? AND projectId = ? AND isDefaultAdmin = 0").run(
        now,
        gid,
        session.project.id
      );
    } else if (body.action === "activate") {
      db.prepare("UPDATE groups SET accessEnabled = 1, updatedAt = ? WHERE id = ? AND projectId = ?").run(
        now,
        gid,
        session.project.id
      );
    } else if (body.action === "delete") {
      db.prepare("UPDATE groups SET isDeleted = 1, updatedAt = ? WHERE id = ? AND projectId = ? AND isDefaultAdmin = 0").run(
        now,
        gid,
        session.project.id
      );
    } else if (body.action === "update-settings") {
      db.prepare(
        `UPDATE groups SET
          role = COALESCE(?, role),
          featurePermissionsJson = COALESCE(?, featurePermissionsJson),
          accessEnabled = COALESCE(?, accessEnabled),
          accessStart = ?,
          accessEnd = ?,
          require2fa = COALESCE(?, require2fa),
          allowedIps = COALESCE(?, allowedIps),
          docUpdateFrequency = COALESCE(?, docUpdateFrequency),
          updatedAt = ?
        WHERE id = ? AND projectId = ?`
      ).run(
        body.role ?? null,
        body.featurePermissions ? JSON.stringify(body.featurePermissions) : null,
        body.accessEnabled === undefined ? null : body.accessEnabled ? 1 : 0,
        body.accessStart ?? null,
        body.accessEnd ?? null,
        body.require2fa === undefined ? null : body.require2fa ? 1 : 0,
        body.allowedIps ?? null,
        body.docUpdateFrequency ?? null,
        now,
        gid,
        session.project.id
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (body.targetType === "participant" && body.participantId) {
    const pid = String(body.participantId);
    if (body.action === "move-group" && body.groupId) {
      db.prepare("UPDATE project_participants SET groupId = ?, updatedAt = ? WHERE id = ? AND projectId = ?").run(
        String(body.groupId),
        now,
        pid,
        session.project.id
      );
    } else if (body.action === "deactivate") {
      db.prepare("UPDATE project_participants SET accessEnabled = 0, status = 'Deactivated', updatedAt = ? WHERE id = ? AND projectId = ?").run(
        now,
        pid,
        session.project.id
      );
    } else if (body.action === "activate") {
      db.prepare("UPDATE project_participants SET accessEnabled = 1, status = 'Signed in', updatedAt = ? WHERE id = ? AND projectId = ?").run(
        now,
        pid,
        session.project.id
      );
    } else if (body.action === "delete") {
      db.prepare("DELETE FROM project_participants WHERE id = ? AND projectId = ?").run(pid, session.project.id);
    } else if (body.action === "update-settings") {
      db.prepare(
        `UPDATE project_participants SET
          groupId = COALESCE(?, groupId),
          accessEnabled = COALESCE(?, accessEnabled),
          accessStart = ?,
          accessEnd = ?,
          require2fa = COALESCE(?, require2fa),
          allowedIps = COALESCE(?, allowedIps),
          docNotifications = COALESCE(?, docNotifications),
          docUpdateFrequency = COALESCE(?, docUpdateFrequency),
          updatedAt = ?
        WHERE id = ? AND projectId = ?`
      ).run(
        body.groupId ?? null,
        body.accessEnabled === undefined ? null : body.accessEnabled ? 1 : 0,
        body.accessStart ?? null,
        body.accessEnd ?? null,
        body.require2fa === undefined ? null : body.require2fa ? 1 : 0,
        body.allowedIps ?? null,
        body.docNotifications === undefined ? null : body.docNotifications ? 1 : 0,
        body.docUpdateFrequency ?? null,
        now,
        pid,
        session.project.id
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid update target" }, { status: 400 });
}
