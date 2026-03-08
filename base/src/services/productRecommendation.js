// Product Recommendation Engine - Ingredient-Based Matching
import { GoogleGenerativeAI } from '@google/generative-ai';

class ProductRecommendationEngine {
  constructor(apiKey, dbConnection) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    this.db = dbConnection;
    this.ingredientExtractor = new IngredientExtractor(this.model);
    this.synonymMapper = new IngredientSynonymMapper(this.model);
    this.allergyFilter = new AllergyFilter();
    this.productMatcher = new ProductMatcher();
  }

  /**
   * Main recommendation method
   * @param {Object} userProfile - User's complete profile
   * @param {Array} lovedProducts - Array of products user loves
   * @param {Object} skinAnalysis - Recent skin analysis results
   * @returns {Promise<Array>} Ranked product recommendations
   */
  async recommendProducts(userProfile, lovedProducts, skinAnalysis) {
    try {
      // Step 1: Extract ingredient fingerprint from loved products
      console.log('Building ingredient fingerprint from loved products...');
      const ingredientFingerprint = await this.buildIngredientFingerprint(lovedProducts);

      // Step 2: Determine target ingredients based on skin analysis
      console.log('Identifying target ingredients for skin concerns...');
      const targetIngredients = await this.getTargetIngredients(skinAnalysis, userProfile);

      // Step 3: Search product database
      console.log('Searching product database...');
      const candidateProducts = await this.searchProducts(
        ingredientFingerprint,
        targetIngredients,
        userProfile
      );

      // Step 4: Filter out allergens and sensitivities
      console.log('Filtering for allergies and sensitivities...');
      const safeProducts = this.allergyFilter.filterProducts(
        candidateProducts,
        userProfile.skin.allergies,
        userProfile.skin.sensitivities
      );

      // Step 5: Score and rank products
      console.log('Scoring and ranking products...');
      const rankedProducts = await this.scoreAndRankProducts(
        safeProducts,
        ingredientFingerprint,
        targetIngredients,
        userProfile
      );

      // Step 6: Generate explanations for top recommendations
      console.log('Generating recommendation explanations...');
      const topRecommendations = await this.generateExplanations(
        rankedProducts.slice(0, 10),
        userProfile,
        skinAnalysis
      );

      return topRecommendations;
    } catch (error) {
      console.error('Product recommendation failed:', error);
      throw error;
    }
  }

  /**
   * Build ingredient fingerprint from loved products
   */
  async buildIngredientFingerprint(lovedProducts) {
    const fingerprint = {
      keyActives: new Map(),
      beneficialIngredients: new Map(),
      ingredientCombos: [],
      texturePreferences: new Map(),
      concentrationRanges: new Map(),
      avoidList: new Set()
    };

    for (const product of lovedProducts) {
      // Extract ingredients if not already extracted
      if (!product.ingredients?.parsed) {
        product.ingredients = await this.ingredientExtractor.extractFromProduct(product);
      }

      // Track frequency and effectiveness of ingredients
      for (const ingredient of product.ingredients.keyIngredients) {
        const normalized = await this.synonymMapper.normalizeIngredient(ingredient.name);

        // Weight by product rating
        const weight = product.experience?.rating || 3;
        const currentScore = fingerprint.keyActives.get(normalized) || 0;
        fingerprint.keyActives.set(normalized, currentScore + weight);

        // Track beneficial ingredients
        if (product.experience?.effectiveness?.overall >= 7) {
          const benefitScore = fingerprint.beneficialIngredients.get(normalized) || 0;
          fingerprint.beneficialIngredients.set(normalized, benefitScore + 1);
        }

        // Track concentration ranges if known
        if (ingredient.concentration) {
          if (!fingerprint.concentrationRanges.has(normalized)) {
            fingerprint.concentrationRanges.set(normalized, []);
          }
          fingerprint.concentrationRanges.get(normalized).push(ingredient.concentration);
        }
      }

      // Track successful ingredient combinations
      if (product.experience?.rating >= 4) {
        const combo = product.ingredients.active.map(i => i.name).sort();
        fingerprint.ingredientCombos.push({
          ingredients: combo,
          rating: product.experience.rating,
          category: product.category
        });
      }

      // Track texture preferences
      if (product.experience?.texture?.tags) {
        for (const tag of product.experience.texture.tags) {
          const count = fingerprint.texturePreferences.get(tag) || 0;
          fingerprint.texturePreferences.set(tag, count + 1);
        }
      }
    }

    // Calculate average concentration ranges
    for (const [ingredient, concentrations] of fingerprint.concentrationRanges.entries()) {
      const avg = concentrations.reduce((a, b) => a + b, 0) / concentrations.length;
      fingerprint.concentrationRanges.set(ingredient, {
        min: Math.min(...concentrations),
        max: Math.max(...concentrations),
        average: avg
      });
    }

    return fingerprint;
  }

  /**
   * Get target ingredients based on skin analysis
   */
  async getTargetIngredients(skinAnalysis, userProfile) {
    const targets = {
      mustHave: [],
      beneficial: [],
      avoid: []
    };

    // Map skin concerns to beneficial ingredients
    const concernToIngredients = {
      acne: {
        mild: ['salicylic acid', 'niacinamide', 'tea tree oil'],
        moderate: ['benzoyl peroxide', 'salicylic acid', 'azelaic acid'],
        severe: ['retinoids', 'benzoyl peroxide', 'sulfur']
      },
      darkCircles: {
        pigmentation: ['vitamin c', 'kojic acid', 'vitamin k'],
        puffiness: ['caffeine', 'peptides', 'hyaluronic acid'],
        vascular: ['vitamin k', 'arnica', 'retinol']
      },
      dryness: {
        mild: ['hyaluronic acid', 'glycerin', 'squalane'],
        moderate: ['ceramides', 'niacinamide', 'peptides'],
        severe: ['urea', 'lactic acid', 'shea butter']
      },
      oiliness: {
        mild: ['niacinamide', 'zinc', 'clay'],
        moderate: ['salicylic acid', 'retinol', 'tea tree'],
        severe: ['benzoyl peroxide', 'sulfur', 'retinoids']
      },
      aging: ['retinol', 'peptides', 'vitamin c', 'niacinamide'],
      hyperpigmentation: ['vitamin c', 'kojic acid', 'tranexamic acid', 'alpha arbutin']
    };

    // Analyze skin concerns and map to ingredients
    if (skinAnalysis.acne?.score > 3) {
      const severity = skinAnalysis.acne.score > 7 ? 'severe' :
                       skinAnalysis.acne.score > 5 ? 'moderate' : 'mild';
      targets.beneficial.push(...concernToIngredients.acne[severity]);
    }

    if (skinAnalysis.darkCircles?.score > 4) {
      if (skinAnalysis.darkCircles.pigmentation > 5) {
        targets.beneficial.push(...concernToIngredients.darkCircles.pigmentation);
      }
      if (skinAnalysis.darkCircles.puffiness > 5) {
        targets.beneficial.push(...concernToIngredients.darkCircles.puffiness);
      }
    }

    if (skinAnalysis.texture?.dryness > 5) {
      const severity = skinAnalysis.texture.dryness > 8 ? 'severe' :
                       skinAnalysis.texture.dryness > 6 ? 'moderate' : 'mild';
      targets.beneficial.push(...concernToIngredients.dryness[severity]);
    }

    if (skinAnalysis.texture?.oiliness > 5) {
      const severity = skinAnalysis.texture.oiliness > 8 ? 'severe' :
                       skinAnalysis.texture.oiliness > 6 ? 'moderate' : 'mild';
      targets.beneficial.push(...concernToIngredients.oiliness[severity]);
    }

    // Remove duplicates and normalize
    targets.beneficial = [...new Set(targets.beneficial)];
    targets.beneficial = await Promise.all(
      targets.beneficial.map(i => this.synonymMapper.normalizeIngredient(i))
    );

    // Add ingredients to avoid based on skin type
    if (userProfile.skin?.type === 'sensitive') {
      targets.avoid.push('alcohol denat', 'fragrance', 'essential oils', 'witch hazel');
    }
    if (skinAnalysis.acne?.score > 5) {
      targets.avoid.push('coconut oil', 'cocoa butter', 'wheat germ oil');
    }

    return targets;
  }

  /**
   * Search products in database
   */
  async searchProducts(fingerprint, targetIngredients, userProfile) {
    // Build query based on fingerprint and targets
    const query = {
      category: userProfile.preferences?.productCategory || 'skincare',
      ingredients: {
        $in: [...fingerprint.keyActives.keys(), ...targetIngredients.beneficial]
      }
    };

    // Add price filter if specified
    if (userProfile.preferences?.priceRange) {
      query.price = {
        $gte: userProfile.preferences.priceRange.min,
        $lte: userProfile.preferences.priceRange.max
      };
    }

    // Query database
    let products = await this.db.collection('products').find(query).toArray();

    // If not enough products, try external APIs
    if (products.length < 20) {
      const externalProducts = await this.searchExternalAPIs(
        fingerprint,
        targetIngredients,
        userProfile
      );
      products = products.concat(externalProducts);
    }

    return products;
  }

  /**
   * Search external APIs for products
   */
  async searchExternalAPIs(fingerprint, targetIngredients, userProfile) {
    const products = [];

    // Option 1: Open Beauty Facts API
    try {
      const ingredients = [...fingerprint.keyActives.keys()].slice(0, 5);
      const response = await fetch(
        `https://world.openbeautyfacts.org/api/v2/search?ingredients_tags=${ingredients.join(',')}&fields=product_name,brands,ingredients_text`
      );
      const data = await response.json();

      if (data.products) {
        products.push(...data.products.map(p => ({
          name: p.product_name,
          brand: p.brands,
          ingredients: p.ingredients_text,
          source: 'openbeautyfacts'
        })));
      }
    } catch (error) {
      console.error('Open Beauty Facts API error:', error);
    }

    // Parse ingredients for external products
    for (const product of products) {
      if (product.ingredients && typeof product.ingredients === 'string') {
        product.ingredients = await this.ingredientExtractor.parseIngredientList(
          product.ingredients
        );
      }
    }

    return products;
  }

  /**
   * Score and rank products
   */
  async scoreAndRankProducts(products, fingerprint, targetIngredients, userProfile) {
    const scoredProducts = [];

    for (const product of products) {
      const score = await this.calculateProductScore(
        product,
        fingerprint,
        targetIngredients,
        userProfile
      );

      scoredProducts.push({
        ...product,
        matchScore: score.total,
        scoreBreakdown: score.breakdown,
        matchedIngredients: score.matchedIngredients,
        targetIngredients: score.targetIngredients
      });
    }

    // Sort by match score
    return scoredProducts.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Calculate product match score
   */
  async calculateProductScore(product, fingerprint, targetIngredients, userProfile) {
    const score = {
      breakdown: {
        ingredientMatch: 0,
        targetMatch: 0,
        comboMatch: 0,
        textureMatch: 0,
        safety: 0
      },
      matchedIngredients: [],
      targetIngredients: [],
      total: 0
    };

    const weights = {
      ingredientMatch: 0.3,
      targetMatch: 0.3,
      comboMatch: 0.2,
      textureMatch: 0.1,
      safety: 0.1
    };

    // Parse product ingredients if needed
    if (!product.ingredients?.parsed) {
      product.ingredients = await this.ingredientExtractor.parseIngredientList(
        product.ingredients
      );
    }

    // Score ingredient match with loved products
    let ingredientMatches = 0;
    for (const ingredient of product.ingredients.keyIngredients || []) {
      const normalized = await this.synonymMapper.normalizeIngredient(ingredient.name);
      if (fingerprint.keyActives.has(normalized)) {
        ingredientMatches++;
        score.matchedIngredients.push(ingredient.name);
      }
    }
    score.breakdown.ingredientMatch = (ingredientMatches / Math.max(1, fingerprint.keyActives.size)) * 100;

    // Score target ingredient match
    let targetMatches = 0;
    for (const ingredient of product.ingredients.keyIngredients || []) {
      const normalized = await this.synonymMapper.normalizeIngredient(ingredient.name);
      if (targetIngredients.beneficial.includes(normalized)) {
        targetMatches++;
        score.targetIngredients.push(ingredient.name);
      }
    }
    score.breakdown.targetMatch = (targetMatches / Math.max(1, targetIngredients.beneficial.length)) * 100;

    // Score ingredient combination match
    score.breakdown.comboMatch = this.scoreIngredientCombos(
      product.ingredients.active || [],
      fingerprint.ingredientCombos
    );

    // Score texture match
    if (product.texture?.tags) {
      let textureMatches = 0;
      for (const tag of product.texture.tags) {
        if (fingerprint.texturePreferences.has(tag)) {
          textureMatches++;
        }
      }
      score.breakdown.textureMatch = (textureMatches / Math.max(1, product.texture.tags.length)) * 100;
    }

    // Safety score (no allergens or avoided ingredients)
    const hasAllergens = this.allergyFilter.containsAllergens(
      product.ingredients.all || [],
      userProfile.skin?.allergies || []
    );
    score.breakdown.safety = hasAllergens ? 0 : 100;

    // Calculate total weighted score
    score.total = Object.entries(weights).reduce((total, [key, weight]) => {
      return total + (score.breakdown[key] * weight);
    }, 0);

    return score;
  }

  /**
   * Score ingredient combination matches
   */
  scoreIngredientCombos(productIngredients, lovedCombos) {
    if (!productIngredients.length || !lovedCombos.length) {
      return 0;
    }

    let bestMatch = 0;
    const productSet = new Set(productIngredients.map(i => i.toLowerCase()));

    for (const combo of lovedCombos) {
      const comboSet = new Set(combo.ingredients.map(i => i.toLowerCase()));
      const intersection = new Set([...productSet].filter(x => comboSet.has(x)));
      const matchPercent = (intersection.size / comboSet.size) * 100;
      bestMatch = Math.max(bestMatch, matchPercent);
    }

    return bestMatch;
  }

  /**
   * Generate explanations for recommendations
   */
  async generateExplanations(products, userProfile, skinAnalysis) {
    const explainedProducts = [];

    for (const product of products) {
      const prompt = `
        Explain why this ${product.category} product is recommended for this user:

        Product: ${product.name} by ${product.brand}
        Key Ingredients: ${product.matchedIngredients.join(', ')}
        Target Ingredients for Concerns: ${product.targetIngredients.join(', ')}

        User's Skin Analysis:
        - Acne Score: ${skinAnalysis.acne?.score || 0}/10
        - Dark Circles: ${skinAnalysis.darkCircles?.score || 0}/10
        - Oiliness: ${skinAnalysis.texture?.oiliness || 0}/10
        - Dryness: ${skinAnalysis.texture?.dryness || 0}/10

        User's Skin Type: ${userProfile.skin?.type}
        Main Concerns: ${userProfile.skin?.concerns?.map(c => c.type).join(', ')}

        Provide a brief, personalized explanation (2-3 sentences) of why this product matches their needs.
      `;

      try {
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const explanation = response.text();

        explainedProducts.push({
          ...product,
          recommendation: {
            explanation: explanation,
            matchScore: product.matchScore,
            keyBenefits: this.extractKeyBenefits(product, skinAnalysis),
            usage: this.suggestUsage(product, userProfile)
          }
        });
      } catch (error) {
        console.error('Failed to generate explanation:', error);
        explainedProducts.push({
          ...product,
          recommendation: {
            explanation: 'This product contains ingredients that match your skin profile and concerns.',
            matchScore: product.matchScore
          }
        });
      }
    }

    return explainedProducts;
  }

  /**
   * Extract key benefits for the user
   */
  extractKeyBenefits(product, skinAnalysis) {
    const benefits = [];

    if (skinAnalysis.acne?.score > 3 && product.targetIngredients.some(
      i => ['salicylic acid', 'benzoyl peroxide', 'niacinamide'].includes(i.toLowerCase())
    )) {
      benefits.push('Helps reduce acne and inflammation');
    }

    if (skinAnalysis.texture?.dryness > 5 && product.targetIngredients.some(
      i => ['hyaluronic acid', 'ceramides', 'glycerin'].includes(i.toLowerCase())
    )) {
      benefits.push('Provides deep hydration and moisture retention');
    }

    if (skinAnalysis.darkCircles?.score > 4 && product.targetIngredients.some(
      i => ['vitamin c', 'caffeine', 'vitamin k'].includes(i.toLowerCase())
    )) {
      benefits.push('Helps reduce dark circles and puffiness');
    }

    return benefits;
  }

  /**
   * Suggest product usage
   */
  suggestUsage(product, userProfile) {
    const usage = {
      frequency: 'daily',
      time: 'morning and evening',
      order: 3,
      notes: []
    };

    // Adjust based on product category
    if (product.category === 'cleanser') {
      usage.order = 1;
    } else if (product.category === 'toner') {
      usage.order = 2;
    } else if (product.category === 'serum') {
      usage.order = 3;
    } else if (product.category === 'moisturizer') {
      usage.order = 4;
    } else if (product.category === 'sunscreen') {
      usage.order = 5;
      usage.time = 'morning';
    }

    // Adjust for sensitive skin
    if (userProfile.skin?.type === 'sensitive') {
      usage.notes.push('Start with 2-3 times per week and gradually increase');
    }

    // Adjust for actives
    if (product.targetIngredients.some(i => ['retinol', 'retinoids'].includes(i.toLowerCase()))) {
      usage.time = 'evening';
      usage.notes.push('Use sunscreen during the day');
    }

    return usage;
  }
}

/**
 * Ingredient Extractor
 */
class IngredientExtractor {
  constructor(model) {
    this.model = model;
  }

  async extractFromProduct(product) {
    const prompt = `
      Extract and categorize ingredients from this product:
      Name: ${product.name}
      Brand: ${product.brand}
      Ingredient List: ${product.ingredientList || product.ingredients}

      Return a JSON object with:
      {
        "parsed": true,
        "all": [complete list of ingredients],
        "active": [
          {"name": "ingredient", "concentration": number if known, "purpose": "purpose"}
        ],
        "keyIngredients": [
          {"name": "ingredient", "category": "humectant|emollient|active|preservative", "benefits": ["benefit1"]}
        ],
        "base": [base formula ingredients],
        "preservatives": [preservative ingredients],
        "fragrances": [fragrance ingredients],
        "potentialIrritants": [ingredients that may cause irritation]
      }
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Failed to extract ingredients:', error);
    }

    // Fallback: simple parsing
    return this.simpleIngredientParse(product.ingredientList || product.ingredients);
  }

  async parseIngredientList(ingredientText) {
    if (!ingredientText) return { parsed: false, all: [] };

    // Simple parsing as fallback
    const ingredients = ingredientText
      .split(/[,;]/)
      .map(i => i.trim())
      .filter(i => i.length > 0);

    return {
      parsed: true,
      all: ingredients,
      keyIngredients: ingredients.slice(0, 10).map(name => ({
        name: name,
        category: 'unknown'
      }))
    };
  }

  simpleIngredientParse(ingredientText) {
    if (!ingredientText) return { parsed: false, all: [] };

    const ingredients = ingredientText
      .split(/[,;]/)
      .map(i => i.trim())
      .filter(i => i.length > 0);

    return {
      parsed: true,
      all: ingredients,
      active: [],
      keyIngredients: ingredients.slice(0, 10).map(name => ({
        name: name,
        category: 'unknown'
      })),
      base: ingredients.slice(0, 5),
      preservatives: [],
      fragrances: [],
      potentialIrritants: []
    };
  }
}

/**
 * Ingredient Synonym Mapper
 */
class IngredientSynonymMapper {
  constructor(model) {
    this.model = model;
    this.cache = new Map();
    this.initializeSynonymMap();
  }

  initializeSynonymMap() {
    this.synonymMap = {
      'vitamin c': ['ascorbic acid', 'l-ascorbic acid', 'sodium ascorbyl phosphate', 'magnesium ascorbyl phosphate'],
      'vitamin e': ['tocopherol', 'tocopheryl acetate', 'alpha-tocopherol'],
      'vitamin a': ['retinol', 'retinyl palmitate', 'retinaldehyde'],
      'niacinamide': ['nicotinamide', 'vitamin b3'],
      'hyaluronic acid': ['sodium hyaluronate', 'hydrolyzed hyaluronic acid'],
      'salicylic acid': ['bha', 'beta hydroxy acid'],
      'glycolic acid': ['aha', 'alpha hydroxy acid'],
      // Add more mappings as needed
    };
  }

  async normalizeIngredient(ingredient) {
    if (!ingredient) return '';

    const lower = ingredient.toLowerCase().trim();

    // Check cache
    if (this.cache.has(lower)) {
      return this.cache.get(lower);
    }

    // Check known synonyms
    for (const [normalized, synonyms] of Object.entries(this.synonymMap)) {
      if (lower === normalized || synonyms.includes(lower)) {
        this.cache.set(lower, normalized);
        return normalized;
      }
    }

    // Return as is if no mapping found
    this.cache.set(lower, lower);
    return lower;
  }

  async findSynonyms(ingredient) {
    const normalized = await this.normalizeIngredient(ingredient);

    // Return known synonyms
    if (this.synonymMap[normalized]) {
      return [normalized, ...this.synonymMap[normalized]];
    }

    return [normalized];
  }
}

/**
 * Allergy Filter
 */
class AllergyFilter {
  constructor() {
    this.allergenGroups = {
      'fragrance': ['parfum', 'fragrance', 'aroma', 'linalool', 'limonene'],
      'sulfates': ['sodium lauryl sulfate', 'sls', 'sodium laureth sulfate', 'sles'],
      'parabens': ['methylparaben', 'ethylparaben', 'propylparaben', 'butylparaben'],
      'gluten': ['wheat', 'barley', 'rye', 'oat'],
      'nuts': ['almond', 'walnut', 'macadamia', 'brazil nut']
    };
  }

  filterProducts(products, allergies = [], sensitivities = []) {
    return products.filter(product => {
      // Check for allergens
      if (this.containsAllergens(product.ingredients?.all || [], allergies)) {
        return false;
      }

      // Mark products with sensitivities but don't filter them out
      if (this.containsSensitizers(product.ingredients?.all || [], sensitivities)) {
        product.hasSensitizers = true;
      }

      return true;
    });
  }

  containsAllergens(ingredients, userAllergies) {
    for (const allergy of userAllergies) {
      const allergenGroup = this.allergenGroups[allergy.allergen?.toLowerCase()];
      if (allergenGroup) {
        for (const ingredient of ingredients) {
          const lower = (ingredient.name || ingredient).toLowerCase();
          if (allergenGroup.some(allergen => lower.includes(allergen))) {
            return true;
          }
        }
      }
    }
    return false;
  }

  containsSensitizers(ingredients, userSensitivities) {
    for (const sensitivity of userSensitivities) {
      const ingredient = sensitivity.ingredient?.toLowerCase();
      for (const productIngredient of ingredients) {
        const lower = (productIngredient.name || productIngredient).toLowerCase();
        if (lower.includes(ingredient)) {
          return true;
        }
      }
    }
    return false;
  }
}

/**
 * Product Matcher
 */
class ProductMatcher {
  constructor() {
    this.matchThreshold = 60; // Minimum match score
  }

  findBestMatches(products, criteria, limit = 10) {
    return products
      .filter(p => p.matchScore >= this.matchThreshold)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  }

  explainMatch(product, userProfile) {
    const reasons = [];

    if (product.matchedIngredients?.length > 0) {
      reasons.push(`Contains ${product.matchedIngredients.length} ingredients from your loved products`);
    }

    if (product.targetIngredients?.length > 0) {
      reasons.push(`Addresses your skin concerns with ${product.targetIngredients.join(', ')}`);
    }

    if (product.scoreBreakdown?.safety === 100) {
      reasons.push('Free from your allergens and sensitivities');
    }

    return reasons;
  }
}

export default ProductRecommendationEngine;