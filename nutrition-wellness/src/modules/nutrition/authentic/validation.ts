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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleStartsWithDishName(title: string, names: string[]) {
  const normalizedTitle = normalizeDishText(title);
  return names.some((name) => normalizedTitle.startsWith(normalizeDishText(name)));
}

function moveDishNameToFront(title: string, baselineNames: string[], canonicalName: string) {
  const matchedName = baselineNames.find((name) => new RegExp(escapeRegex(name), "i").test(title));
  if (!matchedName) {
    return `${canonicalName} - ${title}`.trim();
  }

  const withoutMatchedName = title
    .replace(new RegExp(escapeRegex(matchedName), "i"), "")
    .replace(/^[\s\-:–|]+/, "")
    .replace(/[\s\-:–|]+$/, "")
    .trim();

  if (!withoutMatchedName) {
    return canonicalName;
  }

  return `${canonicalName} - ${withoutMatchedName}`;
}

export function enforceOptimizedDishIdentity(recipe: PantryMealDraft, baseline: AuthenticBaseline): PantryMealDraft {
  const baselineNames = listBaselineNames(baseline);
  const normalizedTitle = normalizeDishText(recipe.title);
  const alreadyNamed = baselineNames.some((name) => includesDishName(normalizedTitle, name));
  const nextTitle = !alreadyNamed
    ? `${baseline.dish_name} - ${recipe.title}`.trim()
    : titleStartsWithDishName(recipe.title, baselineNames)
      ? recipe.title
      : moveDishNameToFront(recipe.title, baselineNames, baseline.dish_name);

  return {
    ...recipe,
    title: nextTitle,
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
