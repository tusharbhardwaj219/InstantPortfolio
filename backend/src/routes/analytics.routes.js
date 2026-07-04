'use strict';

const { Router } = require('express');
const { getAnalytics } = require('../controllers/analytics.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = Router();

router.get('/:portfolioId', authenticate, getAnalytics);

module.exports = router;
