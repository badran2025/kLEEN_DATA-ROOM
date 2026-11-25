"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Download, Eye, ExternalLink, Folder, FileText, Search, X, ShieldCheck } from "lucide-react";
import type { GroupDto, ProjectDto } from "@/lib/types";
import { FILE_TYPE_CATEGORIES } from "@/lib/format";
import { PERMISSION_LEVELS, permissionRank, resolveEffectivePermission, type PermissionLevel } from "@/lib/permissions";

interface PermNode {
  id: string;
  driveFileId: string;
  parentDriveId: string | null;
  name: string;
  isFolder: boolean;
  dotIndex: string;
  extension: string;
}

const CLICKABLE_SEGMENTS: PermissionLevel[] = ["fence", "view", "encrypted", "pdf", "original", "upload", "manage"];

export function PermissionsView({
  project,
  onViewAs,
  onNavigateTab,
}: {
  project: ProjectDto;
  onViewAs: (groupId: string | null) => void;
  onNavigateTab: (tab: string) => void;
}) {
  const [mode, setMode] = useState<"groups" | "documents">("groups");
  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [nodes, setNodes] = useState<PermNode[]>([]);
  const [perms, setPerms] = useState<Array<{ groupId: string; nodeId: string; level: string }>>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const [searchText, setSearchText] = useState("");
  const [showFileTypeModal, setShowFileTypeModal] = useState(false);
  const [ftSelected, setFtSelected] = useState<Set<string>>(new Set(["PDF"]));
  const [ftLevel, setFtLevel] = useState<PermissionLevel>("pdf");
  const [ftGroups, setFtGroups] = useState<Set<string>>(new Set());
  const [ftIncludeNone, setFtIncludeNone] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function loadMatrix() {
    const res = await fetch("/api/permissions");
    if (res.ok) {
      const data = await res.json();
      setGroups(data.groups || []);
      setNodes(data.nodes || []);
      setPerms(data.permissions || []);
      if (!selectedGroupId && data.groups?.length) {
        const firstUserGrp = data.groups.find((g: GroupDto) => g.role !== "Administrator") || data.groups[0];
        setSelectedGroupId(firstUserGrp.id);
      }
      if (!selectedNodeId && data.nodes?.length) {
        setSelectedNodeId(data.nodes[0].id);
      }
    }
  }

  useEffect(() => {
    loadMatrix();
  }, [project.id]);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const driveMap = useMemo(() => new Map(nodes.map((n) => [n.driveFileId, n.id])), [nodes]);

  function getGroupPermMap(gid: string) {
    return new Map(perms.filter((p) => p.groupId === gid).map((p) => [p.nodeId, p.level]));
  }

  async function setPermission(groupId: string, nodeId: string, level: PermissionLevel) {
    await fetch("/api/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-permission", groupId, nodeId, level }),
    });
    setToast(`Updated permission to ${level.toUpperCase()}`);
    setTimeout(() => setToast(null), 2200);
    await loadMatrix();
  }

  async function applyByFileType() {
    const res = await fetch("/api/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set-by-filetype",
        fileTypes: Array.from(ftSelected),
        groupIds: Array.from(ftGroups),
        level: ftLevel,
        includeNoAccess: ftIncludeNone,
      }),
    });
    setShowFileTypeModal(false);
    if (res.ok) {
      const d = await res.json();
      setToast(`Updated ${d.updatedCount} permission(s) by file type`);
      setTimeout(() => setToast(null), 2500);
      await loadMatrix();
    }
  }

  function renderSegmentedBar(groupId: string, node: PermNode, disabledAdmin = false) {
    const gPermMap = getGroupPermMap(groupId);
    const grp = groups.find((g) => g.id === groupId);
    const eff = resolveEffectivePermission(node.id, grp?.role || "User", nodeMap, driveMap, gPermMap);
    const rank = permissionRank(eff);

    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabledAdmin}
          onClick={() => setPermission(groupId, node.id, "none")}
          title="No access (Hidden)"
          className={`flex h-6 w-6 items-center justify-center rounded-md border text-[10px] font-bold transition ${
            eff === "none"
              ? "border-red-500 bg-red-500/20 text-red-500"
              : "border-[var(--apple-border)] text-[var(--apple-text-muted)] hover:border-red-500/60 hover:text-red-500"
          } disabled:opacity-40`}
        >
          ✕
        </button>
        <div className="flex overflow-hidden rounded-lg border border-[var(--apple-border)]">
          {CLICKABLE_SEGMENTS.map((seg) => {
            const segRank = permissionRank(seg);
            const active = rank >= segRank && eff !== "none";
            const isUploadOnFile = seg === "upload" && !node.isFolder;
            return (
              <button
                key={seg}
                type="button"
                disabled={disabledAdmin || isUploadOnFile}
                onClick={() => setPermission(groupId, node.id, seg)}
                title={isUploadOnFile ? "Upload disabled on individual files" : seg.toUpperCase()}
                className={`px-2 py-1 text-[10px] font-medium capitalize transition ${
                  isUploadOnFile
                    ? "cursor-not-allowed bg-[var(--apple-bg)] text-[var(--apple-text-muted)] opacity-35"
                    : active
                      ? segRank === rank
                        ? "bg-[#007AFF] text-white"
                        : "bg-[#007AFF]/25 text-[#007AFF]"
                      : "bg-[var(--apple-surface)] text-[var(--apple-text-secondary)] hover:bg-[var(--apple-hover)]"
                }`}
              >
                {seg}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-[var(--apple-border)] bg-[var(--apple-surface)] p-1 text-xs">
            <button
              type="button"
              onClick={() => setMode("groups")}
              className={`rounded-lg px-3 py-1 font-medium ${mode === "groups" ? "bg-[#007AFF] text-white" : ""}`}
            >
              Groups
            </button>
            <button
              type="button"
              onClick={() => setMode("documents")}
              className={`rounded-lg px-3 py-1 font-medium ${mode === "documents" ? "bg-[#007AFF] text-white" : ""}`}
            >
              By documents
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowFileTypeModal(true)}
            className="rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--apple-hover)]"
          >
            Set permissions by file type
          </button>

          <a
            href="/api/permissions?format=xlsx"
            className="flex items-center gap-1.5 rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--apple-hover)]"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </a>
        </div>

        <div className="flex items-center gap-2">
          {selectedGroupId && groups.find((g) => g.id === selectedGroupId)?.role !== "Administrator" && (
            <button
              type="button"
              onClick={() => onViewAs(selectedGroupId)}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--apple-hover)]"
            >
              <Eye className="h-3.5 w-3.5" /> View as
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigateTab("reports:permissions")}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--apple-hover)]"
          >
            Permissions log <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[270px_1fr]">
        {/* Left Selector Pane */}
        <div className="apple-card flex flex-col p-3">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--apple-text-muted)]" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={mode === "groups" ? "Search groups..." : "Search documents..."}
              className="w-full rounded-xl border border-[var(--apple-border)] bg-[var(--apple-bg)] py-1.5 pr-3 pl-8 text-xs outline-none"
            />
          </div>

          <div className="max-h-[540px] space-y-1 overflow-y-auto text-xs">
            {mode === "groups"
              ? groups
                  .filter((g) => g.name.toLowerCase().includes(searchText.toLowerCase()))
                  .map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedGroupId(g.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                        selectedGroupId === g.id
                          ? "bg-[var(--apple-selected)] font-semibold text-[#007AFF]"
                          : "hover:bg-[var(--apple-hover)]"
                      }`}
                    >
                      <span className="truncate">{g.name}</span>
                      <span className="text-[10px] text-[var(--apple-text-muted)]">{g.role}</span>
                    </button>
                  ))
              : nodes
                  .filter((n) => n.name.toLowerCase().includes(searchText.toLowerCase()))
                  .map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => setSelectedNodeId(n.id)}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition ${
                        selectedNodeId === n.id
                          ? "bg-[var(--apple-selected)] font-semibold text-[#007AFF]"
                          : "hover:bg-[var(--apple-hover)]"
                      }`}
                    >
                      {n.isFolder ? (
                        <Folder className="h-3.5 w-3.5 shrink-0 text-[#007AFF]" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                      )}
                      <span dir="auto" className="truncate">
                        {n.dotIndex} {n.name}
                      </span>
                    </button>
                  ))}
          </div>
        </div>

        {/* Right Permission Matrix Pane */}
        <div className="apple-card overflow-auto p-4">
          {mode === "groups" ? (
            <div className="space-y-2">
              <div className="mb-3 flex items-center justify-between border-b border-[var(--apple-border)] pb-2 text-xs">
                <span className="font-semibold">
                  Permissions for: {groups.find((g) => g.id === selectedGroupId)?.name}
                </span>
                <span className="text-[11px] text-[var(--apple-text-muted)]">
                  Click any segment to set cumulative access ceiling
                </span>
              </div>
              {nodes.map((n) => {
                const isAdm = groups.find((g) => g.id === selectedGroupId)?.role === "Administrator";
                return (
                  <div
                    key={n.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--apple-border)] px-3 py-2 text-xs hover:bg-[var(--apple-hover)]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {n.isFolder ? (
                        <Folder className="h-3.5 w-3.5 shrink-0 text-[#007AFF]" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                      )}
                      <span className="tabular-nums text-[var(--apple-text-muted)]">{n.dotIndex}</span>
                      <span dir="auto" className="truncate font-medium">
                        {n.name}
                      </span>
                    </div>
                    {selectedGroupId && renderSegmentedBar(selectedGroupId, n, isAdm)}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="mb-3 border-b border-[var(--apple-border)] pb-2 text-xs font-semibold">
                Group permissions for: {nodeMap.get(selectedNodeId)?.dotIndex} {nodeMap.get(selectedNodeId)?.name}
              </div>
              {selectedNodeId &&
                nodeMap.get(selectedNodeId) &&
                groups.map((g) => (
                  <div
                    key={g.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--apple-border)] px-3 py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <ShieldCheck className="h-4 w-4 text-[#007AFF]" />
                      <span>{g.name}</span>
                      <span className="rounded-full bg-[var(--apple-bg)] px-2 py-0.5 text-[10px] text-[var(--apple-text-muted)]">
                        {g.role}
                      </span>
                    </div>
                    {renderSegmentedBar(g.id, nodeMap.get(selectedNodeId)!, g.role === "Administrator")}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Set Permissions by File Type Modal */}
      {showFileTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="apple-card w-full max-w-lg p-6 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Set permissions by file type</h3>
              <button type="button" onClick={() => setShowFileTypeModal(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 rounded-xl bg-[#007AFF]/10 p-2.5 text-[11px] text-[#007AFF]">
              Applies to current mirrored files only. Future Google Drive syncs inherit folder permissions.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <div className="mb-1.5 font-medium">File types</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.values(FILE_TYPE_CATEGORIES)
                    .flat()
                    .slice(0, 14)
                    .map((ext) => (
                      <button
                        key={ext}
                        type="button"
                        onClick={() =>
                          setFtSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(ext)) next.delete(ext);
                            else next.add(ext);
                            return next;
                          })
                        }
                        className={`rounded-lg px-2 py-1 text-[11px] ${
                          ftSelected.has(ext) ? "bg-[#007AFF] text-white" : "border border-[var(--apple-border)]"
                        }`}
                      >
                        {ext}
                      </button>
                    ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 font-medium">Permission level</div>
                <select
                  value={ftLevel}
                  onChange={(e) => setFtLevel(e.target.value as PermissionLevel)}
                  className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
                >
                  {PERMISSION_LEVELS.filter((l) => l !== "upload").map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={ftIncludeNone}
                  onChange={(e) => setFtIncludeNone(e.target.checked)}
                />
                <span>Apply also to files that currently have no access</span>
              </label>
              <div>
                <div className="mb-1.5 font-medium">Target Groups</div>
                <div className="space-y-1">
                  {groups
                    .filter((g) => g.role !== "Administrator")
                    .map((g) => (
                      <label key={g.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={ftGroups.has(g.id)}
                          onChange={(e) =>
                            setFtGroups((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(g.id);
                              else next.delete(g.id);
                              return next;
                            })
                          }
                        />
                        <span>{g.name}</span>
                      </label>
                    ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFileTypeModal(false)}
                className="rounded-xl border border-[var(--apple-border)] px-4 py-2 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyByFileType}
                className="rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed right-6 bottom-6 z-50 rounded-xl bg-[#1C1C1E] px-4 py-2 text-xs text-white shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
