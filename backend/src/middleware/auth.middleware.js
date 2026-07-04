'use strict';

const { verifyToken } = require('../utils/jwt.utils');
const { prisma } = require('../config/db');
const { sendError } = require('../utils/response.utils');
const logger = require('../utils/logger.utils');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication token is required', 401);
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return sendError(res, 'Authentication token is required', 401);
    }

    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return sendError(res, 'User not found', 401);
    }

    req.user = user;
    return next();
  } catch (error) {
    logger.warn('Authentication failed', { error: error.message });
    return next(error);
  }
}

module.exports = { authenticate };
