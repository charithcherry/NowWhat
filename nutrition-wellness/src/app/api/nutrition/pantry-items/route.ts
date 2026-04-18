export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listPantryItems, replacePantryItems } from "@/modules/nutrition/repositories";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.userId;

    const items = await listPantryItems(userId);
    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("Failed to list pantry items:", error);
    return NextResponse.json({ error: "Failed to list pantry items" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = (await request.json()) as Record<string, unknown>;
    const userId = user.userId;

    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const normalized = rawItems
      .map((item) => {
        if (typeof item === "string") {
          return { item_name: item.trim() };
        }

        if (typeof item === "object" && item) {
          const asObj = item as Record<string, unknown>;
          return {
            item_name: String(asObj.item_name || "").trim(),
            quantity: asObj.quantity !== undefined ? Number(asObj.quantity) : undefined,
            unit: typeof asObj.unit === "string" ? asObj.unit.trim() : undefined,
          };
        }

        return { item_name: "" };
      })
      .filter((item) => item.item_name.length > 0);

    const items = await replacePantryItems(userId, normalized);
    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("Failed to save pantry items:", error);
    return NextResponse.json({ error: "Failed to save pantry items" }, { status: 500 });
  }
}
