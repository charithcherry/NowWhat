import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
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

// Optional: GET endpoint to read logs
export async function GET() {
  try {
    const logFilePath = path.join(process.cwd(), 'exercise-log.txt');

    // Check if file exists
    try {
      await fs.access(logFilePath);
    } catch {
      // File doesn't exist yet
      return NextResponse.json({ logs: [] });
    }

    const content = await fs.readFile(logFilePath, 'utf-8');
    const logs = content.split('\n').filter(line => line.trim() !== '');

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Error reading log:', error);
    return NextResponse.json(
      { error: 'Failed to read log' },
      { status: 500 }
    );
  }
}

// Optional: DELETE endpoint to clear logs
export async function DELETE() {
  try {
    const logFilePath = path.join(process.cwd(), 'exercise-log.txt');

    // Check if file exists
    try {
      await fs.access(logFilePath);
      await fs.unlink(logFilePath);
    } catch {
      // File doesn't exist, nothing to delete
    }

    return NextResponse.json({ success: true, message: 'Logs cleared' });
  } catch (error) {
    console.error('Error deleting log:', error);
    return NextResponse.json(
      { error: 'Failed to delete log' },
      { status: 500 }
    );
  }
}
