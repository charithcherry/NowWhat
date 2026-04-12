import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AgentChat } from "@/components/AgentChat";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-heading",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "What Now? — Community",
  description: "Connect with others on similar wellness journeys",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }
  return (
    <html lang="en">
      <body
        className={`${manrope.variable} ${spaceGrotesk.variable} font-sans antialiased bg-doom-bg text-doom-text min-h-screen`}
      >
        {children}
        <AgentChat userId={user?.userId ?? ""} />
      </body>
    </html>
  );
}
