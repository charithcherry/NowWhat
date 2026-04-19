import { GROUNDING_LINES } from "../constants";
import { ScraperReadyAuthenticSource } from "../authentic/source";
import { enforceOptimizedDishIdentity, validateOptimizedDishIdentity } from "../authentic/validation";
import type {
  AuthenticBaseline,
  AuthenticOptimizationResponse,
  AuthenticOptimizationResult,
  NutritionProfile,
  PantryMealDraft,
} from "../types";
import { createGeminiNutritionClient } from "./geminiClient";

function unique(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function includesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

function inferProteinAdditions(profile: Partial<NutritionProfile>, baseline: AuthenticBaseline): string[] {
  const prefs = (profile.dietary_preferences || []).map((item) => item.toLowerCase());
  const sweetDish = includesAny(
    `${baseline.dish_name} ${baseline.traditional_summary} ${baseline.core_ingredients.join(" ")}`.toLowerCase(),
    ["dessert", "sweet", "mango", "sticky rice", "coconut milk", "jaggery"],
  );

  if (sweetDish) {
    return ["unsweetened Greek yogurt on the side", "toasted pumpkin seeds or sesame topping"];
  }

  if (prefs.includes("vegan")) {
    return ["tofu", "edamame", "lentils"];
  }

  if (prefs.includes("vegetarian")) {
    return ["paneer", "tofu", "greek yogurt", "lentils"];
  }

  if (prefs.includes("pescatarian")) {
    return ["eggs", "shrimp", "fish", "greek yogurt"];
  }

  return ["lean chicken", "eggs", "greek yogurt", "tofu"];
}

function includeLowerOilHint(query: string, preferences: string[]) {
  const haystack = `${query} ${preferences.join(" ")}`.toLowerCase();
  return haystack.includes("less oil") || haystack.includes("lighter") || haystack.includes("reduce oil") || haystack.includes("lower oil");
}

function includeSugarReductionHint(query: string, preferences: string[]) {
  const haystack = `${query} ${preferences.join(" ")}`.toLowerCase();
  return haystack.includes("less sugar") || haystack.includes("lower sugar") || haystack.includes("without added sugar") || haystack.includes("no added sugar");
}

function includeProteinBoostHint(query: string, preferences: string[], profile: Partial<NutritionProfile>) {
  const haystack = `${query} ${preferences.join(" ")}`.toLowerCase();
  return (
    haystack.includes("protein") ||
    profile.primary_goal === "high_protein" ||
    profile.primary_goal === "muscle_gain"
  );
}

function fallbackOptimize(params: {
  query: string;
  baseline: AuthenticBaseline;
  profile: Partial<NutritionProfile>;
  optimizationPreferences: string[];
}): AuthenticOptimizationResult {
  const proteinAdds = inferProteinAdditions(params.profile, params.baseline);
  const lessOil = includeLowerOilHint(params.query, params.optimizationPreferences);
  const lessSugar = includeSugarReductionHint(params.query, params.optimizationPreferences);
  const moreProtein = includeProteinBoostHint(params.query, params.optimizationPreferences, params.profile);

  const ingredients = unique([
    ...params.baseline.core_ingredients,
    ...(moreProtein ? [`Optional protein-supporting add-on: ${proteinAdds.slice(0, 2).join(" or ")}`] : []),
    ...(lessOil ? ["Use moderate oil and rely more on simmering or roasting where possible"] : []),
    ...(lessSugar ? ["Reduce or omit added sugar while keeping the dish recognizable"] : []),
  ]);

  const instructions = unique([
    ...params.baseline.baseline_steps,
    ...(moreProtein
      ? [
          proteinAdds[0].includes("side")
            ? `Add ${proteinAdds[0]} when serving to increase protein without changing the dish identity.`
            : `Fold in ${proteinAdds[0]} during the final stage to increase protein while preserving core flavors.`,
        ]
      : []),
    ...(lessSugar ? ["Dial back added sugar and rely more on the dish's natural sweetness or acidity balance."] : []),
    lessOil
      ? "Use moderate oil and emphasize roasting or simmering to keep authentic character with a lighter finish."
      : "Keep the original seasoning and serving style so the dish identity stays recognizable.",
  ]);

  const titleSuffix = moreProtein ? "Protein-Aware Traditional Style" : "Balanced Traditional Style";
  const optimizedMeal: PantryMealDraft = {
    title: `${params.baseline.dish_name} - ${titleSuffix}`,
    description: `A more balanced ${params.baseline.dish_name} that keeps the original flavor direction recognizable.`,
    cuisine: params.baseline.cuisine,
    goal_context: params.profile.primary_goal || "general_wellness",
    ingredients,
    instructions,
    tags: ["authentic-optimized", params.baseline.cuisine.toLowerCase(), ...(moreProtein ? ["protein-forward"] : ["balanced"])],
    protein_focus_level: moreProtein ? "medium-high" : "medium",
    generated_with_gemini: false,
    result: `This version of ${params.baseline.dish_name} keeps the core identity of the dish intact while applying the requested nutrition adjustments.`,
    why_it_fits:
      "The update stays anchored to the resolved dish baseline and applies practical nutrition adjustments without renaming the dish.",
    confidence: "medium",
    also_check: GROUNDING_LINES.authentic,
  };

  const changeSummary = unique([
    ...(moreProtein ? [`Added an optional protein-supporting adjustment (${proteinAdds[0]}).`] : []),
    ...(lessSugar ? ["Reduced or removed added sugar while preserving the original flavor profile."] : []),
    ...(lessOil ? ["Moderated oil use without changing the core dish structure."] : []),
    "Preserved the baseline aromatics, seasoning direction, and serving style to keep identity cues intact.",
  ]);

  return {
    baseline: params.baseline,
    optimized_recipe: optimizedMeal,
    change_summary: changeSummary,
  };
}

async function generateValidatedGeminiOptimization(params: {
  query: string;
  baseline: AuthenticBaseline;
  profile: Partial<NutritionProfile>;
  modifiers: string[];
}): Promise<{
  result: AuthenticOptimizationResult;
  model: string;
  attempted_regeneration: boolean;
}> {
  const gemini = createGeminiNutritionClient();
  if (!gemini) {
    throw new Error("Gemini client is unavailable");
  }

  let attemptedRegeneration = false;

  const firstAttempt = await gemini.optimizeAuthenticDish({
    query: params.query,
    profile: params.profile,
    baseline: params.baseline,
    optimizationPreferences: params.modifiers,
    modifiers: params.modifiers,
  });

  let optimizedRecipe = enforceOptimizedDishIdentity(firstAttempt.optimized_recipe, params.baseline);
  let validation = validateOptimizedDishIdentity(optimizedRecipe, params.baseline);

  if (!validation.valid) {
    attemptedRegeneration = true;
    const secondAttempt = await gemini.optimizeAuthenticDish({
      query: params.query,
      profile: params.profile,
      baseline: params.baseline,
      optimizationPreferences: params.modifiers,
      modifiers: params.modifiers,
      validationFeedback: validation.reason,
    });

    optimizedRecipe = enforceOptimizedDishIdentity(secondAttempt.optimized_recipe, params.baseline);
    validation = validateOptimizedDishIdentity(optimizedRecipe, params.baseline);

    if (!validation.valid) {
      throw new Error(validation.reason || "Generated recipe drifted away from the resolved dish identity");
    }

    return {
      result: {
        baseline: params.baseline,
        optimized_recipe: {
          ...optimizedRecipe,
          tags: unique(["authentic-optimized", ...(optimizedRecipe.tags || [])]),
        },
        change_summary: unique(secondAttempt.change_summary),
      },
      model: gemini.providerName,
      attempted_regeneration: attemptedRegeneration,
    };
  }

  return {
    result: {
      baseline: params.baseline,
      optimized_recipe: {
        ...optimizedRecipe,
        tags: unique(["authentic-optimized", ...(optimizedRecipe.tags || [])]),
      },
      change_summary: unique(firstAttempt.change_summary),
    },
    model: gemini.providerName,
    attempted_regeneration: attemptedRegeneration,
  };
}

export async function optimizeAuthenticDish(params: {
  query: string;
  cuisine?: string;
  profile: Partial<NutritionProfile>;
  optimizationPreferences: string[];
}): Promise<AuthenticOptimizationResponse> {
  const source = new ScraperReadyAuthenticSource();
  const { parsed_query, resolution } = await source.search(params.query, params.cuisine);

  if (resolution.needs_clarification || !resolution.baseline) {
    return {
      optimization: null,
      generated_with_gemini: false,
      parsed_query,
      retrieval: resolution,
      needs_clarification: true,
      clarification_message: resolution.clarification_message,
      validation: {
        attempted_regeneration: false,
        generation_validated: false,
      },
    };
  }

  const mergedModifiers = unique([...parsed_query.modifiers, ...params.optimizationPreferences]);
  let attemptedRegeneration = false;

  try {
    const optimized = await generateValidatedGeminiOptimization({
      query: params.query,
      baseline: resolution.baseline,
      profile: params.profile,
      modifiers: mergedModifiers,
    });

    attemptedRegeneration = optimized.attempted_regeneration;

    return {
      optimization: optimized.result,
      generated_with_gemini: true,
      model: optimized.model,
      parsed_query,
      retrieval: resolution,
      needs_clarification: false,
      validation: {
        attempted_regeneration: attemptedRegeneration,
        generation_validated: true,
      },
    };
  } catch (error) {
    console.error("Gemini authentic optimization failed, using deterministic fallback:", error);
  }

  const fallback = fallbackOptimize({
    query: params.query,
    baseline: resolution.baseline,
    profile: params.profile,
    optimizationPreferences: mergedModifiers,
  });

  const validatedFallbackRecipe = enforceOptimizedDishIdentity(fallback.optimized_recipe, resolution.baseline);

  return {
    optimization: {
      ...fallback,
      optimized_recipe: validatedFallbackRecipe,
    },
    generated_with_gemini: false,
    parsed_query,
    retrieval: resolution,
    needs_clarification: false,
    validation: {
      attempted_regeneration: attemptedRegeneration,
      generation_validated: true,
    },
  };
}
