import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentSession, mapGroup } from "@/lib/auth";
import { getDb, nowIso, plain, uid } from "@/lib/db";
import { compareDotIndex, FILE_TYPE_CATEGORIES } from "@/lib/format";
import { resolveEffectivePermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isTrueAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const db = await getDb();
  const format = req.nextUrl.searchParams.get("format");

  const groups = (
    (await db.prepare("SELECT * FROM groups WHERE projectId = ? AND isDeleted = 0 ORDER BY isDefaultAdmin DESC, name ASC").all(session.project.id)) as Array<Record<string, unknown>>
  ).map((g) => mapGroup(plain(g)));

  const nodes = (
    (await db.prepare("SELECT * FROM drive_nodes WHERE projectId = ? AND isTrashed = 0").all(session.project.id)) as Array<Record<string, unknown>>
  )
    .map((n): Record<string, unknown> => ({ ...plain(n), isFolder: n.isFolder === 1 }))
    .sort((a, b) => compareDotIndex(String(a.dotIndex), String(b.dotIndex)));

  const permRows = (await db
    .prepare("SELECT groupId, nodeId, level FROM document_permissions WHERE projectId = ?")
    .all(session.project.id)) as Array<{ groupId: string; nodeId: string; level: string }>;

  if (format === "xlsx") {
    const nodeLookup = new Map(nodes.map((n) => [String(n.id), { id: String(n.id), driveFileId: String(n.driveFileId), parentDriveId: n.parentDriveId ? String(n.parentDriveId) : null }]));
    const driveIdToNodeId = new Map(nodes.map((n) => [String(n.driveFileId), String(n.id)]));
    const userGroups = groups.filter((g) => g.role !== "Administrator");

    const rows = nodes.map((n) => {
      const record: Record<string, string> = {
        Index: String(n.dotIndex),
        Name: String(n.name),
        Type: n.isFolder ? "Folder" : String(n.category),
      };
      for (const g of userGroups) {
        const gPerms = new Map(permRows.filter((p) => p.groupId === g.id).map((p) => [p.nodeId, p.level]));
        record[g.name] = resolveEffectivePermission(String(n.id), g.role, nodeLookup, driveIdToNodeId, gPerms);
      }
      return record;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Permissions Matrix");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(session.project.name)}-permissions.xlsx"`,
      },
    });
  }

  return NextResponse.json({ groups, nodes, permissions: permRows });
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isTrueAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const body = await req.json();
  const db = await getDb();
  const now = nowIso();
  const actor = `${session.user.firstName} ${session.user.lastName}`.trim();

  if (body.action === "set-permission") {
    const groupId = String(body.groupId || "");
    const nodeId = String(body.nodeId || "");
    const level = String(body.level || "view");
    if (!groupId || !nodeId) return NextResponse.json({ error: "groupId and nodeId required" }, { status: 400 });

    const existing = (await db
      .prepare("SELECT id FROM document_permissions WHERE projectId = ? AND groupId = ? AND nodeId = ?")
      .get(session.project.id, groupId, nodeId)) as { id: string } | undefined;

    if (existing) {
      await db.prepare("UPDATE document_permissions SET level = ?, updatedBy = ?, updatedAt = ? WHERE id = ?").run(
        level,
        actor,
        now,
        existing.id
      );
    } else {
      await db.prepare(
        "INSERT INTO document_permissions (id, projectId, groupId, nodeId, level, updatedBy, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(uid("prm"), session.project.id, groupId, nodeId, level, actor, now);
    }

    const grp = (await db.prepare("SELECT name FROM groups WHERE id = ?").get(groupId)) as { name: string } | undefined;
    const nod = (await db.prepare("SELECT dotIndex, name FROM drive_nodes WHERE id = ?").get(nodeId)) as
      | { dotIndex: string; name: string }
      | undefined;

    await db.prepare(
      "INSERT INTO activity_logs (id, projectId, userId, groupId, nodeId, actorName, actorEmail, groupName, category, action, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      uid("log"),
      session.project.id,
      session.user.id,
      groupId,
      nodeId,
      actor,
      session.user.email,
      grp?.name || "Group",
      "Permissions",
      "Permissions assigned",
      `Permissions: ${level} | Target: ${grp?.name || groupId} | Item: ${nod?.dotIndex || ""} ${nod?.name || nodeId}`,
      now
    );

    return NextResponse.json({ ok: true });
  }

  if (body.action === "copy-from-group") {
    const sourceGroupId = String(body.sourceGroupId || "");
    const targetGroupId = String(body.targetGroupId || "");
    if (!sourceGroupId || !targetGroupId) return NextResponse.json({ error: "Source and target groups required" }, { status: 400 });

    const sourcePerms = (await db
      .prepare("SELECT nodeId, level FROM document_permissions WHERE projectId = ? AND groupId = ?")
      .all(session.project.id, sourceGroupId)) as Array<{ nodeId: string; level: string }>;

    await db.transaction(async (tx) => {
      await tx.prepare("DELETE FROM document_permissions WHERE projectId = ? AND groupId = ?").run(session.project.id, targetGroupId);
      const ins = tx.prepare(
        "INSERT INTO document_permissions (id, projectId, groupId, nodeId, level, updatedBy, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );
      for (const p of sourcePerms) {
        await ins.run(uid("prm"), session.project.id, targetGroupId, p.nodeId, p.level, actor, now);
      }
    });

    return NextResponse.json({ ok: true, copied: sourcePerms.length });
  }

  if (body.action === "set-by-filetype") {
    const fileTypes: string[] = Array.isArray(body.fileTypes) ? body.fileTypes.map((t: string) => t.toUpperCase()) : [];
    const groupIds: string[] = Array.isArray(body.groupIds) ? body.groupIds : [];
    const level = String(body.level || "view");
    const includeNoAccess = Boolean(body.includeNoAccess);

    if (fileTypes.length === 0 || groupIds.length === 0) {
      return NextResponse.json({ error: "Select file types and groups" }, { status: 400 });
    }

    const allKnownExts = new Set(Object.values(FILE_TYPE_CATEGORIES).flat());
    const nodes = (await db
      .prepare("SELECT id, driveFileId, parentDriveId, extension FROM drive_nodes WHERE projectId = ? AND isFolder = 0 AND isTrashed = 0")
      .all(session.project.id)) as Array<{ id: string; driveFileId: string; parentDriveId: string | null; extension: string }>;

    const matchingNodes = nodes.filter((n) => {
      const extUpper = n.extension.toUpperCase();
      if (fileTypes.includes(extUpper)) return true;
      if (fileTypes.includes("OTHER") && !allKnownExts.has(extUpper)) return true;
      return false;
    });

    const allNodes = (await db
      .prepare("SELECT id, driveFileId, parentDriveId FROM drive_nodes WHERE projectId = ? AND isTrashed = 0")
      .all(session.project.id)) as Array<{ id: string; driveFileId: string; parentDriveId: string | null }>;
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
    const driveMap = new Map(allNodes.map((n) => [n.driveFileId, n.id]));

    let updatedCount = 0;
    for (const gid of groupIds) {
      const permRows = (await db
        .prepare("SELECT nodeId, level FROM document_permissions WHERE projectId = ? AND groupId = ?")
        .all(session.project.id, gid)) as Array<{ nodeId: string; level: string }>;
      const permMap = new Map(permRows.map((p) => [p.nodeId, p.level]));

      for (const mn of matchingNodes) {
        if (!includeNoAccess) {
          const eff = resolveEffectivePermission(mn.id, "User", nodeMap, driveMap, permMap);
          if (eff === "none") continue;
        }
        const existing = (await db
          .prepare("SELECT id FROM document_permissions WHERE projectId = ? AND groupId = ? AND nodeId = ?")
          .get(session.project.id, gid, mn.id)) as { id: string } | undefined;
        if (existing) {
          await db.prepare("UPDATE document_permissions SET level = ?, updatedBy = ?, updatedAt = ? WHERE id = ?").run(
            level,
            actor,
            now,
            existing.id
          );
        } else {
          await db.prepare(
            "INSERT INTO document_permissions (id, projectId, groupId, nodeId, level, updatedBy, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
          ).run(uid("prm"), session.project.id, gid, mn.id, level, actor, now);
        }
        updatedCount++;
      }
    }

    return NextResponse.json({ ok: true, updatedCount });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
