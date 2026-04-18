export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { MOCK_RECIPE_LIBRARY } from "@/modules/nutrition/data/mockRecipeSeeds";
import { getRecipeLibrary } from "@/modules/nutrition/repositories";

function parseTags(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.userId;

  try {
    const entries = await getRecipeLibrary(userId, {
      search: request.nextUrl.searchParams.get("search") || undefined,
      tags: parseTags(request.nextUrl.searchParams.get("tags")),
      cuisine: request.nextUrl.searchParams.get("cuisine") || undefined,
      source_type: (request.nextUrl.searchParams.get("sourceType") as any) || undefined,
      protein_focus_level: request.nextUrl.searchParams.get("proteinFocus") || undefined,
      dietary_type: request.nextUrl.searchParams.get("dietary") || undefined,
      only_saved: request.nextUrl.searchParams.get("onlySaved") !== "false",
    });

    if (entries.length === 0) {
      const seeded = MOCK_RECIPE_LIBRARY.map((recipe) => ({
        recipe: {
          ...recipe,
          user_id: userId,
        },
        saved: null,
        modification_count: 0,
      }));

      return NextResponse.json({ success: true, entries: seeded, seeded: true });
    }

    return NextResponse.json({ success: true, entries, seeded: false });
  } catch (error) {
    console.error("Failed to fetch recipe library, falling back to seeded data:", error);

    const seeded = MOCK_RECIPE_LIBRARY.map((recipe) => ({
      recipe: {
        ...recipe,
        user_id: userId,
      },
      saved: null,
      modification_count: 0,
    }));

    return NextResponse.json({ success: true, entries: seeded, seeded: true, warning: "MongoDB unavailable; returning seed data" });
  }
}
