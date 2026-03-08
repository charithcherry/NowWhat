import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    tasks: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          category: { type: SchemaType.STRING },
          duration: { type: SchemaType.NUMBER },
          effort: {
            type: SchemaType.STRING,
            enum: ["low", "medium", "high"],
          },
          is_deadline_strict: { type: SchemaType.BOOLEAN },
          must_do_today: { type: SchemaType.BOOLEAN },
          location_required: { type: SchemaType.BOOLEAN },
          splittable: { type: SchemaType.BOOLEAN },
        },
        required: ["title", "effort", "duration", "is_deadline_strict", "must_do_today"],
      },
    },
    primary_recommendation: { type: SchemaType.STRING },
    human_explanation: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
  },
  required: ["tasks", "primary_recommendation", "human_explanation"],
};

// ─── Scoring Engine ───────────────────────────────────────────────────────────

const ENERGY_MAP: Record<string, number> = { low: 1, medium: 2, high: 3 };
const STRESS_MAP: Record<string, number> = { low: 1, medium: 2, high: 3 };

function scoreTask(
  task: any,
  userEnergy: number,
  userStress: number,
  timeAvailable: number
): number {
  let score = 0;

  // Hard deadline = top priority
  if (task.is_deadline_strict) score += 60;

  // Must-do today bump
  if (task.must_do_today) score += 30;

  // Energy compatibility — penalise mismatch harder when user is stressed
  const taskEffort = ENERGY_MAP[task.effort] || 2;
  const energyFit = taskEffort <= userEnergy;
  score += energyFit ? 20 : -(10 + userStress * 8);

  // High stress → prefer low-effort tasks (quick wins calm the mind)
  if (userStress >= 3 && task.effort === "low") score += 15;

  // Can't physically finish it → deprioritise hard
  if (task.duration > timeAvailable) score -= 80;

  // Location-dependent tasks are higher friction — small penalty
  if (task.location_required) score -= 5;

  // Splittable tasks are friendlier when time is tight
  if (task.splittable && timeAvailable < 30) score += 10;

  return score;
}

function triageTasks(
  tasks: any[],
  energy: string,
  stress: string,
  timeAvailable: number,
  refinement: string | null
) {
  const userEnergy = ENERGY_MAP[energy] || 2;
  const userStress = STRESS_MAP[stress] || 2;

  // Refinement overrides
  let effectiveEnergy = userEnergy;
  if (refinement === "lighter") effectiveEnergy = Math.max(1, userEnergy - 1);
  if (refinement === "ambitious") effectiveEnergy = Math.min(3, userEnergy + 1);

  const scored = tasks
    .map((task) => ({
      ...task,
      score: scoreTask(task, effectiveEnergy, userStress, timeAvailable),
    }))
    .sort((a, b) => b.score - a.score);

  // Build time-feasible do_now sequence
  const doNow: any[] = [];
  let timeUsed = 0;
  for (const task of scored) {
    if (task.score > 30 && timeUsed + task.duration <= timeAvailable) {
      doNow.push(task);
      timeUsed += task.duration;
      if (doNow.length >= 3) break;
    }
  }

  const doNowIds = new Set(doNow.map((t) => t.title));

  const doNext = scored.filter(
    (t) => !doNowIds.has(t.title) && t.score > 0 && t.score <= 30
  );

  const defer = scored.filter(
    (t) => !doNowIds.has(t.title) && t.score <= 0
  );

  // Tiny win: lowest-effort task not already in do_now
  const tinyWin =
    scored.find((t) => !doNowIds.has(t.title) && t.effort === "low") ||
    scored.find((t) => !doNowIds.has(t.title)) ||
    scored[0];

  // Confidence: penalise if many tasks exceed time or energy is mismatched
  const feasibleCount = scored.filter((t) => t.score > 0).length;
  const confidence = Math.min(
    0.98,
    Math.max(0.4, feasibleCount / Math.max(scored.length, 1) - 0.05 * userStress)
  );

  return { do_now: doNow, do_next: doNext, defer, tiny_win: tinyWin, confidence };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function runPanicToPlan(
  input: string,
  energy: string,
  stress: string = "medium",
  time: number,
  deadline: string = "",
  refinement: string | null = null
) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  const refinementInstruction = refinement
    ? `The user requested a "${refinement}" plan adjustment — respond accordingly.`
    : "";

  const prompt = `
You are a calm, practical life-triage assistant.

Convert this stress dump into structured tasks and a short, friendly plan summary.

User input: "${input}"
Available time: ${time} minutes
Energy level: ${energy}
Stress level: ${stress}
${deadline ? `Hard deadline: ${deadline}` : ""}
${refinementInstruction}

Guidelines:
- Extract every distinct task or concern from the input
- Estimate realistic durations (in minutes)
- Identify which tasks are truly urgent vs optional
- Mark tasks that require a specific location as location_required: true
- Mark tasks that can be broken into steps as splittable: true
- primary_recommendation should be 1–2 friendly sentences summarising the best approach
- human_explanation should be an array of 2–4 short bullet-point reasons for this plan
`.trim();

  let result;
  try {
    result = await model.generateContent(prompt);
  } catch (err) {
    throw new Error(`Gemini API call failed: ${err}`);
  }

  const rawText = result.response.text();
  if (!rawText) throw new Error("Gemini returned an empty response");

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`Failed to parse Gemini response as JSON: ${rawText}`);
  }

  const triage = triageTasks(data.tasks, energy, stress, time, refinement);

  return {
    ...triage,
    primary_recommendation: data.primary_recommendation,
    reasoning: data.human_explanation,
  };
}