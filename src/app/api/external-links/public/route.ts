import { NextRequest, NextResponse } from "next/server";
import { getDb, plain } from "@/lib/db";
import { getNodeContentBuffer } from "@/lib/drive-sync";
import { mapProject } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const stream = req.nextUrl.searchParams.get("stream") === "1";
  const passcode = req.nextUrl.searchParams.get("passcode") || "";

  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const db = await getDb();
  const link = (await db
    .prepare(
      `SELECT el.*, d.name as nodeName, d.dotIndex, d.driveFileId, d.mimeType, d.category, d.sizeBytes, d.pageCount, d.demoContentText
       FROM external_links el
       JOIN drive_nodes d ON d.id = el.nodeId
       WHERE el.token = ?`
    )
    .get(token)) as Record<string, unknown> | undefined;

  if (!link || link.enabled !== 1) {
    return NextResponse.json({ error: "This external link is inactive or no longer exists." }, { status: 404 });
  }

  if (link.requirePasscode === 1 && String(link.passcode || "") !== passcode) {
    return NextResponse.json({ error: "Passcode required", requirePasscode: true }, { status: 401 });
  }

  const projectRow = (await db.prepare("SELECT * FROM projects WHERE id = ?").get(String(link.projectId))) as Record<string, unknown> | undefined;
  if (!projectRow) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const project = mapProject(plain(projectRow));

  if (stream) {
    const { buffer, contentType, filename } = await getNodeContentBuffer(
      project,
      {
        driveFileId: String(link.driveFileId),
        name: String(link.nodeName),
        mimeType: String(link.mimeType),
        dotIndex: String(link.dotIndex),
        category: String(link.category),
        sizeBytes: Number(link.sizeBytes || 0),
        pageCount: Number(link.pageCount || 4),
        demoContentText: link.demoContentText ? String(link.demoContentText) : null,
      },
      true
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  }

  await db.prepare("UPDATE external_links SET visitsCount = visitsCount + 1 WHERE id = ?").run(String(link.id));

  return NextResponse.json({
    projectName: project.name,
    nodeName: String(link.nodeName),
    dotIndex: String(link.dotIndex),
    category: String(link.category),
    requirePasscode: link.requirePasscode === 1,
    visitsCount: Number(link.visitsCount || 0) + 1,
  });
}
