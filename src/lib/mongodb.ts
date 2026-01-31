import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.warn("Warning: MONGODB_URI is not defined in environment variables");
}

interface MongooseConnection {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseConnection: MongooseConnection | undefined;
}

let cached = global.mongooseConnection;

if (!cached) {
  cached = global.mongooseConnection = { conn: null, promise: null };
}

export async function connectMongoDB(): Promise<typeof mongoose | null> {
  if (!MONGODB_URI) {
    console.warn("MongoDB connection skipped: MONGODB_URI not configured");
    return null;
  }

  if (cached!.conn) {
    return cached!.conn;
  }

  if (!cached!.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, // 5 second timeout
      connectTimeoutMS: 5000,
    };

    cached!.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log("✅ MongoDB connected successfully");
      return mongoose;
    });
  }

  try {
    cached!.conn = await cached!.promise;
  } catch (e) {
    cached!.promise = null;
    console.warn(
      "⚠️  MongoDB connection failed. MongoDB features will be disabled.",
    );
    console.warn("   Error:", (e as Error).message);
    return null;
  }

  return cached!.conn;
}

export default mongoose;
