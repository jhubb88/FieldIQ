'use strict';

/* =============================================================
   pages/home.js — FieldIQ Home Page
   Exposes: HomePage.render(), HomePage.unmount()
   Depends on: api.js (fetchRankings, fetchGames, fetchESPNNews)
   Theme: neutral only — resetTheme() called by router before render.
   ============================================================= */

/* ----------------------------------------------------------
   Season Constants
   Update these each season. All data fetches use these values.
   ---------------------------------------------------------- */
const CURRENT_YEAR = 2025;
const CURRENT_WEEK = 1;

/* ----------------------------------------------------------
   History Constants
   "This Week in CFB History" pulls from the same week,
   10 years prior. Update HISTORY_YEAR each season.
   ---------------------------------------------------------- */
const HISTORY_YEAR = 2013;

/* ----------------------------------------------------------
   MOSAIC CONFIG
   Muted FBS-style color palette for placeholder tiles.
   Each entry: [backgroundColor, abbreviation]
   ---------------------------------------------------------- */
const MOSAIC_TILES = [
  ['#1a2a4a', 'ALA'], ['#2a1a1a', 'UGA'], ['#1a2a1a', 'MSU'],
  ['#2a2a1a', 'LSU'], ['#1a1a2a', 'OU' ], ['#2a2a1a', 'OSU'],
  ['#1a3a2a', 'ND' ], ['#3a1a1a', 'TEX'], ['#1a1a3a', 'UNC'],
  ['#2a3a1a', 'USC'], ['#3a2a1a', 'AUB'], ['#1a2a3a', 'PSU'],
  ['#2a1a3a', 'MIA'], ['#3a1a2a', 'TEN'], ['#1a3a1a', 'ORE'],
  ['#3a2a2a', 'FLA'], ['#2a2a3a', 'WIS'], ['#3a3a1a', 'ARK'],
  ['#1a3a3a', 'IOW'], ['#3a1a3a', 'KSU'], ['#2a3a3a', 'WVU'],
  ['#3a3a2a', 'KEN'], ['#243040', 'UCF'], ['#302430', 'TCU'],
  ['#243024', 'MIZ'], ['#302418', 'CLM'], ['#182430', 'PUR'],
];

/* ----------------------------------------------------------
   buildMosaicTiles
   Generates HTML for ~112 tiles (7 rows × 16 cols).
   ---------------------------------------------------------- */
function buildMosaicTiles() {
  const count = 112;
  let html = '';
  for (let i = 0; i < count; i++) {
    const [bg, abbr] = MOSAIC_TILES[i % MOSAIC_TILES.length];
    html += `<div class="mosaic-tile" style="background-color:${bg}">${abbr}</div>`;
  }
  return html;
}

/* ----------------------------------------------------------
   timeAgo
   Converts an RFC 2822 date string (from RSS pubDate) into
   a human-readable relative time: "2h ago", "3d ago", etc.
   Falls back to the raw date string if parsing fails.
   ---------------------------------------------------------- */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const normalized = dateStr.includes('T') || dateStr.endsWith('Z')
    ? dateStr
    : dateStr.replace(' ', 'T') + 'Z';
  const then = new Date(normalized);
  if (isNaN(then)) return dateStr;
  const diffMs  = Date.now() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)   return 'just now';
  if (diffMin < 60)  return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr  < 24)  return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

/* ----------------------------------------------------------
   loadingRows
   Returns N placeholder rows shown while a section is fetching.
   ---------------------------------------------------------- */
function loadingRows(count = 5) {
  return Array.from({ length: count }, () => `
    <div class="home-list-row home-list-row--loading">
      <span class="home-list-label" style="opacity:0.3;font-style:italic">Loading\u2026</span>
    </div>
  `).join('');
}

/* ----------------------------------------------------------
   errorHTML
   Inline error message displayed inside a card when a fetch
   fails. Never crashes the page — each section fails alone.
   ---------------------------------------------------------- */
function errorHTML(message) {
  return `
    <div class="home-list-row" style="flex-direction:column;gap:4px;opacity:0.6">
      <span class="home-list-label" style="font-size:0.78rem;color:var(--text-secondary)">
        Unable to load data
      </span>
      <span class="home-list-meta">${message}</span>
    </div>
  `;
}

/* ----------------------------------------------------------
   setSection
   Finds a section container by ID and replaces its innerHTML.
   No-ops if the element has been removed (user navigated away).
   ---------------------------------------------------------- */
function setSection(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

/* ----------------------------------------------------------
   _schoolLink
   Wraps a CFBD school name in a .school-link <span>.
   Looks up the school's conference from SCHOOLS_DATA so the
   CSS tooltip can show "School · Conference" on hover.
   The delegated click listener in app.js handles navigation.

   @param {string} cfbdName    — CFBD school name, e.g. 'Texas'
   @param {string} [innerHtml] — optional custom inner HTML
                                 (e.g. rank prefix already included)
   @returns {string} — HTML string
   ---------------------------------------------------------- */
function _schoolLink(cfbdName, innerHtml) {
  /* Look up conference from the SCHOOLS_DATA global */
  const entry   = (SCHOOLS_DATA && SCHOOLS_DATA.teams || []).find(function (t) {
    return t.name.replace(t.mascot, '').trim() === cfbdName;
  });
  const conf    = entry ? entry.conference : '';
  const tooltip = conf ? `${cfbdName} \u00b7 ${conf}` : cfbdName;
  const label   = innerHtml !== undefined ? innerHtml : cfbdName;

  return `<span class="school-link" data-team="${cfbdName}" data-tooltip="${tooltip}">${label}</span>`;
}

/* =============================================================
   DATA RENDERERS
   Each function receives raw API data and returns an HTML string.
   School names are wrapped in .school-link spans so the delegated
   click handler in app.js can navigate to the school page.
   ============================================================= */

/* ----------------------------------------------------------
   renderTop25
   Receives the full rankings API response array.
   Finds the most recent week with an "AP Top 25" poll entry.
   ---------------------------------------------------------- */
function renderTop25(rankingsData) {
  for (const week of rankingsData) {
    const apPoll = week.polls?.find(p => p.poll === 'AP Top 25');
    if (!apPoll || !apPoll.ranks?.length) continue;

    return apPoll.ranks
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map(r => `
        <div class="home-list-row">
          <span class="home-list-rank">${r.rank}</span>
          <span class="home-list-label">${_schoolLink(r.school)}</span>
          ${r.wins != null ? `<span class="home-list-meta">${r.wins}\u2013${r.losses}</span>` : ''}
        </div>
      `).join('');
  }
  return errorHTML('No AP Top 25 data found for this week.');
}

/* ----------------------------------------------------------
   renderGames
   Receives all games for the current week. Filters to ranked
   matchups, sorts by best combined rank. Both team names are
   wrapped in .school-link spans.
   ---------------------------------------------------------- */
function renderGames(gamesData) {
  const ranked = gamesData.filter(g => g.homeRank != null || g.awayRank != null);

  const displayGames = ranked.length
    ? ranked.sort((a, b) => {
        const rankA = Math.min(a.homeRank ?? 99, a.awayRank ?? 99);
        const rankB = Math.min(b.homeRank ?? 99, b.awayRank ?? 99);
        return rankA - rankB;
      })
    : gamesData
        .filter(g => g.homePoints != null && g.awayPoints != null)
        .sort((a, b) =>
          ((b.homePoints + b.awayPoints) - (a.homePoints + a.awayPoints))
        )
        .slice(0, 8);

  if (!displayGames.length) {
    return `<div class="home-list-row"><span class="home-list-label" style="opacity:0.5">No games found for Week ${CURRENT_WEEK}, ${CURRENT_YEAR}.</span></div>`;
  }

  return displayGames.map(g => {
    const awayRk  = g.awayRank ? `<span style="opacity:0.5">#${g.awayRank}</span> ` : '';
    const homeRk  = g.homeRank ? `<span style="opacity:0.5">#${g.homeRank}</span> ` : '';
    const atSign  = `<span style="opacity:0.35"> @ </span>`;

    let timeStr = '';
    if (g.startDate) {
      const d = new Date(g.startDate);
      timeStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    const network  = g.tvBroadcast || g.tv || '';
    const awayLink = _schoolLink(g.awayTeam, `${awayRk}${g.awayTeam}`);
    const homeLink = _schoolLink(g.homeTeam, `${homeRk}${g.homeTeam}`);

    return `
      <div class="home-list-row">
        <span class="home-list-label">${awayLink}${atSign}${homeLink}</span>
        ${timeStr  ? `<span class="home-list-meta">${timeStr}</span>` : ''}
        ${network  ? `<span class="home-list-meta" style="min-width:40px;text-align:right">${network}</span>` : ''}
      </div>
    `;
  }).join('');
}

/* ----------------------------------------------------------
   renderNews
   Receives array of {title, pubDate, link} from ESPN RSS.
   Displays up to 10 most recent items.
   ---------------------------------------------------------- */
function renderNews(newsItems) {
  if (!newsItems.length) {
    return errorHTML('No news items returned.');
  }

  return newsItems.slice(0, 10).map(n => `
    <div class="home-list-row" style="flex-direction:column;align-items:flex-start;gap:3px">
      <span class="home-list-label" style="white-space:normal;font-size:0.8rem;line-height:1.35">
        ${n.title}
      </span>
      <span class="home-list-meta">${timeAgo(n.pubDate)}</span>
    </div>
  `).join('');
}

/* ----------------------------------------------------------
   renderHistory
   Receives games from HISTORY_YEAR / CURRENT_WEEK.
   Picks the most notable game and formats it as a fact card.
   Both team names in the fact sentence are school links.
   ---------------------------------------------------------- */
function renderHistory(gamesData) {
  if (!gamesData.length) {
    return errorHTML(`No games found for Week ${CURRENT_WEEK}, ${HISTORY_YEAR}.`);
  }

  /* Prefer a ranked matchup; otherwise take the highest-scoring game */
  const ranked = gamesData
    .filter(g => g.homeRank != null || g.awayRank != null)
    .sort((a, b) => {
      const rankA = Math.min(a.homeRank ?? 99, a.awayRank ?? 99);
      const rankB = Math.min(b.homeRank ?? 99, b.awayRank ?? 99);
      return rankA - rankB;
    });

  const game = ranked[0] || gamesData.sort((a, b) =>
    ((b.homePoints || 0) + (b.awayPoints || 0)) - ((a.homePoints || 0) + (a.awayPoints || 0))
  )[0];

  const homeWon  = (game.homePoints ?? 0) > (game.awayPoints ?? 0);
  const winner   = homeWon ? game.homeTeam : game.awayTeam;
  const loser    = homeWon ? game.awayTeam : game.homeTeam;
  const winScore = homeWon ? game.homePoints : game.awayPoints;
  const losScore = homeWon ? game.awayPoints : game.homePoints;

  const scoreStr = (winScore != null && losScore != null)
    ? ` ${winScore}\u2013${losScore}`
    : '';

  const winnerLink = _schoolLink(winner);
  const loserLink  = _schoolLink(loser);

  const rankNote = (() => {
    const wr = homeWon ? game.homeRank : game.awayRank;
    const lr = homeWon ? game.awayRank : game.homeRank;
    if (wr && lr) return ` #${wr} ${winnerLink} defeated #${lr} ${loserLink}`;
    if (wr)       return ` #${wr} ${winnerLink} defeated ${loserLink}`;
    return ` ${winnerLink} defeated ${loserLink}`;
  })();

  const sentence = `${HISTORY_YEAR}, Week ${CURRENT_WEEK}:${rankNote}${scoreStr}.`;

  return `
    <div style="font-family:var(--font-serif);font-size:0.95rem;line-height:1.6;color:var(--text-primary);font-style:italic">
      \u201c${sentence}\u201d
    </div>
    <div class="home-list-meta" style="margin-top:6px">\u2014 ${HISTORY_YEAR} Season, Week ${CURRENT_WEEK}</div>
  `;
}

/* ----------------------------------------------------------
   renderCFP
   Receives the full rankings API response.
   Tries "College Football Playoff" poll first; falls back to
   AP Top 25 if CFP data isn't available yet (early season).
   School names are wrapped in .school-link spans.
   ---------------------------------------------------------- */
function renderCFP(rankingsData) {
  let pollName = 'College Football Playoff';
  let pollData = null;

  for (const week of rankingsData) {
    const cfp = week.polls?.find(p => p.poll === 'College Football Playoff');
    if (cfp?.ranks?.length) {
      pollData = cfp;
      break;
    }
  }

  if (!pollData) {
    pollName = 'AP Top 25 (CFP N/A)';
    for (const week of rankingsData) {
      const ap = week.polls?.find(p => p.poll === 'AP Top 25');
      if (ap?.ranks?.length) {
        pollData = ap;
        break;
      }
    }
  }

  if (!pollData) {
    return errorHTML('No ranking data available.');
  }

  const displayRanks = pollData.ranks.slice().sort((a, b) => a.rank - b.rank).slice(0, 12);

  return displayRanks.map(r => `
    <div class="home-list-row">
      <span class="home-list-rank">${r.rank}</span>
      <span class="home-list-label">${_schoolLink(r.school)}</span>
      ${r.wins != null ? `<span class="home-list-meta">${r.wins}\u2013${r.losses}</span>` : ''}
    </div>
  `).join('');
}

/* =============================================================
   HomePage Object
   ============================================================= */
const HomePage = {

  /* ----------------------------------------------------------
     render
     Returns the full page skeleton HTML with loading states.
     Schedules loadData() via microtask so it fires after the
     router injects this string into #page-content.
     ---------------------------------------------------------- */
  render() {
    /* Mount mosaic into dedicated root outside the app shell */
    const mosaicRoot = document.getElementById('mosaic-root');
    if (mosaicRoot) {
      mosaicRoot.innerHTML = `
        <div class="mosaic-bg">
          <div class="mosaic-grid">${buildMosaicTiles()}</div>
          <div class="mosaic-overlay"></div>
        </div>
      `;
    }

    Promise.resolve().then(function () { HomePage.loadData(); });

    return `
      <!-- Hero -->
      <div class="home-hero">
        <div class="home-hero-wordmark">FieldIQ</div>
        <div class="home-hero-tagline">FBS College Football &mdash; Data, Stats, Information</div>
      </div>

      <!-- Dashboard grid -->
      <div class="home-grid">

        <!-- AP Top 25 -->
        <div class="home-card home-card--top25">
          <div class="home-card-title">AP Top 25</div>
          <div class="home-list" id="section-top25">${loadingRows(10)}</div>
        </div>

        <!-- Top Games of Week -->
        <div class="home-card home-card--games">
          <div class="home-card-title">Top Games \u2014 Week ${CURRENT_WEEK}, ${CURRENT_YEAR}</div>
          <div class="home-list" id="section-games">${loadingRows(4)}</div>
        </div>

        <!-- CFB News Feed -->
        <div class="home-card home-card--news">
          <div class="home-card-title">CFB News</div>
          <div class="home-list" id="section-news">${loadingRows(6)}</div>
        </div>

        <!-- This Week in CFB History -->
        <div class="home-card home-card--fact">
          <div class="home-card-title">This Week in CFB History</div>
          <div id="section-fact">${loadingRows(1)}</div>
        </div>

        <!-- CFP Rankings -->
        <div class="home-card home-card--cfp">
          <div class="home-card-title" id="section-cfp-title">CFP Rankings</div>
          <div class="home-list" id="section-cfp">${loadingRows(8)}</div>
        </div>

      </div>
    `;
  },

  /* ----------------------------------------------------------
     loadData
     Fires all data fetches concurrently via Promise.allSettled.
     Rankings are fetched once and shared between Top 25 + CFP.
     History uses the same games endpoint with different params.
     ---------------------------------------------------------- */
  async loadData() {
    const [rankingsResult, gamesResult, newsResult, historyResult] =
      await Promise.allSettled([
        fetchRankings(CURRENT_YEAR, 'regular'),
        fetchGames(CURRENT_YEAR, CURRENT_WEEK, 'regular', { classification: 'fbs' }),
        fetchESPNNews(),
        fetchGames(HISTORY_YEAR, CURRENT_WEEK, 'regular', { classification: 'fbs' }),
      ]);

    /* AP Top 25 */
    if (rankingsResult.status === 'fulfilled') {
      setSection('section-top25', renderTop25(rankingsResult.value));
    } else {
      setSection('section-top25', errorHTML(rankingsResult.reason?.message || 'Fetch failed'));
    }

    /* Top Games */
    if (gamesResult.status === 'fulfilled') {
      setSection('section-games', renderGames(gamesResult.value));
    } else {
      setSection('section-games', errorHTML(gamesResult.reason?.message || 'Fetch failed'));
    }

    /* CFB News */
    if (newsResult.status === 'fulfilled') {
      setSection('section-news', renderNews(newsResult.value));
    } else {
      setSection('section-news', errorHTML(newsResult.reason?.message || 'Fetch failed'));
    }

    /* CFB History */
    if (historyResult.status === 'fulfilled') {
      setSection('section-fact', renderHistory(historyResult.value));
    } else {
      setSection('section-fact', errorHTML(historyResult.reason?.message || 'Fetch failed'));
    }

    /* CFP Rankings — reuses rankings data, updates title if AP fallback used */
    if (rankingsResult.status === 'fulfilled') {
      const data   = rankingsResult.value;
      const hasCFP = data.some(w => w.polls?.some(p =>
        p.poll === 'College Football Playoff' && p.ranks?.length
      ));
      const titleEl = document.getElementById('section-cfp-title');
      if (titleEl && !hasCFP) titleEl.textContent = 'CFP Rankings (AP Fallback)';
      setSection('section-cfp', renderCFP(data));
    } else {
      setSection('section-cfp', errorHTML(rankingsResult.reason?.message || 'Fetch failed'));
    }
  },

  /* ----------------------------------------------------------
     unmount
     Called by the router when navigating away from home.
     Clears the mosaic so it doesn't persist on other pages.
     ---------------------------------------------------------- */
  unmount() {
    const mosaicRoot = document.getElementById('mosaic-root');
    if (mosaicRoot) mosaicRoot.innerHTML = '';
  },

};
