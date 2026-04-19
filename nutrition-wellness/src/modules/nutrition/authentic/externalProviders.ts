import type {
  AuthenticDishLibraryEntry,
  AuthenticDishProviderName,
  ParsedAuthenticDishQuery,
} from "../types";
import { sanitizeAuthenticIngredients } from "./entryQuality";
import { isGenericDishPhrase, normalizeDishText } from "./queryParser";

const DEFAULT_TIMEOUT_MS = 4500;
const FOODISH_TERMS = [
  "beverage",
  "bread",
  "cuisine",
  "curry",
  "dessert",
  "dish",
  "drink",
  "dumpling",
  "food",
  "meal",
  "noodle",
  "pancake",
  "pastry",
  "rice",
  "salad",
  "sandwich",
  "sauce",
  "snack",
  "soup",
  "stew",
];

const CUISINE_PATTERNS: Array<{ pattern: RegExp; cuisine: string }> = [
  { pattern: /\bthai|thailand\b/i, cuisine: "Thai" },
  { pattern: /\bindia|indian|punjabi|karnataka|kerala|andhra|tamil|south indian|north indian\b/i, cuisine: "Indian" },
  { pattern: /\bmexican|mexico\b/i, cuisine: "Mexican" },
  { pattern: /\bjapan|japanese\b/i, cuisine: "Japanese" },
  { pattern: /\bkorea|korean\b/i, cuisine: "Korean" },
  { pattern: /\bvietnam|vietnamese\b/i, cuisine: "Vietnamese" },
  { pattern: /\bmiddle eastern|levant|north african|maghrebi\b/i, cuisine: "Middle Eastern" },
  { pattern: /\bitalian|italy\b/i, cuisine: "Italian" },
  { pattern: /\bchinese|china\b/i, cuisine: "Chinese" },
  { pattern: /\blao|laotian|laos\b/i, cuisine: "Laotian" },
  { pattern: /\bcambodian|cambodia\b/i, cuisine: "Cambodian" },
  { pattern: /\bindonesian|indonesia\b/i, cuisine: "Indonesian" },
  { pattern: /\bmalaysian|malaysia\b/i, cuisine: "Malaysian" },
  { pattern: /\bfilipino|philippines\b/i, cuisine: "Filipino" },
  { pattern: /\bspanish|spain\b/i, cuisine: "Spanish" },
  { pattern: /\bfrench|france\b/i, cuisine: "French" },
  { pattern: /\bgreek|greece\b/i, cuisine: "Greek" },
  { pattern: /\bturkish|turkey\b/i, cuisine: "Turkish" },
];

type FetchJsonOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
};

function isEnabled(envValue: string | undefined, defaultValue = true) {
  if (envValue === undefined) {
    return defaultValue;
  }

  return envValue.toLowerCase() !== "false";
}

function getLookupTimeoutMs() {
  const raw = Number(process.env.AUTHENTIC_LOOKUP_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw >= 1000) {
    return raw;
  }

  return DEFAULT_TIMEOUT_MS;
}

export function getEnabledAuthenticLookupProviders(): AuthenticDishProviderName[] {
  const providers: AuthenticDishProviderName[] = [];

  if (isEnabled(process.env.ENABLE_WIKIDATA_AUTHENTIC_LOOKUP, true)) {
    providers.push("wikidata");
  }

  if (isEnabled(process.env.ENABLE_DBPEDIA_AUTHENTIC_LOOKUP, true)) {
    providers.push("dbpedia");
  }

  return providers;
}

export function getEnabledAuthenticEnrichmentProviders(): AuthenticDishProviderName[] {
  const providers: AuthenticDishProviderName[] = [];

  if (isEnabled(process.env.ENABLE_USDA_AUTHENTIC_ENRICHMENT, true)) {
    providers.push("usda_fooddata_central");
  }

  if (isEnabled(process.env.ENABLE_OPENFOODFACTS_AUTHENTIC_ENRICHMENT, true)) {
    providers.push("open_food_facts");
  }

  return providers;
}

interface WikidataSearchResponse {
  search?: Array<{
    id?: string;
    label?: string;
    description?: string;
  }>;
}

interface WikidataEntityResponse {
  entities?: Record<
    string,
    {
      id?: string;
      labels?: Record<string, { value?: string }>;
      descriptions?: Record<string, { value?: string }>;
      aliases?: Record<string, Array<{ value?: string }>>;
      sitelinks?: Record<string, { title?: string }>;
    }
  >;
}

interface DBpediaLookupResponse {
  docs?: Array<{
    label?: string[];
    comment?: string[];
    redirectlabel?: string[];
    resource?: string[];
    id?: string[];
    typeName?: string[];
    type?: string[];
    category?: string[];
  }>;
}

interface UsdaSearchResponse {
  foods?: Array<{
    fdcId?: number;
    description?: string;
    ingredients?: string;
    brandName?: string;
    brandOwner?: string;
    foodNutrients?: Array<{
      nutrientName?: string;
      value?: number;
      unitName?: string;
    }>;
  }>;
}

interface OpenFoodFactsSearchResponse {
  products?: Array<{
    product_name?: string;
    product_name_en?: string;
    ingredients_text?: string;
    ingredients_text_en?: string;
    categories_tags_en?: string[];
    nutriments?: {
      proteins_100g?: number;
      energy_kcal_100g?: number;
    };
    url?: string;
  }>;
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((value) => collapseWhitespace(String(value || ""))).filter(Boolean)));
}

function stripHtml(value: string) {
  return collapseWhitespace(
    value
      .replace(/<[^>]+>/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">"),
  );
}

function looksFoodish(text: string) {
  const haystack = normalizeDishText(text);
  return FOODISH_TERMS.some((term) => haystack.includes(normalizeDishText(term)));
}

function deriveCuisine(parts: Array<string | undefined>, fallbackCuisine?: string) {
  const haystack = parts.filter(Boolean).join(" ");

  for (const candidate of CUISINE_PATTERNS) {
    if (candidate.pattern.test(haystack)) {
      return candidate.cuisine;
    }
  }

  return fallbackCuisine || "Global";
}

function buildBaselineSteps(summary: string, ingredients: string[]) {
  const summaryNorm = normalizeDishText(summary);

  if (summaryNorm.includes("stir fried")) {
    return [
      "Prepare the core ingredients and sauce components for the dish.",
      "Cook the base ingredients over high heat using the traditional stir-fry approach.",
      "Finish with the characteristic garnishes and serve immediately.",
    ];
  }

  if (summaryNorm.includes("dessert") || summaryNorm.includes("sweet")) {
    return [
      "Prepare the starch or primary base ingredient until tender.",
      "Combine with the sweet or creamy components that define the dish.",
      "Finish with the characteristic topping or garnish before serving.",
    ];
  }

  if (summaryNorm.includes("soup") || summaryNorm.includes("stew") || summaryNorm.includes("broth")) {
    return [
      "Prepare the aromatic base and core ingredients for the pot.",
      "Simmer until the flavors meld and the main ingredients are fully cooked.",
      "Finish with the traditional garnish or final seasoning and serve hot.",
    ];
  }

  if (ingredients.length > 0) {
    return [
      `Prepare the core ingredients, including ${ingredients.slice(0, 3).join(", ")}.`,
      "Cook or assemble using the traditional technique suggested by the source description.",
      "Finish with the characteristic seasoning or garnish and serve in the customary style.",
    ];
  }

  return [
    "Prepare the dish's primary ingredients and supporting aromatics.",
    "Cook or assemble using the traditional method suggested by the source summary.",
    "Finish with the characteristic seasoning, garnish, or serving style.",
  ];
}

async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || getLookupTimeoutMs());

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "NowWhat-NutritionWellness/1.0 (+https://localhost)",
        ...options.headers,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function ingredientNotesFromUsda(foods: NonNullable<UsdaSearchResponse["foods"]>) {
  const notes: string[] = [];

  for (const food of foods.slice(0, 2)) {
    const protein = food.foodNutrients?.find((item) => normalizeDishText(item.nutrientName || "") === "protein");
    if (protein?.value !== undefined) {
      notes.push(
        `USDA match: ${food.description || "food"} reports ${protein.value}${protein.unitName || ""} protein per listed serving.`,
      );
    }
  }

  return notes;
}

function ingredientNotesFromOpenFoodFacts(products: NonNullable<OpenFoodFactsSearchResponse["products"]>) {
  const notes: string[] = [];

  for (const product of products.slice(0, 2)) {
    if (product.nutriments?.proteins_100g !== undefined) {
      notes.push(
        `Open Food Facts match: ${product.product_name || product.product_name_en || "product"} reports ${product.nutriments.proteins_100g}g protein per 100g.`,
      );
    }
  }

  return notes;
}

async function enrichWithUsda(entry: AuthenticDishLibraryEntry): Promise<Partial<AuthenticDishLibraryEntry>> {
  if (!getEnabledAuthenticEnrichmentProviders().includes("usda_fooddata_central")) {
    return {};
  }

  const apiKey = process.env.USDA_FOODDATA_API_KEY || "DEMO_KEY";
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(entry.canonical_name)}&pageSize=5&api_key=${encodeURIComponent(apiKey)}`;

  try {
    const body = await fetchJson<UsdaSearchResponse>(url, { timeoutMs: 3500 });
    const foods = body.foods || [];

    return {
      nutrition_notes: ingredientNotesFromUsda(foods),
    };
  } catch (error) {
    console.warn("USDA enrichment failed:", error);
    return {};
  }
}

async function enrichWithOpenFoodFacts(entry: AuthenticDishLibraryEntry): Promise<Partial<AuthenticDishLibraryEntry>> {
  if (!getEnabledAuthenticEnrichmentProviders().includes("open_food_facts")) {
    return {};
  }

  const url =
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(entry.canonical_name)}` +
    "&search_simple=1&action=process&json=1&page_size=5&fields=product_name,product_name_en,ingredients_text,ingredients_text_en,categories_tags_en,nutriments,url";

  try {
    const body = await fetchJson<OpenFoodFactsSearchResponse>(url, { timeoutMs: 3500 });
    const products = body.products || [];

    return {
      nutrition_notes: ingredientNotesFromOpenFoodFacts(products),
    };
  } catch (error) {
    console.warn("Open Food Facts enrichment failed:", error);
    return {};
  }
}

export async function enrichAuthenticDishEntry(entry: AuthenticDishLibraryEntry): Promise<AuthenticDishLibraryEntry> {
  const [usda, off] = await Promise.all([enrichWithUsda(entry), enrichWithOpenFoodFacts(entry)]);
  const nutritionNotes = uniqueStrings([...(entry.nutrition_notes || []), ...(usda.nutrition_notes || []), ...(off.nutrition_notes || [])]).slice(0, 6);

  return {
    ...entry,
    core_ingredients: sanitizeAuthenticIngredients(entry.core_ingredients || []),
    baseline_steps:
      entry.baseline_steps.length > 0
        ? entry.baseline_steps
        : buildBaselineSteps(entry.traditional_summary, sanitizeAuthenticIngredients(entry.core_ingredients || [])),
    nutrition_notes: nutritionNotes,
  };
}

function matchesParsedDish(label: string, parsedQuery: ParsedAuthenticDishQuery) {
  const labelNorm = normalizeDishText(label);
  const dishNorm = normalizeDishText(parsedQuery.dish_name);

  if (!labelNorm || !dishNorm) {
    return false;
  }

  if (isGenericDishPhrase(label) && labelNorm !== dishNorm) {
    return false;
  }

  return labelNorm.includes(dishNorm) || dishNorm.includes(labelNorm) || looksFoodish(label);
}

export async function fetchWikidataAuthenticDishEntries(
  parsedQuery: ParsedAuthenticDishQuery,
  cuisine?: string,
): Promise<AuthenticDishLibraryEntry[]> {
  if (!getEnabledAuthenticLookupProviders().includes("wikidata") || !parsedQuery.dish_name.trim()) {
    return [];
  }

  const searchUrl =
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(parsedQuery.dish_name)}` +
    "&language=en&limit=5&format=json&type=item";

  try {
    const searchResponse = await fetchJson<WikidataSearchResponse>(searchUrl);
    const entityIds = uniqueStrings(
      (searchResponse.search || [])
        .filter((item) => matchesParsedDish(item.label || "", parsedQuery))
        .filter((item) => looksFoodish(`${item.label || ""} ${item.description || ""}`))
        .map((item) => item.id || ""),
    );

    if (entityIds.length === 0) {
      return [];
    }

    const entityUrl =
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(entityIds.join("|"))}` +
      "&props=labels|descriptions|aliases|sitelinks&languages=en&format=json";

    const entities = await fetchJson<WikidataEntityResponse>(entityUrl);

    return entityIds
      .map((id) => entities.entities?.[id])
      .filter(Boolean)
      .map((entity) => {
        const label = collapseWhitespace(entity?.labels?.en?.value || "");
        const summary = collapseWhitespace(entity?.descriptions?.en?.value || "");
        const aliases = uniqueStrings([
          ...(entity?.aliases?.en?.map((item) => item.value || "") || []),
          ...(Object.values(entity?.sitelinks || {})
            .map((item) => item.title || "")
            .filter((title) => title && title !== label) || []),
        ]).slice(0, 10);

        const sourceUrl = entity?.id ? `https://www.wikidata.org/wiki/${entity.id}` : undefined;
        const cuisineGuess = deriveCuisine([summary, ...aliases], cuisine);
        const baselineSteps = buildBaselineSteps(summary, []);

        return {
          canonical_name: label,
          aliases,
          cuisine: cuisineGuess,
          traditional_summary: summary || `${label} is a recognized dish in ${cuisineGuess} cuisine.`,
          core_ingredients: [],
          baseline_steps: baselineSteps,
          source_label: `Wikidata entity ${entity?.id || ""}`.trim(),
          source_url: sourceUrl,
          source_provider: "wikidata" as AuthenticDishProviderName,
          external_id: entity?.id,
        } satisfies AuthenticDishLibraryEntry;
      });
  } catch (error) {
    console.warn("Wikidata lookup failed:", error);
    return [];
  }
}

export async function fetchDbpediaAuthenticDishEntries(
  parsedQuery: ParsedAuthenticDishQuery,
  cuisine?: string,
): Promise<AuthenticDishLibraryEntry[]> {
  if (!getEnabledAuthenticLookupProviders().includes("dbpedia") || !parsedQuery.dish_name.trim()) {
    return [];
  }

  const url = `https://lookup.dbpedia.org/api/search?query=${encodeURIComponent(parsedQuery.dish_name)}&format=JSON&maxResults=5`;

  try {
    const response = await fetchJson<DBpediaLookupResponse>(url, {
      headers: { Accept: "application/json" },
    });

    return (response.docs || [])
      .filter((doc) => {
        const label = stripHtml(doc.label?.[0] || "");
        const summary = stripHtml(doc.comment?.[0] || "");
        const typeNames = uniqueStrings([...(doc.typeName || []), ...(doc.type || []).map((item) => item.split("/").pop() || "")]);
        return matchesParsedDish(label, parsedQuery) && (looksFoodish(`${label} ${summary}`) || typeNames.some((item) => looksFoodish(item)));
      })
      .map((doc) => {
        const label = stripHtml(doc.label?.[0] || "");
        const summary = stripHtml(doc.comment?.[0] || "");
        const aliases = uniqueStrings((doc.redirectlabel || []).map((item) => stripHtml(item))).slice(0, 10);
        const categories = (doc.category || []).map((item) => item.split("/").pop()?.replace(/_/g, " ") || "");
        const cuisineGuess = deriveCuisine([summary, ...categories], cuisine);
        return {
          canonical_name: label,
          aliases,
          cuisine: cuisineGuess,
          traditional_summary: summary || `${label} is a recognized dish in ${cuisineGuess} cuisine.`,
          core_ingredients: [],
          baseline_steps: buildBaselineSteps(summary, []),
          source_label: "DBpedia Lookup",
          source_url: doc.resource?.[0] || doc.id?.[0],
          source_provider: "dbpedia" as AuthenticDishProviderName,
          external_id: doc.id?.[0],
        } satisfies AuthenticDishLibraryEntry;
      });
  } catch (error) {
    console.warn("DBpedia lookup failed:", error);
    return [];
  }
}
