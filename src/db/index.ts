import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required — set it in Vercel environment variables");
}

// [DB:POOL] Vercel serverless-compatible pool.
// Drizzle uses unnamed queries unless explicitly prepared; compatible with transaction pooling.
const globalForDb = globalThis as typeof globalThis & {
  __mgPool?: Pool;
};

export const pool =
  globalForDb.__mgPool ??
  new Pool({
    connectionString: databaseUrl,
    // Supabase + pgbouncer needs these settings
    ssl: databaseUrl.includes("supabase.com") ? { rejectUnauthorized: false } : false,
    max: 1, // serverless: keep pool small
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__mgPool = pool;
}

export const db = drizzle(pool);
