'use strict';

/* =============================================================
   pages/home.js — FieldIQ Home Page
   Exposes: HomePage.render()
   Depends on: nothing
   Theme: neutral only — no school colors. resetTheme() is
   called by the router before this renders.
   ============================================================= */

/* ----------------------------------------------------------
   MOSAIC CONFIG
   Muted FBS-style color palette for placeholder tiles.
   Real logos replace these in Phase 7.
   Each entry: [backgroundColor, abbreviation]
   ---------------------------------------------------------- */
const MOSAIC_TILES = [
  ['#1a2a4a', 'ALA'], ['#2a1a1a', 'UGA'], ['#1a2a1a', 'MSU'],
  ['#2a2a1a', 'LSU'], ['#1a1a2a', 'OU' ], ['#2a1a2a', 'OSU'],
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
   Generates HTML for ~112 tiles (7 rows × 16 cols) to fill
   the viewport height plus animation overflow.
   Cycles through MOSAIC_TILES array for color variety.
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
   AP Top 25 — placeholder ranked list
   ---------------------------------------------------------- */
const TOP25_TEAMS = [
  'Georgia', 'Michigan', 'Alabama', 'Florida St', 'Washington',
  'Texas', 'Ohio St', 'Oregon', 'Penn St', 'Louisville',
  'Notre Dame', 'Ole Miss', 'Oklahoma', 'LSU', 'Tennessee',
  'Utah', 'Kansas St', 'Missouri', 'USC', 'Tulane',
  'Iowa', 'Oklahoma St', 'Air Force', 'James Madison', 'North Carolina',
];

function buildTop25() {
  return TOP25_TEAMS.map((team, i) => `
    <div class="home-list-row">
      <span class="home-list-rank">${i + 1}</span>
      <span class="home-list-label">${team}</span>
    </div>
  `).join('');
}

/* ----------------------------------------------------------
   Top Games of Week — placeholder matchups
   ---------------------------------------------------------- */
const TOP_GAMES = [
  { away: 'Michigan',    awayRk: 2,  home: 'Ohio St',   homeRk: 7,  time: 'Sat 12p ET',  net: 'FOX'   },
  { away: 'Alabama',     awayRk: 3,  home: 'Georgia',   homeRk: 1,  time: 'Sat 3:30p ET', net: 'CBS'  },
  { away: 'Washington',  awayRk: 4,  home: 'Oregon',    homeRk: 8,  time: 'Sat 7:30p ET', net: 'ABC'  },
  { away: 'Texas',       awayRk: 6,  home: 'Oklahoma',  homeRk: 13, time: 'Sat 7p ET',    net: 'ESPN' },
];

function buildTopGames() {
  return TOP_GAMES.map(g => `
    <div class="home-list-row">
      <span class="home-list-label">
        <span style="opacity:0.5">#${g.awayRk}</span> ${g.away}
        &nbsp;<span style="opacity:0.35">@</span>&nbsp;
        <span style="opacity:0.5">#${g.homeRk}</span> ${g.home}
      </span>
      <span class="home-list-meta">${g.time}</span>
      <span class="home-list-meta" style="min-width:36px;text-align:right">${g.net}</span>
    </div>
  `).join('');
}

/* ----------------------------------------------------------
   CFB News Feed — placeholder headlines
   ---------------------------------------------------------- */
const NEWS_ITEMS = [
  { headline: 'Georgia holds top spot in latest AP Poll after dominant win', time: '2h ago' },
  { headline: 'Michigan RB runs for 187 yards in rivalry week tune-up', time: '3h ago' },
  { headline: 'Alabama OC addresses offensive struggles heading into Iron Bowl', time: '4h ago' },
  { headline: 'CFP Selection Committee releases updated rankings', time: '5h ago' },
  { headline: 'Texas edges TCU in Big 12 showdown, remains in CFP picture', time: '6h ago' },
  { headline: 'Ohio State announces starter at QB for Michigan game', time: '7h ago' },
  { headline: 'Oregon moves to 10–0 after blowout win over Washington State', time: '8h ago' },
  { headline: 'SEC announces bowl game pairings for non-CFP teams', time: '10h ago' },
  { headline: 'Notre Dame rallies late to keep playoff hopes alive', time: '11h ago' },
  { headline: 'Penn State LB named finalist for Butkus Award', time: '12h ago' },
];

function buildNews() {
  return NEWS_ITEMS.map(n => `
    <div class="home-list-row" style="flex-direction:column;align-items:flex-start;gap:3px">
      <span class="home-list-label" style="white-space:normal;font-size:0.8rem;line-height:1.35">${n.headline}</span>
      <span class="home-list-meta">${n.time}</span>
    </div>
  `).join('');
}

/* ----------------------------------------------------------
   Daily Fact — static placeholder
   ---------------------------------------------------------- */
function buildDailyFact() {
  return `
    <div style="font-family:var(--font-serif);font-size:0.95rem;line-height:1.6;color:var(--text-primary);font-style:italic">
      "The first college football game was played on November 6, 1869 — Rutgers defeated Princeton 6–4 under soccer-style rules with 25 players per side."
    </div>
    <div class="home-list-meta" style="margin-top:4px">— Week 13 Historical Fact</div>
  `;
}

/* ----------------------------------------------------------
   CFP Bracket Snapshot — placeholder bracket rows
   ---------------------------------------------------------- */
const CFP_BRACKET = [
  { seed: 1,  team: 'Georgia',    record: '12–0' },
  { seed: 2,  team: 'Michigan',   record: '11–0' },
  { seed: 3,  team: 'Alabama',    record: '11–1' },
  { seed: 4,  team: 'Florida St', record: '11–0' },
  { seed: 5,  team: 'Washington', record: '11–0' },
  { seed: 6,  team: 'Texas',      record: '11–1' },
  { seed: 7,  team: 'Ohio St',    record: '10–1' },
  { seed: 8,  team: 'Oregon',     record: '10–1' },
];

function buildCFP() {
  return CFP_BRACKET.map(e => `
    <div class="home-list-row">
      <span class="home-list-rank">${e.seed}</span>
      <span class="home-list-label">${e.team}</span>
      <span class="home-list-meta">${e.record}</span>
    </div>
  `).join('');
}

/* ----------------------------------------------------------
   HomePage.render
   Assembles the full homepage HTML string. The router
   injects this into #page-content on #home navigation.
   The mosaic is rendered separately into #mosaic-root so it
   sits outside #page-content's overflow:hidden clipping context.
   ---------------------------------------------------------- */
const HomePage = {

  render() {
    // Mosaic is injected into #mosaic-root (outside app-shell) so the
    // fixed positioning is not clipped by the app-shell stacking context.
    const mosaicRoot = document.getElementById('mosaic-root');
    if (mosaicRoot) {
      mosaicRoot.innerHTML = `
        <div class="mosaic-bg">
          <div class="mosaic-grid">
            ${buildMosaicTiles()}
          </div>
          <div class="mosaic-overlay"></div>
        </div>
      `;
    }

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
          <div class="home-list">
            ${buildTop25()}
          </div>
        </div>

        <!-- Top Games of Week -->
        <div class="home-card home-card--games">
          <div class="home-card-title">Top Games of the Week</div>
          <div class="home-list">
            ${buildTopGames()}
          </div>
        </div>

        <!-- CFB News Feed -->
        <div class="home-card home-card--news">
          <div class="home-card-title">CFB News</div>
          <div class="home-list">
            ${buildNews()}
          </div>
        </div>

        <!-- Daily Fact -->
        <div class="home-card home-card--fact">
          <div class="home-card-title">This Week in CFB History</div>
          ${buildDailyFact()}
        </div>

        <!-- CFP Bracket Snapshot -->
        <div class="home-card home-card--cfp">
          <div class="home-card-title">CFP Rankings</div>
          <div class="home-list">
            ${buildCFP()}
          </div>
        </div>

      </div>
    `;
  },

  /* Called by the router when navigating away from home */
  unmount() {
    const mosaicRoot = document.getElementById('mosaic-root');
    if (mosaicRoot) mosaicRoot.innerHTML = '';
  },

};
