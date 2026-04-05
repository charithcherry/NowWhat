import { MongoClient, Db, ObjectId } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your MongoDB URI to .env.local');
}

const uri = process.env.MONGODB_URI;
const options = { tlsInsecure: true };

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable to preserve the value
  // across module reloads caused by HMR (Hot Module Replacement).
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production mode, create a new client for each request
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;

export async function getDatabase(): Promise<Db> {
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB || 'wellbeing_app');
}

const FITNESS_SESSIONS_COLLECTION = 'fitness_sessions';
const FITNESS_EXERCISE_BIOMECHANICS_COLLECTION = 'fitness_exercise_biomechanics';

export type FitnessSessionStatus = 'completed' | 'stopped_early' | 'abandoned';

// Helper functions for fitness session summaries
export interface FitnessSessionSummary {
  _id?: string;
  userId?: string;
  exerciseName: string;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  repsCompleted: number;
  sessionStatus: FitnessSessionStatus;
  avgFormScore: number;
  avgPostureScore: number;
  avgArmPositionScore: number;
  avgVisibilityScore: number;
  validPositionPct: number;
  bestRepScore: number;
  worstRepScore: number;
}

interface FitnessSessionSummaryDocument {
  _id?: string;
  user_id?: string;
  exercise_name: string;
  started_at: Date;
  ended_at: Date;
  duration_seconds: number;
  reps_completed: number;
  session_status: FitnessSessionStatus;
  avg_form_score: number;
  avg_posture_score: number;
  avg_arm_position_score: number;
  avg_visibility_score: number;
  valid_position_pct: number;
  best_rep_score: number;
  worst_rep_score: number;
}

export interface ExerciseBiomechanicsSummary {
  _id?: string;
  fitnessSessionId: string;
  userId?: string;
  exerciseName: string;
  avgLeftElbowAngle: number;
  avgRightElbowAngle: number;
  avgEshLeft: number;
  avgEshRight: number;
  avgArmBodyAngleLeft: number;
  avgArmBodyAngleRight: number;
  avgLeftKneeAngle: number;
  avgRightKneeAngle: number;
}

interface ExerciseBiomechanicsSummaryDocument {
  _id?: string;
  fitness_session_id: ObjectId;
  user_id?: string;
  exercise_name: string;
  avg_left_elbow_angle: number;
  avg_right_elbow_angle: number;
  avg_esh_left: number;
  avg_esh_right: number;
  avg_arm_body_angle_left: number;
  avg_arm_body_angle_right: number;
  avg_left_knee_angle: number;
  avg_right_knee_angle: number;
}

function serializeFitnessSession(
  doc: FitnessSessionSummaryDocument & { _id?: unknown }
): FitnessSessionSummary {
  return {
    _id: doc._id ? String(doc._id) : undefined,
    userId: doc.user_id,
    exerciseName: doc.exercise_name,
    startedAt: doc.started_at,
    endedAt: doc.ended_at,
    durationSeconds: doc.duration_seconds,
    repsCompleted: doc.reps_completed,
    sessionStatus: doc.session_status,
    avgFormScore: doc.avg_form_score,
    avgPostureScore: doc.avg_posture_score,
    avgArmPositionScore: doc.avg_arm_position_score,
    avgVisibilityScore: doc.avg_visibility_score,
    validPositionPct: doc.valid_position_pct,
    bestRepScore: doc.best_rep_score,
    worstRepScore: doc.worst_rep_score,
  };
}

function serializeExerciseBiomechanics(
  doc: ExerciseBiomechanicsSummaryDocument & { _id?: unknown }
): ExerciseBiomechanicsSummary {
  return {
    _id: doc._id ? String(doc._id) : undefined,
    fitnessSessionId: String(doc.fitness_session_id),
    userId: doc.user_id,
    exerciseName: doc.exercise_name,
    avgLeftElbowAngle: doc.avg_left_elbow_angle,
    avgRightElbowAngle: doc.avg_right_elbow_angle,
    avgEshLeft: doc.avg_esh_left,
    avgEshRight: doc.avg_esh_right,
    avgArmBodyAngleLeft: doc.avg_arm_body_angle_left,
    avgArmBodyAngleRight: doc.avg_arm_body_angle_right,
    avgLeftKneeAngle: doc.avg_left_knee_angle,
    avgRightKneeAngle: doc.avg_right_knee_angle,
  };
}

export async function saveFitnessSessionSummary(session: FitnessSessionSummary) {
  const db = await getDatabase();
  const { _id, ...sessionData } = session;
  const payload: FitnessSessionSummaryDocument = {
    user_id: sessionData.userId,
    exercise_name: sessionData.exerciseName,
    started_at: new Date(sessionData.startedAt),
    ended_at: new Date(sessionData.endedAt),
    duration_seconds: sessionData.durationSeconds,
    reps_completed: sessionData.repsCompleted,
    session_status: sessionData.sessionStatus,
    avg_form_score: sessionData.avgFormScore,
    avg_posture_score: sessionData.avgPostureScore,
    avg_arm_position_score: sessionData.avgArmPositionScore,
    avg_visibility_score: sessionData.avgVisibilityScore,
    valid_position_pct: sessionData.validPositionPct,
    best_rep_score: sessionData.bestRepScore,
    worst_rep_score: sessionData.worstRepScore,
  };
  const result = await db
    .collection<FitnessSessionSummaryDocument>(FITNESS_SESSIONS_COLLECTION)
    .insertOne(payload);
  return result;
}

export async function saveExerciseBiomechanicsSummary(
  summary: ExerciseBiomechanicsSummary
) {
  const db = await getDatabase();
  const { _id, fitnessSessionId, ...summaryData } = summary;
  const payload: ExerciseBiomechanicsSummaryDocument = {
    fitness_session_id: new ObjectId(fitnessSessionId),
    user_id: summaryData.userId,
    exercise_name: summaryData.exerciseName,
    avg_left_elbow_angle: summaryData.avgLeftElbowAngle,
    avg_right_elbow_angle: summaryData.avgRightElbowAngle,
    avg_esh_left: summaryData.avgEshLeft,
    avg_esh_right: summaryData.avgEshRight,
    avg_arm_body_angle_left: summaryData.avgArmBodyAngleLeft,
    avg_arm_body_angle_right: summaryData.avgArmBodyAngleRight,
    avg_left_knee_angle: summaryData.avgLeftKneeAngle,
    avg_right_knee_angle: summaryData.avgRightKneeAngle,
  };
  const result = await db
    .collection<ExerciseBiomechanicsSummaryDocument>(
      FITNESS_EXERCISE_BIOMECHANICS_COLLECTION
    )
    .insertOne(payload);
  return result;
}

export async function getUserFitnessSessions(userId: string, limit: number = 10) {
  const db = await getDatabase();
  const sessions = await db
    .collection<FitnessSessionSummaryDocument>(FITNESS_SESSIONS_COLLECTION)
    .find({ user_id: userId })
    .sort({ ended_at: -1 })
    .limit(limit)
    .toArray();
  return sessions.map(serializeFitnessSession);
}

export async function getUserExerciseBiomechanics(userId: string, limit: number = 10) {
  const db = await getDatabase();
  const summaries = await db
    .collection<ExerciseBiomechanicsSummaryDocument>(
      FITNESS_EXERCISE_BIOMECHANICS_COLLECTION
    )
    .find({ user_id: userId })
    .sort({ _id: -1 })
    .limit(limit)
    .toArray();
  return summaries.map(serializeExerciseBiomechanics);
}

export async function getFitnessSessionStats(userId: string) {
  const db = await getDatabase();
  const stats = await db
    .collection<FitnessSessionSummaryDocument>(FITNESS_SESSIONS_COLLECTION)
    .aggregate([
      { $match: { user_id: userId } },
      {
        $group: {
          _id: '$exercise_name',
          totalReps: { $sum: '$reps_completed' },
          totalSessions: { $sum: 1 },
          avgFormScore: { $avg: '$avg_form_score' },
          avgPostureScore: { $avg: '$avg_posture_score' },
          bestFormScore: { $max: '$best_rep_score' },
        },
      },
    ])
    .toArray();
  return stats;
}
