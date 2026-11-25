import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kleen Data Room | Apple-Style Google Drive Virtual Data Room",
  description:
    "Secure Virtual Data Room mirrored live from Google Drive in Read-Only Sync Mode, crafted with Apple HIG clarity.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen antialiased selection:bg-[#007AFF]/20 selection:text-[#007AFF]">
        {children}
      </body>
    </html>
  );
}
