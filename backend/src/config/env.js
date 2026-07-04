'use strict';

require('dotenv').config();

const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
}

if (process.env.DATABASE_URL.includes('<db_password>')) {
  throw new Error(
    'DATABASE_URL still contains the <db_password> placeholder. ' +
      'Edit backend/.env and insert your real MongoDB Atlas password.'
  );
}

if (
  process.env.NODE_ENV === 'production' &&
  process.env.JWT_SECRET === 'your_super_secret_jwt_key_here_min_32_chars'
) {
  throw new Error('JWT_SECRET is still the default placeholder. Set a real secret before deploying.');
}

module.exports = {
  PORT: process.env.PORT || '5000',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE, 10) || 10485760,
  NODE_ENV: process.env.NODE_ENV || 'development',
  // Comma-separated allowlist of origins (never '*' — tokens are sent in headers)
  CORS_ORIGINS: (process.env.CORS_ORIGIN || 'http://localhost:5000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};
