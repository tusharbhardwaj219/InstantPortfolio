'use strict';

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const logger = require('../utils/logger.utils');

// ─── Regex constants ─────────────────────────────────────────────────────────

const titleRe =
  /\b(developer|engineer|designer|manager|analyst|scientist|consultant|architect|specialist|director|lead|senior|junior|intern|full[\s\-]?stack|front[\s\-]?end|back[\s\-]?end|devops|product|data|software|web|mobile)\b/i;

const sectionHeadingRe =
  /^(?:summary|objective|profile|about me|professional summary|overview|skills?|technical skills?|competencies|technologies|tech stack|tools?|experience|work experience|employment|professional experience|work history|education|academic|qualifications|projects?|personal projects?|side projects?|portfolio|certifications?|certificates?|licenses?|credentials?|social|links?|contact)\s*[:\-]?\s*$/i;

const monthRe =
  /(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/i;

const dateRe = new RegExp(
  `(?:${monthRe.source}[\\w\\s,]*\\d{4}|\\d{4}\\s*[-–]\\s*(?:\\d{4}|present|current))`,
  'i'
);

const dateRangeRe = new RegExp(
  `(${monthRe.source}[\\w\\s,]*\\d{4}|\\d{4})\\s*[-–to]+\\s*(${monthRe.source}[\\w\\s,]*\\d{4}|\\d{4}|present|current)`,
  'i'
);

// ─── Helper functions ─────────────────────────────────────────────────────────

/**
 * Normalize raw extracted text: re-join words hyphen-wrapped across lines
 * (PDF extraction artifact, e.g. "Full-\nStack" → "Full-Stack").
 */
function normalizeText(text) {
  return text.replace(/(\w)-\r?\n(?=[a-z])/g, '$1');
}

/**
 * Split raw text into trimmed lines.
 */
function toLines(text) {
  return text.split(/\r?\n/).map((l) => l.trim());
}

/**
 * Find the index of the first line matching a predicate function or regex.
 */
function findSectionIndex(lines, predicate) {
  const fn = typeof predicate === 'function' ? predicate : (l) => predicate.test(l);
  for (let i = 0; i < lines.length; i++) {
    if (fn(lines[i])) return i;
  }
  return -1;
}

/**
 * Extract lines belonging to a section (from start index + 1 until the next
 * recognised section heading or end of document).
 */
function extractSectionLines(lines, startIdx) {
  const result = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (sectionHeadingRe.test(lines[i])) break;
    result.push(lines[i]);
  }
  return result;
}

/**
 * Split a block of text on common delimiter characters used in skill lists.
 * Colons and semicolons matter: "Web Development: HTML5, CSS3" must split the
 * category label away from the values, or they merge into "Web Development HTML5".
 */
function splitSkillBlock(text) {
  return text.split(/[,;:|•·\n\/\\▪▸–\-]+/);
}

/** Category labels / heading words that are not skills themselves. */
const SKILL_STOPWORDS = new Set([
  'web development', 'development', 'programming', 'programming languages',
  'languages', 'databases', 'database', 'tools', 'frameworks', 'libraries',
  'technologies', 'tech stack', 'others', 'other', 'soft skills',
  'certification', 'certifications', 'frontend', 'backend', 'cloud', 'devops',
]);

/**
 * Clean a candidate skill token: strip stray symbols and trailing punctuation.
 */
function cleanToken(t) {
  return t
    .replace(/[^\w\s#+.\-]/g, '')
    .replace(/[.\s]+$/, '')
    .trim();
}

/**
 * Return true if a line looks like a section heading.
 */
function isSectionHeading(line) {
  return sectionHeadingRe.test(line.trim());
}

/**
 * Headlines pulled from wrapped resume paragraphs often end mid-clause
 * ("...with a strong foundation in Full-"). Cut back to the last complete
 * clause and strip dangling connectors.
 */
function tidyHeadline(line) {
  let h = line.trim();
  // Drop an unfinished trailing fragment introduced by "with/for/in ..."
  if (/[-–,]$/.test(h) || h.length > 80) {
    const clause = h.split(/\s+with\s+|\s+having\s+/i)[0];
    if (clause && clause.length >= 12) h = clause;
  }
  return h.replace(/[\s,;:–\-]+$/, '').replace(/\s+(and|or|with|in|for|a|an)$/i, '');
}

/**
 * Return true if a line contains date information.
 */
function looksLikeDate(line) {
  return dateRe.test(line);
}

/**
 * Try to extract a date range string from a line.
 */
function extractDateRange(line) {
  const m = line.match(dateRangeRe);
  if (m) {
    return { startDate: m[1] || null, endDate: m[2] || null };
  }
  // Single year
  const yearMatch = line.match(/\b(\d{4})\b/);
  if (yearMatch) return { startDate: yearMatch[1], endDate: null };
  return null;
}

/**
 * Group section lines into logical entries split on empty lines or date lines.
 */
function groupEntries(sectionLines) {
  const entries = [];
  let current = [];

  for (const line of sectionLines) {
    if (!line) {
      if (current.length) {
        entries.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length) entries.push(current);
  return entries;
}

// ─── Main ParseService ────────────────────────────────────────────────────────

const ParseService = {
  /**
   * Extract plain text from a PDF or DOCX file.
   * @param {string} filePath
   * @param {string} fileType - MIME type
   * @returns {Promise<string>}
   */
  async extractText(filePath, fileType) {
    try {
      if (fileType === 'application/pdf') {
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        return data.text || '';
      }

      if (
        fileType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value || '';
      }

      throw new Error(`Unsupported file type: ${fileType}`);
    } catch (err) {
      logger.error('Text extraction failed', { filePath, fileType, error: err.message });
      throw err;
    }
  },

  /**
   * Parse structured data from plain resume text.
   * Returns ONLY what is found in the text — never invents fallback values.
   * @param {string} text
   * @returns {object}
   */
  parseResume(text) {
    if (!text || typeof text !== 'string') {
      return this._emptyResult();
    }

    text = normalizeText(text);
    const lines = toLines(text);
    const result = this._emptyResult();

    // ── Contact fields ────────────────────────────────────────────────────────

    // email
    const emailMatch = text.match(/[\w.+\-]+@[\w\-]+\.[\w.]+/);
    result.email = emailMatch ? emailMatch[0] : null;

    // phone
    const phoneMatch = text.match(/(\+?[\d][\d\s().\-]{7,}[\d])/);
    result.phone = phoneMatch ? phoneMatch[1].trim() : null;

    // github
    const githubMatch = text.match(/github\.com\/([A-Za-z0-9\-._]+)/i);
    if (githubMatch) {
      result.github = `https://github.com/${githubMatch[1]}`;
    }

    // linkedin
    const linkedinMatch = text.match(/linkedin\.com\/in\/([A-Za-z0-9\-_.]+)/i);
    if (linkedinMatch) {
      result.linkedin = `https://linkedin.com/in/${linkedinMatch[1]}`;
    }

    // website (not github or linkedin)
    const websiteMatch = text.match(/https?:\/\/(?!(?:www\.)?(?:linkedin|github))[^\s,<>]+/i);
    result.website = websiteMatch ? websiteMatch[0].replace(/[.,;)]$/, '') : null;

    // location — city must be 1-3 Titlecase words ([A-Z][a-z]+), which stops the
    // match from swallowing a preceding ALL-CAPS name ("TUSHARFaridabad, Haryana"
    // must yield "Faridabad, Haryana")
    const locationMatch = text.match(
      /([A-Z][a-z]+(?:[\s\-][A-Z][a-z]+){0,2}),\s*([A-Z]{2,3}\b|[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/
    );
    if (locationMatch) {
      const candidate = locationMatch[0];
      // Exclude matches that look like company/org names (often contain Inc/Ltd/Corp)
      if (!/\b(inc|ltd|corp|llc|university|college|institute)\b/i.test(candidate)) {
        result.location = candidate;
      }
    }

    // ── Name & headline ───────────────────────────────────────────────────────

    // fullName: first non-blank line (1-60 chars) matching name pattern
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (
        line.length >= 2 &&
        line.length <= 60 &&
        /^[A-Za-z][A-Za-z\s.''\-]+$/.test(line) &&
        !line.includes('@') &&
        !/https?:\/\//.test(line) &&
        !isSectionHeading(line)
      ) {
        result.fullName = line;
        break;
      }
    }

    // headline: look in the first few lines after name for a title-like line
    const nameIdx = result.fullName
      ? lines.findIndex((l) => l.trim() === result.fullName)
      : -1;

    const headlineSearchStart = nameIdx >= 0 ? nameIdx + 1 : 0;
    for (let i = headlineSearchStart; i < Math.min(headlineSearchStart + 5, lines.length); i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (
        titleRe.test(line) &&
        line.length <= 120 &&
        !line.includes('@') &&
        !/https?:\/\//.test(line) &&
        !isSectionHeading(line)
      ) {
        result.headline = tidyHeadline(line);
        break;
      }
    }

    // ── Summary ───────────────────────────────────────────────────────────────

    const summaryHeadingRe =
      /(?:summary|objective|profile|about me|professional summary|overview)[:\s]*/i;
    const summaryIdx = findSectionIndex(lines, (l) => summaryHeadingRe.test(l.trim()) && l.trim().length < 60);
    if (summaryIdx >= 0) {
      const summaryLines = extractSectionLines(lines, summaryIdx);
      const summaryText = summaryLines.filter(Boolean).join(' ').trim();
      if (summaryText) {
        result.summary = summaryText.slice(0, 1000);
      }
    }

    // ── Skills ────────────────────────────────────────────────────────────────

    const skillsHeadingRe =
      /^(?:skills?|technical skills?|competencies|technologies|tech stack|tools?)\s*[:\-]?\s*$/i;
    const skillsIdx = findSectionIndex(lines, (l) => skillsHeadingRe.test(l.trim()));
    if (skillsIdx >= 0) {
      const skillLines = extractSectionLines(lines, skillsIdx);
      const skillBlock = skillLines.join(', ');
      const rawSkills = splitSkillBlock(skillBlock);
      const seen = new Set();
      for (const raw of rawSkills) {
        const cleaned = cleanToken(raw);
        const lower = cleaned.toLowerCase();
        if (
          cleaned.length >= 1 &&
          cleaned.length <= 40 &&
          !/^\d+$/.test(cleaned) &&
          !SKILL_STOPWORDS.has(lower) &&
          !seen.has(lower)
        ) {
          seen.add(lower);
          result.skills.push(cleaned);
          if (result.skills.length >= 30) break;
        }
      }
    }

    // ── Experience ────────────────────────────────────────────────────────────

    const expHeadingRe =
      /^(?:experience|work experience|employment|professional experience|work history)\s*[:\-]?\s*$/i;
    const expIdx = findSectionIndex(lines, (l) => expHeadingRe.test(l.trim()));
    if (expIdx >= 0) {
      const expLines = extractSectionLines(lines, expIdx);
      const entries = groupEntries(expLines);

      for (const entry of entries) {
        if (!entry.length) continue;

        const exp = { company: null, role: null, startDate: null, endDate: null, description: null };
        const descLines = [];
        let dateAssigned = false;

        for (const line of entry) {
          if (!line.trim()) continue;

          if (!dateAssigned && looksLikeDate(line)) {
            const dr = extractDateRange(line);
            if (dr) {
              exp.startDate = dr.startDate;
              exp.endDate = dr.endDate;
              dateAssigned = true;
              continue;
            }
          }

          if (!exp.role && titleRe.test(line) && line.length <= 100) {
            exp.role = line.trim();
            continue;
          }

          if (!exp.company && exp.role && line.length <= 120 && !looksLikeDate(line)) {
            exp.company = line.trim();
            continue;
          }

          descLines.push(line.trim());
        }

        if (descLines.length) {
          exp.description = descLines.join(' ').trim();
        }

        if (exp.role || exp.company) {
          result.experiences.push(exp);
        }
      }
    }

    // ── Education ─────────────────────────────────────────────────────────────

    const eduHeadingRe =
      /^(?:education|academic(?:\s+background)?|qualifications?)\s*[:\-]?\s*$/i;
    const eduIdx = findSectionIndex(lines, (l) => eduHeadingRe.test(l.trim()));
    if (eduIdx >= 0) {
      const eduLines = extractSectionLines(lines, eduIdx);
      const entries = groupEntries(eduLines);

      const degreeRe =
        /\b(bachelor(?:'?s)?|master(?:'?s)?|phd|ph\.d|doctor(?:ate)?|b\.?s\.?|m\.?s\.?|b\.?e\.?|m\.?e\.?|b\.?tech|m\.?tech|associate|diploma|high school)\b/i;
      const institutionRe =
        /\b(university|college|institute|school|academy)\b/i;

      for (const entry of entries) {
        if (!entry.length) continue;

        const edu = { institution: null, degree: null, field: null, startDate: null, endDate: null };
        let dateAssigned = false;

        for (const line of entry) {
          if (!line.trim()) continue;

          if (!dateAssigned && looksLikeDate(line)) {
            const dr = extractDateRange(line);
            if (dr) {
              edu.startDate = dr.startDate;
              edu.endDate = dr.endDate;
              dateAssigned = true;
              continue;
            }
          }

          if (!edu.institution && institutionRe.test(line)) {
            edu.institution = line.trim();
            continue;
          }

          if (!edu.degree) {
            const degreeMatch = line.match(degreeRe);
            if (degreeMatch) {
              edu.degree = degreeMatch[0];
              // Try to extract field from same line
              const fieldPart = line.replace(degreeMatch[0], '').trim();
              if (fieldPart && fieldPart.length <= 80) {
                edu.field = fieldPart.replace(/^in\s+/i, '').replace(/[,.]$/, '').trim() || null;
              }
              continue;
            }
          }

          // If institution not yet found, take first long-ish line
          if (!edu.institution && line.length > 5 && !looksLikeDate(line)) {
            edu.institution = line.trim();
          }
        }

        if (edu.institution || edu.degree) {
          result.educations.push(edu);
        }
      }
    }

    // ── Projects ──────────────────────────────────────────────────────────────

    const projHeadingRe =
      /^(?:projects?|personal projects?|side projects?|portfolio)\s*[:\-]?\s*$/i;
    const projIdx = findSectionIndex(lines, (l) => projHeadingRe.test(l.trim()));
    if (projIdx >= 0) {
      const projLines = extractSectionLines(lines, projIdx);
      const entries = groupEntries(projLines);

      for (const entry of entries) {
        if (!entry.length) continue;

        const proj = { title: null, description: null, githubUrl: null, liveUrl: null };
        const descLines = [];

        for (let i = 0; i < entry.length; i++) {
          const line = entry[i];
          if (!line.trim()) continue;

          const ghMatch = line.match(/https?:\/\/github\.com\/[^\s,<>]+/i);
          if (ghMatch) { proj.githubUrl = ghMatch[0]; continue; }

          const liveMatch = line.match(/https?:\/\/(?!github)[^\s,<>]+/i);
          if (liveMatch) { proj.liveUrl = liveMatch[0]; continue; }

          if (i === 0 && !proj.title) {
            proj.title = line.trim();
            continue;
          }

          descLines.push(line.trim());
        }

        if (descLines.length) proj.description = descLines.join(' ').trim();

        if (proj.title || proj.description) {
          result.projects.push(proj);
        }
      }
    }

    // ── Certifications ────────────────────────────────────────────────────────

    const certHeadingRe =
      /^(?:certifications?|certificates?|licenses?|credentials?)\s*[:\-]?\s*$/i;
    const certIdx = findSectionIndex(lines, (l) => certHeadingRe.test(l.trim()));
    if (certIdx >= 0) {
      const certLines = extractSectionLines(lines, certIdx);
      const entries = groupEntries(certLines);

      const issuerRe = /(?:by|from|issued\s+by)\s+(.+)/i;

      for (const entry of entries) {
        if (!entry.length) continue;

        const cert = { name: null, issuer: null, issueDate: null };

        for (const line of entry) {
          if (!line.trim()) continue;

          if (!cert.issueDate && looksLikeDate(line)) {
            const dr = extractDateRange(line);
            cert.issueDate = dr ? dr.startDate || dr.endDate : null;
            continue;
          }

          const issuerMatch = line.match(issuerRe);
          if (issuerMatch && !cert.issuer) {
            cert.issuer = issuerMatch[1].trim();
            // Name might be the same line minus the issuer part
            const namePart = line.replace(issuerMatch[0], '').trim();
            if (namePart && !cert.name) cert.name = namePart.replace(/[,–\-]$/, '').trim();
            continue;
          }

          if (!cert.name) {
            cert.name = line.trim();
            continue;
          }

          if (!cert.issuer) {
            cert.issuer = line.trim();
          }
        }

        if (cert.name || cert.issuer) {
          result.certifications.push(cert);
        }
      }
    }

    // ── Social links ──────────────────────────────────────────────────────────

    const socialPatterns = [
      { platform: 'twitter', re: /https?:\/\/(?:www\.)?twitter\.com\/[^\s,<>]+/i },
      { platform: 'x', re: /https?:\/\/(?:www\.)?x\.com\/[^\s,<>]+/i },
      { platform: 'instagram', re: /https?:\/\/(?:www\.)?instagram\.com\/[^\s,<>]+/i },
      { platform: 'behance', re: /https?:\/\/(?:www\.)?behance\.net\/[^\s,<>]+/i },
      { platform: 'dribbble', re: /https?:\/\/(?:www\.)?dribbble\.com\/[^\s,<>]+/i },
      { platform: 'stackoverflow', re: /https?:\/\/(?:www\.)?stackoverflow\.com\/[^\s,<>]+/i },
      { platform: 'medium', re: /https?:\/\/(?:www\.)?medium\.com\/[^\s,<>]+/i },
      { platform: 'devto', re: /https?:\/\/dev\.to\/[^\s,<>]+/i },
      { platform: 'youtube', re: /https?:\/\/(?:www\.)?youtube\.com\/[^\s,<>]+/i },
      { platform: 'hashnode', re: /https?:\/\/[^\s,<>]+hashnode\.[^\s,<>]+/i },
      { platform: 'codepen', re: /https?:\/\/(?:www\.)?codepen\.io\/[^\s,<>]+/i },
      { platform: 'kaggle', re: /https?:\/\/(?:www\.)?kaggle\.com\/[^\s,<>]+/i },
    ];

    const seenUrls = new Set();
    for (const { platform, re } of socialPatterns) {
      const m = text.match(re);
      if (m && !seenUrls.has(m[0])) {
        seenUrls.add(m[0]);
        result.socialLinks.push({ platform, url: m[0].replace(/[.,;)]$/, '') });
      }
    }

    return result;
  },

  /**
   * Return a blank parsed-resume structure.
   */
  _emptyResult() {
    return {
      fullName: null,
      headline: null,
      summary: null,
      email: null,
      phone: null,
      location: null,
      github: null,
      linkedin: null,
      website: null,
      skills: [],
      experiences: [],
      educations: [],
      projects: [],
      certifications: [],
      socialLinks: [],
    };
  },
};

module.exports = ParseService;
