type LogLevel = "info" | "warn" | "error";

interface LogContext {
  event: string;
  requestId?: string;
  errorCode?: string;
}

export function log(level: LogLevel, message: string, context: LogContext): void {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context
  });

  if (level === "error") {
    console.error(entry);
    return;
  }

  if (level === "warn") {
    console.warn(entry);
    return;
  }

  console.info(entry);
}

