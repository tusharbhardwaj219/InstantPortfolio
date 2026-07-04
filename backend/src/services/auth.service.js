'use strict';

const bcrypt = require('bcryptjs');
const { prisma } = require('../config/db');
const { generateToken } = require('../utils/jwt.utils');
const logger = require('../utils/logger.utils');

const BCRYPT_ROUNDS = 12;

const AuthService = {
  /**
   * Create a new user account and return the user + signed JWT.
   * @param {{ firstName: string, lastName: string, email: string, password: string }} data
   */
  async signup({ firstName, lastName, email, password }) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      const err = new Error('An account with this email already exists');
      err.statusCode = 409;
      throw err;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: { firstName, lastName, email, passwordHash },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const token = generateToken({ userId: user.id });

    logger.info('New user registered', { userId: user.id, email: user.email });

    return { user, token };
  },

  /**
   * Verify credentials and return the user + signed JWT.
   * @param {{ email: string, password: string }} data
   */
  async login({ email, password }) {
    // Use generic message to avoid user enumeration
    const genericError = new Error('Invalid email or password');
    genericError.statusCode = 401;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw genericError;

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) throw genericError;

    const { passwordHash: _omit, ...safeUser } = user;

    const token = generateToken({ userId: user.id });

    logger.info('User logged in', { userId: user.id });

    return { user: safeUser, token };
  },

  /**
   * Return the authenticated user's profile (no passwordHash).
   * @param {string} userId
   */
  async getMe(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    return user;
  },
};

module.exports = AuthService;
