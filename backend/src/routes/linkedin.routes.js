'use strict';

const { Router } = require('express');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const logger = require('../utils/logger.utils');

/**
 * LinkedIn profile import via "Sign In with LinkedIn using OpenID Connect".
 *
 * Setup (one-time):
 *   1. Create an app at https://developer.linkedin.com/ (any company page works)
 *   2. Products tab → add "Sign In with LinkedIn using OpenID Connect"
 *   3. Auth tab → add redirect URL:  http://localhost:5000/api/linkedin/callback
 *   4. Put Client ID / Client Secret into backend/.env
 *
 * What LinkedIn's public API returns: name, email, profile photo (the `openid
 * profile email` scopes). Work history / skills / education require LinkedIn
 * partner-program approval and are NOT available to standard apps — the rest
 * of the portfolio still comes from the uploaded resume.
 */

const router = Router();

const configured = () =>
  Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);

const redirectUri = (req) =>
  process.env.LINKEDIN_REDIRECT_URI ||
  `${req.protocol}://${req.get('host')}/api/linkedin/callback`;

/** Short-lived signed state token (CSRF protection for the OAuth round-trip). */
const makeState = () => jwt.sign({ purpose: 'linkedin_oauth' }, env.JWT_SECRET, { expiresIn: '10m' });
const checkState = (state) => {
  const decoded = jwt.verify(state, env.JWT_SECRET);
  if (decoded.purpose !== 'linkedin_oauth') throw new Error('wrong state purpose');
};

// Step 1 — send the user to LinkedIn's consent screen
router.get('/auth', (req, res) => {
  if (!configured()) {
    return res.redirect('/#lierror=not_configured');
  }
  const u = new URL('https://www.linkedin.com/oauth/v2/authorization');
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', process.env.LINKEDIN_CLIENT_ID);
  u.searchParams.set('redirect_uri', redirectUri(req));
  u.searchParams.set('scope', 'openid profile email');
  u.searchParams.set('state', makeState());
  return res.redirect(u.href);
});

// Step 2 — LinkedIn redirects back here; exchange the code, fetch the profile
router.get('/callback', async (req, res) => {
  const { code, state, error, error_description: errDesc } = req.query;

  if (error) {
    logger.warn('LinkedIn consent declined or failed', { error, errDesc });
    return res.redirect('/#lierror=' + encodeURIComponent(error));
  }

  try {
    checkState(state);
  } catch {
    return res.redirect('/#lierror=bad_state');
  }

  try {
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(req),
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      }),
    });
    const token = await tokenRes.json();
    if (!token.access_token) {
      throw new Error(token.error_description || `token exchange failed (${tokenRes.status})`);
    }

    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!profileRes.ok) throw new Error(`userinfo fetch failed (${profileRes.status})`);
    const p = await profileRes.json();

    // Hand the profile to the frontend via the URL fragment: fragments never
    // leave the browser (not sent to servers, not logged).
    const payload = Buffer.from(
      JSON.stringify({ name: p.name || '', email: p.email || '', picture: p.picture || '' })
    ).toString('base64url');

    logger.info('LinkedIn profile imported', { hasEmail: Boolean(p.email) });
    return res.redirect('/#liimport=' + payload);
  } catch (err) {
    logger.error('LinkedIn import failed', { error: err.message });
    return res.redirect('/#lierror=fetch_failed');
  }
});

module.exports = router;
