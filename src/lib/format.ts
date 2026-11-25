export function formatBytes(bytes: number, unit?: "MB" | "GB"): string {
  if (unit === "GB") {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (unit === "MB") {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes === 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0s";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function compareDotIndex(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10));
  const pb = b.split(".").map((n) => parseInt(n, 10));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = Number.isNaN(pa[i]) ? -1 : pa[i];
    const vb = Number.isNaN(pb[i]) ? -1 : pb[i];
    if (va !== vb) return va - vb;
  }
  return a.localeCompare(b, undefined, { numeric: true });
}

export const FILE_TYPE_CATEGORIES: Record<string, string[]> = {
  Spreadsheets: ["XLS", "XLSX", "XLSM", "CSV"],
  Documents: ["PDF", "DOC", "DOCX", "TXT", "RTF"],
  Images: ["JPG", "JPEG", "JPE", "GIF", "BMP", "PNG", "TIF", "TIFF", "SVG"],
  Presentations: ["PPT", "PPTX"],
  Video: ["FLV", "MP4", "MOV", "AVI", "WMV", "M4V", "MPG", "MXF", "MKV", "3GP", "MPEG", "TS", "ASF", "F4V", "WEBM"],
  "Web files": ["HTM", "HTML", "MHT", "XML"],
  Emails: ["EML", "MSG"],
  "Additional formats": ["DWG", "OTHER"],
};

export function classifyFile(name: string, mimeType: string, isFolder: boolean): { extension: string; category: string } {
  if (isFolder || mimeType === "application/vnd.google-apps.folder") {
    return { extension: "folder", category: "Folder" };
  }
  if (mimeType === "application/vnd.google-apps.document") {
    return { extension: "docx", category: "Documents" };
  }
  if (mimeType === "application/vnd.google-apps.spreadsheet") {
    return { extension: "xlsx", category: "Spreadsheets" };
  }
  if (mimeType === "application/vnd.google-apps.presentation") {
    return { extension: "pptx", category: "Presentations" };
  }

  const parts = name.split(".");
  const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
  const upper = ext.toUpperCase();

  if (upper === "PDF" || mimeType === "application/pdf") {
    return { extension: "pdf", category: "PDF" };
  }
  for (const [cat, exts] of Object.entries(FILE_TYPE_CATEGORIES)) {
    if (exts.includes(upper)) {
      return { extension: ext || "file", category: cat };
    }
  }
  return { extension: ext || "file", category: "Additional formats" };
}
