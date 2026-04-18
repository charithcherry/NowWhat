export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getLatestInsight,
  getLatestRecipe,
  getNutritionProfile,
  listSavedRecipes,
} from "@/modules/nutrition/repositories";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.userId;

  try {
    const [profile, savedRecipes, latestRecipe, latestInsight] = await Promise.all([
      getNutritionProfile(userId),
      listSavedRecipes(userId),
      getLatestRecipe(userId),
      getLatestInsight(userId),
    ]);

    return NextResponse.json({
      success: true,
      summary: {
        active_goal: profile?.primary_goal || "general_wellness",
        saved_recipe_count: savedRecipes.length,
        latest_recipe_title: latestRecipe?.title || "No recipes yet",
        latest_insight_message: latestInsight?.message || "No generated insight yet",
      },
    });
  } catch (error) {
    console.error("Failed to fetch summary, using fallback:", error);
    return NextResponse.json({
      success: true,
      summary: {
        active_goal: "general_wellness",
        saved_recipe_count: 0,
        latest_recipe_title: "No recipes yet",
        latest_insight_message: "Generate insights to see trends",
      },
      warning: "MongoDB unavailable; returning fallback summary",
    });
  }
}
