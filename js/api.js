'use strict';

/* =============================================================
   api.js — FieldIQ CFBD API Client
   Exposes: cfbdFetch(endpoint, params)
   Depends on: nothing (no other FieldIQ modules required)

   College Football Data API docs: https://api.collegefootballdata.com/api/docs
   Get a free API key at: https://collegefootballdata.com/key
   ============================================================= */

/* ----------------------------------------------------------
   Configuration
   ---------------------------------------------------------- */

const CFBD_BASE_URL = 'https://api.collegefootballdata.com';

// TODO: add CFBD API key
// Replace the empty string with your key before making live requests.
// Never commit a real key here — load from an environment variable
// or a local config file that is excluded from version control.
const CFBD_API_KEY = '';

/* ----------------------------------------------------------
   cfbdFetch
   Wraps the native fetch API for CFBD requests.

   @param {string} endpoint  — API path, e.g. '/teams' or '/games'
   @param {Object} params    — Query string parameters as key/value pairs
                               e.g. { year: 2024, team: 'Texas' }
   @returns {Promise<any>}   — Parsed JSON response body

   Usage:
     const games = await cfbdFetch('/games', { year: 2024, team: 'Texas' });
   ---------------------------------------------------------- */
async function cfbdFetch(endpoint, params = {}) {
  // Build query string from params object, skipping undefined/null values
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  const url = `${CFBD_BASE_URL}${endpoint}${query ? `?${query}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${CFBD_API_KEY}`,
      'Accept': 'application/json',
    },
  });

  // Surface HTTP errors as thrown exceptions so callers can catch them
  if (!response.ok) {
    throw new Error(`CFBD API error: ${response.status} ${response.statusText} — ${url}`);
  }

  return response.json();
}
