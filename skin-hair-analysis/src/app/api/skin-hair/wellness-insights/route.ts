export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listWellnessInsights } from "@/modules/skin-hair/repositories";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.userId;

    const insights = await listWellnessInsights(userId);

    return NextResponse.json({ success: true, insights });
  } catch (error) {
    console.error("Failed to fetch wellness insights:", error);
    return NextResponse.json({ error: "Failed to fetch wellness insights" }, { status: 500 });
  }
}
