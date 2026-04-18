export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSkinHairProfile, upsertSkinHairProfile } from "@/modules/skin-hair/repositories";
import { validateProfilePayload } from "@/modules/skin-hair/validators";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.userId;

    const profile = await getSkinHairProfile(userId);

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("Failed to fetch skin/hair profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as Record<string, unknown>;
    const validated = validateProfilePayload(payload);
    const userId = user.userId;
    const profile = await upsertSkinHairProfile(userId, validated);

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("Failed to upsert profile:", error);
    return NextResponse.json({ error: (error as Error).message || "Failed to save profile" }, { status: 400 });
  }
}
