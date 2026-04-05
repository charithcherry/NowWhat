import { NextRequest, NextResponse } from 'next/server';
import {
  saveExerciseBiomechanicsSummary,
  saveFitnessSessionSummary,
  getUserFitnessSessions,
  type ExerciseBiomechanicsSummary,
  type FitnessSessionSummary,
} from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
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

    const result = await saveFitnessSessionSummary(session);
    const sessionId = String(result.insertedId);

    if (exerciseBiomechanics) {
      await saveExerciseBiomechanicsSummary({
        ...exerciseBiomechanics,
        fitnessSessionId: sessionId,
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
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const sessions = await getUserFitnessSessions(userId, limit);

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
