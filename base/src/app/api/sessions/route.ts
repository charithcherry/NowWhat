import { NextRequest, NextResponse } from 'next/server';
import { saveExerciseSession, getUserSessions, type ExerciseSession } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const session: ExerciseSession = await request.json();

    // Validate required fields
    if (!session.exercise || !session.reps) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await saveExerciseSession(session);

    return NextResponse.json(
      {
        success: true,
        sessionId: result.insertedId,
        message: 'Session saved successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error saving session:', error);
    return NextResponse.json(
      { error: 'Failed to save session' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const sessions = await getUserSessions(userId, limit);

    return NextResponse.json({
      success: true,
      sessions,
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}
