import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { calculateAgeFromCalendarDate, formatCalendarDate } from "@/lib/calendarDate";
import { getDatabase } from "@/lib/mongodb";

async function geminiCall(prompt: string): Promise<string> {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-flash-latest"];
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
          }),
        }
      );
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text.trim();
    } catch {
      continue;
    }
  }
  return "";
}

function isUsableProfileContext(value: string | null | undefined): value is string {
  if (!value) return false;

  const trimmed = value.trim();
  if (trimmed.length < 120) return false;
  if (!/[.!?]["']?$/.test(trimmed)) return false;

  const sentenceCount = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .length;

  return sentenceCount >= 2;
}

const AGENT_TIME_ZONE = process.env.AGENT_TIME_ZONE || "America/Denver";

function getDateTimePartMap(value: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", options)
    .formatToParts(value)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});
}

function getCurrentDateTimeContext(now: Date = new Date(), timeZone = AGENT_TIME_ZONE) {
  const dateParts = getDateTimePartMap(now, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeParts = getDateTimePartMap(now, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return {
    timeZone,
    dateKey: `${dateParts.year || "0000"}-${dateParts.month || "01"}-${dateParts.day || "01"}`,
    timeKey: `${timeParts.hour || "00"}:${timeParts.minute || "00"}`,
    dateTimeText: new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(now),
  };
}

function isUpcomingCommunityEvent(event: Record<string, any>, current = getCurrentDateTimeContext()) {
  const eventDate = String(event.date || "").trim();
  if (!eventDate) return false;
  if (eventDate > current.dateKey) return true;
  if (eventDate < current.dateKey) return false;

  const eventTime = String(event.time || "").trim();
  if (!eventTime) return true;
  return eventTime >= current.timeKey;
}

function formatEventSummary(event: Record<string, any>) {
  const eventDate = event.date ? formatCalendarDate(String(event.date)) || String(event.date) : "an unknown date";
  const eventTime = String(event.time || "").trim();
  const timeText = eventTime ? ` at ${eventTime}` : "";
  const locationText = event.location ? ` in ${event.location}` : "";
  return `${event.title} on ${eventDate}${timeText}${locationText}`;
}

function buildFallbackProfileContext(params: {
  userDoc: any;
  userProfile: any;
  nutritionProfile: any;
  pantryItems: any[];
  favorites: any[];
  skinHairProfile: any;
  lovedProducts: any[];
  latestFitnessSession: any;
  age: number | null;
}) {
  const sentences: string[] = [];
  const name = params.userDoc?.name || "This user";
  const goal = params.nutritionProfile?.primary_goal?.replace(/_/g, " ");
  const dob = params.userProfile?.dateOfBirth;
  const favoriteRestaurant = params.favorites[0]?.restaurantName || params.favorites[0]?.restaurant_name;
  const pantryPreview = params.pantryItems.slice(0, 3).map((item: any) => item.item_name).filter(Boolean);
  const latestWorkoutDate = params.latestFitnessSession?.ended_at
    ? new Date(params.latestFitnessSession.ended_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  if (params.age !== null && dob) {
    const dobText = formatCalendarDate(dob) || dob;
    sentences.push(`${name} is ${params.age} years old, with a saved date of birth of ${dobText}.`);
  }

  if (goal) {
    const protein = params.nutritionProfile?.protein_goal_g ? `${params.nutritionProfile.protein_goal_g}g protein` : null;
    const calories = params.nutritionProfile?.calorie_goal ? `${params.nutritionProfile.calorie_goal} kcal` : null;
    const targets = [protein, calories].filter(Boolean).join(" and ");
    sentences.push(
      targets
        ? `Your current nutrition goal is ${goal}, with targets of ${targets}.`
        : `Your current nutrition goal is ${goal}.`
    );
  }

  if (latestWorkoutDate && params.latestFitnessSession?.exercise_name) {
    sentences.push(
      `Your most recent recorded workout was ${params.latestFitnessSession.exercise_name} on ${latestWorkoutDate}, with ${params.latestFitnessSession.reps_completed ?? "an unknown number of"} reps.`
    );
  }

  if (pantryPreview.length > 0) {
    sentences.push(`You currently have pantry items like ${pantryPreview.join(", ")} available.`);
  }

  if (favoriteRestaurant) {
    sentences.push(`You have restaurant activity saved, including ${favoriteRestaurant}.`);
  }

  if (params.skinHairProfile?.concerns?.length) {
    sentences.push(`Your saved skin concerns include ${params.skinHairProfile.concerns.join(", ")}.`);
  } else if (params.lovedProducts.length > 0) {
    const topProduct = params.lovedProducts[0];
    if (topProduct?.product_name) {
      sentences.push(`One product you like is ${topProduct.product_name}${topProduct.brand ? ` by ${topProduct.brand}` : ""}.`);
    }
  }

  if (sentences.length === 0) {
    return `You are ${name}, a What Now? user tracking health and wellness information across the app.`;
  }

  return sentences.slice(0, 5).join(" ");
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.userId;
  const db = await getDatabase();
  const currentContext = getCurrentDateTimeContext();

  try {
    let objId: ObjectId | null = null;
    try { objId = new ObjectId(userId); } catch { /* not a valid ObjectId */ }

    // 2-day window for time-sensitive data
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    const [
      userDoc,
      userProfile,
      nutritionProfile,
      latestFitnessSession,
      skinHairProfile,
      lovedProducts,
      generatedRecipes,
      savedRecipes,
      pantryItems,
      favorites,
      clickHistory,
      nutritionInsights,
      yelpInsights,
      nutritionSession,
      communityPosts,
      communityComments,
      communityMoods,
      communityEvents,
      communityConnections,
    ] = await Promise.all([
      // Identity — always fetch
      objId ? db.collection("users").findOne({ _id: objId }) : null,
      db.collection("user_profiles").findOne({ user_id: userId }),
      db.collection("nutrition_profiles").findOne({ user_id: userId }),
      db.collection("fitness_sessions").find({ user_id: userId }).sort({ ended_at: -1 }).limit(1).next(),
      db.collection("skin_hair_profiles").findOne({ user_id: userId }),
      db.collection("loved_products").find({ user_id: userId }).toArray(),
      // Recent activity — past 2 days
      db.collection("generated_recipes").find({ user_id: userId, created_at: { $gte: twoDaysAgo } }).sort({ created_at: -1 }).limit(10).toArray(),
      db.collection("saved_recipes").find({ user_id: userId, saved_at: { $gte: twoDaysAgo } }).sort({ saved_at: -1 }).limit(10).toArray(),
      db.collection("pantry_items").find({ user_id: userId, created_at: { $gte: twoDaysAgo } }).toArray(),
      db.collection("favorites").find({ user_id: userId, timestamp: { $gte: twoDaysAgo } }).sort({ timestamp: -1 }).toArray(),
      db.collection("clicks").find({ user_id: userId, timestamp: { $gte: twoDaysAgo } }).sort({ timestamp: -1 }).limit(30).toArray(),
      db.collection("nutrition_insight_memory").find({ user_id: userId, created_at: { $gte: twoDaysAgo } }).sort({ created_at: -1 }).limit(5).toArray(),
      db.collection("yelp_insight").find({ user_id: userId, timestamp: { $gte: twoDaysAgo } }).sort({ timestamp: -1 }).limit(3).toArray(),
      db.collection("nutrition_sessions_summary").findOne({ user_id: userId, started_at: { $gte: twoDaysAgo } }),
      // Community activity — past 2 days
      db.collection("community_posts").find({ user_id: userId, created_at: { $gte: twoDaysAgo } }).sort({ created_at: -1 }).limit(5).toArray(),
      db.collection("community_comments").find({ user_id: userId, created_at: { $gte: twoDaysAgo } }).sort({ created_at: -1 }).limit(5).toArray(),
      db.collection("community_moods").find({ user_id: userId, created_at: { $gte: twoDaysAgo } }).sort({ created_at: -1 }).limit(5).toArray(),
      db.collection("community_events").find({ attendees: userId, date: { $gte: currentContext.dateKey } }).sort({ date: 1, time: 1 }).limit(20).toArray(),
      db.collection("community_connections").find({ $or: [{ from_user_id: userId }, { to_user_id: userId }] }).sort({ timestamp: -1 }).limit(10).toArray(),
    ]);

    if (userProfile?.date_of_birth && !userProfile.dateOfBirth) {
      userProfile.dateOfBirth = userProfile.date_of_birth;
    }

    for (const favorite of favorites) {
      if (favorite.restaurant_name && !favorite.restaurantName) {
        favorite.restaurantName = favorite.restaurant_name;
      }
    }

    if (yelpInsights[0]) {
      if (yelpInsights[0].top_categories && !yelpInsights[0].topCategories) {
        yelpInsights[0].topCategories = yelpInsights[0].top_categories;
      }
      if (yelpInsights[0].search_locations && !yelpInsights[0].searchLocations) {
        yelpInsights[0].searchLocations = yelpInsights[0].search_locations;
      }
    }

    // ── Build prompt sections ─────────────────────────────────

    // ── Age calculation ───────────────────────────────────────
    const age = calculateAgeFromCalendarDate(userProfile?.dateOfBirth);

    const favCuisines = favorites.length > 0
      ? [...new Set(favorites.flatMap((f: any) => f.categories?.map((c: any) => c.title) || []))]
      : [];

    const searchedCategories = [...new Set(
      clickHistory
        .filter((c: any) => c.action === "search" && c.metadata?.category && !["all","__liked"].includes(c.metadata.category))
        .map((c: any) => c.metadata.category)
    )];

    const searchedLocations = [...new Set(
      clickHistory
        .filter((c: any) => c.action === "search" && c.metadata?.location)
        .map((c: any) => c.metadata.location)
    )];

    const recipeTitles = generatedRecipes.map((r: any) => r.title);
    const recipeTags = [...new Set(generatedRecipes.flatMap((r: any) => r.tags || []))];
    const latestYelpInsight = yelpInsights[0]?.insight || null;
    const upcomingCommunityEvents = communityEvents.filter((event: any) => isUpcomingCommunityEvent(event, currentContext)).slice(0, 5);

    const prompt = `You are building a personalized user profile context for a wellness AI assistant chatbot called What Now? Agent.

Below is REAL data collected from this user's activity in the past 2 days across the What Now? app. Synthesize it into a clear, warm, specific profile (4-6 sentences) written in second person. This will be injected into every chat session.
Current local date/time for interpreting recency and upcoming events: ${currentContext.dateTimeText}.

---

## PERSONAL INFO
- Name: ${userDoc?.name || "Unknown"}
- Email: ${userDoc?.email || "unknown"}
- Date of Birth: ${userProfile?.dateOfBirth || "unknown"}
- Age: ${age !== null ? `${age} years old` : "unknown"}
- Height: ${userProfile?.height ? `${userProfile.height}cm` : "unknown"}
- Weight: ${userProfile?.weight ? `${userProfile.weight}kg` : "unknown"}
- Activity Level: ${userProfile?.lifestyle || "unknown"}

## FITNESS & NUTRITION GOALS
- Primary Goal: ${nutritionProfile?.primary_goal?.replace(/_/g, " ") || "not set"}
- Daily Protein Target: ${nutritionProfile?.protein_goal_g ? `${nutritionProfile.protein_goal_g}g` : "not set"}
- Daily Calorie Target: ${nutritionProfile?.calorie_goal ? `${nutritionProfile.calorie_goal} kcal` : "not set"}
- Dietary Restrictions: ${nutritionProfile?.restrictions?.length ? nutritionProfile.restrictions.join(", ") : "none"}
- Dietary Preferences: ${nutritionProfile?.dietary_preferences?.length ? nutritionProfile.dietary_preferences.join(", ") : "none"}
- Disliked Ingredients: ${nutritionProfile?.disliked_ingredients?.length ? nutritionProfile.disliked_ingredients.join(", ") : "none"}

## PANTRY INGREDIENTS CURRENTLY AVAILABLE
${pantryItems.length > 0 ? pantryItems.map(p => `- ${p.item_name}`).join("\n") : "- No pantry data"}

## RECIPES GENERATED & SAVED
${recipeTitles.length > 0 ? recipeTitles.map(t => `- ${t}`).join("\n") : "- None yet"}
Recipe Tags: ${recipeTags.length > 0 ? recipeTags.join(", ") : "none"}

## DINING PREFERENCES
- Favourite Restaurants: ${favorites.length > 0 ? favorites.map((f: any) => `${f.restaurantName} (${f.categories?.map((c: any) => c.title).join("/")})`).join(", ") : "none saved"}
- Cuisine Categories Liked: ${favCuisines.length > 0 ? favCuisines.join(", ") : "unknown"}
- Restaurant Search Categories: ${searchedCategories.length > 0 ? searchedCategories.join(", ") : "none"}
- Search Locations: ${searchedLocations.length > 0 ? searchedLocations.join(", ") : "unknown"}

## SKIN & HAIR PROFILE
- Skin Type: ${skinHairProfile?.skin_type || "unknown"}
- Scalp Type: ${skinHairProfile?.scalp_type || "unknown"}
- Skin Concerns: ${skinHairProfile?.concerns?.length ? skinHairProfile.concerns.join(", ") : "none"}
- Allergies: ${skinHairProfile?.allergies?.length ? skinHairProfile.allergies.join(", ") : "none"}
- Preferred Product Categories: ${skinHairProfile?.preferred_categories?.length ? skinHairProfile.preferred_categories.join(", ") : "none"}
- Loved Skincare Products: ${lovedProducts.length > 0 ? lovedProducts.map(p => `${p.product_name} by ${p.brand} (${p.category})`).join(", ") : "none"}

## RECENT APP ACTIVITY
${nutritionSession ? `- Actions taken: ${nutritionSession.action_types?.join(" → ") || "none"}
- Event count: ${nutritionSession.event_count || 0}
- Session started: ${nutritionSession.started_at ? new Date(nutritionSession.started_at).toISOString() : "unknown"}` : "- No recent session"}

## COMMUNITY ACTIVITY (past 2 days)
- Posts shared: ${communityPosts.length > 0 ? communityPosts.map((p:any) => `"${p.title}" [${p.tags?.join(", ")}]`).join("; ") : "none"}
- Comments made: ${communityComments.length > 0 ? `${communityComments.length} comment(s)` : "none"}
- Mood check-ins: ${communityMoods.length > 0 ? communityMoods.map((m:any) => `${m.rating}/5${m.note ? ` ("${m.note}")` : ""}`).join(", ") : "none"}
- Upcoming events attending: ${upcomingCommunityEvents.length > 0 ? upcomingCommunityEvents.map((e:any) => formatEventSummary(e)).join(", ") : "none"}
- Connections made: ${communityConnections.length > 0 ? communityConnections.length : "none"}

## AI-GENERATED INSIGHTS (past 2 days)
Nutrition Insights: ${nutritionInsights.length > 0 ? nutritionInsights.map((n:any) => n.insight_text || n.insight).join(" ") : "none yet"}
Dining Behaviour Insight: ${latestYelpInsight || "none yet"}
Top Dining Categories (from search+favourites): ${yelpInsights[0]?.topCategories?.join(", ") || favCuisines.join(", ") || "unknown"}
Search Locations: ${yelpInsights[0]?.searchLocations?.join(", ") || searchedLocations.join(", ") || "unknown"}

## MOST RECENT FITNESS SESSION
- Exercise: ${latestFitnessSession?.exercise_name || "unknown"}
- Reps Completed: ${latestFitnessSession?.reps_completed ?? "unknown"}
- Ended At: ${latestFitnessSession?.ended_at ? new Date(latestFitnessSession.ended_at).toISOString() : "unknown"}

---

STRICT RULES — follow these exactly:
1. Only use facts explicitly present in the data above. Do NOT invent, assume, or infer anything not stated.
2. If a field is "unknown", "none", or "not set" — do NOT mention it or fill it with guesses.
3. Do NOT make medical claims, diagnoses, or treatment recommendations.
4. Do NOT hallucinate restaurant names, recipe names, ingredients, or product names — only use what is listed above.
5. If there is not enough data to write a sentence, skip it entirely rather than guessing.

Now write a 4-6 sentence profile context in second person ("You are someone who..."). Be specific — mention their actual name, goals, cuisine preferences, skin concerns using only the real data above. Be warm and personal. Write in flowing prose, no bullet points.`;

    const generatedProfileContext = await geminiCall(prompt);
    const profileContext = isUsableProfileContext(generatedProfileContext)
      ? generatedProfileContext
      : buildFallbackProfileContext({
        userDoc,
        userProfile,
        nutritionProfile,
        pantryItems,
        favorites,
        skinHairProfile,
        lovedProducts,
        latestFitnessSession,
        age,
      });

    // ── Save to MongoDB cache (upsert, 24hr TTL) ──────────────
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await db.collection("agent_profile_cache").updateOne(
      { user_id: userId },
      {
        $set: {
          user_id: userId,
          profile_context: profileContext,
          built_at: now,
          expires_at: expiresAt,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ profileContext, fromCache: false });
  } catch (error) {
    console.error("Agent profile error:", error);
    return NextResponse.json({ error: "Failed to build profile context" }, { status: 500 });
  }
}
