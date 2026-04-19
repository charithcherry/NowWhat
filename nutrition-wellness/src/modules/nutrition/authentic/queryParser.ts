import type { ParsedAuthenticDishQuery } from "../types";

const LEADING_FILLER_REGEX =
  /^(?:please|can you|could you|would you|help me|show me|give me|make|optimize|create|suggest|recommend|i want|i would like|i'd like)\s+/i;

const LEADING_DESCRIPTOR_REGEX =
  /^(?:authentic|traditional|healthy|healthier|lighter|balanced|protein-rich|high-protein)\s+/i;

const TRAILING_DESCRIPTOR_REGEX = /\b(?:dish|recipe|version|style)\b$/i;

const MODIFIER_STARTERS = [
  "without",
  "with",
  "but",
  "plus",
  "no",
  "less",
  "reduced",
  "reduce",
  "lower",
  "lighter",
  "more",
  "extra",
  "higher",
  "high",
  "low",
  "keep",
  "add",
  "remove",
  "swap",
  "boost",
  "make it",
  "make this",
];

const MODIFIER_SEPARATOR_REGEX =
  /(?:,|;|\band\b|\bplus\b)(?=\s*(?:without|with|no|less|reduced|reduce|lower|lighter|more|extra|higher|high|low|keep|add|remove|swap|boost|make)\b)/gi;

const GENERIC_DISH_TOKENS = new Set([
  "bowl",
  "bread",
  "cake",
  "curry",
  "dessert",
  "dish",
  "don",
  "food",
  "meal",
  "noodle",
  "noodles",
  "plate",
  "rice",
  "salad",
  "sandwich",
  "sauce",
  "soup",
  "stew",
  "style",
  "taco",
  "version",
]);

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function cleanQuery(value: string) {
  return collapseWhitespace(value.replace(/[|]+/g, " ").replace(/\s+/g, " "));
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripFillers(value: string) {
  let cleaned = cleanQuery(value);

  while (LEADING_FILLER_REGEX.test(cleaned) || LEADING_DESCRIPTOR_REGEX.test(cleaned)) {
    cleaned = cleaned.replace(LEADING_FILLER_REGEX, "");
    cleaned = cleaned.replace(LEADING_DESCRIPTOR_REGEX, "");
    cleaned = collapseWhitespace(cleaned);
  }

  cleaned = cleaned.replace(TRAILING_DESCRIPTOR_REGEX, "");
  return collapseWhitespace(cleaned);
}

function findModifierIndex(query: string) {
  const normalized = cleanQuery(query);
  let earliestIndex = -1;
  let matchedStarterLength = -1;

  for (const starter of [...MODIFIER_STARTERS].sort((a, b) => b.length - a.length)) {
    const matcher = new RegExp(`\\b${escapeForRegex(starter)}\\b`, "i");
    const match = matcher.exec(normalized);
    if (match?.index === undefined) {
      continue;
    }

    if (
      earliestIndex === -1 ||
      match.index < earliestIndex ||
      (match.index === earliestIndex && starter.length > matchedStarterLength)
    ) {
      earliestIndex = match.index;
      matchedStarterLength = starter.length;
    }
  }

  return earliestIndex;
}

function splitModifiers(modifierText: string): string[] {
  return modifierText
    .split(MODIFIER_SEPARATOR_REGEX)
    .map((item) =>
      collapseWhitespace(item).replace(/^(?:with|but|plus|and|make it|make this)\s+/i, ""),
    )
    .filter(Boolean);
}

export function normalizeDishText(value: string) {
  return collapseWhitespace(
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " "),
  );
}

export function tokenizeDishText(value: string) {
  return normalizeDishText(value)
    .split(" ")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function meaningfulDishTokens(value: string) {
  const tokens = tokenizeDishText(value).filter((token) => !GENERIC_DISH_TOKENS.has(token));
  return tokens.length > 0 ? tokens : tokenizeDishText(value);
}

export function isGenericDishPhrase(value: string) {
  const tokens = tokenizeDishText(value);
  return tokens.length > 0 && tokens.every((token) => GENERIC_DISH_TOKENS.has(token));
}

export function parseAuthenticDishQuery(query: string): ParsedAuthenticDishQuery {
  const rawQuery = cleanQuery(query);
  const modifierIndex = findModifierIndex(rawQuery);

  const dishSegment = modifierIndex >= 0 ? rawQuery.slice(0, modifierIndex) : rawQuery;
  const modifiersSegment = modifierIndex >= 0 ? rawQuery.slice(modifierIndex) : "";

  const dishName = stripFillers(dishSegment) || stripFillers(rawQuery);
  const modifiers = modifiersSegment ? splitModifiers(modifiersSegment) : [];

  return {
    raw_query: rawQuery,
    dish_name: dishName,
    modifiers,
  };
}
