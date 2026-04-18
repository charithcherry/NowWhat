import { MongoClient, Db } from "mongodb";

const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const DB_NAME =
  (process.env.MONGODB_DB || process.env.MONGODB_DATABASE || "wellbeing_app").trim() ||
  "wellbeing_app";

let clientPromise: Promise<MongoClient> | null = null;

function getClientPromise(): Promise<MongoClient> {
  if (clientPromise) return clientPromise;

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  const globalWithMongo = global as typeof globalThis & {
    _communityMongoPromise?: Promise<MongoClient>;
  };

  if (process.env.NODE_ENV === "development") {
    if (!globalWithMongo._communityMongoPromise) {
      const client = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
      });
      globalWithMongo._communityMongoPromise = client.connect();
    }
    clientPromise = globalWithMongo._communityMongoPromise;
  } else {
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
    clientPromise = client.connect();
  }

  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(DB_NAME);
}

// Alias so shared auth.ts (which imports getDatabase) works consistently
export const getDatabase = getDb;
