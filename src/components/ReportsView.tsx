"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Download, Bell, Flame, Columns3, X, Trash2, Pause, Play, Folder, FileText } from "lucide-react";
import type { ProjectDto } from "@/lib/types";
import { formatBytes, formatDateShort, formatDateTime, formatDuration } from "@/lib/format";

export type ReportSubTab =
  | "activity-log"
  | "documents-overview"
  | "engagement-matrix"
  | "data-storage"
  | "permissions"
  | "subscriptions";

interface LogItem {
  id: string;
  userId: string | null;
  groupId: string | null;
  nodeId: string | null;
  actorName: string;
  actorEmail: string;
  groupName: string;
  category: string;
  action: string;
  description: string;
  durationSeconds: number;
  createdAt: string;
}

interface ReportData {
  logs: LogItem[];
  groups: Array<{ id: string; name: string; role: string; isDeleted: boolean }>;
  participants: Array<{
    id: string;
    userId: string;
    groupId: string;
    email: string;
    firstName: string;
    lastName: string;
    lastSignInAt: string | null;
  }>;
  nodes: Array<{
    id: string;
    driveFileId: string;
    parentDriveId: string | null;
    name: string;
    dotIndex: string;
    isFolder: boolean;
    category: string;
    sizeBytes: number;
    isTrashed: boolean;
    driveModifiedAt: string;
  }>;
  subscriptions: Array<{
    id: string;
    name: string;
    reportType: string;
    format: string;
    frequency: string;
    startAt: string;
    enabled: boolean;
  }>;
}

export function ReportsView({
  subTab,
  onChangeSubTab,
  project,
}: {
  subTab: ReportSubTab;
  onChangeSubTab: (t: ReportSubTab) => void;
  project: ProjectDto;
}) {
  const [data, setData] = useState<ReportData | null>(null);
  const [reportOn, setReportOn] = useState("All actions");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [periodDays, setPeriodDays] = useState<number>(365);
  const [showGroupCol, setShowGroupCol] = useState(false);
  const [showColMenu, setShowColMenu] = useState(false);
  const [drawerLog, setDrawerLog] = useState<LogItem | null>(null);

  // Documents overview states
  const [hideTop10, setHideTop10] = useState(false);
  const [topSortBy, setTopSortBy] = useState<"time" | "views" | "recent">("time");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Engagement matrix states
  const [matrixMode, setMatrixMode] = useState<"groups" | "documents">("groups");
  const [includeDeletedGroups, setIncludeDeletedGroups] = useState(true);

  // Data storage unit
  const [storageUnit, setStorageUnit] = useState<"MB" | "GB">("MB");

  // Subscribe modal
  const [showSubModal, setShowSubModal] = useState(false);
  const [subName, setSubName] = useState("Weekly Activity Digest");
  const [subFreq, setSubFreq] = useState("Weekly");

  async function loadReports() {
    const res = await fetch("/api/reports");
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    loadReports();
  }, [project.id]);

  const filteredLogs = useMemo(() => {
    if (!data) return [];
    const cutoff = Date.now() - periodDays * 86400000;
    return data.logs.filter((l) => {
      if (new Date(l.createdAt).getTime() < cutoff) return false;
      if (reportOn === "Documents" && l.category !== "Documents") return false;
      if (reportOn === "Users and groups" && l.category !== "Participants") return false;
      if (reportOn === "Project" && !["Project settings", "Project archiving", "Drive sync"].includes(l.category)) return false;
      if (categoryFilter && l.category !== categoryFilter) return false;
      if (authorFilter && l.actorEmail !== authorFilter) return false;
      return true;
    });
  }, [data, periodDays, reportOn, categoryFilter, authorFilter]);

  const scopedFolderDriveIds = useMemo(() => {
    if (!data || !selectedFolderId) return null;
    const rootFolder = data.nodes.find((n) => n.id === selectedFolderId);
    if (!rootFolder) return null;
    const set = new Set<string>([rootFolder.driveFileId]);
    let added = true;
    while (added) {
      added = false;
      for (const n of data.nodes) {
        if (n.isFolder && n.parentDriveId && set.has(n.parentDriveId) && !set.has(n.driveFileId)) {
          set.add(n.driveFileId);
          added = true;
        }
      }
    }
    return set;
  }, [data, selectedFolderId]);

  const fileMetrics = useMemo(() => {
    if (!data) return [];
    const files = data.nodes.filter(
      (n) => !n.isFolder && !n.isTrashed && (!scopedFolderDriveIds || (n.parentDriveId ? scopedFolderDriveIds.has(n.parentDriveId) : false))
    );
    return files
      .map((f) => {
        const fLogs = data.logs.filter((l) => l.nodeId === f.id);
        const views = fLogs.filter((l) => l.action.toLowerCase().includes("view")).length;
        const timeSec = fLogs.reduce((acc, l) => acc + (l.durationSeconds || 0), 0);
        const lastAt = fLogs[0]?.createdAt || f.driveModifiedAt;
        return { file: f, views, timeSec, lastAt };
      })
      .sort((a, b) =>
        topSortBy === "time"
          ? b.timeSec - a.timeSec
          : topSortBy === "views"
            ? b.views - a.views
            : b.lastAt.localeCompare(a.lastAt)
      );
  }, [data, topSortBy, scopedFolderDriveIds]);

  const overviewAnalytics = useMemo(() => {
    const totalTimeSec = fileMetrics.reduce((acc, m) => acc + m.timeSec, 0);
    const totalViews = fileMetrics.reduce((acc, m) => acc + m.views, 0);
    const scopedNodeIds = new Set(fileMetrics.map((m) => m.file.id));
    const scopedLogs = (data?.logs || []).filter((l) => l.nodeId && scopedNodeIds.has(l.nodeId));
    const engagedUsers = new Set(scopedLogs.map((l) => l.userId).filter(Boolean)).size;
    const avgTimeSec = totalViews > 0 ? Math.round(totalTimeSec / totalViews) : 0;

    const days: Array<{ label: string; iso: string; timeSec: number; views: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      const dayLogs = scopedLogs.filter((l) => l.createdAt.slice(0, 10) === iso);
      days.push({
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        iso,
        timeSec: dayLogs.reduce((acc, l) => acc + (l.durationSeconds || 0), 0),
        views: dayLogs.length,
      });
    }
    const maxSec = Math.max(1, ...days.map((d) => d.timeSec));
    return { totalTimeSec, avgTimeSec, totalViews, engagedUsers, days, maxSec };
  }, [data, fileMetrics]);

  const storageByCategory = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { category: string; count: number; bytes: number }>();
    for (const n of data.nodes) {
      if (n.isFolder || n.isTrashed) continue;
      const cat = n.category || "Other";
      const cur = map.get(cat) || { category: cat, count: 0, bytes: 0 };
      cur.count += 1;
      cur.bytes += n.sizeBytes || 0;
      map.set(cat, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.bytes - a.bytes);
  }, [data]);

  async function createSub(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "subscribe",
        name: subName,
        reportType: subTab,
        frequency: subFreq,
        format: "XLSX",
      }),
    });
    setShowSubModal(false);
    await loadReports();
    onChangeSubTab("subscriptions");
  }

  return (
    <div className="space-y-4">
      {/* Report Sub-tabs Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--apple-border)] bg-[var(--apple-surface)] p-1 text-xs">
          {[
            { id: "activity-log" as const, label: "Activity log" },
            { id: "documents-overview" as const, label: "Documents overview" },
            { id: "engagement-matrix" as const, label: "Engagement matrix" },
            { id: "data-storage" as const, label: "Data storage" },
            { id: "permissions" as const, label: "Permissions log" },
            { id: "subscriptions" as const, label: "Subscriptions" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChangeSubTab(t.id)}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                subTab === t.id
                  ? "bg-[#007AFF] text-white"
                  : "text-[var(--apple-text-secondary)] hover:text-[var(--apple-text)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {subTab !== "subscriptions" && (
          <div className="flex items-center gap-2">
            <a
              href={`/api/reports?export=${subTab === "permissions" ? "permissions" : subTab === "data-storage" ? "storage" : "activity"}`}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--apple-hover)]"
            >
              <Download className="h-3.5 w-3.5" /> Download report
            </a>
            <button
              type="button"
              onClick={() => setShowSubModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0066D6]"
            >
              <Bell className="h-3.5 w-3.5" /> Subscribe
            </button>
          </div>
        )}
      </div>

      {!data ? (
        <div className="apple-card p-12 text-center text-xs text-[var(--apple-text-muted)]">Loading reports...</div>
      ) : subTab === "activity-log" ? (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={reportOn}
              onChange={(e) => setReportOn(e.target.value)}
              className="rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-1.5"
            >
              <option>All actions</option>
              <option>Users and groups</option>
              <option>Project</option>
              <option>Documents</option>
            </select>
            <select
              value={periodDays}
              onChange={(e) => setPeriodDays(Number(e.target.value))}
              className="rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-1.5"
            >
              <option value={7}>Past week</option>
              <option value={30}>Past month</option>
              <option value={365}>All time</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-1.5"
            >
              <option value="">All categories</option>
              {["Documents", "Participants", "Permissions", "Q&A", "Reports", "Project settings", "Project archiving", "Drive sync"].map(
                (c) => (
                  <option key={c}>{c}</option>
                )
              )}
            </select>
            <select
              value={authorFilter}
              onChange={(e) => setAuthorFilter(e.target.value)}
              className="rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-1.5"
            >
              <option value="">All authors</option>
              {data.participants.map((p) => (
                <option key={p.id} value={p.email}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </select>
            {(categoryFilter || authorFilter || reportOn !== "All actions") && (
              <button
                type="button"
                onClick={() => {
                  setReportOn("All actions");
                  setCategoryFilter("");
                  setAuthorFilter("");
                }}
                className="font-medium text-[#007AFF]"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="apple-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--apple-border)] bg-[var(--apple-bg)]/50 text-[11px] font-semibold text-[var(--apple-text-secondary)]">
                <tr>
                  <th className="px-4 py-3">Date and time</th>
                  <th className="px-4 py-3">Author</th>
                  {showGroupCol && <th className="px-4 py-3">Group</th>}
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="w-10 px-3 py-3 text-right">
                    <div className="relative inline-block">
                      <button type="button" onClick={() => setShowColMenu((v) => !v)}>
                        <Columns3 className="h-3.5 w-3.5" />
                      </button>
                      {showColMenu && (
                        <div className="apple-glass absolute top-6 right-0 z-20 w-44 rounded-xl border border-[var(--apple-border-strong)] p-2.5 text-left font-normal shadow-xl">
                          <label className="flex items-center justify-between">
                            <span>Show Group column</span>
                            <input
                              type="checkbox"
                              checked={showGroupCol}
                              onChange={(e) => setShowGroupCol(e.target.checked)}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--apple-border)]">
                {filteredLogs.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => setDrawerLog(l)}
                    className="cursor-pointer hover:bg-[var(--apple-hover)]"
                  >
                    <td className="px-4 py-3 tabular-nums text-[var(--apple-text-secondary)]">
                      {formatDateTime(l.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{l.actorName}</div>
                      <div className="text-[11px] text-[var(--apple-text-muted)]">{l.actorEmail}</div>
                    </td>
                    {showGroupCol && <td className="px-4 py-3">{l.groupName}</td>}
                    <td className="px-4 py-3 font-medium">{l.action}</td>
                    <td dir="auto" className="px-4 py-3 text-[var(--apple-text-secondary)]">
                      {l.description}
                      {l.durationSeconds > 0 && ` • ${formatDuration(l.durationSeconds)}`}
                    </td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : subTab === "documents-overview" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
          <div className="apple-card p-3 text-xs">
            <div className="mb-2 font-semibold">Scope Folder</div>
            <button
              type="button"
              onClick={() => setSelectedFolderId(null)}
              className={`mb-1 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left ${
                !selectedFolderId ? "bg-[var(--apple-selected)] font-semibold text-[#007AFF]" : "hover:bg-[var(--apple-hover)]"
              }`}
            >
              <Folder className="h-3.5 w-3.5 text-[#007AFF]" /> {project.name} (All)
            </button>
            <div className="max-h-96 space-y-0.5 overflow-y-auto">
              {data.nodes
                .filter((n) => n.isFolder && !n.isTrashed)
                .map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFolderId(f.driveFileId)}
                    className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left ${
                      selectedFolderId === f.driveFileId
                        ? "bg-[var(--apple-selected)] font-semibold text-[#007AFF]"
                        : "hover:bg-[var(--apple-hover)]"
                    }`}
                  >
                    <Folder className="h-3.5 w-3.5 shrink-0 text-[#007AFF]" />
                    <span dir="auto" className="truncate">
                      {f.name}
                    </span>
                  </button>
                ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="apple-card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold">Top 10 files</span>
                <div className="flex items-center gap-2">
                  <select
                    value={topSortBy}
                    onChange={(e) => setTopSortBy(e.target.value as "time" | "views" | "recent")}
                    className="rounded-lg border border-[var(--apple-border)] bg-[var(--apple-bg)] px-2 py-1"
                  >
                    <option value="time">Sort by: Time viewed</option>
                    <option value="views">Sort by: Number of views</option>
                    <option value="recent">Sort by: Recently viewed</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setHideTop10((v) => !v)}
                    className="font-medium text-[#007AFF]"
                  >
                    {hideTop10 ? "Show top 10 files" : "Hide top 10 files"}
                  </button>
                </div>
              </div>
              {!hideTop10 && (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {fileMetrics.slice(0, 6).map((fm, idx) => (
                    <div key={fm.file.id} className="rounded-xl border border-[var(--apple-border)] bg-[var(--apple-bg)]/50 p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <FileText className="h-4 w-4 text-rose-500" />
                        {idx === 0 && <Flame className="h-4 w-4 text-amber-500" />}
                      </div>
                      <div dir="auto" className="mt-2 truncate font-semibold">
                        {fm.file.name}
                      </div>
                      <div className="mt-1 text-[11px] text-[var(--apple-text-muted)]">
                        {fm.views} views · {formatDuration(fm.timeSec)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="apple-card overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--apple-border)] bg-[var(--apple-bg)]/50 text-[11px] font-semibold text-[var(--apple-text-secondary)]">
                  <tr>
                    <th className="px-4 py-3">Participant</th>
                    <th className="px-4 py-3">Views</th>
                    <th className="px-4 py-3">Time spent</th>
                    <th className="px-4 py-3">Last activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--apple-border)]">
                  {data.participants.map((p) => {
                    const pLogs = data.logs.filter((l) => l.userId === p.userId && l.nodeId);
                    const totalSec = pLogs.reduce((a, l) => a + (l.durationSeconds || 0), 0);
                    return (
                      <tr key={p.id}>
                        <td className="px-4 py-3 font-medium">
                          {p.firstName} {p.lastName}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{pLogs.length}</td>
                        <td className="px-4 py-3 tabular-nums">{formatDuration(totalSec)}</td>
                        <td className="px-4 py-3 tabular-nums text-[var(--apple-text-muted)]">
                          {formatDateShort(p.lastSignInAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="apple-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Summary</h3>
                <span className="text-[11px] text-[var(--apple-text-muted)]">
                  {selectedFolderId ? "Selected folder scope" : "All mirrored documents"} ({fileMetrics.length} files)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div className="rounded-xl border border-[var(--apple-border)] bg-[var(--apple-bg)]/50 p-3">
                  <div className="text-[11px] text-[var(--apple-text-muted)]">Total viewing time</div>
                  <div className="mt-1 text-base font-semibold tabular-nums">
                    {formatDuration(overviewAnalytics.totalTimeSec)}
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--apple-border)] bg-[var(--apple-bg)]/50 p-3">
                  <div className="text-[11px] text-[var(--apple-text-muted)]">Avg. viewing time</div>
                  <div className="mt-1 text-base font-semibold tabular-nums">
                    {formatDuration(overviewAnalytics.avgTimeSec)}
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--apple-border)] bg-[var(--apple-bg)]/50 p-3">
                  <div className="text-[11px] text-[var(--apple-text-muted)]">Total views</div>
                  <div className="mt-1 text-base font-semibold tabular-nums">{overviewAnalytics.totalViews}</div>
                </div>
                <div className="rounded-xl border border-[var(--apple-border)] bg-[var(--apple-bg)]/50 p-3">
                  <div className="text-[11px] text-[var(--apple-text-muted)]">Participants engaged</div>
                  <div className="mt-1 text-base font-semibold tabular-nums">{overviewAnalytics.engagedUsers}</div>
                </div>
              </div>
            </div>

            <div className="apple-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Dynamics of viewing time</h3>
                <span className="text-[11px] text-[var(--apple-text-muted)]">Last 14 days</span>
              </div>
              <div className="flex h-28 items-end gap-1.5 pt-2">
                {overviewAnalytics.days.map((d) => {
                  const pct = d.timeSec > 0 ? Math.max(8, Math.round((d.timeSec / overviewAnalytics.maxSec) * 100)) : 4;
                  return (
                    <div key={d.iso} className="group flex flex-1 flex-col items-center gap-1">
                      <div className="flex h-20 w-full items-end">
                        <div
                          title={`${d.label}: ${formatDuration(d.timeSec)} (${d.views} views)`}
                          style={{ height: `${pct}%` }}
                          className={`w-full rounded-t-md transition ${
                            d.timeSec > 0 ? "bg-[#007AFF] group-hover:bg-[#0A84FF]" : "bg-[var(--apple-border)]"
                          }`}
                        />
                      </div>
                      <span className="hidden text-[9px] text-[var(--apple-text-muted)] sm:block">
                        {d.iso.slice(8)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : subTab === "engagement-matrix" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="inline-flex rounded-xl border border-[var(--apple-border)] bg-[var(--apple-surface)] p-1">
              <button
                type="button"
                onClick={() => setMatrixMode("groups")}
                className={`rounded-lg px-3 py-1 font-medium ${matrixMode === "groups" ? "bg-[#007AFF] text-white" : ""}`}
              >
                Groups
              </button>
              <button
                type="button"
                onClick={() => setMatrixMode("documents")}
                className={`rounded-lg px-3 py-1 font-medium ${matrixMode === "documents" ? "bg-[#007AFF] text-white" : ""}`}
              >
                By documents
              </button>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeDeletedGroups}
                onChange={(e) => setIncludeDeletedGroups(e.target.checked)}
              />
              <span>Include deleted groups</span>
            </label>
          </div>

          <div className="apple-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--apple-border)] bg-[var(--apple-bg)]/50 text-[11px] font-semibold text-[var(--apple-text-secondary)]">
                <tr>
                  <th className="px-4 py-3">{matrixMode === "groups" ? "Document" : "Group"}</th>
                  <th className="px-4 py-3 text-center">Total</th>
                  <th className="px-4 py-3 text-center">Views</th>
                  <th className="px-4 py-3 text-center">Downloads</th>
                  <th className="px-4 py-3 text-center">Prints</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--apple-border)]">
                {(matrixMode === "groups"
                  ? data.nodes
                      .filter((n) => !n.isFolder && !n.isTrashed)
                      .map((n) => {
                        const nLogs = data.logs.filter((l) => l.nodeId === n.id);
                        return {
                          id: n.id,
                          label: `${n.dotIndex} ${n.name}`,
                          views: nLogs.filter((l) => l.action.includes("viewed")).length,
                          downloads: nLogs.filter((l) => l.action.includes("downloaded")).length,
                          prints: nLogs.filter((l) => l.action.includes("printed")).length,
                        };
                      })
                  : data.groups
                      .filter((g) => includeDeletedGroups || !g.isDeleted)
                      .map((g) => {
                        const gLogs = data.logs.filter((l) => l.groupId === g.id || l.groupName === g.name);
                        return {
                          id: g.id,
                          label: g.name,
                          views: gLogs.filter((l) => l.action.includes("viewed")).length,
                          downloads: gLogs.filter((l) => l.action.includes("downloaded")).length,
                          prints: gLogs.filter((l) => l.action.includes("printed")).length,
                        };
                      })
                ).map((row) => {
                  const total = row.views + row.downloads + row.prints;
                  return (
                    <tr key={row.id}>
                      <td dir="auto" className="px-4 py-2.5 font-medium">
                        {row.label}
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums font-semibold">{total}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums">
                        <span className={`inline-block min-w-8 rounded px-2 py-0.5 ${row.views > 0 ? "bg-[#007AFF]/20 text-[#007AFF]" : ""}`}>
                          {row.views}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums">
                        <span className={`inline-block min-w-8 rounded px-2 py-0.5 ${row.downloads > 0 ? "bg-emerald-500/20 text-emerald-500" : ""}`}>
                          {row.downloads}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums">{row.prints}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : subTab === "data-storage" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium">Unit:</span>
            {(["MB", "GB"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setStorageUnit(u)}
                className={`rounded-lg px-2.5 py-1 font-medium ${
                  storageUnit === u ? "bg-[#007AFF] text-white" : "border border-[var(--apple-border)]"
                }`}
              >
                {u}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {storageByCategory.map((cat) => (
              <div key={cat.category} className="apple-card p-4 text-xs">
                <div className="text-[11px] font-medium text-[var(--apple-text-muted)]">{cat.category}</div>
                <div className="mt-1 text-base font-semibold tabular-nums">
                  {storageUnit === "GB"
                    ? `${(cat.bytes / (1024 * 1024 * 1024)).toFixed(3)} GB`
                    : `${(cat.bytes / (1024 * 1024)).toFixed(2)} MB`}
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--apple-text-secondary)]">{cat.count} file(s)</div>
              </div>
            ))}
          </div>

          <div className="apple-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--apple-border)] bg-[var(--apple-bg)]/50 text-[11px] font-semibold text-[var(--apple-text-secondary)]">
                <tr>
                  <th className="px-4 py-3">Index</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Size ({storageUnit})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--apple-border)]">
                {data.nodes
                  .filter((n) => !n.isFolder && !n.isTrashed)
                  .map((n) => (
                    <tr key={n.id}>
                      <td className="px-4 py-2.5 tabular-nums">{n.dotIndex}</td>
                      <td dir="auto" className="px-4 py-2.5 font-medium">
                        {n.name}
                      </td>
                      <td className="px-4 py-2.5">{n.category}</td>
                      <td className="px-4 py-2.5 tabular-nums">{formatBytes(n.sizeBytes, storageUnit)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : subTab === "permissions" ? (
        <div className="apple-card overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--apple-border)] bg-[var(--apple-bg)]/50 text-[11px] font-semibold text-[var(--apple-text-secondary)]">
              <tr>
                <th className="px-4 py-3">Date and time</th>
                <th className="px-4 py-3">Author</th>
                <th className="px-4 py-3">Target group</th>
                <th className="px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--apple-border)]">
              {data.logs
                .filter((l) => l.category === "Permissions")
                .map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 tabular-nums text-[var(--apple-text-secondary)]">{formatDateTime(l.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">{l.actorName}</td>
                    <td className="px-4 py-3">{l.groupName}</td>
                    <td className="px-4 py-3 text-[var(--apple-text-secondary)]">{l.description}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Subscriptions */
        <div className="apple-card overflow-hidden">
          {data.subscriptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-xs">
              <Bell className="mb-3 h-9 w-9 text-[#007AFF]" />
              <h3 className="text-sm font-semibold">You have no subscriptions yet</h3>
              <p className="mt-1 text-[var(--apple-text-secondary)]">
                Create a scheduled report from Activity log or any report view.
              </p>
              <button
                type="button"
                onClick={() => onChangeSubTab("activity-log")}
                className="mt-4 rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white"
              >
                Go to activity log
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--apple-border)] bg-[var(--apple-bg)]/50 text-[11px] font-semibold text-[var(--apple-text-secondary)]">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Report type</th>
                  <th className="px-4 py-3">Frequency</th>
                  <th className="px-4 py-3">Format</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--apple-border)]">
                {data.subscriptions.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3">{s.reportType}</td>
                    <td className="px-4 py-3">{s.frequency}</td>
                    <td className="px-4 py-3">{s.format}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.enabled ? "bg-emerald-500/15 text-emerald-500" : "bg-zinc-500/15 text-zinc-400"}`}>
                        {s.enabled ? "Active" : "Paused"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch("/api/reports", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "toggle-subscription", id: s.id }),
                            });
                            loadReports();
                          }}
                          className="rounded p-1 hover:bg-[var(--apple-hover)]"
                        >
                          {s.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch("/api/reports", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "delete-subscription", id: s.id }),
                            });
                            loadReports();
                          }}
                          className="rounded p-1 text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Activity Details Right Drawer */}
      {drawerLog && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs" onClick={() => setDrawerLog(null)}>
          <div className="apple-card h-full w-full max-w-md rounded-none p-6 text-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[var(--apple-border)] pb-3">
              <h3 className="text-base font-semibold">{drawerLog.action}</h3>
              <button type="button" onClick={() => setDrawerLog(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-[var(--apple-border)] bg-[var(--apple-bg)]/50 p-3">
                <div className="font-semibold">{drawerLog.actorName}</div>
                <div className="text-[var(--apple-text-muted)]">{drawerLog.actorEmail}</div>
                <span className="mt-2 inline-block rounded-full bg-[#007AFF]/15 px-2.5 py-0.5 text-[10px] font-semibold text-[#007AFF]">
                  {drawerLog.groupName}
                </span>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-[var(--apple-text-muted)]">Category:</span> {drawerLog.category}
                </div>
                <div>
                  <span className="text-[var(--apple-text-muted)]">Timestamp:</span> {formatDateTime(drawerLog.createdAt)}
                </div>
                <div>
                  <span className="text-[var(--apple-text-muted)]">Details:</span> {drawerLog.description}
                </div>
                {drawerLog.durationSeconds > 0 && (
                  <div>
                    <span className="text-[var(--apple-text-muted)]">Viewing duration:</span>{" "}
                    {formatDuration(drawerLog.durationSeconds)}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setAuthorFilter(drawerLog.actorEmail);
                  setDrawerLog(null);
                }}
                className="w-full rounded-xl border border-[var(--apple-border)] py-2 font-medium hover:bg-[var(--apple-hover)]"
              >
                Filter Activity log by this author
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscribe Modal */}
      {showSubModal && (
        <form
          onSubmit={createSub}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="apple-card w-full max-w-md space-y-4 p-6 text-xs">
            <h3 className="text-base font-semibold">Subscribe to report</h3>
            <div>
              <label className="mb-1 block font-medium">Name</label>
              <input
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium">Frequency</label>
              <select
                value={subFreq}
                onChange={(e) => setSubFreq(e.target.value)}
                className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
              >
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
                <option>Custom</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSubModal(false)}
                className="rounded-xl border border-[var(--apple-border)] px-4 py-2"
              >
                Cancel
              </button>
              <button type="submit" className="rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white">
                Subscribe
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
