import { NextRequest, NextResponse } from 'next/server';
import {
  saveExerciseBiomechanicsSummary,
  saveFitnessSessionSummary,
  getUserFitnessSessions,
  type ExerciseBiomechanicsSummary,
  type FitnessSessionSummary,
} from '@/lib/mongodb';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      session,
      exerciseBiomechanics,
    }: {
      session: FitnessSessionSummary;
      exerciseBiomechanics?: ExerciseBiomechanicsSummary;
    } = await request.json();

    // Validate required fields
    if (!session?.exerciseName || !session?.startedAt || !session?.endedAt) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await saveFitnessSessionSummary({
      ...session,
      userId: user.userId,
    });
    const sessionId = String(result.insertedId);

    if (exerciseBiomechanics) {
      await saveExerciseBiomechanicsSummary({
        ...exerciseBiomechanics,
        fitnessSessionId: sessionId,
        userId: user.userId,
      });
    }

    return NextResponse.json(
      {
        success: true,
        sessionId,
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const requestedLimit = parseInt(searchParams.get('limit') || '10', 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(requestedLimit, 50))
      : 10;

    const sessions = await getUserFitnessSessions(user.userId, limit);

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
