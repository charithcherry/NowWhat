import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { getSessionToken, setAuthCookie } from '@/lib/auth';

const HANDOFF_COLLECTION = 'auth_handoffs';
const HANDOFF_TTL_SECONDS = 60;

type AuthHandoffDocument = {
  handoffId: string;
  sessionToken: string;
  sourceOrigin: string;
  targetOrigin: string;
  redirectPath: string;
  createdAt: Date;
  expiresAt: Date;
};

function getAllowedOrigins() {
  const configuredOrigins = [
    process.env.NEXT_PUBLIC_BASE_URL,
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function ensureHandoffIndexes() {
  const db = await getDatabase();
  const collection = db.collection<AuthHandoffDocument>(HANDOFF_COLLECTION);
  await collection.createIndex({ handoffId: 1 }, { unique: true }).catch(() => {});
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
}

async function createHandoffGrant(params: {
  sessionToken: string;
  sourceOrigin: string;
  targetOrigin: string;
  redirectPath: string;
}): Promise<string | null> {
  const db = await getDatabase();
  const now = new Date();
  const session = await db.collection('sessions').findOne({
    token: params.sessionToken,
    expiresAt: { $gt: now },
  });

  if (!session) {
    return null;
  }

  const handoffId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(now.getTime() + HANDOFF_TTL_SECONDS * 1000);

  await ensureHandoffIndexes();
  await db.collection<AuthHandoffDocument>(HANDOFF_COLLECTION).insertOne({
    handoffId,
    sessionToken: params.sessionToken,
    sourceOrigin: params.sourceOrigin,
    targetOrigin: params.targetOrigin,
    redirectPath: params.redirectPath,
    createdAt: now,
    expiresAt,
  });

  return handoffId;
}

function renderHandoffPage(params: { actionUrl: string; handoffId: string }) {
  const actionUrl = escapeHtml(params.actionUrl);
  const handoffId = escapeHtml(params.handoffId);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="referrer" content="no-referrer" />
    <title>Signing you in...</title>
  </head>
  <body>
    <form id="handoff-form" method="POST" action="${actionUrl}">
      <input type="hidden" name="handoffId" value="${handoffId}" />
      <noscript>
        <p>Continue to complete sign-in.</p>
        <button type="submit">Continue</button>
      </noscript>
    </form>
    <script>
      document.getElementById('handoff-form')?.submit();
    </script>
  </body>
</html>`;
}

export async function GET(request: NextRequest) {
  try {
    const target = request.nextUrl.searchParams.get('target');

    if (!target) {
      return NextResponse.json({ error: 'target is required' }, { status: 400 });
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
    const handoffId = await createHandoffGrant({
      sessionToken,
      sourceOrigin: request.nextUrl.origin,
      targetOrigin: targetUrl.origin,
      redirectPath,
    });

    if (!handoffId) {
      return NextResponse.redirect(targetUrl);
    }

    const handoffUrl = new URL('/api/auth/handoff', targetUrl.origin);
    return new NextResponse(renderHandoffPage({ actionUrl: handoffUrl.toString(), handoffId }), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store, no-cache, max-age=0',
        'referrer-policy': 'no-referrer',
      },
    });
  } catch (error) {
    console.error('Auth handoff error:', error);
    return NextResponse.json({ error: 'Failed to complete auth handoff' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const handoffId = String(formData.get('handoffId') || '').trim();

    if (!handoffId) {
      return NextResponse.json({ error: 'handoffId is required' }, { status: 400 });
    }

    const db = await getDatabase();
    const now = new Date();
    const handoff = await db.collection<AuthHandoffDocument>(HANDOFF_COLLECTION).findOneAndDelete({
      handoffId,
      expiresAt: { $gt: now },
    });

    if (!handoff) {
      return NextResponse.json({ error: 'Invalid or expired handoff grant' }, { status: 401 });
    }

    const session = await db.collection('sessions').findOne({
      token: handoff.sessionToken,
      expiresAt: { $gt: now },
    });

    if (!session) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    await setAuthCookie(handoff.sessionToken);
    return NextResponse.redirect(new URL(handoff.redirectPath, handoff.targetOrigin), { status: 303 });
  } catch (error) {
    console.error('Auth handoff error:', error);
    return NextResponse.json({ error: 'Failed to complete auth handoff' }, { status: 500 });
  }
}
