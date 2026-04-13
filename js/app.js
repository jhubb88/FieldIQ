'use strict';

/* =============================================================
   app.js — FieldIQ Entry Point
   Exposes: (nothing — all functions are internal init helpers)
   Depends on: theme.js, api.js, router.js,
               pages/home.js, pages/school.js
   Initializes the app on DOMContentLoaded.
   ============================================================= */

/* ----------------------------------------------------------
   Sidebar Nav Definition
   Each entry maps a display label to a route name.
   ---------------------------------------------------------- */
const NAV_ITEMS = [
  { label: 'Home',    route: 'home'   },
  { label: 'Schools', route: 'school' },
];

/* ----------------------------------------------------------
   Power 4 Conference Labels
   Used by _confGroup to decide whether a conference gets its
   own filter option or is grouped under "G5".
   ---------------------------------------------------------- */
const P4_CONFS = ['SEC', 'Big Ten', 'Big 12', 'ACC'];

/* ----------------------------------------------------------
   _confGroup
   Maps a school's conference name to the filter group shown
   in the switcher's <select>. Power 4 conferences are their
   own options; everything else becomes "G5".

   @param {string} conf — conference name from SCHOOLS_DATA
   @returns {string} — 'SEC' | 'Big Ten' | 'Big 12' | 'ACC' | 'G5'
   ---------------------------------------------------------- */
function _confGroup(conf) {
  return P4_CONFS.includes(conf) ? conf : 'G5';
}

/* ----------------------------------------------------------
   buildSidebar
   Renders the logo wordmark and injects nav items into the
   #sidebar-nav element. Adds click and keyboard handlers that
   call navigate() from router.js.
   ---------------------------------------------------------- */
function buildSidebar() {
  /* Logo */
  const logoEl = document.getElementById('sidebar-logo');
  if (logoEl) {
    logoEl.innerHTML = `
      <span class="sidebar-logo-text">Field<span class="sidebar-logo-accent">IQ</span></span>
    `;
  }

  /* Nav items */
  const navEl = document.getElementById('sidebar-nav');
  if (!navEl) return;

  navEl.innerHTML = NAV_ITEMS.map(function (item) {
    return `
      <div class="nav-item" data-route="${item.route}" role="button" tabindex="0"
           aria-label="Navigate to ${item.label}">
        ${item.label}
      </div>`;
  }).join('');

  navEl.querySelectorAll('.nav-item[data-route]').forEach(function (el) {
    el.addEventListener('click', function () { navigate(el.dataset.route); });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigate(el.dataset.route);
      }
    });
  });
}

/* ----------------------------------------------------------
   buildTopbar
   Injects the school switcher into #topbar. A guard prevents
   double-injection if buildTopbar is ever called again.

   The switcher reads from the SCHOOLS_DATA global (loaded as a
   <script> tag from data/schools.js) — no API call needed.

   Behavior:
     - Conference <select> silently narrows the candidate pool
     - Text input (≥ 1 char) triggers the dropdown
     - Max 12 results rendered at once
     - Click or Enter → navigates via hash router, clears input
     - ArrowUp/ArrowDown move focus through dropdown items
     - Escape closes the dropdown
     - Outside click closes the dropdown
   ---------------------------------------------------------- */
function buildTopbar() {
  const topbar = document.getElementById('topbar');
  /* Guard: only inject once */
  if (!topbar || document.getElementById('school-switcher')) return;

  /* --- Hamburger button (visible only on mobile via CSS) ---
     Toggles .sidebar-open on .app-shell. Three <span> bars
     are styled purely via CSS — no icon font required.       */
  const appShell  = document.querySelector('.app-shell');
  const hamburger = document.createElement('button');
  hamburger.id        = 'hamburger';
  hamburger.className = 'hamburger';
  hamburger.setAttribute('aria-label', 'Toggle navigation');
  hamburger.innerHTML = '<span></span><span></span><span></span>';
  topbar.prepend(hamburger);

  /* --- Sidebar overlay (mobile only — blocks content behind open sidebar) --- */
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id        = 'sidebar-overlay';
  if (appShell) appShell.appendChild(overlay);

  /* Open / close handlers */
  hamburger.addEventListener('click', function () {
    if (appShell) appShell.classList.toggle('sidebar-open');
  });

  overlay.addEventListener('click', function () {
    if (appShell) appShell.classList.remove('sidebar-open');
  });

  /* Tapping a nav item on mobile closes the sidebar automatically */
  const sidebarNav = document.getElementById('sidebar-nav');
  if (sidebarNav) {
    sidebarNav.addEventListener('click', function () {
      if (appShell) appShell.classList.remove('sidebar-open');
    });
  }

  /* Build and inject the switcher HTML */
  const switcherEl       = document.createElement('div');
  switcherEl.className   = 'school-switcher';
  switcherEl.id          = 'school-switcher';
  switcherEl.setAttribute('aria-haspopup', 'listbox');
  switcherEl.innerHTML   = `
    <select class="school-switcher-conf" id="switcher-conf" aria-label="Filter by conference">
      <option value="">All</option>
      <option value="SEC">SEC</option>
      <option value="Big Ten">Big Ten</option>
      <option value="Big 12">Big 12</option>
      <option value="ACC">ACC</option>
      <option value="G5">G5</option>
    </select>
    <input
      id="switcher-input"
      class="school-switcher-input"
      type="text"
      placeholder="Search schools\u2026"
      autocomplete="off"
      aria-label="Search schools"
      aria-expanded="false"
      aria-autocomplete="list"
    />
    <div class="school-switcher-dropdown" id="switcher-dropdown" role="listbox"></div>
  `;
  topbar.appendChild(switcherEl);

  /* Element refs */
  const confSelect = document.getElementById('switcher-conf');
  const input      = document.getElementById('switcher-input');
  const dropdown   = document.getElementById('switcher-dropdown');

  /* All schools from the SCHOOLS_DATA global */
  const allSchools = (SCHOOLS_DATA && SCHOOLS_DATA.teams) || [];

  /* ----------------------------------------------------------
     _renderDropdown
     Filters allSchools by active conference group and current
     input text. Requires at least 1 character to open.
     ---------------------------------------------------------- */
  function _renderDropdown() {
    const confFilter = confSelect.value;
    const query      = input.value.trim().toLowerCase();

    /* Dropdown only opens when the user is actively typing */
    if (!query) {
      _closeDropdown();
      return;
    }

    const results = allSchools
      .filter(function (s) {
        const matchConf  = !confFilter || _confGroup(s.conference) === confFilter;
        const matchQuery = s.name.toLowerCase().includes(query);
        return matchConf && matchQuery;
      })
      .slice(0, 12);

    if (results.length === 0) {
      dropdown.innerHTML = `<div class="school-switcher-empty">No schools found.</div>`;
    } else {
      /* Derive CFBD-compatible school name by stripping the mascot */
      dropdown.innerHTML = results.map(function (s) {
        const cfbdName = s.name.replace(s.mascot, '').trim();
        return `
          <div class="school-switcher-item"
               role="option"
               tabindex="-1"
               data-team="${cfbdName}">
            <span>${s.name}</span>
            <span class="school-switcher-conference">${s.conference}</span>
          </div>`;
      }).join('');
    }

    dropdown.classList.add('is-open');
    input.setAttribute('aria-expanded', 'true');
  }

  /* ----------------------------------------------------------
     _closeDropdown / _selectSchool
     ---------------------------------------------------------- */
  function _closeDropdown() {
    dropdown.classList.remove('is-open');
    dropdown.innerHTML = '';
    input.setAttribute('aria-expanded', 'false');
  }

  function _selectSchool(cfbdName) {
    input.value = '';
    _closeDropdown();
    window.location.hash = '#school?team=' + encodeURIComponent(cfbdName);
  }

  /* ----------------------------------------------------------
     Event Bindings
     ---------------------------------------------------------- */

  /* Text input — re-render on every keystroke */
  input.addEventListener('input', _renderDropdown);

  /* Conference select — changing conference re-renders if query exists */
  confSelect.addEventListener('change', function () {
    if (input.value.trim()) _renderDropdown();
  });

  /* Keyboard: Escape closes; ArrowDown moves focus into list */
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      _closeDropdown();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const first = dropdown.querySelector('.school-switcher-item');
      if (first) first.focus();
    }
  });

  /* Arrow nav + Enter + Escape within the dropdown item list */
  dropdown.addEventListener('keydown', function (e) {
    const items  = Array.from(dropdown.querySelectorAll('.school-switcher-item'));
    const idx    = items.indexOf(document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (idx < items.length - 1) items[idx + 1].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx > 0) items[idx - 1].focus();
      else input.focus();
    } else if (e.key === 'Enter') {
      const active = document.activeElement;
      if (active && active.dataset.team) _selectSchool(active.dataset.team);
    } else if (e.key === 'Escape') {
      _closeDropdown();
      input.focus();
    }
  });

  /* Click on a result — delegate to dropdown container */
  dropdown.addEventListener('click', function (e) {
    const item = e.target.closest('.school-switcher-item');
    if (item && item.dataset.team) _selectSchool(item.dataset.team);
  });

  /* Close when clicking anywhere outside the switcher */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#school-switcher')) _closeDropdown();
  });
}

/* ----------------------------------------------------------
   bindSchoolLinks
   Attaches one delegated click listener to #page-content that
   handles all .school-link clicks across every page view.
   Called once at init — the listener survives route changes
   because #page-content itself is never replaced, only its
   innerHTML. School links only exist on the home page so
   clicks on other pages fall through harmlessly.

   Navigation format: #school?team=CFBD_NAME
   ---------------------------------------------------------- */
function bindSchoolLinks() {
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  pageContent.addEventListener('click', function (e) {
    const link = e.target.closest('.school-link');
    if (!link || !link.dataset.team) return;
    window.location.hash = '#school?team=' + encodeURIComponent(link.dataset.team);
  });
}

/* ----------------------------------------------------------
   init
   Main app initialization sequence. Order matters:
     1. Sidebar — must be built before router renders
     2. Topbar  — school switcher injected once at startup
     3. School link handler — delegated listener on page-content
     4. Router  — renders first route and starts listening
   ---------------------------------------------------------- */
function init() {
  buildSidebar();
  buildTopbar();
  bindSchoolLinks();
  initRouter();
}

/* ----------------------------------------------------------
   Bootstrap
   Wait for DOM to be fully parsed before running init.
   ---------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', init);
