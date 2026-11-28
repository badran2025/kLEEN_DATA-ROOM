"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Folder,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Download,
  ListOrdered,
  MoreHorizontal,
  Eye,
  Search,
  SlidersHorizontal,
  Columns3,
  Clock,
  Sparkles,
  Star,
  ArrowLeft,
  ExternalLink,
  Link2,
  MessageSquareText,
  FileSignature,
  Check,
  X,
  ChevronsDownUp,
  Shield,
} from "lucide-react";
import type { DriveNodeDto, GroupDto, ProjectDto, UserDto } from "@/lib/types";
import { FILE_TYPE_CATEGORIES, formatBytes, formatDateShort } from "@/lib/format";
import { canDownloadOriginal, canDownloadPdf, type PermissionLevel } from "@/lib/permissions";
import { KleenViewer } from "./KleenViewer";

type DocSubTab = "all" | "notes" | "shared-links" | "signatures" | "recent" | "uploads" | "favorites";

interface NoteRow {
  id: string;
  nodeId: string;
  content: string;
  noteType: string;
  firstName: string;
  lastName: string;
  nodeName: string;
  nodeIndex: string;
  createdAt: string;
  updatedAt: string;
}

interface ExtLinkRow {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeIndex: string;
  token: string;
  accessType: string;
  visitsCount: number;
  feedbackCount: number;
  enabled: boolean;
  createdAt: string;
}

interface SigRow {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeIndex: string;
  title: string;
  status: string;
  signersJson: string;
  createdAt: string;
}

export function DocumentsWorkspace({
  subTab,
  onChangeSubTab,
  project,
  user,
  groups,
  isAdmin,
  isTrueAdmin,
  onViewAs,
  onNavigateTab,
  onRefreshSession,
}: {
  subTab: DocSubTab;
  onChangeSubTab: (t: DocSubTab) => void;
  project: ProjectDto;
  user: UserDto;
  groups: GroupDto[];
  isAdmin: boolean;
  isTrueAdmin: boolean;
  onViewAs: (groupId: string | null) => void;
  onNavigateTab: (tab: string) => void;
  onRefreshSession: () => void;
}) {
  const [nodes, setNodes] = useState<DriveNodeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [currentFolderDriveId, setCurrentFolderDriveId] = useState<string | null>(null);
  const [expandedTreeIds, setExpandedTreeIds] = useState<Set<string>>(new Set(["demo-f4", "demo-f4-3"]));
  const [quickAccessOpen, setQuickAccessOpen] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Search & Filter states
  const [searchText, setSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [addedFilter, setAddedFilter] = useState<"" | "today" | "week">("");
  const [viewedFilter, setViewedFilter] = useState<"" | "viewed" | "unviewed">("");
  const [selectedExts, setSelectedExts] = useState<Set<string>>(new Set());
  const [searchArea, setSearchArea] = useState<"titles" | "content" | "both">("both");

  // Column customization
  const [showColMenu, setShowColMenu] = useState(false);
  const [foldersFirst, setFoldersFirst] = useState(true);
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>({
    size: true,
    addedOn: true,
    notes: true,
    viewedOn: false,
    permission: false,
    id: false,
  });

  // Popovers & Modals
  const [showIndexMenu, setShowIndexMenu] = useState(false);
  const [showCustomIndexModal, setShowCustomIndexModal] = useState(false);
  const [customIndexContents, setCustomIndexContents] = useState<"all" | "files" | "folders">("all");
  const [customIndexRecycle, setCustomIndexRecycle] = useState(true);
  const [customIndexFrom, setCustomIndexFrom] = useState("");
  const [showRebuildConfirm, setShowRebuildConfirm] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showViewAsModal, setShowViewAsModal] = useState(false);
  const [viewAsSearch, setViewAsSearch] = useState("");
  const [viewAsTarget, setViewAsTarget] = useState<string | null>(null);
  const [contextNode, setContextNode] = useState<DriveNodeDto | null>(null);

  // Sub-tab data
  const [allNotes, setAllNotes] = useState<NoteRow[]>([]);
  const [extLinks, setExtLinks] = useState<ExtLinkRow[]>([]);
  const [signatures, setSignatures] = useState<SigRow[]>([]);

  // Active Viewer Document
  const [viewerNode, setViewerNode] = useState<DriveNodeDto | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }

  async function loadDocuments() {
    setLoading(true);
    const res = await fetch("/api/documents");
    if (res.ok) {
      const data = await res.json();
      setNodes(data.nodes || []);
    }
    setLoading(false);
  }

  async function loadSecondaryTabs() {
    const [notesRes, linksRes] = await Promise.all([fetch("/api/notes"), fetch("/api/external-links")]);
    if (notesRes.ok) {
      const d = await notesRes.json();
      setAllNotes(d.notes || []);
    }
    if (linksRes.ok) {
      const d = await linksRes.json();
      setExtLinks(d.links || []);
      setSignatures(d.signatures || []);
    }
  }

  useEffect(() => {
    loadDocuments();
    loadSecondaryTabs();
  }, [project.id]);

  async function handleSyncDrive() {
    setSyncing(true);
    const res = await fetch("/api/drive/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync" }),
    });
    const data = await res.json();
    setSyncing(false);
    if (res.ok) {
      showToast(`Google Drive synced (${data.syncedCount} items)`);
      await loadDocuments();
      onRefreshSession();
    } else {
      showToast(data.error || "Sync failed");
    }
  }

  async function handleRebuildIndex() {
    setShowRebuildConfirm(false);
    const res = await fetch("/api/drive/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rebuild-index" }),
    });
    if (res.ok) {
      showToast("Project index rebuilt cleanly");
      await loadDocuments();
    }
  }

  async function handleBulkDownload() {
    const res = await fetch("/api/documents/bulk-download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodeIds: Array.from(selectedIds),
        parentDriveId: currentFolderDriveId,
        format: "pdf",
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || "Download blocked by group permissions");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}-documents.zip`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Downloaded ZIP archive");
  }

  async function toggleFavorite(ids: string[]) {
    await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeIds: ids }),
    });
    await loadDocuments();
  }

  async function createExternalLink(nodeId: string) {
    const res = await fetch("/api/external-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create-link", nodeId }),
    });
    if (res.ok) {
      showToast("External link created");
      await loadSecondaryTabs();
      onChangeSubTab("shared-links");
    }
  }

  async function requestSignature(n: DriveNodeDto) {
    const res = await fetch("/api/external-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create-signature",
        nodeId: n.id,
        title: `Sign: ${n.name}`,
        signers: [user.email],
      }),
    });
    if (res.ok) {
      showToast("Signature request created");
      await loadSecondaryTabs();
      onChangeSubTab("signatures");
    }
  }

  const nodeByDriveId = useMemo(() => new Map(nodes.map((n) => [n.driveFileId, n])), [nodes]);

  const currentFolder = currentFolderDriveId ? nodeByDriveId.get(currentFolderDriveId) || null : null;

  const breadcrumbChain = useMemo(() => {
    const chain: DriveNodeDto[] = [];
    let cursor = currentFolder;
    let guard = 0;
    while (cursor && guard < 12) {
      chain.unshift(cursor);
      cursor = cursor.parentDriveId ? nodeByDriveId.get(cursor.parentDriveId) || null : null;
      guard++;
    }
    return chain;
  }, [currentFolder, nodeByDriveId]);

  const folderTree = useMemo(() => nodes.filter((n) => n.isFolder), [nodes]);

  const displayedRows = useMemo(() => {
    let list = nodes;

    if (subTab === "recent") {
      list = list.filter((n) => !n.isFolder && n.viewedByMe);
    } else if (subTab === "uploads") {
      const weekAgo = Date.now() - 1000 * 60 * 60 * 24 * 14;
      list = list.filter((n) => !n.isFolder && new Date(n.driveModifiedAt).getTime() >= weekAgo);
    } else if (subTab === "favorites") {
      list = list.filter((n) => n.isFavorite);
    } else if (searchText.trim() || selectedExts.size > 0 || addedFilter || viewedFilter) {
      // Global or scoped filter
      list = list.filter((n) => {
        if (searchText.trim()) {
          const q = searchText.toLowerCase();
          if (!n.name.toLowerCase().includes(q) && !n.dotIndex.toLowerCase().includes(q)) return false;
        }
        if (selectedExts.size > 0) {
          if (n.isFolder && !selectedExts.has("FOLDER")) return false;
          if (!n.isFolder && !selectedExts.has(n.extension.toUpperCase())) return false;
        }
        if (viewedFilter === "viewed" && !n.viewedByMe) return false;
        if (viewedFilter === "unviewed" && n.viewedByMe) return false;
        if (addedFilter === "today") {
          const d = new Date(n.driveModifiedAt).toDateString();
          if (d !== new Date().toDateString()) return false;
        } else if (addedFilter === "week") {
          if (Date.now() - new Date(n.driveModifiedAt).getTime() > 1000 * 60 * 60 * 24 * 7) return false;
        }
        return true;
      });
    } else {
      list = list.filter((n) => (n.parentDriveId || null) === currentFolderDriveId);
    }

    return [...list].sort((a, b) => {
      if (foldersFirst && a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.dotIndex.localeCompare(b.dotIndex, undefined, { numeric: true });
    });
  }, [nodes, subTab, currentFolderDriveId, searchText, selectedExts, addedFilter, viewedFilter, foldersFirst]);

  const siblingFiles = useMemo(() => {
    if (!viewerNode) return [];
    return nodes.filter((n) => !n.isFolder && (n.parentDriveId || null) === (viewerNode.parentDriveId || null));
  }, [nodes, viewerNode]);

  function renderFileIcon(n: DriveNodeDto) {
    if (n.isFolder) return <Folder className="h-4.5 w-4.5 shrink-0 text-[#007AFF]" />;
    if (n.category === "Spreadsheets") return <FileSpreadsheet className="h-4.5 w-4.5 shrink-0 text-emerald-500" />;
    if (n.category === "Images") return <ImageIcon className="h-4.5 w-4.5 shrink-0 text-purple-500" />;
    if (n.category === "PDF") return <FileText className="h-4.5 w-4.5 shrink-0 text-rose-500" />;
    return <FileText className="h-4.5 w-4.5 shrink-0 text-[var(--apple-text-secondary)]" />;
  }

  function renderTreeBranch(parentDriveId: string | null, depth = 0) {
    const children = folderTree.filter((f) => (f.parentDriveId || null) === parentDriveId);
    if (children.length === 0) return null;
    return children.map((folder) => {
      const hasChildren = folderTree.some((f) => f.parentDriveId === folder.driveFileId);
      const isExpanded = expandedTreeIds.has(folder.driveFileId);
      const isSelected = currentFolderDriveId === folder.driveFileId && subTab === "all";
      return (
        <div key={folder.id}>
          <div
            style={{ paddingLeft: `${8 + depth * 14}px` }}
            className={`group flex items-center gap-1 rounded-lg py-1.5 pr-2 text-xs transition ${
              isSelected
                ? "bg-[var(--apple-selected)] font-medium text-[var(--apple-accent)]"
                : "text-[var(--apple-text-secondary)] hover:bg-[var(--apple-hover)] hover:text-[var(--apple-text)]"
            }`}
          >
            <button
              type="button"
              onClick={() =>
                setExpandedTreeIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(folder.driveFileId)) next.delete(folder.driveFileId);
                  else next.add(folder.driveFileId);
                  return next;
                })
              }
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                hasChildren ? "opacity-80 hover:bg-black/10 dark:hover:bg-white/10" : "opacity-0 pointer-events-none"
              }`}
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
            <button
              type="button"
              onClick={() => {
                onChangeSubTab("all");
                setCurrentFolderDriveId(folder.driveFileId);
                setSelectedIds(new Set());
              }}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
            >
              <Folder className="h-3.5 w-3.5 shrink-0 text-[#007AFF]" />
              <span dir="auto" className="truncate">
                {folder.name}
              </span>
            </button>
          </div>
          {isExpanded && hasChildren && <div>{renderTreeBranch(folder.driveFileId, depth + 1)}</div>}
        </div>
      );
    });
  }

  // Secondary sub-tabs (Notes / External links / Signatures)
  if (subTab === "notes") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Document Notes</h2>
            <p className="text-xs text-[var(--apple-text-secondary)]">
              Private and shared annotations linked to mirrored Google Drive files.
            </p>
          </div>
        </div>
        <div className="apple-card overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--apple-border)] bg-[var(--apple-bg)]/60 text-[11px] font-semibold text-[var(--apple-text-secondary)]">
              <tr>
                <th className="px-4 py-3">Index</th>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Updated by</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--apple-border)]">
              {allNotes.map((n) => (
                <tr key={n.id} className="hover:bg-[var(--apple-hover)]">
                  <td className="px-4 py-3 tabular-nums font-medium">{n.nodeIndex}</td>
                  <td dir="auto" className="px-4 py-3 font-medium">
                    {n.nodeName}
                  </td>
                  <td dir="auto" className="px-4 py-3 text-[var(--apple-text-secondary)]">
                    {n.content}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[var(--apple-selected)] px-2 py-0.5 text-[10px] font-medium text-[var(--apple-accent)]">
                      {n.noteType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {n.firstName} {n.lastName}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[var(--apple-text-muted)]">{formatDateShort(n.createdAt)}</td>
                </tr>
              ))}
              {allNotes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[var(--apple-text-muted)]">
                    No notes recorded yet. Open any document to add annotations.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (subTab === "shared-links") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">External Links</h2>
            <p className="text-xs text-[var(--apple-text-secondary)]">
              Controlled view-only sharing links for external visitors with visit tracking.
            </p>
          </div>
        </div>
        <div className="apple-card overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--apple-border)] bg-[var(--apple-bg)]/60 text-[11px] font-semibold text-[var(--apple-text-secondary)]">
              <tr>
                <th className="px-4 py-3">Index</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Access Type</th>
                <th className="px-4 py-3">Visits</th>
                <th className="px-4 py-3">Created on</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--apple-border)]">
              {extLinks.map((l) => (
                <tr key={l.id} className="hover:bg-[var(--apple-hover)]">
                  <td className="px-4 py-3 tabular-nums">{l.nodeIndex}</td>
                  <td className="px-4 py-3 font-medium">{l.nodeName}</td>
                  <td className="px-4 py-3">{l.accessType}</td>
                  <td className="px-4 py-3 tabular-nums">{l.visitsCount}</td>
                  <td className="px-4 py-3 tabular-nums text-[var(--apple-text-muted)]">{formatDateShort(l.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch("/api/external-links", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "toggle-link", id: l.id }),
                        });
                        loadSecondaryTabs();
                      }}
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        l.enabled ? "bg-emerald-500/15 text-emerald-500" : "bg-zinc-500/15 text-zinc-400"
                      }`}
                    >
                      {l.enabled ? "Active" : "Paused"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const shareUrl = `${window.location.origin}/share/${l.token}`;
                          navigator.clipboard?.writeText(shareUrl);
                          showToast("External link copied");
                        }}
                        className="rounded-lg border border-[var(--apple-border-strong)] px-2.5 py-1 text-[11px] font-medium hover:bg-[var(--apple-bg)]"
                      >
                        Copy link
                      </button>
                      <a
                        href={`/share/${l.token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-[#007AFF] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#0066D6]"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {extLinks.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[var(--apple-text-muted)]">
                    No external links created yet. Use a document&apos;s Share menu in All Documents to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (subTab === "signatures") {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Signatures</h2>
          <p className="text-xs text-[var(--apple-text-secondary)]">
            Track document signature requests and completion status.
          </p>
        </div>
        {signatures.length === 0 ? (
          <div className="apple-card flex flex-col items-center justify-center p-12 text-center">
            <FileSignature className="mb-3 h-10 w-10 text-[#007AFF]" />
            <h3 className="text-base font-semibold">You have sent no documents for signature yet</h3>
            <p className="mt-1 max-w-md text-xs text-[var(--apple-text-secondary)]">
              1. Go to All documents · 2. Open Share &gt; Request signature · 3. Monitor signer progress here.
            </p>
            <button
              type="button"
              onClick={() => onChangeSubTab("all")}
              className="mt-4 rounded-xl bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0066D6]"
            >
              Go to all documents
            </button>
          </div>
        ) : (
          <div className="apple-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--apple-border)] bg-[var(--apple-bg)]/60 text-[11px] font-semibold text-[var(--apple-text-secondary)]">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Signers</th>
                  <th className="px-4 py-3">Created on</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--apple-border)]">
                {signatures.map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--apple-hover)]">
                    <td className="px-4 py-3 font-medium">{s.title}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          s.status === "Signed"
                            ? "bg-emerald-500/15 text-emerald-500"
                            : s.status === "Declined"
                              ? "bg-red-500/15 text-red-500"
                              : "bg-amber-500/15 text-amber-500"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--apple-text-secondary)]">
                      {(JSON.parse(s.signersJson || "[]") as string[]).join(", ")}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatDateShort(s.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {s.status === "Pending" ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch("/api/external-links", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "update-signature", id: s.id, status: "Signed" }),
                              });
                              await loadSecondaryTabs();
                              showToast(`Marked "${s.title}" as Signed`);
                            }}
                            className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-500 hover:bg-emerald-500/25"
                          >
                            Sign
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch("/api/external-links", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "update-signature", id: s.id, status: "Declined" }),
                              });
                              await loadSecondaryTabs();
                              showToast(`Marked "${s.title}" as Declined`);
                            }}
                            className="rounded-lg bg-red-500/15 px-2.5 py-1 text-[11px] font-semibold text-red-500 hover:bg-red-500/25"
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch("/api/external-links", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "update-signature", id: s.id, status: "Pending" }),
                            });
                            await loadSecondaryTabs();
                          }}
                          className="rounded-lg border border-[var(--apple-border)] px-2.5 py-1 text-[11px] text-[var(--apple-text-muted)] hover:bg-[var(--apple-bg)]"
                        >
                          Reopen
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Breadcrumb & Read-Only Mirror Notice */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => {
              onChangeSubTab("all");
              setCurrentFolderDriveId(null);
            }}
            className="font-medium text-[var(--apple-text-secondary)] hover:text-[var(--apple-text)]"
          >
            Documents
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-[var(--apple-text-muted)]" />
          <button
            type="button"
            onClick={() => {
              onChangeSubTab("all");
              setCurrentFolderDriveId(null);
            }}
            className={`font-medium ${!currentFolder ? "text-[var(--apple-text)]" : "text-[var(--apple-text-secondary)] hover:text-[var(--apple-text)]"}`}
          >
            {subTab === "recent" ? "Recently viewed" : subTab === "uploads" ? "Newly uploaded" : subTab === "favorites" ? "Favorites" : "All"}
          </button>
          {breadcrumbChain.map((b, i) => (
            <React.Fragment key={b.id}>
              <ChevronRight className="h-3.5 w-3.5 text-[var(--apple-text-muted)]" />
              <button
                type="button"
                onClick={() => setCurrentFolderDriveId(b.driveFileId)}
                className={`max-w-[180px] truncate ${
                  i === breadcrumbChain.length - 1
                    ? "font-semibold text-[var(--apple-text)]"
                    : "text-[var(--apple-text-secondary)] hover:text-[var(--apple-text)]"
                }`}
              >
                {b.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--apple-border)] bg-[var(--apple-surface)] px-2.5 py-1 text-[11px] text-[var(--apple-text-secondary)]">
          <Shield className="h-3 w-3 text-[#007AFF]" />
          Read-Only Google Drive Mirror • {project.driveRootFolderName}
        </span>
      </div>

      {/* Main Action & Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {isTrueAdmin && (
            <button
              type="button"
              onClick={handleSyncDrive}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0066D6] disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync with Drive"}
            </button>
          )}

          <button
            type="button"
            onClick={handleBulkDownload}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-2 text-xs font-medium transition hover:bg-[var(--apple-hover)]"
          >
            <Download className="h-3.5 w-3.5" />
            {selectedIds.size > 0 ? `Download (${selectedIds.size})` : "Download"}
          </button>

          {/* Project Index Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowIndexMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-2 text-xs font-medium transition hover:bg-[var(--apple-hover)]"
            >
              <ListOrdered className="h-3.5 w-3.5" />
              Project index
            </button>
            {showIndexMenu && (
              <div className="apple-glass absolute top-10 left-0 z-40 w-56 rounded-xl border border-[var(--apple-border-strong)] p-1.5 shadow-xl">
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--apple-text-muted)]">
                  Export
                </div>
                <a
                  href="/api/documents/export-index?contents=all&includeRecycle=true"
                  onClick={() => setShowIndexMenu(false)}
                  className="block rounded-lg px-2.5 py-1.5 text-xs hover:bg-[var(--apple-hover)]"
                >
                  Full project index (.xlsx)
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setShowIndexMenu(false);
                    setShowCustomIndexModal(true);
                  }}
                  className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-[var(--apple-hover)]"
                >
                  Custom project index...
                </button>
                {isTrueAdmin && (
                  <>
                    <div className="my-1 border-t border-[var(--apple-border)]" />
                    <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--apple-text-muted)]">
                      Manage
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowIndexMenu(false);
                        setShowRebuildConfirm(true);
                      }}
                      className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-[var(--apple-hover)]"
                    >
                      Rebuild index
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* More Menu (...) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMoreMenu((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] transition hover:bg-[var(--apple-hover)]"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMoreMenu && (
              <div className="apple-glass absolute top-10 left-0 z-40 w-52 rounded-xl border border-[var(--apple-border-strong)] p-1.5 text-xs shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    setShowMoreMenu(false);
                    showToast("Folder link copied");
                  }}
                  className="block w-full rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--apple-hover)]"
                >
                  Copy link
                </button>
                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      toggleFavorite(Array.from(selectedIds));
                      setShowMoreMenu(false);
                    }}
                    className="block w-full rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--apple-hover)]"
                  >
                    Toggle favorites (S)
                  </button>
                )}
                {isTrueAdmin && project.driveRootFolderId && (
                  <a
                    href={`https://drive.google.com/drive/folders/${currentFolderDriveId || project.driveRootFolderId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-[var(--apple-hover)]"
                  >
                    Open in Google Drive
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {isTrueAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      onNavigateTab("settings:google-drive");
                    }}
                    className="block w-full rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--apple-hover)]"
                  >
                    Configure Google Drive folder...
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isTrueAdmin && (
            <button
              type="button"
              onClick={() => setShowViewAsModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-2 text-xs font-medium transition hover:bg-[var(--apple-hover)]"
            >
              <Eye className="h-3.5 w-3.5" />
              View as
            </button>
          )}

          {/* Search + Filter Popover */}
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-[var(--apple-text-muted)]" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search documents..."
              className="w-56 rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] py-1.5 pr-9 pl-8 text-xs outline-none transition focus:w-72 focus:border-[#007AFF]"
            />
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              title="Filters"
              className={`absolute right-2 rounded-md p-1 transition ${
                addedFilter || viewedFilter || selectedExts.size > 0
                  ? "text-[#007AFF]"
                  : "text-[var(--apple-text-muted)] hover:text-[var(--apple-text)]"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>

            {showFilters && (
              <div className="apple-glass absolute top-10 right-0 z-40 w-80 rounded-2xl border border-[var(--apple-border-strong)] p-4 text-xs shadow-2xl">
                <div className="mb-3 flex items-center justify-between font-semibold">
                  <span>Filter Documents</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAddedFilter("");
                      setViewedFilter("");
                      setSelectedExts(new Set());
                    }}
                    className="text-[11px] font-medium text-[#007AFF]"
                  >
                    Clear all
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="mb-1 text-[11px] font-medium text-[var(--apple-text-secondary)]">Added on</div>
                    <div className="flex gap-1.5">
                      {[
                        { id: "" as const, label: "Any time" },
                        { id: "today" as const, label: "Today" },
                        { id: "week" as const, label: "Past week" },
                      ].map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => setAddedFilter(opt.id)}
                          className={`rounded-lg px-2.5 py-1 text-[11px] ${
                            addedFilter === opt.id
                              ? "bg-[#007AFF] text-white"
                              : "bg-[var(--apple-bg)] text-[var(--apple-text-secondary)]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 text-[11px] font-medium text-[var(--apple-text-secondary)]">Viewed by</div>
                    <div className="flex gap-1.5">
                      {[
                        { id: "" as const, label: "All" },
                        { id: "viewed" as const, label: "Viewed by me" },
                        { id: "unviewed" as const, label: "Not viewed by me" },
                      ].map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => setViewedFilter(opt.id)}
                          className={`rounded-lg px-2 py-1 text-[11px] ${
                            viewedFilter === opt.id
                              ? "bg-[#007AFF] text-white"
                              : "bg-[var(--apple-bg)] text-[var(--apple-text-secondary)]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 text-[11px] font-medium text-[var(--apple-text-secondary)]">File type</div>
                    <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-[var(--apple-border)] p-2">
                      {Object.entries(FILE_TYPE_CATEGORIES).map(([cat, exts]) => (
                        <div key={cat}>
                          <div className="text-[10px] font-semibold text-[var(--apple-text-muted)]">{cat}</div>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {exts.slice(0, 6).map((ext) => {
                              const active = selectedExts.has(ext);
                              return (
                                <button
                                  key={ext}
                                  type="button"
                                  onClick={() =>
                                    setSelectedExts((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(ext)) next.delete(ext);
                                      else next.add(ext);
                                      return next;
                                    })
                                  }
                                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                                    active ? "bg-[#007AFF] text-white" : "bg-[var(--apple-bg)]"
                                  }`}
                                >
                                  {ext}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 text-[11px] font-medium text-[var(--apple-text-secondary)]">Search area</div>
                    <select
                      value={searchArea}
                      onChange={(e) => setSearchArea(e.target.value as "titles" | "content" | "both")}
                      className="w-full rounded-lg border border-[var(--apple-border)] bg-[var(--apple-surface)] px-2 py-1 text-xs"
                    >
                      <option value="titles">Titles</option>
                      <option value="content">Documents&apos; content</option>
                      <option value="both">Titles and documents&apos; content</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Split Panel: Quick Access + Folder Tree | Finder Documents Table */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[270px_1fr]">
        {/* Left Tree Sidebar */}
        <div className="apple-card flex flex-col overflow-hidden p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-muted)]">
              Quick access
            </span>
            <button
              type="button"
              onClick={() => setQuickAccessOpen((v) => !v)}
              className="rounded p-1 text-[var(--apple-text-muted)] hover:bg-[var(--apple-hover)]"
              title="Toggle Quick Access"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition ${quickAccessOpen ? "" : "-rotate-90"}`} />
            </button>
          </div>

          {quickAccessOpen && (
            <div className="mb-3 space-y-0.5 border-b border-[var(--apple-border)] pb-3 text-xs">
              {[
                { id: "recent" as const, icon: Clock, label: "Recently viewed" },
                { id: "uploads" as const, icon: Sparkles, label: "Newly uploaded" },
                { id: "favorites" as const, icon: Star, label: "Favorites" },
              ].map((qa) => {
                const Icon = qa.icon;
                const active = subTab === qa.id;
                return (
                  <button
                    key={qa.id}
                    type="button"
                    onClick={() => onChangeSubTab(qa.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition ${
                      active
                        ? "bg-[var(--apple-selected)] font-medium text-[var(--apple-accent)]"
                        : "text-[var(--apple-text-secondary)] hover:bg-[var(--apple-hover)] hover:text-[var(--apple-text)]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {qa.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mb-1.5 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => {
                onChangeSubTab("all");
                setCurrentFolderDriveId(null);
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-[var(--apple-text)] hover:text-[#007AFF]"
            >
              <Folder className="h-3.5 w-3.5 text-[#007AFF]" />
              {project.name}
            </button>
            <button
              type="button"
              onClick={() => setExpandedTreeIds(new Set())}
              title="Collapse all folders"
              className="rounded p-1 text-[var(--apple-text-muted)] hover:bg-[var(--apple-hover)]"
            >
              <ChevronsDownUp className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">{renderTreeBranch(null, 0)}</div>
        </div>

        {/* Right Finder-Style Documents Table */}
        <div className="apple-card relative flex flex-col overflow-hidden">
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--apple-border)] bg-[var(--apple-selected)] px-4 py-2 text-xs">
              <div className="flex items-center gap-2 font-semibold text-[#007AFF]">
                <span>Selected: {selectedIds.size}</span>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-[11px] font-medium text-[var(--apple-text-secondary)] hover:text-[var(--apple-text)]"
                >
                  Clear
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBulkDownload}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#007AFF] px-3 py-1 font-medium text-white hover:bg-[#0066D6]"
                >
                  <Download className="h-3 w-3" /> Download
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavorite(Array.from(selectedIds))}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-1 font-medium hover:bg-[var(--apple-hover)]"
                >
                  <Star className="h-3 w-3" /> Toggle favorites
                </button>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-[var(--apple-border)] bg-[var(--apple-surface)] text-[11px] font-semibold text-[var(--apple-text-secondary)]">
                <tr>
                  <th className="w-9 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={displayedRows.length > 0 && selectedIds.size === displayedRows.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(new Set(displayedRows.map((r) => r.id)));
                        else setSelectedIds(new Set());
                      }}
                    />
                  </th>
                  <th className="w-20 px-2 py-2.5">Index</th>
                  <th className="px-3 py-2.5">Name</th>
                  {visibleCols.size && <th className="w-36 px-3 py-2.5">Size</th>}
                  {visibleCols.addedOn && <th className="w-32 px-3 py-2.5">Added on</th>}
                  {visibleCols.notes && <th className="w-16 px-3 py-2.5 text-center">Notes</th>}
                  {visibleCols.viewedOn && <th className="w-28 px-3 py-2.5">Viewed on</th>}
                  {visibleCols.permission && <th className="w-24 px-3 py-2.5">Permission</th>}
                  {visibleCols.id && <th className="w-28 px-3 py-2.5">Drive ID</th>}
                  <th className="w-12 px-2 py-2.5 text-right">
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={() => setShowColMenu((v) => !v)}
                        title="Customize columns"
                        className="rounded-lg p-1 hover:bg-[var(--apple-hover)]"
                      >
                        <Columns3 className="h-3.5 w-3.5" />
                      </button>
                      {showColMenu && (
                        <div className="apple-glass absolute top-7 right-0 z-40 w-52 rounded-xl border border-[var(--apple-border-strong)] p-2.5 text-left text-xs font-normal shadow-2xl">
                          <label className="mb-2 flex items-center justify-between border-b border-[var(--apple-border)] pb-2 font-medium">
                            <span>Folders first</span>
                            <input
                              type="checkbox"
                              checked={foldersFirst}
                              onChange={(e) => setFoldersFirst(e.target.checked)}
                            />
                          </label>
                          <div className="space-y-1.5">
                            {[
                              { key: "size", label: "Size" },
                              { key: "addedOn", label: "Added on" },
                              { key: "notes", label: "Notes" },
                              { key: "viewedOn", label: "Viewed on" },
                              { key: "permission", label: "Permission" },
                              { key: "id", label: "ID (Google Drive)" },
                            ].map((col) => (
                              <label key={col.key} className="flex items-center justify-between">
                                <span>{col.label}</span>
                                <input
                                  type="checkbox"
                                  checked={visibleCols[col.key]}
                                  onChange={(e) =>
                                    setVisibleCols((prev) => ({ ...prev, [col.key]: e.target.checked }))
                                  }
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--apple-border)]">
                {subTab === "all" && currentFolder && (
                  <tr
                    onClick={() => setCurrentFolderDriveId(currentFolder.parentDriveId)}
                    className="cursor-pointer bg-[var(--apple-bg)]/40 text-[var(--apple-text-secondary)] hover:bg-[var(--apple-hover)]"
                  >
                    <td className="px-3 py-2.5" />
                    <td className="px-2 py-2.5" />
                    <td colSpan={6} className="px-3 py-2.5 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to{" "}
                        {currentFolder.parentDriveId
                          ? nodeByDriveId.get(currentFolder.parentDriveId)?.name || project.name
                          : project.name}
                      </span>
                    </td>
                  </tr>
                )}

                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-[var(--apple-text-muted)]">
                      Loading mirrored Google Drive structure...
                    </td>
                  </tr>
                ) : displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center text-[var(--apple-text-muted)]">
                      {subTab === "favorites"
                        ? "You have no favorites yet. Star any file or folder to access it quickly here."
                        : subTab === "recent"
                          ? "No recently viewed files yet."
                          : "No files or folders match your current view."}
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((row) => {
                    const checked = selectedIds.has(row.id);
                    return (
                      <tr
                        key={row.id}
                        className={`group transition hover:bg-[var(--apple-hover)] ${
                          checked ? "bg-[var(--apple-selected)]" : ""
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(row.id);
                                else next.delete(row.id);
                                return next;
                              })
                            }
                          />
                        </td>
                        <td className="px-2 py-2.5 tabular-nums font-medium text-[var(--apple-text-secondary)]">
                          {row.dotIndex}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            {renderFileIcon(row)}
                            <button
                              type="button"
                              dir="auto"
                              onClick={() => {
                                if (row.isFolder) {
                                  onChangeSubTab("all");
                                  setCurrentFolderDriveId(row.driveFileId);
                                  setSelectedIds(new Set());
                                } else {
                                  setViewerNode(row);
                                }
                              }}
                              className="text-left font-medium text-[var(--apple-text)] hover:text-[#007AFF]"
                            >
                              {row.name}
                            </button>
                            {row.isFavorite && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                          </div>
                        </td>
                        {visibleCols.size && (
                          <td className="px-3 py-2.5 tabular-nums text-[var(--apple-text-secondary)]">
                            {row.isFolder ? (
                              <div>
                                <div>
                                  {row.subfolderCount > 0
                                    ? `${row.subfolderCount} subfolder${row.subfolderCount > 1 ? "s" : ""}`
                                    : formatBytes(row.totalBytes)}
                                </div>
                                <div className="text-[10px] text-[var(--apple-text-muted)]">
                                  {row.fileCount} file{row.fileCount !== 1 ? "s" : ""}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div>{formatBytes(row.sizeBytes)}</div>
                                <div className="text-[10px] text-[var(--apple-text-muted)]">
                                  {row.pageCount} page{row.pageCount !== 1 ? "s" : ""}
                                </div>
                              </div>
                            )}
                          </td>
                        )}
                        {visibleCols.addedOn && (
                          <td className="px-3 py-2.5 tabular-nums text-[var(--apple-text-secondary)]">
                            {formatDateShort(row.driveModifiedAt)}
                          </td>
                        )}
                        {visibleCols.notes && (
                          <td className="px-3 py-2.5 text-center">
                            {row.notesCount > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!row.isFolder) setViewerNode(row);
                                  else onChangeSubTab("notes");
                                }}
                                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--apple-bg)] px-1.5 text-[10px] font-semibold text-[var(--apple-text-secondary)]"
                              >
                                {row.notesCount}
                              </button>
                            )}
                          </td>
                        )}
                        {visibleCols.viewedOn && (
                          <td className="px-3 py-2.5 tabular-nums text-[var(--apple-text-muted)]">
                            {formatDateShort(row.lastViewedAt)}
                          </td>
                        )}
                        {visibleCols.permission && (
                          <td className="px-3 py-2.5 capitalize text-[var(--apple-text-secondary)]">
                            {row.effectivePermission}
                          </td>
                        )}
                        {visibleCols.id && (
                          <td className="px-3 py-2.5 font-mono text-[10px] text-[var(--apple-text-muted)]">
                            {row.driveFileId.slice(0, 12)}
                          </td>
                        )}
                        <td className="px-2 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => setContextNode(contextNode?.id === row.id ? null : row)}
                            className="rounded-lg p-1 text-[var(--apple-text-muted)] opacity-70 transition hover:bg-[var(--apple-bg)] hover:text-[var(--apple-text)] group-hover:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row Context Action Modal / Popover */}
      {contextNode && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
          onClick={() => setContextNode(null)}
        >
          <div
            className="apple-card w-full max-w-xs p-2 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1.5 flex items-center justify-between border-b border-[var(--apple-border)] px-2.5 py-2">
              <span dir="auto" className="truncate font-semibold">
                {contextNode.dotIndex} {contextNode.name}
              </span>
              <button type="button" onClick={() => setContextNode(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {!contextNode.isFolder && (
              <button
                type="button"
                onClick={() => {
                  const target = contextNode;
                  setContextNode(null);
                  setViewerNode(target);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--apple-hover)]"
              >
                <Eye className="h-3.5 w-3.5 text-[#007AFF]" /> View in Kleen Viewer
              </button>
            )}
            {canDownloadPdf(contextNode.effectivePermission as PermissionLevel) && (
              <a
                href={
                  contextNode.isFolder
                    ? "#"
                    : `/api/documents/${contextNode.id}/download?format=pdf`
                }
                onClick={(e) => {
                  if (contextNode.isFolder) {
                    e.preventDefault();
                    setSelectedIds(new Set([contextNode.id]));
                    setContextNode(null);
                    handleBulkDownload();
                  } else {
                    setContextNode(null);
                  }
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--apple-hover)]"
              >
                <Download className="h-3.5 w-3.5" /> Download Watermarked PDF
              </a>
            )}
            {!contextNode.isFolder && canDownloadOriginal(contextNode.effectivePermission as PermissionLevel) && (
              <a
                href={`/api/documents/${contextNode.id}/download?format=original`}
                onClick={() => setContextNode(null)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--apple-hover)]"
              >
                <Download className="h-3.5 w-3.5" /> Download Original File
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                toggleFavorite([contextNode.id]);
                setContextNode(null);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--apple-hover)]"
            >
              <Star className="h-3.5 w-3.5" /> {contextNode.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
            </button>
            <button
              type="button"
              onClick={() => {
                const internalUrl = `${window.location.origin}/?doc=${contextNode.id}`;
                navigator.clipboard?.writeText(internalUrl);
                setContextNode(null);
                showToast("Internal document link copied");
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--apple-hover)]"
            >
              <Link2 className="h-3.5 w-3.5" /> Copy internal link
            </button>
            {isTrueAdmin && !contextNode.isFolder && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    createExternalLink(contextNode.id);
                    setContextNode(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--apple-hover)]"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Create external sharing link
                </button>
                <button
                  type="button"
                  onClick={() => {
                    requestSignature(contextNode);
                    setContextNode(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--apple-hover)]"
                >
                  <FileSignature className="h-3.5 w-3.5" /> Request signature
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContextNode(null);
                    onNavigateTab("permissions");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--apple-hover)]"
                >
                  <Shield className="h-3.5 w-3.5" /> Manage permissions
                </button>
              </>
            )}
            {isTrueAdmin && (
              <button
                type="button"
                onClick={() => {
                  setContextNode(null);
                  onNavigateTab("reports:activity-log");
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--apple-hover)]"
              >
                <MessageSquareText className="h-3.5 w-3.5" /> View reports (Activity log)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Custom Project Index Modal */}
      {showCustomIndexModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="apple-card w-full max-w-md p-6">
            <h3 className="text-base font-semibold">Custom project index</h3>
            <p className="mt-1 text-xs text-[var(--apple-text-secondary)]">
              Adjust the settings to select data included in the project index.
            </p>
            <div className="mt-4 space-y-4 text-xs">
              <div>
                <div className="mb-1.5 font-medium">Contents</div>
                <div className="flex gap-2">
                  {[
                    { id: "all" as const, label: "Files and folders" },
                    { id: "files" as const, label: "Only files" },
                    { id: "folders" as const, label: "Only folders" },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCustomIndexContents(c.id)}
                      className={`rounded-lg px-2.5 py-1.5 ${
                        customIndexContents === c.id
                          ? "bg-[#007AFF] text-white"
                          : "border border-[var(--apple-border)]"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between">
                <span>Include recycle bin within the project index</span>
                <input
                  type="checkbox"
                  checked={customIndexRecycle}
                  onChange={(e) => setCustomIndexRecycle(e.target.checked)}
                />
              </label>
              <div>
                <label className="mb-1 block font-medium">Documents uploaded/modified from (optional)</label>
                <input
                  type="date"
                  value={customIndexFrom}
                  onChange={(e) => setCustomIndexFrom(e.target.value)}
                  className="w-full rounded-lg border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-1.5"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCustomIndexModal(false)}
                className="rounded-xl border border-[var(--apple-border)] px-4 py-2 text-xs font-medium"
              >
                Cancel
              </button>
              <a
                href={`/api/documents/export-index?contents=${customIndexContents}&includeRecycle=${customIndexRecycle}&fromDate=${encodeURIComponent(customIndexFrom)}`}
                onClick={() => setShowCustomIndexModal(false)}
                className="rounded-xl bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white"
              >
                Export
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Rebuild Index Confirmation Modal */}
      {showRebuildConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="apple-card w-full max-w-md p-6">
            <h3 className="text-base font-semibold">Rebuild index</h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--apple-text-secondary)]">
              Rebuilding index will refresh and normalize display numbering for all mirrored items in this Data Room
              without altering your source Google Drive filenames. Would you like to proceed?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRebuildConfirm(false)}
                className="rounded-xl border border-[var(--apple-border)] px-4 py-2 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRebuildIndex}
                className="rounded-xl bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View As Modal */}
      {showViewAsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="apple-card w-full max-w-md p-6">
            <h3 className="text-base font-semibold">View as participant group</h3>
            <p className="mt-1 text-xs text-[var(--apple-text-secondary)]">
              Preview the Data Room exactly as the selected group sees it, enforcing their folder permissions and watermarks.
            </p>
            <input
              value={viewAsSearch}
              onChange={(e) => setViewAsSearch(e.target.value)}
              placeholder="Search groups..."
              className="mt-3 w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2 text-xs outline-none"
            />
            <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
              {groups
                .filter((g) => g.role !== "Administrator" && g.name.toLowerCase().includes(viewAsSearch.toLowerCase()))
                .map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setViewAsTarget(g.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs transition ${
                      viewAsTarget === g.id
                        ? "border-[#007AFF] bg-[var(--apple-selected)]"
                        : "border-[var(--apple-border)] hover:bg-[var(--apple-hover)]"
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{g.name}</div>
                      <div className="text-[11px] text-[var(--apple-text-muted)]">
                        {g.members?.length || 0} participant(s)
                      </div>
                    </div>
                    {viewAsTarget === g.id && <Check className="h-4 w-4 text-[#007AFF]" />}
                  </button>
                ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowViewAsModal(false)}
                className="rounded-xl border border-[var(--apple-border)] px-4 py-2 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!viewAsTarget}
                onClick={() => {
                  if (viewAsTarget) {
                    setShowViewAsModal(false);
                    onViewAs(viewAsTarget);
                  }
                }}
                className="rounded-xl bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kleen Viewer Overlay */}
      {viewerNode && (
        <KleenViewer
          node={viewerNode}
          siblingFiles={siblingFiles}
          project={project}
          user={user}
          onClose={() => setViewerNode(null)}
          onSelectNode={(n) => setViewerNode(n)}
          onOpenFolder={(pid) => {
            onChangeSubTab("all");
            setCurrentFolderDriveId(pid);
          }}
          onNotesChanged={() => {
            loadDocuments();
            loadSecondaryTabs();
          }}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed right-6 bottom-6 z-50 rounded-xl bg-[#1C1C1E] px-4 py-2.5 text-xs font-medium text-white shadow-2xl border border-white/15">
          {toast}
        </div>
      )}
    </div>
  );
}
