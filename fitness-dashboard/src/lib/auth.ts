import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import { getDatabase } from './mongodb';
import { ObjectId } from 'mongodb';

const JWT_SECRET = process.env.JWT_SECRET!;

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload) return null;

    // Optional: verify user still exists in DB
    const db = await getDatabase();
    const user = await db.collection('users').findOne({
      _id: new ObjectId(payload.userId)
    });

    if (!user) return null;

    return {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}
