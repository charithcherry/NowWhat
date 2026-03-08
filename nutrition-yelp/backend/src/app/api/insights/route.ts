import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getDb } from "@/lib/mongodb";
import { memoryFavorites, memoryClicks } from "@/lib/memory-store";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username") || "demo-user";

  try {
    const db = await getDb();
    const insights = await db
      .collection("insights")
      .find({ username })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    return NextResponse.json(insights, { headers: CORS_HEADERS });
  } catch (err: any) {
    console.warn("MongoDB unavailable for insights GET:", err.message);
    return NextResponse.json([], { headers: CORS_HEADERS });
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    const { username = "demo-user" } = await request.json();

    let favorites: any[] = [];
    let recentClicks: any[] = [];
    let useDb = false;

    try {
      const db = await getDb();
      [favorites, recentClicks] = await Promise.all([
        db.collection("favorites").find({ username }).sort({ timestamp: -1 }).toArray(),
        db.collection("clicks").find({ username }).sort({ timestamp: -1 }).limit(50).toArray(),
      ]);
      useDb = true;
    } catch (dbErr: any) {
      console.warn("MongoDB unavailable for insights generation, using memory:", dbErr.message);
      favorites = memoryFavorites.filter((f) => f.username === username);
      recentClicks = memoryClicks
        .filter((c) => c.username === username)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 50);
    }

    if (favorites.length === 0 && recentClicks.length === 0) {
      return NextResponse.json(
        { insight: "No activity yet. Start exploring and liking restaurants to get personalized insights!" },
        { headers: CORS_HEADERS }
      );
    }

    const clickCounts: Record<string, { name: string; count: number }> = {};
    for (const click of recentClicks) {
      const id = click.restaurantId;
      if (!clickCounts[id]) {
        clickCounts[id] = { name: click.restaurantName, count: 0 };
      }
      clickCounts[id].count++;
    }

    const topClicked = Object.values(clickCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const favNames = favorites.map((f) => f.restaurantName).slice(0, 10);
    const favCategories = favorites
      .flatMap((f) => (f.categories || []).map((c: any) => c.title))
      .filter(Boolean);

    const categoryCounts: Record<string, number> = {};
    for (const cat of favCategories) {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
    const topCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cat]) => cat);

    const prompt = `Based on this user's restaurant activity, write 3-4 insightful sentences about their dining preferences and habits. Be specific and personal.

Liked restaurants: ${favNames.join(", ") || "None"}
Top categories: ${topCategories.join(", ") || "None"}
Most clicked (with click count): ${topClicked.map((r) => `${r.name} (${r.count}x)`).join(", ") || "None"}

Write ONLY the insight text, no JSON, no markdown, just plain sentences.`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelNames = ["gemini-2.5-flash", "gemini-2.0-flash-lite"];
    let insightText = "";

    for (const modelName of modelNames) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
        });
        const result = await model.generateContent(prompt);
        insightText = result.response.text().trim();
        if (insightText) break;
      } catch (err: any) {
        console.warn(`Model ${modelName} failed for insights:`, err.message);
      }
    }

    if (!insightText) {
      insightText = `You've liked ${favorites.length} restaurant${favorites.length !== 1 ? "s" : ""}. ${
        topCategories.length > 0
          ? `Your favorite cuisines include ${topCategories.join(", ")}.`
          : ""
      } ${
        topClicked.length > 0
          ? `You've shown the most interest in ${topClicked[0].name}.`
          : ""
      }`;
    }

    if (useDb) {
      try {
        const db = await getDb();
        await db.collection("insights").insertOne({
          username,
          insight: insightText,
          timestamp: new Date(),
          favoriteCount: favorites.length,
          topCategories,
          topClicked: topClicked.map((r) => r.name),
        });
      } catch {
        console.warn("Could not persist insight to MongoDB");
      }
    }

    return NextResponse.json(
      { insight: insightText, timestamp: new Date() },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error("Error generating insights:", err);
    return NextResponse.json(
      { error: "Failed to generate insights" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
