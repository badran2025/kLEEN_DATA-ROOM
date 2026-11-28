"use client";

import React, { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FolderOpen,
  CheckSquare,
  Users,
  Shield,
  MessageCircleQuestion,
  BarChart3,
  Settings,
  Archive,
  Trash2,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Sun,
  Moon,
  HelpCircle,
  Smartphone,
  LogOut,
  Cloud,
  RefreshCw,
  Eye,
  X,
  Plus,
  Globe,
} from "lucide-react";
import type { SessionResponse } from "@/lib/types";
import { renderNdaText } from "@/lib/nda-template";
import { KleenLogo } from "./KleenLogo";
import { DocumentsWorkspace } from "./DocumentsWorkspace";
import { DashboardView } from "./DashboardView";
import { PermissionsView } from "./PermissionsView";
import { ParticipantsView } from "./ParticipantsView";
import { ReportsView, type ReportSubTab } from "./ReportsView";
import { QnaView, ChecklistView } from "./QnaAndChecklistView";
import { SettingsView, type SettingsSubTab } from "./SettingsView";
import { ArchivingView, RecycleBinView } from "./ArchivingAndRecycleView";

export function DataRoomShell({
  initialSession,
  onReloadSession,
  onSignedOut,
}: {
  initialSession: SessionResponse;
  onReloadSession: () => Promise<void>;
  onSignedOut: () => void;
}) {
  const [session, setSession] = useState<SessionResponse>(initialSession);
  const [activeNav, setActiveNav] = useState<string>("documents:all");
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [uiLang, setUiLang] = useState<"en" | "ar">("en");
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showDownloadAppModal, setShowDownloadAppModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState<"personal" | "security" | null>(null);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [newProjType, setNewProjType] = useState("Fundraising");
  const [syncingTop, setSyncingTop] = useState(false);
  const [ndaChecked, setNdaChecked] = useState(false);

  // Account edit states
  const [accFirst, setAccFirst] = useState(initialSession.user?.firstName || "");
  const [accLast, setAccLast] = useState(initialSession.user?.lastName || "");
  const [accCompany, setAccCompany] = useState(initialSession.user?.company || "");
  const [accJob, setAccJob] = useState(initialSession.user?.jobTitle || "");
  const [accPhone, setAccPhone] = useState(initialSession.user?.phone || "");
  const [accTz, setAccTz] = useState(initialSession.user?.timezone || "Asia/Riyadh");
  const [accNewPass, setAccNewPass] = useState("");
  const [accMsg, setAccMsg] = useState<string | null>(null);

  useEffect(() => {
    setSession(initialSession);
  }, [initialSession]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const project = session.project!;
  const user = session.user!;
  const groups = session.groups || [];
  const isAdmin = Boolean(session.isAdmin);
  const isTrueAdmin = Boolean(session.isTrueAdmin);
  const pendingTerm = session.pendingTerms?.[0] || null;

  async function handleViewAs(groupId: string | null) {
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "view-as", groupId }),
    });
    await onReloadSession();
  }

  async function handleQuickSync() {
    setSyncingTop(true);
    await fetch("/api/drive/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync" }),
    });
    setSyncingTop(false);
    await onReloadSession();
  }

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    onSignedOut();
  }

  const [section, subSection] = activeNav.split(":");

  return (
    <div dir={uiLang === "ar" ? "rtl" : "ltr"} className="flex h-screen flex-col overflow-hidden bg-[var(--apple-bg)]">
      {/* View As Banner */}
      {session.isViewingAs && (
        <div className="flex items-center justify-between bg-[#007AFF] px-4 py-1.5 text-xs font-medium text-white">
          <span className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5" />
            Viewing documents as <strong>{session.effectiveGroup?.name}</strong>
          </span>
          <button
            type="button"
            onClick={() => handleViewAs(null)}
            className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] hover:bg-white/30"
          >
            <X className="h-3 w-3" /> Exit preview
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Navigation Rail */}
        <aside
          className={`apple-glass flex shrink-0 flex-col border-r border-[var(--apple-border)] transition-all duration-200 ${
            railCollapsed ? "w-16" : "w-60"
          }`}
        >
          {/* Room Switcher */}
          <div className="relative border-b border-[var(--apple-border)] p-3">
            <button
              type="button"
              onClick={() => setShowProjectMenu((v) => !v)}
              className="flex w-full items-center justify-between gap-2 rounded-xl p-1.5 text-left transition hover:bg-[var(--apple-hover)]"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                {project.logoUrl ? (
                  <img src={project.logoUrl} alt={project.name} className="h-[30px] w-[30px] rounded-[8px] object-cover" />
                ) : (
                  <KleenLogo size={30} accent={project.themeColor} />
                )}
                {!railCollapsed && (
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">{project.name}</div>
                    <div className="truncate text-[10px] text-[var(--apple-text-muted)]">Kleen Data Room</div>
                  </div>
                )}
              </div>
              {!railCollapsed && <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--apple-text-muted)]" />}
            </button>

            {showProjectMenu && (
              <div className="apple-card absolute top-14 left-3 z-40 w-60 p-2 text-xs shadow-2xl">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase text-[var(--apple-text-muted)]">
                  Data Rooms
                </div>
                {(session.allProjects || []).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={async () => {
                      await fetch("/api/auth/session", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "switch-project", projectId: p.id }),
                      });
                      setShowProjectMenu(false);
                      onReloadSession();
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left ${
                      p.id === project.id ? "bg-[var(--apple-selected)] font-semibold text-[#007AFF]" : "hover:bg-[var(--apple-hover)]"
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="text-[10px] opacity-70">{p.status}</span>
                  </button>
                ))}
                {isTrueAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowProjectMenu(false);
                      setShowCreateProjectModal(true);
                    }}
                    className="mt-1 flex w-full items-center gap-1.5 border-t border-[var(--apple-border)] px-2.5 pt-2 pb-1 text-[#007AFF] font-medium"
                  >
                    <Plus className="h-3.5 w-3.5" /> Create new project
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Primary Nav Links */}
          <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 text-xs">
            {[
              { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
              { id: "documents:all", label: "Documents", icon: FolderOpen, show: true },
              { id: "checklist", label: "Due diligence checklist", icon: CheckSquare, show: true },
              { id: "participants", label: "Participants", icon: Users, show: isAdmin },
              { id: "permissions", label: "Permissions", icon: Shield, show: isAdmin },
              { id: "qna", label: "Q&A", icon: MessageCircleQuestion, show: true },
              { id: "reports:activity-log", label: "Reports", icon: BarChart3, show: isAdmin },
              { id: "settings:general", label: "Settings", icon: Settings, show: isAdmin },
              { id: "archiving", label: "Project archiving", icon: Archive, show: isAdmin },
              { id: "recycle-bin", label: "Recycle bin", icon: Trash2, show: isAdmin },
            ]
              .filter((item) => item.show)
              .map((item) => {
                const Icon = item.icon;
                const itemRoot = item.id.split(":")[0];
                const active = section === itemRoot;
                return (
                  <div key={item.id}>
                    <button
                      type="button"
                      onClick={() => setActiveNav(item.id)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 font-medium transition ${
                        active
                          ? "bg-[var(--apple-selected)] text-[#007AFF]"
                          : "text-[var(--apple-text-secondary)] hover:bg-[var(--apple-hover)] hover:text-[var(--apple-text)]"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!railCollapsed && <span className="truncate">{item.label}</span>}
                    </button>

                    {/* Expandable Sub-Items */}
                    {!railCollapsed && active && itemRoot === "documents" && (
                      <div className="mt-0.5 ml-6 space-y-0.5 border-l border-[var(--apple-border)] pl-2.5 text-[11px]">
                        {[
                          { k: "documents:all", l: "All" },
                          { k: "documents:notes", l: "Notes" },
                          { k: "documents:shared-links", l: "External links" },
                          { k: "documents:signatures", l: "Signatures" },
                        ].map((s) => (
                          <button
                            key={s.k}
                            type="button"
                            onClick={() => setActiveNav(s.k)}
                            className={`block w-full rounded-lg px-2 py-1 text-left ${
                              activeNav === s.k ? "font-semibold text-[#007AFF]" : "text-[var(--apple-text-muted)] hover:text-[var(--apple-text)]"
                            }`}
                          >
                            {s.l}
                          </button>
                        ))}
                      </div>
                    )}

                    {!railCollapsed && active && itemRoot === "reports" && (
                      <div className="mt-0.5 ml-6 space-y-0.5 border-l border-[var(--apple-border)] pl-2.5 text-[11px]">
                        {[
                          { k: "reports:activity-log", l: "Activity log" },
                          { k: "reports:documents-overview", l: "Documents overview" },
                          { k: "reports:engagement-matrix", l: "Engagement matrix" },
                          { k: "reports:data-storage", l: "Data storage" },
                          { k: "reports:permissions", l: "Permissions log" },
                          { k: "reports:subscriptions", l: "Subscriptions" },
                        ].map((s) => (
                          <button
                            key={s.k}
                            type="button"
                            onClick={() => setActiveNav(s.k)}
                            className={`block w-full rounded-lg px-2 py-1 text-left ${
                              activeNav === s.k ? "font-semibold text-[#007AFF]" : "text-[var(--apple-text-muted)] hover:text-[var(--apple-text)]"
                            }`}
                          >
                            {s.l}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </nav>

          {/* Collapse Toggle Footer */}
          <div className="flex items-center justify-between border-t border-[var(--apple-border)] p-2.5 text-[11px] text-[var(--apple-text-muted)]">
            {!railCollapsed && <span>Kleen Data Room</span>}
            <button
              type="button"
              onClick={() => setRailCollapsed((v) => !v)}
              title="Toggle navigation rail"
              className="rounded-lg p-1.5 hover:bg-[var(--apple-hover)]"
            >
              {railCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          </div>
        </aside>

        {/* Main Right Content */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Top Bar */}
          <header className="apple-glass flex h-13 shrink-0 items-center justify-between border-b border-[var(--apple-border)] px-5">
            <div className="flex items-center gap-2 text-xs font-semibold capitalize">
              <span>{section.replace("-", " ")}</span>
              {subSection && (
                <>
                  <span className="text-[var(--apple-text-muted)]">/</span>
                  <span className="text-[var(--apple-text-secondary)]">{subSection.replace("-", " ")}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isTrueAdmin && (
                <button
                  type="button"
                  onClick={handleQuickSync}
                  className="hidden sm:flex items-center gap-1.5 rounded-full border border-[var(--apple-border)] bg-[var(--apple-surface)] px-3 py-1 text-[11px] font-medium hover:bg-[var(--apple-hover)]"
                >
                  <Cloud className="h-3.5 w-3.5 text-[#007AFF]" />
                  <span>{project.driveAuthMode === "demo" ? "Demo Mirror" : "Drive Synced"}</span>
                  <RefreshCw className={`h-3 w-3 ${syncingTop ? "animate-spin" : ""}`} />
                </button>
              )}

              <button
                type="button"
                onClick={() => setUiLang((l) => (l === "en" ? "ar" : "en"))}
                title="Switch UI direction (EN / AR)"
                className="flex h-8 items-center gap-1 rounded-full px-2.5 text-xs text-[var(--apple-text-secondary)] hover:bg-[var(--apple-hover)]"
              >
                <Globe className="h-3.5 w-3.5" />
                {uiLang.toUpperCase()}
              </button>

              <button
                type="button"
                onClick={() => setDarkMode((d) => !d)}
                title={darkMode ? "Light mode" : "Dark mode"}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--apple-text-secondary)] hover:bg-[var(--apple-hover)]"
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                title="Help Center"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--apple-text-secondary)] hover:bg-[var(--apple-hover)]"
              >
                <HelpCircle className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowDownloadAppModal(true)}
                title="Download application"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--apple-text-secondary)] hover:bg-[var(--apple-hover)]"
              >
                <Smartphone className="h-4 w-4" />
              </button>

              {/* Profile Avatar */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowProfileMenu((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#007AFF] text-xs font-bold text-white"
                >
                  {(user.firstName?.[0] || "A") + (user.lastName?.[0] || "B")}
                </button>
                {showProfileMenu && (
                  <div className="apple-card absolute top-10 right-0 z-50 w-56 p-2 text-xs shadow-2xl">
                    <div className="border-b border-[var(--apple-border)] px-2.5 py-2">
                      <div className="font-semibold">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-[11px] text-[var(--apple-text-muted)]">{session.actualGroup?.name}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowAccountModal("personal");
                      }}
                      className="mt-1 block w-full rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--apple-hover)]"
                    >
                      Personal information
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowAccountModal("security");
                      }}
                      className="block w-full rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--apple-hover)]"
                    >
                      Security settings
                    </button>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="mt-1 flex w-full items-center gap-1.5 border-t border-[var(--apple-border)] px-2.5 pt-2 pb-1 text-red-500 hover:bg-red-500/10"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Dynamic Page Body */}
          <main className="min-h-0 flex-1 overflow-y-auto p-5">
            {section === "dashboard" && (
              <DashboardView project={project} groups={groups} onNavigateTab={setActiveNav} />
            )}
            {section === "documents" && (
              <DocumentsWorkspace
                subTab={(subSection as "all" | "notes" | "shared-links" | "signatures" | "recent" | "uploads" | "favorites") || "all"}
                onChangeSubTab={(t) => setActiveNav(`documents:${t}`)}
                project={project}
                user={user}
                groups={groups}
                isAdmin={isAdmin}
                isTrueAdmin={isTrueAdmin}
                onViewAs={handleViewAs}
                onNavigateTab={setActiveNav}
                onRefreshSession={onReloadSession}
              />
            )}
            {section === "checklist" && <ChecklistView isAdmin={isAdmin} groups={groups} />}
            {section === "participants" && isAdmin && (
              <ParticipantsView project={project} onNavigateTab={setActiveNav} onRefreshSession={onReloadSession} />
            )}
            {section === "permissions" && isAdmin && (
              <PermissionsView project={project} onViewAs={handleViewAs} onNavigateTab={setActiveNav} />
            )}
            {section === "qna" && <QnaView isAdmin={isAdmin} />}
            {section === "reports" && isAdmin && (
              <ReportsView
                subTab={(subSection as ReportSubTab) || "activity-log"}
                onChangeSubTab={(t) => setActiveNav(`reports:${t}`)}
                project={project}
              />
            )}
            {section === "settings" && isAdmin && (
              <SettingsView
                subTab={(subSection as SettingsSubTab) || "general"}
                onChangeSubTab={(t) => setActiveNav(`settings:${t}`)}
                project={project}
                user={user}
                groups={groups}
                onRefreshSession={onReloadSession}
                onNavigateTab={setActiveNav}
              />
            )}
            {section === "archiving" && isAdmin && (
              <ArchivingView project={project} onRefreshSession={onReloadSession} />
            )}
            {section === "recycle-bin" && isAdmin && <RecycleBinView />}
          </main>
        </div>
      </div>

      {/* NDA / Terms of Access Gate Modal */}
      {pendingTerm && !session.isViewingAs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="apple-card w-full max-w-2xl space-y-4 p-6 text-xs">
            <h2 className="text-base font-semibold">{pendingTerm.title}</h2>
            <div
              dir="auto"
              className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[var(--apple-border)] bg-[var(--apple-bg)] p-4 leading-relaxed text-[var(--apple-text-secondary)]"
            >
              {renderNdaText(pendingTerm.content, {
                name: `${user.firstName} ${user.lastName}`.trim() || user.email,
                title: user.jobTitle || "Authorized Representative",
                company: user.company || "Investor / Partner Entity",
                email: user.email,
              })}
            </div>
            <label className="flex items-center gap-2 font-medium">
              <input type="checkbox" checked={ndaChecked} onChange={(e) => setNdaChecked(e.target.checked)} />
              By accepting, I confirm I have read and agree to the terms of access.
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={handleSignOut} className="rounded-xl border border-[var(--apple-border)] px-4 py-2">
                Decline & Sign out
              </button>
              <button
                type="button"
                disabled={!ndaChecked}
                onClick={async () => {
                  await fetch("/api/settings", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ scope: "accept-terms", termsId: pendingTerm.id }),
                  });
                  setNdaChecked(false);
                  await onReloadSession();
                }}
                className="rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white disabled:opacity-40"
              >
                Accept & Enter Data Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Center Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="apple-card w-full max-w-md space-y-4 p-6 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Kleen Data Room Help</h3>
              <button type="button" onClick={() => setShowHelpModal(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="rounded-xl bg-[var(--apple-bg)] p-3">
              <div>Project ID: <strong className="tabular-nums">{project.projectCode}</strong></div>
              <div className="mt-1 text-[var(--apple-text-secondary)]">
                Sync Engine: Read-Only Google Drive Mirror (drive.readonly)
              </div>
            </div>
            <p className="text-[var(--apple-text-secondary)]">
              Contact Administrator: {project.adminEmail} • {project.adminPhone}
            </p>
          </div>
        </div>
      )}

      {/* Download Application Modal */}
      {showDownloadAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="apple-card w-full max-w-md space-y-4 p-6 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Kleen Data Room Apps</h3>
              <button type="button" onClick={() => setShowDownloadAppModal(false)}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-[var(--apple-text-secondary)]">
              Kleen Data Room is a responsive Apple-inspired progressive web workspace accessible from Mac, Windows, iPad, and iPhone—synced live from Google Drive.
            </p>
            <button type="button" onClick={() => setShowDownloadAppModal(false)} className="w-full rounded-xl bg-[#007AFF] py-2 font-semibold text-white">
              Done
            </button>
          </div>
        </div>
      )}

      {/* Account Personal / Security Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="apple-card w-full max-w-md space-y-4 p-6 text-xs">
            <div className="flex items-center justify-between border-b border-[var(--apple-border)] pb-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAccMsg(null);
                    setShowAccountModal("personal");
                  }}
                  className={`rounded-lg px-3 py-1 font-semibold ${
                    showAccountModal === "personal" ? "bg-[#007AFF] text-white" : "text-[var(--apple-text-secondary)]"
                  }`}
                >
                  Personal information
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAccMsg(null);
                    setShowAccountModal("security");
                  }}
                  className={`rounded-lg px-3 py-1 font-semibold ${
                    showAccountModal === "security" ? "bg-[#007AFF] text-white" : "text-[var(--apple-text-secondary)]"
                  }`}
                >
                  Security settings
                </button>
              </div>
              <button type="button" onClick={() => setShowAccountModal(null)}><X className="h-4 w-4" /></button>
            </div>
            {showAccountModal === "personal" ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const r = await fetch("/api/settings", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      scope: "personal",
                      firstName: accFirst,
                      lastName: accLast,
                      company: accCompany,
                      jobTitle: accJob,
                      phone: accPhone,
                      timezone: accTz,
                    }),
                  });
                  if (r.ok) {
                    setAccMsg("Profile updated");
                    onReloadSession();
                  }
                }}
                className="space-y-2.5"
              >
                <div>
                  <label className="mb-1 block text-[var(--apple-text-muted)]">Email (read-only)</label>
                  <input disabled value={user.email} className="w-full rounded-xl border border-[var(--apple-border)] bg-[var(--apple-bg)]/60 px-3 py-1.5 opacity-70" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block font-medium">First name</label>
                    <input value={accFirst} onChange={(e) => setAccFirst(e.target.value)} className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-1.5" />
                  </div>
                  <div>
                    <label className="mb-1 block font-medium">Last name</label>
                    <input value={accLast} onChange={(e) => setAccLast(e.target.value)} className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-1.5" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block font-medium">Company</label>
                    <input value={accCompany} onChange={(e) => setAccCompany(e.target.value)} className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-1.5" />
                  </div>
                  <div>
                    <label className="mb-1 block font-medium">Job title</label>
                    <input value={accJob} onChange={(e) => setAccJob(e.target.value)} className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-1.5" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block font-medium">Phone</label>
                    <input value={accPhone} onChange={(e) => setAccPhone(e.target.value)} className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-1.5" />
                  </div>
                  <div>
                    <label className="mb-1 block font-medium">Time zone</label>
                    <input value={accTz} onChange={(e) => setAccTz(e.target.value)} className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-1.5" />
                  </div>
                </div>
                {accMsg && <div className="text-emerald-500">{accMsg}</div>}
                <div className="flex justify-end pt-2">
                  <button type="submit" className="rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white">Save changes</button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <label className="flex items-center justify-between rounded-xl border border-[var(--apple-border)] p-3">
                  <span>2-step verification</span>
                  <input
                    type="checkbox"
                    checked={user.twoFactorEnabled}
                    onChange={async (e) => {
                      await fetch("/api/settings", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ scope: "personal", twoFactorEnabled: e.target.checked }),
                      });
                      onReloadSession();
                    }}
                  />
                </label>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (accNewPass.length < 6) return;
                    const r = await fetch("/api/settings", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ scope: "personal", action: "change-password", newPassword: accNewPass }),
                    });
                    if (r.ok) {
                      setAccNewPass("");
                      setAccMsg("Password updated");
                    }
                  }}
                  className="space-y-2 rounded-xl border border-[var(--apple-border)] p-3"
                >
                  <div className="font-medium">Change password</div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      minLength={6}
                      required
                      value={accNewPass}
                      onChange={(e) => setAccNewPass(e.target.value)}
                      placeholder="New password (min 6 chars)"
                      className="flex-1 rounded-lg border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-2.5 py-1.5"
                    />
                    <button type="submit" className="rounded-lg bg-[#007AFF] px-3 py-1.5 font-semibold text-white">
                      Update
                    </button>
                  </div>
                  {accMsg && <div className="text-emerald-500">{accMsg}</div>}
                </form>
                <div className="rounded-xl bg-[var(--apple-bg)] p-3 text-[11px] text-[var(--apple-text-secondary)]">
                  Current session: Browser • {user.timezone}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateProjectModal && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await fetch("/api/settings", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ scope: "create-project", name: newProjName, projectType: newProjType }),
            });
            if (res.ok) {
              const d = await res.json();
              await fetch("/api/auth/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "switch-project", projectId: d.id }),
              });
              setShowCreateProjectModal(false);
              setNewProjName("");
              onReloadSession();
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="apple-card w-full max-w-md space-y-4 p-6 text-xs">
            <h3 className="text-base font-semibold">Create new Data Room project</h3>
            <input required value={newProjName} onChange={(e) => setNewProjName(e.target.value)} placeholder="Project name (e.g. Kleen_Series_B)" className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2" />
            <select value={newProjType} onChange={(e) => setNewProjType(e.target.value)} className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2">
              <option>Fundraising</option>
              <option>M&A sell side</option>
              <option>M&A buy side</option>
              <option>IPO and exits</option>
              <option>Strategic partnership</option>
            </select>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreateProjectModal(false)} className="rounded-xl border border-[var(--apple-border)] px-4 py-2">Cancel</button>
              <button type="submit" className="rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white">Create</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
