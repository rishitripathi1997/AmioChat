export type LogLevel = 'info' | 'warn' | 'error';

export interface LogFields {
  service: 'amiochat-rest' | 'amiochat-ws';
  correlationId?: string;
  [key: string]: unknown;
}

export function log(level: LogLevel, message: string, fields: LogFields): void {
  const line = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...fields,
  });

  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}
