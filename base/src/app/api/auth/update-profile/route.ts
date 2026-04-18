import { NextResponse } from "next/server";
import { getCurrentUser, generateToken, setAuthCookie, clearAuthCookie } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await request.json();

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const db = await getDatabase();
    const usersCollection = db.collection("users");

    // Update the user's name
    await usersCollection.updateOne(
      { _id: new ObjectId(user.userId) },
      { $set: { name: name.trim(), updated_at: new Date() } }
    );

    // Invalidate old session and create a new one with updated user info
    await clearAuthCookie();

    const token = await generateToken({
      userId: user.userId,
      email: user.email,
      name: name.trim(),
    });

    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        userId: user.userId,
        email: user.email,
        name: name.trim(),
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}

