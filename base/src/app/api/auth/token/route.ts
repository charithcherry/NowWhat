import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Returns the raw session token to the client.
 * Used by the Navigation component to pass the token to other microservices
 * via URL parameter, enabling cross-port/cross-origin session handoff.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Token fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
