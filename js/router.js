'use strict';

/* =============================================================
   router.js — FieldIQ Hash-Based Router
   Exposes: navigate(page, params), initRouter()
   Depends on: pages/home.js, pages/school.js (must load first)

   Uses the URL hash (#home, #school) as the routing signal.
   No server required — works with file:// and any static host.
   ============================================================= */

/* ----------------------------------------------------------
   Route Map
   Maps hash names to their page module render functions.
   Add new routes here as pages are built out.
   ---------------------------------------------------------- */
const ROUTES = {
  home:   () => HomePage.render(),
  school: (params) => SchoolPage.render(params),
};

/* ----------------------------------------------------------
   parseHash
   Reads window.location.hash and splits it into:
     - page: the route name (e.g. 'home', 'school')
     - params: key/value pairs from the query-style hash
               e.g. #school?id=texas → { id: 'texas' }
   ---------------------------------------------------------- */
function parseHash() {
  const raw = window.location.hash.replace('#', '') || 'home';
  const [page, queryString] = raw.split('?');

  const params = {};
  if (queryString) {
    queryString.split('&').forEach((pair) => {
      const [key, value] = pair.split('=');
      if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    });
  }

  return { page, params };
}

/* ----------------------------------------------------------
   renderCurrentRoute
   Reads the current hash, looks up the matching route,
   and injects the rendered HTML into #page-content.
   Falls back to the home route if the hash is unrecognized.
   ---------------------------------------------------------- */
function renderCurrentRoute() {
  const { page, params } = parseHash();
  const pageContent = document.getElementById('page-content');

  if (!pageContent) return;

  // Theme switching — home is always neutral, school restores saved theme.
  // This runs before render so any school-colored elements in the page
  // HTML pick up the correct CSS variable values immediately.
  if (page === 'school') {
    restoreTheme();
  } else {
    resetTheme();
  }

  // Unmount previous page if it has cleanup to do (e.g. mosaic teardown)
  if (page !== 'home' && typeof HomePage.unmount === 'function') {
    HomePage.unmount();
  }

  // Toggle body class so CSS can adapt per route (e.g. transparent bg on home)
  document.body.classList.toggle('is-home', page === 'home');

  const routeFn = ROUTES[page] || ROUTES['home'];
  pageContent.innerHTML = routeFn(params);

  // Sync active state on sidebar nav items
  document.querySelectorAll('.nav-item[data-route]').forEach((item) => {
    item.classList.toggle('active', item.dataset.route === page);
  });

  // Update topbar title to current page name
  const topbarTitle = document.getElementById('topbar-title');
  if (topbarTitle) {
    topbarTitle.textContent = page.charAt(0).toUpperCase() + page.slice(1);
  }
}

/* ----------------------------------------------------------
   navigate
   Programmatic navigation. Updates the hash and triggers
   a render without requiring a full page reload.

   @param {string} page    — Route name: 'home' | 'school'
   @param {Object} params  — Optional query params, e.g. { id: 'texas' }

   Usage:
     navigate('school', { id: 'texas' });
     navigate('home');
   ---------------------------------------------------------- */
function navigate(page, params = {}) {
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  window.location.hash = query ? `${page}?${query}` : page;
  // hashchange event fires automatically, which calls renderCurrentRoute
}

/* ----------------------------------------------------------
   initRouter
   Sets up the hashchange listener and renders the initial
   route on page load. Called by app.js on DOMContentLoaded.
   ---------------------------------------------------------- */
function initRouter() {
  // Re-render whenever the hash changes (back/forward, nav clicks, navigate())
  window.addEventListener('hashchange', renderCurrentRoute);

  // If the URL has no hash, set the default route before first render
  if (!window.location.hash) {
    window.location.hash = 'home';
  }

  renderCurrentRoute();
}
