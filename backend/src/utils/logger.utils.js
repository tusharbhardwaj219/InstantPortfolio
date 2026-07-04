'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');

const { combine, timestamp, errors, json, colorize, simple } = format;

const isDev = process.env.NODE_ENV !== 'production';

const logger = createLogger({
  level: isDev ? 'debug' : 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    isDev ? simple() : json()
  ),
  transports: [
    new transports.Console({
      format: isDev
        ? combine(colorize({ all: true }), simple())
        : combine(timestamp(), json()),
    }),
    new transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
    }),
    new transports.File({
      filename: path.join('logs', 'combined.log'),
    }),
  ],
  exceptionHandlers: [
    new transports.File({ filename: path.join('logs', 'exceptions.log') }),
  ],
  rejectionHandlers: [
    new transports.File({ filename: path.join('logs', 'rejections.log') }),
  ],
});

module.exports = logger;
