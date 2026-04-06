'use strict';

/* =============================================================
   pages/school.js — FieldIQ School Page
   Exposes: SchoolPage.render(params), toggleSection(sectionId)
   Depends on: theme.js (restoreTheme() called by router before render)

   Phase 4: Shell only. Texas Longhorns hardcoded placeholder data.
   No API calls. Real structure, real class names, no live data.
   Phase 5 will swap TEXAS_DATA for live fetched data.
   ============================================================= */

/* ----------------------------------------------------------
   Texas Longhorns placeholder data
   Phase 5 replaces this block with live API data.
   Structure is intentionally preserved — swap requires data
   change only, no DOM restructuring.
   ---------------------------------------------------------- */
const TEXAS_DATA = {
  school:        'Texas Longhorns',
  conference:    'SEC',
  season:        2024,
  record:        '13-3',
  rank:          '#3 AP',
  avgMargin:     '+18.4',
  ppg:           '38.7',

  lastGame: {
    result:   'W',
    score:    '35-17',
    opponent: 'Clemson',
    game:     'Peach Bowl',
    ats:      'Covered (-7.5)',
    ou:       'W 52 Over (47.5)',
  },

  nextGame: null, // null = offseason — game card handles this state gracefully

  stadium:       'Darrell K Royal\u2013Texas Memorial Stadium',
  capacity:      '100,119',
  city:          'Austin, TX',
  founded:       1883,
  championships: '4 national \u00b7 33 conference',
  coach:         'Steve Sarkisian',
  coachSeason:   '4th season',
  coachRecord:   '35-17',

  /* DNA: array of label objects so Phase 5 can swap the array
     without touching the renderDNACard() function or DOM shape */
  dna: [
    { label: 'Front Runner',       stat: '68% of wins by 15+ pts' },
    { label: 'Fast Starter',       stat: '1st half avg 21.4 pts vs 17.3 2nd half' },
    { label: 'Market Undervalued', stat: 'ATS as underdog: 5-2 (71%)' },
  ],
  dnaNotes: 'Based on 16 games \u00b7 2024 season',
};

/* ----------------------------------------------------------
   Section definitions
   Single source of truth for sidebar nav order, IDs, display
   labels, and which build phase delivers real content.
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
   Standalone exported function — Phase 5 can call this
   programmatically without refactoring the nav.
   @param {string} sectionId — must match a SECTIONS[n].id value
   ---------------------------------------------------------- */
function toggleSection(sectionId) {
  // Sync active class on all lens nav items
  document.querySelectorAll('.lens-nav-item').forEach(function (item) {
    item.classList.toggle('active', item.dataset.section === sectionId);
  });

  // Show only the matching section content div
  document.querySelectorAll('.school-section').forEach(function (section) {
    section.classList.toggle('is-active', section.dataset.section === sectionId);
  });
}

/* ----------------------------------------------------------
   renderDNACard
   Builds the Program DNA card from an array of label objects.
   Phase 5 passes a new array — no DOM restructuring needed.
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
   @param {Object} data — must contain: record, rank, avgMargin, ppg
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
   nextGame === null renders the offseason state gracefully.
   @param {Object|null} lastGame
   @param {Object|null} nextGame
   @returns {string} HTML string
   ---------------------------------------------------------- */
function renderGameCards(lastGame, nextGame) {
  /* Last game card */
  const lastHTML = lastGame
    ? `<div class="game-card">
        <div class="game-card-header">Last Game</div>
        <div class="game-card-score">${lastGame.result} ${lastGame.score}</div>
        <div class="game-card-ats">${lastGame.ats} &nbsp;&middot;&nbsp; ${lastGame.ou}</div>
        <div class="game-card-meta">vs ${lastGame.opponent}<br>${lastGame.game}</div>
      </div>`
    : `<div class="game-card">
        <div class="game-card-header">Last Game</div>
        <div class="game-card-offseason">No data</div>
      </div>`;

  /* Next game card — null means offseason */
  const nextHTML = nextGame
    ? `<div class="game-card">
        <div class="game-card-header">Next Game</div>
        <div class="game-card-score">${nextGame.opponent}</div>
        <div class="game-card-meta">${nextGame.date}<br>${nextGame.location}</div>
      </div>`
    : `<div class="game-card">
        <div class="game-card-header">Next Game</div>
        <div class="game-card-offseason">Offseason</div>
        <div class="game-card-meta">No upcoming game scheduled.</div>
      </div>`;

  return `<div class="game-cards-row">${lastHTML}${nextHTML}</div>`;
}

/* ----------------------------------------------------------
   renderIdentityCard
   Builds the School Identity card: 2-column grid of facts.
   @param {Object} data — school identity fields from data object
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
    { label: 'Head Coach',    value: `${data.coach} \u00b7 ${data.coachSeason}` },
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

/* ----------------------------------------------------------
   renderSidebar
   Builds the lens nav HTML. Overview is active by default.
   onclick calls the global toggleSection() directly (Option C).
   @returns {string} HTML string
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
   Assembles the Overview section content from sub-functions.
   This is the only section with real content in Phase 4.
   @param {Object} data — school data object
   @returns {string} HTML string
   ---------------------------------------------------------- */
function renderOverview(data) {
  return `
    <div class="school-section is-active" data-section="overview">
      ${renderDNACard(data.dna, data.dnaNotes)}
      ${renderSnapshotRow(data)}
      ${renderGameCards(data.lastGame, data.nextGame)}
      ${renderIdentityCard(data)}
    </div>`;
}

/* ----------------------------------------------------------
   renderPlaceholderSection
   Builds a dashed placeholder block for sections not yet built.
   @param {Object} section — a SECTIONS entry with id, label, phase
   @returns {string} HTML string
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
   Iterates all SECTIONS and returns HTML for each.
   Overview gets real content; all others get a placeholder.
   @param {Object} data — school data object
   @returns {string} HTML string
   ---------------------------------------------------------- */
function renderSections(data) {
  return SECTIONS.map(function (section) {
    if (section.id === 'overview') {
      return renderOverview(data);
    }
    return renderPlaceholderSection(section);
  }).join('');
}

/* ----------------------------------------------------------
   SchoolPage
   Public interface consumed by router.js via SchoolPage.render().
   render() is the thin orchestrator: assembles the full page
   HTML string from sub-functions and returns it to the router.

   Phase 5 note: params.id will be used here to fetch the
   correct school. For Phase 4, all routes show Texas data.
   ---------------------------------------------------------- */
const SchoolPage = {

  render(params = {}) {
    // Phase 5 will use params.id to load a specific school.
    // Hardcoded to Texas for the Phase 4 shell.
    const data = TEXAS_DATA;

    return `
      <div class="page-school">

        <!-- Hero band: school name, conference, record
             Bleeds edge-to-edge via negative margins in school-hero CSS -->
        <div class="school-hero">
          <div class="school-header">
            <div class="school-header-name">${data.school}</div>
            <div class="school-header-meta">
              <span class="school-header-conf">${data.conference} &middot; ${data.season}</span>
              <span class="school-header-record">${data.record}</span>
            </div>
          </div>
        </div>

        <!-- Two-column layout: lens nav sidebar + section content area -->
        <div class="school-layout">
          ${renderSidebar()}
          <div class="school-main">
            ${renderSections(data)}
          </div>
        </div>

      </div>`;
  },

};
