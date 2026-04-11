'use strict';

/* =============================================================
   theme.js — FieldIQ School Theme Engine
   Exposes: applyTheme(primaryColor, secondaryColor)
            restoreTheme()
            resetTheme()
   Depends on: nothing (loads first, no dependencies)
   ============================================================= */

/* ----------------------------------------------------------
   hexToHsl
   Converts a CSS hex color string (#RRGGBB or #RGB) to an
   HSL object: { h: 0-360, s: 0-100, l: 0-100 }
   Used internally to derive the accent color.
   ---------------------------------------------------------- */
function hexToHsl(hex) {
  // Expand shorthand #RGB to #RRGGBB
  const expanded = hex.replace(
    /^#([a-f\d])([a-f\d])([a-f\d])$/i,
    (_, r, g, b) => `#${r}${r}${g}${g}${b}${b}`
  );

  const r = parseInt(expanded.slice(1, 3), 16) / 255;
  const g = parseInt(expanded.slice(3, 5), 16) / 255;
  const b = parseInt(expanded.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));

    switch (max) {
      case r: h = ((g - b) / delta + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / delta + 2) / 6; break;
      case b: h = ((r - g) / delta + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/* ----------------------------------------------------------
   hslToHex
   Converts HSL values back to a #RRGGBB hex string.
   Used after lightening to produce the accent hex value.
   ---------------------------------------------------------- */
function hslToHex(h, s, l) {
  const sNorm = s / 100;
  const lNorm = l / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = lNorm - c / 2;

  let r = 0, g = 0, b = 0;

  if      (h < 60)  { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }

  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/* ----------------------------------------------------------
   deriveAccent
   Lightens the primary color by a fixed amount (default 20
   lightness points) to produce --school-accent.
   Clamps lightness at 90 to avoid washing out to near-white.
   ---------------------------------------------------------- */
function deriveAccent(primaryHex, lightenAmount = 20) {
  const { h, s, l } = hexToHsl(primaryHex);
  const newL = Math.min(l + lightenAmount, 90);
  return hslToHex(h, s, newL);
}

/* ----------------------------------------------------------
   applyTheme
   Main public function. Accepts two hex color strings and:
     1. Updates --school-primary on the root element
     2. Updates --school-secondary on the root element
     3. Derives and updates --school-accent from primary
     4. Persists the theme to localStorage for reload recall
   ---------------------------------------------------------- */
function applyTheme(primaryColor, secondaryColor) {
  const root = document.documentElement;
  const accent = deriveAccent(primaryColor);

  root.style.setProperty('--school-primary', primaryColor);
  root.style.setProperty('--school-secondary', secondaryColor);
  root.style.setProperty('--school-accent', accent);

  // Persist so the correct theme loads on next page open
  localStorage.setItem('fieldiq_theme', JSON.stringify({
    primary: primaryColor,
    secondary: secondaryColor,
    accent,
  }));
}

/* ----------------------------------------------------------
   restoreTheme
   Called by the router when navigating to a #school route.
   Reads localStorage and re-applies the last used school theme,
   or falls back to Texas as the default first-time school view.
   NOT called on #home — home uses neutral FieldIQ branding only.
   ---------------------------------------------------------- */
function restoreTheme() {
  const saved = localStorage.getItem('fieldiq_theme');
  if (saved) {
    try {
      const { primary, secondary } = JSON.parse(saved);
      applyTheme(primary, secondary);
    } catch {
      // Corrupted storage entry — fall back to Texas default
      applyTheme('#BF5700', '#FFFFFF');
    }
  } else {
    // No saved theme — first-time school view defaults to Texas
    applyTheme('#BF5700', '#FFFFFF');
  }
}

/* ----------------------------------------------------------
   resetTheme
   Called by the router when navigating to #home.
   Removes all school color influence by setting the school
   vars to neutral values. Does NOT clear localStorage —
   the saved school theme is preserved for when the user
   navigates back to a school page.
   ---------------------------------------------------------- */
function resetTheme() {
  const root = document.documentElement;
  root.style.setProperty('--school-primary',   '#2a3050');
  root.style.setProperty('--school-secondary', '#ffffff');
  root.style.setProperty('--school-accent',    '#3a4060');
}

/* =============================================================
   Phase 11a — Dynamic Theming Helpers
   Added below. All functions above are untouched.
   ============================================================= */

/* ----------------------------------------------------------
   _normalizeHex
   Accepts a raw color string from CFBD and returns a clean
   #RRGGBB string, or '' if the value is unrecognizable.
   CFBD sometimes returns hex values without the # prefix
   (e.g. "BF5700" instead of "#BF5700") — both are handled.

   @param {string} raw — raw color value from the CFBD API
   @returns {string} — normalized '#RRGGBB' or empty string
   ---------------------------------------------------------- */
function _normalizeHex(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (/^#[0-9a-f]{3,6}$/i.test(trimmed)) return trimmed;        // already valid
  if (/^[0-9a-f]{6}$/i.test(trimmed))    return '#' + trimmed;  // missing #
  return '';                                                      // unrecognizable
}

/* ----------------------------------------------------------
   _hexBrightness
   Computes perceived brightness of a hex color using the
   W3C / ITU-R BT.601 formula. Returns a value on 0–255 scale.
   Used to reject colors too dark to distinguish from the
   dark UI background.

   @param {string} hex — valid hex string, e.g. '#BF5700'
   @returns {number} — brightness 0 (black) to 255 (white)
   ---------------------------------------------------------- */
function _hexBrightness(hex) {
  const expanded = hex.replace(
    /^#([a-f\d])([a-f\d])([a-f\d])$/i,
    (_, r, g, b) => `#${r}${r}${g}${g}${b}${b}`
  );
  const r = parseInt(expanded.slice(1, 3), 16);
  const g = parseInt(expanded.slice(3, 5), 16);
  const b = parseInt(expanded.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/* ----------------------------------------------------------
   applyThemeFromTeam
   Validates and applies school colors from a CFBD team object.
   Called by school.js after fetchTeamInfo() resolves — overrides
   the sync restoreTheme() defaults with live CFBD data.

   Validation rules:
     Primary missing or falsy        → fallback #4a5568
     Primary brightness < 40         → fallback #4a5568
       (prevents near-black colors blending into dark UI)
     Secondary missing or falsy      → fallback #FFFFFF
     |brightness(secondary) - brightness(primary)| < 30
                                     → fallback #FFFFFF
       (ensures enough contrast between the two school colors)

   @param {Object} teamObj — CFBD team object from fetchTeamInfo()
   ---------------------------------------------------------- */
function applyThemeFromTeam(teamObj) {
  const FALLBACK_PRIMARY   = '#4a5568';
  const FALLBACK_SECONDARY = '#FFFFFF';
  const MIN_PRIMARY_BRIGHTNESS = 40;
  const MIN_CONTRAST_DELTA     = 30;

  /* Check SCHOOLS_DATA for a colorOverride before using CFBD data */
  let rawPrimary   = teamObj && teamObj.color     ? teamObj.color     : '';
  let rawSecondary = teamObj && teamObj.alt_color ? teamObj.alt_color : '';
  if (teamObj && teamObj.school && typeof SCHOOLS_DATA !== 'undefined') {
    const schoolEntry = (SCHOOLS_DATA.teams || []).find(function (t) {
      return t.name.replace(t.mascot, '').trim() === teamObj.school;
    });
    if (schoolEntry && schoolEntry.colorOverride) {
      if (schoolEntry.colorOverride.primary)   rawPrimary   = schoolEntry.colorOverride.primary;
      if (schoolEntry.colorOverride.secondary) rawSecondary = schoolEntry.colorOverride.secondary;
    }
  }

  /* Normalize raw strings — CFBD inconsistently includes '#' */
  let primary   = _normalizeHex(rawPrimary);
  let secondary = _normalizeHex(rawSecondary);

  /* Validate primary — reject missing or too-dark colors */
  if (!primary || _hexBrightness(primary) < MIN_PRIMARY_BRIGHTNESS) {
    primary = FALLBACK_PRIMARY;
  }

  /* Validate secondary — reject missing or colors too close to primary */
  if (!secondary || Math.abs(_hexBrightness(secondary) - _hexBrightness(primary)) < MIN_CONTRAST_DELTA) {
    secondary = FALLBACK_SECONDARY;
  }

  /* Delegate to existing applyTheme — saves to localStorage automatically */
  applyTheme(primary, secondary);
}
