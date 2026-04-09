export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMockWellnessSignals } from "@/modules/skin-hair/data/mockWellnessSignals";
import { formatWellnessInsightCard } from "@/modules/skin-hair/formatters";
import {
  listHairLogs,
  listSkinLogs,
  replaceWellnessInsights,
} from "@/modules/skin-hair/repositories";
import { generateWellnessInsights } from "@/modules/skin-hair/wellnessInsights";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await request.json();
    const userId = user.userId;

    const [skinLogs, hairLogs] = await Promise.all([listSkinLogs(userId, 28), listHairLogs(userId, 28)]);

    const wellnessSignals = getMockWellnessSignals(userId, 21);

    const generated = generateWellnessInsights({
      skinLogs,
      hairLogs,
      wellnessSignals,
    });

    const saved = await replaceWellnessInsights(userId, generated);
    const formatted = saved.map((item) => formatWellnessInsightCard(item));

    return NextResponse.json({
      success: true,
      insights: saved,
      formatted_output: formatted,
      signals_source: "mock-wellness-signals",
    });
  } catch (error) {
    console.error("Failed to generate wellness insights:", error);
    return NextResponse.json({ error: "Failed to generate wellness insights" }, { status: 500 });
  }
}
