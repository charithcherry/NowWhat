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

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function buildInsights(userId: string, sessions: any[], biomechanics: any[]): FitnessInsight[] {
  const now = new Date();
  const formScores = sessions.map((s) => Number(s.form_score)).filter(Number.isFinite);
  const postureScores = sessions.map((s) => Number(s.posture_score)).filter(Number.isFinite);
  const reps = sessions.map((s) => Number(s.reps)).filter(Number.isFinite);
  const recentSessions = sessions.slice(-7);
  const recentReps = recentSessions.map((s) => Number(s.reps)).filter(Number.isFinite);
  const latestBiomechanics = biomechanics[biomechanics.length - 1];

  const insights: FitnessInsight[] = [];

  if (sessions.length > 0) {
    insights.push({
      user_id: userId,
      insight_type: "consistency",
      title: "Workout volume snapshot",
      message: `You have logged ${sessions.length} workout sessions and ${reps.reduce((sum, value) => sum + value, 0)} total reps.`,
      confidence: "high",
      generated_at: now,
    });
  }

  if (formScores.length > 0) {
    const avgForm = round(average(formScores));
    const avgPosture = round(average(postureScores));
    insights.push({
      user_id: userId,
      insight_type: "form",
      title: "Form quality trend",
      message: `Your average form score is ${avgForm}. Posture is averaging ${avgPosture}, so that is the clearest lever to improve next.`,
      confidence: "medium",
      generated_at: now,
    });
  }

  if (recentReps.length > 1) {
    const firstHalf = average(recentReps.slice(0, Math.ceil(recentReps.length / 2)));
    const secondHalf = average(recentReps.slice(Math.floor(recentReps.length / 2)));
    const direction = secondHalf >= firstHalf ? "up" : "down";
    insights.push({
      user_id: userId,
      insight_type: "progression",
      title: "Recent rep trend",
      message: `Your recent rep volume is trending ${direction}, with the latest sessions averaging ${round(secondHalf)} reps.`,
      confidence: "medium",
      generated_at: now,
    });
  }

  if (latestBiomechanics) {
    const leftElbow = Number(latestBiomechanics.avg_left_elbow_angle);
    const rightElbow = Number(latestBiomechanics.avg_right_elbow_angle);
    if (Number.isFinite(leftElbow) && Number.isFinite(rightElbow)) {
      const gap = round(Math.abs(leftElbow - rightElbow));
      insights.push({
        user_id: userId,
        insight_type: "symmetry",
        title: "Left-right symmetry check",
        message: `Your latest elbow-angle gap is ${gap} degrees. Smaller gaps usually indicate more balanced movement between sides.`,
        confidence: gap <= 8 ? "high" : "medium",
        generated_at: now,
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      user_id: userId,
      insight_type: "starter",
      title: "Generate insights after more tracking",
      message: "Log a few more sessions with reps or biomechanics data and the dashboard will produce stronger performance insights.",
      confidence: "low",
      generated_at: now,
    });
  }

  return insights;
}

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDatabase();
    const [sessions, biomechanics] = await Promise.all([
      db
        .collection("sessions")
        .find({ user_id: user.userId })
        .sort({ date: 1, created_at: 1 })
        .toArray(),
      db
        .collection("fitness_exercise_biomechanics")
        .find({ user_id: user.userId })
        .sort({ created_at: 1 })
        .toArray(),
    ]);

    const insights = buildInsights(user.userId, sessions, biomechanics);
    const collection = db.collection<FitnessInsight>("fitness_wellness_insights");

    await collection.deleteMany({ user_id: user.userId });
    if (insights.length > 0) {
      await collection.insertMany(insights);
    }

    return NextResponse.json({ success: true, insights });
  } catch (error) {
    console.error("Failed to generate fitness insights:", error);
    return NextResponse.json({ error: "Failed to generate fitness insights" }, { status: 500 });
  }
}
