import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { getCurrentSession } from "@/lib/auth";
import { getDb, nowIso, plain, uid } from "@/lib/db";
import { getNodeContentBuffer } from "@/lib/drive-sync";
import { applyWatermarkToPdf } from "@/lib/pdf-utils";
import { canDownloadOriginal, canDownloadPdf, resolveEffectivePermission } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const nodeIds: string[] = Array.isArray(body.nodeIds) ? body.nodeIds : [];
  const parentDriveId: string | null = body.parentDriveId ?? null;
  const format = String(body.format || "pdf");

  const db = getDb();
  const rawNodes = db
    .prepare("SELECT * FROM drive_nodes WHERE projectId = ? AND isTrashed = 0")
    .all(session.project.id) as Array<Record<string, unknown>>;

  const permRows = db
    .prepare("SELECT nodeId, level FROM document_permissions WHERE projectId = ? AND groupId = ?")
    .all(session.project.id, session.effectiveGroup.id) as Array<{ nodeId: string; level: string }>;

  const nodeLookup = new Map(
    rawNodes.map((n) => [String(n.id), { id: String(n.id), driveFileId: String(n.driveFileId), parentDriveId: n.parentDriveId ? String(n.parentDriveId) : null }])
  );
  const driveIdToNodeId = new Map(rawNodes.map((n) => [String(n.driveFileId), String(n.id)]));
  const permMap = new Map(permRows.map((p) => [p.nodeId, p.level]));

  // Collect all files under selected nodes (or current folder)
  const selectedSet = new Set<string>(nodeIds);
  const targetFiles: Array<{ node: Record<string, unknown>; path: string }> = [];

  function walk(parentDrive: string | null, prefixPath: string, includeAllDescendants: boolean) {
    const children = rawNodes.filter((r) => (r.parentDriveId || null) === parentDrive);
    for (const c of children) {
      const cid = String(c.id);
      const included = includeAllDescendants || selectedSet.has(cid);
      const nextPath = prefixPath ? `${prefixPath}/${String(c.name)}` : String(c.name);
      if (c.isFolder === 1) {
        walk(String(c.driveFileId), nextPath, included);
      } else if (included) {
        targetFiles.push({ node: plain(c), path: nextPath });
      }
    }
  }

  if (selectedSet.size > 0) {
    walk(parentDriveId, "", false);
    // Also check if selected nodes are nested deeper than parentDriveId
    if (targetFiles.length === 0) {
      walk(null, "", false);
    }
  } else {
    walk(parentDriveId, "", true);
  }

  const zip = new JSZip();
  let added = 0;

  for (const item of targetFiles) {
    const eff = resolveEffectivePermission(String(item.node.id), session.effectiveGroup.role, nodeLookup, driveIdToNodeId, permMap);
    const allowOriginal = format === "original" && canDownloadOriginal(eff);
    const allowPdf = canDownloadPdf(eff);
    if (!allowOriginal && !allowPdf) continue;

    const { buffer, contentType } = await getNodeContentBuffer(
      session.project,
      {
        driveFileId: String(item.node.driveFileId),
        name: String(item.node.name),
        mimeType: String(item.node.mimeType),
        dotIndex: String(item.node.dotIndex),
        category: String(item.node.category),
        sizeBytes: Number(item.node.sizeBytes || 0),
        pageCount: Number(item.node.pageCount || 4),
        demoContentText: item.node.demoContentText ? String(item.node.demoContentText) : null,
      },
      !allowOriginal
    );

    let finalBuf = buffer;
    if (!allowOriginal && contentType === "application/pdf" && session.project.watermarkEnabled && session.project.watermarkOnDownload) {
      finalBuf = await applyWatermarkToPdf(buffer, {
        enabled: true,
        color: session.project.watermarkColor,
        opacity: session.project.watermarkOpacity,
        position: session.project.watermarkPosition,
        lines: [session.project.name, session.user.email, new Date().toLocaleString("en-US")],
      });
    }

    zip.file(item.path, finalBuf);
    added++;
  }

  if (added === 0) {
    return NextResponse.json({ error: "No downloadable files permitted in selection." }, { status: 403 });
  }

  const zipBuffer = await zip.generateAsync({ type: "uint8array" });

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
    "Bulk ZIP downloaded",
    `Downloaded ${added} permitted file(s)`,
    nowIso()
  );

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(session.project.name)}-documents.zip"`,
    },
  });
}
