'use strict';

/* =============================================================
   pages/school.js — FieldIQ School Page
   Exposes: SchoolPage.render(params), SchoolPage.loadData(),
            toggleSection(sectionId)
   Depends on: js/api.js (fetch functions), js/dna.js (computeDNA)

   Phase 4: Skeleton with hardcoded Texas placeholder data.
   Phase 5: Live API data for DNA, snapshot, game cards, identity.
             School and year are hardcoded — Phase 11 adds switcher.
   Phase 6: Game Control + Volatility lenses wired with live data.
   Phase 7: Situational + Market Performance lenses wired.
   Refactor: _loadAnalyticsData split into _loadGameControlData,
             _loadSituationalData, _loadMarketData before Phase 8.
   Phase 8: Campus Map (Leaflet.js).
   Phase 12: Long-Term Strength — Rankings History, Draft Production,
             Coaching Continuity, Bowl History, 10-Year Record.
   ============================================================= */

/* ----------------------------------------------------------
   Season Constant
   ---------------------------------------------------------- */
const SCHOOL_YEAR    = 2025;  /* Analytics season — all stat lenses use this year */
const SCHEDULE_YEAR  = 2026;  /* Schedule lens — completely separate from analytics */

/* ----------------------------------------------------------
   Active School — set dynamically in render() from URL params.
   Defaults to Texas so the page still works if no param is
   passed (e.g. the user navigates to #school with no team).
   ---------------------------------------------------------- */
let SCHOOL_NAME = 'Texas';
let SCHOOL_ID   = 'texas';

/* ----------------------------------------------------------
   School Data
   Loaded from SCHOOLS_DATA global in render() and loadData().
   _schoolData holds the matching entry for SCHOOL_ID.
   ---------------------------------------------------------- */
let _schoolData = null;

/* ----------------------------------------------------------
   H2H Search State
   Reset to false in render() each time the school page mounts
   so the input events bind fresh to the new DOM elements.
   ---------------------------------------------------------- */
let _h2hSearchInitialized = false;

/* ----------------------------------------------------------
   _schoolIdFromCfbd
   Looks up the schools.json id (e.g. 'texas') for a given
   CFBD school name (e.g. 'Texas'). Falls back to a slugified
   version of the name if no match is found.

   @param {string} cfbdName — CFBD school name, e.g. 'Texas'
   @returns {string} — schools.json id, e.g. 'texas'
   ---------------------------------------------------------- */
function _schoolIdFromCfbd(cfbdName) {
  const entry = (SCHOOLS_DATA.teams || []).find(function (t) {
    return t.name.replace(t.mascot, '').trim() === cfbdName;
  });
  return entry ? entry.id : cfbdName.toLowerCase().replace(/\s+/g, '-');
}

/* ----------------------------------------------------------
   _schoolDisplayName
   Returns the full display name (e.g. 'Texas Longhorns') for
   a given CFBD school name (e.g. 'Texas'). Falls back to the
   CFBD name itself if the school is not in schools.json.

   @param {string} cfbdName — CFBD school name
   @returns {string} — full display name
   ---------------------------------------------------------- */
function _schoolDisplayName(cfbdName) {
  const entry = (SCHOOLS_DATA.teams || []).find(function (t) {
    return t.name.replace(t.mascot, '').trim() === cfbdName;
  });
  return entry ? entry.name : cfbdName;
}

/* ----------------------------------------------------------
   Section definitions
   Single source of truth for sidebar nav order, IDs, labels,
   and which build phase delivers real content.
   ---------------------------------------------------------- */
const SECTIONS = [
  { id: 'overview',     label: 'Overview',           phase: null },
  { id: 'game-control', label: 'Game Control',        phase: 6 },
  { id: 'volatility',   label: 'Volatility',          phase: 6 },
  { id: 'situational',  label: 'Situational',         phase: 7 },
  { id: 'market',       label: 'Market Performance',  phase: 7 },
  { id: 'longterm',     label: 'Long-Term Strength',  phase: 12 },
  { id: 'campus-map',   label: 'Campus Map',          phase: 8 },
  { id: 'h2h',          label: 'H2H Search',          phase: 10 },
  { id: 'schedule',     label: 'Schedule',            phase: 5 },
];

/* ----------------------------------------------------------
   toggleSection
   Shows the requested section, hides all others.
   Standalone exported function — called by onclick in HTML
   and can be called programmatically without refactoring nav.
   @param {string} sectionId — must match a SECTIONS[n].id value
   ---------------------------------------------------------- */
function toggleSection(sectionId) {
  document.querySelectorAll('.lens-nav-item').forEach(function (item) {
    item.classList.toggle('active', item.dataset.section === sectionId);
  });

  document.querySelectorAll('.school-section').forEach(function (section) {
    section.classList.toggle('is-active', section.dataset.section === sectionId);
  });

  /* Leaflet needs a size recalculation after the section transitions from
     display:none to display:flex — fire after the paint cycle settles. */
  if (sectionId === 'campus-map' && window._campusMapInline) {
    setTimeout(function () {
      window._campusMapInline.invalidateSize();
    }, 100);
  }

  /* H2H search input is bound once, lazily, on first visit to the section. */
  if (sectionId === 'h2h') {
    setTimeout(function () { _initH2HSearch(); }, 50);
  }
}

/* =============================================================
   Render Helpers
   Produce HTML strings from data objects. Called by loadData()
   once API data is ready, and injected via setSection().
   ============================================================= */

/* ----------------------------------------------------------
   renderDNACard
   Builds the Program DNA card from an array of label objects.
   Empty labels array shows just the note — this is the expected
   state when computeDNA returns "not enough games yet".
   @param {Array}  labels — [{ label: string, stat: string }]
   @param {string} note   — footnote shown below the labels
   @returns {string} HTML string
   ---------------------------------------------------------- */
function renderDNACard(labels, note) {
  const labelsHTML = labels.map(function (item) {
    return `
      <div class="dna-label-group">
        <span class="dna-label">${item.label}</span>
        <span class="dna-stat">${item.stat}</span>
      </div>`;
  }).join('');

  return `
    <div class="dna-card">
      <div class="dna-card-title">Program DNA</div>
      <div class="dna-labels">${labelsHTML}</div>
      <div class="dna-card-note">${note}</div>
    </div>`;
}

/* ----------------------------------------------------------
   renderSnapshotRow
   Builds the four-card season snapshot row.
   @param {Object} data — { record, rank, avgMargin, ppg }
   @returns {string} HTML string
   ---------------------------------------------------------- */
function renderSnapshotRow(data) {
  const cards = [
    { value: data.record,    label: 'Record' },
    { value: data.rank,      label: 'AP Rank' },
    { value: data.avgMargin, label: 'Avg Margin' },
    { value: data.ppg,       label: 'PPG' },
  ];

  const cardsHTML = cards.map(function (card) {
    return `
      <div class="snapshot-card">
        <div class="snapshot-value">${card.value}</div>
        <div class="snapshot-label">${card.label}</div>
      </div>`;
  }).join('');

  return `<div class="snapshot-row">${cardsHTML}</div>`;
}

/* ----------------------------------------------------------
   renderGameCards
   Builds Last Game and Next Game cards side by side.
   nextGame === null renders the offseason state.
   lastGame.ou may be null if O/U data was unavailable.
   nextGame.spread may be null if line data was unavailable.
   @param {Object|null} lastGame
   @param {Object|null} nextGame
   @returns {string} HTML string
   ---------------------------------------------------------- */
function renderGameCards(lastGame, nextGame) {
  /* Last game card */
  let lastHTML;
  if (lastGame) {
    const atsLine = lastGame.ou
      ? `${lastGame.ats} &nbsp;&middot;&nbsp; ${lastGame.ou}`
      : lastGame.ats;
    lastHTML = `
      <div class="game-card">
        <div class="game-card-header">Last Game</div>
        <div class="game-card-score">${lastGame.result} ${lastGame.score}</div>
        <div class="game-card-ats">${atsLine}</div>
        <div class="game-card-meta">vs ${lastGame.opponent}<br>${lastGame.game}</div>
      </div>`;
  } else {
    lastHTML = `
      <div class="game-card">
        <div class="game-card-header">Last Game</div>
        <div class="game-card-offseason">No data</div>
      </div>`;
  }

  /* Next game card — null = offseason */
  let nextHTML;
  if (nextGame) {
    const meta = nextGame.spread
      ? `${nextGame.date}<br>${nextGame.location} &nbsp;&middot;&nbsp; ${nextGame.spread}`
      : `${nextGame.date}<br>${nextGame.location}`;
    nextHTML = `
      <div class="game-card">
        <div class="game-card-header">Next Game</div>
        <div class="game-card-score">${nextGame.opponent}</div>
        <div class="game-card-meta">${meta}</div>
      </div>`;
  } else {
    nextHTML = `
      <div class="game-card">
        <div class="game-card-header">Next Game</div>
        <div class="game-card-offseason">Offseason</div>
        <div class="game-card-meta">No upcoming game scheduled.</div>
      </div>`;
  }

  return `<div class="game-cards-row">${lastHTML}${nextHTML}</div>`;
}

/* ----------------------------------------------------------
   renderIdentityCard
   Builds the School Identity card: 2-column grid of facts.
   @param {Object} data — identity fields from _deriveIdentity()
   @returns {string} HTML string
   ---------------------------------------------------------- */
function renderIdentityCard(data) {
  const facts = [
    { label: 'Conference',   value: data.conference },
    { label: 'City',         value: data.city },
    { label: 'Stadium',      value: data.stadium },
    { label: 'Capacity',     value: data.capacity },
    { label: 'Founded',      value: data.founded },
    { label: 'Enrollment',   value: data.enrollment },
    { label: 'Coach Salary', value: data.coachSalary },
    { label: 'Head Coach',   value: data.coachSeason ? `${data.coach} \u00b7 ${data.coachSeason}` : data.coach },
    { label: 'Coach Record', value: data.coachRecord },
  ];

  const factsHTML = facts
    .filter(function (fact) { return fact.value != null && fact.value !== ''; })
    .map(function (fact) {
      return `
      <div class="identity-item">
        <div class="identity-item-label">${fact.label}</div>
        <div class="identity-item-value">${fact.value}</div>
      </div>`;
    }).join('');

  return `
    <div class="identity-card">
      <div class="identity-card-title">School Identity</div>
      <div class="identity-grid">${factsHTML}</div>
    </div>`;
}

/* ----------------------------------------------------------
   renderGameControl
   Builds the Game Control lens content from gamecontrol.js
   compute results. Three subsections separated by dividers:
     1. Blowout Profile   — 3 win-bucket stat cards
     2. Half Scoring      — 2 half-avg cards (skipped if null)
     3. Close Game Record — 1 W-L stat card

   @param {Object} data — {
     blowout:   computeBlowoutProfile result,
     halfScore: computeHalfScoring result (may be null),
     closeGame: computeCloseGameRecord result,
   }
   @returns {string} HTML string
   ---------------------------------------------------------- */
function renderGameControl(data) {
  const { blowout, halfScore, closeGame } = data;

  /* --- Blowout Profile subsection --- */
  const blowoutCards = `
    <h3 class="school-section-title">Blowout Profile</h3>
    <div class="stat-cards-row">
      <div class="stat-card">
        <div class="stat-card-title">Blowout Wins</div>
        <div class="stat-card-value">${blowout.blowout}</div>
        <div class="stat-card-sub">${blowout.blowoutPct}% of wins &middot; 15+ pts</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">Competitive Wins</div>
        <div class="stat-card-value">${blowout.competitive}</div>
        <div class="stat-card-sub">${blowout.competitivePct}% of wins &middot; 9\u201314 pts</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">Grinder Wins</div>
        <div class="stat-card-value">${blowout.grinder}</div>
        <div class="stat-card-sub">${blowout.grinderPct}% of wins &middot; 8 pts or less</div>
      </div>
    </div>`;

  /* --- Half Scoring subsection — skipped if no half data --- */
  let halfCards = '';
  if (halfScore) {
    const allowed1st = halfScore.avgAllowed1st !== null
      ? `Allowed ${halfScore.avgAllowed1st} avg`
      : 'Opponent data unavailable';
    const allowed2nd = halfScore.avgAllowed2nd !== null
      ? `Allowed ${halfScore.avgAllowed2nd} avg`
      : 'Opponent data unavailable';

    halfCards = `
      <hr class="section-divider">
      <h3 class="school-section-title">Half Scoring</h3>
      <div class="stat-cards-row">
        <div class="stat-card">
          <div class="stat-card-title">1st Half Avg</div>
          <div class="stat-card-value">${halfScore.avg1stHalf}</div>
          <div class="stat-card-sub">${allowed1st}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-title">2nd Half Avg</div>
          <div class="stat-card-value">${halfScore.avg2ndHalf}</div>
          <div class="stat-card-sub">${allowed2nd}</div>
        </div>
      </div>`;
  }

  /* --- Close Game Record subsection --- */
  const closeRecord = closeGame.total > 0
    ? `${closeGame.closeWins}-${closeGame.closeLosses} in ${closeGame.total} close game${closeGame.total !== 1 ? 's' : ''}`
    : 'No close games this season';

  const closeCards = `
    <hr class="section-divider">
    <h3 class="school-section-title">Close Game Record</h3>
    <div class="stat-cards-row">
      <div class="stat-card">
        <div class="stat-card-title">Close Games (decided by 8 or less)</div>
        <div class="stat-card-value">${closeGame.closeWins}-${closeGame.closeLosses}</div>
        <div class="stat-card-sub">${closeRecord}</div>
      </div>
    </div>`;

  return blowoutCards + halfCards + closeCards;
}

/* ----------------------------------------------------------
   renderVolatility
   Builds the Volatility lens content from gamecontrol.js
   compute results. Four subsections separated by dividers:
     1. Consistency Rating — std dev + label stat card
     2. Season Arc         — week-by-week dot strip
     3. Trap Game Index    — margin drop card (if data available)
     4. Largest Win / Loss — 2 stat cards side by side

   @param {Object} data — {
     consistency: computeConsistencyRating result,
     diffs:       computeScoreDifferentials result,
     trapGame:    computeTrapGameIndex result (may be null),
     extremes:    computeLargestWinLoss result,
   }
   @returns {string} HTML string
   ---------------------------------------------------------- */
function renderVolatility(data) {
  const { consistency, diffs, trapGame, extremes } = data;

  /* --- Consistency Rating subsection --- */
  const consistencyCard = `
    <h3 class="school-section-title">Consistency Rating</h3>
    <div class="stat-cards-row">
      <div class="stat-card">
        <div class="stat-card-title">Margin Std Dev</div>
        <div class="stat-card-value">${consistency.stdDev}</div>
        <div class="stat-card-sub">${consistency.label}</div>
        <div class="stat-card-note">Lower = more predictable. Reliable \u2264 7 \u00b7 Volatile \u2265 14</div>
      </div>
    </div>`;

  /* --- Season Arc subsection --- */
  const arcDots = diffs.map(function (g) {
    const resultClass = g.isWin ? 'win' : 'loss';
    const sign        = g.margin >= 0 ? '+' : '';
    const tip         = `Wk ${g.week} vs ${g.opponent} (${sign}${g.margin})`;
    return `
      <div class="season-arc-game ${resultClass}" title="${tip}">
        <div class="season-arc-dot"></div>
        <div class="season-arc-label">W${g.week}</div>
      </div>`;
  }).join('');

  const arcSection = `
    <hr class="section-divider">
    <h3 class="school-section-title">Season Arc</h3>
    <div class="season-arc">${arcDots}</div>`;

  /* --- Trap Game Index subsection (only if enough data) --- */
  let trapSection = '';
  if (trapGame) {
    const dropNum     = parseFloat(trapGame.drop);
    const dropDisplay = dropNum >= 0
      ? `\u2212${dropNum.toFixed(1)}`
      : `+${Math.abs(dropNum).toFixed(1)}`;
    trapSection = `
      <hr class="section-divider">
      <h3 class="school-section-title">Trap Game Index</h3>
      <div class="stat-cards-row">
        <div class="stat-card">
          <div class="stat-card-title">Margin vs Normal Games</div>
          <div class="stat-card-value">${dropDisplay}</div>
          <div class="stat-card-sub">Normal avg ${trapGame.avgNormalMargin} \u2192 Trap avg ${trapGame.avgTrapMargin}</div>
          <div class="stat-card-note">Based on ${trapGame.trapCount} trap situation${trapGame.trapCount !== 1 ? 's' : ''}</div>
          <div class="stat-card-note">+ = outperformed normal avg &middot; \u2212 = underperformed</div>
        </div>
      </div>`;
  }

  /* --- Largest Win / Largest Loss subsection --- */
  const winCard = extremes.largestWin
    ? `
      <div class="stat-card">
        <div class="stat-card-title">Largest Win</div>
        <div class="stat-card-value">+${extremes.largestWin.margin}</div>
        <div class="stat-card-sub">${extremes.largestWin.score} vs ${extremes.largestWin.opponent}</div>
      </div>`
    : `
      <div class="stat-card">
        <div class="stat-card-title">Largest Win</div>
        <div class="stat-card-value">\u2014</div>
        <div class="stat-card-sub">No wins recorded</div>
      </div>`;

  const lossCard = extremes.largestLoss
    ? `
      <div class="stat-card">
        <div class="stat-card-title">Largest Loss</div>
        <div class="stat-card-value">\u2212${extremes.largestLoss.margin}</div>
        <div class="stat-card-sub">${extremes.largestLoss.score} vs ${extremes.largestLoss.opponent}</div>
      </div>`
    : `
      <div class="stat-card">
        <div class="stat-card-title">Largest Loss</div>
        <div class="stat-card-value">\u2014</div>
        <div class="stat-card-sub">No losses recorded</div>
      </div>`;

  const extremesSection = `
    <hr class="section-divider">
    <h3 class="school-section-title">Largest Win &amp; Loss</h3>
    <div class="stat-cards-row">${winCard}${lossCard}</div>`;

  return consistencyCard + arcSection + trapSection + extremesSection;
}

/* ----------------------------------------------------------
   renderSituational
   Builds the Situational lens content from situational.js
   compute results. Four subsections separated by dividers:
     1. Home vs Away     — 4 stat cards (record + scoring avg)
     2. Night Games      — 1 stat card (skipped if total is 0)
     3. Revenge Games    — list or "none" message
     4. Record vs Ranked — 1 stat card (skipped if null)

   Bowl record is intentionally omitted from this view —
   it will surface in Phase 12 Long-Term Strength with
   multi-year data. computeBowlRecord is already built
   generically for that purpose.

   @param {Object} data — {
     splits:   computeHomeAwaySplits result,
     night:    computeNightGameRecord result,
     revenge:  computeRevengeGames result,
     vsRanked: computeRecordVsRanked result (may be null),
   }
   @returns {string} HTML string
   ---------------------------------------------------------- */
function renderSituational(data) {
  const { splits, night, revenge, vsRanked } = data;

  /* --- Home vs Away subsection --- */
  const homeScoringNote = splits.homeAvgScore !== null
    ? `Allowed ${splits.homeAvgAllowed} avg`
    : 'No home games';
  const awayScoringNote = splits.awayAvgScore !== null
    ? `Allowed ${splits.awayAvgAllowed} avg`
    : 'No away games';

  const splitCards = `
    <h3 class="school-section-title">Home vs Away</h3>
    <div class="stat-cards-row">
      <div class="stat-card">
        <div class="stat-card-title">Home Record</div>
        <div class="stat-card-value">${splits.homeWins}-${splits.homeLosses}</div>
        <div class="stat-card-sub">${splits.homeWins + splits.homeLosses} home game${splits.homeWins + splits.homeLosses !== 1 ? 's' : ''}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">Away Record</div>
        <div class="stat-card-value">${splits.awayWins}-${splits.awayLosses}</div>
        <div class="stat-card-sub">${splits.awayWins + splits.awayLosses} away game${splits.awayWins + splits.awayLosses !== 1 ? 's' : ''}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">Home Scoring Avg</div>
        <div class="stat-card-value">${splits.homeAvgScore !== null ? splits.homeAvgScore : '\u2014'}</div>
        <div class="stat-card-sub">${homeScoringNote}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">Away Scoring Avg</div>
        <div class="stat-card-value">${splits.awayAvgScore !== null ? splits.awayAvgScore : '\u2014'}</div>
        <div class="stat-card-sub">${awayScoringNote}</div>
      </div>
    </div>`;

  /* --- Night Games subsection — skipped if no night games played --- */
  let nightSection = '';
  if (night.total > 0) {
    nightSection = `
      <hr class="section-divider">
      <h3 class="school-section-title">Night Games</h3>
      <div class="stat-cards-row">
        <div class="stat-card">
          <div class="stat-card-title">Night Game Record (6 PM CT or later)</div>
          <div class="stat-card-value">${night.wins}-${night.losses}</div>
          <div class="stat-card-sub">${night.total} night game${night.total !== 1 ? 's' : ''} this season</div>
        </div>
      </div>`;
  }

  /* --- Revenge Games subsection --- */
  let revengeContent;
  if (revenge.length === 0) {
    revengeContent = `<p class="stat-card-note">No revenge game situations this season.</p>`;
  } else {
    const revengeRows = revenge.map(function (r) {
      const resultClass = r.won ? 'color: var(--school-primary)' : 'color: var(--color-loss)';
      return `
        <div class="home-list-row">
          <span class="home-list-label">${r.opponent}</span>
          <span class="home-list-meta" style="${resultClass}">${r.result} ${r.margin}</span>
        </div>`;
    }).join('');
    revengeContent = `<div class="home-list">${revengeRows}</div>`;
  }

  const revengeSection = `
    <hr class="section-divider">
    <h3 class="school-section-title">Revenge Games</h3>
    <div class="stat-card" style="padding: 16px 20px;">
      <div class="stat-card-title">Opponents who beat us in ${SCHOOL_YEAR}</div>
      ${revengeContent}
    </div>`;

  /* --- Record vs Ranked subsection — skipped if null --- */
  let rankedSection = '';
  if (vsRanked !== null) {
    const rankedNote = vsRanked.total > 0
      ? `${vsRanked.total} game${vsRanked.total !== 1 ? 's' : ''} vs ranked opponents`
      : 'No games vs ranked opponents this season';
    rankedSection = `
      <hr class="section-divider">
      <h3 class="school-section-title">Record vs Ranked</h3>
      <div class="stat-cards-row">
        <div class="stat-card">
          <div class="stat-card-title">vs AP Top 25</div>
          <div class="stat-card-value">${vsRanked.wins}-${vsRanked.losses}</div>
          <div class="stat-card-sub">${rankedNote}</div>
        </div>
      </div>`;
  }

  return splitCards + nightSection + revengeSection + rankedSection;
}

/* ----------------------------------------------------------
   renderMarketPerformance
   Builds the Market Performance lens content from market.js
   compute results. Four subsections separated by dividers:
     1. ATS Record        — 3 stat cards (overall, home, away)
     2. O/U Record        — 2 stat cards (overs, unders) with pushes
     3. Home Underdog ATS — 1 stat card (skipped if null)
     4. Cover Streaks     — 2 stat cards (best, worst)

   @param {Object} data — {
     ats:          computeATSRecord result,
     ou:           computeOURecord result,
     homeUnderdog: computeHomeUnderdogATS result (may be null),
     streaks:      computeCoverStreaks result,
   }
   @returns {string} HTML string
   ---------------------------------------------------------- */
function renderMarketPerformance(data) {
  const { ats, ou, homeUnderdog, streaks } = data;

  /* Helper: formats a W-L record with optional push count */
  function _fmtATS(bucket) {
    const pushNote = bucket.pushes > 0
      ? ` \u00b7 ${bucket.pushes} push${bucket.pushes !== 1 ? 'es' : ''}`
      : '';
    return `${bucket.wins}-${bucket.losses}${pushNote}`;
  }

  /* --- ATS Record subsection --- */
  const atsCards = `
    <h3 class="school-section-title">ATS Record</h3>
    <div class="stat-cards-row">
      <div class="stat-card">
        <div class="stat-card-title">Overall ATS</div>
        <div class="stat-card-value">${ats.overall.wins}-${ats.overall.losses}</div>
        <div class="stat-card-sub">${_fmtATS(ats.overall)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">Home ATS</div>
        <div class="stat-card-value">${ats.home.wins}-${ats.home.losses}</div>
        <div class="stat-card-sub">${_fmtATS(ats.home)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">Away ATS</div>
        <div class="stat-card-value">${ats.away.wins}-${ats.away.losses}</div>
        <div class="stat-card-sub">${_fmtATS(ats.away)}</div>
      </div>
    </div>`;

  /* --- O/U Record subsection --- */
  const ouPushNote = ou.pushes > 0
    ? `${ou.pushes} push${ou.pushes !== 1 ? 'es' : ''}`
    : 'No pushes';

  const ouCards = `
    <hr class="section-divider">
    <h3 class="school-section-title">Over / Under Record</h3>
    <div class="stat-cards-row">
      <div class="stat-card">
        <div class="stat-card-title">Overs</div>
        <div class="stat-card-value">${ou.overs}</div>
        <div class="stat-card-sub">${ouPushNote}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">Unders</div>
        <div class="stat-card-value">${ou.unders}</div>
        <div class="stat-card-sub">${ouPushNote}</div>
      </div>
    </div>`;

  /* --- Home Underdog ATS subsection — skipped if null --- */
  let underdogSection = '';
  if (homeUnderdog !== null) {
    underdogSection = `
      <hr class="section-divider">
      <h3 class="school-section-title">Home Underdog ATS</h3>
      <div class="stat-cards-row">
        <div class="stat-card">
          <div class="stat-card-title">ATS as Home Underdog</div>
          <div class="stat-card-value">${homeUnderdog.wins}-${homeUnderdog.losses}</div>
          <div class="stat-card-sub">${homeUnderdog.total} home underdog situation${homeUnderdog.total !== 1 ? 's' : ''}</div>
        </div>
      </div>`;
  }

  /* --- Cover Streaks subsection --- */
  const streakCards = `
    <hr class="section-divider">
    <h3 class="school-section-title">Cover Streaks</h3>
    <div class="stat-cards-row">
      <div class="stat-card">
        <div class="stat-card-title">Best Cover Streak</div>
        <div class="stat-card-value">${streaks.bestStreak}</div>
        <div class="stat-card-sub">Consecutive ATS covers</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">Worst Non-Cover Streak</div>
        <div class="stat-card-value">${streaks.worstStreak}</div>
        <div class="stat-card-sub">Consecutive ATS non-covers</div>
      </div>
    </div>`;

  return atsCards + ouCards + underdogSection + streakCards;
}

/* =============================================================
   DOM Helpers
   ============================================================= */

/* Replaces a section's inner HTML by element id.
   No-ops silently if the element has been removed (e.g. user
   navigated away before the fetch resolved). */
function setSection(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

/* Generic loading placeholder rendered into each skeleton slot */
function loadingHTML() {
  return '<div class="loading-placeholder">Loading\u2026</div>';
}

/* Inline error shown inside a section when a fetch fails */
function errorHTML(msg) {
  return `<div class="section-error">${msg}</div>`;
}

/* =============================================================
   Data Derivation Helpers
   Convert raw CFBD arrays into display-ready value objects.
   ============================================================= */

/* ----------------------------------------------------------
   _completedGames
   Filters out games that have not been played yet
   (CFBD returns null scores for scheduled future games).
   ---------------------------------------------------------- */
function _completedGames(games) {
  return games.filter(function (g) {
    return g.homePoints !== null && g.homePoints !== undefined &&
           g.awayPoints !== null && g.awayPoints !== undefined;
  });
}

/* ----------------------------------------------------------
   _deriveSnapshotData
   Calculates the four Season Snapshot values from the
   completed games array and the final AP poll rank.

   @param {string}      school    — CFBD team name
   @param {Array}       completed — output of _completedGames()
   @param {number|null} rank      — AP rank, or null if unranked
   @returns {{ record, rank, avgMargin, ppg }}
   ---------------------------------------------------------- */
function _deriveSnapshotData(school, completed, rank) {
  let wins = 0, losses = 0, totalPts = 0, totalMargin = 0;

  completed.forEach(function (g) {
    const isHome    = g.homeTeam === school;
    const teamPts   = isHome ? g.homePoints : g.awayPoints;
    const oppPts    = isHome ? g.awayPoints  : g.homePoints;
    const margin    = teamPts - oppPts;

    totalPts    += teamPts;
    totalMargin += margin;
    if (margin > 0) wins++; else losses++;
  });

  const n         = completed.length;
  const avgMargin = n > 0 ? totalMargin / n : 0;
  const ppg       = n > 0 ? totalPts    / n : 0;

  return {
    record:    `${wins}-${losses}`,
    rank:      rank ? `#${rank} AP` : 'Unranked',
    avgMargin: n > 0 ? (avgMargin >= 0 ? '+' : '') + avgMargin.toFixed(1) : '\u2014',
    ppg:       n > 0 ? ppg.toFixed(1) : '\u2014',
  };
}

/* ----------------------------------------------------------
   _deriveLastGame
   Returns the most recent completed game as a display object
   for the Last Game card, including ATS and O/U when available.

   @param {string} school    — CFBD team name
   @param {Array}  completed — output of _completedGames()
   @param {Array}  lines     — from fetchGameLines()
   @returns {Object|null}
   ---------------------------------------------------------- */
function _deriveLastGame(school, completed, lines) {
  if (completed.length === 0) return null;

  /* Sort by start date ascending — last entry is most recent */
  const sorted = completed.slice().sort(function (a, b) {
    return new Date(a.startDate) - new Date(b.startDate);
  });
  const game = sorted[sorted.length - 1];

  const isHome    = game.homeTeam === school;
  const teamScore = isHome ? game.homePoints : game.awayPoints;
  const oppScore  = isHome ? game.awayPoints  : game.homePoints;
  const margin    = teamScore - oppScore;
  const opponent  = isHome ? game.awayTeam  : game.homeTeam;

  /* Game label: bowl name if CFBD provides notes, else Week N */
  let gameLabel;
  if (game.notes) {
    gameLabel = game.notes;
  } else if (game.seasonType === 'postseason') {
    gameLabel = 'Postseason';
  } else {
    gameLabel = `Week ${game.week}`;
  }

  /* ATS and O/U are both optional — only shown when line data exists */
  let ats = 'No line';
  let ou  = null;

  const lineEntry = (lines || []).find(function (l) { return l.id === game.id; });
  if (lineEntry && Array.isArray(lineEntry.lines) && lineEntry.lines.length > 0) {
    const consensus = lineEntry.lines.find(function (l) { return l.provider === 'consensus'; })
                   || lineEntry.lines[0];

    if (consensus && consensus.spread !== null && consensus.spread !== '') {
      const spreadNum  = parseFloat(consensus.spread);
      if (!isNaN(spreadNum)) {
        const teamSpread = isHome ? spreadNum : -spreadNum;
        const atsResult  = margin + teamSpread;
        const spreadAbs  = Math.abs(teamSpread).toFixed(1);
        const spreadFmt  = teamSpread < 0 ? `-${spreadAbs}` : `+${spreadAbs}`;

        if (Math.abs(atsResult) < 0.01) {
          ats = `Push (${spreadFmt})`;
        } else if (atsResult > 0) {
          ats = `Covered (${spreadFmt})`;
        } else {
          ats = `Lost ATS (${spreadFmt})`;
        }
      }
    }

    if (consensus && consensus.overUnder !== null && consensus.overUnder !== '') {
      const ouNum = parseFloat(consensus.overUnder);
      if (!isNaN(ouNum)) {
        const totalPts = game.homePoints + game.awayPoints;
        const ouFmt    = ouNum.toFixed(1);
        if (Math.abs(totalPts - ouNum) < 0.01) {
          ou = `Push ${totalPts} (${ouFmt})`;
        } else if (totalPts > ouNum) {
          ou = `O ${totalPts} (${ouFmt})`;
        } else {
          ou = `U ${totalPts} (${ouFmt})`;
        }
      }
    }
  }

  return {
    result:   margin > 0 ? 'W' : 'L',
    score:    `${teamScore}-${oppScore}`,
    opponent,
    game:     gameLabel,
    ats,
    ou,
  };
}

/* ----------------------------------------------------------
   _deriveNextGame
   Returns the next scheduled but unplayed game as a display
   object for the Next Game card. Returns null in the offseason.

   @param {string} school — CFBD team name
   @param {Array}  games  — full games array (played + unplayed)
   @param {Array}  lines  — from fetchGameLines()
   @returns {Object|null}
   ---------------------------------------------------------- */
function _deriveNextGame(school, games, lines) {
  /* Upcoming = games where scores have not been posted yet */
  const upcoming = games.filter(function (g) {
    return g.homePoints === null || g.homePoints === undefined ||
           g.awayPoints === null || g.awayPoints === undefined;
  });

  if (upcoming.length === 0) return null;

  upcoming.sort(function (a, b) {
    return new Date(a.startDate) - new Date(b.startDate);
  });
  const game = upcoming[0];

  const isHome   = game.homeTeam === school;
  const opponent = isHome ? game.awayTeam : game.homeTeam;

  const date = new Date(game.startDate).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

  let location;
  if (game.neutralSite) {
    location = 'Neutral Site';
  } else if (isHome) {
    location = 'Home';
  } else {
    location = 'Away';
  }

  /* Spread — optional, shown only if a line is available */
  let spread = null;
  const lineEntry = (lines || []).find(function (l) { return l.id === game.id; });
  if (lineEntry && Array.isArray(lineEntry.lines) && lineEntry.lines.length > 0) {
    const consensus = lineEntry.lines.find(function (l) { return l.provider === 'consensus'; })
                   || lineEntry.lines[0];
    if (consensus && consensus.spread !== null && consensus.spread !== '') {
      const spreadNum  = parseFloat(consensus.spread);
      if (!isNaN(spreadNum)) {
        const teamSpread = isHome ? spreadNum : -spreadNum;
        const spreadFmt  = teamSpread < 0
          ? teamSpread.toFixed(1)
          : `+${teamSpread.toFixed(1)}`;
        spread = consensus.overUnder
          ? `${spreadFmt} \u00b7 O/U ${consensus.overUnder}`
          : spreadFmt;
      }
    }
  }

  return { opponent, date, location, spread };
}

/* ----------------------------------------------------------
   _deriveIdentity
   Merges live API data (conference, coach) over the static
   Texas identity object. Phase 9 will replace the static base
   with data read from schools.json.

   @param {Object|null} teamInfo  — from fetchTeamInfo()
   @param {Object|null} coachInfo — from fetchCoachInfo()
   @returns {Object} — ready for renderIdentityCard()
   ---------------------------------------------------------- */
function _deriveIdentity(teamInfo, coachInfo) {
  /* Base from schools.json — falls back to Texas defaults if fetch failed */
  const src  = _schoolData || {};
  const data = {
    displayName:  src.name        || 'Texas Longhorns',
    conference:   src.conference  || 'SEC',
    stadium:      src.stadium     || '\u2014',
    capacity:     src.stadiumCapacity ? src.stadiumCapacity.toLocaleString() : '\u2014',
    city:         src.city && src.state ? `${src.city}, ${src.state}` : (src.city || '\u2014'),
    founded:      src.founded     || '\u2014',
    enrollment:   src.enrollment  ? src.enrollment.toLocaleString() : '\u2014',
    coachSalary:  src.coachSalary != null ? '$' + src.coachSalary.toLocaleString() : 'N/A (Private)',
    lat:          src.lat         || 30.2838,
    lng:          src.lng         || -97.7326,
    coach:        '\u2014',
    coachSeason:  '',
    coachRecord:  '',
  };

  /* Live API overwrites conference and coach fields */
  if (teamInfo && teamInfo.conference) {
    data.conference = teamInfo.conference;
  }

  /* coachOverride — same name-match used in renderCoachingContinuity.
     If present, it wins; CFBD coachInfo is never read for these schools. */
  const overrideEntry = (SCHOOLS_DATA.teams || []).find(function (t) {
    return t.name.replace(t.mascot || '', '').trim() === SCHOOL_NAME;
  });
  if (overrideEntry && overrideEntry.coachOverride) {
    const ov = overrideEntry.coachOverride;
    data.coachSalary = ov.salary != null ? '$' + Number(ov.salary).toLocaleString('en-US') : 'N/A';
    data.coach       = ov.name;
    data.coachSeason = ov.interim ? `Since ${ov.hireYear} \u00b7 Interim` : `Since ${ov.hireYear}`;
    return data;
  }

  if (coachInfo) {
    data.coach       = coachInfo.name;
    data.coachSeason = `${coachInfo.seasons} season${coachInfo.seasons !== 1 ? 's' : ''}`;
    data.coachRecord = coachInfo.record;
  }

  return data;
}

/* =============================================================
   Page Structure Builders
   ============================================================= */

/* ----------------------------------------------------------
   renderSidebar
   Builds the lens nav HTML. Overview is active by default.
   onclick calls the global toggleSection() directly.
   ---------------------------------------------------------- */
function renderSidebar() {
  const navHTML = SECTIONS.map(function (section) {
    const activeClass = section.id === 'overview' ? ' active' : '';
    return `
      <div class="lens-nav-item${activeClass}"
           data-section="${section.id}"
           onclick="toggleSection('${section.id}')">
        ${section.label}
      </div>`;
  }).join('');

  return `<nav class="school-sidebar">${navHTML}</nav>`;
}

/* ----------------------------------------------------------
   renderOverview
   Returns the Overview section with loading skeletons in each
   slot. loadData() replaces each slot with real HTML once
   the fetch calls resolve.
   ---------------------------------------------------------- */
function renderOverview() {
  return `
    <div class="school-section is-active" data-section="overview">
      <div id="school-dna">${loadingHTML()}</div>
      <div id="school-snapshot">${loadingHTML()}</div>
      <div id="school-game-cards">${loadingHTML()}</div>
      <div id="school-identity">${loadingHTML()}</div>
    </div>`;
}

/* ----------------------------------------------------------
   renderGameControlSection
   Returns the Game Control section wrapper with an inner
   content slot. loadData() targets 'game-control-content'
   via setSection() once compute data is ready.
   ---------------------------------------------------------- */
function renderGameControlSection() {
  return `
    <div class="school-section" data-section="game-control">
      <div id="game-control-content">${loadingHTML()}</div>
    </div>`;
}

/* ----------------------------------------------------------
   renderVolatilitySection
   Returns the Volatility section wrapper with an inner
   content slot. loadData() targets 'volatility-content'
   via setSection() once compute data is ready.
   ---------------------------------------------------------- */
function renderVolatilitySection() {
  return `
    <div class="school-section" data-section="volatility">
      <div id="volatility-content">${loadingHTML()}</div>
    </div>`;
}

/* ----------------------------------------------------------
   renderSituationalSection
   Returns the Situational section wrapper with an inner
   content slot. loadData() targets 'situational-content'
   via setSection() once compute data is ready.
   ---------------------------------------------------------- */
function renderSituationalSection() {
  return `
    <div class="school-section" data-section="situational">
      <div id="situational-content">${loadingHTML()}</div>
    </div>`;
}

/* ----------------------------------------------------------
   renderMarketSection
   Returns the Market Performance section wrapper with an
   inner content slot. loadData() targets 'market-content'
   via setSection() once compute data is ready.
   ---------------------------------------------------------- */
function renderMarketSection() {
  return `
    <div class="school-section" data-section="market">
      <div id="market-content">${loadingHTML()}</div>
    </div>`;
}

/* ----------------------------------------------------------
   renderH2HSection
   Returns the H2H Search section wrapper.
   Team 1 is pre-filled with the current school (read from
   SCHOOLS_DATA directly — available synchronously before
   loadData() fires). Team 2 is a live-filtered search input.
   Results are injected into #h2h-results by _loadH2HData().
   ---------------------------------------------------------- */
function renderH2HSection() {
  const team1Entry       = (SCHOOLS_DATA.teams || []).find(function (t) { return t.id === SCHOOL_ID; });
  const team1DisplayName = team1Entry ? team1Entry.name : SCHOOL_NAME;

  return `
    <div class="school-section" data-section="h2h">
      <h2 class="school-section-title">H2H Search</h2>

      <!-- Team selector row — Team 1 is locked, Team 2 is searchable -->
      <div class="h2h-selector">
        <div class="h2h-team">
          <div class="h2h-team-label">Team 1</div>
          <div class="h2h-team-name">${team1DisplayName}</div>
        </div>
        <div class="h2h-vs">vs</div>
        <div class="h2h-team">
          <div class="h2h-team-label">Team 2</div>
          <div class="h2h-search-wrap">
            <input
              id="h2h-search-input"
              class="h2h-search-input"
              type="text"
              placeholder="Search opponent\u2026"
              autocomplete="off"
            />
            <div class="h2h-dropdown" id="h2h-dropdown"></div>
          </div>
        </div>
      </div>

      <!-- Results injected here after both teams are selected -->
      <div id="h2h-results"></div>

    </div>`;
}

/* ----------------------------------------------------------
   renderCampusMapSection
   Returns the Campus Map section wrapper. Contains:
     - An inline map div (340px tall) showing the stadium pin
     - An expand button that opens .campus-map-modal
     - A modal overlay with a larger map instance
   _initCampusMap() is called by _loadCampusMap() after the
   DOM is ready, so the Leaflet maps mount into real elements.
   ---------------------------------------------------------- */
function renderCampusMapSection() {
  return `
    <div class="school-section" data-section="campus-map">
      <h2 class="school-section-title">Campus Map</h2>

      <!-- Inline mini-map -->
      <div class="campus-map-wrap">
        <div class="campus-map-el" id="campus-map-inline"></div>
        <button class="campus-map-expand-btn" onclick="_openMapModal()">
          View Full Map
        </button>
      </div>

      <!-- Full-screen modal map -->
      <div class="campus-map-modal" id="campus-map-modal">
        <div class="campus-map-modal-inner">
          <button class="campus-map-modal-close" onclick="_closeMapModal()" aria-label="Close map">&times;</button>
          <div class="campus-map-modal-el" id="campus-map-modal-el"></div>
        </div>
      </div>

    </div>`;
}

/* ----------------------------------------------------------
   renderLongTermSection
   Returns the Long-Term Strength section wrapper. Contains five
   independent content slots, each seeded with a loading state.
   _loadLongTermStrengthData() replaces each slot's content
   asynchronously as fetches resolve.

   Slots:
     longterm-rankings  — Rankings History (last 3 seasons)
     longterm-draft     — NFL Draft Production (last 5 years)
     longterm-coaching  — Coaching Continuity (history table)
     longterm-bowl      — Bowl Game History (all-time)
     longterm-record    — Long-Term Record (10-year W/L)
   ---------------------------------------------------------- */
function renderLongTermSection() {
  const loading = loadingHTML();
  return `
    <div class="school-section" data-section="longterm">
      <h2 class="school-section-title">Long-Term Strength</h2>

      <h3 class="school-section-title">Rankings History</h3>
      <div id="longterm-rankings">${loading}</div>

      <hr class="section-divider">
      <h3 class="school-section-title">NFL Draft Production</h3>
      <div id="longterm-draft">${loading}</div>

      <hr class="section-divider">
      <h3 class="school-section-title">Coaching Continuity</h3>
      <div id="longterm-coaching">${loading}</div>

      <hr class="section-divider">
      <h3 class="school-section-title">Bowl Game History</h3>
      <div id="longterm-bowl">${loading}</div>

      <hr class="section-divider">
      <h3 class="school-section-title">Long-Term Record (2015\u20132025)</h3>
      <div id="longterm-record">${loading}</div>

    </div>`;
}

/* ----------------------------------------------------------
   renderScheduleSection
   Returns the Schedule section shell with a single loading
   slot. _loadScheduleData() fills it once the fetch resolves.
   ---------------------------------------------------------- */
function renderScheduleSection() {
  return `
    <div class="school-section" data-section="schedule">
      <h2 class="school-section-title">Schedule &mdash; ${SCHEDULE_YEAR}</h2>
      <div id="schedule-content">${loadingHTML()}</div>
    </div>`;
}

/* ----------------------------------------------------------
   renderPlaceholderSection
   Dashed placeholder for sections not yet built out.
   ---------------------------------------------------------- */
function renderPlaceholderSection(section) {
  return `
    <div class="school-section" data-section="${section.id}">
      <h2 class="school-section-title">${section.label}</h2>
      <div class="section-placeholder">
        <div class="section-placeholder-label">${section.label}</div>
        <div class="section-placeholder-note">Coming in Phase ${section.phase}</div>
      </div>
    </div>`;
}

/* ----------------------------------------------------------
   renderSections
   Overview gets a skeleton; Game Control, Volatility,
   Situational, and Market get content slots; all others
   get a placeholder.
   ---------------------------------------------------------- */
function renderSections() {
  return SECTIONS.map(function (section) {
    if (section.id === 'overview')     return renderOverview();
    if (section.id === 'game-control') return renderGameControlSection();
    if (section.id === 'volatility')   return renderVolatilitySection();
    if (section.id === 'situational')  return renderSituationalSection();
    if (section.id === 'market')       return renderMarketSection();
    if (section.id === 'campus-map')   return renderCampusMapSection();
    if (section.id === 'h2h')          return renderH2HSection();
    if (section.id === 'longterm')     return renderLongTermSection();
    if (section.id === 'schedule')    return renderScheduleSection();
    return renderPlaceholderSection(section);
  }).join('');
}

/* =============================================================
   SchoolPage
   Public interface consumed by router.js via SchoolPage.render().
   render() returns the page shell synchronously and queues
   loadData() so it fires after the router sets innerHTML.
   ============================================================= */
const SchoolPage = {

  /* ----------------------------------------------------------
     render
     Returns the full page skeleton and schedules loadData()
     via microtask so it fires after the router sets innerHTML.
     Phase 11 will use params.id to select a school dynamically.
     ---------------------------------------------------------- */
  render(params = {}) {
    /* Resolve the active school from the URL param.
       Falls back to Texas if no team param is present. */
    SCHOOL_NAME = (params.team && params.team.trim()) ? params.team.trim() : 'Texas';
    SCHOOL_ID   = _schoolIdFromCfbd(SCHOOL_NAME);

    /* Reset H2H state — new DOM, new event bindings needed */
    _h2hSearchInitialized = false;

    const displayName = _schoolDisplayName(SCHOOL_NAME);

    Promise.resolve().then(function () { SchoolPage.loadData(); });

    return `
      <div class="page-school">

        <!-- Hero band: school name, conference, season, live record.
             Conference and record are updated by loadData(). -->
        <div class="school-hero">
          <div class="school-header">
            <div class="school-header-name">${displayName}</div>
            <div class="school-header-meta">
              <span class="school-header-conf" id="school-hero-conf">SEC &middot; ${SCHOOL_YEAR}</span>
              <span class="school-header-record" id="school-hero-record">\u2014</span>
            </div>
          </div>
        </div>

        <!-- Two-column layout: lens nav sidebar + section content area -->
        <div class="school-layout">
          ${renderSidebar()}
          <div class="school-main">
            ${renderSections()}
          </div>
        </div>

      </div>`;
  },

  /* ----------------------------------------------------------
     loadData
     Fires all fetch calls concurrently via Promise.allSettled,
     unwraps results, then delegates rendering to two helpers:
       _loadOverviewData  — hero, DNA, snapshot, game cards, identity
       _loadAnalyticsData — coordinates Game Control, Volatility,
                            Situational, Market Performance
     A failed fetch never crashes the page — each section falls
     back to a safe empty value and updates independently.
     ---------------------------------------------------------- */
  async loadData() {
    /* Load static school data from SCHOOLS_DATA global (data/schools.js).
       Using a global avoids fetch() CORS failures on file:// origins. */
    try {
      _schoolData = (SCHOOLS_DATA.teams || []).find(function (t) { return t.id === SCHOOL_ID; }) || null;
    } catch (e) {
      _schoolData = null;
    }

    const [gamesResult, rankResult, linesResult, coachResult, teamResult, priorGamesResult] =
      await Promise.allSettled([
        fetchSeasonRecord(SCHOOL_NAME, SCHOOL_YEAR),
        fetchFinalRank(SCHOOL_NAME, SCHOOL_YEAR),
        fetchGameLines(SCHOOL_NAME, SCHOOL_YEAR),
        fetchCoachInfo(SCHOOL_NAME, SCHOOL_YEAR),
        fetchTeamInfo(SCHOOL_NAME),
        fetchSeasonRecord(SCHOOL_NAME, SCHOOL_YEAR - 1),
      ]);

    /* Unwrap — each failure falls back to a safe empty default */
    const games      = gamesResult.status      === 'fulfilled' ? gamesResult.value      : [];
    const rank       = rankResult.status       === 'fulfilled' ? rankResult.value       : null;
    const lines      = linesResult.status      === 'fulfilled' ? linesResult.value      : [];
    const coachInfo  = coachResult.status      === 'fulfilled' ? coachResult.value      : null;
    const teamInfo   = teamResult.status       === 'fulfilled' ? teamResult.value       : null;
    const priorGames = priorGamesResult.status === 'fulfilled' ? priorGamesResult.value : [];

    const completed      = _completedGames(games);
    const priorCompleted = _completedGames(priorGames);
    const hasGames       = completed.length > 0;

    /* Apply live CFBD team colors before any section renders.
       Must run before _loadAnalyticsData so _loadCampusMap reads
       the correct --school-primary value for the map pin.
       Falls back to restoreTheme() values (already applied by the
       router) if teamInfo is null or fetchTeamInfo failed. */
    if (teamInfo) {
      applyThemeFromTeam(teamInfo);
    }

    _loadOverviewData(games, completed, hasGames, rank, lines, teamInfo, coachInfo);
    _loadAnalyticsData(completed, hasGames, lines, priorCompleted);
    _loadLongTermStrengthData();
    _loadScheduleData();
  },

};

/* =============================================================
   Data Load Helpers
   Called by SchoolPage.loadData() after fetches resolve.
   Kept outside SchoolPage object so they stay flat and readable.
   ============================================================= */

/* ----------------------------------------------------------
   _loadOverviewData
   Renders hero band, DNA, snapshot, game cards, and identity.
   Covers everything visible on the Overview lens.
   ---------------------------------------------------------- */
function _loadOverviewData(games, completed, hasGames, rank, lines, teamInfo, coachInfo) {
  /* --- Hero meta band --- */
  const fallbackConf = _schoolData ? _schoolData.conference : 'SEC';
  const conf         = teamInfo ? (teamInfo.conference || fallbackConf) : fallbackConf;
  const snapshot = hasGames ? _deriveSnapshotData(SCHOOL_NAME, completed, rank) : null;

  const heroConf   = document.getElementById('school-hero-conf');
  const heroRecord = document.getElementById('school-hero-record');
  if (heroConf)   heroConf.textContent   = `${conf} \u00b7 ${SCHOOL_YEAR}`;
  if (heroRecord) heroRecord.textContent = snapshot ? snapshot.record : '\u2014';

  /* --- Program DNA --- */
  const { labels, note } = computeDNA(SCHOOL_NAME, games, lines);
  setSection('school-dna', renderDNACard(labels, note));

  /* --- Season Snapshot --- */
  setSection('school-snapshot', hasGames
    ? renderSnapshotRow(snapshot)
    : errorHTML('Could not load game data.'));

  /* --- Last Game / Next Game --- */
  setSection('school-game-cards', hasGames
    ? renderGameCards(
        _deriveLastGame(SCHOOL_NAME, completed, lines),
        _deriveNextGame(SCHOOL_NAME, games,     lines)
      )
    : errorHTML('Could not load game data.'));

  /* --- School Identity --- */
  setSection('school-identity', renderIdentityCard(_deriveIdentity(teamInfo, coachInfo)));
}

/* ----------------------------------------------------------
   _loadGameControlData
   Renders Game Control and Volatility lenses (Phase 6).
   @param {Array} completed — current season completed games
   ---------------------------------------------------------- */
function _loadGameControlData(completed) {
  /* --- Game Control --- */
  const blowout   = computeBlowoutProfile(completed, SCHOOL_NAME);
  const halfScore = computeHalfScoring(completed, SCHOOL_NAME);
  const closeGame = computeCloseGameRecord(completed, SCHOOL_NAME);
  setSection('game-control-content',
    renderGameControl({ blowout, halfScore, closeGame }));

  /* --- Volatility --- */
  const diffs       = computeScoreDifferentials(completed, SCHOOL_NAME);
  const consistency = computeConsistencyRating(completed, SCHOOL_NAME);
  const trapGame    = computeTrapGameIndex(completed, SCHOOL_NAME);
  const extremes    = computeLargestWinLoss(completed, SCHOOL_NAME);
  setSection('volatility-content',
    renderVolatility({ consistency, diffs, trapGame, extremes }));
}

/* ----------------------------------------------------------
   _loadSituationalData
   Renders Situational lens (Phase 7).
   @param {Array} completed      — current season completed games
   @param {Array} priorCompleted — prior season completed games
   ---------------------------------------------------------- */
function _loadSituationalData(completed, priorCompleted) {
  const splits   = computeHomeAwaySplits(completed, SCHOOL_NAME);
  const night    = computeNightGameRecord(completed, SCHOOL_NAME);
  const revenge  = computeRevengeGames(completed, priorCompleted, SCHOOL_NAME);
  const vsRanked = computeRecordVsRanked(completed, SCHOOL_NAME);
  setSection('situational-content',
    renderSituational({ splits, night, revenge, vsRanked }));
}

/* ----------------------------------------------------------
   _loadMarketData
   Renders Market Performance lens (Phase 7).
   @param {Array} completed — current season completed games
   @param {Array} lines     — fetchGameLines() output
   ---------------------------------------------------------- */
function _loadMarketData(completed, lines) {
  const ats          = computeATSRecord(completed, lines, SCHOOL_NAME);
  const ou           = computeOURecord(completed, lines);
  const homeUnderdog = computeHomeUnderdogATS(completed, lines, SCHOOL_NAME);
  const streaks      = computeCoverStreaks(completed, lines, SCHOOL_NAME);
  setSection('market-content',
    renderMarketPerformance({ ats, ou, homeUnderdog, streaks }));
}

/* =============================================================
   Phase 12 — Long-Term Strength Render Helpers
   Each function takes processed data and returns an HTML string.
   Called by _loadLongTermStrengthData() subsection IIFEs.
   ============================================================= */

/* ----------------------------------------------------------
   _extractAPRankings
   Internal helper. Given a weekly rankings array and a school
   name, returns { peakRank, weeksRanked, lastRank } for AP Top 25.

   @param {Array}  weeklyData — output of fetchRegularRankings()
   @param {string} school     — CFBD school name, e.g. 'Texas'
   @returns {{ peakRank: number|null, weeksRanked: number, lastRank: number|null }}
   ---------------------------------------------------------- */
function _extractAPRankings(weeklyData, school) {
  let peakRank = null;
  let weeksRanked = 0;
  let lastRank = null;

  (weeklyData || []).forEach(function (weekEntry) {
    const apPoll = (weekEntry.polls || []).find(function (p) { return p.poll === 'AP Top 25'; });
    if (!apPoll) return;
    const entry = (apPoll.ranks || []).find(function (r) { return r.school === school; });
    if (!entry) return;
    weeksRanked++;
    if (peakRank === null || entry.rank < peakRank) peakRank = entry.rank;
    lastRank = entry.rank;
  });

  return { peakRank, weeksRanked, lastRank };
}

/* ----------------------------------------------------------
   renderRankingsHistory
   Builds the Rankings History subsection. Three rows, one per
   season (2023–2025). Each row shows peak rank, final rank,
   and weeks ranked. Unranked seasons show a clean label.

   @param {Array} seasons — array of { year, weeklyData, finalRank }
                           where weeklyData is the regular-season
                           rankings array and finalRank is the
                           postseason final rank (may be null)
   @returns {string} HTML string
   ---------------------------------------------------------- */
function renderRankingsHistory(seasons) {
  const rows = seasons.map(function (s) {
    const { peakRank, weeksRanked, lastRank } = _extractAPRankings(s.weeklyData, SCHOOL_NAME);

    /* Use postseason final rank if available, else last regular-season rank */
    const displayFinal = s.finalRank !== null ? s.finalRank : lastRank;

    if (peakRank === null) {
      return `
        <div class="rankings-row">
          <div class="rankings-row-year">${s.year}</div>
          <div class="rankings-row-stats">
            <span class="rankings-unranked">Unranked</span>
          </div>
        </div>`;
    }

    return `
      <div class="rankings-row">
        <div class="rankings-row-year">${s.year}</div>
        <div class="rankings-row-stats">
          <span class="rankings-peak">Peak: #${peakRank}</span>
          <span class="rankings-sep">&middot;</span>
          <span class="rankings-final">Final: ${displayFinal !== null ? '#' + displayFinal : '\u2014'}</span>
          <span class="rankings-sep">&middot;</span>
          <span class="rankings-weeks">${weeksRanked} week${weeksRanked !== 1 ? 's' : ''} ranked</span>
        </div>
      </div>`;
  }).join('');

  return `<div class="rankings-history">${rows}</div>`;
}

/* ----------------------------------------------------------
   renderDraftProduction
   Builds the NFL Draft Production subsection. One stat card per
   year for 2015–2025 (11 cards). Cards with picks are clickable
   and toggle a player drawer via _toggleDraftDrawer(). Cards with
   zero picks are not clickable and show no chevron.

   Pick data is written to window._draftPicksData so the drawer
   toggle function can access it without re-fetching.

   @param {Array} picks — raw output of fetchDraftPicks()
   @returns {string} HTML string
   ---------------------------------------------------------- */
function renderDraftProduction(picks) {
  const START_YEAR = 2015;
  const END_YEAR   = 2025;

  /* Filter to only this school's picks — the API may return all picks
     regardless of the college parameter, so guard client-side. */
  const schoolPicks = (picks || []).filter(function (p) {
    return p.college === SCHOOL_NAME || p.collegeTeam === SCHOOL_NAME;
  });

  /* Group picks by year and expose to _toggleDraftDrawer via window scope */
  window._draftPicksData = {};
  const byYear = {};
  for (let y = START_YEAR; y <= END_YEAR; y++) {
    byYear[y] = [];
    window._draftPicksData[y] = [];
  }
  schoolPicks.forEach(function (pick) {
    if (pick.year >= START_YEAR && pick.year <= END_YEAR) {
      byYear[pick.year].push(pick);
      window._draftPicksData[pick.year].push(pick);
    }
  });

  /* Build year cards */
  const cards = [];
  for (let y = START_YEAR; y <= END_YEAR; y++) {
    const yearPicks = byYear[y];
    const total     = yearPicks.length;

    /* Round breakdown: count picks per round, display inline */
    const roundCounts = {};
    yearPicks.forEach(function (p) {
      const r = p.round || '?';
      roundCounts[r] = (roundCounts[r] || 0) + 1;
    });
    const roundStr = Object.keys(roundCounts)
      .sort(function (a, b) { return Number(a) - Number(b); })
      .map(function (r) { return `${roundCounts[r]} R${r}`; })
      .join(' \u00b7 ');

    if (total > 0) {
      /* Clickable card — chevron rotates when drawer is open */
      cards.push(`
        <div class="stat-card draft-card draft-card--clickable"
             onclick="_toggleDraftDrawer(${y})"
             data-year="${y}">
          <div class="stat-card-title">${y} <span class="draft-chevron"></span></div>
          <div class="stat-card-value">${total}</div>
          <div class="stat-card-sub">${roundStr}</div>
        </div>`);
    } else {
      /* Non-clickable — no picks this year */
      cards.push(`
        <div class="stat-card draft-card">
          <div class="stat-card-title">${y}</div>
          <div class="stat-card-value">0</div>
          <div class="stat-card-sub">No picks</div>
        </div>`);
    }
  }

  /* 11-year summary */
  const totalAll = schoolPicks.filter(function (p) {
    return p.year >= START_YEAR && p.year <= END_YEAR;
  });
  const r1Count = totalAll.filter(function (p) { return p.round === 1; }).length;
  const summary = `${totalAll.length} picks (${START_YEAR}\u2013${END_YEAR}) \u00b7 ${r1Count} Round 1`;

  return `
    <div class="draft-production-grid">${cards.join('')}</div>
    <div class="draft-drawer-panel" id="draft-drawer-panel"></div>
    <p class="stat-card-note">${summary}</p>`;
}

/* ----------------------------------------------------------
   _toggleDraftDrawer
   Opens or closes the player drawer beneath the draft grid for
   a given draft year. Reads pick data from window._draftPicksData,
   which is populated by renderDraftProduction() when the section
   renders. Only one drawer can be open at a time — clicking a new
   card closes the previously open one automatically.

   @param {number} year — draft year to show, e.g. 2024
   ---------------------------------------------------------- */
function _toggleDraftDrawer(year) {
  const panel    = document.getElementById('draft-drawer-panel');
  const allCards = document.querySelectorAll('.draft-card--clickable');
  if (!panel) return;

  /* If this year's drawer is already open, close it and exit */
  if (panel.dataset.activeYear === String(year) && panel.classList.contains('is-open')) {
    panel.classList.remove('is-open');
    panel.dataset.activeYear = '';
    allCards.forEach(function (c) { c.classList.remove('is-open'); });
    return;
  }

  /* Clear open state on all cards, then mark the active one */
  allCards.forEach(function (c) { c.classList.remove('is-open'); });
  const activeCard = document.querySelector('.draft-card--clickable[data-year="' + year + '"]');
  if (activeCard) activeCard.classList.add('is-open');

  /* Sort picks by overall draft position ascending */
  const picks  = ((window._draftPicksData || {})[year] || []).slice();
  picks.sort(function (a, b) {
    return (a.overall || a.pick || 0) - (b.overall || b.pick || 0);
  });

  /* Build one row per player */
  const rows = picks.map(function (p) {
    const pickNum = p.overall || p.pick || '\u2014';
    const team    = p.nflTeam || p.nfl_team || '\u2014';
    return `
      <div class="draft-player-row">
        <span class="draft-player-name">${p.name || '\u2014'}</span>
        <span class="draft-player-pos">${p.position || '\u2014'}</span>
        <span class="draft-player-pick">R${p.round} \u00b7 Pick ${pickNum}</span>
        <span class="draft-player-team">${team}</span>
      </div>`;
  }).join('');

  panel.innerHTML = rows;
  panel.dataset.activeYear = String(year);
  panel.classList.add('is-open');
}

/* ----------------------------------------------------------
   renderCoachingContinuity
   Builds the Coaching Continuity subsection.

   The very first operation is a direct lookup of the current
   school's entry from SCHOOLS_DATA by SCHOOL_NAME. This is
   independent of the schoolData parameter — it does not trust
   that the caller resolved _schoolData correctly.

   Override path: if coachOverride is present on the entry,
     render Head Coach + Salary cards and return immediately.
     CFBD data is never read, never used.

   CFBD path: no coachOverride — build history from coaches
     array and render current coach card + history table.

   @param {Array|null}  coaches    — fetchAllCoaches() output,
                                     or null for override schools
   @param {Object|null} schoolData — fallback if direct lookup fails
   @returns {string} HTML string
   ---------------------------------------------------------- */
function renderCoachingContinuity(coaches, schoolData) {
  /* Direct lookup from SCHOOLS_DATA — source of truth for coachOverride.
     Falls back to the passed-in schoolData if the name match fails. */
  const entry = (SCHOOLS_DATA.teams || []).find(function (t) {
    return t.name.replace(t.mascot || '', '').trim() === SCHOOL_NAME;
  }) || schoolData || null;

  /* ── Override check — first line of logic, always runs ─────────────── */
  if (entry && entry.coachOverride) {
    const ov     = entry.coachOverride;
    const salary = ov.salary != null
      ? '$' + Number(ov.salary).toLocaleString('en-US')
      : 'N/A';
    const sub = ov.interim
      ? `Since ${ov.hireYear} \u00b7 Interim`
      : `Since ${ov.hireYear}`;
    return `
      <div class="stat-cards-row">
        <div class="stat-card">
          <div class="stat-card-title">Head Coach</div>
          <div class="stat-card-value">${ov.name}</div>
          <div class="stat-card-sub">${sub}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-title">Coach Salary</div>
          <div class="stat-card-value">${salary}</div>
          <div class="stat-card-sub">Annual (public records)</div>
        </div>
      </div>`;
  }

  /* ── CFBD path — only reached when no coachOverride exists ─────────── */
  if (!Array.isArray(coaches) || coaches.length === 0) {
    return errorHTML('Coaching history data unavailable.');
  }

  const HISTORY_START = 1995;

  /* Build a flat list of { name, startYear, endYear, wins, losses, bestRank } */
  const history = [];
  coaches.forEach(function (coach) {
    const schoolSeasons = (coach.seasons || [])
      .filter(function (s) { return s.school === SCHOOL_NAME && s.year >= HISTORY_START; })
      .sort(function (a, b) { return a.year - b.year; });

    if (schoolSeasons.length === 0) return;

    const wins   = schoolSeasons.reduce(function (sum, s) { return sum + (s.wins   || 0); }, 0);
    const losses = schoolSeasons.reduce(function (sum, s) { return sum + (s.losses || 0); }, 0);
    const startY = schoolSeasons[0].year;
    const endY   = schoolSeasons[schoolSeasons.length - 1].year;
    const name   = `${coach.firstName || ''} ${coach.lastName || ''}`.trim();

    /* Best postseason AP rank during this coach's tenure — lower is better */
    const postRanks = schoolSeasons
      .map(function (s) { return s.postseasonRank; })
      .filter(function (r) { return r !== null && r !== undefined; });
    const bestRank = postRanks.length > 0 ? Math.min.apply(null, postRanks) : null;

    history.push({ name, startYear: startY, endYear: endY, wins, losses, bestRank });
  });

  /* Sort newest-first */
  history.sort(function (a, b) { return b.endYear - a.endYear; });

  const current = history[0] || null;

  /* Salary from SCHOOLS_DATA entry — private schools show N/A */
  const rawSalary = entry && entry.coachSalary ? entry.coachSalary : null;
  let salary;
  if (!rawSalary) {
    salary = 'N/A';
  } else {
    const n = Number(rawSalary);
    salary = isNaN(n) ? String(rawSalary) : '$' + n.toLocaleString('en-US');
  }

  /* Current coach card */
  let currentCard = '';
  if (current) {
    const tenure = SCHOOL_YEAR - current.startYear + 1;
    currentCard = `
      <div class="stat-cards-row">
        <div class="stat-card">
          <div class="stat-card-title">Head Coach</div>
          <div class="stat-card-value">${current.name}</div>
          <div class="stat-card-sub">Since ${current.startYear} \u00b7 ${tenure} year${tenure !== 1 ? 's' : ''}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-title">Record at School</div>
          <div class="stat-card-value">${current.wins}\u2013${current.losses}</div>
          <div class="stat-card-sub">${current.startYear}\u2013present</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-title">Coach Salary</div>
          <div class="stat-card-value">${salary}</div>
          <div class="stat-card-sub">Annual (public records)</div>
        </div>
      </div>`;
  }

  /* History table */
  const tableRows = history.map(function (h) {
    const yearRange = h.startYear === h.endYear ? `${h.startYear}` : `${h.startYear}\u2013${h.endYear}`;
    return `
      <tr>
        <td>${h.name}</td>
        <td>${yearRange}</td>
        <td>${h.wins}\u2013${h.losses}</td>
        <td>${h.bestRank !== null ? '#' + h.bestRank : '\u2014'}</td>
      </tr>`;
  }).join('');

  const table = `
    <div class="coach-history-wrap">
      <table class="coach-history-table">
        <thead>
          <tr>
            <th>Coach</th>
            <th>Years</th>
            <th>Record</th>
            <th>Best AP Rank</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;

  return currentCard + table;
}

/* ----------------------------------------------------------
   renderBowlHistory
   Builds the Bowl Game History subsection. Shows all-time W-L
   and the last 10 bowl appearances (newest first).

   @param {Array} allGames — flat array of all postseason game
                            objects collected across years
   @returns {string} HTML string
   ---------------------------------------------------------- */
function renderBowlHistory(allGames) {
  /* Filter to only games involving this school */
  const bowls = (allGames || []).filter(function (g) {
    return g.homeTeam === SCHOOL_NAME || g.awayTeam === SCHOOL_NAME;
  });

  /* Sort newest-first */
  bowls.sort(function (a, b) { return b.season - a.season; });

  if (bowls.length === 0) {
    return '<p class="stat-card-note">No bowl history found.</p>';
  }

  /* All-time W-L */
  let allWins = 0, allLosses = 0;
  bowls.forEach(function (g) {
    const isHome  = g.homeTeam === SCHOOL_NAME;
    const teamPts = isHome ? g.homePoints : g.awayPoints;
    const oppPts  = isHome ? g.awayPoints  : g.homePoints;
    if (teamPts > oppPts) allWins++; else allLosses++;
  });

  /* All-time record card */
  const recordCard = `
    <div class="stat-cards-row">
      <div class="stat-card">
        <div class="stat-card-title">All-Time Bowl Record</div>
        <div class="stat-card-value">${allWins}\u2013${allLosses}</div>
        <div class="stat-card-sub">${bowls.length} appearance${bowls.length !== 1 ? 's' : ''}</div>
      </div>
    </div>`;

  /* Last 10 appearances list */
  const last10 = bowls.slice(0, 10);
  const listRows = last10.map(function (g) {
    const isHome  = g.homeTeam === SCHOOL_NAME;
    const teamPts = isHome ? g.homePoints : g.awayPoints;
    const oppPts  = isHome ? g.awayPoints  : g.homePoints;
    const opp     = isHome ? g.awayTeam    : g.homeTeam;
    const result  = teamPts > oppPts ? 'W' : 'L';
    const bowlName = g.notes || 'Bowl Game';
    return `
      <div class="longterm-year-row">
        <span class="longterm-year-label">${g.season}</span>
        <span class="longterm-year-value">
          <span class="result-badge result-${result.toLowerCase()}">${result}</span>
          ${teamPts}\u2013${oppPts} vs ${opp} \u00b7 ${bowlName}
        </span>
      </div>`;
  }).join('');

  return recordCard + `
    <h4 class="coach-history-subhead">Last ${last10.length} Bowl Appearances</h4>
    <div class="longterm-year-list">${listRows}</div>`;
}

/* ----------------------------------------------------------
   renderLongTermRecord
   Builds the 10-Year Record subsection. Four stat cards plus
   a year-by-year W-L summary list.

   @param {Array} yearEntries — array of { year, wins, losses }
                               for 2015–2025, regular season only
   @returns {string} HTML string
   ---------------------------------------------------------- */
function renderLongTermRecord(yearEntries) {
  /* Sort ascending for year-by-year list; build stats from all entries */
  const sorted = yearEntries.slice().sort(function (a, b) { return a.year - b.year; });

  let totalWins = 0, totalLosses = 0;
  let bestWins = -1, bestYear = null;
  let worstWins = Infinity, worstYear = null;

  sorted.forEach(function (e) {
    totalWins   += e.wins;
    totalLosses += e.losses;
    if (e.wins > bestWins)   { bestWins  = e.wins;   bestYear  = e.year; }
    if (e.wins < worstWins)  { worstWins = e.wins;   worstYear = e.year; }
  });

  const totalGames = totalWins + totalLosses;
  const winPct     = totalGames > 0 ? (totalWins / totalGames * 100).toFixed(1) : '0.0';

  /* Best and worst season entries */
  const bestEntry  = sorted.find(function (e) { return e.year === bestYear;  });
  const worstEntry = sorted.find(function (e) { return e.year === worstYear; });

  const cards = `
    <div class="stat-cards-row">
      <div class="stat-card">
        <div class="stat-card-title">10-Year Record</div>
        <div class="stat-card-value">${totalWins}\u2013${totalLosses}</div>
        <div class="stat-card-sub">2015\u20132025 regular season</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">Win %</div>
        <div class="stat-card-value">${winPct}%</div>
        <div class="stat-card-sub">${totalGames} games played</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">Best Season</div>
        <div class="stat-card-value">${bestEntry ? bestEntry.wins + '\u2013' + bestEntry.losses : '\u2014'}</div>
        <div class="stat-card-sub">${bestYear || '\u2014'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">Worst Season</div>
        <div class="stat-card-value">${worstEntry ? worstEntry.wins + '\u2013' + worstEntry.losses : '\u2014'}</div>
        <div class="stat-card-sub">${worstYear || '\u2014'}</div>
      </div>
    </div>`;

  /* Year-by-year list — descending so newest is first */
  const listRows = sorted.slice().reverse().map(function (e) {
    return `
      <div class="longterm-year-row">
        <span class="longterm-year-label">${e.year}</span>
        <span class="longterm-year-value">${e.wins}\u2013${e.losses}</span>
      </div>`;
  }).join('');

  return cards + `<div class="longterm-year-list">${listRows}</div>`;
}

/* ----------------------------------------------------------
   _loadLongTermStrengthData
   Async coordinator for the Long-Term Strength section.
   Each of the five subsections runs as an independent IIFE
   so that one failed fetch does not block the others.
   All results are cached indefinitely — subsequent visits
   to this school's page cost zero API calls for this section.
   ---------------------------------------------------------- */
async function _loadLongTermStrengthData() {

  /* --- 1. Rankings History (2023, 2024, 2025) --- */
  (async function () {
    try {
      const [reg2023, reg2024, reg2025, fin2023, fin2024, fin2025] = await Promise.all([
        fetchRegularRankings(2023),
        fetchRegularRankings(2024),
        fetchRegularRankings(2025),
        fetchFinalRank(SCHOOL_NAME, 2023),
        fetchFinalRank(SCHOOL_NAME, 2024),
        fetchFinalRank(SCHOOL_NAME, 2025),
      ]);

      const seasons = [
        { year: 2023, weeklyData: reg2023, finalRank: fin2023 },
        { year: 2024, weeklyData: reg2024, finalRank: fin2024 },
        { year: 2025, weeklyData: reg2025, finalRank: fin2025 },
      ];
      setSection('longterm-rankings', renderRankingsHistory(seasons));
    } catch (e) {
      setSection('longterm-rankings', errorHTML('Rankings data unavailable.'));
    }
  })();

  /* --- 2. NFL Draft Production (2020–2025) --- */
  (async function () {
    try {
      const picks = await fetchDraftPicks(SCHOOL_NAME);
      setSection('longterm-draft', renderDraftProduction(picks));
    } catch (e) {
      setSection('longterm-draft', errorHTML('Draft data unavailable.'));
    }
  })();

  /* --- 3. Coaching Continuity --- */
  (async function () {
    try {
      /* Direct lookup — same name-match logic used inside the render function.
         Does not depend on _schoolData being correctly resolved. */
      const entry = (SCHOOLS_DATA.teams || []).find(function (t) {
        return t.name.replace(t.mascot || '', '').trim() === SCHOOL_NAME;
      });
      if (entry && entry.coachOverride) {
        setSection('longterm-coaching', renderCoachingContinuity(null, entry));
      } else {
        const coaches = await fetchAllCoaches(SCHOOL_NAME);
        setSection('longterm-coaching', renderCoachingContinuity(coaches, entry || _schoolData));
      }
    } catch (e) {
      setSection('longterm-coaching', errorHTML('Coaching data unavailable.'));
    }
  })();

  /* --- 4. Bowl Game History (2000–2025) ---
     2015–2025: use fetchSeasonRecord cache (seasonType 'both' includes postseason).
     2000–2014: dedicated fetchPostseasonGames calls.
     Both run concurrently; all results flattened into one array.             */
  (async function () {
    try {
      /* Recent years: fetchSeasonRecord already fetched these for 10-yr record
         below, but since they run concurrently, we call here too — cache handles it */
      const recentYears = [];
      for (let y = 2015; y <= 2025; y++) recentYears.push(y);

      const historicYears = [];
      for (let y = 2000; y < 2015; y++) historicYears.push(y);

      const [recentResults, historicResults] = await Promise.all([
        Promise.allSettled(recentYears.map(function (y) { return fetchSeasonRecord(SCHOOL_NAME, y); })),
        Promise.allSettled(historicYears.map(function (y) { return fetchPostseasonGames(SCHOOL_NAME, y); })),
      ]);

      /* Flatten all postseason games — filter out regular season games from recent batch */
      const allGames = [];

      recentResults.forEach(function (r, i) {
        if (r.status !== 'fulfilled') return;
        (r.value || []).forEach(function (g) {
          if (g.seasonType === 'postseason') allGames.push({ ...g, season: recentYears[i] });
        });
      });

      historicResults.forEach(function (r, i) {
        if (r.status !== 'fulfilled') return;
        (r.value || []).forEach(function (g) {
          allGames.push({ ...g, season: historicYears[i] });
        });
      });

      setSection('longterm-bowl', renderBowlHistory(allGames));
    } catch (e) {
      setSection('longterm-bowl', errorHTML('Bowl history unavailable.'));
    }
  })();

  /* --- 5. Long-Term Record (2015–2025, regular season) --- */
  (async function () {
    try {
      const years = [];
      for (let y = 2015; y <= 2025; y++) years.push(y);

      const results = await Promise.allSettled(
        years.map(function (y) { return fetchSeasonRecord(SCHOOL_NAME, y); })
      );

      const yearEntries = [];
      results.forEach(function (r, i) {
        if (r.status !== 'fulfilled') return;
        let wins = 0, losses = 0;
        (r.value || []).forEach(function (g) {
          /* Regular season only — exclude postseason/bowl games */
          if (g.seasonType !== 'regular') return;
          const isHome    = g.homeTeam === SCHOOL_NAME;
          const teamPts   = isHome ? g.homePoints : g.awayPoints;
          const oppPts    = isHome ? g.awayPoints  : g.homePoints;
          if (teamPts === null || oppPts === null) return;
          if (teamPts > oppPts) wins++; else losses++;
        });
        yearEntries.push({ year: years[i], wins, losses });
      });

      if (yearEntries.length === 0) {
        setSection('longterm-record', errorHTML('10-year record data unavailable.'));
      } else {
        setSection('longterm-record', renderLongTermRecord(yearEntries));
      }
    } catch (e) {
      setSection('longterm-record', errorHTML('10-year record data unavailable.'));
    }
  })();
}

/* ----------------------------------------------------------
   _loadAnalyticsData
   Coordinator: guards on hasGames, then delegates to the
   three sub-helpers for Game Control, Situational, and Market.
   Campus map is initialized regardless of game data — it is
   static and does not depend on API results.
   @param {Array}   completed      — current season completed games
   @param {boolean} hasGames       — false if no games loaded
   @param {Array}   lines          — fetchGameLines() output
   @param {Array}   priorCompleted — prior season completed games
   ---------------------------------------------------------- */
function _loadAnalyticsData(completed, hasGames, lines, priorCompleted) {
  /* Campus map is always available — no game data required */
  _loadCampusMap();

  if (!hasGames) {
    setSection('game-control-content', errorHTML('Could not load game data.'));
    setSection('volatility-content',   errorHTML('Could not load game data.'));
    setSection('situational-content',  errorHTML('Could not load game data.'));
    setSection('market-content',       errorHTML('Could not load game data.'));
    return;
  }

  _loadGameControlData(completed);
  _loadSituationalData(completed, priorCompleted);
  _loadMarketData(completed, lines);
}

/* ----------------------------------------------------------
   _loadCampusMap
   Reads --school-primary from the live CSS custom properties
   (set by applyTheme() before loadData() runs) and initializes
   both the inline map and the modal map via _initCampusMap().
   Called by _loadAnalyticsData — always fires, no API needed.
   ---------------------------------------------------------- */
function _loadCampusMap() {
  /* Read school color from live CSS variable — set by applyTheme() */
  const pinColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--school-primary').trim() || '#BF5700';

  _initCampusMap('campus-map-inline',    pinColor, 15, false);
  _initCampusMap('campus-map-modal-el',  pinColor, 16, true);

  /* Escape key closes the modal — registered once per page load */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') _closeMapModal();
  });
}

/* ----------------------------------------------------------
   _initCampusMap
   Mounts a Leaflet map into the given element ID, centered on
   the Texas stadium coordinates, with a colored divIcon pin.
   The modal map instance is stored on window so _openMapModal
   can call invalidateSize() after the modal becomes visible.

   @param {string}  elId      — id of the div to mount into
   @param {string}  pinColor  — hex color for the custom pin
   @param {number}  zoom      — initial zoom level
   @param {boolean} isModal   — true = store as window._campusMapModal
   ---------------------------------------------------------- */
function _initCampusMap(elId, pinColor, zoom, isModal) {
  const el = document.getElementById(elId);
  if (!el) return;

  /* Build the map — no attribution clutter, scroll wheel off for inline */
  const mapLat     = _schoolData ? _schoolData.lat     : 30.2838;
  const mapLng     = _schoolData ? _schoolData.lng     : -97.7326;
  const mapStadium = _schoolData ? _schoolData.stadium : 'Darrell K Royal\u2013Texas Memorial Stadium';
  const mapCity    = _schoolData ? `${_schoolData.city}, ${_schoolData.state}` : 'Austin, TX';

  const map = L.map(el, {
    center:             [mapLat, mapLng],
    zoom:               zoom,
    scrollWheelZoom:    isModal,
    zoomControl:        isModal,
    attributionControl: true,
  });

  /* CartoDB dark tile layer — works from file:// (no referer required) */
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom:     19,
    attribution: '\u00a9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors \u00a9 <a href="https://carto.com/">CARTO</a>',
  }).addTo(map);

  /* School-colored div pin using CSS box-shadow for the dot glow */
  const pin = L.divIcon({
    className: '',
    html: `<div style="
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background-color: ${pinColor};
      border: 3px solid #ffffff;
      box-shadow: 0 0 0 2px ${pinColor}, 0 2px 8px rgba(0,0,0,0.5);
    "></div>`,
    iconSize:   [18, 18],
    iconAnchor: [9, 9],
  });

  L.marker([mapLat, mapLng], { icon: pin })
    .addTo(map)
    .bindPopup(`<strong>${mapStadium}</strong><br>${mapCity}`);

  /* Store map references so invalidateSize() can be called after reveal */
  if (isModal) {
    window._campusMapModal = map;
  } else {
    window._campusMapInline = map;
  }
}

/* ----------------------------------------------------------
   _openMapModal
   Shows the campus map modal and calls invalidateSize() so
   Leaflet re-renders tiles now that the container is visible.
   Called by onclick on the expand button in the section HTML.
   ---------------------------------------------------------- */
function _openMapModal() {
  const modal = document.getElementById('campus-map-modal');
  if (!modal) return;
  modal.classList.add('is-open');

  /* Leaflet needs a size recalculation after display:none → flex */
  if (window._campusMapModal) {
    setTimeout(function () {
      window._campusMapModal.invalidateSize();
    }, 50);
  }
}

/* ----------------------------------------------------------
   _closeMapModal
   Hides the campus map modal.
   Called by onclick on the close button in the modal HTML.
   ---------------------------------------------------------- */
function _closeMapModal() {
  const modal = document.getElementById('campus-map-modal');
  if (modal) modal.classList.remove('is-open');
}

/* =============================================================
   Phase 10 — H2H Search
   Functions below handle team search, data fetching, stat
   computation, and rendering for the H2H section.
   ============================================================= */

/* ----------------------------------------------------------
   _h2hSchoolToCfbd
   Derives the CFBD-compatible school name (e.g. "Texas") from
   a schools.json entry by stripping the mascot from the full
   display name (e.g. "Texas Longhorns" → "Texas").

   @param {Object} entry — schools.json team entry
   @returns {string} — CFBD school name
   ---------------------------------------------------------- */
function _h2hSchoolToCfbd(entry) {
  return entry.name.replace(entry.mascot, '').trim();
}

/* ----------------------------------------------------------
   _initH2HSearch
   Binds the Team 2 search input to filter SCHOOLS_DATA in
   memory as the user types. Called once (guarded by
   _h2hSearchInitialized) when the user first opens the H2H
   section. No API call is made during search — all filtering
   is client-side against the local schools.json global.
   ---------------------------------------------------------- */
function _initH2HSearch() {
  if (_h2hSearchInitialized) return;
  _h2hSearchInitialized = true;

  const input    = document.getElementById('h2h-search-input');
  const dropdown = document.getElementById('h2h-dropdown');
  if (!input || !dropdown) return;

  const allSchools = (SCHOOLS_DATA.teams || []);

  /* Filter schools as the user types — minimum 2 chars */
  input.addEventListener('input', function () {
    const q = input.value.trim().toLowerCase();
    dropdown.innerHTML = '';

    if (q.length < 2) {
      dropdown.classList.remove('is-open');
      return;
    }

    const matches = allSchools
      .filter(function (s) {
        return s.id !== SCHOOL_ID && s.name.toLowerCase().includes(q);
      })
      .slice(0, 8);

    if (matches.length === 0) {
      dropdown.classList.remove('is-open');
      return;
    }

    matches.forEach(function (entry) {
      const item = document.createElement('div');
      item.className    = 'h2h-dropdown-item';
      item.textContent  = entry.name;
      item.addEventListener('click', function () {
        input.value = entry.name;
        dropdown.classList.remove('is-open');
        dropdown.innerHTML = '';
        _loadH2HData(entry);
      });
      dropdown.appendChild(item);
    });

    dropdown.classList.add('is-open');
  });

  /* Close dropdown when clicking outside the search wrapper */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.h2h-search-wrap')) {
      dropdown.classList.remove('is-open');
    }
  });
}

/* ----------------------------------------------------------
   _h2hComputeRecord
   Tallies all-time W-L-T for team1 across all matchups.

   @param {Array}  matchups — completed games between the two teams
   @param {string} team1    — CFBD school name for team 1
   @returns {{ wins, losses, ties, total }}
   ---------------------------------------------------------- */
function _h2hComputeRecord(matchups, team1) {
  let wins = 0, losses = 0, ties = 0;
  matchups.forEach(function (g) {
    const isHome = g.homeTeam === team1;
    const t1Pts  = isHome ? g.homePoints : g.awayPoints;
    const t2Pts  = isHome ? g.awayPoints : g.homePoints;
    if      (t1Pts > t2Pts) wins++;
    else if (t1Pts < t2Pts) losses++;
    else                    ties++;
  });
  return { wins, losses, ties, total: matchups.length };
}

/* ----------------------------------------------------------
   _h2hComputeLast5
   Returns up to the 5 most recent matchups, newest first.
   Each entry carries the display year, result label (W/L/T),
   score string, and site label (Home / Away / Neutral).

   @param {Array}  matchups — completed games, sorted oldest→newest
   @param {string} team1    — CFBD school name for team 1
   @returns {Array<{ year, result, score, site, won, tied }>}
   ---------------------------------------------------------- */
function _h2hComputeLast5(matchups, team1) {
  return matchups.slice(-5).reverse().map(function (g) {
    const isHome = g.homeTeam === team1;
    const t1Pts  = isHome ? g.homePoints : g.awayPoints;
    const t2Pts  = isHome ? g.awayPoints : g.homePoints;
    const won    = t1Pts > t2Pts;
    const tied   = t1Pts === t2Pts;
    const year   = new Date(g.startDate).getFullYear();
    const site   = g.neutralSite ? 'Neutral' : (isHome ? 'Home' : 'Away');
    const result = tied ? 'T' : (won ? 'W' : 'L');
    const score  = `${t1Pts}\u2013${t2Pts}`;
    return { year, result, score, site, won, tied };
  });
}

/* ----------------------------------------------------------
   _h2hComputeDecades
   Groups W-L-T totals by decade (1990s, 2000s, etc.).
   Decade is derived from the calendar year of the game date.

   @param {Array}  matchups — completed games
   @param {string} team1    — CFBD school name for team 1
   @returns {Array<{ decade, wins, losses, ties }>} sorted oldest first
   ---------------------------------------------------------- */
function _h2hComputeDecades(matchups, team1) {
  const map = {};
  matchups.forEach(function (g) {
    const year   = new Date(g.startDate).getFullYear();
    const decade = Math.floor(year / 10) * 10;
    const isHome = g.homeTeam === team1;
    const t1Pts  = isHome ? g.homePoints : g.awayPoints;
    const t2Pts  = isHome ? g.awayPoints : g.homePoints;

    if (!map[decade]) map[decade] = { wins: 0, losses: 0, ties: 0 };
    if      (t1Pts > t2Pts) map[decade].wins++;
    else if (t1Pts < t2Pts) map[decade].losses++;
    else                    map[decade].ties++;
  });

  return Object.keys(map).sort().map(function (d) {
    return { decade: Number(d), wins: map[d].wins, losses: map[d].losses, ties: map[d].ties };
  });
}

/* ----------------------------------------------------------
   _h2hComputeAvgScore
   Calculates average points scored and allowed by team1
   across all matchups.

   @param {Array}  matchups — completed games
   @param {string} team1    — CFBD school name for team 1
   @returns {{ scored: string, allowed: string }} — one decimal each
   ---------------------------------------------------------- */
function _h2hComputeAvgScore(matchups, team1) {
  if (matchups.length === 0) return { scored: '\u2014', allowed: '\u2014' };
  let totalScored = 0, totalAllowed = 0;
  matchups.forEach(function (g) {
    const isHome   = g.homeTeam === team1;
    totalScored  += isHome ? g.homePoints : g.awayPoints;
    totalAllowed += isHome ? g.awayPoints : g.homePoints;
  });
  return {
    scored:  (totalScored  / matchups.length).toFixed(1),
    allowed: (totalAllowed / matchups.length).toFixed(1),
  };
}

/* ----------------------------------------------------------
   _h2hComputeATS
   Matches CFBD lines data to each matchup game and computes
   how often team1 covered the spread. Returns null if fewer
   than one game had line data available.

   CFBD spread is from the home team's perspective (negative
   means home is favored). Team1 ATS margin = (t1Pts - t2Pts)
   adjusted for the spread from team1's perspective.

   @param {Array}  matchups   — completed games between the teams
   @param {Object} linesByYear — { year: linesArray } keyed by season year
   @param {string} team1      — CFBD school name for team 1
   @returns {{ covers, losses, pushes, total } | null}
   ---------------------------------------------------------- */
function _h2hComputeATS(matchups, linesByYear, team1) {
  let covers = 0, losses = 0, pushes = 0;

  matchups.forEach(function (g) {
    const year      = new Date(g.startDate).getFullYear();
    const linesArr  = linesByYear[year] || [];

    /* Find the lines entry for this specific game by CFBD game id */
    const gameLines = linesArr.find(function (l) { return l.id === g.id; });
    if (!gameLines || !Array.isArray(gameLines.lines)) return;

    /* Use the first provider that has a non-null spread */
    const line = gameLines.lines.find(function (l) { return l.spread !== null && l.spread !== undefined; });
    if (!line) return;

    const isHome = g.homeTeam === team1;
    const t1Pts  = isHome ? g.homePoints : g.awayPoints;
    const t2Pts  = isHome ? g.awayPoints : g.homePoints;
    const margin = t1Pts - t2Pts;

    /* CFBD spread is home-team-perspective; flip if team1 is away */
    const spread  = isHome ? parseFloat(line.spread) : -parseFloat(line.spread);
    const covered = margin + spread;

    if (Math.abs(covered) < 0.01) pushes++;
    else if (covered > 0)         covers++;
    else                          losses++;
  });

  const total = covers + losses + pushes;
  return total > 0 ? { covers, losses, pushes, total } : null;
}

/* ----------------------------------------------------------
   _h2hComputeStreaks
   Computes the longest consecutive win streak in the series
   for each team. Ties reset both streak counters.

   @param {Array}  matchups — completed games, sorted oldest→newest
   @param {string} team1    — CFBD school name for team 1
   @returns {{ t1Best: number, t2Best: number }}
   ---------------------------------------------------------- */
function _h2hComputeStreaks(matchups, team1) {
  let t1Best = 0, t2Best = 0, t1Cur = 0, t2Cur = 0;
  matchups.forEach(function (g) {
    const isHome = g.homeTeam === team1;
    const t1Pts  = isHome ? g.homePoints : g.awayPoints;
    const t2Pts  = isHome ? g.awayPoints : g.homePoints;
    if (t1Pts > t2Pts) {
      t1Cur++;
      t2Cur = 0;
      t1Best = Math.max(t1Best, t1Cur);
    } else if (t2Pts > t1Pts) {
      t2Cur++;
      t1Cur = 0;
      t2Best = Math.max(t2Best, t2Cur);
    } else {
      t1Cur = 0;
      t2Cur = 0;
    }
  });
  return { t1Best, t2Best };
}

/* ----------------------------------------------------------
   renderH2HResults
   Builds the full H2H results HTML from computed data.
   Six subsections separated by dividers — ATS is silently
   omitted when no lines data is available.

   @param {Object} data — computed H2H stats object
   @returns {string} HTML string
   ---------------------------------------------------------- */
function renderH2HResults(data) {
  const { team1Display, team2Display, record, last5, decades, avgScore, ats, streaks } = data;

  /* --- All-time record --- */
  const tiesStr = record.ties > 0 ? `\u2013${record.ties}` : '';
  const recordCards = `
    <h3 class="school-section-title">All-Time Series Record (1990\u20132025)</h3>
    <div class="stat-cards-row">
      <div class="stat-card">
        <div class="stat-card-title">${team1Display}</div>
        <div class="stat-card-value">${record.wins}\u2013${record.losses}${tiesStr}</div>
        <div class="stat-card-sub">${record.total} game${record.total !== 1 ? 's' : ''} in series</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">${team2Display}</div>
        <div class="stat-card-value">${record.losses}\u2013${record.wins}${tiesStr}</div>
        <div class="stat-card-sub">${record.total} game${record.total !== 1 ? 's' : ''} in series</div>
      </div>
    </div>`;

  /* --- Last 5 matchups --- */
  const last5Rows = last5.map(function (g) {
    const color = g.tied ? '' : (g.won ? 'color: var(--school-primary)' : 'color: var(--color-loss)');
    return `
      <div class="home-list-row">
        <span class="home-list-rank">${g.year}</span>
        <span class="home-list-label">${g.site}</span>
        <span class="home-list-meta" style="${color}">${g.result} ${g.score}</span>
      </div>`;
  }).join('');
  const last5Section = `
    <hr class="section-divider">
    <h3 class="school-section-title">Last 5 Matchups</h3>
    <div class="home-list">${last5Rows}</div>`;

  /* --- By decade --- */
  const decadeRows = decades.map(function (d) {
    const t   = d.ties > 0 ? `\u2013${d.ties}` : '';
    return `
      <div class="home-list-row">
        <span class="home-list-label">${d.decade}s</span>
        <span class="home-list-meta">${team1Display} ${d.wins}\u2013${d.losses}${t}</span>
      </div>`;
  }).join('');
  const decadeSection = `
    <hr class="section-divider">
    <h3 class="school-section-title">Series by Decade</h3>
    <div class="home-list">${decadeRows}</div>`;

  /* --- Average scoring --- */
  const avgSection = `
    <hr class="section-divider">
    <h3 class="school-section-title">Average Scoring in Series</h3>
    <div class="stat-cards-row">
      <div class="stat-card">
        <div class="stat-card-title">${team1Display} Avg Scored</div>
        <div class="stat-card-value">${avgScore.scored}</div>
        <div class="stat-card-sub">Points per matchup</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">${team1Display} Avg Allowed</div>
        <div class="stat-card-value">${avgScore.allowed}</div>
        <div class="stat-card-sub">Points per matchup</div>
      </div>
    </div>`;

  /* --- ATS — silently skipped when no lines data was found --- */
  let atsSection = '';
  if (ats !== null) {
    const pushNote = ats.pushes > 0
      ? ` \u00b7 ${ats.pushes} push${ats.pushes !== 1 ? 'es' : ''}`
      : '';
    atsSection = `
      <hr class="section-divider">
      <h3 class="school-section-title">ATS in Series</h3>
      <div class="stat-cards-row">
        <div class="stat-card">
          <div class="stat-card-title">${team1Display} ATS</div>
          <div class="stat-card-value">${ats.covers}\u2013${ats.losses}</div>
          <div class="stat-card-sub">${ats.total} game${ats.total !== 1 ? 's' : ''} with line data${pushNote}</div>
        </div>
      </div>`;
  }

  /* --- Win streaks --- */
  const streakSection = `
    <hr class="section-divider">
    <h3 class="school-section-title">Longest Win Streaks in Series</h3>
    <div class="stat-cards-row">
      <div class="stat-card">
        <div class="stat-card-title">${team1Display}</div>
        <div class="stat-card-value">${streaks.t1Best}</div>
        <div class="stat-card-sub">Consecutive wins in series</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-title">${team2Display}</div>
        <div class="stat-card-value">${streaks.t2Best}</div>
        <div class="stat-card-sub">Consecutive wins in series</div>
      </div>
    </div>`;

  return recordCards + last5Section + decadeSection + avgSection + atsSection + streakSection;
}

/* ----------------------------------------------------------
   _loadH2HData
   Orchestrates H2H data loading:
     1. Check localStorage cache (key: h2h_[teamA]_[teamB])
     2. Fetch all seasons 1990-2025 for team1 in parallel
     3. Filter game results client-side for team2 matchups
     4. Fetch lines only for years with matchups
     5. Compute stats and cache the result

   Graceful fallback: if no matchups are found, shows a
   "no matchups" message. If the API is unreachable, shows
   an inline error.

   @param {Object} team2Entry — schools.json entry for team 2
   ---------------------------------------------------------- */
async function _loadH2HData(team2Entry) {
  const resultsEl = document.getElementById('h2h-results');
  if (!resultsEl) return;
  resultsEl.innerHTML = loadingHTML();

  /* CFBD school names for both teams */
  const team1CfbdName  = SCHOOL_NAME;
  const team2CfbdName  = _h2hSchoolToCfbd(team2Entry);

  /* Cache key is alphabetically sorted so A-vs-B and B-vs-A share one entry */
  const [keyA, keyB]   = [team1CfbdName, team2CfbdName].sort();
  const cacheKey       = `h2h_${keyA}_${keyB}`;

  /* Display names for rendering */
  const team1Entry     = (SCHOOLS_DATA.teams || []).find(function (t) { return t.id === SCHOOL_ID; });
  const team1DisplayName = team1Entry ? team1Entry.name : SCHOOL_NAME;

  try {
    /* --- Cache hit --- */
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setSection('h2h-results', renderH2HResults(JSON.parse(cached)));
      return;
    }

    /* --- Fetch all seasons 1990-2025 for team1 concurrently --- */
    const years = [];
    for (let y = 1990; y <= 2025; y++) years.push(y);

    const yearResults = await Promise.allSettled(
      years.map(function (y) {
        return cfbdFetch('/games', { year: y, team: team1CfbdName, seasonType: 'both' });
      })
    );

    /* --- Collect games and filter for team2 matchups --- */
    const matchups = [];
    yearResults.forEach(function (r) {
      if (r.status !== 'fulfilled' || !Array.isArray(r.value)) return;
      r.value.forEach(function (g) {
        const isMatchup =
          (g.homeTeam === team2CfbdName || g.awayTeam === team2CfbdName) &&
          g.homePoints !== null && g.homePoints !== undefined &&
          g.awayPoints !== null && g.awayPoints !== undefined;
        if (isMatchup) matchups.push(g);
      });
    });

    /* --- No games found — show graceful message --- */
    if (matchups.length === 0) {
      setSection('h2h-results', `
        <p class="stat-card-note">
          No completed matchups found between ${team1DisplayName} and ${team2Entry.name} from 1990\u20132025.
        </p>`);
      return;
    }

    /* Sort chronologically oldest → newest */
    matchups.sort(function (a, b) { return new Date(a.startDate) - new Date(b.startDate); });

    /* --- Fetch lines only for years that had matchup games --- */
    const matchupYears = [...new Set(matchups.map(function (g) {
      return new Date(g.startDate).getFullYear();
    }))];

    const linesResults = await Promise.allSettled(
      matchupYears.map(function (y) {
        return cfbdFetch('/lines', { year: y, team: team1CfbdName });
      })
    );

    /* Build year → lines array lookup */
    const linesByYear = {};
    linesResults.forEach(function (r, i) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        linesByYear[matchupYears[i]] = r.value;
      }
    });

    /* --- Compute all stats --- */
    const data = {
      team1:        team1CfbdName,
      team1Display: team1DisplayName,
      team2:        team2CfbdName,
      team2Display: team2Entry.name,
      record:       _h2hComputeRecord(matchups, team1CfbdName),
      last5:        _h2hComputeLast5(matchups, team1CfbdName),
      decades:      _h2hComputeDecades(matchups, team1CfbdName),
      avgScore:     _h2hComputeAvgScore(matchups, team1CfbdName),
      ats:          _h2hComputeATS(matchups, linesByYear, team1CfbdName),
      streaks:      _h2hComputeStreaks(matchups, team1CfbdName),
    };

    /* --- Cache to localStorage — ignore quota errors --- */
    try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) { /* storage full */ }

    setSection('h2h-results', renderH2HResults(data));

  } catch (e) {
    setSection('h2h-results', errorHTML('Could not load H2H data. Check your connection and try again.'));
  }
}

/* =============================================================
   Phase 13b — Schedule Section
   ============================================================= */

/* ----------------------------------------------------------
   _renderScheduleGameRow
   Builds a single game row for the schedule list.
   Completed games show score + W/L badge + ATS result.
   Future games show spread + O/U, or "Line TBD".

   @param {Object} game  — CFBD game object
   @param {Array}  lines — fetchScheduleLines() output
   @returns {string} HTML string
   ---------------------------------------------------------- */
function _renderScheduleGameRow(game, lines) {
  const isHome   = game.homeTeam === SCHOOL_NAME;
  const opponent = isHome ? game.awayTeam : game.homeTeam;
  const location = game.neutralSite ? 'N' : (isHome ? 'vs' : '@');

  let dateStr = '';
  if (game.startDate) {
    const d = new Date(game.startDate);
    dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const isCompleted = game.homePoints !== null && game.awayPoints !== null
                   && game.homePoints !== undefined && game.awayPoints !== undefined;

  /* Find matching line entry by game id */
  const lineEntry  = (lines || []).find(function (l) { return l.id === game.id; });
  const consensus  = lineEntry && Array.isArray(lineEntry.lines) && lineEntry.lines.length
    ? (lineEntry.lines.find(function (l) { return l.provider === 'consensus'; }) || lineEntry.lines[0])
    : null;

  let rightCol = '';

  if (isCompleted) {
    const teamPts  = isHome ? game.homePoints : game.awayPoints;
    const oppPts   = isHome ? game.awayPoints  : game.homePoints;
    const won      = teamPts > oppPts;
    const badgeClass = won ? 'result-w' : 'result-l';
    const badgeLabel = won ? 'W' : 'L';

    let atsHtml = '';
    if (consensus && consensus.spread !== null && consensus.spread !== '') {
      const spreadNum  = parseFloat(consensus.spread);
      if (!isNaN(spreadNum)) {
        const teamSpread = isHome ? spreadNum : -spreadNum;
        const margin     = teamPts - oppPts;
        let atsResult    = margin > -teamSpread ? 'Covered' : (margin === -teamSpread ? 'Push' : 'Lost ATS');
        atsHtml = `<span class="schedule-game-ats">${atsResult}</span>`;
      }
    }

    rightCol = `
      <span class="schedule-game-score">${teamPts}\u2013${oppPts}</span>
      <span class="result-badge ${badgeClass}">${badgeLabel}</span>
      ${atsHtml}`;
  } else {
    let lineStr = 'Line TBD';
    if (consensus) {
      const spread = consensus.formattedSpread || consensus.spread;
      const ou     = consensus.overUnder;
      if (spread && ou) lineStr = `${spread} \u00b7 O/U ${ou}`;
      else if (spread)  lineStr = spread;
    }
    rightCol = `<span class="schedule-game-line">${lineStr}</span>`;
  }

  const homeClass = isHome ? 'schedule-game--home' : 'schedule-game--away';

  return `
    <div class="schedule-game-row ${homeClass}">
      <span class="schedule-game-location">${location}</span>
      <span class="schedule-game-opponent">${opponent}</span>
      <span class="schedule-game-date">${dateStr}</span>
      <div class="schedule-game-right">${rightCol}</div>
    </div>`;
}

/* ----------------------------------------------------------
   renderSchedule
   Builds the full schedule list grouped by week number.
   Returns a friendly "not yet available" block if CFBD has
   no data for SCHEDULE_YEAR (common before spring release).

   @param {Array} games — fetchSchedule() output
   @param {Array} lines — fetchScheduleLines() output
   @returns {string} HTML string
   ---------------------------------------------------------- */
function renderSchedule(games, lines) {
  if (!Array.isArray(games) || games.length === 0) {
    return `
      <div class="section-placeholder">
        <div class="section-placeholder-label">2026 Schedule Not Yet Available</div>
        <div class="section-placeholder-note">
          Schedule data typically releases in spring. Check back closer to the season.
        </div>
      </div>`;
  }

  /* Sort by week, then start date within a week */
  const sorted = games.slice().sort(function (a, b) {
    const wkDiff = (a.week || 0) - (b.week || 0);
    if (wkDiff !== 0) return wkDiff;
    return new Date(a.startDate) - new Date(b.startDate);
  });

  /* Group by week number */
  const byWeek  = {};
  sorted.forEach(function (g) {
    const wk = String(g.week || 0);
    if (!byWeek[wk]) byWeek[wk] = [];
    byWeek[wk].push(g);
  });

  const weekKeys = Object.keys(byWeek).sort(function (a, b) { return +a - +b; });

  const html = weekKeys.map(function (wk) {
    const label = +wk === 0 ? 'Week 0 / Preseason' : `Week ${wk}`;
    const rows  = byWeek[wk].map(function (g) {
      return _renderScheduleGameRow(g, lines);
    }).join('');
    return `
      <div class="schedule-week">
        <div class="schedule-week-label">${label}</div>
        ${rows}
      </div>`;
  }).join('');

  return `<div class="schedule-list">${html}</div>`;
}

/* ----------------------------------------------------------
   _loadScheduleData
   Fetches SCHEDULE_YEAR games + lines concurrently.
   Each fetch failure falls back gracefully — lines failure
   just means all future games show "Line TBD".
   ---------------------------------------------------------- */
async function _loadScheduleData() {
  try {
    const [gamesResult, linesResult] = await Promise.allSettled([
      fetchSchedule(SCHOOL_NAME, SCHEDULE_YEAR),
      fetchScheduleLines(SCHOOL_NAME, SCHEDULE_YEAR),
    ]);

    const games = gamesResult.status === 'fulfilled' ? gamesResult.value : [];
    const lines = linesResult.status === 'fulfilled' ? linesResult.value : [];

    setSection('schedule-content', renderSchedule(games, lines));
  } catch (e) {
    setSection('schedule-content', errorHTML('Schedule data unavailable.'));
  }
}
