export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getNutritionProfile, upsertNutritionProfile } from "@/modules/nutrition/repositories";
import { trackNutritionActivitySafely } from "@/modules/nutrition/services/insightMemory";
import { validateProfilePayload } from "@/modules/nutrition/validators";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.userId;

    const profile = await getNutritionProfile(userId);
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("Failed to fetch nutrition profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = {
      ...((await request.json()) as Record<string, unknown>),
      user_id: user.userId,
    };
    const validated = validateProfilePayload(payload);

    const profile = await upsertNutritionProfile(validated.user_id, {
      primary_goal: validated.primary_goal,
      protein_goal_g: validated.protein_goal_g,
      calorie_goal: validated.calorie_goal,
      dietary_preferences: validated.dietary_preferences,
      allergies: validated.allergies,
      restrictions: validated.restrictions,
      preferred_cuisines: validated.preferred_cuisines,
      disliked_ingredients: validated.disliked_ingredients,
    });

    await trackNutritionActivitySafely({
      userId: validated.user_id,
      actionType: "profile_updated",
      data: {
        primary_goal: validated.primary_goal,
        protein_goal_g: validated.protein_goal_g,
        calorie_goal: validated.calorie_goal,
        dietary_preferences: validated.dietary_preferences.slice(0, 8),
        preferred_cuisines: validated.preferred_cuisines.slice(0, 8),
      },
    });

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("Failed to upsert nutrition profile:", error);
    return NextResponse.json({ error: (error as Error).message || "Failed to save profile" }, { status: 400 });
  }
}
