'use strict';

/* =============================================================
   pages/league.js — FieldIQ League Page
   Exposes: LeaguePage.render(), LeaguePage.unmount()
   Depends on: api.js (cfbdFetch, fetchRankings, _cacheGet,
               _cacheSet, _24H), market.js (for ATS spread logic)
   Theme: neutral only — resetTheme() called by router before render.
   ============================================================= */

/* ----------------------------------------------------------
   Season Constant
   Historical stats year. Always the last completed season.
   Independent of CURRENT_YEAR in home.js.
   ---------------------------------------------------------- */
const LEAGUE_YEAR = 2025;

/* ----------------------------------------------------------
   FBS Conferences
   The 10 FBS conferences used to filter and label standings.
   "FBS Independents" is treated as a conference group for
   teams without a conference affiliation.
   ---------------------------------------------------------- */
const FBS_CONFERENCES = [
  'SEC', 'Big Ten', 'Big 12', 'ACC',
  'Mountain West', 'American Athletic', 'Sun Belt',
  'Conference USA', 'Mid-American', 'FBS Independents',
];

/* =============================================================
   Local Fetch Helpers
   Season-wide fetches not covered by existing api.js wrappers.
   All call cfbdFetch() and use _cacheGet/_cacheSet/_24H
   from api.js. Cached 24 hours — offseason data never changes,
   and in-season data is stable enough for a day.
   ============================================================= */

/* ----------------------------------------------------------
   _fetchLeagueGames
   Fetches all completed FBS regular-season games for a given
   year without a week filter. Used for conference standings
   and top-performer ATS compute.

   @param {number} year
   @returns {Promise<Array>}
   ---------------------------------------------------------- */
async function _fetchLeagueGames(year) {
  const key = `league:games:${year}`;
  const cached = _cacheGet(key);
  if (cached !== undefined) return cached;
  const data = await cfbdFetch('/games', {
    year,
    seasonType:     'regular',
    classification: 'fbs',
  });
  _cacheSet(key, data, _24H);
  return data;
}

/* ----------------------------------------------------------
   _fetchLeagueLines
   Fetches all betting lines for a given regular season
   without a team filter. Used for conference ATS analysis
   and top-performer calculations.

   @param {number} year
   @returns {Promise<Array>}
   ---------------------------------------------------------- */
async function _fetchLeagueLines(year) {
  const key = `league:lines:${year}`;
  const cached = _cacheGet(key);
  if (cached !== undefined) return cached;
  const data = await cfbdFetch('/lines', {
    year,
    seasonType: 'regular',
  });
  _cacheSet(key, data, _24H);
  return data;
}

/* =============================================================
   Internal — Line Lookup
   Mirrors the consensus-line logic from market.js but operates
   on an id-keyed map for O(1) lookups across an entire season.
   ============================================================= */

/* ----------------------------------------------------------
   _buildLineMap
   Converts the raw lines array into a map of { gameId: spread }
   using the consensus provider where available, or the first
   provider as fallback. Skips entries with no parseable spread.

   @param {Array} lines — _fetchLeagueLines() output
   @returns {Object} — { [gameId]: spreadNumber }
   ---------------------------------------------------------- */
function _buildLineMap(lines) {
  const map = {};
  lines.forEach(function (entry) {
    if (!Array.isArray(entry.lines) || !entry.lines.length) return;
    const consensus = entry.lines.find(function (l) { return l.provider === 'consensus'; })
                   || entry.lines[0];
    if (!consensus) return;
    const spread = parseFloat(consensus.spread);
    if (!isNaN(spread)) map[entry.id] = spread;
  });
  return map;
}

/* =============================================================
   Compute Functions
   Pure functions — receive raw data, return structured results.
   No DOM access, no API calls.
   ============================================================= */

/* ----------------------------------------------------------
   _computeConferenceStandings
   Tallies cross-conference W-L records for all FBS conferences
   from completed regular-season games. Intra-conference games
   are excluded because they contribute 1 win and 1 loss to the
   same conference — a net-zero that skews win percentage.

   @param {Array} games — _fetchLeagueGames() output
   @returns {Array<{ conference, wins, losses, pct }>} sorted desc by pct
   ---------------------------------------------------------- */
function _computeConferenceStandings(games) {
  const records = {};
  FBS_CONFERENCES.forEach(function (conf) {
    records[conf] = { wins: 0, losses: 0 };
  });

  games.forEach(function (g) {
    /* Skip incomplete games and games missing conference data */
    if (g.homePoints == null || g.awayPoints == null) return;
    if (!g.homeConference || !g.awayConference) return;
    /* Skip intra-conference — net zero */
    if (g.homeConference === g.awayConference) return;

    const hConf  = g.homeConference;
    const aConf  = g.awayConference;
    const homeWon = g.homePoints > g.awayPoints;

    if (records[hConf]) {
      homeWon ? records[hConf].wins++ : records[hConf].losses++;
    }
    if (records[aConf]) {
      homeWon ? records[aConf].losses++ : records[aConf].wins++;
    }
  });

  return Object.entries(records)
    .map(function ([conference, r]) {
      const total = r.wins + r.losses;
      const pct   = total > 0 ? r.wins / total : 0;
      return { conference, wins: r.wins, losses: r.losses, pct };
    })
    .filter(function (r) { return r.wins + r.losses > 0; })
    .sort(function (a, b) { return b.pct - a.pct; });
}

/* ----------------------------------------------------------
   _computeConferenceATS
   Computes ATS cover rate per conference from cross-conference
   games that have a consensus spread.

   Spread convention (CFBD): negative = home team is favored.
   ATS margin from home team's view = actualMargin + spread.
   Positive atsMargin = home covered; negative = away covered.

   @param {Array}  games   — _fetchLeagueGames() output
   @param {Object} lineMap — _buildLineMap() output
   @returns {Array<{ conference, covers, losses, pushes, rate }>} sorted desc
   ---------------------------------------------------------- */
function _computeConferenceATS(games, lineMap) {
  const records = {};
  FBS_CONFERENCES.forEach(function (conf) {
    records[conf] = { covers: 0, losses: 0, pushes: 0 };
  });

  games.forEach(function (g) {
    if (g.homePoints == null || g.awayPoints == null) return;
    if (!g.homeConference || !g.awayConference) return;
    if (g.homeConference === g.awayConference) return;

    const spread = lineMap[g.id];
    if (spread === undefined) return;

    const hConf     = g.homeConference;
    const aConf     = g.awayConference;
    const margin    = g.homePoints - g.awayPoints;
    const atsMargin = margin + spread;

    /* Push threshold: within 0.01 is treated as a push */
    const homeCovered = atsMargin >  0.01;
    const awayCovered = atsMargin < -0.01;

    if (records[hConf]) {
      if (homeCovered)      records[hConf].covers++;
      else if (awayCovered) records[hConf].losses++;
      else                  records[hConf].pushes++;
    }
    if (records[aConf]) {
      if (awayCovered)      records[aConf].covers++;
      else if (homeCovered) records[aConf].losses++;
      else                  records[aConf].pushes++;
    }
  });

  return Object.entries(records)
    .map(function ([conference, r]) {
      const decided = r.covers + r.losses;
      const rate    = decided > 0 ? r.covers / decided : 0;
      return {
        conference,
        covers: r.covers,
        losses: r.losses,
        pushes: r.pushes,
        rate,
        total: r.covers + r.losses + r.pushes,
      };
    })
    .filter(function (r) { return r.total > 0; })
    .sort(function (a, b) { return b.rate - a.rate; });
}

/* ----------------------------------------------------------
   _computeMovers
   Finds teams that moved the most in the AP Top 25 between
   the two most recent ranked weeks of the season.

   Teams that entered the poll are shown with "NR" as previous
   rank. Teams that dropped out are shown with "NR" as current.

   @param {Array} rankingsData — fetchRankings() output
   @returns {{ risers, fallers, currWeek, prevWeek } | null}
            null when fewer than 2 AP weeks are available.
   ---------------------------------------------------------- */
function _computeMovers(rankingsData) {
  /* Collect weeks that have a populated AP Top 25 poll */
  const apWeeks = rankingsData
    .filter(function (w) {
      return Array.isArray(w.polls) && w.polls.some(function (p) {
        return p.poll === 'AP Top 25' && Array.isArray(p.ranks) && p.ranks.length;
      });
    })
    .sort(function (a, b) { return a.week - b.week; });

  if (apWeeks.length < 2) return null;

  const prev     = apWeeks[apWeeks.length - 2];
  const curr     = apWeeks[apWeeks.length - 1];
  const prevPoll = prev.polls.find(function (p) { return p.poll === 'AP Top 25'; });
  const currPoll = curr.polls.find(function (p) { return p.poll === 'AP Top 25'; });

  if (!prevPoll || !currPoll) return null;

  /* Build { school: rank } maps for both weeks */
  const prevMap = {};
  prevPoll.ranks.forEach(function (r) { prevMap[r.school] = r.rank; });
  const currMap = {};
  currPoll.ranks.forEach(function (r) { currMap[r.school] = r.rank; });

  const deltas = [];

  /* Teams currently ranked — compute delta vs last week */
  currPoll.ranks.forEach(function (r) {
    const was = prevMap[r.school];
    if (was == null) {
      /* New entry — entered from unranked, delta = distance from #26 */
      deltas.push({ school: r.school, rank: r.rank, prev: 'NR', delta: 26 - r.rank });
    } else {
      deltas.push({ school: r.school, rank: r.rank, prev: was, delta: was - r.rank });
    }
  });

  /* Teams that dropped out of the poll entirely */
  prevPoll.ranks.forEach(function (r) {
    if (!currMap[r.school]) {
      deltas.push({ school: r.school, rank: 'NR', prev: r.rank, delta: -(26 - r.rank) });
    }
  });

  const risers  = deltas
    .filter(function (d) { return d.delta > 0; })
    .sort(function (a, b) { return b.delta - a.delta; })
    .slice(0, 5);

  const fallers = deltas
    .filter(function (d) { return d.delta < 0; })
    .sort(function (a, b) { return a.delta - b.delta; })
    .slice(0, 5);

  return { risers, fallers, currWeek: curr.week, prevWeek: prev.week };
}

/* ----------------------------------------------------------
   _computeTopPerformers
   Finds the 10 biggest individual-game ATS cover margins
   across all games with a consensus spread.

   For each game both the home and away perspective are added
   so the best cover on either side of the line surfaces.

   @param {Array}  games   — _fetchLeagueGames() output
   @param {Object} lineMap — _buildLineMap() output
   @returns {Array<{ school, opponent, spread, atsMargin }>}
   ---------------------------------------------------------- */
function _computeTopPerformers(games, lineMap) {
  const performances = [];

  games.forEach(function (g) {
    if (g.homePoints == null || g.awayPoints == null) return;
    const spread = lineMap[g.id];
    if (spread === undefined) return;

    const homeMargin = g.homePoints - g.awayPoints;
    /* ATS margin from home view: positive = home covered */
    const homeATS    = homeMargin + spread;
    /* ATS margin from away view: exactly negates home */
    const awayATS    = -homeATS;

    /* Home team perspective */
    performances.push({
      school:    g.homeTeam,
      opponent:  g.awayTeam,
      spread:    spread,    /* negative = home is favored */
      atsMargin: homeATS,
    });

    /* Away team perspective — spread flipped to their view */
    performances.push({
      school:    g.awayTeam,
      opponent:  g.homeTeam,
      spread:    -spread,   /* negative means away was favored */
      atsMargin: awayATS,
    });
  });

  return performances
    .filter(function (p) { return p.atsMargin > 0; })
    .sort(function (a, b) { return b.atsMargin - a.atsMargin; })
    .slice(0, 10);
}

/* =============================================================
   Render Helpers
   ============================================================= */

/* ----------------------------------------------------------
   _offseasonMsg
   Standard fallback shown for sections that require a live
   season. Rendered inline during render() so no loadData
   call is needed for these sections in the offseason.
   ---------------------------------------------------------- */
function _offseasonMsg() {
  return `
    <div style="padding:12px 0;font-family:var(--font-body);font-size:0.82rem;
                color:var(--text-muted);font-style:italic;opacity:0.6">
      Check back when the season starts.
    </div>
  `;
}

/* ----------------------------------------------------------
   _leagueLoadingRows
   Placeholder rows while a section is fetching.
   ---------------------------------------------------------- */
function _leagueLoadingRows(count) {
  return Array.from({ length: count }, function () {
    return `
      <div class="home-list-row home-list-row--loading">
        <span class="home-list-label" style="opacity:0.3;font-style:italic">Loading\u2026</span>
      </div>
    `;
  }).join('');
}

/* ----------------------------------------------------------
   _leagueError
   Inline error message for a fetch or compute failure.
   ---------------------------------------------------------- */
function _leagueError(msg) {
  return `
    <div class="home-list-row" style="opacity:0.6">
      <span class="home-list-label" style="font-size:0.78rem;color:var(--text-muted)">
        ${msg}
      </span>
    </div>
  `;
}

/* ----------------------------------------------------------
   _setLeagueSection
   DOM setter — no-ops if the element has been removed by
   navigation before the async fetch resolved.
   ---------------------------------------------------------- */
function _setLeagueSection(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

/* =============================================================
   Section Renderers
   Each receives computed data and returns an HTML string.
   ============================================================= */

/* ----------------------------------------------------------
   _renderConferenceStandings
   Ranked list: conference, W-L, win percentage.
   ---------------------------------------------------------- */
function _renderConferenceStandings(standings) {
  if (!standings || !standings.length) {
    return _leagueError('No standings data available.');
  }

  return standings.map(function (s, i) {
    const pctStr = (s.pct * 100).toFixed(1) + '%';
    return `
      <div class="home-list-row">
        <span class="home-list-rank">${i + 1}</span>
        <span class="home-list-label">${s.conference}</span>
        <span class="home-list-meta">${s.wins}\u2013${s.losses}</span>
        <span class="home-list-meta" style="min-width:42px;text-align:right">${pctStr}</span>
      </div>
    `;
  }).join('');
}

/* ----------------------------------------------------------
   _renderConferenceATS
   Ranked list: conference, covers-losses, cover rate.
   ---------------------------------------------------------- */
function _renderConferenceATS(atsData) {
  if (!atsData || !atsData.length) {
    return _leagueError('No ATS data available.');
  }

  return atsData.map(function (s, i) {
    const rateStr = (s.rate * 100).toFixed(1) + '%';
    return `
      <div class="home-list-row">
        <span class="home-list-rank">${i + 1}</span>
        <span class="home-list-label">${s.conference}</span>
        <span class="home-list-meta">${s.covers}\u2013${s.losses}</span>
        <span class="home-list-meta" style="min-width:42px;text-align:right">${rateStr}</span>
      </div>
    `;
  }).join('');
}

/* ----------------------------------------------------------
   _renderMovers
   Two-column layout: biggest risers (left) and fallers (right).
   School names are wrapped in .school-link for navigation.
   ---------------------------------------------------------- */
function _renderMovers(movers) {
  if (!movers) {
    return _leagueError('Not enough weekly data to compute movers.');
  }

  const { risers, fallers, currWeek, prevWeek } = movers;

  function moverRow(m, dir) {
    const arrow    = dir === 'up' ? '\u2191' : '\u2193';
    const clr      = dir === 'up'
      ? 'color:var(--color-positive,#4caf50)'
      : 'color:var(--color-negative,#f44336)';
    const rankStr  = m.rank === 'NR' ? 'NR' : `#${m.rank}`;
    const prevStr  = m.prev === 'NR' ? 'NR' : `#${m.prev}`;
    const change   = Math.abs(m.delta);
    return `
      <div class="home-list-row">
        <span class="home-list-label">${_schoolLink(m.school)}</span>
        <span class="home-list-meta">${prevStr}\u2192${rankStr}</span>
        <span class="home-list-meta" style="${clr};min-width:28px;text-align:right">
          ${arrow}${change}
        </span>
      </div>
    `;
  }

  const noData = `
    <div class="home-list-row">
      <span class="home-list-label" style="opacity:0.4">None</span>
    </div>
  `;

  const riserRows  = risers.length  ? risers.map(function (m)  { return moverRow(m, 'up');   }).join('') : noData;
  const fallerRows = fallers.length ? fallers.map(function (m) { return moverRow(m, 'down'); }).join('') : noData;

  return `
    <div style="font-family:var(--font-ui);font-size:0.68rem;letter-spacing:0.08em;
                text-transform:uppercase;color:var(--text-muted);margin-bottom:8px">
      Week ${prevWeek} \u2192 Week ${currWeek}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
      <div>
        <div style="font-family:var(--font-ui);font-size:0.65rem;letter-spacing:0.08em;
                    text-transform:uppercase;color:var(--text-muted);padding-bottom:6px;
                    border-bottom:1px solid var(--border-color);margin-bottom:2px">
          Rising
        </div>
        ${riserRows}
      </div>
      <div>
        <div style="font-family:var(--font-ui);font-size:0.65rem;letter-spacing:0.08em;
                    text-transform:uppercase;color:var(--text-muted);padding-bottom:6px;
                    border-bottom:1px solid var(--border-color);margin-bottom:2px">
          Falling
        </div>
        ${fallerRows}
      </div>
    </div>
  `;
}

/* ----------------------------------------------------------
   _renderTopPerformers
   Ranked list of the 10 biggest individual ATS cover margins.
   Shows team, opponent, spread faced, and cover amount.
   School names are wrapped in .school-link for navigation.
   ---------------------------------------------------------- */
function _renderTopPerformers(performers) {
  if (!performers || !performers.length) {
    return _leagueError('No performer data available.');
  }

  return performers.map(function (p, i) {
    /* Spread display: negative = favored, positive = underdog */
    const spreadStr = p.spread > 0
      ? `+${p.spread.toFixed(1)}`
      : p.spread.toFixed(1);
    const atsStr = `+${p.atsMargin.toFixed(1)}`;

    return `
      <div class="home-list-row">
        <span class="home-list-rank">${i + 1}</span>
        <span class="home-list-label">
          ${_schoolLink(p.school)}
          <span style="opacity:0.4;font-size:0.75em"> vs ${_schoolLink(p.opponent)}</span>
        </span>
        <span class="home-list-meta">${spreadStr}</span>
        <span class="home-list-meta"
              style="color:var(--color-positive,#4caf50);min-width:44px;text-align:right">
          ${atsStr}
        </span>
      </div>
    `;
  }).join('');
}

/* =============================================================
   LeaguePage Object
   ============================================================= */
const LeaguePage = {

  /* ----------------------------------------------------------
     render
     Returns the full page skeleton with loading placeholders.
     Movers and Top Performers show their offseason message
     immediately if CURRENT_WEEK is null — no fetch needed.
     Schedules loadData() via microtask after HTML is injected.
     ---------------------------------------------------------- */
  render() {
    Promise.resolve().then(function () { LeaguePage.loadData(); });

    return `
      <!-- League hero -->
      <div style="padding:24px 24px 16px">
        <div style="font-family:var(--font-serif);font-size:2rem;
                    font-weight:700;color:var(--text-primary);line-height:1">
          League
        </div>
        <div style="font-family:var(--font-ui);font-size:0.72rem;letter-spacing:0.1em;
                    text-transform:uppercase;color:var(--text-muted);margin-top:6px">
          FBS \u2014 ${LEAGUE_YEAR} Season Overview
        </div>
      </div>

      <!-- 2-column grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:0 24px 24px">

        <!-- Conference Standings -->
        <div class="home-card">
          <div class="home-card-title">
            Conference Standings
            <span style="font-family:var(--font-body);font-size:0.7rem;font-weight:400;
                         letter-spacing:0;text-transform:none;color:var(--text-muted);
                         margin-left:8px">${LEAGUE_YEAR} \u2014 Cross-Conference Record</span>
          </div>
          <div class="home-list" id="league-standings">${_leagueLoadingRows(10)}</div>
        </div>

        <!-- Best ATS Conferences -->
        <div class="home-card">
          <div class="home-card-title">
            Best ATS Conferences
            <span style="font-family:var(--font-body);font-size:0.7rem;font-weight:400;
                         letter-spacing:0;text-transform:none;color:var(--text-muted);
                         margin-left:8px">${LEAGUE_YEAR} \u2014 Cross-Conference Cover Rate</span>
          </div>
          <div class="home-list" id="league-ats">${_leagueLoadingRows(10)}</div>
        </div>

        <!-- Movers of the Week -->
        <div class="home-card">
          <div class="home-card-title">Movers of the Week</div>
          <div id="league-movers">
            ${CURRENT_WEEK !== null ? _leagueLoadingRows(5) : _offseasonMsg()}
          </div>
        </div>

        <!-- Top Performers -->
        <div class="home-card">
          <div class="home-card-title">
            Top Performers
            <span style="font-family:var(--font-body);font-size:0.7rem;font-weight:400;
                         letter-spacing:0;text-transform:none;color:var(--text-muted);
                         margin-left:8px">${LEAGUE_YEAR} \u2014 Biggest ATS Cover Margins</span>
          </div>
          <div class="home-list" id="league-performers">
            ${CURRENT_WEEK !== null ? _leagueLoadingRows(10) : _offseasonMsg()}
          </div>
        </div>

      </div>
    `;
  },

  /* ----------------------------------------------------------
     loadData
     Fires fetches concurrently via Promise.allSettled.
     Games + lines always fetch (historical data).
     Rankings only fetches when CURRENT_WEEK is active.
     Movers and Top Performers only render during the season.
     ---------------------------------------------------------- */
  async loadData() {
    const [gamesResult, linesResult, rankingsResult] = await Promise.allSettled([
      _fetchLeagueGames(LEAGUE_YEAR),
      _fetchLeagueLines(LEAGUE_YEAR),
      CURRENT_WEEK !== null
        ? fetchRankings(LEAGUE_YEAR, 'regular')
        : Promise.resolve(null),
    ]);

    /* Build the line map once — shared between ATS and Top Performers */
    const lineMap = linesResult.status === 'fulfilled' && linesResult.value
      ? _buildLineMap(linesResult.value)
      : {};

    /* ----------------------------------------------------------
       Conference Standings
       ---------------------------------------------------------- */
    if (gamesResult.status === 'fulfilled') {
      const standings = _computeConferenceStandings(gamesResult.value);
      _setLeagueSection('league-standings', _renderConferenceStandings(standings));
    } else {
      _setLeagueSection('league-standings',
        _leagueError(gamesResult.reason?.message || 'Games fetch failed'));
    }

    /* ----------------------------------------------------------
       Conference ATS
       ---------------------------------------------------------- */
    if (gamesResult.status === 'fulfilled' && linesResult.status === 'fulfilled') {
      const atsData = _computeConferenceATS(gamesResult.value, lineMap);
      _setLeagueSection('league-ats', _renderConferenceATS(atsData));
    } else {
      _setLeagueSection('league-ats',
        _leagueError(linesResult.reason?.message || 'Lines fetch failed'));
    }

    /* ----------------------------------------------------------
       Movers of the Week — live season only
       ---------------------------------------------------------- */
    if (CURRENT_WEEK !== null) {
      if (rankingsResult.status === 'fulfilled' && rankingsResult.value) {
        const movers = _computeMovers(rankingsResult.value);
        _setLeagueSection('league-movers', _renderMovers(movers));
      } else {
        _setLeagueSection('league-movers',
          _leagueError(rankingsResult.reason?.message || 'Rankings fetch failed'));
      }
    }

    /* ----------------------------------------------------------
       Top Performers — live season only
       ---------------------------------------------------------- */
    if (CURRENT_WEEK !== null) {
      if (gamesResult.status === 'fulfilled' && linesResult.status === 'fulfilled') {
        const performers = _computeTopPerformers(gamesResult.value, lineMap);
        _setLeagueSection('league-performers', _renderTopPerformers(performers));
      } else {
        _setLeagueSection('league-performers', _leagueError('Data unavailable'));
      }
    }
  },

  /* ----------------------------------------------------------
     unmount
     Called by the router when navigating away from league.
     No persistent DOM outside #page-content — nothing to clean up.
     ---------------------------------------------------------- */
  unmount() {
    /* No teardown needed */
  },
};
