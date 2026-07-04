'use strict';

const logger = require('../utils/logger.utils');

/**
 * Content enhancement layer: parsed resume data goes in, portfolio-ready
 * content comes out. The resume is treated as structured data — never as the
 * final copy.
 *
 * Two tiers:
 *  1. Heuristic engine (always runs, no dependencies): cleans skills, builds a
 *     brand headline, rewrites the summary into a first-person story, phrases
 *     experience for impact.
 *  2. Claude upgrade (optional): when ANTHROPIC_API_KEY is set and
 *     @anthropic-ai/sdk is installed, Claude rewrites the summary, headline,
 *     and project descriptions. Falls back to tier 1 silently on any failure.
 */

// ─── Heuristic engine ────────────────────────────────────────────────────────

const TITLE_WORDS =
  /(developer|engineer|designer|analyst|scientist|architect|consultant|manager|specialist|lead)/i;

/** Derive a short, brandable headline from a resume title line. */
function brandHeadline(headline, skills) {
  if (headline) {
    // "Detail-oriented BCA Candidate and Certified Data Analyst with..." →
    // keep the strongest title-bearing clause, cut trailing "with …" fragments.
    const clauses = headline.split(/,| and /i).map((c) => c.trim()).filter(Boolean);
    const titled = clauses.filter((c) => TITLE_WORDS.test(c));
    const pick = (titled[titled.length - 1] || clauses[0] || headline)
      .split(/\s+with\s+|\s+having\s+/i)[0]
      .replace(/^(a|an|the)\s+/i, '')
      .replace(/^(certified\s+)?(detail[- ]oriented|highly motivated|passionate|results[- ]driven|hardworking|dedicated)\s+/i, '')
      .replace(/[\s,;:–\-]+$/, '')
      .replace(/\s+(and|or|with|in|for|a|an)$/i, '');
    if (pick.length >= 4 && pick.length <= 60) return capitalize(pick);
  }
  // Fall back to inferring from skills
  const s = (skills || []).map((x) => x.toLowerCase());
  const has = (...names) => names.some((n) => s.some((k) => k.includes(n)));
  if (has('react', 'vue', 'angular') && has('node', 'django', 'spring', 'express')) return 'Full-Stack Developer';
  if (has('react', 'vue', 'angular', 'css', 'html')) return 'Frontend Developer';
  if (has('node', 'django', 'spring', 'express', 'api')) return 'Backend Developer';
  if (has('pandas', 'sql', 'excel', 'tableau', 'power bi', 'analytics', 'vlookup')) return 'Data Analyst';
  if (has('python', 'java', 'c++')) return 'Software Developer';
  return headline || 'Developer';
}

/** Rewrite a resume-speak summary into a first-person brand story. */
function brandSummary(summary, headline, skills) {
  const top = (skills || []).slice(0, 3).join(', ');
  if (summary) {
    let s = summary.trim();
    const wasCutOff = /[-–,]$/.test(s);
    // Resume-speak → first person
    s = s
      .replace(/^(a|an)\s+/i, '')
      .replace(/^(detail[- ]oriented|highly motivated|passionate|results[- ]driven|hardworking|dedicated)\s+/i, '');
    if (!/^i(\s|'m|'ve)/i.test(s)) {
      // Lowercase the first word only if it isn't an acronym ("BCA" stays "BCA")
      const first = /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
      s = `I'm a ${first}`;
    }
    // Complete a sentence cut off mid-clause
    if (!/[.!?]$/.test(s)) {
      s = s.replace(/[-–,;:\s]+$/, '');
      if (wasCutOff) s = s.replace(/\s+(in|of|with|for|and|or|to|a|an|the)(\s+\w+)?$/i, '');
      s += '.';
    }
    return s;
  }
  return top
    ? `I'm a ${headline || 'developer'} working with ${top}. I enjoy turning ideas into polished, reliable products and I'm always learning something new.`
    : `I'm a ${headline || 'developer'} who enjoys building useful things and learning in public.`;
}

/** Make experience entries read as impact statements rather than duty lists. */
function enhanceExperiences(experiences) {
  return (experiences || []).map((e) => {
    let d = (e.description || '').trim();
    if (d) {
      d = d.replace(/^(responsible for|duties included|worked on)\s+/i, (m) => '');
      d = d.charAt(0).toUpperCase() + d.slice(1);
      if (!/[.!?]$/.test(d)) d += '.';
    }
    return { ...e, description: d || e.description };
  });
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Tier 1 — always available. Mutates nothing; returns a new object. */
function enhanceHeuristically(data) {
  const headline = brandHeadline(data.headline, data.skills);
  return {
    ...data,
    headline,
    summary: brandSummary(data.summary, headline, data.skills),
    experiences: enhanceExperiences(data.experiences),
  };
}

// ─── Claude upgrade (optional) ───────────────────────────────────────────────

const ENHANCE_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'Professional title, max 60 chars, no adjectives like "passionate"' },
    summary: { type: 'string', description: 'First-person About Me story, 2-3 sentences, warm and concrete' },
    projects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string', description: 'One impactful sentence: what it does + what makes it interesting' },
        },
        required: ['title', 'description'],
        additionalProperties: false,
      },
    },
    experiences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string' },
          company: { type: 'string' },
          description: { type: 'string', description: 'Impact-focused, one or two sentences' },
        },
        required: ['role', 'company', 'description'],
        additionalProperties: false,
      },
    },
  },
  required: ['headline', 'summary', 'projects', 'experiences'],
  additionalProperties: false,
};

/**
 * Tier 2 — rewrite content with Claude. Returns enhanced data or null when
 * unavailable (no key, SDK not installed, API error). Callers always fall back
 * to the heuristic result.
 */
async function enhanceWithClaude(data) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  let Anthropic;
  try {
    Anthropic = require('@anthropic-ai/sdk');
  } catch {
    logger.warn('ANTHROPIC_API_KEY set but @anthropic-ai/sdk not installed — run npm install');
    return null;
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: ENHANCE_SCHEMA },
      },
      system:
        'You turn parsed resume data into portfolio website copy. Write in first person, concrete and warm — a personal brand site, not a CV. Never invent employers, dates, credentials, or metrics that are not in the input. Keep every fact; improve only the writing.',
      messages: [
        {
          role: 'user',
          content: `Rewrite this parsed resume data as portfolio copy:\n${JSON.stringify({
            headline: data.headline,
            summary: data.summary,
            skills: data.skills,
            projects: (data.projects || []).map((p) => ({ title: p.title, description: p.description })),
            experiences: (data.experiences || []).map((e) => ({
              role: e.role,
              company: e.company,
              description: e.description,
            })),
          })}`,
        },
      ],
    });

    if (response.stop_reason === 'refusal') return null;
    const text = response.content.find((b) => b.type === 'text');
    if (!text) return null;
    const out = JSON.parse(text.text);

    // Merge the rewrite back — Claude only touches copy, never structure/links
    const byTitle = new Map(out.projects.map((p) => [p.title, p.description]));
    const byRole = new Map(out.experiences.map((e) => [`${e.role}|${e.company}`, e.description]));
    return {
      ...data,
      headline: out.headline || data.headline,
      summary: out.summary || data.summary,
      projects: (data.projects || []).map((p) => ({
        ...p,
        description: byTitle.get(p.title) || p.description,
      })),
      experiences: (data.experiences || []).map((e) => ({
        ...e,
        description: byRole.get(`${e.role}|${e.company}`) || e.description,
      })),
    };
  } catch (err) {
    logger.warn('Claude enhancement failed — using heuristic enhancement', { error: err.message });
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

const EnhancerService = {
  /**
   * Enhance parsed resume data into portfolio-ready content.
   * Always succeeds — Claude output when available, heuristics otherwise.
   */
  async enhance(parsedData) {
    const heuristic = enhanceHeuristically(parsedData);
    const upgraded = await enhanceWithClaude(heuristic);
    return upgraded || heuristic;
  },
};

module.exports = EnhancerService;
