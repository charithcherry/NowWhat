export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteLovedProduct, updateLovedProduct } from "@/modules/skin-hair/repositories";
import { lookupProductIngredients } from "@/modules/skin-hair/ingredientLookup";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = (await request.json()) as Record<string, unknown>;
    const userId = user.userId;

    const patch: {
      product_name?: string;
      brand?: string;
      category?: string;
      ingredients?: string[];
      notes?: string;
      ingredient_lookup_source?: string;
      ingredient_lookup_match?: string;
      ingredient_lookup_grounding_line?: string;
    } = {
      product_name: payload.product_name ? String(payload.product_name).trim() : undefined,
      brand: payload.brand ? String(payload.brand).trim() : undefined,
      category: payload.category ? String(payload.category).trim().toLowerCase() : undefined,
      ingredients: Array.isArray(payload.ingredients)
        ? [...new Set(payload.ingredients.map((item) => String(item).trim().toLowerCase()).filter(Boolean))]
        : undefined,
      notes: payload.notes === undefined ? undefined : String(payload.notes).trim(),
    };

    if (patch.product_name && patch.brand && !Array.isArray(payload.ingredients)) {
      const lookup = await lookupProductIngredients({
        productName: patch.product_name,
        brand: patch.brand,
      });

      patch.ingredients = lookup.ingredients;
      patch.ingredient_lookup_source = lookup.source;
      patch.ingredient_lookup_match = lookup.matched_product;
      patch.ingredient_lookup_grounding_line = lookup.grounding_line;
    }

    const product = await updateLovedProduct(userId, context.params.id, patch);

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error("Failed to update loved product:", error);
    return NextResponse.json({ error: "Failed to update loved product" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.userId;

    await deleteLovedProduct(userId, context.params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete loved product:", error);
    return NextResponse.json({ error: "Failed to delete loved product" }, { status: 400 });
  }
}
