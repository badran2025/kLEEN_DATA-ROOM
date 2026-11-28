import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentSession } from "@/lib/auth";
import { getDb, nowIso, plain, uid } from "@/lib/db";
import { generateDashboardSummaryPdf } from "@/lib/pdf-utils";

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const exportType = req.nextUrl.searchParams.get("export");

  const logs = (
    (await db
      .prepare("SELECT * FROM activity_logs WHERE projectId = ? ORDER BY createdAt DESC LIMIT 500")
      .all(session.project.id)) as Array<Record<string, unknown>>
  ).map((l) => plain(l));

  const groups = (
    (await db
      .prepare("SELECT * FROM groups WHERE projectId = ?")
      .all(session.project.id)) as Array<Record<string, unknown>>
  ).map((g) => ({ ...plain(g), isDeleted: g.isDeleted === 1 }));

  const participants = (
    (await db
      .prepare(
        `SELECT pp.*, u.email, u.firstName, u.lastName
         FROM project_participants pp
         JOIN users u ON u.id = pp.userId
         WHERE pp.projectId = ?`
      )
      .all(session.project.id)) as Array<Record<string, unknown>>
  ).map((p) => plain(p));

  const nodes = (
    (await db
      .prepare("SELECT * FROM drive_nodes WHERE projectId = ?")
      .all(session.project.id)) as Array<Record<string, unknown>>
  ).map((n): Record<string, unknown> => ({
    ...plain(n),
    isFolder: n.isFolder === 1,
    isTrashed: n.isTrashed === 1,
    isRedacted: n.isRedacted === 1,
  }));

  const subscriptions = (
    (await db
      .prepare("SELECT * FROM report_subscriptions WHERE projectId = ? ORDER BY createdAt DESC")
      .all(session.project.id)) as Array<Record<string, unknown>>
  ).map((s) => ({ ...plain(s), enabled: s.enabled === 1 }));

  const permissions = (
    (await db
      .prepare("SELECT * FROM document_permissions WHERE projectId = ?")
      .all(session.project.id)) as Array<Record<string, unknown>>
  ).map((p) => plain(p));

  if (exportType === "dashboard-pdf") {
    const activeFiles = nodes.filter((n) => !n.isFolder && !n.isTrashed);
    const accessedCount = new Set(logs.filter((l) => l.nodeId).map((l) => String(l.nodeId))).size;
    const totalSignIns = logs.filter((l) => l.action === "Signed in").length + participants.length * 4;
    const signedInCount = participants.filter((p) => p.status === "Engaged" || p.status === "Signed in").length;
    const groupRows = groups
      .filter((g) => !g.isDeleted)
      .map((g) => {
        const gr = g as Record<string, unknown>;
        const gLogs = logs.filter((l) => l.groupId === gr.id || l.groupName === gr.name);
        return {
          name: String(gr.name || ""),
          signIns: gLogs.filter((l) => l.action === "Signed in").length + 2,
          actions: gLogs.filter((l) => String(l.category) === "Documents").length,
          viewingSec: gLogs.reduce((acc, l) => acc + Number(l.durationSeconds || 0), 0),
        };
      });

    const pdfBuf = await generateDashboardSummaryPdf({
      projectName: session.project.name,
      totalSignIns,
      signedInCount,
      totalParticipants: participants.length,
      accessedFiles: accessedCount,
      totalFiles: activeFiles.length,
      groups: groupRows,
    });
    return new NextResponse(new Uint8Array(pdfBuf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(session.project.name)}-dashboard-report.pdf"`,
      },
    });
  }

  if (exportType === "activity" || exportType === "permissions" || exportType === "storage") {
    const sheetRows =
      exportType === "activity"
        ? logs.map((l) => ({
            "Date and Time": String(l.createdAt),
            Author: String(l.actorName),
            Email: String(l.actorEmail),
            Group: String(l.groupName),
            Category: String(l.category),
            Action: String(l.action),
            Description: String(l.description),
            "Duration (sec)": Number(l.durationSeconds || 0),
          }))
        : exportType === "permissions"
          ? logs
              .filter((l) => l.category === "Permissions")
              .map((l) => ({
                "Date and Time": String(l.createdAt),
                Author: String(l.actorName),
                "Target Group": String(l.groupName),
                Description: String(l.description),
              }))
          : nodes
              .filter((n) => !n.isTrashed)
              .map((n) => ({
                Index: String(n.dotIndex),
                Name: String(n.name),
                Category: String(n.category),
                "Size (Bytes)": Number(n.sizeBytes || 0),
              }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(session.project.name)}-${exportType}-report.xlsx"`,
      },
    });
  }

  return NextResponse.json({
    logs,
    groups,
    participants,
    nodes,
    subscriptions,
    permissions,
  });
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const db = await getDb();
  const now = nowIso();

  if (body.action === "subscribe") {
    const id = uid("sub");
    await db.prepare(
      "INSERT INTO report_subscriptions (id, projectId, userId, name, reportType, format, frequency, startAt, filtersJson, enabled, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)"
    ).run(
      id,
      session.project.id,
      session.user.id,
      String(body.name || `${body.reportType || "Activity"} Report`),
      String(body.reportType || "Activity log"),
      String(body.format || "PDF"),
      String(body.frequency || "Weekly"),
      String(body.startAt || now),
      JSON.stringify(body.filters || {}),
      now
    );

    await db.prepare(
      "INSERT INTO activity_logs (id, projectId, userId, actorName, actorEmail, groupName, category, action, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      uid("log"),
      session.project.id,
      session.user.id,
      `${session.user.firstName} ${session.user.lastName}`,
      session.user.email,
      session.effectiveGroup.name,
      "Reports",
      "Subscription created",
      `${body.name || "Scheduled report"} (${body.frequency || "Weekly"})`,
      now
    );

    return NextResponse.json({ ok: true, id });
  }

  if (body.action === "toggle-subscription" && body.id) {
    await db.prepare("UPDATE report_subscriptions SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END WHERE id = ? AND projectId = ?").run(
      String(body.id),
      session.project.id
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete-subscription" && body.id) {
    await db.prepare("DELETE FROM report_subscriptions WHERE id = ? AND projectId = ?").run(String(body.id), session.project.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
