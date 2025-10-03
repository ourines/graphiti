import { config as dotenvConfig } from 'dotenv';

// Load .env file
dotenvConfig();

/**
 * Configuration interface for the Graphiti MCP Server
 */
export interface GraphitiConfig {
  // MCP Server settings
  port: number;
  host: string;
  transport: 'stdio' | 'http';

  // Graphiti FastAPI backend
  apiUrl: string;
  apiHeaders: Record<string, string>;

  // Optional defaults
  defaultGroupId?: string;

  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';

  // Timeouts
  requestTimeout: number;
}

/**
 * Parse headers from environment variable
 * Supports two formats:
 * 1. JSON: {"Authorization":"Bearer token","X-Key":"value"}
 * 2. Simple: Authorization:Bearer token,X-Key:value
 */
function parseHeaders(headersStr?: string): Record<string, string> {
  if (!headersStr || headersStr.trim() === '') {
    return {};
  }

  // Try JSON format first
  if (headersStr.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(headersStr);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse headers as JSON:', e);
    }
  }

  // Fall back to simple format: Key1:Value1,Key2:Value2
  const headers: Record<string, string> = {};
  const pairs = headersStr.split(',');

  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split(':');
    const value = valueParts.join(':'); // Handle colons in value

    if (key && value) {
      headers[key.trim()] = value.trim();
    }
  }

  return headers;
}

/**
 * Validate required configuration
 */
function validateConfig(config: GraphitiConfig): void {
  if (!config.apiUrl) {
    throw new Error('GRAPHITI_API_URL is required');
  }

  try {
    new URL(config.apiUrl);
  } catch (e) {
    throw new Error(`Invalid GRAPHITI_API_URL: ${config.apiUrl}`);
  }

  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid MCP_PORT: ${config.port}. Must be between 1 and 65535`);
  }

  if (!['stdio', 'http'].includes(config.transport)) {
    throw new Error(`Invalid MCP_TRANSPORT: ${config.transport}. Must be 'stdio' or 'http'`);
  }

  // Validate log level
  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(config.logLevel)) {
    throw new Error(
      `Invalid LOG_LEVEL: ${config.logLevel}. Must be one of: ${validLogLevels.join(', ')}`
    );
  }

  // Validate timeout
  if (config.requestTimeout < 1000 || config.requestTimeout > 300000) {
    throw new Error(
      `Invalid GRAPHITI_REQUEST_TIMEOUT: ${config.requestTimeout}. Must be between 1000 and 300000 (1s to 5min)`
    );
  }
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): GraphitiConfig {
  const config: GraphitiConfig = {
    // MCP Server
    port: parseInt(process.env.MCP_PORT || '3000', 10),
    host: process.env.MCP_HOST || 'localhost',
    transport: (process.env.MCP_TRANSPORT || 'stdio') as 'stdio' | 'http',

    // Graphiti API
    apiUrl: process.env.GRAPHITI_API_URL || '',
    apiHeaders: parseHeaders(process.env.GRAPHITI_API_HEADERS),

    // Optional
    defaultGroupId: process.env.GRAPHITI_DEFAULT_GROUP_ID,

    // Logging
    logLevel: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',

    // Timeout
    requestTimeout: parseInt(process.env.GRAPHITI_REQUEST_TIMEOUT || '30000', 10),
  };

  validateConfig(config);

  return config;
}

/**
 * Simple logger based on log level
 */
export class Logger {
  private levels = { debug: 0, info: 1, warn: 2, error: 3 };
  private currentLevel: number;

  // List of sensitive field names to redact
  private sensitiveKeys = [
    'token',
    'api_key',
    'apikey',
    'api-key',
    'password',
    'secret',
    'authorization',
    'auth',
    'bearer',
    'key',
    'credential',
    'credentials',
  ];

  constructor(config: GraphitiConfig) {
    this.currentLevel = this.levels[config.logLevel];
  }

  /**
   * Sanitize sensitive data from objects/arrays before logging
   */
  private sanitize(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item));
    }

    if (typeof data === 'object') {
      const sanitized: Record<string, unknown> = {};
      const obj = data as Record<string, unknown>;

      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = this.sensitiveKeys.some((sensitive) =>
          lowerKey.includes(sensitive)
        );

        if (isSensitive) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }

      return sanitized;
    }

    return data;
  }

  debug(...args: unknown[]): void {
    if (this.currentLevel <= this.levels.debug) {
      const sanitized = args.map((arg) => this.sanitize(arg));
      console.error('[DEBUG]', ...sanitized);
    }
  }

  info(...args: unknown[]): void {
    if (this.currentLevel <= this.levels.info) {
      const sanitized = args.map((arg) => this.sanitize(arg));
      console.error('[INFO]', ...sanitized);
    }
  }

  warn(...args: unknown[]): void {
    if (this.currentLevel <= this.levels.warn) {
      const sanitized = args.map((arg) => this.sanitize(arg));
      console.error('[WARN]', ...sanitized);
    }
  }

  error(...args: unknown[]): void {
    if (this.currentLevel <= this.levels.error) {
      const sanitized = args.map((arg) => this.sanitize(arg));
      console.error('[ERROR]', ...sanitized);
    }
  }
}
