import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
}

interface JWTPayload {
  userId: string;
  email: string;
  name: string;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    // Local / hackathon only: skip JWT when explicitly enabled (no base app on :3000 required)
    if (process.env.COMMUNITY_DEV_DEMO === "true") {
      return {
        userId: process.env.COMMUNITY_DEMO_USER_ID || "demo-user",
        email: process.env.COMMUNITY_DEMO_EMAIL || "demo@local.dev",
        name: process.env.COMMUNITY_DEMO_USER_NAME || "Demo user",
      };
    }

    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return null;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET is not defined");
      return null;
    }

    const decoded = jwt.verify(token, secret) as JWTPayload;

    return {
      userId: decoded.userId,
      email: decoded.email ?? "",
      name: decoded.name ?? "Member",
    };
  } catch (error) {
    console.error("Auth error:", error);
    return null;
  }
}
