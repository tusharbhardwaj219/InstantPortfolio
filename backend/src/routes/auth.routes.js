'use strict';

const { Router } = require('express');
const { signup, login, getMe, logout } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { signupSchema, loginSchema } = require('../validators/auth.validator');

const router = Router();

router.post('/signup', validate(signupSchema), signup);
router.post('/login',  validate(loginSchema),  login);
router.get('/me',      authenticate,           getMe);
router.post('/logout', authenticate,           logout);

module.exports = router;
