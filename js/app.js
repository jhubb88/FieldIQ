'use strict';

/* =============================================================
   app.js — FieldIQ Entry Point
   Runs last. Depends on: theme.js, api.js, router.js,
                          pages/home.js, pages/school.js
   Initializes the app on DOMContentLoaded.
   ============================================================= */

/* ----------------------------------------------------------
   Sidebar Nav Definition
   Each entry maps a display label to a route name.
   The data-route attribute is used by the router to sync
   the active state when the page changes.
   ---------------------------------------------------------- */
const NAV_ITEMS = [
  { label: 'Home',    route: 'home'   },
  { label: 'Schools', route: 'school' },
];

/* ----------------------------------------------------------
   buildSidebar
   Renders the logo wordmark and injects nav items into the
   #sidebar-nav element. Adds click handlers that call
   navigate() from router.js.
   ---------------------------------------------------------- */
function buildSidebar() {
  // Logo area
  const logoEl = document.getElementById('sidebar-logo');
  if (logoEl) {
    logoEl.innerHTML = `
      <span class="sidebar-logo-text">Field<span class="sidebar-logo-accent">IQ</span></span>
    `;
  }

  // Nav items
  const navEl = document.getElementById('sidebar-nav');
  if (!navEl) return;

  navEl.innerHTML = NAV_ITEMS.map((item) => `
    <div class="nav-item" data-route="${item.route}" role="button" tabindex="0"
         aria-label="Navigate to ${item.label}">
      ${item.label}
    </div>
  `).join('');

  // Attach click + keyboard handlers to each nav item
  navEl.querySelectorAll('.nav-item[data-route]').forEach((el) => {
    el.addEventListener('click', () => {
      navigate(el.dataset.route);
    });

    // Allow keyboard activation (Enter / Space)
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigate(el.dataset.route);
      }
    });
  });
}

/* ----------------------------------------------------------
   init
   Main app initialization sequence. Order matters:
     1. Build sidebar nav
     2. Start the router (renders first page view)
   Theme is intentionally NOT applied here. The router owns
   theme switching: resetTheme() on #home, restoreTheme() on
   #school. This ensures the home page always starts neutral.
   ---------------------------------------------------------- */
function init() {
  // 1. Sidebar — must be built before router renders, so nav-item
  //    active states can be synced on the initial render.
  buildSidebar();

  // 2. Router — sets up hashchange listener and renders the first route.
  //    The router will call resetTheme() or restoreTheme() as appropriate.
  initRouter();
}

/* ----------------------------------------------------------
   Bootstrap
   Wait for the DOM to be fully parsed before running init.
   ---------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', init);
