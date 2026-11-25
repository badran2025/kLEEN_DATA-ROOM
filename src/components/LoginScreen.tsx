"use client";

import React, { useState } from "react";
import { Lock, Mail, ArrowRight, ShieldCheck, Globe, Sparkles } from "lucide-react";
import { KleenLogo } from "./KleenLogo";

export function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("ahmed.badran@kleen.sa");
  const [password, setPassword] = useState("kleen2026");
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAr = lang === "ar";

  async function handleSubmit(e: React.FormEvent, overrideEmail?: string, overridePass?: string) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: overrideEmail ?? email,
          password: overridePass ?? password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign in failed");
        setLoading(false);
        return;
      }
      onLoggedIn();
    } catch {
      setError("Network error while signing in.");
      setLoading(false);
    }
  }

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--apple-bg)] px-4 py-10"
    >
      {/* Subtle Apple ambient gradient backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-50"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(0, 122, 255, 0.16), transparent 45%), radial-gradient(circle at 80% 75%, rgba(88, 86, 214, 0.14), transparent 45%)",
        }}
      />

      {/* Top minimal bar */}
      <div className="relative z-10 mb-6 flex w-full max-w-[440px] items-center justify-between">
        <div className="flex items-center gap-2.5">
          <KleenLogo size={32} />
          <div>
            <div className="text-sm font-semibold tracking-tight">Kleen Data Room</div>
            <div className="text-[11px] text-[var(--apple-text-muted)]">
              {isAr ? "غرفة البيانات الافتراضية • Google Drive Mirror" : "Virtual Data Room • Google Drive Mirror"}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setLang(isAr ? "en" : "ar")}
          className="flex items-center gap-1.5 rounded-full border border-[var(--apple-border)] bg-[var(--apple-surface)] px-3 py-1.5 text-xs font-medium text-[var(--apple-text-secondary)] transition hover:bg-[var(--apple-hover)]"
        >
          <Globe className="h-3.5 w-3.5" />
          {isAr ? "English" : "العربية"}
        </button>
      </div>

      {/* Main Frosted Apple Sign-In Card */}
      <div className="apple-glass relative z-10 w-full max-w-[440px] rounded-[22px] border border-[var(--apple-border-strong)] p-7 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#007AFF]/10 text-[#007AFF]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {isAr ? "تسجيل الدخول إلى Kleen_2025" : "Sign in to Kleen Data Room"}
          </h1>
          <p className="mt-1 text-xs text-[var(--apple-text-secondary)]">
            {isAr
              ? "مزامنة مباشرة للقراءة فقط من مجلد Google Drive"
              : "Live Read-Only Google Drive Mirror • Secure Investor Portal"}
          </p>
        </div>

        <form onSubmit={(e) => handleSubmit(e)} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--apple-text-secondary)]">
              {isAr ? "البريد الإلكتروني" : "Email address"}
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--apple-text-muted)]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] py-2.5 pr-3.5 pl-10 text-sm outline-none transition focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--apple-text-secondary)]">
              {isAr ? "كلمة المرور" : "Password"}
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--apple-text-muted)]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] py-2.5 pr-3.5 pl-10 text-sm outline-none transition focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs text-red-500">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#007AFF] py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0066D6] disabled:opacity-60"
          >
            {loading ? (isAr ? "جاري الدخول..." : "Signing in...") : isAr ? "متابعة" : "Continue"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Quick Demo Access Pills */}
        <div className="mt-6 border-t border-[var(--apple-border)] pt-4">
          <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium text-[var(--apple-text-muted)]">
            <Sparkles className="h-3.5 w-3.5 text-[#007AFF]" />
            {isAr ? "دخول تجريبي سريع (كلمة المرور: kleen2026)" : "Quick Demo Accounts (password: kleen2026)"}
          </div>
          <div className="grid grid-cols-1 gap-2">
            {[
              { label: "Ahmed Badran", role: "Administrator", em: "ahmed.badran@kleen.sa" },
              { label: "Khalid Al-Mansoor", role: "Investor Group (NDA + Watermark)", em: "investor@partner-capital.sa" },
              { label: "Sara Al-Harbi", role: "Legal Advisors", em: "counsel@legal-advisors.sa" },
            ].map((acc) => (
              <button
                key={acc.em}
                type="button"
                onClick={(e) => {
                  setEmail(acc.em);
                  setPassword("kleen2026");
                  handleSubmit(e, acc.em, "kleen2026");
                }}
                className="flex items-center justify-between rounded-xl border border-[var(--apple-border)] bg-[var(--apple-surface)] px-3 py-2 text-left text-xs transition hover:border-[#007AFF]/50 hover:bg-[var(--apple-hover)]"
              >
                <div>
                  <div className="font-medium text-[var(--apple-text)]">{acc.label}</div>
                  <div className="text-[11px] text-[var(--apple-text-muted)]">{acc.em}</div>
                </div>
                <span className="rounded-full bg-[#007AFF]/10 px-2.5 py-0.5 text-[10px] font-medium text-[#007AFF]">
                  {acc.role}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="relative z-10 mt-5 text-[11px] text-[var(--apple-text-muted)]">
        © 2026 Kleen Data Room • Read-Only Google Drive Mirroring
      </p>
    </div>
  );
}
