"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FolderOpen,
  ChevronDown,
  Eye,
  Download,
  Printer,
  MessageSquareText,
  Sun,
  Moon,
  X,
  Search,
  ListTree,
  LayoutGrid,
  Link2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  MoveHorizontal,
  Settings2,
  Plus,
  Lock,
  Globe,
  ShieldAlert,
} from "lucide-react";
import type { DriveNodeDto, ProjectDto, UserDto } from "@/lib/types";
import { canDownloadOriginal, canDownloadPdf, canPrintDocument, isFenceRequired, type PermissionLevel } from "@/lib/permissions";
import { formatBytes, formatDateShort } from "@/lib/format";

interface NoteItem {
  id: string;
  nodeId: string;
  content: string;
  noteType: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
}

export function KleenViewer({
  node,
  siblingFiles,
  project,
  user,
  onClose,
  onSelectNode,
  onOpenFolder,
  onNotesChanged,
}: {
  node: DriveNodeDto;
  siblingFiles: DriveNodeDto[];
  project: ProjectDto;
  user: UserDto;
  onClose: () => void;
  onSelectNode: (n: DriveNodeDto) => void;
  onOpenFolder: (parentDriveId: string | null) => void;
  onNotesChanged: () => void;
}) {
  const [viewerLight, setViewerLight] = useState(true);
  const [leftTab, setLeftTab] = useState<"outline" | "thumbnails" | "links" | "notes" | null>("notes");
  const [fenceEnabled, setFenceEnabled] = useState(() =>
    isFenceRequired(node.effectivePermission as PermissionLevel)
  );
  const [fenceY, setFenceY] = useState(260);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDocSwitcher, setShowDocSwitcher] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [exactPhrase, setExactPhrase] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [hideBottomBar, setHideBottomBar] = useState(false);
  const [showCustomizePill, setShowCustomizePill] = useState(false);

  // Notes inside viewer
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [noteSearch, setNoteSearch] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteType, setNewNoteType] = useState<"Private" | "Shared">("Private");
  const [savingNote, setSavingNote] = useState(false);

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const logIdRef = useRef<string | null>(null);

  const perm = (node.effectivePermission || "view") as PermissionLevel;
  const allowPdfDownload = canDownloadPdf(perm);
  const allowOrigDownload = canDownloadOriginal(perm);
  const allowPrint = canPrintDocument(perm);
  const totalPages = Math.max(1, node.pageCount || 4);

  useEffect(() => {
    setFenceEnabled(isFenceRequired(perm));
    setCurrentPage(1);
    setRotation(0);
  }, [node.id, perm]);

  // Fetch document stream & record viewing duration heartbeat
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setLoadingDoc(true);

    fetch(`/api/documents/${node.id}/content`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load document");
        logIdRef.current = res.headers.get("X-Kleen-Log-Id");
        const blob = await res.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(objectUrl);
        setLoadingDoc(false);
      })
      .catch(() => {
        if (active) setLoadingDoc(false);
      });

    const interval = setInterval(() => {
      if (logIdRef.current) {
        fetch(`/api/documents/${node.id}/content`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logId: logIdRef.current, seconds: 10 }),
        }).catch(() => {});
      }
    }, 10000);

    return () => {
      active = false;
      clearInterval(interval);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [node.id]);

  // Load notes for this document
  async function loadNotes() {
    const res = await fetch(`/api/notes?nodeId=${node.id}`);
    if (res.ok) {
      const data = await res.json();
      setNotes(data.notes || []);
    }
  }

  useEffect(() => {
    loadNotes();
  }, [node.id]);

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    setSavingNote(true);
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId: node.id, content: newNoteText, noteType: newNoteType }),
    });
    setSavingNote(false);
    if (res.ok) {
      setNewNoteText("");
      setAddingNote(false);
      await loadNotes();
      onNotesChanged();
    }
  }

  const watermarkText = useMemo(() => {
    if (!project.watermarkEnabled || !project.watermarkOnView) return [];
    const fields: string[] = JSON.parse(project.watermarkFieldsJson || "[]");
    const lines: string[] = [];
    if (fields.includes("projectName")) lines.push(project.name);
    if (fields.includes("email")) lines.push(user.email);
    if (fields.includes("fullName")) lines.push(`${user.firstName} ${user.lastName}`.trim());
    if (fields.includes("dateTime")) lines.push(new Date().toLocaleString("en-US"));
    if (fields.includes("company") && user.company) lines.push(user.company);
    if (fields.includes("customText") && project.watermarkCustomText) lines.push(project.watermarkCustomText);
    return lines;
  }, [project, user]);

  const filteredNotes = notes.filter((n) =>
    !noteSearch.trim() ? true : n.content.toLowerCase().includes(noteSearch.toLowerCase())
  );

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const haystack = `${node.dotIndex} ${node.name} ${node.category} Kleen Data Room Google Drive Mirror`;
    const q = caseSensitive ? searchQuery : searchQuery.toLowerCase();
    const target = caseSensitive ? haystack : haystack.toLowerCase();
    const found = exactPhrase ? target.includes(q) : q.split(/\s+/).every((tok) => target.includes(tok));
    return found ? [{ page: 1, snippet: haystack.slice(0, 90) }] : [];
  }, [searchQuery, exactPhrase, caseSensitive, node]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#141416] text-[#F5F5F7]">
      {/* Top Viewer Toolbar */}
      <header className="flex h-13 shrink-0 items-center justify-between border-b border-white/10 bg-[#1C1C1E]/95 px-4 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            title="Open containing folder"
            onClick={() => {
              onOpenFolder(node.parentDriveId);
              onClose();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/75 transition hover:bg-white/10 hover:text-white"
          >
            <FolderOpen className="h-4 w-4" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDocSwitcher((v) => !v)}
              className="flex max-w-[340px] items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition hover:bg-white/10"
            >
              <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-400">
                {node.extension}
              </span>
              <span dir="auto" className="truncate">
                {node.dotIndex} {node.name}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/60" />
            </button>

            {showDocSwitcher && (
              <div className="absolute top-10 left-0 z-50 w-80 rounded-xl border border-white/15 bg-[#2C2C2E] p-1.5 shadow-2xl">
                <div className="px-2.5 py-1 text-[11px] font-medium text-white/50">Files in this folder</div>
                <div className="max-h-64 overflow-y-auto">
                  {siblingFiles.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setShowDocSwitcher(false);
                        onSelectNode(f);
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                        f.id === node.id ? "bg-[#0A84FF] text-white" : "text-white/85 hover:bg-white/10"
                      }`}
                    >
                      <span className="tabular-nums opacity-70">{f.dotIndex}</span>
                      <span dir="auto" className="truncate">
                        {f.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-white/15" />

          {/* Viewer Actions */}
          <button
            type="button"
            onClick={() => {
              if (!isFenceRequired(perm)) setFenceEnabled((v) => !v);
            }}
            title={isFenceRequired(perm) ? "Fence View enforced by permissions" : "Toggle Fence View"}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              fenceEnabled ? "bg-[#0A84FF]/20 text-[#0A84FF]" : "text-white/75 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Fence View</span>
          </button>

          {allowPdfDownload || allowOrigDownload ? (
            <a
              href={`/api/documents/${node.id}/download?format=${allowOrigDownload ? "original" : "pdf"}`}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
              title="Download document"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download</span>
            </a>
          ) : (
            <span
              className="flex cursor-not-allowed items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/30"
              title="Download disabled for your permission level"
            >
              <Download className="h-4 w-4" />
            </span>
          )}

          <button
            type="button"
            disabled={!allowPrint}
            onClick={() => window.print()}
            title={allowPrint ? "Print watermarked document" : "Print disabled by permissions"}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Printer className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setLeftTab((t) => (t === "notes" ? null : "notes"))}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              leftTab === "notes" ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10"
            }`}
          >
            <MessageSquareText className="h-4 w-4" />
            <span className="tabular-nums text-[11px]">({notes.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSearch((s) => !s)}
            title="Search inside document"
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
              showSearch ? "bg-[#0A84FF] text-white" : "text-white/75 hover:bg-white/10"
            }`}
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewerLight((v) => !v)}
            title="Toggle viewer surface brightness"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/75 transition hover:bg-white/10"
          >
            {viewerLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
          >
            <X className="h-3.5 w-3.5" /> Close
          </button>
        </div>
      </header>

      {/* Main Split Viewer Body */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Left Collapsible Inspector */}
        {leftTab && (
          <aside className="flex w-72 shrink-0 flex-col border-r border-white/10 bg-[#1C1C1E]">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <div className="flex items-center gap-1">
                {[
                  { id: "outline" as const, icon: ListTree, label: "Outline" },
                  { id: "thumbnails" as const, icon: LayoutGrid, label: "Thumbnails" },
                  { id: "links" as const, icon: Link2, label: "Links" },
                  { id: "notes" as const, icon: MessageSquareText, label: "Notes" },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      title={tab.label}
                      onClick={() => setLeftTab(tab.id)}
                      className={`rounded-lg p-2 transition ${
                        leftTab === tab.id ? "bg-[#0A84FF]/20 text-[#0A84FF]" : "text-white/60 hover:bg-white/10"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setLeftTab(null)}
                className="rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {leftTab === "outline" && (
                <div className="space-y-2 text-xs text-white/70">
                  <div className="font-semibold text-white">Document Outline</div>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    className="block w-full rounded-lg bg-white/5 px-2.5 py-2 text-left hover:bg-white/10"
                  >
                    1. Cover & Executive Overview
                  </button>
                  {totalPages > 1 && (
                    <button
                      type="button"
                      onClick={() => setCurrentPage(2)}
                      className="block w-full rounded-lg px-2.5 py-2 text-left hover:bg-white/10"
                    >
                      2. Supporting Schedules & Exhibits
                    </button>
                  )}
                </div>
              )}

              {leftTab === "thumbnails" && (
                <div className="grid grid-cols-2 gap-2.5">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      className={`flex flex-col items-center rounded-xl border p-2 transition ${
                        currentPage === p
                          ? "border-[#0A84FF] bg-[#0A84FF]/15"
                          : "border-white/10 bg-white/5 hover:border-white/25"
                      }`}
                    >
                      <div className="mb-1.5 flex h-20 w-full items-center justify-center rounded bg-white text-xs font-semibold text-zinc-700">
                        Page {p}
                      </div>
                      <span className="tabular-nums text-[11px] text-white/70">{p}</span>
                    </button>
                  ))}
                </div>
              )}

              {leftTab === "links" && (
                <div className="space-y-2 text-xs text-white/70">
                  <div className="font-semibold text-white">Document Metadata & Links</div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1.5">
                    <div>Index: <span className="text-white">{node.dotIndex}</span></div>
                    <div>Size: <span className="text-white">{formatBytes(node.sizeBytes)}</span></div>
                    <div>Modified: <span className="text-white">{formatDateShort(node.driveModifiedAt)}</span></div>
                    <div>Source: <span className="text-[#0A84FF]">Google Drive Mirror</span></div>
                  </div>
                </div>
              )}

              {leftTab === "notes" && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                    <input
                      value={noteSearch}
                      onChange={(e) => setNoteSearch(e.target.value)}
                      placeholder="Search notes..."
                      className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pr-2.5 pl-8 text-xs text-white outline-none focus:border-[#0A84FF]"
                    />
                  </div>

                  {!addingNote ? (
                    <button
                      type="button"
                      onClick={() => setAddingNote(true)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#0A84FF]/40 bg-[#0A84FF]/10 py-2 text-xs font-medium text-[#0A84FF] transition hover:bg-[#0A84FF]/20"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add note
                    </button>
                  ) : (
                    <form onSubmit={handleAddNote} className="space-y-2 rounded-xl border border-white/15 bg-white/5 p-2.5">
                      <textarea
                        rows={3}
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        placeholder="Write annotation..."
                        className="w-full resize-none rounded-lg bg-[#141416] p-2 text-xs text-white outline-none"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <select
                          value={newNoteType}
                          onChange={(e) => setNewNoteType(e.target.value as "Private" | "Shared")}
                          className="rounded-lg bg-[#141416] px-2 py-1 text-[11px] text-white"
                        >
                          <option value="Private">Private</option>
                          <option value="Shared">Shared</option>
                        </select>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setAddingNote(false)}
                            className="rounded-lg px-2 py-1 text-[11px] text-white/60 hover:bg-white/10"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={savingNote}
                            className="rounded-lg bg-[#0A84FF] px-2.5 py-1 text-[11px] font-medium text-white"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  <div className="space-y-2">
                    {filteredNotes.length === 0 ? (
                      <div className="py-6 text-center text-xs text-white/40">No notes yet for this document.</div>
                    ) : (
                      filteredNotes.map((n) => (
                        <div key={n.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="mb-1.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0A84FF]/20 text-[10px] font-bold text-[#0A84FF]">
                                {(n.firstName?.[0] || "U") + (n.lastName?.[0] || "")}
                              </div>
                              <div>
                                <div className="text-[11px] font-semibold text-white">
                                  {n.firstName} {n.lastName}
                                </div>
                                <div className="text-[10px] text-white/50">{formatDateShort(n.createdAt)}</div>
                              </div>
                            </div>
                            <span
                              className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70"
                              title={n.noteType}
                            >
                              {n.noteType === "Private" ? <Lock className="h-2.5 w-2.5" /> : <Globe className="h-2.5 w-2.5" />}
                              {n.noteType}
                            </span>
                          </div>
                          <p dir="auto" className="text-xs leading-relaxed text-white/85">
                            {n.content}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Center Document Canvas */}
        <div
          className={`relative flex-1 overflow-auto p-6 ${viewerLight ? "bg-[#242428]" : "bg-[#0E0E10]"}`}
          onMouseMove={(e) => {
            if (fenceEnabled) {
              const rect = e.currentTarget.getBoundingClientRect();
              setFenceY(Math.max(80, Math.min(rect.height - 80, e.clientY - rect.top)));
            }
          }}
        >
          {/* In-Document Search Floating Bar */}
          {showSearch && (
            <div className="sticky top-2 z-30 ml-auto mb-3 flex w-80 flex-col gap-2 rounded-2xl border border-white/15 bg-[#2C2C2E]/95 p-3 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-white/50" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Find in document..."
                  className="flex-1 bg-transparent text-xs text-white outline-none"
                />
                <button type="button" onClick={() => setShowSearch(false)} className="text-white/50 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-white/70">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={exactPhrase} onChange={(e) => setExactPhrase(e.target.checked)} />
                  Exact phrase
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />
                  Case sensitive
                </label>
              </div>
              {searchQuery.trim() && (
                <div className="border-t border-white/10 pt-1.5 text-[11px] text-white/70">
                  {searchMatches.length > 0 ? (
                    <span className="text-[#0A84FF]">1 match on page 1</span>
                  ) : (
                    <span>No matches found</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Document Viewport Container */}
          <div className="mx-auto flex justify-center">
            <div
              className="relative overflow-hidden rounded-xl bg-white shadow-2xl transition-transform duration-150"
              style={{
                width: `${Math.round((780 * zoom) / 100)}px`,
                minHeight: "980px",
                transform: `rotate(${rotation}deg)`,
              }}
            >
              {loadingDoc ? (
                <div className="flex h-[800px] items-center justify-center text-sm text-zinc-500">
                  Streaming encrypted document from Google Drive mirror...
                </div>
              ) : pdfBlobUrl ? (
                <iframe
                  src={`${pdfBlobUrl}#page=${currentPage}&toolbar=0&navpanes=0`}
                  className="h-[980px] w-full border-0"
                  title={node.name}
                />
              ) : (
                <div className="flex h-[600px] flex-col items-center justify-center gap-2 text-zinc-500">
                  <ShieldAlert className="h-8 w-8 text-amber-500" />
                  <p className="text-sm">Preview unavailable for this item.</p>
                </div>
              )}

              {/* Dynamic Watermark Overlay */}
              {watermarkText.length > 0 && (
                <div
                  className="pointer-events-none absolute inset-0 z-20 overflow-hidden select-none"
                  style={{ opacity: Math.max(0.12, project.watermarkOpacity / 100) }}
                >
                  <div
                    className={`grid h-full w-full ${
                      project.watermarkPosition === "corner"
                        ? "grid-cols-1 place-items-end p-8"
                        : "grid-cols-2 gap-10 p-10"
                    }`}
                  >
                    {(project.watermarkPosition === "corner" ? [0] : [0, 1, 2, 3, 4, 5]).map((slot) => (
                      <div
                        key={slot}
                        className="flex flex-col items-center justify-center text-center font-medium leading-tight"
                        style={{
                          transform: project.watermarkPosition === "corner" ? "none" : "rotate(-28deg)",
                          color:
                            project.watermarkColor === "red"
                              ? "#D92D20"
                              : project.watermarkColor === "blue"
                                ? "#007AFF"
                                : "#52525B",
                          fontSize: "12px",
                        }}
                      >
                        {watermarkText.map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fence View Privacy Slit Overlay */}
          {fenceEnabled && (
            <div className="pointer-events-none fixed inset-x-0 top-13 bottom-0 z-30">
              <div
                className="absolute inset-x-0 top-0 bg-black/82 backdrop-blur-[2px]"
                style={{ height: `${Math.max(0, fenceY - 70)}px` }}
              />
              <div
                className="absolute inset-x-0 border-y border-[#0A84FF]/60"
                style={{ top: `${Math.max(0, fenceY - 70)}px`, height: "140px" }}
              />
              <div
                className="absolute inset-x-0 bottom-0 bg-black/82 backdrop-blur-[2px]"
                style={{ top: `${fenceY + 70}px` }}
              />
            </div>
          )}

          {/* Bottom Floating Frosted Glass Pill */}
          {!hideBottomBar ? (
            <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-2xl border border-white/15 bg-[#1C1C1E]/90 px-3 py-1.5 shadow-2xl backdrop-blur-xl">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCustomizePill((v) => !v)}
                  title="Customize toolbar"
                  className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <Settings2 className="h-4 w-4" />
                </button>
                {showCustomizePill && (
                  <div className="absolute bottom-10 left-0 w-48 rounded-xl border border-white/15 bg-[#2C2C2E] p-2 text-xs shadow-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setHideBottomBar(true);
                        setShowCustomizePill(false);
                      }}
                      className="w-full rounded-lg px-2.5 py-1.5 text-left text-white/85 hover:bg-white/10"
                    >
                      Hide when not required
                    </button>
                  </div>
                )}
              </div>
              <div className="h-4 w-px bg-white/15" />
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(50, z - 15))}
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/10"
                title="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <select
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="rounded-lg bg-transparent px-1.5 py-1 text-xs font-medium tabular-nums text-white outline-none"
              >
                {[75, 100, 125, 150, 175, 200].map((v) => (
                  <option key={v} value={v} className="bg-[#1C1C1E]">
                    {v}%
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(200, z + 15))}
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/10"
                title="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(115)}
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/10"
                title="Fit to width"
              >
                <MoveHorizontal className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(100)}
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/10"
                title="Fit to page"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/10"
                title="Rotate pages"
              >
                <RotateCw className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setHideBottomBar(false)}
              className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/15 bg-[#1C1C1E]/85 px-3 py-1 text-[11px] text-white/80 backdrop-blur"
            >
              Show viewer toolbar
            </button>
          )}

          {/* Bottom-Right Page Jumper */}
          <div className="fixed right-6 bottom-5 z-40 flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#1C1C1E]/90 px-3 py-1.5 text-xs tabular-nums shadow-xl backdrop-blur-xl">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => setCurrentPage(Math.max(1, Math.min(totalPages, Number(e.target.value) || 1)))}
              className="w-10 rounded bg-white/10 px-1.5 py-0.5 text-center font-semibold text-white outline-none"
            />
            <span className="text-white/50">/ {totalPages}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
