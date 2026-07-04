'use strict';

/**
 * Send a successful JSON response.
 * @param {import('express').Response} res
 * @param {*} data
 * @param {string} message
 * @param {number} statusCode
 */
function sendSuccess(res, data = null, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

/**
 * Send an error JSON response.
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} statusCode
 * @param {*} errors
 */
function sendError(res, message = 'An error occurred', statusCode = 400, errors = null) {
  const body = {
    success: false,
    message,
  };
  if (errors !== null) {
    body.errors = errors;
  }
  return res.status(statusCode).json(body);
}

module.exports = { sendSuccess, sendError };
