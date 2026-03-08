import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { memoryFavorites } from "@/lib/memory-store";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId") || "demo-user";

  try {
    const db = await getDb();
    const favorites = await db
      .collection("favorites")
      .find({ userId })
      .sort({ timestamp: -1 })
      .toArray();

    return NextResponse.json(favorites, { headers: CORS_HEADERS });
  } catch (err: any) {
    console.warn("MongoDB unavailable for favorites GET, using memory:", err.message);
    const filtered = memoryFavorites.filter((f) => f.userId === userId);
    return NextResponse.json(filtered, { headers: CORS_HEADERS });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId = "demo-user", restaurantId, restaurantName, categories, location } =
      await request.json();

    if (!restaurantId) {
      return NextResponse.json(
        { error: "restaurantId is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    try {
      const db = await getDb();
      const collection = db.collection("favorites");
      const existing = await collection.findOne({ userId, restaurantId });

      if (existing) {
        await collection.deleteOne({ userId, restaurantId });
        return NextResponse.json({ action: "removed", restaurantId }, { headers: CORS_HEADERS });
      }

      await collection.insertOne({
        userId,
        restaurantId,
        restaurantName,
        categories: categories || [],
        location: location || "",
        timestamp: new Date(),
      });

      return NextResponse.json({ action: "added", restaurantId }, { headers: CORS_HEADERS });
    } catch (dbErr: any) {
      console.warn("MongoDB unavailable for favorites POST, using memory:", dbErr.message);
      const idx = memoryFavorites.findIndex(
        (f) => f.userId === userId && f.restaurantId === restaurantId
      );

      if (idx >= 0) {
        memoryFavorites.splice(idx, 1);
        return NextResponse.json({ action: "removed", restaurantId }, { headers: CORS_HEADERS });
      }

      memoryFavorites.push({
        userId,
        restaurantId,
        restaurantName,
        categories: categories || [],
        location: location || "",
        timestamp: new Date(),
      });

      return NextResponse.json({ action: "added", restaurantId }, { headers: CORS_HEADERS });
    }
  } catch (err: any) {
    console.error("Error toggling favorite:", err);
    return NextResponse.json(
      { error: "Failed to toggle favorite" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
