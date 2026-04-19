import type {
  AuthenticOptimizationResponse,
  GeneratedRecipe,
  NutritionProfile,
  PantryItem,
  PantryMealDraft,
  RecipeLibraryEntry,
  RecipeModification,
  SummaryPayload,
  WellnessMealInsight,
} from "../types";

async function safeJson<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "Request failed");
  }
  return body as T;
}

export async function fetchProfile(_userId: string): Promise<NutritionProfile | null> {
  const response = await fetch("/api/nutrition/profile", { cache: "no-store" });
  const body = await safeJson<{ profile: NutritionProfile | null }>(response);
  return body.profile;
}

export async function saveProfile(profile: Partial<NutritionProfile> & { user_id: string; primary_goal: string }) {
  const { user_id: _userId, ...profilePayload } = profile;
  const response = await fetch("/api/nutrition/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profilePayload),
  });

  const body = await safeJson<{ profile: NutritionProfile }>(response);
  return body.profile;
}

export async function fetchPantryItems(_userId: string): Promise<PantryItem[]> {
  const response = await fetch("/api/nutrition/pantry-items", { cache: "no-store" });
  const body = await safeJson<{ items: PantryItem[] }>(response);
  return body.items;
}

export async function savePantryItems(_userId: string, items: Array<string | { item_name: string; quantity?: number; unit?: string }>) {
  const response = await fetch("/api/nutrition/pantry-items", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });

  const body = await safeJson<{ items: PantryItem[] }>(response);
  return body.items;
}

export async function generatePantryMeals(params: {
  user_id: string;
  pantry_ingredients: string[];
  workout_context?: string;
  max_results?: number;
}) {
  const { user_id: _userId, ...payload } = params;
  const response = await fetch("/api/nutrition/pantry/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await safeJson<{
    meals: PantryMealDraft[];
    generated_with_gemini: boolean;
    model?: string;
  }>(response);

  return body;
}

export async function optimizeAuthenticDish(params: {
  user_id: string;
  query: string;
  cuisine?: string;
  optimization_preferences: string[];
}) {
  const { user_id: _userId, ...payload } = params;
  const response = await fetch("/api/nutrition/authentic/optimize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await safeJson<AuthenticOptimizationResponse>(response);

  return body;
}

export async function createRecipe(payload: Record<string, unknown>) {
  const response = await fetch("/api/nutrition/recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await safeJson<{ recipe: GeneratedRecipe }>(response);
  return body.recipe;
}

export async function saveRecipe(recipeId: string, _userId: string, userNotes?: string) {
  const response = await fetch(`/api/nutrition/recipes/${encodeURIComponent(recipeId)}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_notes: userNotes }),
  });

  return safeJson<{ success: boolean }>(response);
}

export async function unsaveRecipe(recipeId: string, _userId: string) {
  const response = await fetch(`/api/nutrition/recipes/${encodeURIComponent(recipeId)}/save`, {
    method: "DELETE",
  });

  return safeJson<{ success: boolean }>(response);
}

export async function modifyRecipe(recipeId: string, payload: Record<string, unknown>) {
  const response = await fetch(`/api/nutrition/recipes/${encodeURIComponent(recipeId)}/modify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return safeJson<{ modification: RecipeModification; modified_recipe: GeneratedRecipe | null }>(response);
}

export async function fetchRecipeModifications(recipeId: string, _userId: string) {
  const response = await fetch(`/api/nutrition/recipes/${encodeURIComponent(recipeId)}/modify`, {
    cache: "no-store",
  });

  const body = await safeJson<{ modifications: RecipeModification[] }>(response);
  return body.modifications;
}

export async function duplicateRecipe(recipeId: string, _userId: string) {
  const response = await fetch(`/api/nutrition/recipes/${encodeURIComponent(recipeId)}/duplicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const body = await safeJson<{ recipe: GeneratedRecipe }>(response);
  return body.recipe;
}

export async function fetchRecipeLibrary(
  _userId: string,
  filters: {
    search?: string;
    tags?: string[];
    cuisine?: string;
    sourceType?: string;
    proteinFocus?: string;
    dietary?: string;
    onlySaved?: boolean;
  } = {},
): Promise<{ entries: RecipeLibraryEntry[]; seeded: boolean }> {
  const query = new URLSearchParams();

  if (filters.search) query.set("search", filters.search);
  if (filters.tags && filters.tags.length > 0) query.set("tags", filters.tags.join(","));
  if (filters.cuisine) query.set("cuisine", filters.cuisine);
  if (filters.sourceType) query.set("sourceType", filters.sourceType);
  if (filters.proteinFocus) query.set("proteinFocus", filters.proteinFocus);
  if (filters.dietary) query.set("dietary", filters.dietary);
  if (filters.onlySaved === false) query.set("onlySaved", "false");

  const response = await fetch(`/api/nutrition/library?${query.toString()}`, { cache: "no-store" });
  const body = await safeJson<{ entries: RecipeLibraryEntry[]; seeded: boolean }>(response);
  return body;
}

export async function fetchInsights(_userId: string) {
  const response = await fetch("/api/nutrition/insights", { cache: "no-store" });
  const body = await safeJson<{ insights: WellnessMealInsight[]; seeded: boolean }>(response);
  return body;
}

export async function generateInsights(_userId: string) {
  const response = await fetch("/api/nutrition/insights/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const body = await safeJson<{ insights: WellnessMealInsight[] }>(response);
  return body.insights;
}

export async function fetchSummary(_userId: string) {
  const response = await fetch("/api/nutrition/summary", { cache: "no-store" });
  const body = await safeJson<{ summary: SummaryPayload }>(response);
  return body.summary;
}
