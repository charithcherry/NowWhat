import { CACHED_AUTHENTIC_DISH_LIBRARY } from "../data/authenticDishLibraryCache";
import { MOCK_AUTHENTIC_BASELINES } from "../data/mockAuthenticDishes";
import {
  listCachedAuthenticDishBaselines,
  upsertCachedAuthenticDishBaseline,
} from "../repositories";
import type {
  AuthenticBaseline,
  AuthenticDishLibraryEntry,
  AuthenticDishMatchCandidate,
  AuthenticDishMatchSource,
  AuthenticDishProviderName,
  AuthenticDishResolution,
  CachedAuthenticDishLibraryEntry,
  ConfidenceLevel,
  ParsedAuthenticDishQuery,
} from "../types";
import {
  enrichAuthenticDishEntry,
  fetchDbpediaAuthenticDishEntries,
  fetchWikidataAuthenticDishEntries,
  getEnabledAuthenticEnrichmentProviders,
  getEnabledAuthenticLookupProviders,
} from "./externalProviders";
import { isGenericDishPhrase, meaningfulDishTokens, normalizeDishText, parseAuthenticDishQuery, tokenizeDishText } from "./queryParser";

export interface AuthenticDishSearchResult {
  parsed_query: ParsedAuthenticDishQuery;
  resolution: AuthenticDishResolution;
}

export interface AuthenticDishSource {
  search(query: string, cuisine?: string): Promise<AuthenticDishSearchResult>;
}

interface ScoredDishCandidate {
  entry: AuthenticDishLibraryEntry;
  score: number;
  confidence: ConfidenceLevel;
  matched_alias?: string;
}

function toBaseline(entry: AuthenticDishLibraryEntry): AuthenticBaseline {
  return {
    dish_name: entry.canonical_name,
    aliases: entry.aliases,
    cuisine: entry.cuisine,
    traditional_summary: entry.traditional_summary,
    core_ingredients: entry.core_ingredients,
    baseline_steps: entry.baseline_steps,
    source_reference: entry.source_label,
    source_url: entry.source_url,
    source_provider: entry.source_provider || "cached_library",
  };
}

function fromMockBaseline(baseline: AuthenticBaseline): AuthenticDishLibraryEntry {
  return {
    canonical_name: baseline.dish_name,
    aliases: baseline.aliases || [],
    cuisine: baseline.cuisine,
    traditional_summary: baseline.traditional_summary,
    core_ingredients: baseline.core_ingredients,
    baseline_steps: baseline.baseline_steps,
    source_label: baseline.source_reference,
    source_url: baseline.source_url,
    source_provider: "dev_mock_fallback",
  };
}

function toLibraryEntry(entry: CachedAuthenticDishLibraryEntry): AuthenticDishLibraryEntry {
  return {
    canonical_name: entry.canonical_name,
    aliases: entry.aliases,
    cuisine: entry.cuisine,
    traditional_summary: entry.traditional_summary,
    core_ingredients: entry.core_ingredients,
    baseline_steps: entry.baseline_steps,
    source_label: entry.source_label,
    source_url: entry.source_url,
    source_provider: entry.source_provider,
    external_id: entry.external_id,
    nutrition_notes: entry.nutrition_notes,
  };
}

function withProviders(resolution: AuthenticDishResolution, providersChecked: AuthenticDishProviderName[]) {
  return {
    ...resolution,
    providers_checked: providersChecked,
  };
}

function uniqueList(values: Array<string | undefined>) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function dedupeEntries(entries: AuthenticDishLibraryEntry[]) {
  const merged = new Map<string, AuthenticDishLibraryEntry>();

  for (const entry of entries) {
    const key = `${normalizeDishText(entry.canonical_name)}::${normalizeDishText(entry.cuisine)}`;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...entry,
        aliases: uniqueList(entry.aliases),
        core_ingredients: uniqueList(entry.core_ingredients),
        baseline_steps: uniqueList(entry.baseline_steps),
        nutrition_notes: uniqueList(entry.nutrition_notes || []),
      });
      continue;
    }

    merged.set(key, {
      ...existing,
      traditional_summary:
        existing.traditional_summary.length >= entry.traditional_summary.length
          ? existing.traditional_summary
          : entry.traditional_summary,
      aliases: uniqueList([...existing.aliases, ...entry.aliases]),
      core_ingredients: uniqueList([...existing.core_ingredients, ...entry.core_ingredients]),
      baseline_steps: uniqueList([...existing.baseline_steps, ...entry.baseline_steps]),
      nutrition_notes: uniqueList([...(existing.nutrition_notes || []), ...(entry.nutrition_notes || [])]),
      source_url: existing.source_url || entry.source_url,
      external_id: existing.external_id || entry.external_id,
    });
  }

  return Array.from(merged.values());
}

function overlapRatio(queryTokens: string[], candidateTokens: string[]) {
  if (queryTokens.length === 0 || candidateTokens.length === 0) {
    return 0;
  }

  const candidateSet = new Set(candidateTokens);
  const matches = queryTokens.filter((token) => candidateSet.has(token));
  return matches.length / queryTokens.length;
}

function phraseContained(haystack: string, phrase: string) {
  const normalizedHaystack = normalizeDishText(haystack);
  const normalizedPhrase = normalizeDishText(phrase);
  return Boolean(normalizedPhrase) && normalizedHaystack.includes(normalizedPhrase);
}

function scoreIngredientTieBreaker(query: string, ingredients: string[]) {
  const queryTokens = new Set(tokenizeDishText(query));
  let score = 0;

  for (const ingredient of ingredients) {
    const tokens = meaningfulDishTokens(ingredient);
    if (tokens.length === 0) {
      continue;
    }

    const matched = tokens.filter((token) => queryTokens.has(token));

    if (tokens.length > 1 && matched.length === tokens.length) {
      score += 1;
    } else if (tokens.length === 1 && matched.length === 1 && tokens[0].length > 4) {
      score += 0.5;
    }
  }

  return Math.min(score, 2);
}

function buildCandidate(entry: AuthenticDishLibraryEntry, parsed: ParsedAuthenticDishQuery, cuisine?: string): ScoredDishCandidate {
  const queryName = normalizeDishText(parsed.dish_name);
  const queryTokens = meaningfulDishTokens(parsed.dish_name);
  const canonicalName = normalizeDishText(entry.canonical_name);
  const canonicalTokens = meaningfulDishTokens(entry.canonical_name);
  const aliasNames = entry.aliases.map((alias) => normalizeDishText(alias));
  const requestedCuisine = normalizeDishText(cuisine || "");
  const entryCuisine = normalizeDishText(entry.cuisine);
  const rawQuery = parsed.raw_query;

  let score = 0;
  let matchedAlias: string | undefined;

  if (!queryName) {
    return {
      entry,
      score,
      confidence: "low",
    };
  }

  if (queryName === canonicalName) {
    score += 100;
  } else {
    const aliasExactIndex = aliasNames.findIndex((alias) => alias === queryName);
    if (aliasExactIndex >= 0) {
      matchedAlias = entry.aliases[aliasExactIndex];
      const aliasTokenCount = meaningfulDishTokens(entry.aliases[aliasExactIndex]).length;
      score += aliasTokenCount <= 1 ? 82 : 97;
    }
  }

  if (score < 95) {
    if (
      !isGenericDishPhrase(entry.canonical_name) &&
      (phraseContained(entry.canonical_name, queryName) || phraseContained(parsed.dish_name, entry.canonical_name))
    ) {
      score = Math.max(score, 84);
    }

    const aliasPartial = entry.aliases.find(
      (alias) =>
        !isGenericDishPhrase(alias) && (phraseContained(alias, queryName) || phraseContained(parsed.dish_name, alias)),
    );
    if (aliasPartial) {
      matchedAlias = matchedAlias || aliasPartial;
      score = Math.max(score, 80);
    }

    const canonicalCoverage = overlapRatio(queryTokens, canonicalTokens);
    if (queryTokens.length >= 2) {
      if (canonicalCoverage === 1) {
        score = Math.max(score, 78);
      } else if (canonicalCoverage >= 0.75) {
        score = Math.max(score, 66);
      } else if (canonicalCoverage >= 0.5) {
        score = Math.max(score, 52);
      }
    }

    for (const alias of entry.aliases) {
      const aliasCoverage = overlapRatio(queryTokens, meaningfulDishTokens(alias));
      if (queryTokens.length >= 2) {
        if (aliasCoverage === 1) {
          matchedAlias = matchedAlias || alias;
          score = Math.max(score, 74);
        } else if (aliasCoverage >= 0.75) {
          matchedAlias = matchedAlias || alias;
          score = Math.max(score, 62);
        }
      }
    }
  }

  if (requestedCuisine) {
    if (requestedCuisine === entryCuisine) {
      score += 12;
    } else {
      score -= 4;
    }
  } else if (phraseContained(rawQuery, entry.cuisine)) {
    score += 6;
  }

  score += scoreIngredientTieBreaker(rawQuery, entry.core_ingredients);

  if (queryTokens.length <= 1 && score < 90) {
    score -= 18;
  }

  let confidence: ConfidenceLevel = "low";
  if (score >= 92) {
    confidence = "high";
  } else if (score >= 72) {
    confidence = "medium";
  }

  return {
    entry,
    score,
    confidence,
    matched_alias: matchedAlias,
  };
}

function toMatchCandidate(candidate: ScoredDishCandidate): AuthenticDishMatchCandidate {
  return {
    dish_name: candidate.entry.canonical_name,
    cuisine: candidate.entry.cuisine,
    matched_alias: candidate.matched_alias,
    confidence: candidate.confidence,
    score: candidate.score,
  };
}

function buildClarificationMessage(parsed: ParsedAuthenticDishQuery, suggestions: AuthenticDishMatchCandidate[]) {
  if (suggestions.length === 0) {
    return `I could not confidently recognize "${parsed.dish_name || parsed.raw_query}" from the available dish sources. Please clarify the dish name or cuisine.`;
  }

  const suggestionText = suggestions
    .slice(0, 3)
    .map((item) => `${item.dish_name} (${item.cuisine})`)
    .join(", ");

  return `I could not confidently resolve "${parsed.dish_name || parsed.raw_query}". Please clarify the dish name. Closest matches: ${suggestionText}.`;
}

function resolveFromEntries(
  entries: AuthenticDishLibraryEntry[],
  parsed: ParsedAuthenticDishQuery,
  defaultMatchSource: AuthenticDishMatchSource,
  cuisine?: string,
): AuthenticDishResolution {
  const scored = dedupeEntries(entries)
    .map((entry) => buildCandidate(entry, parsed, cuisine))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  const suggestions = scored.filter((candidate) => candidate.score >= 20).slice(0, 3).map(toMatchCandidate);
  const top = scored[0];
  const second = scored[1];
  const ambiguous = Boolean(top && second && top.score < 90 && top.score - second.score < 6);
  const shortQueryNeedsClarification = meaningfulDishTokens(parsed.dish_name).length <= 1 && (!top || top.score < 90);
  const needsClarification = !top || top.confidence === "low" || ambiguous || shortQueryNeedsClarification;

  if (needsClarification) {
    return {
      baseline: null,
      confidence: top?.confidence || "low",
      score: top?.score || 0,
      matched_alias: top?.matched_alias,
      match_source: (top?.entry.source_provider as AuthenticDishMatchSource | undefined) || (suggestions.length > 0 ? defaultMatchSource : "none"),
      needs_clarification: true,
      clarification_message: buildClarificationMessage(parsed, suggestions),
      suggestions,
    };
  }

  return {
    baseline: toBaseline(top.entry),
    confidence: top.confidence,
    score: top.score,
    matched_alias: top.matched_alias,
    match_source: (top.entry.source_provider as AuthenticDishMatchSource | undefined) || defaultMatchSource,
    needs_clarification: false,
    suggestions,
  };
}

export class CachedAuthenticDishSource implements AuthenticDishSource {
  async search(query: string, cuisine?: string): Promise<AuthenticDishSearchResult> {
    const parsedQuery = parseAuthenticDishQuery(query);

    return {
      parsed_query: parsedQuery,
      resolution: withProviders(
        resolveFromEntries(
          CACHED_AUTHENTIC_DISH_LIBRARY.map((entry) => ({
            ...entry,
            source_provider: entry.source_provider || "cached_library",
          })),
          parsedQuery,
          "cached_library",
          cuisine,
        ),
        ["cached_library"],
      ),
    };
  }
}

export class PersistedAuthenticDishCacheSource implements AuthenticDishSource {
  async search(query: string, cuisine?: string): Promise<AuthenticDishSearchResult> {
    const parsedQuery = parseAuthenticDishQuery(query);

    try {
      const cachedEntries = (await listCachedAuthenticDishBaselines()).map(toLibraryEntry);
      return {
        parsed_query: parsedQuery,
        resolution: withProviders(resolveFromEntries(cachedEntries, parsedQuery, "external_cache", cuisine), ["external_cache"]),
      };
    } catch (error) {
      console.warn("External authentic baseline cache lookup failed:", error);
      return {
        parsed_query: parsedQuery,
        resolution: withProviders(
          {
            baseline: null,
            confidence: "low",
            score: 0,
            match_source: "none",
            needs_clarification: true,
            clarification_message: `I could not confidently recognize "${parsedQuery.dish_name || parsedQuery.raw_query}" from the available dish sources. Please clarify the dish name or cuisine.`,
            suggestions: [],
          },
          ["external_cache"],
        ),
      };
    }
  }
}

export class MockAuthenticDishSource implements AuthenticDishSource {
  async search(query: string, cuisine?: string): Promise<AuthenticDishSearchResult> {
    const parsedQuery = parseAuthenticDishQuery(query);
    const mockEntries = MOCK_AUTHENTIC_BASELINES.map(fromMockBaseline);

    return {
      parsed_query: parsedQuery,
      resolution: withProviders(resolveFromEntries(mockEntries, parsedQuery, "dev_mock_fallback", cuisine), ["dev_mock_fallback"]),
    };
  }
}

export class OnlineAuthenticDishSource implements AuthenticDishSource {
  async search(query: string, cuisine?: string): Promise<AuthenticDishSearchResult> {
    const parsedQuery = parseAuthenticDishQuery(query);
    const providersChecked = getEnabledAuthenticLookupProviders();
    const [wikidataEntries, dbpediaEntries] = await Promise.all([
      fetchWikidataAuthenticDishEntries(parsedQuery, cuisine),
      fetchDbpediaAuthenticDishEntries(parsedQuery, cuisine),
    ]);

    const onlineEntries = [...wikidataEntries, ...dbpediaEntries];
    const resolution = withProviders(resolveFromEntries(onlineEntries, parsedQuery, "wikidata", cuisine), providersChecked);

    if (resolution.needs_clarification || !resolution.baseline) {
      return {
        parsed_query: parsedQuery,
        resolution,
      };
    }

    const matchedEntry =
      onlineEntries.find(
        (entry) =>
          normalizeDishText(entry.canonical_name) === normalizeDishText(resolution.baseline?.dish_name || "") &&
          (entry.source_provider as AuthenticDishMatchSource | undefined) === resolution.match_source,
      ) || onlineEntries[0];

    const enriched = await enrichAuthenticDishEntry(matchedEntry);
    const enrichedProvidersChecked = Array.from(
      new Set<AuthenticDishProviderName>([...providersChecked, ...getEnabledAuthenticEnrichmentProviders()]),
    );

    try {
      await upsertCachedAuthenticDishBaseline({
        ...enriched,
        source_provider: "external_cache",
        source_label: `Cached external baseline via ${matchedEntry.source_provider || resolution.match_source}: ${enriched.source_label}`,
      });
    } catch (error) {
      console.warn("Failed to persist external authentic dish baseline cache entry:", error);
    }

    return {
      parsed_query: parsedQuery,
      resolution: {
        ...resolution,
        baseline: toBaseline(enriched),
        providers_checked: enrichedProvidersChecked,
      },
    };
  }
}

export class ScraperReadyAuthenticSource implements AuthenticDishSource {
  constructor(
    private readonly cachedSource: AuthenticDishSource = new CachedAuthenticDishSource(),
    private readonly externalCacheSource: AuthenticDishSource = new PersistedAuthenticDishCacheSource(),
    private readonly onlineSource: AuthenticDishSource = new OnlineAuthenticDishSource(),
    private readonly devFallback: AuthenticDishSource = new MockAuthenticDishSource(),
  ) {}

  async search(query: string, cuisine?: string): Promise<AuthenticDishSearchResult> {
    const cachedResult = await this.cachedSource.search(query, cuisine);
    if (!cachedResult.resolution.needs_clarification) {
      return cachedResult;
    }

    const externalCacheResult = await this.externalCacheSource.search(query, cuisine);
    if (!externalCacheResult.resolution.needs_clarification) {
      return externalCacheResult;
    }

    const onlineResult = await this.onlineSource.search(query, cuisine);
    if (!onlineResult.resolution.needs_clarification) {
      return onlineResult;
    }

    const allowMockFallback = process.env.NODE_ENV !== "production" && process.env.ALLOW_MOCK_AUTHENTIC_DISH_FALLBACK === "true";
    if (!allowMockFallback) {
      return onlineResult;
    }

    const fallbackResult = await this.devFallback.search(query, cuisine);
    if (!fallbackResult.resolution.needs_clarification) {
      return fallbackResult;
    }

    return onlineResult;
  }
}
