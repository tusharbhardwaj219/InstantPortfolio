'use strict';

const { prisma } = require('../config/db');

const AnalyticsService = {
  /**
   * Return analytics for a portfolio, verifying ownership.
   * @param {string} portfolioId
   * @param {string} userId
   */
  async getAnalytics(portfolioId, userId) {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      select: { id: true, userId: true },
    });

    if (!portfolio) {
      const err = new Error('Portfolio not found');
      err.statusCode = 404;
      throw err;
    }
    if (portfolio.userId !== userId) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }

    const analytics = await prisma.analytics.upsert({
      where: { portfolioId },
      update: {},
      create: {
        portfolioId,
        totalViews: 0,
        uniqueViews: 0,
      },
    });

    return analytics;
  },
};

module.exports = AnalyticsService;
