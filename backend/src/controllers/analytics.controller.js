'use strict';

const AnalyticsService = require('../services/analytics.service');
const { sendSuccess } = require('../utils/response.utils');

async function getAnalytics(req, res, next) {
  try {
    const analytics = await AnalyticsService.getAnalytics(req.params.portfolioId, req.user.id);
    return sendSuccess(res, { analytics }, 'Analytics retrieved');
  } catch (err) {
    return next(err);
  }
}

module.exports = { getAnalytics };
