export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSavedRecipe, getRecipeById, removeSavedRecipe } from "@/modules/nutrition/repositories";
import { trackNutritionActivitySafely } from "@/modules/nutrition/services/insightMemory";

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = (await request.json()) as Record<string, unknown>;
    const userId = user.userId;

    const [saved, recipe] = await Promise.all([
      createSavedRecipe(userId, context.params.id, typeof payload.user_notes === "string" ? payload.user_notes : undefined),
      getRecipeById(context.params.id, userId),
    ]);

    await trackNutritionActivitySafely({
      userId,
      actionType: "recipe_saved",
      data: {
        recipe_id: context.params.id,
        recipe_title: recipe?.title || "",
        source_type: recipe?.source_type || "",
      },
    });

    return NextResponse.json({ success: true, saved });
  } catch (error) {
    console.error("Failed to save recipe:", error);
    return NextResponse.json({ error: "Failed to save recipe" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.userId;

    await removeSavedRecipe(userId, context.params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to unsave recipe:", error);
    return NextResponse.json({ error: "Failed to unsave recipe" }, { status: 500 });
  }
}
