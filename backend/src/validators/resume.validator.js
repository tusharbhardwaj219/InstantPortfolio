'use strict';

const { z } = require('zod');

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const resumeUploadSchema = z.object({
  mimetype: z
    .string()
    .refine((val) => ALLOWED_MIME_TYPES.includes(val), {
      message: 'Only PDF and DOCX files are allowed',
    }),
});

module.exports = { resumeUploadSchema, ALLOWED_MIME_TYPES };
