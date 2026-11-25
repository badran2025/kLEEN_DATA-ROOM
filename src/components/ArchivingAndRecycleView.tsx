"use client";

import React, { useEffect, useState } from "react";
import { Archive, HardDriveDownload, Usb, Power, Trash2, CheckCircle2 } from "lucide-react";
import type { ProjectDto } from "@/lib/types";
import { formatBytes, formatDateShort } from "@/lib/format";

export function ArchivingView({
  project,
  onRefreshSession,
}: {
  project: ProjectDto;
  onRefreshSession: () => void;
}) {
  const [modal, setModal] = useState<"online" | "usb" | "close" | null>(null);
  const [durationYears, setDurationYears] = useState(5);
  const [usbAddress, setUsbAddress] = useState("");
  const [closeReason, setCloseReason] = useState("Deal completed");
  const [nps, setNps] = useState(10);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  }

  async function submitArchive(type: "Online" | "Downloadable" | "USB", config: Record<string, unknown>) {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "archive-order", type, config }),
    });
    setModal(null);
    showToast(`${type} archive action recorded`);
    onRefreshSession();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Project archiving</h2>
        <p className="text-xs text-[var(--apple-text-secondary)]">
          Preserve your Data Room online, download a complete offline bundle, or schedule project closure.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Online Archive */}
        <div className="apple-card flex flex-col justify-between p-5 text-xs">
          <div>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#007AFF]/10 text-[#007AFF]">
              <Archive className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold">Online archive</h3>
            <p className="mt-1 leading-relaxed text-[var(--apple-text-secondary)]">
              Store your project online in read-only archival state for up to 5 years with controlled participant access.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModal("online")}
            className="mt-4 w-full rounded-xl bg-[#007AFF] py-2 font-semibold text-white"
          >
            Archive project
          </button>
        </div>

        {/* Offline Backup */}
        <div className="apple-card flex flex-col justify-between p-5 text-xs">
          <div>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <HardDriveDownload className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold">Offline backup</h3>
            <p className="mt-1 leading-relaxed text-[var(--apple-text-secondary)]">
              Create a free downloadable ZIP backup of all mirrored Google Drive documents or order a physical encrypted USB archive.
            </p>
          </div>
          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={async () => {
                const res = await fetch("/api/documents/bulk-download", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ nodeIds: [], parentDriveId: null, format: "original" }),
                });
                if (res.ok) {
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${project.name}-offline-archive.zip`;
                  a.click();
                  URL.revokeObjectURL(url);
                  submitArchive("Downloadable", { createdAt: new Date().toISOString() });
                }
              }}
              className="w-full rounded-xl border border-[var(--apple-border-strong)] py-2 font-medium hover:bg-[var(--apple-hover)]"
            >
              + Create downloadable archive (Free)
            </button>
            <button
              type="button"
              onClick={() => setModal("usb")}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--apple-border-strong)] py-2 font-medium hover:bg-[var(--apple-hover)]"
            >
              <Usb className="h-3.5 w-3.5" /> Place USB archive order
            </button>
          </div>
        </div>

        {/* Project Closure */}
        <div className="apple-card flex flex-col justify-between p-5 text-xs">
          <div>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
              <Power className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold">Project closure</h3>
            <p className="mt-1 leading-relaxed text-[var(--apple-text-secondary)]">
              Terminate access for all participants and administrators immediately or on a scheduled date.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModal("close")}
            className="mt-4 w-full rounded-xl border border-red-500/40 bg-red-500/10 py-2 font-semibold text-red-500 hover:bg-red-500/20"
          >
            Close project
          </button>
        </div>
      </div>

      {modal === "online" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="apple-card w-full max-w-md space-y-4 p-6 text-xs">
            <h3 className="text-base font-semibold">Configure Online Archive</h3>
            <div>
              <label className="mb-1 block font-medium">Duration (years)</label>
              <select
                value={durationYears}
                onChange={(e) => setDurationYears(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
              >
                {[1, 2, 3, 5].map((y) => (
                  <option key={y} value={y}>
                    {y} years
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-500">
              Total value: $0.00 (Included)
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className="rounded-xl border border-[var(--apple-border)] px-4 py-2">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submitArchive("Online", { durationYears })}
                className="rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white"
              >
                Archive project
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === "usb" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="apple-card w-full max-w-md space-y-4 p-6 text-xs">
            <h3 className="text-base font-semibold">Order Encrypted USB Archive</h3>
            <input
              value={usbAddress}
              onChange={(e) => setUsbAddress(e.target.value)}
              placeholder="Recipient shipping address..."
              className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className="rounded-xl border border-[var(--apple-border)] px-4 py-2">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submitArchive("USB", { address: usbAddress })}
                className="rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white"
              >
                Confirm order
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === "close" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="apple-card w-full max-w-md space-y-4 p-6 text-xs">
            <h3 className="text-base font-semibold text-red-500">Close Data Room</h3>
            <div>
              <label className="mb-1 block font-medium">Reason</label>
              <select
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
              >
                <option>Deal completed</option>
                <option>Deal postponed</option>
                <option>Migrating workspace</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium">NPS Score (1-10): {nps}</label>
              <input type="range" min={1} max={10} value={nps} onChange={(e) => setNps(Number(e.target.value))} className="w-full" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className="rounded-xl border border-[var(--apple-border)] px-4 py-2">
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/settings", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ scope: "project-fields", fields: { status: "Closed" } }),
                  });
                  setModal(null);
                  onRefreshSession();
                  showToast("Project marked as Closed");
                }}
                className="rounded-xl bg-red-500 px-4 py-2 font-semibold text-white"
              >
                Close project
              </button>
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

export function RecycleBinView() {
  const [trashed, setTrashed] = useState<Array<{ id: string; name: string; dotIndex: string; sizeBytes: number; trashedAt: string }>>([]);

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => (r.ok ? r.json() : { trashedNodes: [] }))
      .then((d) => setTrashed(d.trashedNodes || []));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Recycle bin</h2>
        <p className="text-xs text-[var(--apple-text-secondary)]">
          Items removed from the linked Google Drive folder during Read-Only Mirror syncs appear here for audit visibility.
        </p>
      </div>

      {trashed.length === 0 ? (
        <div className="apple-card flex flex-col items-center justify-center p-14 text-center text-xs">
          <Trash2 className="mb-3 h-10 w-10 text-[var(--apple-text-muted)]" />
          <div className="text-sm font-semibold">Recycle bin is empty</div>
          <p className="mt-1 text-[var(--apple-text-secondary)]">
            Any files removed from your mirrored Google Drive folder will be tracked here.
          </p>
        </div>
      ) : (
        <div className="apple-card overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--apple-border)] bg-[var(--apple-bg)]/50 text-[11px] font-semibold">
              <tr>
                <th className="px-4 py-3">Index</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Removed on</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--apple-border)]">
              {trashed.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 tabular-nums">{t.dotIndex}</td>
                  <td dir="auto" className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 tabular-nums">{formatBytes(t.sizeBytes)}</td>
                  <td className="px-4 py-3 tabular-nums text-[var(--apple-text-muted)]">{formatDateShort(t.trashedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
