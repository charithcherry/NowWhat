import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";

export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDatabase();
  const messages = await db
    .collection("agent_chats")
    .find({ user_id: user.userId })
    .sort({ timestamp: -1 })
    .limit(40)
    .toArray();

  return NextResponse.json({
    messages: messages.reverse().map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });
}
