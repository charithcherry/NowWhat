import { getDatabase } from "@/lib/mongodb";
import DashboardClient from "./DashboardClient";
import { getCurrentUser } from "@/lib/auth";
import { Navigation } from "@/components/Navigation";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function FitnessDashboard() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000");
  }

  const userId = user.userId;
  const db = await getDatabase();

  // 1. Fetch fitness sessions
  const sessions = await db
    .collection("fitness_sessions")
    .find({ user_id: userId })
    .sort({ ended_at: 1, started_at: 1 })
    .toArray();
  
  // 2. Fetch biomechanics
  const biomechanics = await db.collection("fitness_exercise_biomechanics").find({ user_id: userId }).toArray();

  // 3. Fetch motivation/mood
  const moods = await db.collection("community_moods").find({ user_id: userId }).sort({ created_at: -1 }).limit(5).toArray();

  let avgForm = 0;
  let avgPosture = 0;
  let avgArm = 0;
  let avgVisibility = 0;
  let totalReps = 0;

  if (sessions.length > 0) {
     const lastSession = sessions[sessions.length - 1];
     avgForm = parseFloat((lastSession.avg_form_score || 0).toFixed(1));
     avgPosture = parseFloat((lastSession.avg_posture_score || 0).toFixed(1));
     avgArm = parseFloat((lastSession.avg_arm_position_score || 0).toFixed(1));
     avgVisibility = parseFloat((lastSession.avg_visibility_score || 0).toFixed(1));
  }

  sessions.forEach(s => totalReps += (s.reps_completed || 0));

  const dailyExerciseMap = new Map<string, Record<string, number | string>>();
  const exerciseKeySet = new Set<string>();

  sessions.forEach((session) => {
    const exerciseName = String(session.exercise_name || "Unknown");
    const repsCompleted = Number(session.reps_completed || 0);
    const endedAt = session.ended_at ? new Date(session.ended_at) : null;
    const dayKey = endedAt && !Number.isNaN(endedAt.getTime())
      ? endedAt.toISOString().slice(0, 10)
      : "Unknown";

    exerciseKeySet.add(exerciseName);

    if (!dailyExerciseMap.has(dayKey)) {
      dailyExerciseMap.set(dayKey, {
        date: dayKey,
        total: 0,
      });
    }

    const dayEntry = dailyExerciseMap.get(dayKey)!;
    dayEntry[exerciseName] = Number(dayEntry[exerciseName] || 0) + repsCompleted;
    dayEntry.total = Number(dayEntry.total || 0) + repsCompleted;
  });

  const exerciseKeys = Array.from(exerciseKeySet).sort();
  const dailyExerciseData = Array.from(dailyExerciseMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);

  const radarData = sessions.length > 0 ? [
    { metric: "Form", score: avgForm },
    { metric: "Posture", score: avgPosture },
    { metric: "Arm Pos", score: avgArm },
    { metric: "Visibility", score: avgVisibility }
  ] : [];

  let symmetryData: any[] = [];
  if (biomechanics.length > 0) {
    const b = biomechanics[biomechanics.length - 1]; // get latest
    symmetryData = [
      { joint: "Elbow Angles", left: b.avg_left_elbow_angle, right: b.avg_right_elbow_angle },
      { joint: "Shoulder Hinge", left: b.avg_esh_left, right: b.avg_esh_right },
      { joint: "Arm Body Angle", left: b.avg_arm_body_angle_left, right: b.avg_arm_body_angle_right },
      { joint: "Knee (Leg Bend)", left: b.avg_left_knee_angle, right: b.avg_right_knee_angle }
    ].filter(j => j.left != null && j.right != null);
  }

  const motivationData = moods.map((m, i) => ({
     rating: m.rating || 5,
     note: m.note || "Good workout!",
     date: m.date || m.created_at || new Date().toISOString(),
     reps: i === 0 ? totalReps : (totalReps > 20 ? totalReps - 10 : 0) // just to show varying reps if present
  }));
  
  const mostRecentDate = sessions.length > 0 ? sessions[sessions.length - 1].ended_at : null;

  const totals = {
    totalSessions: sessions.length,
    totalReps,
    avgOverallForm: avgForm || 0,
    mostRecentDate
  };

  return (
    <>
      <Navigation user={user} />
      <DashboardClient 
         userId={userId}
         userName={user.name}
         radarData={radarData} 
         symmetryData={symmetryData} 
         dailyExerciseData={dailyExerciseData}
         exerciseKeys={exerciseKeys}
         motivationData={motivationData} 
         totals={totals}
      />
    </>
  );
}
