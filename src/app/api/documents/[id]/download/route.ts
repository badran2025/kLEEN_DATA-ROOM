import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getDb, nowIso, plain, uid } from "@/lib/db";
import { getNodeContentBuffer } from "@/lib/drive-sync";
import { applyWatermarkToPdf } from "@/lib/pdf-utils";
import { canDownloadOriginal, canDownloadPdf, resolveEffectivePermission } from "@/lib/permissions";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const format = req.nextUrl.searchParams.get("format") || "pdf"; // pdf | original

  const db = getDb();
  const nodeRow = db
    .prepare("SELECT * FROM drive_nodes WHERE id = ? AND projectId = ? AND isTrashed = 0")
    .get(id, session.project.id) as Record<string, unknown> | undefined;
  if (!nodeRow) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  const node = plain(nodeRow);

  const rawNodes = db
    .prepare("SELECT id, driveFileId, parentDriveId FROM drive_nodes WHERE projectId = ? AND isTrashed = 0")
    .all(session.project.id) as Array<{ id: string; driveFileId: string; parentDriveId: string | null }>;
  const permRows = db
    .prepare("SELECT nodeId, level FROM document_permissions WHERE projectId = ? AND groupId = ?")
    .all(session.project.id, session.effectiveGroup.id) as Array<{ nodeId: string; level: string }>;

  const eff = resolveEffectivePermission(
    id,
    session.effectiveGroup.role,
    new Map(rawNodes.map((n) => [n.id, n])),
    new Map(rawNodes.map((n) => [n.driveFileId, n.id])),
    new Map(permRows.map((p) => [p.nodeId, p.level]))
  );

  if (format === "original" && !canDownloadOriginal(eff)) {
    return NextResponse.json({ error: "Original download not permitted for your group." }, { status: 403 });
  }
  if (format !== "original" && !canDownloadPdf(eff)) {
    return NextResponse.json({ error: "Download not permitted for your group." }, { status: 403 });
  }

  const preferPdf = format !== "original";
  const { buffer, contentType, filename } = await getNodeContentBuffer(
    session.project,
    {
      driveFileId: String(node.driveFileId),
      name: String(node.name),
      mimeType: String(node.mimeType),
      dotIndex: String(node.dotIndex),
      category: String(node.category),
      sizeBytes: Number(node.sizeBytes || 0),
      pageCount: Number(node.pageCount || 4),
      demoContentText: node.demoContentText ? String(node.demoContentText) : null,
    },
    preferPdf
  );

  let finalBuffer = buffer;
  if (
    preferPdf &&
    contentType === "application/pdf" &&
    session.project.watermarkEnabled &&
    session.project.watermarkOnDownload
  ) {
    const fields: string[] = JSON.parse(session.project.watermarkFieldsJson || "[]");
    const lines: string[] = [];
    if (fields.includes("projectName")) lines.push(session.project.name);
    if (fields.includes("email")) lines.push(session.user.email);
    if (fields.includes("fullName")) lines.push(`${session.user.firstName} ${session.user.lastName}`.trim());
    if (fields.includes("dateTime")) lines.push(new Date().toLocaleString("en-US"));
    if (fields.includes("customText") && session.project.watermarkCustomText) {
      lines.push(session.project.watermarkCustomText);
    }
    finalBuffer = await applyWatermarkToPdf(buffer, {
      enabled: true,
      color: session.project.watermarkColor,
      opacity: session.project.watermarkOpacity,
      position: session.project.watermarkPosition,
      lines,
    });
  }

  db.prepare(
    "INSERT INTO activity_logs (id, projectId, userId, groupId, nodeId, actorName, actorEmail, groupName, category, action, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    uid("log"),
    session.project.id,
    session.user.id,
    session.effectiveGroup.id,
    id,
    `${session.user.firstName} ${session.user.lastName}`.trim(),
    session.user.email,
    session.effectiveGroup.name,
    "Documents",
    format === "original" ? "Original downloaded" : "PDF downloaded",
    `${node.dotIndex} ${node.name}`,
    nowIso()
  );

  return new NextResponse(new Uint8Array(finalBuffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
