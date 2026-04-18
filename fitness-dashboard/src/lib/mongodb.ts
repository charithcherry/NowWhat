import { MongoClient } from 'mongodb';

const options = {};

let client: MongoClient | undefined;
let clientPromise: Promise<MongoClient> | undefined;

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
  }
  return uri;
}

function getClientPromise(): Promise<MongoClient> {
  if (clientPromise) {
    return clientPromise;
  }

  const uri = getMongoUri();

  if (process.env.NODE_ENV === 'development') {
    const globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>
    };

    if (!globalWithMongo._mongoClientPromise) {
      client = new MongoClient(uri, options);
      globalWithMongo._mongoClientPromise = client.connect();
    }

    clientPromise = globalWithMongo._mongoClientPromise;
    return clientPromise;
  }

  client = new MongoClient(uri, options);
  clientPromise = client.connect();
  return clientPromise;
}

export default getClientPromise;

export async function getDatabase() {
  const activeClient = await getClientPromise();
  return activeClient.db(process.env.MONGODB_DB || "wellbeing_app");
}
