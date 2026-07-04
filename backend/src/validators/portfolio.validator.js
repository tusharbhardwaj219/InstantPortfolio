'use strict';

const { z } = require('zod');

/** Allow a valid value, empty string, or null (field cleared). */
const optionalUrl = z.union([z.string().url('Must be a valid URL'), z.literal('')]).optional().nullable();

const updatePortfolioSchema = z.object({
  fullName:  z.string().max(120).optional().nullable(),
  headline:  z.string().max(160).optional().nullable(),
  summary:   z.string().max(2000).optional().nullable(),
  email:     z.union([z.string().email('Must be a valid email'), z.literal('')]).optional().nullable(),
  phone:     z.string().max(30).optional().nullable(),
  location:  z.string().max(120).optional().nullable(),
  github:    optionalUrl,
  linkedin:  optionalUrl,
  website:   optionalUrl,
});

module.exports = { updatePortfolioSchema };
