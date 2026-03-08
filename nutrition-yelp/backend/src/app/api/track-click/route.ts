import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { memoryClicks } from "@/lib/memory-store";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const { userId = "demo-user", restaurantId, restaurantName, action = "click" } =
      await request.json();

    if (!restaurantId) {
      return NextResponse.json(
        { error: "restaurantId is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    try {
      const db = await getDb();
      await db.collection("clicks").insertOne({
        userId,
        restaurantId,
        restaurantName,
        action,
        timestamp: new Date(),
      });
    } catch (dbErr: any) {
      console.warn("MongoDB unavailable for click tracking, using memory:", dbErr.message);
      memoryClicks.push({ userId, restaurantId, restaurantName, action, timestamp: new Date() });
    }

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (err: any) {
    console.error("Error tracking click:", err);
    return NextResponse.json(
      { error: "Failed to track click" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
