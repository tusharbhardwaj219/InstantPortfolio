'use strict';

const { Router } = require('express');
const { upload, getUserResumes, deleteResume } = require('../controllers/resume.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { uploadResume } = require('../middleware/upload.middleware');

const router = Router();

router.post('/upload', authenticate, uploadResume, upload);
router.get('/',        authenticate, getUserResumes);
router.delete('/:id',  authenticate, deleteResume);

module.exports = router;
