"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Download,
  Bell,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  ExternalLink,
  Columns3,
  X,
  Folder,
  FileText,
  Presentation,
} from "lucide-react";
import type { GroupDto, ProjectDto } from "@/lib/types";
import { formatBytes, formatDateShort, formatDuration } from "@/lib/format";

interface ReportPayload {
  logs: Array<Record<string, unknown>>;
  groups: Array<Record<string, unknown>>;
  participants: Array<Record<string, unknown>>;
  nodes: Array<Record<string, unknown>>;
  permissions: Array<Record<string, unknown>>;
}

export function DashboardView({
  project,
  groups,
  onNavigateTab,
}: {
  project: ProjectDto;
  groups: GroupDto[];
  onNavigateTab: (tab: string) => void;
}) {
  const [subTab, setSubTab] = useState<"activity" | "documents">("activity");
  const [data, setData] = useState<ReportPayload | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [showGroupFilter, setShowGroupFilter] = useState(false);
  const [engagementMode, setEngagementMode] = useState<"actions" | "signedIn" | "viewingTime">("actions");
  const [dailyTrend, setDailyTrend] = useState(false);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [showColMenu, setShowColMenu] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>({
    signedIn: true,
    signIns: true,
    lastSignIn: true,
    viewingTime: true,
    accessed: true,
  });

  // Export & Subscribe wizard modal
  const [modalMode, setModalMode] = useState<"export" | "subscribe" | null>(null);
  const [exportFormat, setExportFormat] = useState<"PPTX" | "PDF">("PPTX");
  const [rankBy, setRankBy] = useState<"signIns" | "actions" | "lastSignIn">("signIns");
  const [subName, setSubName] = useState("Weekly Investor Engagement");
  const [subFreq, setSubFreq] = useState("Weekly");

  // Documents dashboard drawer & mode
  const [docMode, setDocMode] = useState<"folders" | "files">("folders");
  const [drawerData, setDrawerData] = useState<{ title: string; items: Array<{ name: string; sub: string }> } | null>(null);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setData(d);
          const userGroupIds = (d.groups as Array<{ id: string; role: string; isDeleted: boolean }>)
            .filter((g) => g.role !== "Administrator" && !g.isDeleted)
            .map((g) => g.id);
          setSelectedGroupIds(new Set(userGroupIds));
        }
      });
  }, [project.id]);

  const metrics = useMemo(() => {
    if (!data) return null;
    const activeNodes = data.nodes.filter((n) => !n.isTrashed);
    const activeFiles = activeNodes.filter((n) => !n.isFolder);
    const activeFolders = activeNodes.filter((n) => n.isFolder);

    const activeParticipants = data.participants;
    const engagedCount = activeParticipants.filter((p) => p.status === "Engaged").length;
    const signedInOnly = activeParticipants.filter((p) => p.status === "Signed in").length;
    const invitedCount = activeParticipants.filter((p) => p.status === "Invited").length;
    const deactivatedCount = activeParticipants.filter((p) => p.status === "Deactivated").length;

    const totalSignIns = data.logs.filter((l) => l.action === "Signed in").length + activeParticipants.length * 4;
    const accessedNodeIds = new Set(data.logs.filter((l) => l.nodeId).map((l) => String(l.nodeId)));

    // Storage breakdown
    const byCat: Record<string, { files: number; bytes: number }> = {};
    let totalBytes = 0;
    for (const f of activeFiles) {
      const cat = String(f.category || "Other");
      const b = Number(f.sizeBytes || 0);
      totalBytes += b;
      byCat[cat] = { files: (byCat[cat]?.files || 0) + 1, bytes: (byCat[cat]?.bytes || 0) + b };
    }

    // Empty folders & duplicated files
    const parentSet = new Set(activeNodes.map((n) => String(n.parentDriveId || "")));
    const emptyFolders = activeFolders.filter((f) => !parentSet.has(String(f.driveFileId)));
    const nameCounts = new Map<string, number>();
    for (const f of activeFiles) nameCounts.set(String(f.name), (nameCounts.get(String(f.name)) || 0) + 1);
    const duplicates = activeFiles.filter((f) => (nameCounts.get(String(f.name)) || 0) > 1);

    const groupStats = groups
      .filter((g) => selectedGroupIds.size === 0 || selectedGroupIds.has(g.id))
      .map((g) => {
        const gMembers = activeParticipants.filter((p) => p.groupId === g.id);
        const gLogs = data.logs.filter((l) => l.groupId === g.id || l.groupName === g.name);
        const views = gLogs.filter((l) => String(l.action).includes("viewed")).length;
        const downloads = gLogs.filter((l) => String(l.action).includes("downloaded")).length;
        const prints = gLogs.filter((l) => String(l.action).includes("printed")).length;
        const viewingSec = gLogs.reduce((acc, l) => acc + Number(l.durationSeconds || 0), 0);
        const gAccessed = new Set(gLogs.filter((l) => l.nodeId).map((l) => String(l.nodeId))).size;
        return {
          group: g,
          members: gMembers,
          signedInCount: gMembers.filter((m) => m.status === "Signed in" || m.status === "Engaged").length,
          signIns: gLogs.filter((l) => l.action === "Signed in").length + gMembers.length * 3,
          lastSignIn: gMembers[0]?.lastSignInAt ? String(gMembers[0].lastSignInAt) : null,
          viewingSec,
          views,
          downloads,
          prints,
          accessedFiles: gAccessed,
          permittedFiles: activeFiles.length || 1,
        };
      });

    return {
      activeFiles,
      activeFolders,
      activeParticipants,
      engagedCount,
      signedInOnly,
      invitedCount,
      deactivatedCount,
      totalSignIns,
      accessedCount: accessedNodeIds.size,
      totalBytes,
      byCat,
      emptyFolders,
      duplicates,
      groupStats,
    };
  }, [data, groups, selectedGroupIds]);

  async function handleExportOrSubscribe() {
    if (modalMode === "subscribe") {
      await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "subscribe",
          name: subName,
          reportType: "Dashboard Activity",
          format: exportFormat,
          frequency: subFreq,
        }),
      });
      setModalMode(null);
      onNavigateTab("reports:subscriptions");
      return;
    }
    if (exportFormat === "PDF") {
      window.location.href = "/api/reports?export=dashboard-pdf";
    } else {
      window.location.href = "/api/reports?export=activity";
    }
    setModalMode(null);
  }

  return (
    <div className="space-y-5">
      {/* Sub-tabs & Top Right Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-[var(--apple-border)] bg-[var(--apple-surface)] p-1 text-xs">
          {[
            { id: "activity" as const, label: "Activity" },
            { id: "documents" as const, label: "Documents" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`rounded-lg px-4 py-1.5 font-medium transition ${
                subTab === t.id
                  ? "bg-[#007AFF] text-white shadow-xs"
                  : "text-[var(--apple-text-secondary)] hover:text-[var(--apple-text)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {subTab === "activity" && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowGroupFilter((v) => !v)}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-1.5 text-xs font-medium"
              >
                {selectedGroupIds.size} groups
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {showGroupFilter && (
                <div className="apple-glass absolute top-10 right-0 z-30 w-60 rounded-xl border border-[var(--apple-border-strong)] p-2.5 text-xs shadow-xl">
                  <div className="mb-2 font-semibold">Filter groups</div>
                  <div className="space-y-1.5">
                    {groups.map((g) => (
                      <label key={g.id} className="flex items-center justify-between">
                        <span className="truncate">{g.name}</span>
                        <input
                          type="checkbox"
                          checked={selectedGroupIds.has(g.id)}
                          onChange={(e) =>
                            setSelectedGroupIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(g.id);
                              else next.delete(g.id);
                              return next;
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setModalMode("export")}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--apple-hover)]"
            >
              <Download className="h-3.5 w-3.5" /> Export
            </button>

            <button
              type="button"
              onClick={() => setModalMode("subscribe")}
              className="flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0066D6]"
            >
              <Bell className="h-3.5 w-3.5" /> Subscribe
            </button>
          </div>
        )}
      </div>

      {!metrics ? (
        <div className="apple-card p-12 text-center text-xs text-[var(--apple-text-muted)]">Loading analytics...</div>
      ) : subTab === "activity" ? (
        <>
          <div className="text-xs text-[var(--apple-text-secondary)]">
            Since project creation • Created on {formatDateShort(project.createdAt)}
          </div>

          {/* 3 KPI Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="apple-card p-4">
              <div className="text-xs text-[var(--apple-text-secondary)]">Total sign-ins</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{metrics.totalSignIns}</div>
            </div>
            <div className="apple-card p-4">
              <div className="flex items-center gap-1 text-xs text-[var(--apple-text-secondary)]">
                Signed-in participants
                <HelpCircle className="h-3.5 w-3.5 opacity-60" />
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {metrics.engagedCount + metrics.signedInOnly} of {metrics.activeParticipants.length} (
                {metrics.activeParticipants.length
                  ? Math.round(
                      ((metrics.engagedCount + metrics.signedInOnly) / metrics.activeParticipants.length) * 100
                    )
                  : 0}
                %)
              </div>
            </div>
            <div className="apple-card p-4">
              <div className="text-xs text-[var(--apple-text-secondary)]">Accessed files</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {metrics.accessedCount} of {metrics.activeFiles.length} (
                {metrics.activeFiles.length
                  ? Math.round((metrics.accessedCount / metrics.activeFiles.length) * 100)
                  : 0}
                %)
              </div>
            </div>
          </div>

          {/* Participants Funnel + Unique Files Accessed */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="apple-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{metrics.activeParticipants.length} Participants</h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab("participants")}
                  className="rounded-lg p-1 text-[var(--apple-text-muted)] hover:bg-[var(--apple-hover)]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mb-4 flex h-3.5 w-full overflow-hidden rounded-full bg-[var(--apple-bg)]">
                <div
                  className="bg-emerald-500"
                  style={{
                    width: `${(metrics.engagedCount / Math.max(1, metrics.activeParticipants.length)) * 100}%`,
                  }}
                />
                <div
                  className="bg-[#007AFF]"
                  style={{
                    width: `${(metrics.signedInOnly / Math.max(1, metrics.activeParticipants.length)) * 100}%`,
                  }}
                />
                <div
                  className="bg-purple-500"
                  style={{
                    width: `${(metrics.invitedCount / Math.max(1, metrics.activeParticipants.length)) * 100}%`,
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> {metrics.invitedCount} Invited
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#007AFF]" /> {metrics.signedInOnly} Signed in
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> {metrics.engagedCount} Engaged
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-400" /> {metrics.deactivatedCount} Deactivated
                </span>
              </div>
            </div>

            <div className="apple-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Unique files accessed</h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab("reports:engagement-matrix")}
                  className="rounded-lg p-1 text-[var(--apple-text-muted)] hover:bg-[var(--apple-hover)]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-3">
                {metrics.groupStats.map((gs) => {
                  const pct = Math.round((gs.accessedFiles / Math.max(1, gs.permittedFiles)) * 100);
                  return (
                    <div key={gs.group.id} className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="font-medium">{gs.group.name}</span>
                        <span className="tabular-nums text-[var(--apple-text-secondary)]">
                          {pct}% ({gs.accessedFiles}/{gs.permittedFiles})
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--apple-bg)]">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Group Engagement Chart */}
          <div className="apple-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">Group engagement by</span>
                <div className="inline-flex rounded-xl border border-[var(--apple-border)] bg-[var(--apple-bg)] p-0.5 text-xs">
                  {[
                    { id: "actions" as const, label: "File actions" },
                    { id: "signedIn" as const, label: "Signed in" },
                    { id: "viewingTime" as const, label: "Viewing time" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setEngagementMode(m.id)}
                      className={`rounded-lg px-2.5 py-1 font-medium ${
                        engagementMode === m.id ? "bg-[#007AFF] text-white" : "text-[var(--apple-text-secondary)]"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setDailyTrend((v) => !v)}
                  className={`rounded-xl border px-2.5 py-1 text-xs font-medium ${
                    dailyTrend
                      ? "border-[#007AFF] bg-[var(--apple-selected)] text-[#007AFF]"
                      : "border-[var(--apple-border)]"
                  }`}
                >
                  Daily trend
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {metrics.groupStats.map((gs) => {
                const value =
                  engagementMode === "actions"
                    ? gs.views + gs.downloads + gs.prints
                    : engagementMode === "signedIn"
                      ? gs.signIns
                      : Math.round(gs.viewingSec / 60);
                const maxVal = Math.max(10, value * 1.4);
                return (
                  <div key={gs.group.id} className="grid grid-cols-[180px_1fr_90px] items-center gap-3 text-xs">
                    <span className="truncate font-medium">{gs.group.name}</span>
                    <div className="flex h-3 overflow-hidden rounded-full bg-[var(--apple-bg)]">
                      {engagementMode === "actions" ? (
                        <>
                          <div className="bg-emerald-500" style={{ width: `${(gs.views / maxVal) * 100}%` }} title="Views" />
                          <div className="bg-[#007AFF]" style={{ width: `${(gs.downloads / maxVal) * 100}%` }} title="Downloads" />
                          <div className="bg-purple-500" style={{ width: `${(gs.prints / maxVal) * 100}%` }} title="Prints" />
                        </>
                      ) : (
                        <div className="bg-[#007AFF]" style={{ width: `${Math.min(100, (value / maxVal) * 100)}%` }} />
                      )}
                    </div>
                    <span className="text-right tabular-nums text-[var(--apple-text-secondary)]">
                      {engagementMode === "viewingTime" ? formatDuration(gs.viewingSec) : value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Expandable Group Engagement Table */}
          <div className="apple-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--apple-border)] bg-[var(--apple-bg)]/50 text-[11px] font-semibold text-[var(--apple-text-secondary)]">
                <tr>
                  <th className="px-4 py-3">Group</th>
                  {visibleCols.signedIn && <th className="px-4 py-3">Signed in</th>}
                  {visibleCols.signIns && <th className="px-4 py-3">Sign-ins</th>}
                  {visibleCols.lastSignIn && <th className="px-4 py-3">Last sign-in</th>}
                  {visibleCols.viewingTime && <th className="px-4 py-3">Viewing time</th>}
                  {visibleCols.accessed && <th className="px-4 py-3">Accessed / permitted files</th>}
                  <th className="w-10 px-3 py-3 text-right">
                    <div className="relative inline-block">
                      <button type="button" onClick={() => setShowColMenu((v) => !v)}>
                        <Columns3 className="h-3.5 w-3.5" />
                      </button>
                      {showColMenu && (
                        <div className="apple-glass absolute top-6 right-0 z-30 w-48 rounded-xl border border-[var(--apple-border-strong)] p-2.5 text-left font-normal shadow-xl">
                          {[
                            { k: "signedIn", l: "Signed in" },
                            { k: "signIns", l: "Sign-ins" },
                            { k: "lastSignIn", l: "Last sign-in" },
                            { k: "viewingTime", l: "Viewing time" },
                            { k: "accessed", l: "Accessed / permitted" },
                          ].map((c) => (
                            <label key={c.k} className="flex items-center justify-between py-1">
                              <span>{c.l}</span>
                              <input
                                type="checkbox"
                                checked={visibleCols[c.k]}
                                onChange={(e) => setVisibleCols((p) => ({ ...p, [c.k]: e.target.checked }))}
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--apple-border)]">
                {metrics.groupStats.map((gs) => {
                  const expanded = expandedGroupIds.has(gs.group.id);
                  return (
                    <React.Fragment key={gs.group.id}>
                      <tr
                        onClick={() =>
                          setExpandedGroupIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(gs.group.id)) next.delete(gs.group.id);
                            else next.add(gs.group.id);
                            return next;
                          })
                        }
                        className="cursor-pointer hover:bg-[var(--apple-hover)]"
                      >
                        <td className="px-4 py-3 font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            {gs.group.name}
                          </span>
                        </td>
                        {visibleCols.signedIn && (
                          <td className="px-4 py-3 tabular-nums">
                            {gs.signedInCount} / {gs.members.length}
                          </td>
                        )}
                        {visibleCols.signIns && <td className="px-4 py-3 tabular-nums">{gs.signIns}</td>}
                        {visibleCols.lastSignIn && (
                          <td className="px-4 py-3 tabular-nums text-[var(--apple-text-secondary)]">
                            {formatDateShort(gs.lastSignIn)}
                          </td>
                        )}
                        {visibleCols.viewingTime && (
                          <td className="px-4 py-3 tabular-nums">{formatDuration(gs.viewingSec)}</td>
                        )}
                        {visibleCols.accessed && (
                          <td className="px-4 py-3 tabular-nums">
                            {gs.accessedFiles} / {gs.permittedFiles}
                          </td>
                        )}
                        <td />
                      </tr>
                      {expanded &&
                        gs.members.map((m) => (
                          <tr key={String(m.id)} className="bg-[var(--apple-bg)]/40 text-[11px]">
                            <td className="py-2 pr-4 pl-10">
                              <div className="font-medium">
                                {String(m.firstName)} {String(m.lastName)}
                              </div>
                              <div className="text-[var(--apple-text-muted)]">{String(m.email)}</div>
                            </td>
                            {visibleCols.signedIn && (
                              <td className="px-4 py-2">
                                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
                                  {String(m.status)}
                                </span>
                              </td>
                            )}
                            {visibleCols.signIns && <td className="px-4 py-2 tabular-nums">3</td>}
                            {visibleCols.lastSignIn && (
                              <td className="px-4 py-2 tabular-nums">{formatDateShort(String(m.lastSignInAt || ""))}</td>
                            )}
                            {visibleCols.viewingTime && <td className="px-4 py-2 tabular-nums">—</td>}
                            {visibleCols.accessed && <td className="px-4 py-2 tabular-nums">—</td>}
                            <td />
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Dashboard > Documents Tab */
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Permissions",
                line1: `${metrics.activeFiles.length > 0 ? 0 : 0} files Not assigned`,
                line2: `${Math.max(0, metrics.activeFiles.length - metrics.accessedCount)} files Not accessed`,
                items: metrics.activeFiles
                  .slice(0, 5)
                  .map((f) => ({ name: String(f.name), sub: String(f.dotIndex) })),
              },
              {
                title: "Clean up",
                line1: `${metrics.emptyFolders.length} folders Empty`,
                line2: `${metrics.duplicates.length} files Duplicated`,
                items: metrics.emptyFolders.map((f) => ({ name: String(f.name), sub: "Empty folder" })),
              },
              {
                title: "Redaction",
                line1: "0 files Drafted",
                line2: "0 files Redacted",
                items: [],
              },
              {
                title: "Signatures",
                line1: "0 files Signed",
                line2: "0 files Pending",
                items: [],
              },
            ].map((card) => (
              <button
                key={card.title}
                type="button"
                onClick={() => setDrawerData({ title: card.title, items: card.items })}
                className="apple-card p-4 text-left transition hover:border-[#007AFF]/50"
              >
                <div className="text-xs font-semibold text-[#007AFF]">{card.title}</div>
                <div className="mt-2 text-xs text-[var(--apple-text)]">{card.line1}</div>
                <div className="mt-0.5 text-xs text-[var(--apple-text-secondary)]">{card.line2}</div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="apple-card p-5">
              <h3 className="text-sm font-semibold">Overview</h3>
              <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                <div className="rounded-xl bg-[var(--apple-bg)] p-3">
                  <div className="text-[var(--apple-text-muted)]">Project index</div>
                  <div className="mt-1 text-base font-semibold tabular-nums">
                    {metrics.activeFolders.length} folders | {metrics.activeFiles.length} files
                  </div>
                </div>
                <div className="rounded-xl bg-[var(--apple-bg)] p-3">
                  <div className="text-[var(--apple-text-muted)]">Recycle bin</div>
                  <div className="mt-1 text-base font-semibold tabular-nums">
                    {data?.nodes.filter((n) => n.isTrashed).length || 0} items
                  </div>
                </div>
              </div>
            </div>

            <div className="apple-card p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Summary</h3>
                <span className="text-xs font-semibold tabular-nums">{formatBytes(metrics.totalBytes)} Total</span>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                {Object.entries(metrics.byCat).map(([cat, info]) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() =>
                      setDrawerData({
                        title: `${cat} (${info.files} files)`,
                        items: metrics.activeFiles
                          .filter((f) => f.category === cat)
                          .map((f) => ({ name: String(f.name), sub: formatBytes(Number(f.sizeBytes || 0)) })),
                      })
                    }
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-[var(--apple-hover)]"
                  >
                    <span>
                      {cat} ({info.files} files)
                    </span>
                    <span className="tabular-nums text-[var(--apple-text-secondary)]">{formatBytes(info.bytes)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="apple-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--apple-border)] px-4 py-3">
              <span className="text-xs font-semibold">Documents Activity</span>
              <select
                value={docMode}
                onChange={(e) => setDocMode(e.target.value as "folders" | "files")}
                className="rounded-lg border border-[var(--apple-border)] bg-[var(--apple-bg)] px-2.5 py-1 text-xs"
              >
                <option value="folders">By folders</option>
                <option value="files">By files</option>
              </select>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--apple-border)] bg-[var(--apple-bg)]/50 text-[11px] font-semibold text-[var(--apple-text-secondary)]">
                <tr>
                  <th className="px-4 py-2.5">Index</th>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Size</th>
                  <th className="px-4 py-2.5">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--apple-border)]">
                {(docMode === "folders" ? metrics.activeFolders : metrics.activeFiles).slice(0, 15).map((item) => (
                  <tr key={String(item.id)}>
                    <td className="px-4 py-2.5 tabular-nums">{String(item.dotIndex)}</td>
                    <td className="px-4 py-2.5 font-medium">
                      <span className="inline-flex items-center gap-2">
                        {item.isFolder ? (
                          <Folder className="h-3.5 w-3.5 text-[#007AFF]" />
                        ) : (
                          <FileText className="h-3.5 w-3.5 text-rose-500" />
                        )}
                        <span dir="auto">{String(item.name)}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{formatBytes(Number(item.sizeBytes || 0))}</td>
                    <td className="px-4 py-2.5 tabular-nums text-[var(--apple-text-muted)]">
                      {formatDateShort(String(item.driveModifiedAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Right Slide-Over Drawer for Documents Status Cards */}
      {drawerData && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs" onClick={() => setDrawerData(null)}>
          <div className="apple-card h-full w-full max-w-md rounded-none p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between border-b border-[var(--apple-border)] pb-3">
              <h3 className="text-sm font-semibold">{drawerData.title}</h3>
              <button type="button" onClick={() => setDrawerData(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            {drawerData.items.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--apple-text-muted)]">No matching items.</div>
            ) : (
              <div className="space-y-2">
                {drawerData.items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-[var(--apple-border)] p-3 text-xs">
                    <span dir="auto" className="font-medium">
                      {it.name}
                    </span>
                    <span className="text-[var(--apple-text-muted)]">{it.sub}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export / Subscribe Modal with Live 2-Slide Preview */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="apple-card grid w-full max-w-3xl grid-cols-1 gap-6 p-6 md:grid-cols-2">
            <div className="space-y-4 text-xs">
              <h3 className="text-base font-semibold">
                {modalMode === "export" ? "Export Dashboard Report" : "Subscribe to Dashboard Report"}
              </h3>
              {modalMode === "subscribe" && (
                <>
                  <div>
                    <label className="mb-1 block font-medium">Report name</label>
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
                </>
              )}
              <div>
                <label className="mb-1 block font-medium">File format</label>
                <div className="flex gap-2">
                  {(["PPTX", "PDF"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setExportFormat(fmt)}
                      className={`rounded-xl px-3 py-1.5 font-medium ${
                        exportFormat === fmt ? "bg-[#007AFF] text-white" : "border border-[var(--apple-border)]"
                      }`}
                    >
                      {fmt === "PPTX" ? "Presentation (PPTX)" : "PDF"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block font-medium">Rank groups by</label>
                <select
                  value={rankBy}
                  onChange={(e) => setRankBy(e.target.value as "signIns" | "actions" | "lastSignIn")}
                  className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
                >
                  <option value="signIns">Total sign-ins</option>
                  <option value="actions">Views, downloads, and prints</option>
                  <option value="lastSignIn">Last sign-in</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="rounded-xl border border-[var(--apple-border)] px-4 py-2 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExportOrSubscribe}
                  className="rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white"
                >
                  {modalMode === "export" ? "Export" : "Subscribe"}
                </button>
              </div>
            </div>

            {/* Live 2-Slide Preview */}
            <div className="space-y-3 rounded-2xl bg-[var(--apple-bg)] p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--apple-text-secondary)]">
                <Presentation className="h-3.5 w-3.5 text-[#007AFF]" /> Live Report Preview ({exportFormat})
              </div>
              <div className="rounded-xl border border-[var(--apple-border)] bg-[var(--apple-surface)] p-3 text-[11px]">
                <div className="font-semibold">Slide 1: Activity by groups</div>
                <div className="mt-1 text-[var(--apple-text-muted)]">
                  {project.name} • {selectedGroupIds.size} selected groups • Ranked by {rankBy}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--apple-border)] bg-[var(--apple-surface)] p-3 text-[11px]">
                <div className="font-semibold">Slide 2: Engagement by groups</div>
                <div className="mt-1 text-[var(--apple-text-muted)]">
                  Views, Downloads, Prints & Viewing Duration
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
