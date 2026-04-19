import { CACHED_AUTHENTIC_DISH_LIBRARY } from "../data/authenticDishLibraryCache";
import type { AuthenticBaseline, PantryMealDraft } from "../types";
import { normalizeDishText } from "./queryParser";

function uniqueNames(names: string[]) {
  return Array.from(new Set(names.map((item) => item.trim()).filter(Boolean)));
}

function listBaselineNames(baseline: AuthenticBaseline) {
  return uniqueNames([baseline.dish_name, ...(baseline.aliases || [])]);
}

function includesDishName(haystack: string, needle: string) {
  const normalizedNeedle = normalizeDishText(needle);
  if (!normalizedNeedle) {
    return false;
  }

  return haystack.includes(normalizedNeedle);
}

export function enforceOptimizedDishIdentity(recipe: PantryMealDraft, baseline: AuthenticBaseline): PantryMealDraft {
  const normalizedTitle = normalizeDishText(recipe.title);
  const baselineNames = listBaselineNames(baseline);
  const alreadyNamed = baselineNames.some((name) => includesDishName(normalizedTitle, name));

  return {
    ...recipe,
    title: alreadyNamed ? recipe.title : `${baseline.dish_name} - ${recipe.title}`.trim(),
    cuisine: baseline.cuisine,
  };
}

export function validateOptimizedDishIdentity(recipe: PantryMealDraft, baseline: AuthenticBaseline): { valid: boolean; reason?: string } {
  const combinedText = normalizeDishText([recipe.title, recipe.description, recipe.result].join(" "));
  const baselineNames = listBaselineNames(baseline);
  const mentionsBaseline = baselineNames.some((name) => includesDishName(combinedText, name));

  if (!mentionsBaseline) {
    return {
      valid: false,
      reason: `The generated recipe did not explicitly stay anchored to ${baseline.dish_name}.`,
    };
  }

  const conflictingDish = CACHED_AUTHENTIC_DISH_LIBRARY.find((entry) => {
    if (normalizeDishText(entry.canonical_name) === normalizeDishText(baseline.dish_name)) {
      return false;
    }

    const names = uniqueNames([entry.canonical_name, ...entry.aliases]);
    return names.some((name) => includesDishName(combinedText, name));
  });

  if (conflictingDish) {
    return {
      valid: false,
      reason: `The generated recipe drifted toward ${conflictingDish.canonical_name} instead of ${baseline.dish_name}.`,
    };
  }

  return { valid: true };
}
