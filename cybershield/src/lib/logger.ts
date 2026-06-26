type LogContext = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", message: string, context?: LogContext) {
  const entry = { level, message, timestamp: new Date().toISOString(), ...context };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, error?: unknown, context?: LogContext) =>
    emit("error", message, {
      ...context,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
    }),
};
