/**
 * Minimal structured logger. Emits one JSON object per line (level, time,
 * message, and any structured fields) so logs are machine-parseable by
 * aggregators (Loki, ELK, CloudWatch, …) in production, while staying readable
 * enough in a terminal. Intentionally dependency-free.
 */
type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// LOG_LEVEL env var gates output; defaults to debug in dev, info otherwise.
const threshold =
  LEVEL_ORDER[(process.env.LOG_LEVEL as Level) ?? (process.env.NODE_ENV === "production" ? "info" : "debug")] ?? 20;

function emit(level: Level, message: string, fields?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < threshold) return;
  const line = JSON.stringify({ level, time: new Date().toISOString(), message, ...fields });
  // Route warn/error to stderr, everything else to stdout.
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: Record<string, unknown>) => emit("debug", message, fields),
  info: (message: string, fields?: Record<string, unknown>) => emit("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => emit("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) => emit("error", message, fields),
};
