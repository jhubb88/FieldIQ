'use strict';

/* =============================================================
   api.js — FieldIQ CFBD API Client
   Exposes: cfbdFetch(endpoint, params)
            fetchRankings(year, seasonType)
            fetchGames(year, week, seasonType)
            fetchESPNNews()
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
const CFBD_API_KEY = 'REDACTED_API_KEY';

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

/* ----------------------------------------------------------
   fetchRankings
   Returns all ranking poll data for a given season.
   Response is an array of weekly poll snapshots; each entry
   contains a `polls` array with poll name and ranked teams.

   @param {number} year          — e.g. 2024
   @param {string} seasonType    — 'regular' | 'postseason'
   @returns {Promise<Array>}

   Usage:
     const data = await fetchRankings(2024, 'regular');
   ---------------------------------------------------------- */
async function fetchRankings(year, seasonType = 'regular') {
  return cfbdFetch('/rankings', { year, seasonType });
}

/* ----------------------------------------------------------
   fetchGames
   Returns all games for a given week and season.
   Each game object includes homeTeam, awayTeam, homePoints,
   awayPoints, homeRank, awayRank, venue, startDate, etc.

   @param {number} year          — e.g. 2024
   @param {number} week          — 1-15 (regular season)
   @param {string} seasonType    — 'regular' | 'postseason'
   @returns {Promise<Array>}

   Usage:
     const games = await fetchGames(2024, 15, 'regular');
   ---------------------------------------------------------- */
async function fetchGames(year, week, seasonType = 'regular', options = {}) {
  return cfbdFetch('/games', { year, week, seasonType, ...options });
}

/* ----------------------------------------------------------
   fetchESPNNews
   Fetches the ESPN college football RSS feed through the
   allorigins.win CORS proxy (required for file:// and
   cross-origin browser environments).

   Parses the XML response and returns an array of article
   objects with title, pubDate (raw string), and link.

   @returns {Promise<Array<{title, pubDate, link}>>}
   ---------------------------------------------------------- */
async function fetchESPNNews() {
  const ESPN_RSS_URL = 'https://www.espn.com/espn/rss/ncf/news';
  // rss2json.com converts RSS to JSON and handles CORS — no XML parsing needed
  const RSS2JSON_URL = 'https://api.rss2json.com/v1/api.json?rss_url=';

  const response = await fetch(`${RSS2JSON_URL}${encodeURIComponent(ESPN_RSS_URL)}`);
  if (!response.ok) {
    throw new Error(`ESPN news fetch error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.status !== 'ok' || !Array.isArray(data.items)) {
    throw new Error(`ESPN news parse error: ${data.message || 'unexpected response'}`);
  }

  return data.items.map(item => ({
    title:   item.title   || '(No title)',
    pubDate: item.pubDate || '',
    link:    item.link    || '',
  }));
}
