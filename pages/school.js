'use strict';

/* =============================================================
   pages/school.js — FieldIQ School Page
   Exposes: SchoolPage.render(params)
   Depends on: nothing
   Theme: school colors applied — restoreTheme() is called by
   the router before this renders, setting --school-primary etc.
   ============================================================= */

const SchoolPage = {

  /* ----------------------------------------------------------
     render
     Returns the HTML string for the school page view.
     @param {Object} params — Route params from the hash,
                              e.g. { id: 'texas' }
     The router injects this into #page-content.
     ---------------------------------------------------------- */
  render(params = {}) {
    const schoolId = params.id || 'unknown';

    return `
      <div class="page-school">
        <p>School page — placeholder (id: ${schoolId})</p>
      </div>
    `;
  },

};
