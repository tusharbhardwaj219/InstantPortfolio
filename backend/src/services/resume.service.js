'use strict';

const fs = require('fs');
const { prisma } = require('../config/db');
const ParseService = require('./parser.service');
const logger = require('../utils/logger.utils');

const ResumeService = {
  /**
   * Persist an uploaded resume file record in the database.
   * @param {string} userId
   * @param {Express.Multer.File} file
   */
  async upload(userId, file) {
    const resume = await prisma.resume.create({
      data: {
        userId,
        fileName: file.originalname,
        filePath: file.path,
        fileType: file.mimetype,
        fileSize: file.size,
      },
    });

    logger.info('Resume uploaded', { resumeId: resume.id, userId });
    return resume;
  },

  /**
   * Extract text from the file, parse it, and persist extracted data.
   * @param {string} resumeId
   */
  async processResume(resumeId) {
    const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume) {
      const err = new Error('Resume not found');
      err.statusCode = 404;
      throw err;
    }

    let extractedText;
    try {
      extractedText = await ParseService.extractText(resume.filePath, resume.fileType);
    } catch (err) {
      logger.error('Text extraction failed', { resumeId, error: err.message });
      // Clean up the file on extraction failure
      try { await fs.promises.unlink(resume.filePath); } catch (_) {}
      throw err;
    }

    const extractedData = ParseService.parseResume(extractedText);

    const updated = await prisma.resume.update({
      where: { id: resumeId },
      data: { extractedText, extractedData },
    });

    logger.info('Resume processed', { resumeId });
    return { resume: updated, parsedData: extractedData };
  },

  /**
   * Return all resumes belonging to a user.
   * @param {string} userId
   */
  async getUserResumes(userId) {
    return prisma.resume.findMany({
      where: { userId },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        uploadedAt: true,
        extractedData: true,
      },
    });
  },

  /**
   * Delete a resume and its file from disk, verifying ownership.
   * @param {string} resumeId
   * @param {string} userId
   */
  async deleteResume(resumeId, userId) {
    const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume) {
      const err = new Error('Resume not found');
      err.statusCode = 404;
      throw err;
    }
    if (resume.userId !== userId) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }

    // Remove file from disk (non-fatal if already missing)
    try {
      await fs.promises.unlink(resume.filePath);
    } catch (unlinkErr) {
      logger.warn('Could not delete resume file', {
        filePath: resume.filePath,
        error: unlinkErr.message,
      });
    }

    await prisma.resume.delete({ where: { id: resumeId } });

    logger.info('Resume deleted', { resumeId, userId });
  },
};

module.exports = ResumeService;
