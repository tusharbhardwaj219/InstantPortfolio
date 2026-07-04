/* ===================================================
   INSTANT PORTFOLIO — API client
   Shared by every page. Exposes window.IP_API.
   =================================================== */
(function () {
  'use strict';

  // When the frontend is served by the Express backend the API is same-origin;
  // when opened via a separate static server (or file://) fall back to :5000.
  const API_BASE =
    window.location.port === '5000' || window.location.pathname.startsWith('/p/')
      ? ''
      : 'http://localhost:5000';

  const TOKEN_KEY = 'ip_token';
  const USER_KEY = 'ip_user';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user || null));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  }

  /**
   * JSON request helper. Throws an Error with .status and .errors on failure.
   */
  async function request(path, { method = 'GET', body, auth = false } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) {
      const token = getToken();
      if (!token) {
        const err = new Error('Not logged in');
        err.status = 401;
        throw err;
      }
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let payload = null;
    try {
      payload = await res.json();
    } catch {
      /* non-JSON response */
    }

    if (!res.ok || (payload && payload.success === false)) {
      const err = new Error((payload && payload.message) || `Request failed (${res.status})`);
      err.status = res.status;
      err.errors = payload && payload.errors;
      throw err;
    }
    return payload;
  }

  /**
   * Upload a resume and stream SSE progress events.
   * onProgress receives { progress, step, data?, error? } objects.
   * Resolves with the final "done" event data, rejects on error events.
   */
  async function uploadResume(file, onProgress) {
    const token = getToken();
    if (!token) {
      const err = new Error('Not logged in');
      err.status = 401;
      throw err;
    }

    const form = new FormData();
    form.append('resume', file);

    const res = await fetch(`${API_BASE}/api/resume/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    // Non-SSE response means the request was rejected before processing began
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream')) {
      let payload = null;
      try {
        payload = await res.json();
      } catch {
        /* ignore */
      }
      const err = new Error((payload && payload.message) || `Upload failed (${res.status})`);
      err.status = res.status;
      throw err;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let doneData = null;

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const line = chunk.split('\n').find((l) => l.startsWith('data: '));
        if (!line) continue;
        let evt;
        try {
          evt = JSON.parse(line.slice(6));
        } catch {
          continue;
        }
        if (onProgress) onProgress(evt);
        if (evt.step === 'error') {
          const err = new Error(evt.error || 'Portfolio generation failed');
          throw err;
        }
        if (evt.step === 'done') doneData = evt.data;
      }
    }

    if (!doneData) throw new Error('Upload stream ended unexpectedly');
    return doneData;
  }

  /** Quick reachability probe so pages can gracefully fall back to demo mode. */
  async function isBackendUp(timeoutMs = 2500) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(`${API_BASE}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      return res.ok;
    } catch {
      return false;
    }
  }

  window.IP_API = {
    API_BASE,
    request,
    uploadResume,
    isBackendUp,
    getToken,
    getUser,
    setSession,
    clearSession,

    signup: (data) => request('/api/auth/signup', { method: 'POST', body: data }),
    login: (data) => request('/api/auth/login', { method: 'POST', body: data }),
    me: () => request('/api/auth/me', { auth: true }),
    getMyPortfolio: () => request('/api/portfolio/user', { auth: true }),
    getPublicPortfolio: (slug, isFirstVisit) =>
      request(`/api/portfolio/public/${encodeURIComponent(slug)}${isFirstVisit ? '?new=1' : ''}`),
    updatePortfolio: (id, data) =>
      request(`/api/portfolio/${encodeURIComponent(id)}`, { method: 'PUT', body: data, auth: true }),
    getAnalytics: (portfolioId) =>
      request(`/api/analytics/${encodeURIComponent(portfolioId)}`, { auth: true }),
  };
})();
