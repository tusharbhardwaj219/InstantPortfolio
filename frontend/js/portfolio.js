/* ===================================================
   INSTANT PORTFOLIO — Public Portfolio Renderer
   Data sources (in order):
     1. ?slug= / /p/:slug  → backend API
     2. ?local=1 or stored → localStorage (generator handoff)
     3. demo data
   =================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function safeUrl(url) {
    try {
      const u = new URL(url, window.location.href);
      return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:' || u.protocol === 'tel:'
        ? u.href
        : null;
    } catch {
      return null;
    }
  }

  const DEMO = {
    name: 'Alex Morgan',
    headline: 'Full-Stack Developer',
    summary:
      'I design and build fast, resilient web products end-to-end — from database schema to the last pixel. I care about performance budgets, honest UX, and shipping things people actually use.',
    email: 'alex@example.com',
    phone: '',
    location: 'Berlin, Germany',
    github: 'https://github.com',
    linkedin: 'https://linkedin.com',
    website: '',
    skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'GraphQL', 'Docker', 'AWS', 'Redis'],
    projects: [
      { title: 'Realtime Collaboration Engine', description: 'CRDT-based document engine syncing 10k concurrent editors with sub-100ms latency.', githubUrl: 'https://github.com', liveUrl: '' },
      { title: 'Open-Source Design System', description: 'Accessible component library adopted by 40+ product teams; 98 Lighthouse a11y score.', githubUrl: 'https://github.com', liveUrl: '' },
      { title: 'Edge Analytics Pipeline', description: 'Stream processing at the CDN edge, cutting analytics ingestion cost by 70%.', githubUrl: '', liveUrl: '' },
    ],
    experiences: [
      { role: 'Senior Full-Stack Developer', company: 'Nimbus Labs', startDate: '2022', endDate: 'Present', description: 'Own the core platform serving 2M monthly users; led the migration to edge rendering.' },
      { role: 'Full-Stack Developer', company: 'Craftware', startDate: '2019', endDate: '2022', description: 'Built and scaled three customer-facing products from prototype to production.' },
    ],
    educations: [
      { institution: 'Technical University', degree: 'B.Sc.', field: 'Computer Science', startDate: '2015', endDate: '2019' },
    ],
    certifications: [
      { name: 'AWS Solutions Architect — Associate', issuer: 'Amazon Web Services', issueDate: '2023' },
    ],
    socialLinks: [],
    _demo: true,
  };

  /* ---------- Data loading ---------- */

  function slugFromLocation() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('slug')) return params.get('slug');
    const m = window.location.pathname.match(/^\/p\/([^/]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  /** Normalize the backend Portfolio record into the view model. */
  function fromBackend(p) {
    return {
      name: p.fullName || 'Untitled',
      headline: p.headline || '',
      summary: p.summary || '',
      email: p.email || '',
      phone: p.phone || '',
      location: p.location || '',
      github: p.github || '',
      linkedin: p.linkedin || '',
      website: p.website || '',
      skills: (p.skills || []).map((s) => s.name).filter(Boolean),
      projects: p.projects || [],
      experiences: p.experiences || [],
      educations: p.educations || [],
      certifications: p.certifications || [],
      socialLinks: p.socialLinks || [],
    };
  }

  /** Normalize the generator's local profile into the view model. */
  function fromLocalProfile(profile) {
    return {
      name: profile.name || 'Untitled',
      headline: profile.title || '',
      summary: profile.about || '',
      email: profile.email || '',
      phone: profile.phone || '',
      location: profile.location || '',
      github: profile.github || '',
      linkedin: profile.linkedin || '',
      website: profile.website || '',
      skills: profile.skills || [],
      projects: profile.projects || [],
      experiences: profile.experiences || [],
      educations: profile.educations || [],
      certifications: profile.certifications || [],
      socialLinks: [],
    };
  }

  async function loadData() {
    const slug = slugFromLocation();

    if (slug && window.IP_API) {
      const seenKey = `ip_seen_${slug}`;
      const firstVisit = !localStorage.getItem(seenKey);
      const payload = await IP_API.getPublicPortfolio(slug, firstVisit); // throws on 404
      localStorage.setItem(seenKey, '1');
      return fromBackend(payload.data.portfolio);
    }

    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem('ip_portfolio'));
    } catch { /* corrupted */ }

    if (stored) {
      if (stored.source === 'backend' && stored.portfolio) {
        const model = fromBackend(stored.portfolio);
        // Local profile keeps the user's manual corrections
        if (stored.profile) {
          const p = fromLocalProfile(stored.profile);
          model.name = p.name || model.name;
          model.headline = p.headline || model.headline;
          model.summary = p.summary || model.summary;
          if (p.skills.length) model.skills = p.skills;
        }
        return model;
      }
      if (stored.profile) return fromLocalProfile(stored.profile);
    }

    return DEMO;
  }

  /* ---------- Rendering ---------- */

  function renderName(model) {
    const el = $('heroName');
    const words = model.name.trim().split(/\s+/);
    let i = 0;
    el.innerHTML = words
      .map((w, idx) => {
        const cls = idx === words.length - 1 && words.length > 1 ? ' class="accent"' : '';
        return `<span class="word"><span${cls} style="--i:${i++}">${esc(w)}</span></span>`;
      })
      .join(' ');
    $('navMark').textContent = model.name;
    $('footName').textContent = `© ${new Date().getFullYear()} ${model.name}`;
    const initials = words.map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    $('heroWatermark').textContent = initials;
    const avatar = $('heroAvatar');
    if (avatar) avatar.textContent = initials;
  }

  /** Stat chips derived from the actual resume data (only shown when real). */
  function renderStats(model) {
    const el = $('heroStats');
    if (!el) return;
    const chips = [];

    const startYears = (model.experiences || [])
      .map((e) => parseInt((String(e.startDate || '').match(/(19|20)\d{2}/) || [])[0], 10))
      .filter(Boolean);
    if (startYears.length) {
      const span = new Date().getFullYear() - Math.min(...startYears);
      if (span >= 1 && span < 40) chips.push(`${span}+ ${span === 1 ? 'year' : 'years'} experience`);
    }

    const realProjects = (model.projects || []).filter((p) => !p.suggested && (p.title || p.description));
    if (realProjects.length) chips.push(`${realProjects.length} project${realProjects.length > 1 ? 's' : ''}`);

    if ((model.skills || []).length >= 4) chips.push(`${model.skills.length} skills`);

    const certs = (model.certifications || []).filter((c) => c.name);
    if (certs.length) chips.push(`${certs.length} certification${certs.length > 1 ? 's' : ''}`);

    if (!chips.length) return;
    el.innerHTML = chips.map((c) => `<span class="hero-stat">${esc(c)}</span>`).join('');
    el.classList.remove('hidden');
  }

  function renderHero(model) {
    renderName(model);
    $('heroRole').textContent = model.headline || 'Developer';
    const firstSentence = model.summary ? (model.summary.match(/^.*?[.!?](?:\s|$)/) || [model.summary])[0] : '';
    const tag = firstSentence ? firstSentence.trim().slice(0, 180) : 'Building useful things for the web.';
    $('heroTag').textContent = tag;

    if (model.location) {
      $('heroLoc').textContent = `📍 Based in ${model.location}`;
      $('heroLoc').classList.remove('hidden');
    }
    if (model.github && safeUrl(model.github)) {
      $('heroGithubBtn').href = safeUrl(model.github);
      $('heroGithubBtn').classList.remove('hidden');
    }
    if (model.linkedin && safeUrl(model.linkedin)) {
      $('heroLinkedinBtn').href = safeUrl(model.linkedin);
      $('heroLinkedinBtn').classList.remove('hidden');
    }
  }

  function renderMarquee(model) {
    if (!model.skills.length) return;
    const items = model.skills.map((s) => `<span class="marquee-item">${esc(s)}</span>`).join('');
    // duplicated so the -50% translation loops seamlessly
    $('marqueeTrack').innerHTML = items + items;
    $('marquee').classList.remove('hidden');
  }

  function renderAbout(model) {
    if (!model.summary && !model.skills.length && !model.email) return;
    $('about').classList.remove('hidden');
    $('aboutText').textContent =
      model.summary || `${model.headline || 'Developer'} focused on building quality software.`;

    const facts = [];
    if (model.location) facts.push(['Location', model.location]);
    if (model.email) facts.push(['Email', model.email]);
    if (model.experiences.length) facts.push(['Roles held', String(model.experiences.length)]);
    if (model.projects.length) facts.push(['Projects', String(model.projects.length)]);
    $('aboutFacts').innerHTML = facts.length
      ? `<dl>${facts.map(([k, v]) => `<div class="about-fact"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`
      : '';

    const groups = model.skillGroups && model.skillGroups.length
      ? model.skillGroups
      : model.skills.length
        ? [{ group: 'Toolbox', skills: model.skills }]
        : [];
    $('skillGroups').innerHTML = groups
      .map(
        (g) => `
        <div>
          <div class="skill-group-label">${esc(g.group)}</div>
          <div class="skill-tags">${g.skills.map((s) => `<span class="skill-tag">${esc(s)}</span>`).join('')}</div>
        </div>`
      )
      .join('');
  }

  /** Decorative per-project SVG banner (deterministic pattern from the title). */
  function projectBanner(title, index) {
    const seed = Array.from(title || 'p').reduce((a, c) => a + c.charCodeAt(0), index * 7);
    const shapes = [];
    for (let i = 0; i < 5; i++) {
      const x = ((seed * (i + 3)) % 90) + 5;
      const y = ((seed * (i + 7)) % 50) + 5;
      const r = ((seed * (i + 11)) % 14) + 6;
      shapes.push(
        i % 2 === 0
          ? `<circle cx="${x}" cy="${y}" r="${r}" fill="var(--acc)" opacity="0.${(i % 3) + 1}"/>`
          : `<rect x="${x}" y="${y}" width="${r * 2}" height="${r * 2}" rx="4" fill="var(--acc2)" opacity="0.${(i % 3) + 1}" transform="rotate(${(seed * i) % 45} ${x} ${y})"/>`
      );
    }
    const initial = esc((title || '?').trim().charAt(0).toUpperCase());
    return `
      <svg class="work-banner" viewBox="0 0 160 60" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="160" height="60" fill="var(--acc-soft)"/>
        ${shapes.join('')}
        <text x="80" y="38" text-anchor="middle" font-family="Space Grotesk, sans-serif"
              font-size="26" font-weight="700" fill="var(--acc)" opacity="0.85">${initial}</text>
      </svg>`;
  }

  function renderWork(model) {
    const projects = model.projects.filter((p) => p.title || p.description);
    if (!projects.length) return;
    $('work').classList.remove('hidden');
    const allSuggested = projects.every((p) => p.suggested);
    if (allSuggested) $('workTitle').textContent = 'Project Ideas';
    $('workList').innerHTML = projects
      .map((p, i) => {
        const links = [];
        const live = p.liveUrl && safeUrl(p.liveUrl);
        const gh = p.githubUrl && safeUrl(p.githubUrl);
        if (live) links.push(`<a class="work-link" href="${esc(live)}" target="_blank" rel="noopener noreferrer">Live ↗</a>`);
        if (gh) links.push(`<a class="work-link" href="${esc(gh)}" target="_blank" rel="noopener noreferrer">Code ↗</a>`);
        return `
        <article class="work-item reveal">
          <div class="work-visual">
            <div class="work-index">${String(i + 1).padStart(2, '0')}</div>
            ${projectBanner(p.title, i)}
          </div>
          <div>
            <h3 class="work-title">${esc(p.title || 'Untitled project')}
              ${p.suggested ? '<span class="work-badge">Suggested</span>' : ''}
            </h3>
            ${p.description ? `<p class="work-desc">${esc(p.description)}</p>` : ''}
            ${p.tech && p.tech.length ? `<div class="work-tech">${p.tech.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
          </div>
          <div class="work-links">${links.join('')}</div>
        </article>`;
      })
      .join('');
  }

  function renderExperience(model) {
    const items = model.experiences.filter((e) => e.role || e.company);
    if (!items.length) return;
    $('experience').classList.remove('hidden');
    $('timeline').innerHTML = items
      .map((e) => {
        const period = [e.startDate, e.endDate].filter(Boolean).join(' — ');
        return `
        <li class="tl-item reveal">
          ${period ? `<div class="tl-period">${esc(period)}</div>` : ''}
          <div class="tl-role">${esc(e.role || 'Role')}</div>
          ${e.company ? `<div class="tl-company">${esc(e.company)}</div>` : ''}
          ${e.description ? `<p class="tl-desc">${esc(e.description)}</p>` : ''}
        </li>`;
      })
      .join('');
  }

  function renderEducation(model) {
    const edus = model.educations.filter((e) => e.institution || e.degree);
    const certs = model.certifications.filter((c) => c.name || c.issuer);
    if (!edus.length && !certs.length) return;
    $('education').classList.remove('hidden');

    const eduCards = edus.map((e) => {
      const title = [e.degree, e.field].filter(Boolean).join(' · ') || 'Degree';
      const period = [e.startDate, e.endDate].filter(Boolean).join(' — ');
      return `
      <div class="edu-card reveal">
        <div class="edu-kind">Education</div>
        <div class="edu-title">${esc(title)}</div>
        ${e.institution ? `<div class="edu-sub">${esc(e.institution)}</div>` : ''}
        ${period ? `<div class="edu-date">${esc(period)}</div>` : ''}
      </div>`;
    });

    const certCards = certs.map((c) => `
      <div class="edu-card reveal">
        <div class="edu-kind">Certification</div>
        <div class="edu-title">${esc(c.name || 'Certification')}</div>
        ${c.issuer ? `<div class="edu-sub">${esc(c.issuer)}</div>` : ''}
        ${c.issueDate ? `<div class="edu-date">${esc(c.issueDate)}</div>` : ''}
      </div>`);

    $('eduGrid').innerHTML = eduCards.concat(certCards).join('');
  }

  function renderContact(model) {
    $('contact').classList.remove('hidden');
    const actions = [];
    if (model.email) {
      actions.push(`<a class="cta-btn" href="mailto:${esc(model.email)}"><span>${esc(model.email)}</span></a>`);
    }
    if (model.phone) {
      actions.push(`<a class="ghost-btn" href="tel:${esc(model.phone.replace(/\s/g, ''))}">${esc(model.phone)}</a>`);
    }
    const extras = [
      ['GitHub', model.github],
      ['LinkedIn', model.linkedin],
      ['Website', model.website],
    ];
    for (const s of model.socialLinks) {
      if (s.url) extras.push([s.platform ? s.platform[0].toUpperCase() + s.platform.slice(1) : 'Link', s.url]);
    }
    for (const [label, url] of extras) {
      const safe = url && safeUrl(url);
      if (safe) actions.push(`<a class="ghost-btn" href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`);
    }
    $('contactActions').innerHTML = actions.join('');

    // Contact form — composes a mailto: draft (no backend inbox required)
    const form = $('contactForm');
    if (form) {
      if (!model.email) {
        form.classList.add('hidden');
      } else {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const name = $('cfName').value.trim();
          const from = $('cfEmail').value.trim();
          const msg = $('cfMessage').value.trim();
          if (!name || !from || !msg) return;
          const subject = encodeURIComponent(`Portfolio contact from ${name}`);
          const body = encodeURIComponent(`${msg}\n\n— ${name} (${from})`);
          window.location.href = `mailto:${model.email}?subject=${subject}&body=${body}`;
        });
      }
    }
  }

  function renderSeo(model) {
    document.title = `${model.name} — ${model.headline || 'Portfolio'}`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute(
        'content',
        (model.summary || `${model.name}'s developer portfolio.`).slice(0, 155)
      );
    }
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: model.name,
      jobTitle: model.headline || undefined,
      email: model.email ? `mailto:${model.email}` : undefined,
      url: window.location.href,
      sameAs: [model.github, model.linkedin, model.website].filter(Boolean),
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(ld);
    document.head.appendChild(script);
  }

  /* ---------- Behaviour ---------- */

  function initBehaviour() {
    const nav = $('nav');
    const progress = $('scrollProgress');
    const onScroll = () => {
      nav.classList.toggle('scrolled', window.scrollY > 30);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = max > 0 ? `${(window.scrollY / max) * 100}%` : '0%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Scroll reveals
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

    // Active nav link
    const secObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            document.querySelectorAll('.nav-links a').forEach((a) => {
              a.classList.toggle('active', a.dataset.sec === entry.target.id);
            });
          }
        });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    ['about', 'work', 'experience', 'contact'].forEach((id) => {
      const el = $(id);
      if (el && !el.classList.contains('hidden')) secObserver.observe(el);
    });

    // Hide nav links pointing at hidden sections
    document.querySelectorAll('.nav-links a').forEach((a) => {
      const target = $(a.dataset.sec);
      if (!target || target.classList.contains('hidden')) a.style.display = 'none';
    });
  }

  /* ---------- Boot ---------- */

  async function boot() {
    // Template + color handoff from the generator's chooser
    const params = new URLSearchParams(window.location.search);
    const theme = params.get('theme') || localStorage.getItem('ip_theme');
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    const style = params.get('style') || localStorage.getItem('ip_style');
    if (style && style !== 'midnight') document.documentElement.setAttribute('data-style', style);

    let model;
    try {
      model = await loadData();
    } catch (err) {
      $('loading').classList.add('hidden');
      $('notFound').classList.remove('hidden');
      return;
    }

    // Presentation enhancement: grouped skills, polished copy, placeholders
    if (window.IP_ENHANCE) model = IP_ENHANCE.present(model);

    renderSeo(model);
    renderHero(model);
    renderStats(model);
    renderMarquee(model);
    renderAbout(model);
    renderWork(model);
    renderExperience(model);
    renderEducation(model);
    renderContact(model);

    $('loading').classList.add('hidden');
    $('site').classList.remove('hidden');

    initBehaviour();
  }

  boot();
})();
