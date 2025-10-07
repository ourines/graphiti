import { config as dotenvConfig } from 'dotenv';

// Load .env file
dotenvConfig();

/**
 * MCP Server Configuration Constants
 * Based on MCP best practices and security recommendations
 */
export const MCP_CONSTANTS = {
  // Session management
  SESSION_MAX_AGE_MS: 60 * 60 * 1000, // 1 hour
  SESSION_CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  MAX_SESSIONS: 1000, // Maximum concurrent sessions

  // Request limits
  MAX_BODY_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_CONCURRENT_REQUESTS: 100,

  // Rate limiting (per session/IP)
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100, // requests per window

  // Timeouts
  DEFAULT_REQUEST_TIMEOUT_MS: 30000, // 30 seconds
  GRACEFUL_SHUTDOWN_TIMEOUT_MS: 30000, // 30 seconds

  // MCP Protocol Error Codes
  ERROR_CODES: {
    // Authentication errors (-31xxx)
    UNAUTHORIZED: -31001,
    SESSION_NOT_FOUND: -31002,
    ORIGIN_NOT_ALLOWED: -31003,

    // Rate limiting (-30xxx)
    RATE_LIMIT_EXCEEDED: -30001,

    // Protocol errors (-32xxx) - JSON-RPC standard
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,
    SERVER_NOT_INITIALIZED: -32000,
    REQUEST_TOO_LARGE: -32001,
  }
} as const;

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

  // Security
  requireAuth: boolean;
  allowedOrigins?: string[]; // CORS allowed origins

  // Resource limits
  maxSessions: number;
  maxBodySize: number;
  sessionMaxAge: number;
  sessionCleanupInterval: number;

  // Rate limiting
  rateLimitEnabled: boolean;
  rateLimitWindow: number;
  rateLimitMaxRequests: number;

  // Optional defaults
  defaultGroupId?: string;

  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';

  // Timeouts
  requestTimeout: number;
  shutdownTimeout: number;
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
  // Build API headers (server-level, optional)
  // Token can also be provided per-request via X-GraphiTi-Token header
  let apiHeaders: Record<string, string> = {};

  // Priority 1: Simple token (optional, for backward compatibility)
  if (process.env.GRAPHITI_API_TOKEN) {
    apiHeaders['Authorization'] = `Bearer ${process.env.GRAPHITI_API_TOKEN}`;
  }
  // Priority 2: Custom headers (advanced)
  else if (process.env.GRAPHITI_API_HEADERS) {
    apiHeaders = parseHeaders(process.env.GRAPHITI_API_HEADERS);
  }

  // Parse allowed origins for CORS
  const allowedOrigins = process.env.MCP_ALLOWED_ORIGINS
    ? process.env.MCP_ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : undefined;

  const config: GraphitiConfig = {
    // MCP Server
    port: parseInt(process.env.MCP_PORT || '3100', 10),
    host: process.env.MCP_HOST || '0.0.0.0',
    transport: (process.env.MCP_TRANSPORT || 'http') as 'stdio' | 'http',

    // Graphiti API
    apiUrl: process.env.GRAPHITI_API_URL || '',
    apiHeaders,

    // Security
    requireAuth: process.env.MCP_REQUIRE_AUTH !== 'false',
    allowedOrigins,

    // Resource limits
    maxSessions: parseInt(process.env.MCP_MAX_SESSIONS || String(MCP_CONSTANTS.MAX_SESSIONS), 10),
    maxBodySize: parseInt(process.env.MCP_MAX_BODY_SIZE || String(MCP_CONSTANTS.MAX_BODY_SIZE), 10),
    sessionMaxAge: parseInt(process.env.MCP_SESSION_MAX_AGE || String(MCP_CONSTANTS.SESSION_MAX_AGE_MS), 10),
    sessionCleanupInterval: parseInt(process.env.MCP_SESSION_CLEANUP_INTERVAL || String(MCP_CONSTANTS.SESSION_CLEANUP_INTERVAL_MS), 10),

    // Rate limiting
    rateLimitEnabled: process.env.MCP_RATE_LIMIT_ENABLED !== 'false',
    rateLimitWindow: parseInt(process.env.MCP_RATE_LIMIT_WINDOW || String(MCP_CONSTANTS.RATE_LIMIT_WINDOW_MS), 10),
    rateLimitMaxRequests: parseInt(process.env.MCP_RATE_LIMIT_MAX_REQUESTS || String(MCP_CONSTANTS.RATE_LIMIT_MAX_REQUESTS), 10),

    // Optional
    defaultGroupId: process.env.GRAPHITI_DEFAULT_GROUP_ID,

    // Logging
    logLevel: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',

    // Timeouts
    requestTimeout: parseInt(process.env.GRAPHITI_REQUEST_TIMEOUT || String(MCP_CONSTANTS.DEFAULT_REQUEST_TIMEOUT_MS), 10),
    shutdownTimeout: parseInt(process.env.MCP_SHUTDOWN_TIMEOUT || String(MCP_CONSTANTS.GRACEFUL_SHUTDOWN_TIMEOUT_MS), 10),
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
