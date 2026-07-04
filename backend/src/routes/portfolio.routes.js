'use strict';

const { Router } = require('express');
const {
  getBySlug,
  getUserPortfolio,
  update,
  deletePortfolio,
} = require('../controllers/portfolio.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { updatePortfolioSchema } = require('../validators/portfolio.validator');

const router = Router();

// Public — no auth required
router.get('/public/:slug', getBySlug);

// Protected
router.get('/user',   authenticate, getUserPortfolio);
router.put('/:id',    authenticate, validate(updatePortfolioSchema), update);
router.delete('/:id', authenticate, deletePortfolio);

module.exports = router;
