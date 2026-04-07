'use strict';

/* =============================================================
   js/market.js — FieldIQ Market Performance Compute Engine
   Exposes: computeATSRecord, computeOURecord,
            computeHomeUnderdogATS, computeCoverStreaks

   Pure computation — no DOM, no API calls.
   Takes completed games array and lines array (from
   fetchGameLines in api.js). Lines are matched to games by
   game id. Games with no matching line are skipped.

   Phase 7 — wires Market Performance lens with live data.
   Phase 10 note: fetchGameLines() is already generic (accepts
   school + year) — H2H Search reuses it without modification.
   ============================================================= */

/* =============================================================
   Internal — Line Lookup + ATS Result
   ============================================================= */

/* ----------------------------------------------------------
   _getConsensusLine
   Finds the consensus line entry for a game from the lines
   array. Returns null if no matching line or no consensus
   provider is found.

   @param {Object} game  — raw CFBD game object
   @param {Array}  lines — fetchGameLines() output
   @returns {{ spread: number|null, overUnder: number|null } | null}
   ---------------------------------------------------------- */
function _getConsensusLine(game, lines) {
  const entry = lines.find(function (l) { return l.id === game.id; });
  if (!entry || !Array.isArray(entry.lines) || entry.lines.length === 0) return null;

  const consensus = entry.lines.find(function (l) { return l.provider === 'consensus'; })
                 || entry.lines[0];
  if (!consensus) return null;

  const spread    = consensus.spread    !== null && consensus.spread    !== ''
    ? parseFloat(consensus.spread)    : null;
  const overUnder = consensus.overUnder !== null && consensus.overUnder !== ''
    ? parseFloat(consensus.overUnder) : null;

  return {
    spread:    spread    !== null && !isNaN(spread)    ? spread    : null,
    overUnder: overUnder !== null && !isNaN(overUnder) ? overUnder : null,
  };
}

/* ----------------------------------------------------------
   _atsResult
   Determines ATS outcome for one game from the school's
   perspective. Spread in CFBD is from the home team's view —
   negative means home team is favored.

   Returns 'win', 'loss', or 'push'. Returns null if no
   valid spread is available.

   @param {Object} game   — raw CFBD game object
   @param {Object} line   — _getConsensusLine() output
   @param {string} school — CFBD team name
   @returns {'win'|'loss'|'push'|null}
   ---------------------------------------------------------- */
function _atsResult(game, line, school) {
  if (!line || line.spread === null) return null;

  const isHome     = game.homeTeam === school;
  const teamScore  = isHome ? game.homePoints : game.awayPoints;
  const oppScore   = isHome ? game.awayPoints  : game.homePoints;
  const margin     = teamScore - oppScore;

  /* Flip spread to school's perspective: home spread is negative when favored */
  const teamSpread = isHome ? line.spread : -line.spread;
  const atsMargin  = margin + teamSpread;

  if (Math.abs(atsMargin) < 0.01) return 'push';
  return atsMargin > 0 ? 'win' : 'loss';
}

/* =============================================================
   Public — Compute Functions
   ============================================================= */

/* ----------------------------------------------------------
   computeATSRecord
   Calculates ATS record overall, at home, and away.
   Skips games with no line available.

   @param {Array}  completed — _completedGames() output from school.js
   @param {Array}  lines     — fetchGameLines() output
   @param {string} school    — CFBD team name
   @returns {{
     overall: { wins: number, losses: number, pushes: number },
     home:    { wins: number, losses: number, pushes: number },
     away:    { wins: number, losses: number, pushes: number }
   }}
   ---------------------------------------------------------- */
function computeATSRecord(completed, lines, school) {
  const overall = { wins: 0, losses: 0, pushes: 0 };
  const home    = { wins: 0, losses: 0, pushes: 0 };
  const away    = { wins: 0, losses: 0, pushes: 0 };

  completed.forEach(function (g) {
    const line   = _getConsensusLine(g, lines);
    const result = _atsResult(g, line, school);
    if (!result) return; /* no line — skip */

    const isHome = g.homeTeam === school;
    const bucket = isHome ? home : away;

    if (result === 'win')  { overall.wins++;   bucket.wins++;   }
    if (result === 'loss') { overall.losses++; bucket.losses++; }
    if (result === 'push') { overall.pushes++; bucket.pushes++; }
  });

  return { overall, home, away };
}

/* ----------------------------------------------------------
   computeOURecord
   Calculates over/under record for all games with an O/U line.
   Total points = homePoints + awayPoints.

   @param {Array} completed — _completedGames() output from school.js
   @param {Array} lines     — fetchGameLines() output
   @returns {{ overs: number, unders: number, pushes: number }}
   ---------------------------------------------------------- */
function computeOURecord(completed, lines) {
  let overs = 0, unders = 0, pushes = 0;

  completed.forEach(function (g) {
    const line = _getConsensusLine(g, lines);
    if (!line || line.overUnder === null) return; /* no O/U — skip */

    const total = g.homePoints + g.awayPoints;
    const diff  = total - line.overUnder;

    if (Math.abs(diff) < 0.01) pushes++;
    else if (diff > 0)         overs++;
    else                       unders++;
  });

  return { overs, unders, pushes };
}

/* ----------------------------------------------------------
   computeHomeUnderdogATS
   Counts ATS record specifically when the school is a home
   underdog (spread favors the visiting team, meaning the
   home spread is positive from CFBD's perspective).

   Returns null if fewer than 2 home underdog situations exist
   — not enough data to surface a meaningful pattern.

   @param {Array}  completed — _completedGames() output from school.js
   @param {Array}  lines     — fetchGameLines() output
   @param {string} school    — CFBD team name
   @returns {{ wins: number, losses: number, pushes: number, total: number } | null}
   ---------------------------------------------------------- */
function computeHomeUnderdogATS(completed, lines, school) {
  let wins = 0, losses = 0, pushes = 0;

  completed.forEach(function (g) {
    /* Must be a home game */
    if (g.homeTeam !== school) return;

    const line = _getConsensusLine(g, lines);
    if (!line || line.spread === null) return;

    /* Home underdog = positive spread (visitor is favored) */
    if (line.spread <= 0) return;

    const result = _atsResult(g, line, school);
    if (!result) return;

    if (result === 'win')  wins++;
    if (result === 'loss') losses++;
    if (result === 'push') pushes++;
  });

  const total = wins + losses + pushes;
  if (total < 2) return null;

  return { wins, losses, pushes, total };
}

/* ----------------------------------------------------------
   computeCoverStreaks
   Finds the longest consecutive ATS cover streak (wins) and
   the longest consecutive non-cover streak (losses + pushes)
   across the season, ordered chronologically by start date.

   @param {Array}  completed — _completedGames() output from school.js
   @param {Array}  lines     — fetchGameLines() output
   @param {string} school    — CFBD team name
   @returns {{ bestStreak: number, worstStreak: number }}
   ---------------------------------------------------------- */
function computeCoverStreaks(completed, lines, school) {
  /* Sort chronologically so streaks follow game order */
  const sorted = completed.slice().sort(function (a, b) {
    return new Date(a.startDate) - new Date(b.startDate);
  });

  let bestStreak      = 0;
  let worstStreak     = 0;
  let currentCover    = 0; /* consecutive covers */
  let currentNonCover = 0; /* consecutive non-covers (loss or push) */

  sorted.forEach(function (g) {
    const line   = _getConsensusLine(g, lines);
    const result = _atsResult(g, line, school);
    if (!result) return; /* no line — skip, don't break streak */

    if (result === 'win') {
      /* Covered — extend cover streak, reset non-cover streak */
      currentCover++;
      currentNonCover = 0;
      if (currentCover > bestStreak) bestStreak = currentCover;
    } else {
      /* Loss or push — extend non-cover streak, reset cover streak */
      currentNonCover++;
      currentCover = 0;
      if (currentNonCover > worstStreak) worstStreak = currentNonCover;
    }
  });

  return { bestStreak, worstStreak };
}
