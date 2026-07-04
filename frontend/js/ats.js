/* ===================================================
   INSTANT PORTFOLIO — ATS Resume Analyzer
   Scores the ACTUAL uploaded resume (raw text + parsed
   fields) and produces concrete mistakes with fixes.
   Exposes window.IP_ATS.
   =================================================== */
(function () {
  'use strict';

  const TECH_KEYWORDS =
    /\b(html5?|css3?|sass|tailwind|bootstrap|react|next\.?js|vue|angular|svelte|jquery|redux|javascript|typescript|node\.?js|express|django|flask|spring|laravel|php|rails|graphql|rest|api|python|java|c\+\+|c#|golang|rust|kotlin|swift|sql|mysql|postgres(?:ql)?|mongodb|sqlite|redis|firebase|aws|azure|gcp|docker|kubernetes|jenkins|terraform|linux|git|github|figma|excel|tableau|power ?bi|pandas|numpy|tensorflow|pytorch|machine learning|data analytics?|agile|scrum|ci\/cd|vlookup)\b/gi;

  const ACTION_VERBS =
    /\b(built|created|developed|designed|led|launched|implemented|improved|increased|reduced|automated|managed|delivered|optimi[sz]ed|migrated|analy[sz]ed|achieved|collaborated|deployed|architected)\b/gi;

  const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

  /**
   * Analyze a resume.
   * @param {{ text: string, parsed: object }} input - raw extracted text + the
   *   client parser's output ({name,title,email,phone,location,about,skills}).
   * @returns {{score, grade, categories, issues, wins}}
   */
  function analyze({ text = '', parsed = {} }) {
    const issues = [];
    const wins = [];
    const words = text.trim().split(/\s+/).filter(Boolean);
    const lower = text.toLowerCase();

    /* ── Contact info (weight 20%) ─────────────────────────────────────── */
    let contact = 0;
    if (parsed.email || /[\w.+\-]+@[\w\-]+\.[\w.]+/.test(text)) { contact += 35; wins.push('Email address found'); }
    else issues.push({ title: 'No email address detected', fix: 'Put your email in plain text near your name — ATS software rejects resumes it cannot contact.' });

    if (parsed.phone || /(\+?\d[\d\s().\-]{7,}\d)/.test(text)) contact += 20;
    else issues.push({ title: 'No phone number detected', fix: 'Add a phone number in a standard format, e.g. +91 98765 43210.' });

    if (parsed.location) contact += 15;
    else issues.push({ title: 'No location found', fix: 'Add "City, State" under your name — many recruiters filter by location.' });

    if (/linkedin\.com\/in\//i.test(text)) { contact += 15; wins.push('LinkedIn profile linked'); }
    else issues.push({ title: 'No LinkedIn URL', fix: 'Recruiters expect it — add linkedin.com/in/your-name to your header.' });

    if (/github\.com\//i.test(text)) contact += 15;
    else issues.push({ title: 'No GitHub link', fix: 'For technical roles, a GitHub URL is strong proof of work — add it next to your email.' });

    /* ── Section structure (weight 25%) ────────────────────────────────── */
    let structure = 0;
    const hasSection = (re) => re.test(lower);
    if (hasSection(/\b(summary|objective|profile|about me)\b/) || parsed.about) { structure += 20; }
    else issues.push({ title: 'No summary section', fix: 'Open with a 2–3 line "Summary" — it is the first thing both ATS and humans read.' });

    if (hasSection(/\b(skills?|technologies|tech stack)\b/) && (parsed.skills || []).length) { structure += 25; wins.push('Dedicated skills section found'); }
    else issues.push({ title: 'No clear skills section', fix: 'Add a "Skills" heading with a comma-separated list — ATS keyword matching depends on it.' });

    if (hasSection(/\b(experience|employment|work history)\b/)) structure += 25;
    else issues.push({ title: 'No experience section heading', fix: 'Use the literal heading "Experience" or "Work Experience" — creative headings confuse ATS parsers.' });

    if (hasSection(/\b(education|academic|qualification)\b/)) structure += 15;
    else issues.push({ title: 'No education section', fix: 'Add an "Education" section with degree, institution, and years.' });

    if (hasSection(/\bprojects?\b/)) { structure += 10; wins.push('Projects section present'); }
    else issues.push({ title: 'No projects section', fix: 'Add 2–3 projects with one line each on what you built and the tech used.' });

    if (hasSection(/\bcertifications?\b/)) structure += 5;

    /* ── Keywords (weight 30%) ─────────────────────────────────────────── */
    const kwMatches = new Set((text.match(TECH_KEYWORDS) || []).map((k) => k.toLowerCase().replace(/\s+/g, ' ')));
    const kwCount = kwMatches.size;
    let keywords = clamp(kwCount * 7);
    if (kwCount >= 12) wins.push(`${kwCount} recognizable tech keywords found`);
    else if (kwCount >= 6) issues.push({ title: `Only ${kwCount} tech keywords detected`, fix: 'Mirror the wording of job postings you target — name specific tools (e.g. "React", "MySQL"), not categories.' });
    else issues.push({ title: 'Very few searchable keywords', fix: 'ATS ranks by keyword match. List 10–15 concrete technologies you have used, exactly as job ads spell them.' });

    const verbCount = new Set((text.match(ACTION_VERBS) || []).map((v) => v.toLowerCase())).size;
    if (verbCount >= 5) { keywords = clamp(keywords + 10); }
    else issues.push({ title: 'Weak action verbs', fix: 'Start bullets with verbs like "Built", "Reduced", "Automated" instead of "Responsible for".' });

    /* ── Formatting & content quality (weight 25%) ─────────────────────── */
    let formatting = 100;
    if (words.length < 250) {
      formatting -= 30;
      issues.push({ title: `Resume is thin (${words.length} words)`, fix: 'Aim for 400–700 words — expand each role/project with what you did and the result.' });
    } else if (words.length > 1100) {
      formatting -= 20;
      issues.push({ title: `Resume is long (${words.length} words)`, fix: 'Cut to one page (~600 words) — keep only the most recent and relevant work.' });
    } else {
      wins.push('Good length for ATS parsing');
    }

    const numbers = (text.match(/\b\d+(\.\d+)?\s*(%|percent|\+|k\b|users|clients|projects|hours|₹|\$)/gi) || []).length;
    if (numbers >= 3) wins.push('Achievements are quantified');
    else {
      formatting -= 20;
      issues.push({ title: 'No measurable results', fix: 'Add numbers: "improved load time by 40%", "handled 200+ records/day". Metrics are what recruiters scan for.' });
    }

    if (!/(19|20)\d{2}/.test(text)) {
      formatting -= 15;
      issues.push({ title: 'No dates found', fix: 'Add years (e.g. "2023 – 2025") to every role and degree — ATS timelines need them.' });
    }

    const capsLines = text.split('\n').filter((l) => l.trim().length > 12 && l.trim() === l.trim().toUpperCase() && /[A-Z]{4,}/.test(l)).length;
    if (capsLines > 6) {
      formatting -= 10;
      issues.push({ title: 'Too many ALL-CAPS lines', fix: 'Reserve capitals for 4–6 section headings; ATS can misread shouting text as headings.' });
    }
    formatting = clamp(formatting);

    /* ── Overall ───────────────────────────────────────────────────────── */
    contact = clamp(contact);
    structure = clamp(structure);
    const score = clamp(keywords * 0.3 + structure * 0.25 + contact * 0.2 + formatting * 0.25);
    const grade = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 55 ? 'Fair' : 'Needs work';
    const headline =
      score >= 85 ? 'Your resume is in great shape for ATS systems'
      : score >= 70 ? 'Your resume scores well — a few fixes will lift it further'
      : score >= 55 ? 'Your resume passes, but ATS systems will rank it mid-pack'
      : 'Your resume needs work before it will survive ATS filters';

    return {
      score,
      grade,
      headline,
      categories: { keywords, formatting, structure, contact },
      issues: issues.slice(0, 6),
      wins: wins.slice(0, 3),
    };
  }

  window.IP_ATS = { analyze };
})();
