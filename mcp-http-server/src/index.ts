#!/usr/bin/env node

import { loadConfig, Logger } from './config.js';
import { GraphitiMCPServer } from './server.js';

/**
 * Main entry point for GraphiTi MCP Server
 */
async function main() {
  try {
    // Load configuration
    const config = loadConfig();
    const logger = new Logger(config);

    logger.info('='.repeat(60));
    logger.info('GraphiTi MCP Server');
    logger.info('='.repeat(60));
    logger.info(`Version: 0.1.0`);
    logger.info(`Transport: ${config.transport}`);
    logger.info(`GraphiTi API: ${config.apiUrl}`);
    logger.info(`Log Level: ${config.logLevel}`);
    if (config.defaultGroupId) {
      logger.info(`Default Group ID: ${config.defaultGroupId}`);
    }
    logger.info('='.repeat(60));

    // Create and start server
    const server = new GraphitiMCPServer(config, logger);

    if (config.transport === 'stdio') {
      await server.startStdio();
    } else if (config.transport === 'http') {
      await server.startHTTP();
    } else {
      throw new Error(`Unknown transport: ${config.transport}`);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
main();
