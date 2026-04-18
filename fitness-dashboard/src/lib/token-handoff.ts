import { cookies } from 'next/headers';
import { getDatabase } from './mongodb';

/**
 * Server-side token handoff: checks for a ?token query param,
 * validates it against MongoDB, and sets the auth cookie.
 * Call this at the top of any server page that receives cross-service navigation.
 * Returns the token if valid, null otherwise.
 */
export async function handleTokenHandoff(
  searchParams: { [key: string]: string | string[] | undefined }
): Promise<boolean> {
  const token = typeof searchParams.token === 'string' ? searchParams.token : null;
  
  if (!token) return false;

  try {
    const db = await getDatabase();
    const session = await db.collection('sessions').findOne({
      token,
      expiresAt: { $gt: new Date() }
    });

    if (!session) return false;

    // Set the cookie server-side in one shot — no client reload needed
    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return true;
  } catch (e) {
    console.error('Token handoff error:', e);
    return false;
  }
}
