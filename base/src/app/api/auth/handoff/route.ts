import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { getSessionToken, setAuthCookie } from '@/lib/auth';

function getAllowedOrigins() {
  const configuredOrigins = [
    process.env.NEXT_PUBLIC_FITNESS_URL,
    process.env.NEXT_PUBLIC_NUTRITION_URL,
    process.env.NEXT_PUBLIC_RESTAURANTS_URL,
    process.env.NEXT_PUBLIC_SKIN_URL,
    process.env.NEXT_PUBLIC_COMMUNITY_URL,
  ];

  const devOrigins = process.env.NODE_ENV === 'production'
    ? []
    : [
        'http://localhost:3000',
        'http://localhost:3002',
        'http://localhost:3003',
        'http://localhost:3004',
        'http://localhost:3005',
        'http://localhost:3006',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3002',
        'http://127.0.0.1:3003',
        'http://127.0.0.1:3004',
        'http://127.0.0.1:3005',
        'http://127.0.0.1:3006',
      ];

  return [...configuredOrigins, ...devOrigins]
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value as string).origin;
      } catch {
        return null;
      }
    })
    .filter((value, index, array) => array.indexOf(value) === index)
    .filter((value): value is string => Boolean(value));
}

function getSafeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith('/')) {
    return '/';
  }

  return value;
}

function isLocalDevOrigin(origin: string): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  try {
    const url = new URL(origin);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    const target = request.nextUrl.searchParams.get('target');

    if (token) {
      const redirectPath = getSafeRedirectPath(request.nextUrl.searchParams.get('redirect'));
      const db = await getDatabase();
      const session = await db.collection('sessions').findOne({
        token,
        expiresAt: { $gt: new Date() },
      });

      if (!session) {
        return NextResponse.json({ error: 'Invalid or expired handoff token' }, { status: 401 });
      }

      await setAuthCookie(token);
      return NextResponse.redirect(new URL(redirectPath, request.nextUrl.origin));
    }

    if (!target) {
      return NextResponse.json({ error: 'target or token is required' }, { status: 400 });
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(target);
    } catch {
      return NextResponse.json({ error: 'Invalid target URL' }, { status: 400 });
    }

    const sessionToken = await getSessionToken();
    if (!sessionToken) {
      return NextResponse.redirect(targetUrl);
    }

    if (targetUrl.origin === request.nextUrl.origin) {
      return NextResponse.redirect(targetUrl);
    }

    const allowedOrigins = getAllowedOrigins();
    if (!isLocalDevOrigin(targetUrl.origin) && !allowedOrigins.includes(targetUrl.origin)) {
      return NextResponse.json({ error: 'Target origin is not allowed' }, { status: 400 });
    }

    const redirectPath = getSafeRedirectPath(`${targetUrl.pathname}${targetUrl.search}`);
    const handoffUrl = new URL('/api/auth/handoff', targetUrl.origin);
    handoffUrl.searchParams.set('token', sessionToken);
    handoffUrl.searchParams.set('redirect', redirectPath);

    return NextResponse.redirect(handoffUrl);
  } catch (error) {
    console.error('Auth handoff error:', error);
    return NextResponse.json({ error: 'Failed to complete auth handoff' }, { status: 500 });
  }
}
