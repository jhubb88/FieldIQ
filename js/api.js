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

// API key is loaded from config.js (excluded from version control).
// Copy config.js from the repo root, add your real key, and never commit it.
const CFBD_API_KEY = CFBD_CONFIG.apiKey;

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

/* =============================================================
   Phase 5 — School Page Fetch Functions
   Added below. All existing functions above are untouched.
   ============================================================= */

/* ----------------------------------------------------------
   In-memory cache
   undefined = cache miss. null = valid cached value (e.g.
   unranked team). Resets on page reload — sufficient for a
   single session given the 1000 req/month CFBD budget.
   ---------------------------------------------------------- */
const _apiCache = {};
const _24H = 24 * 3600 * 1000;

function _cacheSet(key, data, ttlMs) {
  _apiCache[key] = {
    data,
    expires: ttlMs != null ? Date.now() + ttlMs : null,
  };
}

function _cacheGet(key) {
  const entry = _apiCache[key];
  if (!entry) return undefined;
  if (entry.expires !== null && Date.now() > entry.expires) {
    delete _apiCache[key];
    return undefined;
  }
  return entry.data; // may be null — valid cached value
}

/* ----------------------------------------------------------
   fetchTeamInfo
   Returns team metadata: colors, abbreviation, mascot.
   Fetches all FBS teams once and filters client-side.
   CFBD field names: color (primary), alt_color (secondary).
   Cached indefinitely — team metadata rarely changes.

   @param {string} school — e.g. 'Texas'
   @returns {Promise<Object|null>} — team object or null if not found
   ---------------------------------------------------------- */
async function fetchTeamInfo(school) {
  const key = 'teamInfo:fbs';
  let teams = _cacheGet(key);
  if (teams === undefined) {
    teams = await cfbdFetch('/teams', { division: 'fbs' });
    _cacheSet(key, teams, null); // cache indefinitely
  }
  return teams.find(t => t.school === school) || null;
}

/* ----------------------------------------------------------
   fetchSeasonRecord
   Returns all games for a team in a given season including
   postseason/bowl games (seasonType: 'both').

   homeLineScores and awayLineScores contain quarter-by-quarter
   score arrays — half scoring (Q1+Q2 vs Q3+Q4) is derived
   from these. No separate half-scoring endpoint is needed.

   Cached forever — past season results never change.

   @param {string} school — e.g. 'Texas'
   @param {number} year   — e.g. 2024
   @returns {Promise<Array>}
   ---------------------------------------------------------- */
async function fetchSeasonRecord(school, year) {
  const key = `seasonRecord:${school}:${year}`;
  const cached = _cacheGet(key);
  if (cached !== undefined) return cached;
  const data = await cfbdFetch('/games', { year, team: school, seasonType: 'both' });
  _cacheSet(key, data, null); // cache forever
  return data;
}

/* ----------------------------------------------------------
   fetchFinalRank
   Returns the final AP Top 25 ranking for a school using
   postseason poll data. Returns null if the school is unranked.
   Cached 24 hours.

   Named fetchFinalRank to avoid conflict with the existing
   fetchRankings(year, seasonType) used by the homepage.

   @param {string} school — e.g. 'Texas'
   @param {number} year   — e.g. 2024
   @returns {Promise<number|null>} — AP rank 1-25, or null if unranked
   ---------------------------------------------------------- */
async function fetchFinalRank(school, year) {
  const key = `finalRank:${school}:${year}`;
  const cached = _cacheGet(key);
  if (cached !== undefined) return cached; // null is valid (unranked)

  const data = await cfbdFetch('/rankings', { year, seasonType: 'postseason' });
  let rank = null;

  if (Array.isArray(data) && data.length > 0) {
    // Last entry in the array is the most recent postseason week
    const lastWeek = data[data.length - 1];
    const apPoll = (lastWeek.polls || []).find(p => p.poll === 'AP Top 25');
    if (apPoll) {
      const entry = (apPoll.ranks || []).find(r => r.school === school);
      if (entry) rank = entry.rank;
    }
  }

  _cacheSet(key, rank, _24H);
  return rank;
}

/* ----------------------------------------------------------
   fetchGameLines
   Returns betting lines (spread, O/U) per game for a team
   in a given season. Cached forever — past lines never change.

   @param {string} school — e.g. 'Texas'
   @param {number} year   — e.g. 2024
   @returns {Promise<Array>}
   ---------------------------------------------------------- */
async function fetchGameLines(school, year) {
  const key = `gameLines:${school}:${year}`;
  const cached = _cacheGet(key);
  if (cached !== undefined) return cached;
  const data = await cfbdFetch('/lines', { year, team: school });
  _cacheSet(key, data, null); // cache forever
  return data;
}

/* ----------------------------------------------------------
   fetchCoachInfo
   Returns current head coach name, seasons at school, and
   cumulative record. Identifies "current" as the coach with
   a season entry matching the given year.
   Cached indefinitely.

   @param {string} school — e.g. 'Texas'
   @param {number} year   — season year to identify current coach
   @returns {Promise<Object|null>} — { name, seasons, record } or null
   ---------------------------------------------------------- */
async function fetchCoachInfo(school, year) {
  const key = `coachInfo:${school}`;
  const cached = _cacheGet(key);
  if (cached !== undefined) return cached;

  const coaches = await cfbdFetch('/coaches', { team: school });
  let result = null;

  if (Array.isArray(coaches) && coaches.length > 0) {
    // Find the coach whose seasons include the target year
    const current = coaches.find(c =>
      Array.isArray(c.seasons) && c.seasons.some(s => s.year === year)
    );
    if (current) {
      const seasons = current.seasons.filter(s => s.school === school);
      const wins    = seasons.reduce((sum, s) => sum + (s.wins   || 0), 0);
      const losses  = seasons.reduce((sum, s) => sum + (s.losses || 0), 0);
      result = {
        name:    `${current.firstName} ${current.lastName}`,
        seasons: seasons.length,
        record:  `${wins}-${losses}`,
      };
    }
  }

  _cacheSet(key, result, null); // cache indefinitely
  return result;
}
