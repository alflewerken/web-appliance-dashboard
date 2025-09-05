#!/usr/bin/env node

/**
 * Background Polling Worker
 * This worker runs as a separate process to collect SNMP metrics
 * from configured hosts at regular intervals.
 */

const pollingService = require('./services/BackgroundPollingService');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'polling-worker' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `[${timestamp}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      )
    }),
    // Also log to file
    new winston.transports.File({
      filename: '/var/log/snmp-polling-error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: '/var/log/snmp-polling-combined.log'
    })
  ]
});

// Handle process termination
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal, shutting down gracefully...');
  await shutdown();
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal, shutting down gracefully...');
  await shutdown();
});

process.on('uncaughtException', async (error) => {
  logger.error('Uncaught exception:', error);
  await shutdown(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  await shutdown(1);
});

async function shutdown(exitCode = 0) {
  try {
    await pollingService.stop();
    logger.info('Polling worker shutdown complete');
    process.exit(exitCode);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Main worker function
async function main() {
  logger.info('Starting SNMP Polling Worker...');
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Database: ${process.env.DB_HOST || 'localhost'}/${process.env.DB_NAME || 'appliance_dashboard'}`);
  logger.info(`Poll Interval: ${process.env.SNMP_POLL_INTERVAL || 60} seconds`);

  try {
    // Initialize the polling service
    await pollingService.initialize();
    
    // Start polling
    await pollingService.start();
    
    logger.info('SNMP Polling Worker is running');
    logger.info(`Monitoring ${pollingService.getStatus().hostCount} hosts`);
    
    // Keep the process alive
    setInterval(() => {
      const status = pollingService.getStatus();
      logger.debug(`Worker status - Active hosts: ${status.hostCount}, Running: ${status.isRunning}`);
    }, 60000); // Log status every minute
    
  } catch (error) {
    logger.error('Failed to start polling worker:', error);
    await shutdown(1);
  }
}

// Start the worker
main().catch(error => {
  logger.error('Fatal error in main:', error);
  process.exit(1);
});
