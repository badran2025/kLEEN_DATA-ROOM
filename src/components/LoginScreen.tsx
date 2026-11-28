"use client";

import React, { useState } from "react";
import { Lock, Mail, ArrowRight, ShieldCheck, Globe } from "lucide-react";
import { KleenLogo } from "./KleenLogo";

export function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAr = lang === "ar";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--apple-text-secondary)]">
              {isAr ? "البريد الإلكتروني" : "Email address"}
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--apple-text-muted)]" />
              <input
                type="email"
                required
                autoComplete="email"
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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

        <p className="mt-5 border-t border-[var(--apple-border)] pt-4 text-center text-[11px] text-[var(--apple-text-muted)]">
          {isAr
            ? "الدخول مقتصر على المشاركين المصرح لهم. استخدم رابط الدعوة إذا كانت هذه زيارتك الأولى."
            : "Access is restricted to authorized participants. Use your invitation link if signing in for the first time."}
        </p>
      </div>

      <p className="relative z-10 mt-5 text-[11px] text-[var(--apple-text-muted)]">
        © 2026 Kleen Data Room • Read-Only Google Drive Mirroring
      </p>
    </div>
  );
}
