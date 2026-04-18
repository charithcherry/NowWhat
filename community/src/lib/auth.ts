import { cookies, headers } from 'next/headers';
import { getDatabase } from './mongodb';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

const SESSION_EXPIRES_IN_DAYS = 7;

export interface User {
  _id: ObjectId;
  email: string;
  name: string;
  password: string;
  created_at: Date;
  updated_at?: Date;
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
}

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
}

/**
 * Generate a cryptographically secure session token and store it in MongoDB
 */
export async function generateToken(payload: SessionPayload): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const db = await getDatabase();
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRES_IN_DAYS);

  const sessionsCol = db.collection('sessions');

  await sessionsCol.insertOne({
    token,
    userId: new ObjectId(payload.userId),
    email: payload.email,
    name: payload.name,
    createdAt: new Date(),
    expiresAt
  });

  // Ensure fast lookups and automatic expired session cleanup
  await sessionsCol.createIndex({ token: 1 }, { unique: true }).catch(() => {});
  await sessionsCol.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});

  return token;
}

/**
 * Get current user by validating the session token against MongoDB.
 * Checks cookie first, then falls back to Authorization: Bearer header.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get('auth_token')?.value;

    if (!token) {
      const headersList = await headers();
      const authHeader = headersList.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return null;
    }

    const db = await getDatabase();
    
    // Validate session in centralized database
    const session = await db.collection('sessions').findOne({ 
      token,
      expiresAt: { $gt: new Date() } // Assert token hasn't expired network-wide
    });

    if (!session) {
      return null;
    }

    const user = await db.collection('users').findOne({
      _id: session.userId
    });

    if (!user) {
      return null;
    }

    return {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

/**
 * Require authentication - throws error if not authenticated
 * Use this in API routes or server components that require auth
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Unauthorized - Authentication required');
  }

  return user;
}

/**
 * Set auth cookie with the session token
 */
export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * SESSION_EXPIRES_IN_DAYS,
    path: '/',
  });
}

/**
 * Clear auth cookie and delete the session from MongoDB (logout)
 */
export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  
  if (token) {
    try {
      const db = await getDatabase();
      await db.collection('sessions').deleteOne({ token });
    } catch(e) {
      console.error('Session cleanup error:', e);
    }
  }
  
  cookieStore.delete('auth_token');
}
