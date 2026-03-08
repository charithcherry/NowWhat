import type { Metadata } from "next";
import "./globals.css";
import { AgentChat } from "@/components/AgentChat";
import { getCurrentUser } from "@/lib/auth";
export const metadata: Metadata = {
  title: "What Now? — Community",
  description: "Connect with others on similar wellness journeys",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser().catch(() => null);
  return (
    <html lang="en">
      <body>
        {children}
        <AgentChat userId={user?.userId ?? ""} />
      </body>
    </html>
  );
}
