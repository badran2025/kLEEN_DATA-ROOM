import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentSession } from "@/lib/auth";
import { getDb, nowIso, plain, uid } from "@/lib/db";
import { compareDotIndex, formatBytes, formatDateShort } from "@/lib/format";
import { canAccessNode, resolveEffectivePermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contents = req.nextUrl.searchParams.get("contents") || "all"; // all | files | folders
  const includeRecycle = req.nextUrl.searchParams.get("includeRecycle") === "true";
  const fromDate = req.nextUrl.searchParams.get("fromDate") || "";

  const db = getDb();
  const rawNodes = db
    .prepare(
      includeRecycle
        ? "SELECT * FROM drive_nodes WHERE projectId = ?"
        : "SELECT * FROM drive_nodes WHERE projectId = ? AND isTrashed = 0"
    )
    .all(session.project.id) as Array<Record<string, unknown>>;

  const permRows = db
    .prepare("SELECT nodeId, level FROM document_permissions WHERE projectId = ? AND groupId = ?")
    .all(session.project.id, session.effectiveGroup.id) as Array<{ nodeId: string; level: string }>;

  const nodeLookup = new Map(
    rawNodes.map((n) => [String(n.id), { id: String(n.id), driveFileId: String(n.driveFileId), parentDriveId: n.parentDriveId ? String(n.parentDriveId) : null }])
  );
  const driveIdToNodeId = new Map(rawNodes.map((n) => [String(n.driveFileId), String(n.id)]));
  const permMap = new Map(permRows.map((p) => [p.nodeId, p.level]));

  const rows = rawNodes
    .map((r) => plain(r))
    .filter((n) => {
      const eff = resolveEffectivePermission(String(n.id), session.effectiveGroup.role, nodeLookup, driveIdToNodeId, permMap);
      if (!canAccessNode(eff)) return false;
      if (contents === "files" && n.isFolder === 1) return false;
      if (contents === "folders" && n.isFolder !== 1) return false;
      if (fromDate && String(n.driveModifiedAt) < fromDate) return false;
      return true;
    })
    .sort((a, b) => compareDotIndex(String(a.dotIndex), String(b.dotIndex)))
    .map((n) => ({
      Index: String(n.dotIndex),
      Name: String(n.name),
      Type: n.isFolder === 1 ? "Folder" : String(n.category),
      Size: n.isFolder === 1 ? "—" : formatBytes(Number(n.sizeBytes || 0)),
      Pages: n.isFolder === 1 ? "" : Number(n.pageCount || 0),
      "Added / Modified": formatDateShort(String(n.driveModifiedAt)),
      Status: n.isTrashed === 1 ? "Recycle bin" : "Active",
      "Drive ID": String(n.driveFileId),
    }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Project Index");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  db.prepare(
    "INSERT INTO activity_logs (id, projectId, userId, groupId, actorName, actorEmail, groupName, category, action, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    uid("log"),
    session.project.id,
    session.user.id,
    session.effectiveGroup.id,
    `${session.user.firstName} ${session.user.lastName}`.trim(),
    session.user.email,
    session.effectiveGroup.name,
    "Documents",
    "Project index exported",
    `Exported ${rows.length} rows (${contents})`,
    nowIso()
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(session.project.name)}-project-index.xlsx"`,
    },
  });
}
