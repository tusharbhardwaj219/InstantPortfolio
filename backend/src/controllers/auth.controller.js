'use strict';

const AuthService = require('../services/auth.service');
const { sendSuccess, sendError } = require('../utils/response.utils');
const logger = require('../utils/logger.utils');

async function signup(req, res, next) {
  try {
    const { user, token } = await AuthService.signup(req.body);
    return sendSuccess(res, { user, token }, 'Account created successfully', 201);
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { user, token } = await AuthService.login(req.body);
    return sendSuccess(res, { user, token }, 'Login successful');
  } catch (err) {
    return next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await AuthService.getMe(req.user.id);
    return sendSuccess(res, { user }, 'User profile retrieved');
  } catch (err) {
    return next(err);
  }
}

function logout(req, res) {
  // JWT is stateless — just confirm to the client
  return sendSuccess(res, null, 'Logged out successfully');
}

module.exports = { signup, login, getMe, logout };
