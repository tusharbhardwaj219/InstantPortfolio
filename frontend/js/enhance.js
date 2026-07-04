/* ===================================================
   INSTANT PORTFOLIO — Presentation Enhancement
   Turns flat resume data into portfolio-ready view
   models: categorized skills, brand copy, elegant
   placeholders. Exposes window.IP_ENHANCE.
   =================================================== */
(function () {
  'use strict';

  /* ---------- Skill taxonomy ---------- */

  const TAXONOMY = [
    { group: 'Frontend', match: /^(html5?|css3?|sass|scss|tailwind|bootstrap|react(\.?js)?|next(\.?js)?|vue(\.?js)?|angular|svelte|jquery|redux|javascript(es6\+?)?|js|typescript|ts|responsive design|ui|ux|figma|webpack|vite)$/i },
    { group: 'Backend', match: /^(node(\.?js)?|express(\.?js)?|django|flask|fastapi|spring(boot)?|laravel|php|rails|ruby|graphql|rest(ful)?( api)?s?|api(s)?|microservices)$/i },
    { group: 'Databases', match: /^(sql|mysql|postgres(ql)?|mongodb|mongo|sqlite|redis|firebase|supabase|oracle|dynamodb|vlookup|pivot tables?)$/i },
    { group: 'Languages', match: /^(python|java|c|c\+\+|c#|go(lang)?|rust|kotlin|swift|dart|r|scala|bash)$/i },
    { group: 'Cloud & DevOps', match: /^(aws|azure|gcp|google cloud|docker|kubernetes|k8s|ci\/?cd|jenkins|terraform|linux|nginx|vercel|netlify|heroku)$/i },
    { group: 'Data & Analytics', match: /^(pandas|numpy|matplotlib|tableau|power ?bi|excel|data analytics?|machine learning|ml|ai|tensorflow|pytorch|cisco data analytics)$/i },
    { group: 'Tools', match: /^(git(hub)?|gitlab|jira|postman|vs ?code|slack|notion|npm|yarn)$/i },
  ];

  const NOISE = /^(certifications?|certified|certificate|others?|etc|and|programming|web development|databases?|tools?|languages?|frameworks?|technologies|tech stack|soft skills)$/i;

  function cleanSkill(raw) {
    let s = String(raw || '').trim().replace(/[.\s]+$/, '');
    // Merged artifacts like "Programming Python CISCO Certified" → keep the tech token
    s = s.replace(/^(programming|web development|databases?|tools?)\s+/i, '');
    s = s.replace(/\s+(cisco\s+)?certified$/i, '');
    return s.trim();
  }

  /** Clean, dedupe, and group skills. Returns [{group, skills:[...]}, ...]. */
  function categorizeSkills(skills) {
    const seen = new Set();
    const groups = new Map();
    for (const raw of skills || []) {
      const s = cleanSkill(raw);
      const key = s.toLowerCase();
      if (!s || s.length < 2 || s.length > 40 || NOISE.test(s) || seen.has(key)) continue;
      seen.add(key);
      const hit = TAXONOMY.find((t) => t.match.test(s));
      const group = hit ? hit.group : 'More';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(s);
    }
    // Preserve taxonomy order, "More" last
    const order = TAXONOMY.map((t) => t.group).concat('More');
    return order
      .filter((g) => groups.has(g))
      .map((g) => ({ group: g, skills: groups.get(g) }));
  }

  /* ---------- Placeholder projects ---------- */

  const PROJECT_IDEAS = [
    { key: /react|vue|angular|javascript|frontend|html/i, title: 'Interactive Web App', description: 'A responsive single-page application with real-time UI updates and careful attention to accessibility.' },
    { key: /node|express|django|api|backend|php/i, title: 'REST API Service', description: 'A well-documented API with authentication, validation, and automated tests.' },
    { key: /sql|mongo|database|mysql|postgres/i, title: 'Data-Driven Dashboard', description: 'A dashboard that aggregates and visualizes live data from a relational store.' },
    { key: /python|pandas|analytics|excel|data/i, title: 'Data Analysis Notebook', description: 'An exploratory analysis turning a messy dataset into clear, decision-ready insights.' },
  ];

  /**
   * When a portfolio has no projects, propose suggested ones derived from the
   * person's actual skills — clearly marked as ideas, never fake claims.
   */
  function placeholderProjects(skills) {
    const flat = (skills || []).join(' ');
    const picks = PROJECT_IDEAS.filter((p) => p.key.test(flat)).slice(0, 3);
    if (!picks.length) picks.push(PROJECT_IDEAS[0], PROJECT_IDEAS[1]);
    return picks.map((p) => ({
      title: p.title,
      description: p.description,
      githubUrl: '',
      liveUrl: '',
      suggested: true,
    }));
  }

  /* ---------- Copy polish ---------- */

  function brandHeadline(headline, skillGroups) {
    let h = (headline || '').trim();
    if (h) {
      const clauses = h.split(/,| and /i).map((c) => c.trim()).filter(Boolean);
      const titled = clauses.filter((c) => /(developer|engineer|designer|analyst|scientist|architect|consultant|manager)/i.test(c));
      h = (titled[titled.length - 1] || clauses[0] || h)
        .split(/\s+with\s+|\s+having\s+/i)[0] // "Data Analyst with a strong foundation in…" → "Data Analyst"
        .replace(/^(a|an|the)\s+/i, '')
        .replace(/^(certified\s+)?(detail[- ]oriented|highly motivated|passionate|results[- ]driven|hardworking|dedicated)\s+/i, '');
      h = h.replace(/[\s,;:–\-]+$/, '').replace(/\s+(and|or|with|in|for|a|an)$/i, '');
      if (h.length >= 4 && h.length <= 60) return h.charAt(0).toUpperCase() + h.slice(1);
    }
    const groups = (skillGroups || []).map((g) => g.group);
    if (groups.includes('Frontend') && groups.includes('Backend')) return 'Full-Stack Developer';
    if (groups.includes('Data & Analytics')) return 'Data Analyst';
    if (groups.includes('Frontend')) return 'Frontend Developer';
    if (groups.includes('Backend')) return 'Backend Developer';
    return headline || 'Developer';
  }

  function brandSummary(summary, headline, skillGroups) {
    let s = (summary || '').trim();
    if (s) {
      const wasCutOff = /[-–,]$/.test(s);
      s = s
        .replace(/^(a|an)\s+/i, '')
        .replace(/^(detail[- ]oriented|highly motivated|passionate|results[- ]driven|hardworking|dedicated)\s+/i, '');
      if (!/^i(\s|'m|'ve)/i.test(s)) {
        // Lowercase the first word only if it isn't an acronym ("BCA" stays "BCA")
        const first = /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
        s = "I'm a " + first;
      }
      if (!/[.!?]$/.test(s)) {
        s = s.replace(/[-–,;:\s]+$/, '');
        // Text cut mid-clause: drop the dangling connector fragment ("…in Full")
        if (wasCutOff) s = s.replace(/\s+(in|of|with|for|and|or|to|a|an|the)(\s+\w+)?$/i, '');
        s += '.';
      }
      return s;
    }
    const top = (skillGroups || []).flatMap((g) => g.skills).slice(0, 3).join(', ');
    return top
      ? `I'm a ${headline || 'developer'} working with ${top}. I enjoy turning ideas into polished, reliable products — and I'm always learning something new.`
      : `I'm a ${headline || 'developer'} who enjoys building useful things and learning in public.`;
  }

  /** Re-extract a clean "City, Region" from location strings polluted by
      adjacent resume text (e.g. "TUSHARFaridabad, Haryana" → "Faridabad, Haryana"). */
  function cleanLocation(loc) {
    // No leading \b: a name glued onto the city ("TUSHARFaridabad") has no word
    // boundary, but the Titlecase pattern still locks onto "Faridabad".
    const m = String(loc || '').match(
      /([A-Z][a-z]+(?:[\s\-][A-Z][a-z]+){0,2}),\s*([A-Z]{2,3}\b|[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/
    );
    return m ? m[0] : loc || '';
  }

  /* ---------- Public API ---------- */

  window.IP_ENHANCE = {
    /**
     * Take a normalized portfolio model and return a presentation-ready one:
     * grouped skills, polished copy, placeholder projects when none exist.
     */
    present(model) {
      const skillGroups = categorizeSkills(model.skills);
      const headline = brandHeadline(model.headline, skillGroups);
      const projects = (model.projects || []).filter((p) => p.title || p.description);
      return {
        ...model,
        headline,
        summary: brandSummary(model.summary, headline, skillGroups),
        location: cleanLocation(model.location),
        skillGroups,
        skills: skillGroups.flatMap((g) => g.skills),
        projects: projects.length ? projects : placeholderProjects(model.skills),
      };
    },
    categorizeSkills,
    cleanSkill,
  };
})();
