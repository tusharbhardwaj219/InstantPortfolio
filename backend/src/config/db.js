'use strict';

const { PrismaClient } = require('@prisma/client');
const env = require('./env');

const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

async function connectDB() {
  try {
    await prisma.$connect();
    const logger = require('../utils/logger.utils');
    logger.info('Database connected successfully');
  } catch (error) {
    const logger = require('../utils/logger.utils');
    logger.error('Database connection failed', { error: error.message });
    throw error;
  }
}

module.exports = { prisma, connectDB };
