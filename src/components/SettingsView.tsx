"use client";

import React, { useEffect, useState } from "react";
import {
  Pencil,
  Check,
  X,
  Lock,
  Plus,
  Eye,
  Trash2,
  RefreshCw,
  Cloud,
  CheckCircle2,
  Shield,
  Sparkles,
  Download,
} from "lucide-react";
import type { GroupDto, ProjectDto, UserDto } from "@/lib/types";
import { formatDateShort, formatDateTime } from "@/lib/format";
import { KleenLogo } from "./KleenLogo";

export type SettingsSubTab =
  | "notifications"
  | "general"
  | "google-drive"
  | "branding"
  | "documents"
  | "labels"
  | "terms-of-access"
  | "watermarks"
  | "security"
  | "ai-tools"
  | "integrations";

const BRAND_SWATCHES = ["#0D9488", "#15803D", "#6366F1", "#64748B", "#007AFF", "#10B981", "#EF4444", "#F97316", "#EC4899"];

export function SettingsView({
  subTab,
  onChangeSubTab,
  project,
  user,
  groups,
  onRefreshSession,
  onNavigateTab,
}: {
  subTab: SettingsSubTab;
  onChangeSubTab: (t: SettingsSubTab) => void;
  project: ProjectDto;
  user: UserDto;
  groups: GroupDto[];
  onRefreshSession: () => void;
  onNavigateTab: (t: string) => void;
}) {
  const [meta, setMeta] = useState<{
    statusHistory: Array<{ id: string; status: string; actorName: string; createdAt: string }>;
    integrations: Array<{ id: string; key: string; name: string; domain: string; enabled: boolean }>;
    labels: Array<{ id: string; groupName: string; type: string; valuesJson: string }>;
    terms: Array<{
      id: string;
      title: string;
      type: string;
      displayMode: string;
      assignedGroupIds: string;
      content: string;
      enabled: boolean;
      createdAt: string;
    }>;
    acceptances?: Array<{
      id: string;
      termsId: string;
      acceptedAt: string;
      email: string;
      firstName: string;
      lastName: string;
      termsTitle: string;
    }>;
  } | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(project.name);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);

  // Google Drive Sync form
  const [driveFolderInput, setDriveFolderInput] = useState(project.driveRootFolderId || "");
  const [driveAuthMode, setDriveAuthMode] = useState(project.driveAuthMode || "demo");
  const [saJson, setSaJson] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [exclusions, setExclusions] = useState(project.exclusionPatterns || ".DS_Store,Thumbs.db,~$");
  const [syncing, setSyncing] = useState(false);

  // Labels & Terms modals
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [lblName, setLblName] = useState("");
  const [lblType, setLblType] = useState<"Single" | "Multiple">("Single");
  const [lblValues, setLblValues] = useState("");

  const [showTermsModal, setShowTermsModal] = useState(false);
  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [termTitle, setTermTitle] = useState("NDA_Kleen_New");
  const [termType, setTermType] = useState("NDA");
  const [termDisplay, setTermDisplay] = useState("On first sign-in");
  const [termGroupIds, setTermGroupIds] = useState<string[]>([]);
  const [termContent, setTermContent] = useState("");
  const [previewTerm, setPreviewTerm] = useState<{
    id: string;
    title: string;
    type: string;
    displayMode: string;
    assignedGroupIds: string;
    content: string;
  } | null>(null);
  const [previewAccepted, setPreviewAccepted] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  function showToast(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  }

  async function loadMeta() {
    const res = await fetch("/api/settings");
    if (res.ok) setMeta(await res.json());
  }

  useEffect(() => {
    setNameDraft(project.name);
    setDriveFolderInput(project.driveRootFolderId || "");
    setDriveAuthMode(project.driveAuthMode || "demo");
    loadMeta();
  }, [project.id]);

  async function updateProjectFields(fields: Record<string, unknown>, msg = "Settings saved") {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "project-fields", fields }),
    });
    if (res.ok) {
      showToast(msg);
      onRefreshSession();
      loadMeta();
    }
  }

  async function updatePersonal(fields: Record<string, unknown>) {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "personal", ...fields }),
    });
    if (res.ok) {
      showToast("Personal notification preference saved");
      onRefreshSession();
    }
  }

  async function handleSaveAndSyncDrive(e: React.FormEvent) {
    e.preventDefault();
    setSyncing(true);
    const res = await fetch("/api/drive/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "configure-drive",
        driveRootFolderId: driveFolderInput,
        driveAuthMode,
        driveServiceAccountJson: saJson,
        driveApiKey: apiKey,
        exclusionPatterns: exclusions,
        syncImmediately: true,
      }),
    });
    const data = await res.json();
    setSyncing(false);
    if (res.ok) {
      showToast(`Google Drive synced (${data.syncedCount} items)`);
      onRefreshSession();
    } else {
      showToast(data.error || "Failed to sync Google Drive");
    }
  }

  const wmFields: string[] = JSON.parse(project.watermarkFieldsJson || "[]");

  function toggleWmField(field: string) {
    const next = wmFields.includes(field) ? wmFields.filter((f) => f !== field) : [...wmFields, field];
    updateProjectFields({ watermarkFieldsJson: JSON.stringify(next) });
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs Header */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--apple-border)] bg-[var(--apple-surface)] p-1 text-xs">
        {[
          { id: "general" as const, label: "General" },
          { id: "google-drive" as const, label: "Google Drive Sync" },
          { id: "branding" as const, label: "Branding" },
          { id: "documents" as const, label: "Documents" },
          { id: "labels" as const, label: "Labels" },
          { id: "terms-of-access" as const, label: "Terms of access" },
          { id: "watermarks" as const, label: "Watermarks" },
          { id: "security" as const, label: "Security" },
          { id: "ai-tools" as const, label: "AI tools" },
          { id: "integrations" as const, label: "Integrations" },
          { id: "notifications" as const, label: "Personal notifications" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChangeSubTab(t.id)}
            className={`rounded-lg px-2.5 py-1.5 font-medium transition ${
              subTab === t.id
                ? "bg-[#007AFF] text-white"
                : "text-[var(--apple-text-secondary)] hover:text-[var(--apple-text)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 1. Personal > Notifications */}
      {subTab === "notifications" && (
        <div className="apple-card max-w-2xl space-y-4 p-6 text-xs">
          <h3 className="text-base font-semibold">Personal notifications</h3>
          <label className="flex items-center justify-between rounded-xl border border-[var(--apple-border)] p-4">
            <div>
              <div className="font-medium">Uploaded and deleted documents</div>
              <div className="text-[var(--apple-text-muted)]">Receive email alerts when Drive sync detects added or removed files</div>
            </div>
            <input
              type="checkbox"
              checked={user.notifyDocChanges}
              onChange={(e) => updatePersonal({ notifyDocChanges: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-[var(--apple-border)] p-4">
            <div>
              <div className="font-medium">Data storage reached the limit</div>
              <div className="text-[var(--apple-text-muted)]">Alert when mirrored folder volume nears quota</div>
            </div>
            <input
              type="checkbox"
              checked={user.notifyStorageLimit}
              onChange={(e) => updatePersonal({ notifyStorageLimit: e.target.checked })}
            />
          </label>
        </div>
      )}

      {/* 2. General */}
      {subTab === "general" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="apple-card space-y-5 p-6 text-xs">
            <div className="flex items-center justify-between">
              {!editingName ? (
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{project.name}</h2>
                  <button
                    type="button"
                    onClick={() => setEditingName(true)}
                    className="rounded-lg p-1.5 text-[var(--apple-text-muted)] hover:bg-[var(--apple-hover)]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="rounded-xl border border-[#007AFF] bg-[var(--apple-bg)] px-3 py-1.5 text-sm font-semibold outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      updateProjectFields({ name: nameDraft });
                      setEditingName(false);
                    }}
                    className="rounded-lg bg-[#007AFF] p-1.5 text-white"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNameDraft(project.name);
                      setEditingName(false);
                    }}
                    className="rounded-lg border border-[var(--apple-border)] p-1.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <select
                value={project.status}
                onChange={(e) => updateProjectFields({ status: e.target.value })}
                className="rounded-full bg-emerald-500/15 px-3 py-1 font-semibold text-emerald-500 outline-none"
              >
                <option value="Live">Live</option>
                <option value="Locked">Locked</option>
                <option value="Archived">Archived</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div className="rounded-xl bg-[var(--apple-bg)] p-3 text-[var(--apple-text-secondary)]">
              Slug: <span className="font-mono text-[var(--apple-text)]">/project/{project.slug}</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between font-semibold">
                <span>Status history</span>
                <button type="button" onClick={() => setShowAllHistory((v) => !v)} className="text-[#007AFF]">
                  {showAllHistory ? "Show less" : "Show more"}
                </button>
              </div>
              <div className="space-y-1.5">
                {(meta?.statusHistory || []).slice(0, showAllHistory ? 20 : 2).map((h) => (
                  <div key={h.id} className="flex justify-between text-[var(--apple-text-secondary)]">
                    <span>{h.status}</span>
                    <span>
                      {formatDateShort(h.createdAt)} • {h.actorName}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 border-t border-[var(--apple-border)] pt-4">
              <div className="font-semibold">General info</div>
              <div>Project ID: <span className="tabular-nums font-medium">{project.projectCode}</span></div>
              <div>Project type: <span className="font-medium">{project.projectType}</span></div>
              <div>Storage location: <span className="font-medium">{project.storageLocation}</span></div>
              <div>Administrator&apos;s contacts: {project.adminEmail} • {project.adminPhone}</div>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="apple-card p-5">
              <h3 className="text-sm font-semibold">Locking</h3>
              <p className="mt-1 text-[var(--apple-text-secondary)]">
                Prevent any configuration changes while keeping permitted documents open for viewing.
              </p>
              <button
                type="button"
                onClick={() => setShowLockModal(true)}
                className="mt-3 flex items-center gap-1.5 rounded-xl border border-[var(--apple-border-strong)] px-3.5 py-2 font-medium hover:bg-[var(--apple-hover)]"
              >
                <Lock className="h-3.5 w-3.5" /> Lock project
              </button>
            </div>

            <div className="apple-card p-5">
              <h3 className="text-sm font-semibold">Archiving & Closure</h3>
              <p className="mt-1 text-[var(--apple-text-secondary)]">
                Archive online, download a ZIP backup, or schedule project closure.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onNavigateTab("archiving")}
                  className="rounded-xl bg-[#007AFF] px-3.5 py-2 font-semibold text-white"
                >
                  Open Archiving
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Google Drive Sync (Read-Only Mirror Configuration) */}
      {subTab === "google-drive" && (
        <form onSubmit={handleSaveAndSyncDrive} className="apple-card max-w-3xl space-y-5 p-6 text-xs">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--apple-border)] pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#007AFF]/10 text-[#007AFF]">
                <Cloud className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Google Drive Read-Only Mirror</h3>
                <p className="text-[var(--apple-text-secondary)]">
                  Connect a specific Google Drive folder to mirror its exact subfolders, files, and contents into Kleen Data Room.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-500">
              Read-Only Mode (drive.readonly)
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block font-medium">Target Google Drive Folder URL or Folder ID</label>
              <input
                value={driveFolderInput}
                onChange={(e) => setDriveFolderInput(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/1AbC... or Folder ID"
                className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3.5 py-2.5"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium">Authentication Mode</label>
              <select
                value={driveAuthMode}
                onChange={(e) => setDriveAuthMode(e.target.value)}
                className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
              >
                <option value="demo">Demo Mirror (Built-in Kleen_2025 structure)</option>
                <option value="service_account">Google Service Account JSON (Recommended)</option>
                <option value="oauth">Google OAuth 2.0 (User Sign-In)</option>
                <option value="api_key">Google API Key (Shared-with-link folder)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-medium">Exclusion Patterns (comma-separated)</label>
              <input
                value={exclusions}
                onChange={(e) => setExclusions(e.target.value)}
                className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
              />
            </div>
          </div>

          {driveAuthMode === "service_account" && (
            <div>
              <label className="mb-1 block font-medium">
                Service Account JSON (share your Google Drive folder as Viewer with the service account client_email)
              </label>
              <textarea
                rows={4}
                value={saJson}
                onChange={(e) => setSaJson(e.target.value)}
                placeholder='{"type":"service_account","project_id":...}'
                className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] p-3 font-mono text-[11px]"
              />
            </div>
          )}

          {driveAuthMode === "api_key" && (
            <div>
              <label className="mb-1 block font-medium">Google Drive API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
              />
            </div>
          )}

          {driveAuthMode === "oauth" && (
            <div className="flex items-center justify-between rounded-xl border border-[var(--apple-border)] bg-[var(--apple-bg)] p-3.5">
              <span>Authorize read-only access via Google OAuth 2.0</span>
              <a
                href="/api/drive/oauth"
                className="rounded-xl bg-[#007AFF] px-3.5 py-1.5 font-semibold text-white"
              >
                Connect Google Account
              </a>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--apple-border)] pt-4">
            <div className="text-[var(--apple-text-secondary)]">
              Last synced: <span className="font-medium text-[var(--apple-text)]">{formatDateTime(project.lastSyncedAt)}</span> •
              Status: <span className="font-semibold text-emerald-500">{project.lastSyncStatus}</span>
              {project.lastSyncError && <div className="mt-1 text-red-500">{project.lastSyncError}</div>}
            </div>
            <button
              type="submit"
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Save & Sync Now"}
            </button>
          </div>
        </form>
      )}

      {/* 4. Branding */}
      {subTab === "branding" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="apple-card space-y-5 p-6 text-xs">
            <h3 className="text-base font-semibold">Branding</h3>
            <div>
              <div className="mb-2 font-medium">Theme color</div>
              <div className="flex flex-wrap gap-2.5">
                {BRAND_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => updateProjectFields({ themeColor: hex })}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/20 shadow-xs"
                    style={{ backgroundColor: hex }}
                  >
                    {project.themeColor === hex && <Check className="h-4 w-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between rounded-xl border border-[var(--apple-border)] p-3.5">
              <div>
                <div className="font-medium">Customize invitations</div>
                <div className="text-[var(--apple-text-muted)]">Use custom sender alias in invitation emails</div>
              </div>
              <input
                type="checkbox"
                checked={project.customInvitations}
                onChange={(e) => updateProjectFields({ customInvitations: e.target.checked })}
              />
            </label>
          </div>

          <div className="apple-card p-6 text-xs">
            <div className="mb-3 font-semibold text-[var(--apple-text-secondary)]">Login page preview</div>
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--apple-border)] bg-[var(--apple-bg)] p-8">
              <KleenLogo size={38} accent={project.themeColor} />
              <div className="mt-3 text-sm font-semibold">Sign in to {project.name}</div>
              <div className="mt-3 w-56 rounded-xl border border-[var(--apple-border)] bg-[var(--apple-surface)] px-3 py-2 text-[11px] text-[var(--apple-text-muted)]">
                name@company.com
              </div>
              <div
                className="mt-2.5 w-56 rounded-xl py-2 text-center text-[11px] font-semibold text-white"
                style={{ backgroundColor: project.themeColor }}
              >
                Continue
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Documents Settings */}
      {subTab === "documents" && (
        <div className="apple-card max-w-2xl space-y-3 p-6 text-xs">
          <h3 className="text-base font-semibold">Documents behavior</h3>
          {[
            {
              key: "autoIndexing",
              val: project.autoIndexing,
              title: "Automatic indexing",
              desc: "Assign sequential dot-delimited indices to mirrored Google Drive folders and files",
            },
            {
              key: "versioning",
              val: project.versioning,
              title: "Versioning",
              desc: "Track version updates detected during Google Drive synchronization",
            },
            {
              key: "publishing",
              val: project.publishing,
              title: "Publishing",
              desc: "Keep newly synced documents hidden from investors until explicitly published",
            },
          ].map((item) => (
            <label key={item.key} className="flex items-center justify-between rounded-xl border border-[var(--apple-border)] p-4">
              <div>
                <div className="font-medium">{item.title}</div>
                <div className="text-[var(--apple-text-muted)]">{item.desc}</div>
              </div>
              <input
                type="checkbox"
                checked={item.val}
                onChange={(e) => updateProjectFields({ [item.key]: e.target.checked })}
              />
            </label>
          ))}
        </div>
      )}

      {/* 6. Labels */}
      {subTab === "labels" && (
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Document Labels</h3>
            <button
              type="button"
              onClick={() => setShowLabelModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-3.5 py-2 font-semibold text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Add labels
            </button>
          </div>
          <div className="apple-card overflow-hidden">
            <table className="w-full text-left">
              <thead className="border-b border-[var(--apple-border)] bg-[var(--apple-bg)]/50 text-[11px] font-semibold">
                <tr>
                  <th className="px-4 py-3">Group</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--apple-border)]">
                {(meta?.labels || []).map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 font-medium">{l.groupName}</td>
                    <td className="px-4 py-3">{l.type}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {(JSON.parse(l.valuesJson || "[]") as string[]).map((v) => (
                          <span key={v} className="rounded-full bg-[var(--apple-selected)] px-2.5 py-0.5 text-[10px] font-medium text-[#007AFF]">
                            {v}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. Terms of Access */}
      {subTab === "terms-of-access" && (
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold">Terms of access (NDA & Disclaimers)</h3>
              <p className="text-[11px] text-[var(--apple-text-muted)]">
                Participants in assigned groups must accept enabled agreements before entering the Data Room.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const rows = meta?.acceptances || [];
                  const csv = [
                    "Terms Title,Participant,Email,Accepted At",
                    ...rows.map((r) => `"${r.termsTitle}","${r.firstName} ${r.lastName}","${r.email}","${r.acceptedAt}"`),
                  ].join("\n");
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${project.name}-accepted-terms.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-2 font-medium hover:bg-[var(--apple-hover)]"
              >
                <Download className="h-3.5 w-3.5" /> Download accepted terms ({meta?.acceptances?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingTermId(null);
                  setTermTitle("NDA_Kleen_New");
                  setTermType("NDA");
                  setTermDisplay("On first sign-in");
                  setTermGroupIds([]);
                  setTermContent(
                    "By accessing Kleen Data Room, you agree to maintain strict confidentiality of all mirrored documents and disclosures."
                  );
                  setShowTermsModal(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-3.5 py-2 font-semibold text-white"
              >
                <Plus className="h-3.5 w-3.5" /> Create new terms
              </button>
            </div>
          </div>
          <div className="apple-card overflow-hidden">
            <table className="w-full text-left">
              <thead className="border-b border-[var(--apple-border)] bg-[var(--apple-bg)]/50 text-[11px] font-semibold">
                <tr>
                  <th className="px-4 py-3">Terms of access</th>
                  <th className="px-4 py-3">Display</th>
                  <th className="px-4 py-3">Assigned groups</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--apple-border)]">
                {(meta?.terms || []).map((t) => {
                  const gIds: string[] = JSON.parse(t.assignedGroupIds || "[]");
                  const gNames =
                    gIds.length === 0
                      ? ["All participant groups"]
                      : gIds.map((gid) => groups.find((g) => g.id === gid)?.name || gid);
                  return (
                    <tr key={t.id} className="hover:bg-[var(--apple-hover)]">
                      <td className="px-4 py-3 font-medium">
                        <div>{t.title}</div>
                        <div className="text-[10px] text-[var(--apple-text-muted)]">{t.type}</div>
                      </td>
                      <td className="px-4 py-3">{t.displayMode}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {gNames.map((gn) => (
                            <span
                              key={gn}
                              className="rounded-full bg-[var(--apple-selected)] px-2 py-0.5 text-[10px] font-medium text-[#007AFF]"
                            >
                              {gn}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{formatDateShort(t.createdAt)}</td>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={t.enabled}
                          onChange={async () => {
                            await fetch("/api/settings", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ scope: "toggle-terms", id: t.id }),
                            });
                            loadMeta();
                            onRefreshSession();
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTermId(t.id);
                              setTermTitle(t.title);
                              setTermType(t.type);
                              setTermDisplay(t.displayMode);
                              setTermGroupIds(JSON.parse(t.assignedGroupIds || "[]"));
                              setTermContent(t.content);
                              setShowTermsModal(true);
                            }}
                            className="rounded-lg p-1.5 text-[var(--apple-text-secondary)] hover:bg-[var(--apple-bg)] hover:text-[#007AFF]"
                            title="Edit terms"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewAccepted(false);
                              setPreviewTerm(t);
                            }}
                            className="rounded-lg p-1.5 text-[var(--apple-text-secondary)] hover:bg-[var(--apple-bg)] hover:text-[#007AFF]"
                            title="Preview as a user"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch("/api/settings", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ scope: "delete-terms", id: t.id }),
                              });
                              loadMeta();
                            }}
                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-500/10"
                            title="Delete terms"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. Watermarks */}
      {subTab === "watermarks" && (
        <div className="apple-card max-w-2xl space-y-5 p-6 text-xs">
          <label className="flex items-center justify-between border-b border-[var(--apple-border)] pb-4">
            <div>
              <div className="text-base font-semibold">Display watermarks</div>
              <div className="text-[var(--apple-text-muted)]">Select when watermarks apply, their appearance, and details</div>
            </div>
            <input
              type="checkbox"
              checked={project.watermarkEnabled}
              onChange={(e) => updateProjectFields({ watermarkEnabled: e.target.checked })}
            />
          </label>

          <div className="space-y-2">
            <div className="font-semibold">When</div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={project.watermarkOnView}
                  onChange={(e) => updateProjectFields({ watermarkOnView: e.target.checked })}
                />
                Viewing
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={project.watermarkOnPrint}
                  onChange={(e) => updateProjectFields({ watermarkOnPrint: e.target.checked })}
                />
                Printing
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={project.watermarkOnDownload}
                  onChange={(e) => updateProjectFields({ watermarkOnDownload: e.target.checked })}
                />
                Downloading PDF or encrypted file
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <div className="mb-1.5 font-semibold">Color</div>
              <div className="flex gap-2">
                {[
                  { id: "gray", hex: "#71717A" },
                  { id: "red", hex: "#EF4444" },
                  { id: "blue", hex: "#007AFF" },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => updateProjectFields({ watermarkColor: c.id })}
                    className={`h-7 w-7 rounded-full border-2 ${project.watermarkColor === c.id ? "border-white ring-2 ring-[#007AFF]" : "border-transparent"}`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 font-semibold">Opacity ({project.watermarkOpacity}%)</div>
              <input
                type="range"
                min={10}
                max={90}
                value={project.watermarkOpacity}
                onChange={(e) => updateProjectFields({ watermarkOpacity: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <div className="mb-1.5 font-semibold">Position</div>
              <select
                value={project.watermarkPosition}
                onChange={(e) => updateProjectFields({ watermarkPosition: e.target.value })}
                className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-2.5 py-1.5"
              >
                <option value="diagonal">Diagonal</option>
                <option value="grid">Tiled Grid</option>
                <option value="corner">Corner</option>
              </select>
            </div>
          </div>

          <div>
            <div className="mb-2 font-semibold">Details included in watermark</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["projectName", "Project name"],
                ["email", "Email"],
                ["fullName", "Full name"],
                ["dateTime", "Date and time"],
                ["company", "Company"],
                ["group", "Group"],
                ["ip", "IP address"],
                ["customText", "Custom text"],
              ].map(([k, l]) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="checkbox" checked={wmFields.includes(k)} onChange={() => toggleWmField(k)} />
                  {l}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 9. Security */}
      {subTab === "security" && (
        <div className="apple-card max-w-2xl space-y-3 p-6 text-xs">
          <div className="flex items-center gap-2 text-base font-semibold">
            <Shield className="h-4 w-4 text-[#007AFF]" /> Security Policies
          </div>
          {[
            { key: "supportAccess", val: project.supportAccess, title: "Support access", desc: "Authorize support diagnostics" },
            { key: "twoFactorRequired", val: project.twoFactorRequired, title: "2-step verification", desc: "Require second factor for all participants" },
            { key: "emailVerification", val: project.emailVerification, title: "Email verification", desc: "Require OTP email confirmation on unknown devices" },
          ].map((item) => (
            <label key={item.key} className="flex items-center justify-between rounded-xl border border-[var(--apple-border)] p-4">
              <div>
                <div className="font-medium">{item.title}</div>
                <div className="text-[var(--apple-text-muted)]">{item.desc}</div>
              </div>
              <input
                type="checkbox"
                checked={item.val}
                onChange={(e) => updateProjectFields({ [item.key]: e.target.checked })}
              />
            </label>
          ))}
        </div>
      )}

      {/* 10. AI Tools */}
      {subTab === "ai-tools" && (
        <div className="apple-card max-w-2xl space-y-3 p-6 text-xs">
          <div className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 text-[#007AFF]" /> AI Tools (Zero data training guarantee)
          </div>
          {[
            { key: "aiToolsEnabled", val: project.aiToolsEnabled, title: "Enable AI tools", desc: "All tools run internally without training on Data Room content" },
            { key: "aiRedaction", val: project.aiRedaction, title: "AI redaction", desc: "Detect PII such as names, emails, and phone numbers" },
            { key: "aiSearch", val: project.aiSearch, title: "AI search", desc: "Instant summaries and semantic answers inside Kleen Viewer" },
            { key: "aiTranslation", val: project.aiTranslation, title: "AI translation", desc: "Translate mirrored documents across 100+ languages" },
            { key: "aiSimilarQna", val: project.aiSimilarQna, title: "Similar questions in Q&A", desc: "Suggest existing answers for recurring investor questions" },
          ].map((item) => (
            <label key={item.key} className="flex items-center justify-between rounded-xl border border-[var(--apple-border)] p-4">
              <div>
                <div className="font-medium">{item.title}</div>
                <div className="text-[var(--apple-text-muted)]">{item.desc}</div>
              </div>
              <input
                type="checkbox"
                checked={item.val}
                onChange={(e) => updateProjectFields({ [item.key]: e.target.checked })}
              />
            </label>
          ))}
        </div>
      )}

      {/* 11. Integrations */}
      {subTab === "integrations" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
          {(meta?.integrations || []).map((intg) => (
            <div key={intg.id} className="apple-card flex items-center justify-between p-4">
              <div>
                <div className="font-semibold">{intg.name}</div>
                <div className="text-[11px] text-[var(--apple-text-muted)]">{intg.domain}</div>
              </div>
              <input
                type="checkbox"
                checked={intg.enabled}
                onChange={async () => {
                  await fetch("/api/settings", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ scope: "toggle-integration", key: intg.key }),
                  });
                  loadMeta();
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showLockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="apple-card w-full max-w-md space-y-4 p-6 text-xs">
            <h3 className="text-base font-semibold">Lock project</h3>
            <p className="text-[var(--apple-text-secondary)]">
              No changes are possible while locked. Active participants retain read access per permissions.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowLockModal(false)} className="rounded-xl border border-[var(--apple-border)] px-4 py-2">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  updateProjectFields({ status: "Locked" });
                  setShowLockModal(false);
                }}
                className="rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white"
              >
                Confirm & lock
              </button>
            </div>
          </div>
        </div>
      )}

      {showLabelModal && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await fetch("/api/settings", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                scope: "create-label",
                groupName: lblName,
                type: lblType,
                values: lblValues.split(",").map((v) => v.trim()).filter(Boolean),
              }),
            });
            setShowLabelModal(false);
            setLblName("");
            setLblValues("");
            loadMeta();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="apple-card w-full max-w-md space-y-4 p-6 text-xs">
            <h3 className="text-base font-semibold">Add Label Group</h3>
            <input required value={lblName} onChange={(e) => setLblName(e.target.value)} placeholder="Group name" className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2" />
            <select value={lblType} onChange={(e) => setLblType(e.target.value as "Single" | "Multiple")} className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2">
              <option value="Single">Single</option>
              <option value="Multiple">Multiple</option>
            </select>
            <input required value={lblValues} onChange={(e) => setLblValues(e.target.value)} placeholder="Comma-separated values (e.g. Finance, Tax)" className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowLabelModal(false)} className="rounded-xl border border-[var(--apple-border)] px-4 py-2">Cancel</button>
              <button type="submit" className="rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white">Create</button>
            </div>
          </div>
        </form>
      )}

      {showTermsModal && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await fetch("/api/settings", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                scope: editingTermId ? "update-terms" : "create-terms",
                id: editingTermId,
                title: termTitle,
                type: termType,
                displayMode: termDisplay,
                assignedGroupIds: termGroupIds,
                content: termContent,
              }),
            });
            setShowTermsModal(false);
            setEditingTermId(null);
            showToast(editingTermId ? "Agreement updated" : "Agreement created");
            loadMeta();
            onRefreshSession();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="apple-card w-full max-w-lg space-y-3 p-6 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">
                {editingTermId ? "Edit Terms of Access" : "Create Terms of Access"}
              </h3>
              <button type="button" onClick={() => setShowTermsModal(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              <label className="mb-1 block font-medium">Title</label>
              <input
                required
                value={termTitle}
                onChange={(e) => setTermTitle(e.target.value)}
                placeholder="Title"
                className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block font-medium">Type</label>
                <select
                  value={termType}
                  onChange={(e) => setTermType(e.target.value)}
                  className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
                >
                  <option>NDA</option>
                  <option>Terms and conditions of access</option>
                  <option>Confidentiality agreement</option>
                  <option>Disclaimer</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium">Display terms of access</label>
                <select
                  value={termDisplay}
                  onChange={(e) => setTermDisplay(e.target.value)}
                  className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
                >
                  <option>On first sign-in</option>
                  <option>On each sign-in</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block font-medium">
                Assigned groups (leave all unchecked to apply to ALL participant groups)
              </label>
              <div className="flex flex-wrap gap-2.5 rounded-xl border border-[var(--apple-border)] bg-[var(--apple-bg)]/60 p-2.5">
                {groups
                  .filter((g) => g.role !== "Administrator")
                  .map((g) => (
                    <label key={g.id} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={termGroupIds.includes(g.id)}
                        onChange={(e) =>
                          setTermGroupIds((prev) =>
                            e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id)
                          )
                        }
                      />
                      {g.name}
                    </label>
                  ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block font-medium">Terms content</label>
              <textarea
                required
                rows={5}
                value={termContent}
                onChange={(e) => setTermContent(e.target.value)}
                placeholder="Legal NDA / terms body..."
                className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] p-3 leading-relaxed"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="rounded-xl border border-[var(--apple-border)] px-4 py-2"
              >
                Cancel
              </button>
              <button type="submit" className="rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white">
                {editingTermId ? "Save changes" : "Create"}
              </button>
            </div>
          </div>
        </form>
      )}

      {previewTerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs">
          <div className="apple-card w-full max-w-lg space-y-4 p-6 text-xs">
            <div className="flex items-center justify-between border-b border-[var(--apple-border)] pb-3">
              <div>
                <div className="text-[11px] font-semibold text-[#007AFF]">Previewing as a user</div>
                <h3 className="text-base font-semibold">{previewTerm.title}</h3>
              </div>
              <button type="button" onClick={() => setPreviewTerm(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[var(--apple-border)] bg-[var(--apple-bg)] p-4 leading-relaxed text-[var(--apple-text-secondary)]">
              {previewTerm.content}
            </div>
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={previewAccepted}
                onChange={(e) => setPreviewAccepted(e.target.checked)}
              />
              By accepting, I confirm I have read the terms
            </label>
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  const t = previewTerm;
                  setPreviewTerm(null);
                  setEditingTermId(t.id);
                  setTermTitle(t.title);
                  setTermType(t.type);
                  setTermDisplay(t.displayMode);
                  setTermGroupIds(JSON.parse(t.assignedGroupIds || "[]"));
                  setTermContent(t.content);
                  setShowTermsModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--apple-border-strong)] px-3.5 py-2 font-medium hover:bg-[var(--apple-hover)]"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit agreement
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewTerm(null)}
                  className="rounded-xl border border-[var(--apple-border)] px-4 py-2"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={!previewAccepted}
                  onClick={() => setPreviewTerm(null)}
                  className="rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white disabled:opacity-40"
                >
                  Accept
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-xl bg-[#1C1C1E] px-4 py-2 text-xs text-white shadow-2xl">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  );
}
