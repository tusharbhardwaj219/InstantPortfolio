'use strict';

const { ZodError } = require('zod');
const { JsonWebTokenError, TokenExpiredError } = require('jsonwebtoken');
const logger = require('../utils/logger.utils');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error('Unhandled error', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Prisma errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'A record with that value already exists',
      errors: err.meta ? [{ field: err.meta.target, message: 'Must be unique' }] : null,
    });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'Record not found',
      errors: null,
    });
  }

  // JWT errors
  if (err instanceof TokenExpiredError) {
    return res.status(401).json({
      success: false,
      message: 'Token has expired. Please log in again.',
      errors: null,
    });
  }
  if (err instanceof JsonWebTokenError) {
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token',
      errors: null,
    });
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'File is too large. Maximum allowed size is 10 MB.',
      errors: null,
    });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected file field. Use "resume" as the field name.',
      errors: null,
    });
  }
  if (err.message === 'INVALID_FILE_TYPE') {
    return res.status(415).json({
      success: false,
      message: 'Invalid file type. Only PDF and DOCX files are accepted.',
      errors: null,
    });
  }

  // Custom application errors with a statusCode
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: null,
    });
  }

  // Default 500
  const isProd = process.env.NODE_ENV === 'production';
  return res.status(500).json({
    success: false,
    message: isProd ? 'Internal server error' : err.message,
    errors: isProd ? null : { stack: err.stack },
  });
}

module.exports = { errorHandler };
