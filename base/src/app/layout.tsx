import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AgentChat } from "@/components/AgentChat";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "What Now? — Your Complete Wellness Companion",
  description: "Track fitness, nutrition, skin health, and more - all connected in one unified platform",
  manifest: "/manifest.json",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
