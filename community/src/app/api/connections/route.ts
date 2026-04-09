import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
  }
  const userId = user.userId;

  try {
    const db = await getDb();
    const connections = await db
      .collection("community_connections")
      .find({
        $or: [{ from_user_id: userId }, { to_user_id: userId }],
      })
      .toArray();

    const connectedIds = [
      ...new Set(
        connections.map((c) =>
          c.from_user_id === userId ? c.to_user_id : c.from_user_id
        )
      ),
    ];
    return NextResponse.json({ connectedIds }, { headers: CORS });
  } catch (err: any) {
    console.error("Error fetching connections:", err.message);
    return NextResponse.json({ connectedIds: [] }, { headers: CORS });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
    }

    const { toUserId, toDisplayName } = await request.json();
    const fromUserId = user.userId;

    if (!toUserId) {
      return NextResponse.json(
        { error: "toUserId is required" },
        { status: 400, headers: CORS }
      );
    }

    const db = await getDb();
    const collection = db.collection("community_connections");
    const existing = await collection.findOne({ from_user_id: fromUserId, to_user_id: toUserId });

    if (existing) {
      await collection.deleteOne({ from_user_id: fromUserId, to_user_id: toUserId });
      return NextResponse.json({ action: "disconnected", toUserId }, { headers: CORS });
    }

    await collection.insertOne({
      from_user_id: fromUserId,
      to_user_id: toUserId,
      to_display_name: toDisplayName || "User",
      timestamp: new Date(),
    });

    return NextResponse.json({ action: "connected", toUserId }, { headers: CORS });
  } catch (err: any) {
    console.error("Error toggling connection:", err);
    return NextResponse.json(
      { error: "Failed to toggle connection" },
      { status: 500, headers: CORS }
    );
  }
}
