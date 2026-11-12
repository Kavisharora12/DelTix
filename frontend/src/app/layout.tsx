import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell/app-shell";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

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
    <html
      lang="en"
      className={`dark ${manrope.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans antialiased bg-app text-text-primary">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
