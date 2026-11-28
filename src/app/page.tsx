"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { SessionResponse } from "@/lib/types";
import { LoginScreen } from "@/components/LoginScreen";
import { InviteAcceptScreen } from "@/components/InviteAcceptScreen";
import { DataRoomShell } from "@/components/DataRoomShell";
import { KleenLogo } from "@/components/KleenLogo";

export default function HomePage() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSession(data);
      } else {
        setSession({ authenticated: false });
      }
    } catch {
      setSession({ authenticated: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inv = params.get("invite");
    if (inv) setInviteToken(inv);
    loadSession();
  }, [loadSession]);

  if (inviteToken) {
    return (
      <InviteAcceptScreen
        token={inviteToken}
        onAccepted={() => {
          window.history.replaceState({}, "", "/");
          setInviteToken(null);
          setLoading(true);
          loadSession();
        }}
        onBackToLogin={() => {
          window.history.replaceState({}, "", "/");
          setInviteToken(null);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--apple-bg)]">
        <KleenLogo size={42} />
        <div className="text-xs font-medium text-[var(--apple-text-secondary)]">
          Loading Kleen Data Room...
        </div>
      </div>
    );
  }

  if (!session?.authenticated) {
    return <LoginScreen onLoggedIn={loadSession} />;
  }

  return (
    <DataRoomShell
      initialSession={session}
      onReloadSession={loadSession}
      onSignedOut={() => setSession({ authenticated: false })}
    />
  );
}
