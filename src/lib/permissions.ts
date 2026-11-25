export const PERMISSION_LEVELS = [
  "none",
  "fence",
  "view",
  "encrypted",
  "pdf",
  "original",
  "upload",
  "manage",
] as const;

export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

export const PERMISSION_LABELS: Record<PermissionLevel, { label: string; description: string }> = {
  none: { label: "No access", description: "Hidden from group" },
  fence: { label: "Fence", description: "View only inside privacy fence mask" },
  view: { label: "View", description: "Watermarked on-screen preview only" },
  encrypted: { label: "Encrypted", description: "Download protected offline copy" },
  pdf: { label: "PDF", description: "Download & print watermarked PDF" },
  original: { label: "Original", description: "Download original file format" },
  upload: { label: "Upload", description: "Folder upload (disabled in Read-Only Mirror)" },
  manage: { label: "Manage", description: "Manage permissions, notes & metadata" },
};

export function permissionRank(level: string): number {
  const idx = PERMISSION_LEVELS.indexOf(level as PermissionLevel);
  return idx === -1 ? 0 : idx;
}

export function resolveEffectivePermission(
  nodeId: string,
  groupRole: string,
  nodeMap: Map<string, { id: string; driveFileId: string; parentDriveId: string | null }>,
  driveIdToNodeId: Map<string, string>,
  permMap: Map<string, string>
): PermissionLevel {
  if (groupRole === "Administrator") {
    return "manage";
  }

  let currentId: string | undefined = nodeId;
  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const explicit = permMap.get(currentId);
    if (explicit) {
      return explicit as PermissionLevel;
    }
    const node = nodeMap.get(currentId);
    if (!node?.parentDriveId) break;
    currentId = driveIdToNodeId.get(node.parentDriveId);
  }
  return "view";
}

export function canAccessNode(level: PermissionLevel): boolean {
  return level !== "none";
}

export function isFenceRequired(level: PermissionLevel): boolean {
  return level === "fence";
}

export function canDownloadPdf(level: PermissionLevel): boolean {
  return permissionRank(level) >= permissionRank("pdf");
}

export function canDownloadOriginal(level: PermissionLevel): boolean {
  return permissionRank(level) >= permissionRank("original");
}

export function canPrintDocument(level: PermissionLevel): boolean {
  return permissionRank(level) >= permissionRank("pdf");
}
