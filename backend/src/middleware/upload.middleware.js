'use strict';

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, env.UPLOAD_DIR);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = uuidv4();
    cb(null, `${unique}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error('INVALID_FILE_TYPE');
    err.code = 'INVALID_FILE_TYPE';
    cb(err, false);
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE,
  },
});

const uploadResume = upload.single('resume');

module.exports = { uploadResume };
