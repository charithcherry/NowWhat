import type { AuthenticDishLibraryEntry } from "../types";
import { meaningfulDishTokens, normalizeDishText } from "./queryParser";

const NON_DISH_SIGNAL_PATTERNS = [
  /\balbum\b/i,
  /\bartist\b/i,
  /\bband\b/i,
  /\bbook\b/i,
  /\bepisode\b/i,
  /\bfilm\b/i,
  /\bhard rock\b/i,
  /\bmovie\b/i,
  /\bmusician\b/i,
  /\bnovel\b/i,
  /\brecord label\b/i,
  /\bsinger\b/i,
  /\bsingle\b/i,
  /\bsong\b/i,
  /\btelevision\b/i,
  /\bvideo game\b/i,
];

const PACKAGED_INGREDIENT_PATTERNS = [
  /\bartificial\b/i,
  /\bbenzoate\b/i,
  /\bcarbonated water\b/i,
  /\bcitric acid\b/i,
  /\bcolor(?:ing)?\b/i,
  /\bemulsifier\b/i,
  /\be\d{3,4}\b/i,
  /\bingredients?\s*:/i,
  /\bnatural\s*&\s*artificial\b/i,
  /\bpreservative\b/i,
  /\b(?:yellow|blue|red|green)\s*#?\s*\d+\b/i,
];

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => collapseWhitespace(value)).filter(Boolean)));
}

function isWeakSummary(summary: string, cuisine: string) {
  const normalizedSummary = normalizeDishText(summary);
  const normalizedCuisine = normalizeDishText(cuisine);

  if (!normalizedSummary) {
    return true;
  }

  if (normalizedSummary === normalizedCuisine) {
    return true;
  }

  if (/^[a-z\s-]+ cuisine$/i.test(summary.trim())) {
    return true;
  }

  return summary.trim().split(/\s+/).length <= 2;
}

function hasDishNameIngredientOverlap(entry: Pick<AuthenticDishLibraryEntry, "canonical_name" | "aliases">, ingredients: string[]) {
  const nameTokens = new Set(meaningfulDishTokens([entry.canonical_name, ...(entry.aliases || [])].join(" ")));
  if (nameTokens.size === 0) {
    return false;
  }

  return ingredients.some((ingredient) => meaningfulDishTokens(ingredient).some((token) => nameTokens.has(token)));
}

export function sanitizeAuthenticIngredients(ingredients: string[]) {
  return unique(
    ingredients
      .map((ingredient) => ingredient.replace(/\s+/g, " ").trim())
      .filter((ingredient) => ingredient.length >= 2)
      .filter((ingredient) => !PACKAGED_INGREDIENT_PATTERNS.some((pattern) => pattern.test(ingredient)))
      .filter((ingredient) => meaningfulDishTokens(ingredient).length > 0),
  ).slice(0, 12);
}

export function sanitizeAuthenticDishEntry(entry: AuthenticDishLibraryEntry): AuthenticDishLibraryEntry | null {
  const cleaned: AuthenticDishLibraryEntry = {
    ...entry,
    aliases: unique(entry.aliases || []).slice(0, 12),
    core_ingredients: sanitizeAuthenticIngredients(entry.core_ingredients || []),
    baseline_steps: unique(entry.baseline_steps || []).slice(0, 10),
  };

  const combinedSignals = collapseWhitespace(
    [cleaned.canonical_name, cleaned.traditional_summary, cleaned.source_label, ...(cleaned.aliases || [])].join(" "),
  );

  if (!cleaned.canonical_name.trim()) {
    return null;
  }

  if (NON_DISH_SIGNAL_PATTERNS.some((pattern) => pattern.test(combinedSignals))) {
    return null;
  }

  if (isWeakSummary(cleaned.traditional_summary, cleaned.cuisine) && !hasDishNameIngredientOverlap(cleaned, cleaned.core_ingredients)) {
    return null;
  }

  return cleaned;
}
