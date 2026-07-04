'use strict';

const PortfolioService = require('../services/portfolio.service');
const { sendSuccess, sendError } = require('../utils/response.utils');

async function getBySlug(req, res, next) {
  try {
    const isFirstVisit = req.query.new === '1';
    const portfolio = await PortfolioService.getBySlug(req.params.slug, isFirstVisit);
    return sendSuccess(res, { portfolio }, 'Portfolio retrieved');
  } catch (err) {
    return next(err);
  }
}

async function getUserPortfolio(req, res, next) {
  try {
    const portfolio = await PortfolioService.getUserPortfolio(req.user.id);
    return sendSuccess(res, { portfolio }, 'Portfolio retrieved');
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const portfolio = await PortfolioService.update(req.params.id, req.user.id, req.body);
    return sendSuccess(res, { portfolio }, 'Portfolio updated');
  } catch (err) {
    return next(err);
  }
}

async function deletePortfolio(req, res, next) {
  try {
    await PortfolioService.delete(req.params.id, req.user.id);
    return sendSuccess(res, null, 'Portfolio deleted successfully');
  } catch (err) {
    return next(err);
  }
}

module.exports = { getBySlug, getUserPortfolio, update, deletePortfolio };
