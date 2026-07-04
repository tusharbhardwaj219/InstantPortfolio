'use strict';

const ResumeService = require('../services/resume.service');
const PortfolioService = require('../services/portfolio.service');
const { sendSuccess, sendError } = require('../utils/response.utils');
const logger = require('../utils/logger.utils');

/**
 * Upload a resume, parse it, and generate a portfolio — all via SSE.
 * The client receives progress events and a final "done" event.
 */
async function upload(req, res, next) {
  if (!req.file) {
    return sendError(res, 'No file uploaded. Use field name "resume".', 400);
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  /** Send an SSE progress event */
  function sendEvent(data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    // Step 1 – Save file metadata
    sendEvent({ progress: 10, step: 'saving_file' });
    const resume = await ResumeService.upload(req.user.id, req.file);

    // Step 2 – Extract text + parse
    sendEvent({ progress: 30, step: 'extracting_text' });
    const { resume: processedResume, parsedData } = await ResumeService.processResume(resume.id);

    sendEvent({ progress: 60, step: 'parsing_resume' });

    // Step 3 – Generate portfolio
    sendEvent({ progress: 75, step: 'generating_portfolio' });
    const portfolio = await PortfolioService.generate(req.user.id, resume.id);

    // Step 4 – Done
    sendEvent({
      progress: 100,
      step: 'done',
      data: {
        resume: {
          id: processedResume.id,
          fileName: processedResume.fileName,
          uploadedAt: processedResume.uploadedAt,
        },
        portfolio,
      },
    });

    logger.info('Resume upload + portfolio generation complete', {
      resumeId: resume.id,
      portfolioId: portfolio.id,
      userId: req.user.id,
    });
  } catch (err) {
    logger.error('Resume upload flow failed', { error: err.message, userId: req.user.id });
    sendEvent({ progress: -1, step: 'error', error: err.message });
  } finally {
    res.end();
  }
}

async function getUserResumes(req, res, next) {
  try {
    const resumes = await ResumeService.getUserResumes(req.user.id);
    return sendSuccess(res, { resumes }, 'Resumes retrieved');
  } catch (err) {
    return next(err);
  }
}

async function deleteResume(req, res, next) {
  try {
    await ResumeService.deleteResume(req.params.id, req.user.id);
    return sendSuccess(res, null, 'Resume deleted successfully');
  } catch (err) {
    return next(err);
  }
}

module.exports = { upload, getUserResumes, deleteResume };
