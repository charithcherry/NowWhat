export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addLovedProduct, listLovedProducts } from "@/modules/skin-hair/repositories";
import { lookupProductIngredients } from "@/modules/skin-hair/ingredientLookup";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.userId;

    const products = await listLovedProducts(userId);

    return NextResponse.json({ success: true, products });
  } catch (error) {
    console.error("Failed to fetch loved products:", error);
    return NextResponse.json({ error: "Failed to fetch loved products" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as Record<string, unknown>;
    const userId = user.userId;
    const productName = String(payload.product_name || "").trim();
    const brand = String(payload.brand || "").trim();
    const category = String(payload.category || "").trim().toLowerCase();
    const notes = String(payload.notes || "").trim();

    if (!productName || !brand || !category) {
      return NextResponse.json(
        { error: "product_name, brand, and category are required" },
        { status: 400 },
      );
    }

    const lookup = await lookupProductIngredients({
      productName,
      brand,
    });

    const product = await addLovedProduct(userId, {
      product_name: productName,
      brand,
      category,
      ingredients: lookup.ingredients,
      notes: notes || undefined,
      ingredient_lookup_source: lookup.source,
      ingredient_lookup_match: lookup.matched_product,
      ingredient_lookup_grounding_line: lookup.grounding_line,
    });

    return NextResponse.json(
      {
        success: true,
        product,
        ingredient_lookup: {
          source: lookup.source,
          matched_product: lookup.matched_product,
          grounding_line: lookup.grounding_line,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to add loved product:", error);
    return NextResponse.json({ error: (error as Error).message || "Failed to add loved product" }, { status: 500 });
  }
}
