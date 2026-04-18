import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      error: 'Deprecated endpoint. Use /api/auth/handoff?target=... for server-side session handoff.',
    },
    { status: 410 }
  );
}
