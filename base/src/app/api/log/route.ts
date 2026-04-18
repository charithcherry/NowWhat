import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Path to log file in project root
    const logFilePath = path.join(process.cwd(), 'exercise-log.txt');

    // Append log message with newline
    await fs.appendFile(logFilePath, message + '\n', 'utf-8');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error writing log:', error);
    return NextResponse.json(
      { error: 'Failed to write log' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Log reading is disabled' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Log deletion is disabled' }, { status: 405 });
}
