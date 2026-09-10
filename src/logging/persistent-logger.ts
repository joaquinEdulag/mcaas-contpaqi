import type { LoggerService, LogLevel } from '@nestjs/common';
import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { inspect } from 'node:util';

const ERROR_LEVELS = new Set(['ERROR', 'FATAL']);

export class PersistentLogger implements LoggerService {
  private readonly logDirectory: string;
  private enabledLevels = new Set<string>(['log', 'error', 'warn', 'debug', 'verbose', 'fatal']);

  constructor(logDirectory = process.env.LOG_DIRECTORY?.trim() || './logs') {
    this.logDirectory = resolve(logDirectory);
    mkdirSync(this.logDirectory, { recursive: true });
  }

  get directory(): string {
    return this.logDirectory;
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('INFO', 'log', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('ERROR', 'error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('WARN', 'warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('DEBUG', 'debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('VERBOSE', 'verbose', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('FATAL', 'fatal', message, optionalParams);
  }

  setLogLevels(levels: LogLevel[]): void {
    this.enabledLevels = new Set(levels);
  }

  private write(
    displayLevel: string,
    nestLevel: string,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    if (!this.enabledLevels.has(nestLevel)) return;

    const params = [...optionalParams];
    let context = '';
    if (params.length > 0 && typeof params[params.length - 1] === 'string') {
      context = String(params.pop());
    }

    const timestamp = new Date().toISOString();
    const contextPart = context ? ` [${context}]` : '';
    const details = [message, ...params].map((value) => this.render(value)).filter(Boolean).join(' ');
    const line = `[${timestamp}] [${displayLevel}]${contextPart} ${details}\n`;

    try {
      const stream = ERROR_LEVELS.has(displayLevel) ? process.stderr : process.stdout;
      stream.write(line);
    } catch {
      // No interrumpir el puente si la consola deja de estar disponible.
    }

    try {
      appendFileSync(this.dailyPath('mcaas'), line, 'utf8');
      if (ERROR_LEVELS.has(displayLevel)) {
        appendFileSync(this.dailyPath('errors'), line, 'utf8');
      }
    } catch (error) {
      try {
        process.stderr.write(
          `[${timestamp}] [LOGGER-ERROR] No fue posible escribir logs en ${this.logDirectory}: ${this.render(error)}\n`,
        );
      } catch {
        // Último recurso: no lanzar una excepción desde el logger.
      }
    }
  }

  private dailyPath(prefix: string): string {
    const day = new Date().toISOString().slice(0, 10);
    return resolve(this.logDirectory, `${prefix}-${day}.log`);
  }

  private render(value: unknown): string {
    if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`;
    if (typeof value === 'string') return value;
    return inspect(value, { depth: 6, breakLength: 160, compact: true });
  }
}
