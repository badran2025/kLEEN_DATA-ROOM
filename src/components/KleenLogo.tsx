"use client";

import React from "react";

export function KleenLogo({ size = 32, accent = "#007AFF" }: { size?: number; accent?: string }) {
  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-[10px] shadow-sm select-none"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, ${accent}, #0A58CA)`,
      }}
    >
      <svg
        width={Math.round(size * 0.58)}
        height={Math.round(size * 0.58)}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M5 4.5V19.5M5 12.2L13.5 4.5M8.8 9.2L16.5 19.5"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="18.5" cy="6.5" r="2.2" fill="white" fillOpacity="0.92" />
      </svg>
    </div>
  );
}
