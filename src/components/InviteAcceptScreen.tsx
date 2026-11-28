"use client";

import React, { useEffect, useState } from "react";
import { ShieldCheck, Lock, User, ArrowRight, AlertCircle } from "lucide-react";
import { KleenLogo } from "./KleenLogo";

interface InviteInfo {
  email: string;
  firstName: string;
  lastName: string;
  projectName: string;
  groupName: string;
  accessStart: string | null;
  accessEnd: string | null;
}

export function InviteAcceptScreen({
  token,
  onAccepted,
  onBackToLogin,
}: {
  token: string;
  onAccepted: () => void;
  onBackToLogin: () => void;
}) {
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/accept-invite?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setError(d.error || "Invalid invitation link.");
          return;
        }
        setInfo(d);
        setFirstName(d.firstName || "");
        setLastName(d.lastName || "");
      })
      .catch(() => setError("Unable to verify invitation."));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/auth/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, firstName, lastName }),
    });
    const d = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(d.error || "Could not activate account.");
      return;
    }
    onAccepted();
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--apple-bg)] px-4 py-10">
      <div className="apple-glass w-full max-w-[460px] rounded-[22px] border border-[var(--apple-border-strong)] p-7 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <KleenLogo size={36} />
          <div>
            <div className="text-sm font-semibold">Kleen Data Room</div>
            <div className="text-[11px] text-[var(--apple-text-muted)]">Participant Onboarding</div>
          </div>
        </div>

        {!info && !error ? (
          <div className="py-10 text-center text-xs text-[var(--apple-text-secondary)]">Verifying your invitation...</div>
        ) : error && !info ? (
          <div className="space-y-4 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
            <div className="text-sm font-semibold text-red-500">{error}</div>
            <button
              type="button"
              onClick={onBackToLogin}
              className="rounded-xl bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white"
            >
              Go to Sign In
            </button>
          </div>
        ) : info ? (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="rounded-xl border border-[#007AFF]/25 bg-[#007AFF]/10 p-3.5">
              <div className="flex items-center gap-2 font-semibold text-[#007AFF]">
                <ShieldCheck className="h-4 w-4" />
                You&apos;re invited to {info.projectName}
              </div>
              <div className="mt-1 text-[11px] text-[var(--apple-text-secondary)]">
                Email: <strong>{info.email}</strong> • Group: <strong>{info.groupName}</strong>
              </div>
              {(info.accessStart || info.accessEnd) && (
                <div className="mt-1 text-[10px] text-[var(--apple-text-muted)]">
                  Access window: {info.accessStart ? new Date(info.accessStart).toLocaleString() : "Now"} →{" "}
                  {info.accessEnd ? new Date(info.accessEnd).toLocaleString() : "No expiration"}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block font-medium">First name</label>
                <div className="relative">
                  <User className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--apple-text-muted)]" />
                  <input
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] py-2 pr-3 pl-8 outline-none focus:border-[#007AFF]"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-medium">Last name</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-2 outline-none focus:border-[#007AFF]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium">Create your password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--apple-text-muted)]" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] py-2 pr-3 pl-8 outline-none focus:border-[#007AFF]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium">Confirm password</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-2 outline-none focus:border-[#007AFF]"
              />
            </div>

            {error && <div className="rounded-xl bg-red-500/10 p-2.5 text-red-500">{error}</div>}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#007AFF] py-2.5 font-semibold text-white hover:bg-[#0066D6] disabled:opacity-60"
            >
              {submitting ? "Activating..." : "Set Password & Enter Data Room"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
