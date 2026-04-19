import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { calculateAgeFromCalendarDate, formatCalendarDate } from "@/lib/calendarDate";
import { getDatabase } from "@/lib/mongodb";

// ── MongoDB ────────────────────────────────────────────────────────────────
async function getDb() {
  return { db: await getDatabase() };
}

// Collections Gemini is allowed to query + the userId field name each uses
const ALLOWED_COLLECTIONS: Record<string, string> = {
  fitness_sessions:          "user_id",
  fitness_exercise_biomechanics: "user_id",
  nutrition_profiles:        "user_id",
  generated_recipes:         "user_id",
  saved_recipes:             "user_id",
  pantry_items:              "user_id",
  skin_hair_profiles:        "user_id",
  skin_logs:                 "user_id",
  hair_logs:                 "user_id",
  loved_products:            "user_id",
  product_recommendations:   "user_id",
  favorites:                 "user_id",
  clicks:                    "user_id",
  nutrition_insight_memory:  "user_id",
  yelp_insight:              "user_id",
  skin_hair_pattern:         "user_id",
  user_profiles:             "user_id",
  community_posts:           "user_id",
  community_comments:        "user_id",
  community_moods:           "user_id",
  community_events:          "attendees",
  community_connections:     "from_user_id",
};

const DEFAULT_SORTS: Record<string, Record<string, 1 | -1>> = {
  fitness_sessions: { ended_at: -1 },
  fitness_exercise_biomechanics: { _id: -1 },
  nutrition_profiles: { _id: -1 },
  generated_recipes: { created_at: -1 },
  saved_recipes: { saved_at: -1 },
  pantry_items: { created_at: -1 },
  skin_hair_profiles: { _id: -1 },
  skin_logs: { created_at: -1 },
  hair_logs: { created_at: -1 },
  loved_products: { created_at: -1 },
  product_recommendations: { created_at: -1 },
  favorites: { timestamp: -1 },
  clicks: { timestamp: -1 },
  nutrition_insight_memory: { created_at: -1 },
  yelp_insight: { timestamp: -1 },
  skin_hair_pattern: { _id: -1 },
  user_profiles: { _id: -1 },
  community_posts: { created_at: -1 },
  community_comments: { created_at: -1 },
  community_moods: { created_at: -1 },
  community_events: { date: 1 },
  community_connections: { timestamp: -1 },
};

function formatAbsoluteDate(value: unknown): string | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function serializeValue(value: any): any {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (value && typeof value === "object") {
    if (typeof value.toHexString === "function") {
      return value.toHexString();
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, serializeValue(nested)])
    );
  }

  return value;
}

function normalizeCollectionRecord(collection: string, record: Record<string, any>) {
  const base = serializeValue(record);

  if (collection === "fitness_sessions") {
    return {
      _id: base._id,
      userId: base.user_id,
      exerciseName: base.exercise_name ?? base.exerciseName,
      startedAt: base.started_at ?? base.startedAt,
      endedAt: base.ended_at ?? base.endedAt,
      durationSeconds: base.duration_seconds ?? base.durationSeconds,
      repsCompleted: base.reps_completed ?? base.repsCompleted,
      sessionStatus: base.session_status ?? base.sessionStatus,
      avgFormScore: base.avg_form_score ?? base.avgFormScore,
      avgPostureScore: base.avg_posture_score ?? base.avgPostureScore,
      avgArmPositionScore: base.avg_arm_position_score ?? base.avgArmPositionScore,
      avgVisibilityScore: base.avg_visibility_score ?? base.avgVisibilityScore,
      validPositionPct: base.valid_position_pct ?? base.validPositionPct,
      bestRepScore: base.best_rep_score ?? base.bestRepScore,
      worstRepScore: base.worst_rep_score ?? base.worstRepScore,
    };
  }

  if (collection === "user_profiles") {
    const dateOfBirth = base.date_of_birth ?? base.dateOfBirth;
    return {
      _id: base._id,
      userId: base.user_id ?? base.userId,
      dateOfBirth,
      age: calculateAgeFromCalendarDate(dateOfBirth),
      height: base.height,
      weight: base.weight,
      lifestyle: base.lifestyle,
    };
  }

  if (collection === "favorites") {
    return {
      _id: base._id,
      userId: base.user_id ?? base.userId,
      restaurantId: base.restaurant_id ?? base.restaurantId,
      restaurantName: base.restaurant_name ?? base.restaurantName,
      categories: base.categories,
      location: base.location,
      timestamp: base.timestamp,
    };
  }

  if (collection === "saved_recipes") {
    return {
      _id: base._id,
      userId: base.user_id ?? base.userId,
      recipeId: base.recipe_id ?? base.recipeId,
      savedAt: base.saved_at ?? base.savedAt,
      userNotes: base.user_notes ?? base.userNotes,
    };
  }

  if (collection === "generated_recipes") {
    return {
      _id: base._id,
      userId: base.user_id ?? base.userId,
      title: base.title,
      sourceType: base.source_type ?? base.sourceType,
      cuisine: base.cuisine,
      goalContext: base.goal_context ?? base.goalContext,
      ingredients: base.ingredients,
      instructions: base.instructions,
      tags: base.tags,
      createdAt: base.created_at ?? base.createdAt,
      updatedAt: base.updated_at ?? base.updatedAt,
    };
  }

  return base;
}

function looksLikePersonalDataQuestion(message: string) {
  return /\b(age|birthday|birth date|date of birth|dob|height|weight|workout|exercise|session|rep|reps|recipe|ingredients|instructions|restaurant|favorite|favourite|user id|userid|profile id)\b/i.test(message);
}

function isAgeQuestion(message: string) {
  return /\b(age|how old am i|what(?:'s| is) my age)\b/i.test(message);
}

function isDobQuestion(message: string) {
  return /\b(date of birth|birth date|birthday|dob|when was i born)\b/i.test(message);
}

function isHeightQuestion(message: string) {
  return /\b(height|how tall am i)\b/i.test(message);
}

function isWeightQuestion(message: string) {
  return /\b(weight|how much do i weigh)\b/i.test(message);
}

function isLatestWorkoutQuestion(message: string) {
  return /\b(last|latest|most recent)\b.*\b(workout|exercise|session|rep|reps)\b|\bwhat was my last workout\b|\bwhat was my last rep count\b/i.test(message);
}

function isWorkoutOnDateQuestion(message: string) {
  return /\b(workout|exercise|session|rep|reps)\b/i.test(message) && Boolean(extractDateFromMessage(message));
}

function isFavoriteRestaurantsQuestion(message: string) {
  return /\b(favou?rite|favorite)\b.*\b(restaurants?|places?)\b|\bwhat are my favou?rite restaurants?\b|\bwhich restaurants do i like\b/i.test(message);
}

function isLatestSavedRecipeQuestion(message: string) {
  return /\b(last|latest|most recent)\b.*\b(saved )?recipe\b|\bwhat(?:'s| is) my latest saved recipe\b/i.test(message);
}

function isRecipeDetailsQuestion(message: string) {
  return /\b(find|show|open|get)\b.*\brecipe\b|\bwhat are the ingredients\b|\bwhat are the instructions\b|\bshow me the recipe\b/i.test(message);
}

function isUserIdQuestion(message: string) {
  return /\bwhat(?:'s| is) my user id\b|\bwhat(?:'s| is) my id\b|\bmy user id\b|\buserid\b/i.test(message);
}

function extractDateFromMessage(message: string): Date | null {
  const monthMatch = message.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:,\s*(\d{4}))?\b/i
  );

  if (monthMatch) {
    const [, monthText, dayText, yearText] = monthMatch;
    const now = new Date();
    const year = yearText ? Number(yearText) : now.getFullYear();
    const parsed = new Date(`${monthText} ${dayText}, ${year}`);
    if (!Number.isNaN(parsed.getTime())) {
      if (!yearText && parsed.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
        parsed.setFullYear(parsed.getFullYear() - 1);
      }
      return parsed;
    }
  }

  const slashMatch = message.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slashMatch) {
    const [, monthText, dayText, yearText] = slashMatch;
    const now = new Date();
    const parsedYear = yearText
      ? Number(yearText.length === 2 ? `20${yearText}` : yearText)
      : now.getFullYear();
    const parsed = new Date(parsedYear, Number(monthText) - 1, Number(dayText));
    if (!Number.isNaN(parsed.getTime())) {
      if (!yearText && parsed.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
        parsed.setFullYear(parsed.getFullYear() - 1);
      }
      return parsed;
    }
  }

  return null;
}

function getDayBounds(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractExerciseName(message: string) {
  const knownExercises = [
    "bicep curl",
    "lateral raise",
    "row",
    "shoulder press",
    "bench press",
    "tricep extension",
    "deadlift",
    "squat",
    "lunge",
    "push-up",
    "push up",
    "pull-up",
    "pull up",
    "plank",
  ];

  const normalizedMessage = message.toLowerCase();
  const match = knownExercises.find((exercise) => normalizedMessage.includes(exercise));
  if (!match) {
    return null;
  }

  return match.replace(/\s+/g, " ").replace("push up", "push-up").replace("pull up", "pull-up");
}

async function getLatestSavedRecipeDetails(db: Awaited<ReturnType<typeof getDatabase>>, userId: string) {
  const savedRecipe = await db
    .collection("saved_recipes")
    .find({ user_id: userId })
    .sort({ saved_at: -1, _id: -1 })
    .limit(1)
    .next();

  if (!savedRecipe) {
    return { savedRecipe: null, recipe: null };
  }

  const recipeId = savedRecipe.recipe_id;
  if (!recipeId) {
    return { savedRecipe, recipe: null };
  }

  const recipe = await db.collection("generated_recipes").findOne({
    _id: ObjectId.isValid(recipeId) ? new ObjectId(recipeId) : recipeId,
    user_id: userId,
  });

  return { savedRecipe, recipe };
}

async function answerCommonPersonalDataQuestion(
  message: string,
  userId: string,
  messages: Array<{ role: string; content: string }> = []
): Promise<string | null> {
  const { db } = await getDb();

  if (isAgeQuestion(message) || isDobQuestion(message) || isHeightQuestion(message) || isWeightQuestion(message)) {
    const profile = await db.collection("user_profiles").findOne({ user_id: userId });
    const dateOfBirth = profile?.date_of_birth ?? profile?.dateOfBirth;
    const age = calculateAgeFromCalendarDate(dateOfBirth);

    if (isAgeQuestion(message)) {
      if (!dateOfBirth || age === null) {
        return "I don't have a confirmed date of birth in your profile yet, so I can't calculate your age.";
      }

      const dobText = formatCalendarDate(String(dateOfBirth)) || String(dateOfBirth);
      return `Your profile lists your date of birth as ${dobText}, which makes you ${age} years old as of ${formatAbsoluteDate(new Date().toISOString())}.`;
    }

    if (isDobQuestion(message)) {
      if (!dateOfBirth) {
        return "I don't have a date of birth saved in your profile yet.";
      }

      const dobText = formatCalendarDate(String(dateOfBirth)) || String(dateOfBirth);
      return age === null
        ? `Your saved date of birth is ${dobText}.`
        : `Your saved date of birth is ${dobText}. That makes you ${age} years old as of ${formatAbsoluteDate(new Date().toISOString())}.`;
    }

    if (isHeightQuestion(message)) {
      return profile?.height
        ? `Your saved height is ${profile.height} cm.`
        : "I don't have a height saved in your profile yet.";
    }

    if (isWeightQuestion(message)) {
      return profile?.weight
        ? `Your saved weight is ${profile.weight} kg.`
        : "I don't have a weight saved in your profile yet.";
    }
  }

  if (isLatestWorkoutQuestion(message)) {
    const latestSession = await db
      .collection("fitness_sessions")
      .find({ user_id: userId })
      .sort({ ended_at: -1 })
      .limit(1)
      .next();

    if (!latestSession) {
      return "I don't see any recorded workout sessions for you yet.";
    }

    const exerciseName = latestSession.exercise_name || latestSession.exerciseName || "workout";
    const repsCompleted = latestSession.reps_completed ?? latestSession.repsCompleted;
    const endedAt = latestSession.ended_at ?? latestSession.endedAt ?? latestSession.started_at ?? latestSession.startedAt;
    const endedDateText = formatAbsoluteDate(endedAt) || "an unknown date";

    if (typeof repsCompleted === "number") {
      return `Your most recent recorded workout was ${exerciseName} on ${endedDateText}, and it logged ${repsCompleted} reps.`;
    }

    return `Your most recent recorded workout was ${exerciseName} on ${endedDateText}. I don't see a confirmed rep count on that record.`;
  }

  if (isWorkoutOnDateQuestion(message)) {
    const date = extractDateFromMessage(message);
    if (date) {
      const exerciseName = extractExerciseName(message);
      const { start, end } = getDayBounds(date);
      const filter: Record<string, any> = {
        user_id: userId,
        $or: [
          { ended_at: { $gte: start, $lt: end } },
          { started_at: { $gte: start, $lt: end } },
        ],
      };

      if (exerciseName) {
        filter.exercise_name = { $regex: `^${escapeRegex(exerciseName)}$`, $options: "i" };
      }

      const matchingSessions = await db
        .collection("fitness_sessions")
        .find(filter)
        .sort({ ended_at: -1, started_at: -1, _id: -1 })
        .toArray();

      const confirmedReps = matchingSessions
        .map((session) => Number(session.reps_completed ?? session.repsCompleted))
        .filter((value) => Number.isFinite(value));
      const dateText = formatAbsoluteDate(date.toISOString()) || "that date";

      if (matchingSessions.length === 0) {
        return exerciseName
          ? `I don't see any recorded ${exerciseName} sessions on ${dateText}.`
          : `I don't see any recorded workout sessions on ${dateText}.`;
      }

      if (confirmedReps.length === 0) {
        return exerciseName
          ? `I found ${matchingSessions.length} ${exerciseName} session${matchingSessions.length === 1 ? "" : "s"} on ${dateText}, but none of those records has a confirmed rep count.`
          : `I found ${matchingSessions.length} workout session${matchingSessions.length === 1 ? "" : "s"} on ${dateText}, but none of those records has a confirmed rep count.`;
      }

      const totalReps = confirmedReps.reduce((sum, value) => sum + value, 0);
      return exerciseName
        ? `On ${dateText}, you completed ${totalReps} confirmed ${exerciseName} reps across ${matchingSessions.length} session${matchingSessions.length === 1 ? "" : "s"}.`
        : `On ${dateText}, you completed ${totalReps} confirmed reps across ${matchingSessions.length} workout session${matchingSessions.length === 1 ? "" : "s"}.`;
    }
  }

  if (isFavoriteRestaurantsQuestion(message)) {
    const favorites = await db
      .collection("favorites")
      .find({ user_id: userId })
      .sort({ timestamp: -1, _id: -1 })
      .toArray();

    if (favorites.length === 0) {
      return "I don't see any favorite restaurants saved for you yet.";
    }

    const names = favorites
      .map((favorite) => favorite.restaurant_name ?? favorite.restaurantName)
      .filter(Boolean);

    if (names.length === 0) {
      return "I found favorite restaurant records for you, but they do not include confirmed restaurant names.";
    }

    return `Your saved favorite restaurants are ${names.join(", ")}.`;
  }

  if (isLatestSavedRecipeQuestion(message) || isRecipeDetailsQuestion(message)) {
    const recipeDetailsRequested =
      isRecipeDetailsQuestion(message) ||
      messages.slice(-4).some((entry) => /\blatest saved recipe\b|\bsaved recipe\b/i.test(entry.content));
    const { savedRecipe, recipe } = await getLatestSavedRecipeDetails(db, userId);

    if (!savedRecipe) {
      return "I don't see any saved recipes for you yet.";
    }

    const savedAtText = formatAbsoluteDate(savedRecipe.saved_at ?? savedRecipe.savedAt) || "an unknown date";

    if (!recipe) {
      return `Your latest saved recipe record points to recipe ID ${savedRecipe.recipe_id}, saved on ${savedAtText}, but I couldn't find the full recipe document for it.`;
    }

    if (!recipeDetailsRequested) {
      return `Your latest saved recipe is ${recipe.title}, saved on ${savedAtText}.`;
    }

    const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients.join("; ") : "No ingredients found.";
    const instructions = Array.isArray(recipe.instructions)
      ? recipe.instructions.map((step: string, index: number) => `${index + 1}. ${step}`).join(" ")
      : "No instructions found.";

    return `I found your latest saved recipe: ${recipe.title}, saved on ${savedAtText}. Ingredients: ${ingredients} Instructions: ${instructions}`;
  }

  if (isUserIdQuestion(message)) {
    return `Your user ID is ${userId}.`;
  }

  return null;
}

// ── Tool definitions ───────────────────────────────────────────────────────
const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "get_user_data",
        description:
          "Fetch this user's records from a What Now? database collection. " +
          "Always call this tool when the user asks about their own data — " +
          "date of birth, height, weight, exercise sessions, recipes, skin logs, " +
          "hair logs, restaurant favorites, pantry contents, nutrition goals, etc. " +
          "Never guess — always fetch the real data first.",
        parameters: {
          type: "object",
          properties: {
            collection: {
              type: "string",
              enum: Object.keys(ALLOWED_COLLECTIONS),
              description:
                "Collection to query. " +
                "'user_profiles' → DOB/height/weight/lifestyle. " +
                "'fitness_sessions' → workout history. " +
                "'fitness_exercise_biomechanics' → exercise biomechanics averages. " +
                "'skin_logs' → skin analysis history. " +
                "'hair_logs' → hair analysis history. " +
                "'generated_recipes' → AI-generated recipes. " +
                "'saved_recipes' → saved recipe IDs. " +
                "'loved_products' → skincare products user likes. " +
                "'product_recommendations' → recommended skincare/haircare. " +
                "'pantry_items' → current pantry ingredients. " +
                "'favorites' → favourite restaurants. " +
                "'nutrition_profiles' → diet goals and restrictions. " +
                "'clicks' → restaurant search history. " +
                "'nutrition_insight_memory' → AI nutrition insights. " +
                "'yelp_insight' → AI dining insights. " +
                "'community_posts' → user's community posts. " +
                "'community_comments' → user's comments. " +
                "'community_moods' → mood check-ins. " +
                "'community_events' → events user is attending. " +
                "'community_connections' → outbound and inbound connections (edges where this user is from or to).",
            },
            limit: {
              type: "integer",
              description: "Max records to return. Default 5, max 20.",
            },
            sort_field: {
              type: "string",
              description: "Field to sort by, e.g. 'created_at', 'timestamp', 'saved_at'.",
            },
            sort_order: {
              type: "string",
              enum: ["asc", "desc"],
              description: "asc or desc. Default: desc (newest first).",
            },
          },
          required: ["collection"],
        },
      },
    ],
  },
];

// ── Execute tool call ──────────────────────────────────────────────────────
async function executeTool(
  name: string,
  args: Record<string, any>,
  userId: string
): Promise<any> {
  if (name !== "get_user_data") return { error: "Unknown tool" };

  const { collection, limit = 5, sort_field, sort_order = "desc" } = args;

  if (!ALLOWED_COLLECTIONS[collection]) {
    return { error: `Collection '${collection}' is not accessible.` };
  }

  const { db } = await getDb();
  const userIdField = ALLOWED_COLLECTIONS[collection];
  const sortObj: Record<string, 1 | -1> = sort_field
    ? { [sort_field]: sort_order === "asc" ? 1 : -1 }
    : DEFAULT_SORTS[collection] || { _id: -1 };

  const filter =
    collection === "community_connections"
      ? { $or: [{ from_user_id: userId }, { to_user_id: userId }] }
      : { [userIdField]: userId };

  const results = await db
    .collection(collection)
    .find(filter)
    .sort(sortObj)
    .limit(Math.min(Number(limit) || 5, 20))
    .toArray();

  // Strip passwords
  const sanitized = results.map((r: any) => {
    const { password, ...rest } = r;
    return normalizeCollectionRecord(collection, rest);
  });

  return { collection, count: sanitized.length, data: sanitized };
}

// ── Gemini API call (with proper systemInstruction) ─────────────────────
async function callGemini(
  systemInstruction: string,
  contents: any[],
  withTools: boolean
): Promise<any> {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-flash-latest"];

  const body: any = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: { maxOutputTokens: 600, temperature: 0.7 },
  };
  if (withTools) body.tools = TOOLS;

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (data?.candidates?.[0]) return data;
      console.error(`[Gemini] ${model} returned no candidates:`, JSON.stringify(data));
    } catch (e) {
      console.error(`[Gemini] ${model} failed:`, e);
      continue;
    }
  }
  return null;
}

// ── POST /api/agent/chat ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ response: "Authentication required." }, { status: 401 });
    }

    const { profileContext, messages, message } = await req.json();
    const userId = user.userId;

    if (!message?.trim()) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    const directAnswer = await answerCommonPersonalDataQuestion(message, userId, messages || []);
    if (directAnswer) {
      try {
        const { db: saveDb } = await getDb();
        const now = new Date();
        await saveDb.collection("agent_chats").insertMany([
          { user_id: userId, role: "user", content: message, timestamp: now },
          { user_id: userId, role: "assistant", content: directAnswer, timestamp: new Date(now.getTime() + 1) },
        ]);
      } catch (saveErr) {
        console.error("[Agent Chat] Failed to save deterministic messages:", saveErr);
      }

      return NextResponse.json({ response: directAnswer, deterministic: true });
    }

    // System instruction — top-level, separate from conversation
    const systemInstruction = `You are What Now? Agent — a friendly, accurate wellness AI assistant embedded in the What Now? app.

USER PROFILE CONTEXT (from their real data):
${profileContext || "No profile built yet."}

USER ID: ${userId}

CRITICAL RULES:
1. You have a tool: get_user_data. USE IT whenever the user asks about their own data.
   - Asked about date of birth, age, height, weight? → call get_user_data("user_profiles")
   - Asked about workouts or exercise sessions? → call get_user_data("fitness_sessions")
   - Asked about recipes or food? → call get_user_data("generated_recipes") or "saved_recipes"
   - Asked about skin or hair? → call get_user_data("skin_logs") or "hair_logs"
   - Asked about restaurants or favorites? → call get_user_data("favorites")
   - Asked about nutrition goals? → call get_user_data("nutrition_profiles")
   - When in doubt about any personal data, CALL THE TOOL — never guess.
2. Only state facts you can confirm from the profile context or tool results. Never hallucinate.
3. Never treat a previous assistant message as evidence about the user's facts. If the user asks about their own data, ignore old assistant claims and verify again.
4. For recency questions, prefer the true timestamp fields from tool results such as endedAt, startedAt, created_at, createdAt, saved_at, or timestamp.
5. If you mention a date, use an absolute date like "April 19, 2026" instead of a relative guess.
6. If the tool returns no confirmed data, say that clearly instead of making up an answer.
7. Do not make medical diagnoses or prescribe treatments.
8. Keep responses warm, concise (3-5 sentences), and specific to this user's real data.`;

    // Build conversation (only real messages, no system prompt in contents)
    const history = (messages || [])
      .slice(-9)
      .filter((msg: { role: string; content: string }) => !looksLikePersonalDataQuestion(message) || msg.role === "user");
    const contents: any[] = [
      ...history.map((msg: { role: string; content: string }) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    // ── Agentic loop: up to 4 tool call rounds ─────────────────
    let currentContents = [...contents];
    let finalResponse = "";

    for (let round = 0; round < 4; round++) {
      const geminiResp = await callGemini(systemInstruction, currentContents, true);
      if (!geminiResp) break;

      const candidate = geminiResp.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      const functionCallPart = parts.find((p: any) => p.functionCall);
      const textPart = parts.find((p: any) => p.text);

      if (functionCallPart) {
        const { name, args } = functionCallPart.functionCall;

        const toolResult = await executeTool(name, args, userId);

        currentContents = [
          ...currentContents,
          { role: "model", parts: [{ functionCall: { name, args } }] },
          {
            role: "user",
            parts: [
              {
                functionResponse: {
                  name,
                  response: { result: toolResult },
                },
              },
            ],
          },
        ];
        continue;
      }

      if (textPart) {
        finalResponse = textPart.text.trim();
        break;
      }

      break;
    }

    if (!finalResponse) {
      finalResponse = "The chat model is temporarily unavailable or rate-limited right now. Please try again in about a minute.";
    }

    // ── Persist both messages to MongoDB ──────────────────────
    try {
      const { db: saveDb } = await getDb();
      const now = new Date();
      await saveDb.collection("agent_chats").insertMany([
        { user_id: userId, role: "user",      content: message,       timestamp: now },
        { user_id: userId, role: "assistant", content: finalResponse, timestamp: new Date(now.getTime() + 1) },
      ]);
    } catch (saveErr) {
      console.error("[Agent Chat] Failed to save messages:", saveErr);
    }

    return NextResponse.json({ response: finalResponse });
  } catch (err) {
    console.error("Agent chat error:", err);
    return NextResponse.json(
      { response: "I encountered an error. Please try again." },
      { status: 500 }
    );
  }
}
