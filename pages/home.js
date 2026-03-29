'use strict';

/* =============================================================
   pages/home.js — FieldIQ Home Page
   Exposes: HomePage.render()
   Depends on: nothing
   Theme: neutral only — no school colors. resetTheme() is
   called by the router before this renders.
   ============================================================= */

const HomePage = {

  /* ----------------------------------------------------------
     render
     Returns the HTML string for the home page view.
     The router injects this into #page-content.
     ---------------------------------------------------------- */
  render() {
    return `
      <div class="page-home">
        <p>Home page — placeholder</p>
      </div>
    `;
  },

};
