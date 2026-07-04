'use strict';

const { prisma } = require('../config/db');
const { generateUniqueSlug } = require('../utils/slug.utils');
const EnhancerService = require('./enhancer.service');
const logger = require('../utils/logger.utils');

/** All relations to include when fetching a full portfolio */
const PORTFOLIO_INCLUDE = {
  skills: true,
  experiences: true,
  educations: true,
  projects: true,
  certifications: true,
  socialLinks: true,
  analytics: true,
};

const PortfolioService = {
  /**
   * Generate a portfolio from parsed resume data.
   * @param {string} userId
   * @param {string} resumeId
   */
  async generate(userId, resumeId) {
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
    if (!resume.extractedData) {
      const err = new Error('Resume has not been processed yet');
      err.statusCode = 422;
      throw err;
    }

    // Resume data is input, not output — run it through the enhancement layer
    // so the stored portfolio reads like a brand site, not a CV.
    const data = await EnhancerService.enhance(resume.extractedData);

    // Delete any existing portfolio for this resume so we can regenerate
    const existing = await prisma.portfolio.findUnique({ where: { resumeId } });
    if (existing) {
      await prisma.portfolio.delete({ where: { id: existing.id } });
    }

    const slug = await generateUniqueSlug(data.fullName || '', prisma);

    const portfolio = await prisma.portfolio.create({
      data: {
        userId,
        resumeId,
        slug,
        fullName: data.fullName || null,
        headline: data.headline || null,
        summary: data.summary || null,
        email: data.email || null,
        phone: data.phone || null,
        location: data.location || null,
        github: data.github || null,
        linkedin: data.linkedin || null,
        website: data.website || null,
        skills: {
          createMany: {
            data: (data.skills || []).map((name) => ({ name })),
          },
        },
        experiences: {
          createMany: {
            data: (data.experiences || []).map((e) => ({
              company: e.company || null,
              role: e.role || null,
              startDate: e.startDate || null,
              endDate: e.endDate || null,
              description: e.description || null,
            })),
          },
        },
        educations: {
          createMany: {
            data: (data.educations || []).map((e) => ({
              institution: e.institution || null,
              degree: e.degree || null,
              field: e.field || null,
              startDate: e.startDate || null,
              endDate: e.endDate || null,
            })),
          },
        },
        projects: {
          createMany: {
            data: (data.projects || []).map((p) => ({
              title: p.title || null,
              description: p.description || null,
              githubUrl: p.githubUrl || null,
              liveUrl: p.liveUrl || null,
            })),
          },
        },
        certifications: {
          createMany: {
            data: (data.certifications || []).map((c) => ({
              name: c.name || null,
              issuer: c.issuer || null,
              issueDate: c.issueDate || null,
            })),
          },
        },
        socialLinks: {
          createMany: {
            data: (data.socialLinks || []).map((s) => ({
              platform: s.platform || null,
              url: s.url || null,
            })),
          },
        },
        analytics: {
          create: {
            totalViews: 0,
            uniqueViews: 0,
          },
        },
      },
      include: PORTFOLIO_INCLUDE,
    });

    logger.info('Portfolio generated', { portfolioId: portfolio.id, userId, slug });
    return portfolio;
  },

  /**
   * Fetch a public portfolio by slug and increment view counters.
   * @param {string} slug
   * @param {boolean} [isFirstVisit] - true when the visitor has not seen this portfolio before
   */
  async getBySlug(slug, isFirstVisit) {
    const portfolio = await prisma.portfolio.findUnique({
      where: { slug },
      include: PORTFOLIO_INCLUDE,
    });

    if (!portfolio) {
      const err = new Error('Portfolio not found');
      err.statusCode = 404;
      throw err;
    }

    // Increment view counters (fire-and-forget — don't block the response).
    // uniqueViews only increments for first-time visitors, signalled by the
    // client via ?new=1 (tracked with localStorage on the portfolio page).
    const isNewVisitor = Boolean(isFirstVisit);
    prisma.analytics
      .upsert({
        where: { portfolioId: portfolio.id },
        update: {
          totalViews: { increment: 1 },
          ...(isNewVisitor ? { uniqueViews: { increment: 1 } } : {}),
          lastViewedAt: new Date(),
        },
        create: {
          portfolioId: portfolio.id,
          totalViews: 1,
          uniqueViews: isNewVisitor ? 1 : 0,
          lastViewedAt: new Date(),
        },
      })
      .catch((err) => logger.error('Analytics update failed', { error: err.message }));

    return portfolio;
  },

  /**
   * Return the authenticated user's portfolio.
   * @param {string} userId
   */
  async getUserPortfolio(userId) {
    const portfolio = await prisma.portfolio.findFirst({
      where: { userId },
      include: PORTFOLIO_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    if (!portfolio) {
      const err = new Error('Portfolio not found');
      err.statusCode = 404;
      throw err;
    }

    return portfolio;
  },

  /**
   * Update mutable portfolio fields.
   * @param {string} portfolioId
   * @param {string} userId
   * @param {object} data
   */
  async update(portfolioId, userId, data) {
    const portfolio = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
    if (!portfolio) {
      const err = new Error('Portfolio not found');
      err.statusCode = 404;
      throw err;
    }
    if (portfolio.userId !== userId) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }

    const allowedFields = [
      'fullName', 'headline', 'summary', 'email', 'phone',
      'location', 'github', 'linkedin', 'website',
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        updateData[field] = data[field];
      }
    }

    const updated = await prisma.portfolio.update({
      where: { id: portfolioId },
      data: updateData,
      include: PORTFOLIO_INCLUDE,
    });

    logger.info('Portfolio updated', { portfolioId, userId });
    return updated;
  },

  /**
   * Delete a portfolio and all its relations.
   * @param {string} portfolioId
   * @param {string} userId
   */
  async delete(portfolioId, userId) {
    const portfolio = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
    if (!portfolio) {
      const err = new Error('Portfolio not found');
      err.statusCode = 404;
      throw err;
    }
    if (portfolio.userId !== userId) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }

    // Cascade delete handled by Prisma schema relations (onDelete: Cascade)
    await prisma.portfolio.delete({ where: { id: portfolioId } });

    logger.info('Portfolio deleted', { portfolioId, userId });
  },
};

module.exports = PortfolioService;
