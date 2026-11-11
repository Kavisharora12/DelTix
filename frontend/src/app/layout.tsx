import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = {
  title: "DelTix — Payment Operations & Agentic Control Console",
  description:
    "Deterministic financial agent orchestration, verification, and human-in-the-loop approvals console.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-app text-text-primary">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
