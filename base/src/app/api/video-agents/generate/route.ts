import { NextRequest, NextResponse } from 'next/server';
import { createJob, runJobPipeline } from '@/lib/video-agents/jobQueue';
import { getCurrentUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { exerciseName } = await req.json();
  if (!exerciseName) return NextResponse.json({ error: 'exerciseName required' }, { status: 400 });

  const jobId = createJob(exerciseName, user.userId);
  runJobPipeline(jobId); // fire-and-forget — pipeline runs async while client polls

  return NextResponse.json({ jobId });
}
