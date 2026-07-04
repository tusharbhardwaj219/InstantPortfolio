'use strict';

require('dotenv').config();

const { connectDB } = require('./src/config/db');
const app = require('./src/app');
const logger = require('./src/utils/logger.utils');

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

start().catch((err) => {
  logger.error('Failed to start server', { error: err.message, stack: err.stack });
  process.exit(1);
});

