"use client";

import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
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
  Copy,
  Mail,
  Check,
  Info,
  Calendar,
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
  const [importingBulk, setImportingBulk] = useState(false);
  const [importGroupId, setImportGroupId] = useState("");
  const [rowMenuGroupId, setRowMenuGroupId] = useState<string | null>(null);
  const [showReportMenu, setShowReportMenu] = useState(false);

  // Detail drilldown views
  const [activeGroupDetail, setActiveGroupDetail] = useState<FullGroup | null>(null);
  const [groupDetailTab, setGroupDetailTab] = useState<"features" | "docs" | "access" | "members">("features");
  const [copySourceGroupId, setCopySourceGroupId] = useState("");
  const [activeUserDetail, setActiveUserDetail] = useState<MemberRow | null>(null);

  // Invite wizard state (2-step: 1 General -> 2 Project access)
  const [invStep, setInvStep] = useState<1 | 2>(1);
  const [invEmails, setInvEmails] = useState("");
  const [specifyFullNames, setSpecifyFullNames] = useState(false);
  const [namedRows, setNamedRows] = useState<Array<{ email: string; fullName: string }>>([{ email: "", fullName: "" }]);
  const [invGroupId, setInvGroupId] = useState("");
  const [invLang, setInvLang] = useState(INVITATION_LANGUAGES[0]);
  const [invNotify, setInvNotify] = useState(true);
  const [invPassword, setInvPassword] = useState("");
  const [invAccessEnabled, setInvAccessEnabled] = useState(true);
  const [invStartCustom, setInvStartCustom] = useState(false);
  const [invStartDate, setInvStartDate] = useState("");
  const [invEndCustom, setInvEndCustom] = useState(false);
  const [invEndDate, setInvEndDate] = useState("");
  const [invRequire2fa, setInvRequire2fa] = useState(false);
  const [invAllowedIpEnabled, setInvAllowedIpEnabled] = useState(false);
  const [invAllowedIps, setInvAllowedIps] = useState("");
  const [generatedInvites, setGeneratedInvites] = useState<Array<{ email: string; fullName: string; inviteToken: string }>>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [availableTerms, setAvailableTerms] = useState<Array<{ id: string; title: string; assignedGroupIds: string; enabled: boolean }>>([]);
  const [selectedTermsIds, setSelectedTermsIds] = useState<string[]>([]);

  // Create Group wizard state
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupRole, setNewGroupRole] = useState<"Administrator" | "User" | "Custom">("User");
  const [toast, setToast] = useState<string | null>(null);

  function showToast(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  }

  async function loadParticipants() {
    const [res, sRes] = await Promise.all([fetch("/api/participants"), fetch("/api/settings")]);
    if (res.ok) {
      const data = await res.json();
      setGroups(data.groups || []);
      if (!invGroupId && data.groups?.length) {
        const ug = data.groups.find((g: FullGroup) => g.role !== "Administrator") || data.groups[0];
        setInvGroupId(ug.id);
      }
    }
    if (sRes.ok) {
      const sData = await sRes.json();
      setAvailableTerms(sData.terms || []);
    }
  }

  useEffect(() => {
    loadParticipants();
  }, [project.id]);

  function getParsedInviteEntries() {
    if (specifyFullNames) {
      return namedRows
        .map((r) => ({ email: r.email.trim(), fullName: r.fullName.trim() }))
        .filter((r) => r.email.includes("@"));
    }
    return invEmails
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.includes("@"))
      .map((email) => ({ email }));
  }

  function resetInviteWizard() {
    setInvStep(1);
    setInvEmails("");
    setSpecifyFullNames(false);
    setNamedRows([{ email: "", fullName: "" }]);
    setInvPassword("");
    setInvAccessEnabled(true);
    setInvStartCustom(false);
    setInvStartDate("");
    setInvEndCustom(false);
    setInvEndDate("");
    setInvRequire2fa(false);
    setInvAllowedIpEnabled(false);
    setInvAllowedIps("");
    setSelectedTermsIds([]);
  }

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    const list = getParsedInviteEntries();
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
        initialPassword: invPassword,
        accessEnabled: invAccessEnabled,
        accessStart: invStartCustom && invStartDate ? new Date(invStartDate).toISOString() : null,
        accessEnd: invEndCustom && invEndDate ? new Date(invEndDate).toISOString() : null,
        require2fa: invRequire2fa,
        allowedIps: invAllowedIpEnabled ? invAllowedIps : "",
        assignedTermsIds: selectedTermsIds,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setShowInviteModal(false);
      resetInviteWizard();
      setGeneratedInvites(data.invites || []);
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
                      <td className="relative px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setRowMenuGroupId((cur) => (cur === g.id ? null : g.id))}
                          className="rounded-lg p-1 hover:bg-[var(--apple-bg)]"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {rowMenuGroupId === g.id && (
                          <div className="apple-glass absolute top-9 right-3 z-40 w-52 rounded-xl border border-[var(--apple-border-strong)] p-1.5 text-left text-xs shadow-2xl">
                            <button
                              type="button"
                              onClick={() => {
                                setRowMenuGroupId(null);
                                setActiveGroupDetail(g);
                              }}
                              className="block w-full rounded-lg px-2.5 py-1.5 hover:bg-[var(--apple-hover)]"
                            >
                              Group settings & permissions
                            </button>
                            <div className="my-1 border-t border-[var(--apple-border)] px-2.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--apple-text-muted)]">
                              Document updates
                            </div>
                            {(["Never", "Daily", "Weekly"] as const).map((freq) => (
                              <button
                                key={freq}
                                type="button"
                                onClick={async () => {
                                  setRowMenuGroupId(null);
                                  await fetch("/api/participants", {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      targetType: "group",
                                      groupId: g.id,
                                      action: "update-settings",
                                      docUpdateFrequency: freq,
                                    }),
                                  });
                                  await loadParticipants();
                                  showToast(`Document updates for "${g.name}": ${freq}`);
                                }}
                                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1 hover:bg-[var(--apple-hover)]"
                              >
                                <span>{freq}</span>
                                {g.docUpdateFrequency === freq && <Check className="h-3 w-3 text-[#007AFF]" />}
                              </button>
                            ))}
                            {!g.isDefaultAdmin && (
                              <>
                                <div className="my-1 border-t border-[var(--apple-border)]" />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setRowMenuGroupId(null);
                                    await fetch("/api/participants", {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        targetType: "group",
                                        groupId: g.id,
                                        action: g.accessEnabled ? "deactivate" : "activate",
                                      }),
                                    });
                                    await loadParticipants();
                                    showToast(`${g.accessEnabled ? "Deactivated" : "Activated"} ${g.name}`);
                                  }}
                                  className="block w-full rounded-lg px-2.5 py-1.5 hover:bg-[var(--apple-hover)]"
                                >
                                  {g.accessEnabled ? "Deactivate group" : "Activate group"}
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setRowMenuGroupId(null);
                                    await fetch("/api/participants", {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        targetType: "group",
                                        groupId: g.id,
                                        action: "delete",
                                      }),
                                    });
                                    await loadParticipants();
                                    showToast(`Deleted group "${g.name}"`);
                                  }}
                                  className="block w-full rounded-lg px-2.5 py-1.5 text-red-500 hover:bg-red-500/10"
                                >
                                  Delete group
                                </button>
                              </>
                            )}
                          </div>
                        )}
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
                          <td className="px-4 py-2.5 text-right" colSpan={2}>
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  const r = await fetch("/api/participants", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ action: "resend-invite", participantId: m.id }),
                                  });
                                  if (r.ok) {
                                    const d = await r.json();
                                    const url = `${window.location.origin}/?invite=${d.inviteToken}`;
                                    navigator.clipboard?.writeText(url);
                                    showToast(`Copied invite link for ${d.email}`);
                                  }
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-[var(--apple-border)] px-2 py-1 text-[10px] font-medium text-[#007AFF] hover:bg-[var(--apple-selected)]"
                              >
                                <Copy className="h-3 w-3" /> Copy invite
                              </button>
                              {!g.isDefaultAdmin && (
                                <>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await fetch("/api/participants", {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          targetType: "participant",
                                          participantId: m.id,
                                          action: m.accessEnabled ? "deactivate" : "activate",
                                        }),
                                      });
                                      await loadParticipants();
                                    }}
                                    className="rounded-lg border border-[var(--apple-border)] px-2 py-1 text-[10px] hover:bg-[var(--apple-bg)]"
                                  >
                                    {m.accessEnabled ? "Disable" : "Enable"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await fetch("/api/participants", {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          targetType: "participant",
                                          participantId: m.id,
                                          action: "delete",
                                        }),
                                      });
                                      await loadParticipants();
                                      showToast(`Removed ${m.email}`);
                                    }}
                                    className="rounded-lg border border-red-500/30 px-2 py-1 text-[10px] text-red-500 hover:bg-red-500/10"
                                  >
                                    Remove
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Add Participants 2-Step Wizard Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <form onSubmit={submitInvite} className="apple-card w-full max-w-lg space-y-4 p-6 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] text-[var(--apple-text-muted)]">Participants &gt; Add participants</div>
                <h3 className="text-base font-semibold">Add participants</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowInviteModal(false);
                  resetInviteWizard();
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Stepper Header matching iDeals VDR */}
            <div className="flex items-center gap-3 border-b border-[var(--apple-border)] pb-3">
              <button
                type="button"
                onClick={() => setInvStep(1)}
                className={`flex items-center gap-1.5 font-semibold ${
                  invStep === 1 ? "text-[#007AFF]" : "text-emerald-500"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                    invStep === 1 ? "bg-[#007AFF]" : "bg-emerald-500"
                  }`}
                >
                  {invStep === 1 ? "1" : "✓"}
                </span>
                General
              </button>
              <div className="h-px flex-1 bg-[var(--apple-border)]" />
              <div
                className={`flex items-center gap-1.5 font-semibold ${
                  invStep === 2 ? "text-[#007AFF]" : "text-[var(--apple-text-muted)]"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    invStep === 2
                      ? "bg-[#007AFF] text-white"
                      : "border border-[var(--apple-border-strong)] text-[var(--apple-text-muted)]"
                  }`}
                >
                  2
                </span>
                Project access
              </div>
            </div>

            {invStep === 1 ? (
              <div className="space-y-3.5">
                {!specifyFullNames ? (
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="font-medium">Emails (comma, space, or enter to separate)</label>
                      <button
                        type="button"
                        onClick={() => setSpecifyFullNames(true)}
                        className="font-medium text-[#007AFF] hover:underline"
                      >
                        Specify full names
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={invEmails}
                      onChange={(e) => setInvEmails(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] p-2.5 outline-none focus:border-[#007AFF]"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-medium">Participants</label>
                      <button
                        type="button"
                        onClick={() => setSpecifyFullNames(false)}
                        className="font-medium text-[#007AFF] hover:underline"
                      >
                        Invite without full names
                      </button>
                    </div>
                    <div className="max-h-36 space-y-2 overflow-y-auto">
                      {namedRows.map((row, idx) => (
                        <div key={idx} className="grid grid-cols-2 gap-2">
                          <input
                            type="email"
                            value={row.email}
                            onChange={(e) =>
                              setNamedRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, email: e.target.value } : r))
                              )
                            }
                            placeholder="name@website.com"
                            className="rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
                          />
                          <input
                            value={row.fullName}
                            onChange={(e) =>
                              setNamedRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, fullName: e.target.value } : r))
                              )
                            }
                            placeholder="Full name"
                            className="rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setNamedRows((prev) => [...prev, { email: "", fullName: "" }])}
                      className="font-medium text-[#007AFF]"
                    >
                      + Add another participant
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
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
                </div>

                <div>
                  <label className="mb-1 block font-medium">
                    Initial Password (optional — investor can set their own via invite link)
                  </label>
                  <input
                    type="text"
                    value={invPassword}
                    onChange={(e) => setInvPassword(e.target.value)}
                    placeholder="Leave empty to let investor set password via link (fallback: kleen2026)"
                    className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
                  />
                </div>

                <label className="flex items-center justify-between pt-1">
                  <span>Send emails about new mirrored documents</span>
                  <input type="checkbox" checked={invNotify} onChange={(e) => setInvNotify(e.target.checked)} />
                </label>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteModal(false);
                      resetInviteWizard();
                    }}
                    className="rounded-xl border border-[var(--apple-border)] px-4 py-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={getParsedInviteEntries().length === 0}
                    onClick={() => setInvStep(2)}
                    className="rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </div>
            ) : (
              /* Step 2: Project Access (matching iDeals VDR Step 2) */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Project access</div>
                    <div className="text-[11px] text-[var(--apple-text-muted)]">Define participant access period</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={invAccessEnabled}
                    onChange={(e) => setInvAccessEnabled(e.target.checked)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[var(--apple-border)] bg-[var(--apple-bg)]/60 p-3">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--apple-text-muted)]">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Start date
                      </span>
                      <button
                        type="button"
                        onClick={() => setInvStartCustom((v) => !v)}
                        className="text-[#007AFF]"
                      >
                        {invStartCustom ? "Use Now" : "Edit"}
                      </button>
                    </div>
                    {!invStartCustom ? (
                      <div className="font-semibold">Now</div>
                    ) : (
                      <input
                        type="datetime-local"
                        value={invStartDate}
                        onChange={(e) => setInvStartDate(e.target.value)}
                        className="w-full rounded-lg border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-2 py-1 text-[11px]"
                      />
                    )}
                  </div>

                  <div className="rounded-xl border border-[var(--apple-border)] bg-[var(--apple-bg)]/60 p-3">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--apple-text-muted)]">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> End date
                      </span>
                      <button
                        type="button"
                        onClick={() => setInvEndCustom((v) => !v)}
                        className="text-[#007AFF]"
                      >
                        {invEndCustom ? "Clear" : "Edit"}
                      </button>
                    </div>
                    {!invEndCustom ? (
                      <div className="font-semibold text-[var(--apple-text-muted)]">Not set</div>
                    ) : (
                      <input
                        type="datetime-local"
                        value={invEndDate}
                        onChange={(e) => setInvEndDate(e.target.value)}
                        className="w-full rounded-lg border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-2 py-1 text-[11px]"
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-[var(--apple-bg)] px-3 py-2 text-[11px] text-[var(--apple-text-secondary)]">
                  <Info className="h-3.5 w-3.5 shrink-0 text-[#007AFF]" />
                  <span>
                    {invStartCustom && invStartDate
                      ? `Access period scheduled starting ${new Date(invStartDate).toLocaleString()}`
                      : "Invitations will be ready to send now"}
                  </span>
                </div>

                <label className="flex items-center justify-between border-t border-[var(--apple-border)] pt-3">
                  <div>
                    <div className="font-semibold">2-step verification</div>
                    <div className="text-[11px] text-[var(--apple-text-muted)]">
                      Require users to verify their identity with a second factor
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={invRequire2fa}
                    onChange={(e) => setInvRequire2fa(e.target.checked)}
                  />
                </label>

                <div className="space-y-2 border-t border-[var(--apple-border)] pt-3">
                  <label className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">Allowed IP addresses</div>
                      <div className="text-[11px] text-[var(--apple-text-muted)]">
                        Specify applicable IP addresses or ranges to allow access
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={invAllowedIpEnabled}
                      onChange={(e) => setInvAllowedIpEnabled(e.target.checked)}
                    />
                  </label>
                  {invAllowedIpEnabled && (
                    <input
                      value={invAllowedIps}
                      onChange={(e) => setInvAllowedIps(e.target.value)}
                      placeholder="e.g. 192.168.1.0/24, 203.0.113.5"
                      className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
                    />
                  )}
                </div>

                {availableTerms.length > 0 && (
                  <div className="space-y-1.5 border-t border-[var(--apple-border)] pt-3">
                    <div className="font-semibold">Terms of access (NDA) required on sign-in</div>
                    <div className="space-y-1">
                      {availableTerms.map((t) => {
                        const gIds: string[] = JSON.parse(t.assignedGroupIds || "[]");
                        const alreadyApplies = t.enabled && (gIds.length === 0 || gIds.includes(invGroupId));
                        return (
                          <label key={t.id} className="flex items-center justify-between rounded-lg bg-[var(--apple-bg)]/60 px-2.5 py-1.5">
                            <span>
                              {t.title}{" "}
                              {alreadyApplies && (
                                <span className="ml-1 text-[10px] font-semibold text-emerald-500">(Active for this group)</span>
                              )}
                            </span>
                            <input
                              type="checkbox"
                              checked={alreadyApplies || selectedTermsIds.includes(t.id)}
                              disabled={alreadyApplies}
                              onChange={(e) =>
                                setSelectedTermsIds((prev) =>
                                  e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)
                                )
                              }
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setInvStep(1)}
                    className="rounded-xl border border-[var(--apple-border)] px-4 py-2"
                  >
                    ← Back
                  </button>
                  <button type="submit" className="rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white">
                    Add & Generate Invite Link
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Invitation Links Ready Modal */}
      {generatedInvites.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs">
          <div className="apple-card w-full max-w-lg space-y-4 p-6 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Participant Invitations Ready</h3>
              <button type="button" onClick={() => setGeneratedInvites([])}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[var(--apple-text-secondary)]">
              Send the onboarding link below to each participant. When they open the link, they will set their own
              password and enter <strong>{project.name}</strong> directly.
            </p>
            <div className="max-h-64 space-y-2.5 overflow-y-auto">
              {generatedInvites.map((inv) => {
                const url =
                  typeof window !== "undefined" ? `${window.location.origin}/?invite=${inv.inviteToken}` : "";
                const mailSubject = encodeURIComponent(`Invitation to ${project.name} (Kleen Data Room)`);
                const mailBody = encodeURIComponent(
                  `Hello ${inv.fullName},\n\nYou have been invited to access ${project.name} Data Room.\n\nClick the link below to set your password and sign in:\n${url}\n`
                );
                return (
                  <div key={inv.inviteToken} className="rounded-xl border border-[var(--apple-border)] bg-[var(--apple-bg)]/60 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{inv.email}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(url);
                            setCopiedToken(inv.inviteToken);
                            setTimeout(() => setCopiedToken(null), 2000);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#007AFF] px-2.5 py-1 font-medium text-white"
                        >
                          {copiedToken === inv.inviteToken ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedToken === inv.inviteToken ? "Copied" : "Copy link"}
                        </button>
                        <a
                          href={`mailto:${inv.email}?subject=${mailSubject}&body=${mailBody}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--apple-border-strong)] px-2.5 py-1 font-medium hover:bg-[var(--apple-hover)]"
                        >
                          <Mail className="h-3 w-3" /> Email
                        </a>
                      </div>
                    </div>
                    <div className="truncate rounded-lg bg-[var(--apple-surface)] px-2.5 py-1.5 font-mono text-[10px] text-[var(--apple-text-muted)]">
                      {url}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setGeneratedInvites([])}
                className="rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white"
              >
                Done
              </button>
            </div>
          </div>
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
              <li>Download the template (ensure target groups already exist).</li>
              <li>Fill out <code className="font-mono">Email</code>, <code className="font-mono">Name</code>, and optional <code className="font-mono">Group</code> columns.</li>
              <li>Select default fallback group and upload CSV or XLSX file below.</li>
            </ol>
            <div>
              <label className="mb-1 block font-medium">Default target group (when Group column is blank)</label>
              <select
                value={importGroupId || groups.find((g) => !g.isDefaultAdmin)?.id || groups[0]?.id || ""}
                onChange={(e) => setImportGroupId(e.target.value)}
                className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <a
                href="/api/participants?format=xlsx"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--apple-border-strong)] px-3 py-2 font-medium hover:bg-[var(--apple-hover)]"
              >
                <Download className="h-3.5 w-3.5" /> Get template
              </a>
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white hover:bg-[#0066D6]">
                  <Upload className="h-3.5 w-3.5" />
                  {importingBulk ? "Importing..." : "Upload CSV / XLSX"}
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    disabled={importingBulk}
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setImportingBulk(true);
                      try {
                        const buf = await file.arrayBuffer();
                        const wb = XLSX.read(buf, { type: "array" });
                        const sheet = wb.Sheets[wb.SheetNames[0]];
                        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
                        const fallbackGid = importGroupId || groups.find((g) => !g.isDefaultAdmin)?.id || groups[0]?.id || "";
                        const byGroup = new Map<string, Array<{ email: string; fullName: string }>>();

                        for (const r of rows) {
                          const email = String(r.Email || r.email || r["E-mail"] || "").trim();
                          if (!email || !email.includes("@")) continue;
                          const fullName = String(r.Name || r["Full Name"] || r.fullName || "").trim();
                          const grpCol = String(r.Group || r.group || "").trim().toLowerCase();
                          const matchedGroup = groups.find((g) => g.name.toLowerCase() === grpCol);
                          const gid = matchedGroup?.id || fallbackGid;
                          if (!gid) continue;
                          const list = byGroup.get(gid) || [];
                          list.push({ email, fullName });
                          byGroup.set(gid, list);
                        }

                        let allInvites: Array<{ email: string; fullName: string; inviteToken: string }> = [];
                        for (const [gid, entries] of byGroup.entries()) {
                          const res = await fetch("/api/participants", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              action: "add-participants",
                              groupId: gid,
                              entries,
                            }),
                          });
                          if (res.ok) {
                            const d = await res.json();
                            if (Array.isArray(d.invites)) allInvites = allInvites.concat(d.invites);
                          }
                        }
                        setShowImportModal(false);
                        await loadParticipants();
                        if (allInvites.length > 0) {
                          setGeneratedInvites(allInvites);
                          showToast(`Imported ${allInvites.length} participant(s)`);
                        } else {
                          showToast("No valid emails found in uploaded file");
                        }
                      } finally {
                        setImportingBulk(false);
                      }
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="rounded-xl border border-[var(--apple-border)] px-3 py-2"
                >
                  Close
                </button>
              </div>
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
