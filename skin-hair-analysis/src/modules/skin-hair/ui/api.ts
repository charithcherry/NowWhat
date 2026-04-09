import type {
  AnalysisPayload,
  CreateLovedProductPayload,
  LovedProductPayload,
  ProfilePayload,
  RecommendationPayload,
  SummaryPayload,
  WellnessInsightPayload,
} from "./types";

async function safeJson<T>(response: Response): Promise<T> {
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error || "Request failed");
  }

  return body as T;
}

export async function fetchProfile(_userId: string): Promise<ProfilePayload | null> {
  const response = await fetch("/api/skin-hair/profile", {
    cache: "no-store",
  });

  const body = await safeJson<{ profile: ProfilePayload | null }>(response);
  return body.profile;
}

export async function saveProfile(profile: ProfilePayload): Promise<ProfilePayload> {
  const { user_id: _userId, ...profilePayload } = profile;
  const response = await fetch("/api/skin-hair/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profilePayload),
  });

  const body = await safeJson<{ profile: ProfilePayload }>(response);
  return body.profile;
}

export async function fetchSummary(_userId: string): Promise<SummaryPayload> {
  const response = await fetch("/api/skin-hair/summary", {
    cache: "no-store",
  });
  const body = await safeJson<{ summary: SummaryPayload }>(response);
  return body.summary;
}

export async function fetchLovedProducts(_userId: string): Promise<LovedProductPayload[]> {
  const response = await fetch("/api/skin-hair/loved-products", {
    cache: "no-store",
  });
  const body = await safeJson<{ products: LovedProductPayload[] }>(response);
  return body.products;
}

export async function createLovedProduct(product: CreateLovedProductPayload): Promise<LovedProductPayload> {
  const { user_id: _userId, ...productPayload } = product;
  const response = await fetch("/api/skin-hair/loved-products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(productPayload),
  });

  const body = await safeJson<{ product: LovedProductPayload }>(response);
  return body.product;
}

export async function removeLovedProduct(_userId: string, productId: string): Promise<void> {
  const response = await fetch(`/api/skin-hair/loved-products/${encodeURIComponent(productId)}`, {
    method: "DELETE",
  });

  await safeJson<{ success: boolean }>(response);
}

export async function updateLovedProduct(
  productId: string,
  patch: Partial<CreateLovedProductPayload> & { user_id: string },
): Promise<LovedProductPayload> {
  const { user_id: _userId, ...patchPayload } = patch;
  const response = await fetch(`/api/skin-hair/loved-products/${encodeURIComponent(productId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patchPayload),
  });

  const body = await safeJson<{ product: LovedProductPayload }>(response);
  return body.product;
}

export async function analyzeImage(params: {
  userId: string;
  target: "skin" | "hair";
  file: File;
}): Promise<AnalysisPayload> {
  const formData = new FormData();
  formData.append("target", params.target);
  formData.append("image", params.file);

  const response = await fetch("/api/skin-hair/analyze", {
    method: "POST",
    body: formData,
  });

  const body = await safeJson<{ analysis: AnalysisPayload }>(response);
  return body.analysis;
}

export async function fetchRecommendations(_userId: string): Promise<RecommendationPayload[]> {
  const response = await fetch("/api/skin-hair/recommendations", {
    cache: "no-store",
  });

  const body = await safeJson<{ recommendations: RecommendationPayload[] }>(response);
  return body.recommendations;
}

export async function generateRecommendations(_userId: string): Promise<RecommendationPayload[]> {
  const response = await fetch("/api/skin-hair/recommendations/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const body = await safeJson<{ recommendations: RecommendationPayload[] }>(response);
  return body.recommendations;
}

export async function fetchWellnessInsights(_userId: string): Promise<WellnessInsightPayload[]> {
  const response = await fetch("/api/skin-hair/wellness-insights", {
    cache: "no-store",
  });

  const body = await safeJson<{ insights: WellnessInsightPayload[] }>(response);
  return body.insights;
}

export async function generateWellnessInsights(_userId: string): Promise<WellnessInsightPayload[]> {
  const response = await fetch("/api/skin-hair/wellness-insights/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const body = await safeJson<{ insights: WellnessInsightPayload[] }>(response);
  return body.insights;
}
