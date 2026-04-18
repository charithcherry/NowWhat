export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listNutritionInsightMemory } from "@/modules/nutrition/repositories";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.userId;

    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") || 20), 1), 100);
    const insights = await listNutritionInsightMemory(userId, limit);

    return NextResponse.json({
      success: true,
      insights,
    });
  } catch (error) {
    console.error("Failed to fetch nutrition insight memory:", error);
    return NextResponse.json({ error: "Failed to fetch nutrition insight memory" }, { status: 500 });
  }
}
