import { NextResponse } from 'next/server';
import { runPanicToPlan } from '../../panic_to_plan/logic';

export async function POST(request: Request) {
  try {
    const { input, energy, time } = await request.json();
    const result = await runPanicToPlan(input, energy, time);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Panic API Error:", error);
    return NextResponse.json({ error: "Failed to process plan" }, { status: 500 });
  }
}