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
