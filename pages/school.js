'use strict';

/* =============================================================
   pages/school.js — FieldIQ School Page
   Exposes: SchoolPage.render(params), SchoolPage.loadData(),
            toggleSection(sectionId)
   Depends on: js/api.js (fetch functions), js/dna.js (computeDNA)

   Phase 4: Skeleton with hardcoded Texas placeholder data.
   Phase 5: Live API data for DNA, snapshot, game cards, identity.
             School and year are hardcoded — Phase 11 adds switcher.
   ============================================================= */

/* ----------------------------------------------------------
   Season + School Constants
   Phase 11 will replace these with dynamic school selection.
   ---------------------------------------------------------- */
const SCHOOL_NAME = 'Texas';
const SCHOOL_YEAR = 2024;

/* ----------------------------------------------------------
   Static Texas Identity Data
   Fields not available from CFBD (stadium, city, capacity,
   founded, championships) stay here until Phase 9 builds
   the full schools.json.
   ---------------------------------------------------------- */
const TEXAS_STATIC = {
  displayName:   'Texas Longhorns',
  conference:    'SEC',          // overwritten by fetchTeamInfo at runtime
  stadium:       'Darrell K Royal\u2013Texas Memorial Stadium',
  capacity:      '100,119',
  city:          'Austin, TX',
  founded:       1883,
  championships: '4 national \u00b7 33 conference',
  coach:         '\u2014',       // overwritten by fetchCoachInfo at runtime
  coachSeason:   '',
  coachRecord:   '',
};

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
    { label: 'Conference',    value: data.conference },
    { label: 'City',          value: data.city },
    { label: 'Stadium',       value: data.stadium },
    { label: 'Capacity',      value: data.capacity },
    { label: 'Founded',       value: data.founded },
    { label: 'Championships', value: data.championships },
    { label: 'Head Coach',    value: data.coachSeason ? `${data.coach} \u00b7 ${data.coachSeason}` : data.coach },
    { label: 'Coach Record',  value: data.coachRecord },
  ];

  const factsHTML = facts.map(function (fact) {
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
        /* spreadNum is from home team's perspective — flip for away team */
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
  const data = Object.assign({}, TEXAS_STATIC);

  if (teamInfo && teamInfo.conference) {
    data.conference = teamInfo.conference;
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
   Overview gets a skeleton; all others get a placeholder.
   ---------------------------------------------------------- */
function renderSections() {
  return SECTIONS.map(function (section) {
    if (section.id === 'overview') return renderOverview();
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
    Promise.resolve().then(function () { SchoolPage.loadData(); });

    return `
      <div class="page-school">

        <!-- Hero band: school name, conference, season, live record.
             Conference and record are updated by loadData(). -->
        <div class="school-hero">
          <div class="school-header">
            <div class="school-header-name">${TEXAS_STATIC.displayName}</div>
            <div class="school-header-meta">
              <span class="school-header-conf" id="school-hero-conf">${TEXAS_STATIC.conference} &middot; ${SCHOOL_YEAR}</span>
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
     Fires all fetch calls concurrently via Promise.allSettled.
     A failed fetch never crashes the page — each section falls
     back to a safe empty value and updates independently.
     ---------------------------------------------------------- */
  async loadData() {
    const [gamesResult, rankResult, linesResult, coachResult, teamResult] =
      await Promise.allSettled([
        fetchSeasonRecord(SCHOOL_NAME, SCHOOL_YEAR),
        fetchFinalRank(SCHOOL_NAME, SCHOOL_YEAR),
        fetchGameLines(SCHOOL_NAME, SCHOOL_YEAR),
        fetchCoachInfo(SCHOOL_NAME, SCHOOL_YEAR),
        fetchTeamInfo(SCHOOL_NAME),
      ]);

    /* Unwrap — each failure falls back to a safe empty default */
    const games     = gamesResult.status === 'fulfilled' ? gamesResult.value : [];
    const rank      = rankResult.status  === 'fulfilled' ? rankResult.value  : null;
    const lines     = linesResult.status === 'fulfilled' ? linesResult.value : [];
    const coachInfo = coachResult.status === 'fulfilled' ? coachResult.value : null;
    const teamInfo  = teamResult.status  === 'fulfilled' ? teamResult.value  : null;

    const completed = _completedGames(games);
    const hasGames  = completed.length > 0;

    /* --- Hero meta band --- */
    const conf     = teamInfo ? (teamInfo.conference || TEXAS_STATIC.conference) : TEXAS_STATIC.conference;
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
  },

};
