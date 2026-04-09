import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getJobsForUser } from '@/lib/video-agents/jobQueue';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const list = getJobsForUser(user.userId)
    .sort((a, b) => b.createdAt - a.createdAt) // newest first
    .map(j => ({
      id: j.id,
      exercise: j.exercise,
      status: j.status,
      statusDetail: j.statusDetail,
      log: j.log,
      error: j.error ?? null,
      createdAt: j.createdAt,
      result: j.result
        ? { cameraSetup: j.result.cameraSetup, attempts: j.result.attempts, testerPassed: j.result.testerResult?.passed }
        : null,
    }));

  return NextResponse.json({ jobs: list });
}
