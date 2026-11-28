"use client";

import React from "react";

export function KleenLogo({ size = 32 }: { size?: number; accent?: string }) {
  return (
    <div
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-[#0088C7] shadow-sm select-none"
      style={{
        width: size,
        height: size,
      }}
    >
      <img
        src="/kleen-logo.png"
        alt="Kleen Logo"
        className="h-full w-full object-cover"
      />
    </div>
  );
}
