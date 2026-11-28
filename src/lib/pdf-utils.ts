import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

export interface WatermarkConfig {
  enabled: boolean;
  color: string;
  opacity: number;
  position: string;
  lines: string[];
}

export async function generateDemoPdfBuffer(options: {
  title: string;
  dotIndex: string;
  category: string;
  sizeBytes: number;
  pageCount: number;
  bodyText?: string | null;
}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const totalPages = Math.max(1, Math.min(options.pageCount || 3, 12));
  const safeTitle = options.title.replace(/[^\x20-\x7E]/g, " ").trim() || "Kleen Document";
  const bodyLines = (
    options.bodyText ||
    `Confidential Virtual Data Room Document\n\nIndex: ${options.dotIndex}\nCategory: ${options.category}\n\nThis document is mirrored directly from Google Drive into Kleen Data Room in Read-Only Sync Mode.\n\nFinancial, corporate, legal, and operational disclosures contained herein are provided strictly under Non-Disclosure Agreement (NDA) and Terms of Access.`
  ).split("\n");

  for (let i = 0; i < totalPages; i++) {
    const page = doc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    // Header bar
    page.drawRectangle({
      x: 40,
      y: height - 70,
      width: width - 80,
      height: 36,
      color: rgb(0.96, 0.96, 0.97),
    });

    page.drawText(`KLEEN DATA ROOM  |  ${options.dotIndex}`, {
      x: 52,
      y: height - 56,
      size: 11,
      font: boldFont,
      color: rgb(0.05, 0.45, 0.95),
    });

    page.drawText(`Page ${i + 1} of ${totalPages}`, {
      x: width - 120,
      y: height - 56,
      size: 9,
      font,
      color: rgb(0.45, 0.45, 0.5),
    });

    // Document Title
    page.drawText(safeTitle.slice(0, 72), {
      x: 52,
      y: height - 115,
      size: 16,
      font: boldFont,
      color: rgb(0.11, 0.11, 0.12),
    });

    page.drawLine({
      start: { x: 52, y: height - 126 },
      end: { x: width - 52, y: height - 126 },
      thickness: 0.75,
      color: rgb(0.85, 0.85, 0.88),
    });

    let cursorY = height - 155;
    if (i === 0) {
      for (const rawLine of bodyLines) {
        const clean = rawLine.replace(/[^\x20-\x7E]/g, " ");
        if (!clean.trim()) {
          cursorY -= 12;
          continue;
        }
        const wrapped = wrapText(clean, 78);
        for (const w of wrapped) {
          if (cursorY < 80) break;
          page.drawText(w, {
            x: 52,
            y: cursorY,
            size: 11,
            font,
            color: rgb(0.2, 0.2, 0.22),
          });
          cursorY -= 18;
        }
      }
    } else {
      page.drawText(`Section ${i + 1} — Supporting Schedules & Exhibits`, {
        x: 52,
        y: cursorY,
        size: 13,
        font: boldFont,
        color: rgb(0.15, 0.15, 0.18),
      });
      cursorY -= 28;
      for (let row = 0; row < 10; row++) {
        page.drawRectangle({
          x: 52,
          y: cursorY - 6,
          width: width - 104,
          height: 24,
          color: row % 2 === 0 ? rgb(0.97, 0.97, 0.98) : rgb(1, 1, 1),
          borderColor: rgb(0.9, 0.9, 0.92),
          borderWidth: 0.5,
        });
        page.drawText(`Line Item ${i}.${row + 1} — Verified Schedule Metric`, {
          x: 64,
          y: cursorY + 2,
          size: 10,
          font,
          color: rgb(0.25, 0.25, 0.28),
        });
        page.drawText(`SAR ${((i + 1) * (row + 2) * 14500).toLocaleString("en-US")}.00`, {
          x: width - 170,
          y: cursorY + 2,
          size: 10,
          font: boldFont,
          color: rgb(0.11, 0.11, 0.12),
        });
        cursorY -= 26;
      }
    }
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export async function applyWatermarkToPdf(pdfBytes: Buffer | Uint8Array, wm: WatermarkConfig): Promise<Buffer> {
  if (!wm.enabled || wm.lines.length === 0) {
    return Buffer.from(pdfBytes);
  }
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const colorMap: Record<string, ReturnType<typeof rgb>> = {
    gray: rgb(0.45, 0.45, 0.48),
    red: rgb(0.85, 0.18, 0.18),
    blue: rgb(0.05, 0.45, 0.95),
  };
  const color = colorMap[wm.color] || colorMap.gray;
  const opacity = Math.max(0.08, Math.min(0.85, (wm.opacity || 45) / 100));
  const safeLines = wm.lines.map((l) => l.replace(/[^\x20-\x7E]/g, " ").trim()).filter(Boolean);

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const positions =
      wm.position === "corner"
        ? [{ x: 36, y: 36 }]
        : wm.position === "grid"
          ? [
              { x: 60, y: height * 0.72 },
              { x: width * 0.52, y: height * 0.72 },
              { x: 60, y: height * 0.36 },
              { x: width * 0.52, y: height * 0.36 },
            ]
          : [
              { x: 55, y: height * 0.75 },
              { x: width * 0.48, y: height * 0.75 },
              { x: 55, y: height * 0.45 },
              { x: width * 0.48, y: height * 0.45 },
              { x: 55, y: height * 0.16 },
              { x: width * 0.48, y: height * 0.16 },
            ];

    for (const pos of positions) {
      safeLines.forEach((line, idx) => {
        page.drawText(line, {
          x: pos.x,
          y: pos.y - idx * 13,
          size: 10,
          font,
          color,
          opacity,
          rotate: wm.position === "corner" ? degrees(0) : degrees(32),
        });
      });
    }
  }

  return Buffer.from(await doc.save());
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generateAcceptedTermsPdf(options: {
  projectName: string;
  termsTitle: string;
  termsType: string;
  acceptedByName: string;
  acceptedByEmail: string;
  company: string;
  groupName: string;
  groupRole: string;
  publishedAt: string;
  acceptedAt: string;
  content: string;
}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([595.28, 841.89]);
  let { width, height } = page.getSize();

  const drawHeader = (pg: typeof page, pageNum: number) => {
    pg.drawRectangle({ x: 36, y: height - 66, width: width - 72, height: 36, color: rgb(0.95, 0.96, 0.98) });
    pg.drawText("KLEEN DATA ROOM  |  EXECUTED TERMS OF ACCESS RECORD", {
      x: 48,
      y: height - 52,
      size: 10,
      font: bold,
      color: rgb(0.05, 0.45, 0.95),
    });
    pg.drawText(`Page ${pageNum}`, {
      x: width - 85,
      y: height - 52,
      size: 9,
      font,
      color: rgb(0.45, 0.45, 0.5),
    });
  };

  drawHeader(page, 1);

  // Acceptance Certificate Box
  page.drawRectangle({
    x: 36,
    y: height - 235,
    width: width - 72,
    height: 152,
    color: rgb(0.98, 0.98, 0.99),
    borderColor: rgb(0.84, 0.86, 0.9),
    borderWidth: 1,
  });

  const safe = (v: string) => v.replace(/[^\x20-\x7E]/g, " ").trim() || "-";
  const certRows: Array<[string, string]> = [
    ["Agreement Title:", safe(options.termsTitle)],
    ["Agreement Type:", safe(options.termsType)],
    ["Data Room Project:", safe(options.projectName)],
    ["Accepted By:", `${safe(options.acceptedByName)} (${safe(options.acceptedByEmail)})`],
    ["Company / Group:", `${safe(options.company)}  |  ${safe(options.groupName)} (${safe(options.groupRole)})`],
    ["Published On:", safe(options.publishedAt)],
    ["Accepted On:", `${safe(options.acceptedAt)}  (Electronically Confirmed)`],
  ];

  let cy = height - 104;
  for (const [k, v] of certRows) {
    page.drawText(k, { x: 48, y: cy, size: 9.5, font: bold, color: rgb(0.25, 0.25, 0.28) });
    page.drawText(v.slice(0, 74), { x: 165, y: cy, size: 9.5, font, color: rgb(0.1, 0.1, 0.12) });
    cy -= 19;
  }

  let y = height - 262;
  let pageCount = 1;
  page.drawText("Full Agreement Text (English Reference):", {
    x: 36,
    y,
    size: 11,
    font: bold,
    color: rgb(0.1, 0.1, 0.12),
  });
  y -= 20;

  const paragraphs = options.content.split(/\r?\n/);
  for (const rawP of paragraphs) {
    const ascii = rawP.replace(/[^\x20-\x7E]/g, "").trim();
    if (!ascii) {
      if (rawP.trim().length > 0) continue; // skip non-ASCII-only lines for WinAnsi pdf-lib font
      y -= 8;
      continue;
    }
    const wrapped = wrapText(ascii, 88);
    for (const line of wrapped) {
      if (y < 52) {
        pageCount++;
        page = doc.addPage([595.28, 841.89]);
        ({ width, height } = page.getSize());
        drawHeader(page, pageCount);
        y = height - 92;
      }
      page.drawText(line, { x: 36, y, size: 9.5, font, color: rgb(0.18, 0.18, 0.2) });
      y -= 14;
    }
  }

  return Buffer.from(await doc.save());
}

export async function generateDashboardSummaryPdf(options: {
  projectName: string;
  totalSignIns: number;
  signedInCount: number;
  totalParticipants: number;
  accessedFiles: number;
  totalFiles: number;
  groups: Array<{ name: string; signIns: number; actions: number; viewingSec: number }>;
}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const p1 = doc.addPage([841.89, 595.28]); // Landscape A4 slide 1
  const { width, height } = p1.getSize();
  p1.drawRectangle({ x: 0, y: height - 72, width, height: 72, color: rgb(0.05, 0.45, 0.95) });
  p1.drawText(`KLEEN DATA ROOM — ACTIVITY REPORT (${options.projectName})`, {
    x: 40,
    y: height - 44,
    size: 16,
    font: bold,
    color: rgb(1, 1, 1),
  });

  p1.drawText("Slide 1: Activity by Groups", { x: 40, y: height - 110, size: 14, font: bold, color: rgb(0.1, 0.1, 0.12) });
  p1.drawText(
    `Total Sign-ins: ${options.totalSignIns}   |   Signed-in Participants: ${options.signedInCount}/${options.totalParticipants}   |   Accessed Files: ${options.accessedFiles}/${options.totalFiles}`,
    { x: 40, y: height - 135, size: 11, font, color: rgb(0.3, 0.3, 0.35) }
  );

  let rowY = height - 180;
  p1.drawText("Group Name", { x: 40, y: rowY, size: 11, font: bold, color: rgb(0.1, 0.1, 0.12) });
  p1.drawText("Sign-ins", { x: 340, y: rowY, size: 11, font: bold, color: rgb(0.1, 0.1, 0.12) });
  p1.drawText("File Actions", { x: 470, y: rowY, size: 11, font: bold, color: rgb(0.1, 0.1, 0.12) });
  p1.drawText("Viewing Time (min)", { x: 610, y: rowY, size: 11, font: bold, color: rgb(0.1, 0.1, 0.12) });
  rowY -= 22;

  for (const g of options.groups.slice(0, 12)) {
    p1.drawText(g.name.replace(/[^\x20-\x7E]/g, " ").slice(0, 38), { x: 40, y: rowY, size: 10.5, font, color: rgb(0.2, 0.2, 0.24) });
    p1.drawText(String(g.signIns), { x: 340, y: rowY, size: 10.5, font, color: rgb(0.2, 0.2, 0.24) });
    p1.drawText(String(g.actions), { x: 470, y: rowY, size: 10.5, font, color: rgb(0.2, 0.2, 0.24) });
    p1.drawText(String(Math.round(g.viewingSec / 60)), { x: 610, y: rowY, size: 10.5, font, color: rgb(0.2, 0.2, 0.24) });
    rowY -= 22;
  }

  return Buffer.from(await doc.save());
}
