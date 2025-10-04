/**
 * Authentication Middleware for MCP Server
 * Implements MCP Standard OAuth 2.1 Bearer Token Authentication
 *
 * Supports:
 * - Bearer Token authentication (recommended)
 * - API Key authentication (simpler alternative)
 * - Public endpoints (no auth required)
 */

import type { Request, Response, NextFunction } from 'express';
import type { GraphitiConfig, Logger } from './config.js';

/**
 * Create authentication middleware based on configuration
 */
export function createAuthMiddleware(config: GraphitiConfig, logger: Logger) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip authentication if disabled
    if (!config.auth.enabled) {
      return next();
    }

    // Check if this is a public endpoint
    const isPublicEndpoint = config.auth.publicEndpoints.some(
      (endpoint) => req.path === endpoint || req.path.startsWith(`${endpoint}/`)
    );

    if (isPublicEndpoint) {
      logger.debug(`Public endpoint accessed: ${req.path}`);
      return next();
    }

    // Validate authentication based on configured method
    try {
      if (config.auth.method === 'bearer') {
        await validateBearerToken(req, config, logger);
      } else if (config.auth.method === 'apikey') {
        await validateApiKey(req, config, logger);
      }

      // Authentication successful
      next();
    } catch (error) {
      // Authentication failed
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      logger.warn(`Authentication failed for ${req.method} ${req.path}: ${errorMessage}`);

      // Return MCP-compliant error response
      if (config.auth.method === 'bearer') {
        res.status(401).json({
          error: 'unauthorized',
          message: errorMessage,
        });
        res.setHeader('WWW-Authenticate', 'Bearer realm="MCP Server"');
      } else {
        res.status(401).json({
          error: 'unauthorized',
          message: errorMessage,
        });
      }
    }
  };
}

/**
 * Validate Bearer Token (OAuth 2.1 standard)
 *
 * Expected header format: Authorization: Bearer <token>
 */
async function validateBearerToken(
  req: Request,
  config: GraphitiConfig,
  logger: Logger
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Invalid Authorization header format. Expected: Bearer <token>');
  }

  const token = authHeader.substring(7).trim(); // Remove "Bearer " prefix

  if (!token) {
    throw new Error('Empty bearer token');
  }

  // Validate token against configured value
  if (token !== config.auth.bearerToken) {
    throw new Error('Invalid bearer token');
  }

  logger.debug('Bearer token validated successfully');
}

/**
 * Validate API Key
 *
 * Expected header format: X-API-Key: <key>
 */
async function validateApiKey(
  req: Request,
  config: GraphitiConfig,
  logger: Logger
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    throw new Error('Missing X-API-Key header');
  }

  if (!apiKey.trim()) {
    throw new Error('Empty API key');
  }

  // Validate API key against configured value
  if (apiKey !== config.auth.apiKey) {
    throw new Error('Invalid API key');
  }

  logger.debug('API key validated successfully');
}

/**
 * Utility function to check if request is authenticated
 * Can be used in route handlers for additional checks
 */
export function isAuthenticated(req: Request, config: GraphitiConfig): boolean {
  if (!config.auth.enabled) {
    return true; // Auth disabled, consider all requests authenticated
  }

  try {
    if (config.auth.method === 'bearer') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return false;
      const token = authHeader.substring(7).trim();
      return token === config.auth.bearerToken;
    } else if (config.auth.method === 'apikey') {
      const apiKey = req.headers['x-api-key'] as string;
      return apiKey === config.auth.apiKey;
    }
  } catch {
    return false;
  }

  return false;
}
