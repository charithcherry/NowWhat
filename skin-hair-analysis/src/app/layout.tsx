import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AgentChat } from "@/components/AgentChat";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "NowWhat - Skin & Hair Module",
  description: "Standalone Skin & Hair Health module for NowWhat hackathon integration",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser().catch(() => null);
  return (
    <html lang="en">
      <body className="bg-doom-bg text-doom-text min-h-screen">
        <Providers>{children}</Providers>
        <AgentChat userId={user?.userId ?? ""} />
      </body>
    </html>
  );
}
