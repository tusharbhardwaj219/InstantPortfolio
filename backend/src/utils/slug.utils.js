'use strict';

/**
 * Convert a full name to a URL-safe slug.
 * @param {string} name
 * @returns {string}
 */
function nameToSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate a unique slug by checking the Portfolio collection.
 * If the base slug is taken, appends -2, -3, ... until unique.
 * @param {string} fullName
 * @param {import('@prisma/client').PrismaClient} prisma
 * @returns {Promise<string>} unique slug
 */
async function generateUniqueSlug(fullName, prisma) {
  const base = nameToSlug(fullName || 'portfolio');
  const safeBase = base || 'portfolio';

  let slug = safeBase;
  let counter = 2;

  while (true) {
    const existing = await prisma.portfolio.findUnique({ where: { slug } });
    if (!existing) {
      return slug;
    }
    slug = `${safeBase}-${counter}`;
    counter += 1;
  }
}

module.exports = { generateUniqueSlug, nameToSlug };
