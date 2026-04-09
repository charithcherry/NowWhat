export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";

interface FitnessInsight {
  user_id: string;
  insight_type: string;
  title: string;
  message: string;
  confidence: "low" | "medium" | "high";
  generated_at: Date;
}

function buildSeedInsights(userId: string): FitnessInsight[] {
  const now = new Date();
  return [
    {
      user_id: userId,
      insight_type: "consistency",
      title: "Start building a streak",
      message: "Log a few sessions and the dashboard will start surfacing workout consistency trends.",
      confidence: "low",
      generated_at: now,
    },
    {
      user_id: userId,
      insight_type: "form",
      title: "Form insights unlock with session data",
      message: "Once you record form metrics, the dashboard can highlight where posture and movement quality are improving.",
      confidence: "low",
      generated_at: now,
    },
  ];
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDatabase();
    const insights = await db
      .collection<FitnessInsight>("fitness_wellness_insights")
      .find({ user_id: user.userId })
      .sort({ generated_at: -1 })
      .limit(10)
      .toArray();

    if (insights.length === 0) {
      return NextResponse.json({
        success: true,
        insights: buildSeedInsights(user.userId),
        seeded: true,
      });
    }

    return NextResponse.json({ success: true, insights, seeded: false });
  } catch (error) {
    console.error("Failed to fetch fitness insights, returning seed data:", error);
    return NextResponse.json({
      success: true,
      insights: buildSeedInsights(user.userId),
      seeded: true,
      warning: "MongoDB unavailable; returning seed insights",
    });
  }
}
