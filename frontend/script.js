/* ===================================================
   INSTANT PORTFOLIO — Frontend Logic
   =================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- PAGE PRELOADER ---------- */
  // Eased 0→100 counter: creeps to 90 while assets load, completes only when
  // the window has actually loaded AND the intro animation had time to play.
  const pageLoader = document.getElementById('pageLoader');
  if (pageLoader) {
    const countEl = document.getElementById('plCount');
    const barEl = document.getElementById('plBar');
    const start = performance.now();
    const minShow = 1600; // let the wordmark reveal finish
    let loaded = document.readyState === 'complete';
    if (!loaded) window.addEventListener('load', () => { loaded = true; });

    let value = 0;
    let finished = false;
    function plFinish() {
      if (finished) return;
      finished = true;
      if (countEl) countEl.textContent = '100';
      if (barEl) barEl.style.width = '100%';
      pageLoader.classList.add('page-loader-done');
      // free the layer once the curtain wipe finishes
      setTimeout(() => pageLoader.remove(), 1400);
    }
    function plTick(now) {
      if (finished) return;
      const t = now - start;
      const target = (loaded && t >= minShow) ? 100 : Math.min(90, (t / minShow) * 90);
      value += (target - value) * 0.09; // ease toward target
      if (target === 100 && 100 - value < 0.5) value = 100;
      if (countEl) countEl.textContent = Math.floor(value);
      if (barEl) barEl.style.width = value + '%';
      if (value >= 100) {
        plFinish();
        return;
      }
      requestAnimationFrame(plTick);
    }
    requestAnimationFrame(plTick);
    // Failsafe: rAF pauses in hidden/background tabs — never let the loader
    // trap the page. Whatever happens, the curtain lifts within 7 seconds.
    setTimeout(plFinish, 7000);
  }

  /* ---------- NAVBAR SCROLL EFFECT ---------- */
  const navbar = document.getElementById('navbar');
  const onScroll = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- MOBILE NAV TOGGLE ---------- */
  const mobileToggle = document.getElementById('mobileToggle');
  const navLinks = document.getElementById('navLinks');
  mobileToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
  // Close on link click
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => navLinks.classList.remove('open'));
  });

  /* ---------- AUTH-AWARE NAVBAR ---------- */
  if (window.IP_API && IP_API.getToken()) {
    const user = IP_API.getUser();
    const navAuth = document.querySelector('.nav-auth');
    if (navAuth && user) {
      navAuth.innerHTML = `
        <span class="nav-user">Hi, ${escapeHtml(user.firstName)}</span>
        <button class="btn btn-ghost btn-nav" id="navLogoutBtn" type="button">Log Out</button>`;
      navAuth.querySelector('#navLogoutBtn').addEventListener('click', () => {
        IP_API.clearSession();
        window.location.reload();
      });
    }
  }

  /* ---------- BUTTON GLOW FOLLOW MOUSE ---------- */
  document.querySelectorAll('.btn-primary').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const rect = btn.getBoundingClientRect();
      btn.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width * 100) + '%');
      btn.style.setProperty('--my', ((e.clientY - rect.top) / rect.height * 100) + '%');
    });
  });

  /* ---------- FADE-UP ON SCROLL (Intersection Observer) ---------- */
  const fadeEls = document.querySelectorAll('.fade-up');
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 80);
        fadeObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  fadeEls.forEach(el => fadeObserver.observe(el));

  /* ---------- SMOOTH SCROLL FOR ANCHOR LINKS ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (href === '#') { e.preventDefault(); return; } // bare '#' is an invalid selector
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ---------- HTML ESCAPING (user/remote data must never hit innerHTML raw) ---------- */
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------- TOAST SYSTEM ---------- */
  const toastContainer = document.getElementById('toast-container');
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </span>
      ${message}
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /* ---------- FILE UPLOAD SIMULATION ---------- */
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const uploadCard = document.getElementById('uploadCard');
  const processingCard = document.getElementById('processingCard');
  const portfolioPreview = document.getElementById('portfolioPreview');
  const progressBar = document.getElementById('progressBar');
  const progressSteps = document.querySelectorAll('.progress-step');

  if (dropzone) {
    // Drag & drop
    ['dragenter', 'dragover'].forEach(evt => {
      dropzone.addEventListener(evt, e => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(evt => {
      dropzone.addEventListener(evt, e => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });
    dropzone.addEventListener('drop', e => {
      const files = e.dataTransfer.files;
      if (files.length) handleUpload(files[0]);
    });

    // Click upload
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) handleUpload(fileInput.files[0]);
    });

    // Click entire dropzone to trigger file input
    dropzone.addEventListener('click', (e) => {
      if (e.target === fileInput || e.target.closest('.upload-browse')) return;
      fileInput.click();
    });
  }

  /* ---------- T&C MODAL ---------- */
  const tcModal    = document.getElementById('tcModal');
  const tcAgree    = document.getElementById('tcAgree');
  const tcAcceptBtn = document.getElementById('tcAcceptBtn');
  const tcDeclineBtn = document.getElementById('tcDeclineBtn');
  let pendingFile  = null;

  function openTCModal(file) {
    pendingFile = file;
    tcAgree.checked = false;
    tcAcceptBtn.disabled = true;
    tcModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeTCModal() {
    tcModal.classList.add('hidden');
    document.body.style.overflow = '';
    pendingFile = null;
    fileInput.value = '';
  }

  if (tcAgree) {
    tcAgree.addEventListener('change', () => {
      tcAcceptBtn.disabled = !tcAgree.checked;
    });
  }

  if (tcAcceptBtn) {
    tcAcceptBtn.addEventListener('click', () => {
      if (!tcAgree.checked || !pendingFile) return;
      const file = pendingFile;
      closeTCModal();
      showToast(`"${file.name}" uploaded successfully`);
      showDetailsCard(file);
    });
  }

  if (tcDeclineBtn) {
    tcDeclineBtn.addEventListener('click', () => {
      closeTCModal();
      showToast('Upload cancelled. Accept the terms to continue.', 'info');
    });
  }

  // Close on overlay click
  if (tcModal) {
    tcModal.addEventListener('click', e => {
      if (e.target === tcModal) closeTCModal();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !tcModal.classList.contains('hidden')) closeTCModal();
    });
  }

  /* ============================================================
     RESUME AUTO-PARSING  (client-side, no backend needed)
     ============================================================ */

  async function loadPDFJS() {
    const existing = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
    if (existing) return existing;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
      s.onload = () => {
        const lib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
        if (lib) {
          lib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
          resolve(lib);
        } else reject(new Error('pdfjsLib not found'));
      };
      s.onerror = () => reject(new Error('PDF.js CDN failed'));
      document.head.appendChild(s);
    });
  }

  async function loadMammoth() {
    if (window.mammoth) return window.mammoth;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
      s.onload = () => window.mammoth ? resolve(window.mammoth) : reject(new Error('mammoth not found'));
      s.onerror = () => reject(new Error('mammoth.js CDN failed'));
      document.head.appendChild(s);
    });
  }

  async function extractTextFromFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      const pdfjsLib = await loadPDFJS();
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      let text = '';
      for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        let lastY = null;
        for (const item of content.items) {
          if (lastY !== null && Math.abs(item.transform[5] - lastY) > 3) text += '\n';
          text += item.str;
          lastY = item.transform[5];
        }
        text += '\n';
      }
      return text;
    } else if (ext === 'docx') {
      const mammoth = await loadMammoth();
      const buffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      return result.value;
    }
    return '';
  }

  function parseResumeText(rawText) {
    // Re-join words hyphen-wrapped across lines (PDF artifact: "Full-\nStack")
    const text  = rawText.replace(/\r/g, '').replace(/(\w)-\n(?=[a-z])/g, '$1');
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    /* Email */
    const emailM = text.match(/[\w.+\-]+@[\w\-]+\.[\w.]+/);
    const email  = emailM ? emailM[0].toLowerCase() : '';

    /* Phone — matches most international / US formats */
    const phoneM = text.match(/(\+?[\d][\d\s().\-]{7,}[\d])/);
    const phone  = phoneM ? phoneM[0].trim() : '';

    /* Name — first short alphabetic line near the top */
    let name = '';
    for (const line of lines.slice(0, 8)) {
      if (!line.includes('@') && !/https?:\/\//.test(line) &&
          line.length >= 2 && line.length <= 55 &&
          /^[A-Za-z][A-Za-z\s.''\-]+$/.test(line)) {
        name = line;
        break;
      }
    }

    /* Job title — detect common title keywords near top */
    let title = '';
    const titleRe = /\b(developer|engineer|designer|manager|analyst|scientist|consultant|architect|specialist|director|lead|senior|junior|intern|full[\s\-]?stack|front[\s\-]?end|back[\s\-]?end|devops|product|data|software|web|mobile|ui\/ux|qa|sre|sde)\b/i;
    for (const line of lines.slice(0, 20)) {
      if (titleRe.test(line) && line.length < 100 && !line.includes('@')) {
        title = line;
        break;
      }
    }
    // Headlines pulled from wrapped paragraphs often end mid-clause — tidy them
    if (/[-–,]$/.test(title) || title.length > 80) {
      const clause = title.split(/\s+with\s+|\s+having\s+/i)[0];
      if (clause && clause.length >= 12) title = clause;
    }
    title = title.replace(/[\s,;:–\-]+$/, '').replace(/\s+(and|or|with|in|for|a|an)$/i, '');

    /* Location — city must be 1-3 Titlecase words, so an ALL-CAPS name glued in
       front ("TUSHARFaridabad, Haryana") can't be swallowed into the match */
    const locM   = text.match(/([A-Z][a-z]+(?:[\s\-][A-Z][a-z]+){0,2}),\s*([A-Z]{2,3}\b|[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
    const location = locM ? locM[0] : '';

    /* Summary / About — text under a "Summary / Profile / Objective" heading */
    let about = '';
    const sumRe = /(?:summary|objective|profile|about me|overview|professional\s+summary)[:\s]*\n?([\s\S]*?)(?=\n[A-Z][A-Z\s]{2,}[\s:]|$)/i;
    const sumM  = text.match(sumRe);
    if (sumM && sumM[1]) {
      about = sumM[1].replace(/\s+/g, ' ').trim().substring(0, 500);
    }

    /* Skills — extract from a "Skills / Technologies / Tools" section */
    let skills = [];
    const skillRe = /(?:skills?|technical skills?|competencies|technologies|tools?|tech stack)[:\s]*\n?([\s\S]*?)(?=\n[A-Z][A-Z\s]{2,}[\s:]|\n\n[A-Z]|$)/i;
    const skillM  = text.match(skillRe);
    if (skillM && skillM[1]) {
      // Split on ':' too so category labels ("Web Development: HTML5") don't
      // merge with values; strip trailing dots; drop label-only tokens.
      const stop = /^(certifications?|programming|web development|databases?|tools?|languages?|frameworks?|technologies|tech stack|others?|soft skills)$/i;
      skills = skillM[1]
        .split(/[,;:|•·\n\/\\▪▸–\-]/)
        .map(s => s.replace(/[^\w\s.+#]/g, '').replace(/[.\s]+$/, '').trim())
        .filter(s => s.length > 1 && s.length < 35 && !/^\d+$/.test(s) && !stop.test(s));
      skills = [...new Set(skills)].slice(0, 20);
    }

    return { name, title, email, phone, location, about, skills };
  }

  // Raw text + parsed fields of the last uploaded resume — fuels the real
  // ATS analysis (js/ats.js) once the portfolio is generated.
  let lastResumeAnalysis = null;

  async function autoParseResume(file) {
    const statusEl = document.getElementById('resumeParseStatus');
    const msgEl    = document.getElementById('resumeParseMsg');
    const genBtn   = document.getElementById('detailsGenerateBtn');

    lastResumeAnalysis = null;
    if (statusEl) { statusEl.classList.remove('hidden', 'success'); }
    if (msgEl)    msgEl.textContent = 'Reading your resume…';
    if (genBtn)   genBtn.disabled = true;

    try {
      const text = await extractTextFromFile(file);
      if (!text.trim()) throw new Error('empty');

      if (msgEl) msgEl.textContent = 'Extracting your information…';
      const parsed = parseResumeText(text);
      lastResumeAnalysis = { text, parsed };

      /* Pre-fill form fields (only empty fields, never overwrite what user typed) */
      const set = (id, val) => {
        const el = document.getElementById(id);
        if (el && !el.value && val) el.value = val;
      };
      set('dfName',     parsed.name);
      set('dfTitle',    parsed.title);
      set('dfEmail',    parsed.email);
      set('dfPhone',    parsed.phone);
      set('dfLocation', parsed.location);
      set('dfAbout',    parsed.about);

      const dfSkillsEl = document.getElementById('dfSkills');
      if (dfSkillsEl && !dfSkillsEl.value && parsed.skills.length) {
        dfSkillsEl.value = parsed.skills.join(', ');
        dfSkillsEl.dispatchEvent(new Event('input'));
      }

      if (statusEl) statusEl.classList.add('success');
      if (msgEl)    msgEl.textContent = '✓ Resume parsed — please review and confirm your details';
      setTimeout(() => { if (statusEl) statusEl.classList.add('hidden'); }, 5000);
    } catch {
      /* Silent fail — user fills form manually */
      if (statusEl) statusEl.classList.add('hidden');
    } finally {
      if (genBtn) genBtn.disabled = false;
    }
  }

  function handleUpload(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx'].includes(ext)) {
      showToast('Please upload a PDF or DOCX file', 'error');
      return;
    }
    openTCModal(file);
  }

  /* ---------- DETAILS CARD ---------- */
  const detailsCard   = document.getElementById('detailsCard');
  const detailsForm   = document.getElementById('detailsForm');
  const detailsBackBtn = document.getElementById('detailsBackBtn');
  const detailsFileName = document.getElementById('detailsFileName');
  const dfSkills      = document.getElementById('dfSkills');
  const dfSkillPreview = document.getElementById('dfSkillPreview');
  let currentFile = null; // kept for the real backend upload at generation time

  function showDetailsCard(file) {
    currentFile = file;
    uploadCard.classList.add('hidden');
    const liSec = document.getElementById('linkedinImportSec');
    if (liSec) liSec.classList.add('hidden');
    if (detailsFileName) detailsFileName.textContent = file.name;
    if (detailsCard) detailsCard.classList.remove('hidden');
    const firstInput = detailsCard && detailsCard.querySelector('.details-input');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
    // Automatically parse the resume and pre-fill the form
    autoParseResume(file);
  }

  if (detailsBackBtn) {
    detailsBackBtn.addEventListener('click', () => {
      detailsCard.classList.add('hidden');
      uploadCard.classList.remove('hidden');
      const liSec = document.getElementById('linkedinImportSec');
      if (liSec) liSec.classList.remove('hidden');
    });
  }

  // Live skill tag preview
  if (dfSkills) {
    dfSkills.addEventListener('input', () => {
      const tags = dfSkills.value.split(',').map(s => s.trim()).filter(Boolean);
      dfSkillPreview.innerHTML = tags.map(t => `<span class="details-skill-tag">${escapeHtml(t)}</span>`).join('');
    });
  }

  if (detailsForm) {
    detailsForm.addEventListener('submit', e => {
      e.preventDefault();
      const name     = document.getElementById('dfName').value.trim();
      const title    = document.getElementById('dfTitle').value.trim();
      const email    = document.getElementById('dfEmail').value.trim();
      const phone    = document.getElementById('dfPhone').value.trim();
      const location = document.getElementById('dfLocation').value.trim();
      const about    = document.getElementById('dfAbout').value.trim();
      const skills   = dfSkills ? dfSkills.value.split(',').map(s => s.trim()).filter(Boolean) : [];

      // Validate required fields
      let valid = true;
      [['dfName', name], ['dfTitle', title], ['dfEmail', email]].forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (!val) { el.classList.add('details-invalid'); valid = false; }
        else el.classList.remove('details-invalid');
      });
      if (!valid) return;

      const profile = { name, title, email, phone, location, about, skills };
      populatePortfolio(profile);
      detailsCard.classList.add('hidden');
      startProcessing(profile);
    });
  }

  function populatePortfolio({ name, title, email, phone, location, about, skills }) {
    // Avatar initials
    const avatar = document.getElementById('pfAvatar');
    if (avatar) {
      const parts = name.split(' ').filter(Boolean);
      avatar.textContent = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : name.substring(0, 2).toUpperCase();
    }

    // Name & role
    const pfName = document.getElementById('pfName');
    if (pfName) pfName.textContent = name;

    const pfRole = document.getElementById('pfRole');
    if (pfRole) pfRole.textContent = title;

    // Location
    const pfLoc = document.getElementById('pfLocation');
    if (pfLoc && location) {
      pfLoc.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${location}`;
    }

    // About
    const pfAbout = document.getElementById('pfAbout');
    if (pfAbout && about) pfAbout.textContent = about;

    // Email
    const pfEmailLink = document.getElementById('pfEmailLink');
    const pfEmailText = document.getElementById('pfEmailText');
    if (pfEmailLink && email) pfEmailLink.href = `mailto:${email}`;
    if (pfEmailText && email) pfEmailText.textContent = email;

    // Phone
    const pfPhoneLink = document.getElementById('pfPhoneLink');
    const pfPhoneText = document.getElementById('pfPhoneText');
    if (pfPhoneLink && phone) pfPhoneLink.href = `tel:${phone.replace(/\s/g, '')}`;
    if (pfPhoneText) pfPhoneText.textContent = phone || '+1 (415) 555-0123';
    if (!phone && pfPhoneLink) pfPhoneLink.style.display = 'none';

    // Skills — replace the grid with a single flat category
    const pfSkillsGrid = document.getElementById('pfSkillsGrid');
    if (pfSkillsGrid && skills.length) {
      pfSkillsGrid.innerHTML = `<div class="pf-skill-cat" style="grid-column:1/-1">
        <span class="pf-skill-cat-label">Skills</span>
        <div class="pf-skill-tags">${skills.map(s => `<span class="pf-tag">${escapeHtml(s)}</span>`).join('')}</div>
      </div>`;
    }

    // Update SEO modal sample if it exists
    const seoTitle = document.querySelector('#seoModal .seo-code');
    if (seoTitle) {
      seoTitle.textContent = seoTitle.textContent.replace('John Doe', name).replace('Senior Full-Stack Developer', title);
    }

    // Hide stats row — hardcoded numbers that are not from the real resume
    const pfStatsRow = document.querySelector('#portfolioCard .pf-stats-row');
    if (pfStatsRow) pfStatsRow.style.display = 'none';

    // Hide featured projects section — hardcoded demo projects, not from real resume
    const pfProjectsGrid = document.querySelector('#portfolioCard .pf-projects-grid');
    if (pfProjectsGrid) {
      const sec = pfProjectsGrid.closest('.pf-sec');
      if (sec) sec.style.display = 'none';
    }

    // Hide experience section — hardcoded demo experience, not from real resume
    const pfTimeline = document.querySelector('#portfolioCard .pf-timeline');
    if (pfTimeline) {
      const sec = pfTimeline.closest('.pf-sec');
      if (sec) sec.style.display = 'none';
    }

    // Replace social bar with only real, user-provided links (no fake GitHub/LinkedIn/Twitter)
    const pfSocialBar = document.querySelector('#portfolioCard .pf-social-bar');
    if (pfSocialBar) {
      const socialItems = [];
      if (email) socialItems.push(`
        <a href="mailto:${email}" class="pf-social-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Email
        </a>`);
      if (phone) socialItems.push(`
        <a href="tel:${phone.replace(/\s/g,'')}" class="pf-social-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.4 12.28 19.79 19.79 0 011.34 3.7 2 2 0 013.33 1.5h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.91 9a16 16 0 006.29 6.29l.82-.82a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
          Call
        </a>`);
      pfSocialBar.innerHTML = socialItems.join('') || pfSocialBar.innerHTML;
    }

  }

  /* ---------- PROCESSING (real backend upload when possible) ---------- */
  function startProcessing(profile) {
    uploadCard.classList.add('hidden');
    processingCard.classList.add('hidden');

    // Attempt the real pipeline: upload → parse → generate → apply the user's
    // manual corrections. Resolves with the server portfolio, or null to fall
    // back to the local in-page preview.
    let backendPromise = Promise.resolve(null);
    if (window.IP_API && IP_API.getToken() && currentFile) {
      backendPromise = (async () => {
        if (!(await IP_API.isBackendUp())) return null;
        const data = await IP_API.uploadResume(currentFile, () => {});
        let portfolio = data.portfolio;
        try {
          const updated = await IP_API.updatePortfolio(portfolio.id, {
            fullName: profile.name || portfolio.fullName,
            headline: profile.title || portfolio.headline,
            summary: profile.about || portfolio.summary,
            email: profile.email || portfolio.email,
            phone: profile.phone || portfolio.phone,
            location: profile.location || portfolio.location,
          });
          portfolio = updated.data.portfolio;
        } catch (e) {
          console.warn('Could not apply manual corrections:', e.message);
        }
        return portfolio;
      })().catch(err => {
        console.warn('Backend generation failed — using local preview:', err.message);
        return null;
      });
    }

    fslShow(backendPromise, profile);
  }

  /**
   * Persist the result and point the "Your link" card at the real portfolio page.
   */
  function finalizeGeneration(portfolio, profile) {
    const urlEl = document.getElementById('generatedUrl');
    let href;
    if (portfolio && portfolio.slug) {
      localStorage.setItem('ip_portfolio', JSON.stringify({
        source: 'backend', slug: portfolio.slug, portfolio, profile, savedAt: Date.now(),
      }));
      href = window.location.port === '5000'
        ? `/p/${encodeURIComponent(portfolio.slug)}`
        : `portfolio.html?slug=${encodeURIComponent(portfolio.slug)}`;
    } else {
      localStorage.setItem('ip_portfolio', JSON.stringify({
        source: 'local', profile, savedAt: Date.now(),
      }));
      href = 'portfolio.html?local=1';
    }
    const absolute = new URL(href, window.location.href).href;
    if (urlEl) {
      urlEl.textContent = absolute;
      urlEl.dataset.href = absolute;
    }

    // Load the REAL portfolio page into the framed live preview
    const frame = document.getElementById('pfFrame');
    const frameWrap = document.getElementById('pfFrameWrap');
    const frameUrl = document.getElementById('pfFrameUrl');
    const frameOpen = document.getElementById('pfFrameOpen');
    if (frame && frameWrap) {
      const u = new URL(href, window.location.href);
      const theme = localStorage.getItem('ip_theme');
      const style = localStorage.getItem('ip_style');
      if (theme) u.searchParams.set('theme', theme);
      if (style && style !== 'midnight') u.searchParams.set('style', style);
      frame.src = u.href;
      if (frameUrl) frameUrl.textContent = absolute.replace(/^https?:\/\//, '');
      if (frameOpen) frameOpen.href = absolute;
      frameWrap.classList.remove('hidden');
    }

    // Reveal the template chooser — pick a template + color, preview updates live
    const chooser = document.getElementById('templateChooser');
    if (chooser) {
      chooser.classList.remove('hidden');
      tcMarkSelected();
    }
  }

  /* ============================================================
     FULL-SCREEN LOADER  (fsl-)
     ============================================================ */
  const FSL_MSGS = [
    'Reading resume content…',
    'Extracting key skills and experience…',
    'Crafting your personal brand story…',
    'Designing portfolio layout…',
    'Optimising for ATS compatibility…',
    'Generating unique portfolio URL…',
    'Applying finishing touches…',
  ];

  const FSL_STEPS = [
    { pct: 8,   dur: 900  },
    { pct: 30,  dur: 1400 },
    { pct: 56,  dur: 1600 },
    { pct: 80,  dur: 1200 },
    { pct: 100, dur: 1000 },
  ];

  function fslSetStep(li, state) {
    li.dataset.state = state;
    const ic = li.querySelector('.fsl-step-ic');
    if (state === 'active') {
      ic.innerHTML = '<div class="fsl-spin"></div>';
    } else if (state === 'done') {
      ic.innerHTML = `<svg class="fsl-ck-svg" viewBox="0 0 14 14">
        <path class="fsl-ck-path" d="M2 7l4 4 6-6"/>
      </svg>`;
    } else {
      ic.innerHTML = '';
    }
  }

  function fslAnimPct(fromPct, toPct, durationMs, fillEl, pctEl) {
    const start = performance.now();
    function tick(now) {
      const t = Math.min((now - start) / durationMs, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const val = fromPct + (toPct - fromPct) * ease;
      fillEl.style.width = val + '%';
      pctEl.textContent = Math.round(val) + '%';
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function fslStartParticles() {
    const canvas = document.getElementById('fslCanvas');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    let running = true;
    const particles = [];
    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    for (let i = 0; i < 55; i++) {
      const hue = Math.random() < 0.55 ? (Math.random() * 20 + 345) : (Math.random() * 22 + 20);
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.6 + 0.4,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        a: Math.random() * 0.45 + 0.08,
        hue,
      });
    }
    function draw() {
      if (!running) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},88%,65%,${p.a})`;
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    draw();
    return { stop() { running = false; ro.disconnect(); } };
  }

  function fslShow(backendPromise, profile) {
    const fsl       = document.getElementById('fsl');
    const fillEl    = document.getElementById('fslProgFill');
    const pctEl     = document.getElementById('fslProgPct');
    const msgEl     = document.getElementById('fslAiMsg');
    const etaEl     = document.getElementById('fslEta');
    const steps     = Array.from(document.querySelectorAll('#fslChecklist .fsl-step'));
    if (!fsl) { fslFallback(backendPromise, profile); return; }

    // reset state
    fillEl.style.width = '0%';
    pctEl.textContent  = '0%';
    etaEl.textContent  = '8';
    steps.forEach(li => fslSetStep(li, 'pending'));
    msgEl.textContent  = FSL_MSGS[0];

    fsl.classList.add('fsl-on');

    const parts = fslStartParticles();

    // Rotate AI messages
    let msgIdx = 0;
    const aiTimer = setInterval(() => {
      msgEl.classList.add('fsl-fade');
      setTimeout(() => {
        msgIdx = (msgIdx + 1) % FSL_MSGS.length;
        msgEl.textContent = FSL_MSGS[msgIdx];
        msgEl.classList.remove('fsl-fade');
      }, 240);
    }, 1600);

    // ETA countdown
    let eta = 8;
    const etaTimer = setInterval(() => {
      if (eta > 1) { eta--; etaEl.textContent = eta; }
    }, 1000);

    // Run steps in sequence
    let prevPct = 0;
    let sIdx    = 0;
    function runStep() {
      if (sIdx >= FSL_STEPS.length) {
        // Animation finished — wait for the real pipeline before revealing
        Promise.resolve(backendPromise).then(portfolio => {
          finalizeGeneration(portfolio, profile);
          fslHide(parts, aiTimer, etaTimer);
        });
        return;
      }
      if (sIdx > 0) fslSetStep(steps[sIdx - 1], 'done');
      fslSetStep(steps[sIdx], 'active');
      const { pct, dur } = FSL_STEPS[sIdx];
      fslAnimPct(prevPct, pct, dur, fillEl, pctEl);
      prevPct = pct;
      sIdx++;
      setTimeout(runStep, dur + 320);
    }
    setTimeout(runStep, 300);
  }

  function fslHide(parts, aiTimer, etaTimer) {
    clearInterval(aiTimer);
    clearInterval(etaTimer);
    const fsl = document.getElementById('fsl');
    if (parts) parts.stop();
    if (fsl) {
      fsl.classList.add('fsl-out');
      setTimeout(() => {
        fsl.classList.remove('fsl-on', 'fsl-out');
      }, 700);
    }
    // reveal portfolio
    setTimeout(() => {
      portfolioPreview.classList.remove('hidden');
      portfolioPreview.querySelectorAll('.fade-up').forEach(el => {
        fadeObserver.observe(el);
      });
      portfolioPreview.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('Portfolio generated! Your link is ready.');
    }, 380);
  }

  function fslFallback(backendPromise, profile) {
    // Graceful degradation: old progress-card behaviour
    processingCard.classList.remove('hidden');
    const steps = progressSteps;
    let i = 0;
    function next() {
      if (i >= steps.length) {
        Promise.resolve(backendPromise).then(portfolio => {
          finalizeGeneration(portfolio, profile);
          processingCard.classList.add('hidden');
          portfolioPreview.classList.remove('hidden');
          portfolioPreview.querySelectorAll('.fade-up').forEach(el => fadeObserver.observe(el));
          showToast('Portfolio generated! Your link is ready.');
        });
        return;
      }
      if (i > 0) { steps[i-1].classList.remove('active'); steps[i-1].classList.add('done'); }
      steps[i].classList.add('active');
      i++;
      setTimeout(next, 900 + Math.random() * 600);
    }
    next();
  }

  /* ---------- COPY LINK ---------- */
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const generatedUrl = document.getElementById('generatedUrl');
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(generatedUrl.textContent).then(() => {
        showToast('Link copied to clipboard!');
      }).catch(() => {
        // Fallback
        const range = document.createRange();
        range.selectNodeContents(generatedUrl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand('copy');
        sel.removeAllRanges();
        showToast('Link copied to clipboard!');
      });
    });
  }

  /* ---------- OPEN PORTFOLIO ---------- */
  const openPortfolioBtn = document.getElementById('openPortfolioBtn');
  if (openPortfolioBtn) {
    openPortfolioBtn.addEventListener('click', () => {
      const href = generatedUrl && (generatedUrl.dataset.href || generatedUrl.textContent);
      if (href && href.startsWith('http')) {
        window.open(href, '_blank', 'noopener');
      } else {
        showToast('Generate a portfolio first.', 'error');
      }
    });
  }

  /* ---------- WATCH DEMO (mock) ---------- */
  const watchDemoBtn = document.getElementById('watchDemoBtn');
  if (watchDemoBtn) {
    watchDemoBtn.addEventListener('click', () => {
      showToast('Demo video coming soon!');
    });
  }

  /* ---------- FAQ ACCORDION ---------- */
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const wasOpen = item.classList.contains('open');
      // Close all
      document.querySelectorAll('.faq-item.open').forEach(openItem => {
        openItem.classList.remove('open');
      });
      // Toggle clicked
      if (!wasOpen) item.classList.add('open');
    });
  });

  /* ---------- ANIMATED COUNTERS ---------- */
  const statNumbers = document.querySelectorAll('.stat-number');
  let countersTriggered = false;

  function animateCounters() {
    statNumbers.forEach(el => {
      const target = parseInt(el.dataset.target);
      const duration = 2000;
      const start = performance.now();

      function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const ease = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(target * ease).toLocaleString();
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  const statsSection = document.getElementById('benefits');
  if (statsSection) {
    const counterObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !countersTriggered) {
        countersTriggered = true;
        animateCounters();
        counterObserver.unobserve(statsSection);
      }
    }, { threshold: 0.3 });
    counterObserver.observe(statsSection);
  }

  /* ---------- TESTIMONIALS CAROUSEL (mobile) ---------- */
  const track = document.getElementById('testimonialsTrack');
  const dots = document.querySelectorAll('#testimonialDots .dot');
  let currentSlide = 0;
  let autoSlideTimer;

  function isMobile() {
    return window.innerWidth < 769;
  }

  function goToSlide(index) {
    if (!isMobile() || !track) return;
    currentSlide = index;
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
  }

  if (track) {
    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        goToSlide(parseInt(dot.dataset.index));
        resetAutoSlide();
      });
    });

    function autoSlide() {
      if (!isMobile()) return;
      currentSlide = (currentSlide + 1) % 3;
      goToSlide(currentSlide);
    }

    function resetAutoSlide() {
      clearInterval(autoSlideTimer);
      autoSlideTimer = setInterval(autoSlide, 5000);
    }
    resetAutoSlide();

    window.addEventListener('resize', () => {
      if (!isMobile()) {
        track.style.transform = '';
      } else {
        goToSlide(currentSlide);
      }
    });
  }

  /* ---------- TEMPLATE PREVIEW MODAL ---------- */
  const tpmOverlay   = document.getElementById('templatePreviewModal');
  const tpmBackBtn   = document.getElementById('tpmBackBtn');
  const tpmCancelBtn = document.getElementById('tpmCancelBtn');
  const tpmApplyBtn  = document.getElementById('tpmApplyBtn');
  const tpmThemeDot  = document.getElementById('tpmThemeDot');
  const tpmThemeNameEl = document.getElementById('tpmThemeName');
  const tpmPortfolioWrap = document.getElementById('tpmPortfolioWrap');
  const mainPortfolioCard = document.getElementById('portfolioCard');

  const themeRegistry = {
    modern:       { name:'Modern',        cls:'pf-theme-modern',        dot:'#6c63ff' },
    creative:     { name:'Creative',       cls:'pf-theme-creative',      dot:'#ff2d78' },
    minimal:      { name:'Minimal',        cls:'pf-theme-minimal',       dot:'#e0e0e0' },
    professional: { name:'Professional',   cls:'pf-theme-professional',  dot:'#4fc3f7' },
    neon:         { name:'Neon Pulse',     cls:'pf-theme-neon',          dot:'#00ff88' },
    sunset:       { name:'Sunset Blaze',   cls:'pf-theme-sunset',        dot:'#ff6b35' },
    ocean:        { name:'Ocean Depth',    cls:'pf-theme-ocean',         dot:'#00d4aa' },
    gold:         { name:'Midnight Gold',  cls:'pf-theme-gold',          dot:'#ffd700' },
    forest:       { name:'Forest Dew',     cls:'pf-theme-forest',        dot:'#69f0ae' },
    aurora:       { name:'Aurora',         cls:'pf-theme-aurora',        dot:'#7fffd4' },
  };
  const allThemeCls = Object.values(themeRegistry).map(t => t.cls);
  let pendingThemeKey = null;

  function openThemePreview(themeKey) {
    const td = themeRegistry[themeKey];
    if (!td || !tpmOverlay) return;
    pendingThemeKey = themeKey;

    // update bar
    tpmThemeNameEl.textContent = td.name;
    tpmThemeDot.style.background = td.dot;

    // Preview the REAL portfolio page with this theme (uses the visitor's
    // generated data from localStorage, or demo data before first generation)
    const iframe = document.createElement('iframe');
    iframe.className = 'tpm-frame';
    iframe.title = `${td.name} theme preview`;
    const style = localStorage.getItem('ip_style');
    iframe.src = `portfolio.html?theme=${encodeURIComponent(themeKey)}` +
      (style && style !== 'midnight' ? `&style=${encodeURIComponent(style)}` : '');
    tpmPortfolioWrap.innerHTML = '';
    tpmPortfolioWrap.appendChild(iframe);

    tpmOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    tpmOverlay.scrollTop = 0;
  }

  function closeThemePreview() {
    if (!tpmOverlay) return;
    tpmOverlay.classList.add('hidden');
    document.body.style.overflow = '';
    pendingThemeKey = null;
  }

  function applyTheme(themeKey) {
    const td = themeRegistry[themeKey];
    if (!td) return;
    localStorage.setItem('ip_theme', themeKey); // carried over to the public portfolio page
    // Reload the live preview frame with the new theme, if visible
    const frame = document.getElementById('pfFrame');
    if (frame && frame.src && frame.src !== 'about:blank') {
      const u = new URL(frame.src);
      u.searchParams.set('theme', themeKey);
      frame.src = u.href;
    }
    // mark selected card
    document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
    const card = document.querySelector(`.template-card[data-theme="${themeKey}"]`);
    if (card) card.classList.add('selected');
    closeThemePreview();
    showToast(`"${td.name}" theme applied to your portfolio!`);
  }

  if (tpmBackBtn)   tpmBackBtn.addEventListener('click', closeThemePreview);
  if (tpmCancelBtn) tpmCancelBtn.addEventListener('click', closeThemePreview);
  if (tpmApplyBtn)  tpmApplyBtn.addEventListener('click', () => applyTheme(pendingThemeKey));
  if (tpmOverlay) {
    tpmOverlay.addEventListener('click', e => { if (e.target === tpmOverlay) closeThemePreview(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !tpmOverlay.classList.contains('hidden')) closeThemePreview();
    });
  }

  /* ---------- TEMPLATE SELECT — always opens full preview ---------- */
  document.querySelectorAll('.template-card .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.closest('.template-card').dataset.theme;
      document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
      btn.closest('.template-card').classList.add('selected');
      openThemePreview(key);
    });
  });

  /* ============================================================
     TEMPLATE CHOOSER  (appears after generation)
     Template = layout/style identity; Color = one of 10 accents.
     Every pick persists and hot-reloads the live preview frame.
     ============================================================ */
  const tcStyleNames = { midnight: 'Midnight', paper: 'Paper', soft: 'Soft', terminal: 'Terminal' };
  const tcStylesEl = document.getElementById('tcStyles');
  const tcColorsEl = document.getElementById('tcColors');

  function updateFrameParam(key, val) {
    const frame = document.getElementById('pfFrame');
    if (!frame || !frame.src || frame.src === 'about:blank') return;
    const u = new URL(frame.src);
    if (val) u.searchParams.set(key, val);
    else u.searchParams.delete(key);
    frame.src = u.href;
    // Keep the shareable link and "Open" button in sync so visitors see the
    // same template + color the owner chose
    const urlEl = document.getElementById('generatedUrl');
    const frameOpen = document.getElementById('pfFrameOpen');
    if (urlEl && urlEl.dataset.href) {
      urlEl.textContent = u.href;
      urlEl.dataset.href = u.href;
    }
    if (frameOpen) frameOpen.href = u.href;
  }

  function tcMarkSelected() {
    const style = localStorage.getItem('ip_style') || 'midnight';
    const theme = localStorage.getItem('ip_theme') || '';
    document.querySelectorAll('.tc-style').forEach(b =>
      b.classList.toggle('selected', b.dataset.style === style));
    document.querySelectorAll('.tc-color').forEach(b =>
      b.classList.toggle('selected', b.dataset.thm === theme));
  }

  // Build the 10 color swatches from the theme registry
  if (tcColorsEl) {
    tcColorsEl.innerHTML = Object.entries(themeRegistry).map(([key, t]) => `
      <button class="tc-color" type="button" data-thm="${key}" title="${t.name}" aria-label="${t.name} color theme">
        <span style="background:${t.dot}"></span>
      </button>`).join('');
  }

  if (tcStylesEl) {
    tcStylesEl.addEventListener('click', e => {
      const btn = e.target.closest('.tc-style');
      if (!btn) return;
      localStorage.setItem('ip_style', btn.dataset.style);
      updateFrameParam('style', btn.dataset.style === 'midnight' ? '' : btn.dataset.style);
      tcMarkSelected();
      showToast(`"${tcStyleNames[btn.dataset.style]}" template applied!`);
    });
  }

  if (tcColorsEl) {
    tcColorsEl.addEventListener('click', e => {
      const btn = e.target.closest('.tc-color');
      if (!btn) return;
      localStorage.setItem('ip_theme', btn.dataset.thm);
      updateFrameParam('theme', btn.dataset.thm);
      tcMarkSelected();
      showToast(`"${themeRegistry[btn.dataset.thm].name}" color applied!`);
    });
  }

  /* =======================================================
     NEW FEATURES — 2026
     ======================================================= */

  /* ---------- GENERIC MODAL HELPERS ---------- */
  function openModal(modal) {
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeModal(modal) {
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
  function bindModalClose(modalId, closeBtnId) {
    const modal = document.getElementById(modalId);
    const btn = document.getElementById(closeBtnId);
    if (btn) btn.addEventListener('click', () => closeModal(modal));
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) closeModal(modal);
    });
    return modal;
  }

  /* ---------- LINKEDIN IMPORT ---------- */
  const linkedinModal = bindModalClose('linkedinModal', 'linkedinModalCloseBtn');
  const linkedinImportBtn = document.getElementById('linkedinImportBtn');
  const linkedinOAuthBtn = document.getElementById('linkedinOAuthBtn');

  if (linkedinImportBtn) {
    linkedinImportBtn.addEventListener('click', () => openModal(linkedinModal));
  }
  if (linkedinOAuthBtn) {
    // Real OAuth: hand the browser to the backend, which redirects to
    // LinkedIn's consent screen and comes back with the profile.
    linkedinOAuthBtn.addEventListener('click', async () => {
      closeModal(linkedinModal);
      if (window.IP_API && await IP_API.isBackendUp()) {
        window.location.href = `${IP_API.API_BASE}/api/linkedin/auth`;
      } else {
        showToast('LinkedIn import needs the backend running on port 5000 (and LinkedIn API keys in backend/.env).', 'error');
      }
    });
  }

  /* Returning from LinkedIn: the profile arrives in the URL fragment
     (#liimport=<base64 json>) — fragments never leave the browser. */
  (function handleLinkedinReturn() {
    const h = window.location.hash || '';
    if (h.startsWith('#liimport=')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
      let data = null;
      try {
        const b64 = h.slice('#liimport='.length).replace(/-/g, '+').replace(/_/g, '/');
        data = JSON.parse(atob(b64));
      } catch { /* corrupted payload — fall through */ }
      if (data) {
        const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
        set('dfName', data.name);
        set('dfEmail', data.email);
        if (detailsFileName) detailsFileName.textContent = 'LinkedIn Profile';
        uploadCard.classList.add('hidden');
        const liSec = document.getElementById('linkedinImportSec');
        if (liSec) liSec.classList.add('hidden');
        if (detailsCard) {
          detailsCard.classList.remove('hidden');
          detailsCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        showToast(`LinkedIn connected — welcome, ${escapeHtml(data.name || 'there')}! LinkedIn shares name, email & photo; fill in the rest below.`);
      } else {
        showToast('LinkedIn import failed — please try again.', 'error');
      }
    } else if (h.startsWith('#lierror=')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
      const code = decodeURIComponent(h.slice('#lierror='.length));
      const msgs = {
        not_configured: 'LinkedIn import is not configured yet — add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to backend/.env (setup steps are in that file).',
        bad_state: 'LinkedIn sign-in expired — please try again.',
        user_cancelled_login: 'LinkedIn sign-in was cancelled.',
        user_cancelled_authorize: 'LinkedIn sign-in was cancelled.',
      };
      showToast(msgs[code] || 'LinkedIn import failed — please try again.', 'error');
    }
  })();

  /* ---------- SHOW PORTFOLIO TOOLS WHEN PREVIEW APPEARS ---------- */
  const pfActionRow = document.getElementById('pfActionRow');
  const atsCard     = document.getElementById('atsCard');
  const portfolioPreviewEl = document.getElementById('portfolioPreview');

  /** Fill the ATS card with a REAL analysis of the uploaded resume. */
  function renderAtsCard(r) {
    const heading = document.getElementById('atsHeading');
    if (heading) heading.textContent = r.headline;

    const catLabels = { keywords: 'keywords', formatting: 'formatting', structure: 'structure', contact: 'contact' };
    Object.keys(catLabels).forEach(cat => {
      const item = atsCard.querySelector(`.ats-cat-item[data-cat="${cat}"]`);
      if (!item) return;
      const v = r.categories[cat];
      item.querySelector('.ats-cat-pct').textContent = v + '%';
      item.querySelector('.ats-cat-fill').dataset.w = v;
    });

    const scoreNum = document.getElementById('atsScoreNum');
    const ringFill = document.getElementById('atsRingFill');
    if (scoreNum) scoreNum.textContent = r.score;
    if (ringFill) ringFill.style.strokeDashoffset = Math.round(314 * (1 - r.score / 100));

    const grade = document.getElementById('atsGradeBadge');
    if (grade) grade.textContent = r.grade;

    // Mistakes (with fixes) first, then confirmed strengths
    const tips = document.getElementById('atsTipsList');
    if (tips) {
      const warn = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fb923c" stroke-width="2.5"><path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>';
      const ok = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
      tips.innerHTML =
        r.issues.map(i => `<li>${warn}<span><strong>${escapeHtml(i.title)}.</strong> ${escapeHtml(i.fix)}</span></li>`).join('') +
        r.wins.map(w => `<li>${ok}<span>${escapeHtml(w)}</span></li>`).join('');
    }
  }

  function revealPortfolioTools() {
    if (pfActionRow) pfActionRow.classList.remove('hidden');
    // The ATS card only appears when there is a real resume to analyze —
    // manual/LinkedIn entries have no document to score.
    if (atsCard && window.IP_ATS && lastResumeAnalysis) {
      renderAtsCard(IP_ATS.analyze(lastResumeAnalysis));
      atsCard.classList.remove('hidden');
      setTimeout(() => {
        atsCard.querySelectorAll('.ats-cat-fill').forEach(fill => {
          fill.style.width = fill.dataset.w + '%';
        });
        fadeObserver.observe(atsCard);
      }, 200);
    }
  }

  if (portfolioPreviewEl) {
    const revealObs = new MutationObserver(() => {
      if (!portfolioPreviewEl.classList.contains('hidden')) {
        setTimeout(revealPortfolioTools, 1200);
        revealObs.disconnect();
      }
    });
    revealObs.observe(portfolioPreviewEl, { attributes: true, attributeFilter: ['class'] });
  }

  /* ---------- PORTFOLIO EDITOR ---------- */
  const pfEditorBar  = document.getElementById('pfEditorBar');
  const editorColorTool = document.getElementById('editorColorTool');
  const colorPickerPop  = document.getElementById('colorPickerPop');
  const editPortfolioBtn = document.getElementById('editPortfolioBtn');
  const editorCancelBtn  = document.getElementById('editorCancelBtn');
  const editorSaveBtn    = document.getElementById('editorSaveBtn');
  let editMode = false;
  const savedContent = new Map();

  const editableSelectors = ['.pf-name', '.pf-role-line', '.pf-about-text', '.pf-tl-desc', '.pf-proj-desc', '.pf-proj-name'];

  function enterEditMode() {
    editMode = true;
    if (pfEditorBar) pfEditorBar.classList.remove('hidden');
    if (editPortfolioBtn) editPortfolioBtn.textContent = 'Editing…';
    editableSelectors.forEach(sel => {
      document.querySelectorAll('#portfolioCard ' + sel).forEach(el => {
        savedContent.set(el, el.innerHTML);
        el.contentEditable = 'true';
      });
    });
  }

  function exitEditMode(save) {
    editMode = false;
    if (pfEditorBar) pfEditorBar.classList.add('hidden');
    if (editPortfolioBtn) {
      editPortfolioBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit Portfolio`;
    }
    document.querySelectorAll('#portfolioCard [contenteditable="true"]').forEach(el => {
      if (!save) el.innerHTML = savedContent.get(el) || el.innerHTML;
      el.removeAttribute('contenteditable');
    });
    savedContent.clear();
    if (save) showToast('Portfolio changes saved!');
    else showToast('Changes discarded.', 'info');
  }

  if (editPortfolioBtn) {
    editPortfolioBtn.addEventListener('click', () => { if (!editMode) enterEditMode(); });
  }
  if (editorCancelBtn) editorCancelBtn.addEventListener('click', () => exitEditMode(false));
  if (editorSaveBtn)   editorSaveBtn.addEventListener('click',   () => exitEditMode(true));

  // Accent color picker
  if (editorColorTool) {
    editorColorTool.addEventListener('click', e => {
      e.stopPropagation();
      colorPickerPop && colorPickerPop.classList.toggle('hidden');
    });
  }
  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', e => {
      e.stopPropagation();
      const color = swatch.dataset.color;
      document.documentElement.style.setProperty('--accent', color);
      document.documentElement.style.setProperty('--glow', color + '55');
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      colorPickerPop && colorPickerPop.classList.add('hidden');
      showToast('Accent colour updated!');
    });
  });
  document.addEventListener('click', () => {
    if (colorPickerPop && !colorPickerPop.classList.contains('hidden')) {
      colorPickerPop.classList.add('hidden');
    }
  });

  /* ---------- ANALYTICS MODAL ---------- */
  const analyticsModal = bindModalClose('analyticsModal', 'analyticsCloseBtn');
  const analyticsModalBtn = document.getElementById('analyticsModalBtn');
  if (analyticsModalBtn) analyticsModalBtn.addEventListener('click', () => openModal(analyticsModal));

  /* ---------- AI IMPROVE MODAL ---------- */
  const aiImproveModal = bindModalClose('aiImproveModal', 'aiImproveCloseBtn');
  const aiImproveModalBtn = document.getElementById('aiImproveModalBtn');
  const openAiImproveBtn  = document.getElementById('openAiImproveBtn');
  const applyAllBtn = document.getElementById('applyAllImprovementsBtn');

  if (aiImproveModalBtn) aiImproveModalBtn.addEventListener('click', () => openModal(aiImproveModal));
  if (openAiImproveBtn)  openAiImproveBtn.addEventListener('click',  () => openModal(aiImproveModal));
  if (applyAllBtn) {
    applyAllBtn.addEventListener('click', () => {
      closeModal(aiImproveModal);
      showToast('All AI suggestions applied to your portfolio!');
    });
  }
  document.querySelectorAll('.apply-suggestion-btn').forEach(btn => {
    btn.addEventListener('click', () => showToast('Suggestion applied!'));
  });

  /* ---------- SEO MODAL ---------- */
  const seoModal = bindModalClose('seoModal', 'seoCloseBtn');
  const seoModalBtn = document.getElementById('seoModalBtn');
  if (seoModalBtn) seoModalBtn.addEventListener('click', () => openModal(seoModal));

  document.querySelectorAll('.seo-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const el = document.getElementById(btn.dataset.target);
      if (!el) return;
      navigator.clipboard.writeText(el.textContent).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = orig; }, 2000);
        showToast('SEO code copied to clipboard!');
      });
    });
  });

  /* ---------- CUSTOM DOMAIN MODAL ---------- */
  const customDomainModal = bindModalClose('customDomainModal', 'customDomainCloseBtn');
  const customDomainModalBtn = document.getElementById('customDomainModalBtn');
  const connectDomainBtn = document.getElementById('connectDomainBtn');
  const customDomainInput = document.getElementById('customDomainInput');

  if (customDomainModalBtn) customDomainModalBtn.addEventListener('click', () => openModal(customDomainModal));
  if (connectDomainBtn) {
    connectDomainBtn.addEventListener('click', () => {
      const domain = customDomainInput?.value?.trim();
      if (!domain) { showToast('Please enter a domain name', 'error'); return; }
      showToast(`Domain "${domain}" verified! Follow DNS instructions below.`);
    });
  }

  /* ---------- GITHUB INTEGRATION ---------- */
  const githubConnectBtn = document.getElementById('githubConnectBtn');
  const pfGithubSec = document.getElementById('pfGithubSec');
  const ghFetchBtn = document.getElementById('ghFetchBtn');
  const ghUsernameInput = document.getElementById('ghUsernameInput');
  const ghReposGrid = document.getElementById('ghReposGrid');
  const ghConnectPrompt = document.getElementById('ghConnectPrompt');

  const langColors = {
    JavaScript:'#f1e05a', TypeScript:'#3178c6', Python:'#3572A5',
    Java:'#b07219', 'C++':'#f34b7d', Go:'#00add8', Rust:'#dea584',
    Ruby:'#701516', PHP:'#4f5d95', CSS:'#563d7c', HTML:'#e34c26',
    Shell:'#89e051', Swift:'#F05138', Kotlin:'#A97BFF', Dart:'#00B4AB',
  };

  if (githubConnectBtn) {
    githubConnectBtn.addEventListener('click', () => {
      if (!pfGithubSec) return;
      pfGithubSec.classList.remove('hidden');
      pfGithubSec.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  async function fetchGitHubRepos() {
    const username = ghUsernameInput?.value?.trim();
    if (!username) { showToast('Please enter a GitHub username', 'error'); return; }
    ghFetchBtn.textContent = 'Loading…';
    ghFetchBtn.disabled = true;
    try {
      // NOTE: 'stars' is not a valid sort value for this endpoint (GitHub silently
      // falls back to alphabetical) — fetch a page and rank by stars client-side.
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100`);
      if (!res.ok) throw new Error('Not found');
      const repos = (await res.json())
        .sort((a, b) => b.stargazers_count - a.stargazers_count)
        .slice(0, 6);
      if (ghConnectPrompt) ghConnectPrompt.classList.add('hidden');
      if (ghReposGrid) {
        ghReposGrid.classList.remove('hidden');
        ghReposGrid.innerHTML = repos.map(r => `
          <a href="${escapeHtml(r.html_url)}" target="_blank" rel="noopener noreferrer" class="gh-repo-card">
            <div class="gh-repo-name">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style="color:var(--text-dim)"><path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8z"/></svg>
              ${escapeHtml(r.name)}
            </div>
            <p class="gh-repo-desc">${escapeHtml(r.description || 'No description provided.')}</p>
            <div class="gh-repo-meta">
              ${r.language ? `<span><span class="gh-lang-dot" style="background:${langColors[r.language] || '#aaa'}"></span>${escapeHtml(r.language)}</span>` : ''}
              <span>★ ${r.stargazers_count}</span>
              <span>⑂ ${r.forks_count}</span>
            </div>
          </a>`).join('');
      }
      showToast(`Loaded ${repos.length} repos from @${username}!`);
    } catch {
      showToast(`GitHub user "${username}" not found`, 'error');
    } finally {
      if (ghFetchBtn) { ghFetchBtn.textContent = 'Connect'; ghFetchBtn.disabled = false; }
    }
  }

  if (ghFetchBtn) ghFetchBtn.addEventListener('click', fetchGitHubRepos);
  if (ghUsernameInput) {
    ghUsernameInput.addEventListener('keydown', e => { if (e.key === 'Enter') fetchGitHubRepos(); });
  }

  /* ---------- AI PORTFOLIO CHATBOT ---------- */
  const chatbotFab    = document.getElementById('chatbotFab');
  const chatbotPanel  = document.getElementById('chatbotPanel');
  const chatbotCloseBtn = document.getElementById('chatbotCloseBtn');
  const chatbotInput  = document.getElementById('chatbotInput');
  const chatbotSendBtn = document.getElementById('chatbotSendBtn');
  const chatbotMessages = document.getElementById('chatbotMessages');
  const chatbotNotifDot = document.getElementById('chatbotNotifDot');
  const chatIconChat  = document.querySelector('.chatbot-icon-chat');
  const chatIconClose = document.querySelector('.chatbot-icon-close');
  const quickRepliesEl = document.getElementById('chatbotQuickReplies');

  const chatKB = [
    { kw:['skill','tech','stack','language','know'],
      ans:'I specialise in <strong>React</strong>, <strong>TypeScript</strong>, <strong>Node.js</strong>, <strong>Python</strong>, <strong>GraphQL</strong>, <strong>AWS</strong>, Docker, and Kubernetes. Full tech stack is in the portfolio!' },
    { kw:['available','hire','open','job','work','opportunity','freelance'],
      ans:'Yes! Currently <strong>available for new opportunities</strong> — full-time, contract, or exciting collaborations. Email <strong>john.doe@email.com</strong> to connect!' },
    { kw:['project','built','portfolio','build'],
      ans:'Featured projects include an <strong>E-Commerce Platform</strong> (50k+ daily transactions), an <strong>AI Analytics Dashboard</strong> (200+ enterprise clients), and a <strong>DevOps Automation Suite</strong> cutting deploy time by 75%.' },
    { kw:['contact','email','reach','touch','message','phone'],
      ans:'Email: <strong>john.doe@email.com</strong><br>LinkedIn &amp; GitHub links are in the portfolio header. I usually reply within 24 hours!' },
    { kw:['experience','year','background','history','senior'],
      ans:'<strong>8+ years</strong> as a Full-Stack Developer. Currently Lead Engineer at <strong>TechVentures Inc.</strong>, previously at CloudScale and StartupHub.' },
    { kw:['location','based','where','city','remote'],
      ans:'Based in <strong>San Francisco, CA</strong> — but fully remote-friendly and open to relocation for the right role!' },
    { kw:['education','degree','study','university','college'],
      ans:'B.S. in Computer Science. Proud self-taught coder at heart — I learn best by shipping things!' },
    { kw:['rate','salary','cost','price','charge','money'],
      ans:'Rates depend on scope and engagement type. Drop me an email at <strong>john.doe@email.com</strong> and we\'ll work out the details!' },
  ];

  function getChatResponse(msg) {
    const lower = msg.toLowerCase();
    const match = chatKB.find(e => e.kw.some(k => lower.includes(k)));
    return match ? match.ans : 'Great question! For detailed answers, email <strong>john.doe@email.com</strong> and I\'ll get back to you within 24 hours.';
  }

  function addChatMsg(html, role) {
    const div = document.createElement('div');
    div.className = `chatbot-msg ${role}`;
    div.innerHTML = `<div class="chatbot-bubble">${html}</div>`;
    chatbotMessages.appendChild(div);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    return div;
  }

  function showTyping() {
    const el = document.createElement('div');
    el.className = 'chatbot-msg bot chatbot-typing';
    el.innerHTML = `<div class="chatbot-bubble"><span class="chatbot-typing-dot"></span><span class="chatbot-typing-dot"></span><span class="chatbot-typing-dot"></span></div>`;
    chatbotMessages.appendChild(el);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    return el;
  }

  function sendChat(text) {
    if (!text.trim()) return;
    addChatMsg(escapeHtml(text), 'user');
    if (chatbotInput) chatbotInput.value = '';
    if (quickRepliesEl) quickRepliesEl.style.display = 'none';
    const typing = showTyping();
    setTimeout(() => {
      typing.remove();
      addChatMsg(getChatResponse(text), 'bot');
    }, 800 + Math.random() * 600);
  }

  function toggleChatbot(open) {
    if (!chatbotPanel) return;
    const nowOpen = open ?? chatbotPanel.classList.contains('hidden');
    chatbotPanel.classList.toggle('hidden', !nowOpen);
    if (chatIconChat)  chatIconChat.classList.toggle('hidden', nowOpen);
    if (chatIconClose) chatIconClose.classList.toggle('hidden', !nowOpen);
    if (chatbotNotifDot) chatbotNotifDot.style.display = nowOpen ? 'none' : '';
  }

  if (chatbotFab)      chatbotFab.addEventListener('click', () => toggleChatbot());
  if (chatbotCloseBtn) chatbotCloseBtn.addEventListener('click', () => toggleChatbot(false));
  if (chatbotSendBtn)  chatbotSendBtn.addEventListener('click', () => sendChat(chatbotInput?.value || ''));
  if (chatbotInput) {
    chatbotInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(chatbotInput.value); });
  }
  document.querySelectorAll('.chatbot-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => sendChat(btn.textContent));
  });

});