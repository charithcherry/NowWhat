// Vision Analysis Service - Using Gemini Vision API without ML models
import { GoogleGenerativeAI } from '@google/generative-ai';

class VisionAnalysisService {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    this.analysisCache = new Map();
    this.promptTemplates = new PromptTemplateManager();
  }

  /**
   * Analyze skin from selfie using Gemini Vision API
   * @param {string} imageBase64 - Base64 encoded image
   * @param {Object} userProfile - User's skin profile for context
   * @returns {Promise<Object>} Skin analysis results
   */
  async analyzeSkinImage(imageBase64, userProfile = {}) {
    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(imageBase64, 'skin');

      // Check cache first
      if (this.analysisCache.has(cacheKey)) {
        console.log('Returning cached skin analysis');
        return this.analysisCache.get(cacheKey);
      }

      // Build comprehensive prompt with user context
      const prompt = this.promptTemplates.buildSkinAnalysisPrompt(userProfile);

      // Prepare image for Gemini
      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType: 'image/jpeg'
        }
      };

      // Send to Gemini Vision API
      const result = await this.model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();

      // Parse JSON response
      const analysis = this.parseSkinAnalysisResponse(text);

      // Validate and enrich analysis
      const validated = this.validateSkinAnalysis(analysis);

      // Cache the result
      this.analysisCache.set(cacheKey, validated);

      return validated;
    } catch (error) {
      console.error('Skin analysis failed:', error);
      throw new Error(`Failed to analyze skin image: ${error.message}`);
    }
  }

  /**
   * Analyze hair and scalp condition
   * @param {string} imageBase64 - Base64 encoded image
   * @param {Object} userProfile - User's hair profile
   * @returns {Promise<Object>} Hair analysis results
   */
  async analyzeHairImage(imageBase64, userProfile = {}) {
    try {
      const cacheKey = this.generateCacheKey(imageBase64, 'hair');

      if (this.analysisCache.has(cacheKey)) {
        console.log('Returning cached hair analysis');
        return this.analysisCache.get(cacheKey);
      }

      const prompt = this.promptTemplates.buildHairAnalysisPrompt(userProfile);

      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType: 'image/jpeg'
        }
      };

      const result = await this.model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();

      const analysis = this.parseHairAnalysisResponse(text);
      const validated = this.validateHairAnalysis(analysis);

      this.analysisCache.set(cacheKey, validated);

      return validated;
    } catch (error) {
      console.error('Hair analysis failed:', error);
      throw new Error(`Failed to analyze hair image: ${error.message}`);
    }
  }

  /**
   * Perform multi-angle analysis for better accuracy
   * @param {Array} images - Array of images from different angles
   * @param {Object} userProfile - User profile
   * @param {string} analysisType - 'skin' or 'hair'
   * @returns {Promise<Object>} Aggregated analysis
   */
  async performMultiAngleAnalysis(images, userProfile, analysisType = 'skin') {
    const analyses = [];

    // Analyze each image
    for (const image of images) {
      const analysis = analysisType === 'skin'
        ? await this.analyzeSkinImage(image.base64, userProfile)
        : await this.analyzeHairImage(image.base64, userProfile);

      analyses.push({
        ...analysis,
        angle: image.angle,
        timestamp: image.timestamp
      });
    }

    // Aggregate results for consistency
    return this.aggregateAnalyses(analyses, analysisType);
  }

  /**
   * Parse skin analysis response from Gemini
   */
  parseSkinAnalysisResponse(responseText) {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Ensure all required fields exist
      return {
        acne: {
          score: parsed.acne?.score || 0,
          lesionCount: parsed.acne?.lesion_count || 0,
          affectedZones: parsed.acne?.affected_zones || [],
          inflammation: parsed.acne?.inflammation || 0,
          type: parsed.acne?.type || 'none'
        },
        darkCircles: {
          score: parsed.dark_circles?.score || 0,
          pigmentation: parsed.dark_circles?.pigmentation || 0,
          puffiness: parsed.dark_circles?.puffiness || 0,
          vascularVisibility: parsed.dark_circles?.vascular_visibility || 0
        },
        texture: {
          oiliness: parsed.texture?.oiliness || 0,
          dryness: parsed.texture?.dryness || 0,
          combinationPattern: parsed.texture?.combination_pattern || 'none',
          poreVisibility: parsed.texture?.pore_visibility || 0
        },
        additional: {
          redness: parsed.additional?.redness || 0,
          hyperpigmentation: parsed.additional?.hyperpigmentation || 0,
          skinToneEvenness: parsed.additional?.skin_tone_evenness || 0,
          observations: parsed.additional?.observations || []
        },
        confidence: parsed.confidence || 0,
        lightingQuality: parsed.lighting_quality || 'unknown',
        imageQuality: parsed.image_quality || 'unknown',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to parse skin analysis response:', error);
      throw new Error('Invalid response format from Gemini');
    }
  }

  /**
   * Parse hair analysis response from Gemini
   */
  parseHairAnalysisResponse(responseText) {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        density: {
          overallScore: parsed.density?.overall_score || 0,
          thinningZones: parsed.density?.thinning_zones || [],
          scalpVisibility: parsed.density?.scalp_visibility || 0,
          patternType: parsed.density?.pattern_type || 'none',
          recessionScore: parsed.density?.recession_score || 0
        },
        scalpHealth: {
          dandruffScore: parsed.scalp_health?.dandruff_score || 0,
          oiliness: parsed.scalp_health?.oiliness || 0,
          dryness: parsed.scalp_health?.dryness || 0,
          inflammation: parsed.scalp_health?.inflammation || 0,
          overallHealth: parsed.scalp_health?.overall_health || 0
        },
        hairQuality: {
          dryness: parsed.hair_quality?.dryness || 0,
          damage: parsed.hair_quality?.damage || 0,
          shine: parsed.hair_quality?.shine || 0,
          textureUniformity: parsed.hair_quality?.texture_uniformity || 0,
          frizz: parsed.hair_quality?.frizz || 0
        },
        nutritionalIndicators: {
          proteinDeficiencyLikelihood: parsed.nutritional_indicators?.protein_deficiency_likelihood || 0,
          ironDeficiencySigns: parsed.nutritional_indicators?.iron_deficiency_signs || 0,
          biotinDeficiencySigns: parsed.nutritional_indicators?.biotin_deficiency_signs || 0,
          overallNutritionConcern: parsed.nutritional_indicators?.overall_nutrition_concern || 0
        },
        confidence: parsed.confidence || 0,
        imageFocus: parsed.image_focus || 'unknown',
        recommendationsPriority: parsed.recommendations_priority || [],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to parse hair analysis response:', error);
      throw new Error('Invalid response format from Gemini');
    }
  }

  /**
   * Validate skin analysis results
   */
  validateSkinAnalysis(analysis) {
    // Ensure scores are within valid range
    const validateScore = (score) => Math.max(0, Math.min(10, score));

    return {
      ...analysis,
      acne: {
        ...analysis.acne,
        score: validateScore(analysis.acne.score),
        inflammation: validateScore(analysis.acne.inflammation)
      },
      darkCircles: {
        ...analysis.darkCircles,
        score: validateScore(analysis.darkCircles.score),
        pigmentation: validateScore(analysis.darkCircles.pigmentation),
        puffiness: validateScore(analysis.darkCircles.puffiness)
      },
      texture: {
        ...analysis.texture,
        oiliness: validateScore(analysis.texture.oiliness),
        dryness: validateScore(analysis.texture.dryness),
        poreVisibility: validateScore(analysis.texture.poreVisibility)
      },
      isValid: true,
      validatedAt: new Date().toISOString()
    };
  }

  /**
   * Validate hair analysis results
   */
  validateHairAnalysis(analysis) {
    const validateScore = (score) => Math.max(0, Math.min(10, score));

    return {
      ...analysis,
      density: {
        ...analysis.density,
        overallScore: validateScore(analysis.density.overallScore),
        scalpVisibility: validateScore(analysis.density.scalpVisibility),
        recessionScore: validateScore(analysis.density.recessionScore)
      },
      scalpHealth: {
        ...analysis.scalpHealth,
        dandruffScore: validateScore(analysis.scalpHealth.dandruffScore),
        oiliness: validateScore(analysis.scalpHealth.oiliness),
        dryness: validateScore(analysis.scalpHealth.dryness),
        inflammation: validateScore(analysis.scalpHealth.inflammation),
        overallHealth: validateScore(analysis.scalpHealth.overallHealth)
      },
      isValid: true,
      validatedAt: new Date().toISOString()
    };
  }

  /**
   * Aggregate multiple analyses for consistency
   */
  aggregateAnalyses(analyses, type) {
    if (analyses.length === 0) {
      throw new Error('No analyses to aggregate');
    }

    if (analyses.length === 1) {
      return analyses[0];
    }

    // Calculate median scores for reliability
    const getMedian = (values) => {
      const sorted = values.sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    if (type === 'skin') {
      return {
        acne: {
          score: getMedian(analyses.map(a => a.acne.score)),
          inflammation: getMedian(analyses.map(a => a.acne.inflammation)),
          affectedZones: [...new Set(analyses.flatMap(a => a.acne.affectedZones))]
        },
        darkCircles: {
          score: getMedian(analyses.map(a => a.darkCircles.score)),
          pigmentation: getMedian(analyses.map(a => a.darkCircles.pigmentation)),
          puffiness: getMedian(analyses.map(a => a.darkCircles.puffiness))
        },
        texture: {
          oiliness: getMedian(analyses.map(a => a.texture.oiliness)),
          dryness: getMedian(analyses.map(a => a.texture.dryness))
        },
        confidence: getMedian(analyses.map(a => a.confidence)),
        aggregatedFrom: analyses.length,
        timestamp: new Date().toISOString()
      };
    } else {
      return {
        density: {
          overallScore: getMedian(analyses.map(a => a.density.overallScore)),
          thinningZones: [...new Set(analyses.flatMap(a => a.density.thinningZones))],
          scalpVisibility: getMedian(analyses.map(a => a.density.scalpVisibility))
        },
        scalpHealth: {
          dandruffScore: getMedian(analyses.map(a => a.scalpHealth.dandruffScore)),
          oiliness: getMedian(analyses.map(a => a.scalpHealth.oiliness)),
          dryness: getMedian(analyses.map(a => a.scalpHealth.dryness))
        },
        hairQuality: {
          dryness: getMedian(analyses.map(a => a.hairQuality.dryness)),
          damage: getMedian(analyses.map(a => a.hairQuality.damage)),
          shine: getMedian(analyses.map(a => a.hairQuality.shine))
        },
        confidence: getMedian(analyses.map(a => a.confidence)),
        aggregatedFrom: analyses.length,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Generate cache key for analysis
   */
  generateCacheKey(imageBase64, type) {
    // Create a simple hash of the image for caching
    const hash = imageBase64.substring(0, 50) + imageBase64.substring(imageBase64.length - 50);
    return `${type}_${hash}`;
  }

  /**
   * Clear cache (useful for memory management)
   */
  clearCache() {
    this.analysisCache.clear();
  }
}

/**
 * Prompt Template Manager
 */
class PromptTemplateManager {
  buildSkinAnalysisPrompt(userProfile) {
    const basePrompt = `
    You are an expert dermatological analyzer. Analyze this facial image for skin conditions.

    ${userProfile.age ? `User Age: ${userProfile.age}` : ''}
    ${userProfile.skinType ? `Known Skin Type: ${userProfile.skinType}` : ''}
    ${userProfile.concerns ? `Current Concerns: ${userProfile.concerns.join(', ')}` : ''}

    Provide a detailed JSON analysis with the following structure:
    {
      "acne": {
        "score": 0-10 (0=clear skin, 10=severe acne),
        "lesion_count": estimated number of visible acne lesions,
        "affected_zones": ["forehead", "cheeks", "chin", "nose"] as applicable,
        "inflammation": 0-10 (inflammation level),
        "type": "none" | "comedonal" | "inflammatory" | "cystic"
      },
      "dark_circles": {
        "score": 0-10 (severity),
        "pigmentation": 0-10 (darkness intensity),
        "puffiness": 0-10 (swelling level),
        "vascular_visibility": 0-10 (visible blood vessels)
      },
      "texture": {
        "oiliness": 0-10 (0=very dry, 10=very oily),
        "dryness": 0-10 (0=well hydrated, 10=very dry),
        "combination_pattern": "none" | "t-zone" | "u-zone" | "full",
        "pore_visibility": 0-10 (enlarged pores)
      },
      "additional": {
        "redness": 0-10 (overall redness/irritation),
        "hyperpigmentation": 0-10 (dark spots/uneven tone),
        "skin_tone_evenness": 0-10 (10=very even),
        "observations": ["specific observations as strings"]
      },
      "confidence": 0-100 (your confidence in this analysis),
      "lighting_quality": "good" | "moderate" | "poor",
      "image_quality": "high" | "medium" | "low"
    }

    Be objective and precise. Base your analysis only on what is clearly visible.
    Return ONLY the JSON object, no additional text.`;

    return basePrompt;
  }

  buildHairAnalysisPrompt(userProfile) {
    const basePrompt = `
    You are an expert trichologist analyzing hair and scalp health. Examine this image carefully.

    ${userProfile.hairType ? `Known Hair Type: ${userProfile.hairType}` : ''}
    ${userProfile.scalpType ? `Scalp Type: ${userProfile.scalpType}` : ''}
    ${userProfile.concerns ? `Current Concerns: ${userProfile.concerns.join(', ')}` : ''}

    Provide a detailed JSON analysis with the following structure:
    {
      "density": {
        "overall_score": 0-10 (10=very thick, 0=severe thinning),
        "thinning_zones": ["crown", "temples", "hairline", "diffuse"] as applicable,
        "scalp_visibility": 0-10 (how visible is the scalp),
        "pattern_type": "none" | "diffuse" | "male_pattern" | "female_pattern",
        "recession_score": 0-10 (hairline recession)
      },
      "scalp_health": {
        "dandruff_score": 0-10 (flaking severity),
        "oiliness": 0-10 (sebum production),
        "dryness": 0-10 (scalp dryness),
        "inflammation": 0-10 (redness/irritation),
        "overall_health": 0-10 (10=very healthy)
      },
      "hair_quality": {
        "dryness": 0-10 (hair shaft dryness),
        "damage": 0-10 (visible damage/breakage),
        "shine": 0-10 (10=very shiny),
        "texture_uniformity": 0-10 (consistency of texture),
        "frizz": 0-10 (frizziness level)
      },
      "nutritional_indicators": {
        "protein_deficiency_likelihood": 0-10,
        "iron_deficiency_signs": 0-10,
        "biotin_deficiency_signs": 0-10,
        "overall_nutrition_concern": 0-10
      },
      "confidence": 0-100 (your confidence in this analysis),
      "image_focus": "good" | "moderate" | "poor",
      "recommendations_priority": ["high priority issues", "medium priority", "low priority"]
    }

    Be objective and base your analysis only on visible indicators.
    Return ONLY the JSON object, no additional text.`;

    return basePrompt;
  }
}

export default VisionAnalysisService;