import { Redis } from "ioredis";

export const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

redis.on("error", (err) => {
  if (process.env.NODE_ENV !== "test") {
    console.warn("[redis] Connection error (workers disabled):", err.message);
  }
});
