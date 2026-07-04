'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Generate a signed JWT for the given payload.
 * @param {object} payload
 * @returns {string} signed token
 */
function generateToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

/**
 * Verify and decode a JWT.
 * @param {string} token
 * @returns {object} decoded payload
 * @throws if the token is invalid or expired
 */
function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

module.exports = { generateToken, verifyToken };
