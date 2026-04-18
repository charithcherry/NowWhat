import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

/**
 * GET /api/auth/handoff?token=xxx&redirect=/
 * 
 * Validates the session token against MongoDB, sets the auth cookie,
 * and redirects to the target page. Used for cross-service authentication
 * when navigating between separately deployed microservices.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const redirectTo = request.nextUrl.searchParams.get('redirect') || '/';

  if (!token) {
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  try {
    const db = await getDatabase();
    const session = await db.collection('sessions').findOne({
      token,
      expiresAt: { $gt: new Date() }
    });

    if (!session) {
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }

    // Set cookie and redirect — this works because Route Handlers CAN set cookies
    const response = NextResponse.redirect(new URL(redirectTo, request.url));
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (e) {
    console.error('Token handoff error:', e);
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }
}
