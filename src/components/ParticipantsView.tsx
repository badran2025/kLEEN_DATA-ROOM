"use client";

import React, { useEffect, useState } from "react";
import {
  UserPlus,
  UsersRound,
  Upload,
  Download,
  BarChart3,
  Search,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  X,
  ArrowLeft,
} from "lucide-react";
import type { GroupDto, ProjectDto } from "@/lib/types";
import { formatDateShort } from "@/lib/format";

interface MemberRow {
  id: string;
  userId: string;
  groupId: string;
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  status: string;
  accessEnabled: boolean;
  require2fa: boolean;
  docNotifications: boolean;
  docUpdateFrequency: string;
  lastSignInAt: string | null;
}

interface FullGroup extends GroupDto {
  members: MemberRow[];
}

const INVITATION_LANGUAGES = [
  "English (United States)",
  "العربية (المملكة العربية السعودية)",
  "Français (France)",
  "Deutsch (Deutschland)",
  "Español (España)",
  "中文 (中国)",
  "日本語 (日本)",
];

export function ParticipantsView({
  project,
  onNavigateTab,
  onRefreshSession,
}: {
  project: ProjectDto;
  onNavigateTab: (tab: string) => void;
  onRefreshSession: () => void;
}) {
  const [groups, setGroups] = useState<FullGroup[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState(false);

  // Detail drilldown views
  const [activeGroupDetail, setActiveGroupDetail] = useState<FullGroup | null>(null);
  const [groupDetailTab, setGroupDetailTab] = useState<"features" | "docs" | "access" | "members">("features");
  const [copySourceGroupId, setCopySourceGroupId] = useState("");
  const [activeUserDetail, setActiveUserDetail] = useState<MemberRow | null>(null);

  // Invite wizard state
  const [invEmails, setInvEmails] = useState("");
  const [invGroupId, setInvGroupId] = useState("");
  const [invLang, setInvLang] = useState(INVITATION_LANGUAGES[0]);
  const [invNotify, setInvNotify] = useState(true);

  // Create Group wizard state
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupRole, setNewGroupRole] = useState<"Administrator" | "User" | "Custom">("User");
  const [toast, setToast] = useState<string | null>(null);

  function showToast(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  }

  async function loadParticipants() {
    const res = await fetch("/api/participants");
    if (res.ok) {
      const data = await res.json();
      setGroups(data.groups || []);
      if (!invGroupId && data.groups?.length) {
        const ug = data.groups.find((g: FullGroup) => g.role !== "Administrator") || data.groups[0];
        setInvGroupId(ug.id);
      }
    }
  }

  useEffect(() => {
    loadParticipants();
  }, [project.id]);

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    const list = invEmails
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.includes("@"))
      .map((email) => ({ email }));
    if (list.length === 0) return;

    const res = await fetch("/api/participants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add-participants",
        groupId: invGroupId,
        entries: list,
        invitationLanguage: invLang,
        docNotifications: invNotify,
      }),
    });
    if (res.ok) {
      setShowInviteModal(false);
      setInvEmails("");
      showToast(`Invited ${list.length} participant(s)`);
      await loadParticipants();
      onRefreshSession();
    }
  }

  async function submitCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    const res = await fetch("/api/participants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create-group",
        name: newGroupName,
        role: newGroupRole,
      }),
    });
    if (res.ok) {
      setShowGroupModal(false);
      setNewGroupName("");
      showToast("Group created");
      await loadParticipants();
      onRefreshSession();
    }
  }

  if (activeGroupDetail) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setActiveGroupDetail(null)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--apple-text-secondary)] hover:text-[var(--apple-text)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Participants
        </button>
        <div className="apple-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--apple-border)] pb-4">
            <div>
              <h2 className="text-lg font-semibold">{activeGroupDetail.name}</h2>
              <span className="text-xs text-[var(--apple-text-secondary)]">Role: {activeGroupDetail.role}</span>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-500">
              {activeGroupDetail.accessEnabled ? "Enabled" : "Deactivated"}
            </span>
          </div>

          <div className="mt-4 flex gap-2 border-b border-[var(--apple-border)] pb-3 text-xs">
            {[
              { id: "features" as const, label: "Feature permissions" },
              { id: "docs" as const, label: "Document permissions" },
              { id: "access" as const, label: "Project access" },
              { id: "members" as const, label: `Participants (${activeGroupDetail.members.length})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setGroupDetailTab(t.id)}
                className={`rounded-xl px-3 py-1.5 font-medium ${
                  groupDetailTab === t.id ? "bg-[#007AFF] text-white" : "hover:bg-[var(--apple-hover)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {groupDetailTab === "docs" && (
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={copySourceGroupId}
                  onChange={(e) => setCopySourceGroupId(e.target.value)}
                  className="rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
                >
                  <option value="">Select group to copy permissions from...</option>
                  {groups
                    .filter((g) => g.id !== activeGroupDetail.id)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={!copySourceGroupId}
                  onClick={async () => {
                    await fetch("/api/permissions", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "copy-from-group",
                        sourceGroupId: copySourceGroupId,
                        targetGroupId: activeGroupDetail.id,
                      }),
                    });
                    showToast("Copied document permissions");
                  }}
                  className="rounded-xl bg-[#007AFF] px-3.5 py-2 font-semibold text-white disabled:opacity-40"
                >
                  Copy from another group
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab("permissions")}
                  className="rounded-xl border border-[var(--apple-border)] px-3.5 py-2 font-medium"
                >
                  Open full Permissions matrix
                </button>
              </div>
            </div>
          )}

          {groupDetailTab === "access" && (
            <div className="mt-4 space-y-3 text-xs">
              <label className="flex items-center justify-between rounded-xl border border-[var(--apple-border)] p-3">
                <span>2-step verification required for this group</span>
                <input
                  type="checkbox"
                  checked={activeGroupDetail.require2fa}
                  onChange={async (e) => {
                    await fetch("/api/participants", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        targetType: "group",
                        groupId: activeGroupDetail.id,
                        action: "update-settings",
                        require2fa: e.target.checked,
                      }),
                    });
                    await loadParticipants();
                  }}
                />
              </label>
            </div>
          )}

          {groupDetailTab === "members" && (
            <div className="mt-4 space-y-2 text-xs">
              {activeGroupDetail.members.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-xl border border-[var(--apple-border)] p-3">
                  <div>
                    <div className="font-semibold">
                      {m.firstName} {m.lastName}
                    </div>
                    <div className="text-[var(--apple-text-muted)]">{m.email}</div>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-medium text-emerald-500">
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {groupDetailTab === "features" && (
            <div className="mt-4 text-xs text-[var(--apple-text-secondary)]">
              Role profile: <span className="font-semibold text-[var(--apple-text)]">{activeGroupDetail.role}</span> — Feature
              access and AI integration switches are managed per role.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeUserDetail) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setActiveUserDetail(null)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--apple-text-secondary)] hover:text-[var(--apple-text)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Participants
        </button>
        <div className="apple-card p-6 text-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--apple-border)] pb-4">
            <div>
              <h2 className="text-lg font-semibold">
                {activeUserDetail.firstName} {activeUserDetail.lastName}
              </h2>
              <div className="text-[var(--apple-text-muted)]">{activeUserDetail.email}</div>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-semibold text-emerald-500">
              {activeUserDetail.accessEnabled ? "Enabled" : "Deactivated"}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between rounded-xl border border-[var(--apple-border)] p-3">
              <span>Document notifications</span>
              <input
                type="checkbox"
                checked={activeUserDetail.docNotifications}
                onChange={async (e) => {
                  await fetch("/api/participants", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      targetType: "participant",
                      participantId: activeUserDetail.id,
                      action: "update-settings",
                      docNotifications: e.target.checked,
                    }),
                  });
                  setActiveUserDetail({ ...activeUserDetail, docNotifications: e.target.checked });
                  loadParticipants();
                }}
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-[var(--apple-border)] p-3">
              <span>Require 2-step verification</span>
              <input
                type="checkbox"
                checked={activeUserDetail.require2fa}
                onChange={async (e) => {
                  await fetch("/api/participants", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      targetType: "participant",
                      participantId: activeUserDetail.id,
                      action: "update-settings",
                      require2fa: e.target.checked,
                    }),
                  });
                  setActiveUserDetail({ ...activeUserDetail, require2fa: e.target.checked });
                  loadParticipants();
                }}
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0066D6]"
          >
            <UserPlus className="h-3.5 w-3.5" /> Add participants
          </button>
          <button
            type="button"
            onClick={() => setShowGroupModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-2 text-xs font-medium hover:bg-[var(--apple-hover)]"
          >
            <UsersRound className="h-3.5 w-3.5" /> Create group
          </button>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-2 text-xs font-medium hover:bg-[var(--apple-hover)]"
          >
            <Upload className="h-3.5 w-3.5" /> Import
          </button>
          <a
            href="/api/participants?format=xlsx"
            className="flex items-center gap-1.5 rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-2 text-xs font-medium hover:bg-[var(--apple-hover)]"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </a>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowReportMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-2 text-xs font-medium hover:bg-[var(--apple-hover)]"
            >
              <BarChart3 className="h-3.5 w-3.5" /> View reports
            </button>
            {showReportMenu && (
              <div className="apple-glass absolute top-10 left-0 z-30 w-48 rounded-xl border border-[var(--apple-border-strong)] p-1.5 text-xs shadow-xl">
                {[
                  { tab: "reports:activity-log", label: "Activity log" },
                  { tab: "reports:documents-overview", label: "Documents overview" },
                  { tab: "reports:engagement-matrix", label: "Engagement matrix" },
                  { tab: "reports:permissions", label: "Permissions log" },
                ].map((r) => (
                  <button
                    key={r.tab}
                    type="button"
                    onClick={() => {
                      setShowReportMenu(false);
                      onNavigateTab(r.tab);
                    }}
                    className="block w-full rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--apple-hover)]"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-2.5 py-1.5 text-xs"
          >
            <option value="">All roles</option>
            <option value="Administrator">Administrator</option>
            <option value="User">User</option>
            <option value="Custom">Custom</option>
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--apple-text-muted)]" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search participants..."
              className="w-52 rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] py-1.5 pr-3 pl-8 text-xs outline-none"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="apple-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--apple-border)] px-4 py-2 text-xs">
          <button
            type="button"
            onClick={() => {
              if (expanded.size === groups.length) setExpanded(new Set());
              else setExpanded(new Set(groups.map((g) => g.id)));
            }}
            className="font-medium text-[#007AFF]"
          >
            {expanded.size === groups.length ? "Collapse all" : "Expand all"}
          </button>
          <span className="text-[var(--apple-text-muted)]">{groups.length} groups</span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--apple-border)] bg-[var(--apple-bg)]/50 text-[11px] font-semibold text-[var(--apple-text-secondary)]">
            <tr>
              <th className="px-4 py-3">Group / Participant</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Project access</th>
              <th className="px-4 py-3">Last sign-in</th>
              <th className="px-4 py-3">Users</th>
              <th className="w-12 px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--apple-border)]">
            {groups
              .filter((g) => (!roleFilter || g.role === roleFilter) && g.name.toLowerCase().includes(searchText.toLowerCase()))
              .map((g) => {
                const isOpen = expanded.has(g.id);
                return (
                  <React.Fragment key={g.id}>
                    <tr className="hover:bg-[var(--apple-hover)]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setExpanded((prev) => {
                                const next = new Set(prev);
                                if (next.has(g.id)) next.delete(g.id);
                                else next.add(g.id);
                                return next;
                              })
                            }
                          >
                            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveGroupDetail(g)}
                            className="font-semibold hover:text-[#007AFF]"
                          >
                            {g.name}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">{g.role}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                            g.accessEnabled ? "bg-emerald-500/15 text-emerald-500" : "bg-zinc-500/15 text-zinc-400"
                          }`}
                        >
                          {g.accessEnabled ? "Enabled" : "Deactivated"}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--apple-text-secondary)]">
                        {formatDateShort(g.members[0]?.lastSignInAt)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{g.members.length}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setActiveGroupDetail(g)}
                          className="rounded-lg p-1 hover:bg-[var(--apple-bg)]"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                    {isOpen &&
                      g.members.map((m) => (
                        <tr key={m.id} className="bg-[var(--apple-bg)]/40 text-[11px]">
                          <td className="py-2.5 pr-4 pl-11">
                            <button
                              type="button"
                              onClick={() => setActiveUserDetail(m)}
                              className="text-left hover:text-[#007AFF]"
                            >
                              <div className="font-medium">
                                {m.firstName} {m.lastName}
                              </div>
                              <div className="text-[var(--apple-text-muted)]">{m.email}</div>
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-[var(--apple-text-muted)]">{m.status}</td>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => setActiveUserDetail(m)}
                              className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-500"
                            >
                              {m.accessEnabled ? "Enabled" : "Deactivated"}
                            </button>
                          </td>
                          <td className="px-4 py-2.5 tabular-nums">{formatDateShort(m.lastSignInAt)}</td>
                          <td />
                          <td />
                        </tr>
                      ))}
                  </React.Fragment>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Add Participants Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <form onSubmit={submitInvite} className="apple-card w-full max-w-md space-y-4 p-6 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Add participants</h3>
              <button type="button" onClick={() => setShowInviteModal(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              <label className="mb-1 block font-medium">Emails (comma, space, or newline separated)</label>
              <textarea
                rows={3}
                required
                value={invEmails}
                onChange={(e) => setInvEmails(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] p-2.5 outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium">Group</label>
              <select
                value={invGroupId}
                onChange={(e) => setInvGroupId(e.target.value)}
                className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium">Invitation language</label>
              <select
                value={invLang}
                onChange={(e) => setInvLang(e.target.value)}
                className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
              >
                {INVITATION_LANGUAGES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center justify-between">
              <span>Send emails about new mirrored documents</span>
              <input type="checkbox" checked={invNotify} onChange={(e) => setInvNotify(e.target.checked)} />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="rounded-xl border border-[var(--apple-border)] px-4 py-2"
              >
                Cancel
              </button>
              <button type="submit" className="rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white">
                Invite
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Group Modal */}
      {showGroupModal && (
        <form
          onSubmit={submitCreateGroup}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="apple-card w-full max-w-md space-y-4 p-6 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Create group</h3>
              <button type="button" onClick={() => setShowGroupModal(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              <label className="mb-1 block font-medium">Group name</label>
              <input
                required
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g., Series B Lead Investors"
                className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-medium">Role</label>
              <div className="grid grid-cols-3 gap-2">
                {(["Administrator", "User", "Custom"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setNewGroupRole(r)}
                    className={`rounded-xl border p-2.5 text-left ${
                      newGroupRole === r ? "border-[#007AFF] bg-[var(--apple-selected)]" : "border-[var(--apple-border)]"
                    }`}
                  >
                    <div className="font-semibold">{r}</div>
                    <div className="text-[10px] text-[var(--apple-text-muted)]">
                      {r === "Administrator" ? "Full management" : r === "User" ? "Limited access" : "Custom"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="rounded-xl border border-[var(--apple-border)] px-4 py-2"
              >
                Cancel
              </button>
              <button type="submit" className="rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white">
                Create group
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="apple-card w-full max-w-md space-y-4 p-6 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Import participants in bulk</h3>
              <button type="button" onClick={() => setShowImportModal(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="list-decimal space-y-2 pl-4 text-[var(--apple-text-secondary)]">
              <li>Download template (ensure groups are created prior to download).</li>
              <li>Fill out participant emails, full names, and group names.</li>
              <li>Upload CSV/XLSX to invite in bulk.</li>
            </ol>
            <div className="flex justify-between pt-2">
              <a
                href="/api/participants?format=xlsx"
                className="rounded-xl border border-[var(--apple-border)] px-3 py-2 font-medium"
              >
                Get template
              </a>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white"
              >
                Done
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
