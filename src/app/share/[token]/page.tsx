"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ShieldCheck, Lock, FileText } from "lucide-react";
import { KleenLogo } from "@/components/KleenLogo";

export default function PublicSharePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token || "";
  const [meta, setMeta] = useState<{ projectName: string; nodeName: string; dotIndex: string; visitsCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needPasscode, setNeedPasscode] = useState(false);
  const [passcode, setPasscode] = useState("");

  async function loadMeta(code = "") {
    const res = await fetch(`/api/external-links/public?token=${encodeURIComponent(token)}&passcode=${encodeURIComponent(code)}`);
    const d = await res.json();
    if (res.status === 401 && d.requirePasscode) {
      setNeedPasscode(true);
      return;
    }
    if (!res.ok) {
      setError(d.error || "Link unavailable");
      return;
    }
    setNeedPasscode(false);
    setMeta(d);
  }

  useEffect(() => {
    if (token) loadMeta();
  }, [token]);

  return (
    <div className="flex min-h-screen flex-col bg-[#141416] text-[#F5F5F7]">
      <header className="flex h-13 items-center justify-between border-b border-white/10 bg-[#1C1C1E] px-5">
        <div className="flex items-center gap-2.5">
          <KleenLogo size={28} />
          <div className="text-xs">
            <span className="font-semibold">{meta?.projectName || "Kleen Data Room"}</span>
            <span className="mx-2 text-white/30">|</span>
            <span className="text-white/70">{meta ? `${meta.dotIndex} ${meta.nodeName}` : "Shared Document"}</span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF]/15 px-3 py-1 text-[11px] font-medium text-[#0A84FF]">
          <ShieldCheck className="h-3.5 w-3.5" /> External View-Only Link
        </span>
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        {error ? (
          <div className="rounded-2xl border border-white/10 bg-[#1C1C1E] p-8 text-center text-xs">
            <FileText className="mx-auto mb-2 h-8 w-8 text-red-400" />
            <div className="font-semibold text-red-400">{error}</div>
          </div>
        ) : needPasscode ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadMeta(passcode);
            }}
            className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-[#1C1C1E] p-6 text-xs"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Lock className="h-4 w-4 text-[#0A84FF]" /> Passcode Required
            </div>
            <input
              type="password"
              required
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter link passcode"
              className="w-full rounded-xl border border-white/15 bg-[#141416] px-3 py-2 outline-none"
            />
            <button type="submit" className="w-full rounded-xl bg-[#0A84FF] py-2 font-semibold text-white">
              Unlock Document
            </button>
          </form>
        ) : meta ? (
          <div className="h-[85vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl">
            <iframe
              src={`/api/external-links/public?token=${encodeURIComponent(token)}&passcode=${encodeURIComponent(passcode)}&stream=1`}
              className="h-full w-full border-0"
              title={meta.nodeName}
            />
          </div>
        ) : (
          <div className="text-xs text-white/60">Loading shared document...</div>
        )}
      </main>
    </div>
  );
}
