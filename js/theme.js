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
