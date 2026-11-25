"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { SessionResponse } from "@/lib/types";
import { LoginScreen } from "@/components/LoginScreen";
import { DataRoomShell } from "@/components/DataRoomShell";
import { KleenLogo } from "@/components/KleenLogo";

export default function HomePage() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);

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
    loadSession();
  }, [loadSession]);

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
