import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/video-agents/jobQueue';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const job = getJob(params.jobId);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (job.userId !== user.userId) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({
    jobId: job.id,
    exercise: job.exercise,
    status: job.status,
    statusDetail: job.statusDetail,
    log: job.log,
    result: job.result ?? null,
    error: job.error ?? null,
  });
}
