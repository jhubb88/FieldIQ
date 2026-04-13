'use strict';

/* =============================================================
   js/situational.js — FieldIQ Situational Compute Engine
   Exposes: computeHomeAwaySplits, computeNightGameRecord,
            computeRevengeGames, computeRecordVsRanked,
            computeBowlRecord

   Pure computation — no DOM, no API calls.
   Takes completed game arrays and returns plain objects ready
   for renderSituational() in school.js.

   Phase 7 — wires Situational lens with live data.
   Phase 12 note: computeBowlRecord accepts any multi-year
   array — just pass more seasons to extend all-time record.
   ============================================================= */

/* =============================================================
   Internal — Game Normalization
   Derives team/opponent scores, margin, and opponent name
   from a raw CFBD game object and the current school name.
   ============================================================= */

/* ----------------------------------------------------------
   _sitMargin
   Returns team and opponent scores, margin, win flag, home
   flag, and opponent name for a single completed game.

   @param {Object} game   — raw CFBD game object
   @param {string} school — CFBD team name
   @returns {{ teamScore, oppScore, margin, isWin, isHome, opponent }}
   ---------------------------------------------------------- */
function _sitMargin(game, school) {
  const isHome    = game.homeTeam === school;
  const teamScore = isHome ? game.homePoints : game.awayPoints;
  const oppScore  = isHome ? game.awayPoints  : game.homePoints;
  const opponent  = isHome ? game.awayTeam   : game.homeTeam;
  const margin    = teamScore - oppScore;
  return { teamScore, oppScore, margin, isWin: margin > 0, isHome, opponent };
}

/* =============================================================
   Public — Compute Functions
   ============================================================= */

/* ----------------------------------------------------------
   computeHomeAwaySplits
   Calculates separate W-L records and scoring averages for
   home and away games. Used to surface whether a program
   performs meaningfully differently at home vs on the road.

   @param {Array}  completed — _completedGames() output from school.js
   @param {string} school    — CFBD team name
   @returns {{
     homeWins:       number,
     homeLosses:     number,
     awayWins:       number,
     awayLosses:     number,
     homeAvgScore:   string|null,
     homeAvgAllowed: string|null,
     awayAvgScore:   string|null,
     awayAvgAllowed: string|null
   }}
   ---------------------------------------------------------- */
function computeHomeAwaySplits(completed, school) {
  const homeGames = completed.filter(function (g) { return g.homeTeam === school; });
  const awayGames = completed.filter(function (g) { return g.awayTeam === school; });

  /* Tally wins, total scored, total allowed for one split */
  function _tally(games) {
    let wins = 0, losses = 0, scored = 0, allowed = 0;
    games.forEach(function (g) {
      const { teamScore, oppScore, isWin } = _sitMargin(g, school);
      scored  += teamScore;
      allowed += oppScore;
      if (isWin) wins++; else losses++;
    });
    const n = games.length;
    return {
      wins,
      losses,
      avgScore:   n > 0 ? (scored  / n).toFixed(1) : null,
      avgAllowed: n > 0 ? (allowed / n).toFixed(1) : null,
    };
  }

  const home = _tally(homeGames);
  const away = _tally(awayGames);

  return {
    homeWins:       home.wins,
    homeLosses:     home.losses,
    awayWins:       away.wins,
    awayLosses:     away.losses,
    homeAvgScore:   home.avgScore,
    homeAvgAllowed: home.avgAllowed,
    awayAvgScore:   away.avgScore,
    awayAvgAllowed: away.avgAllowed,
  };
}

/* ----------------------------------------------------------
   computeNightGameRecord
   Counts W-L in games that started at 6:00 PM CT or later.
   Uses Intl.DateTimeFormat with America/Chicago timezone to
   handle CDT/CST transitions automatically across the season.
   Games with a missing or unparseable startDate are excluded.

   @param {Array}  completed — _completedGames() output from school.js
   @param {string} school    — CFBD team name
   @returns {{ wins: number, losses: number, total: number }}
   ---------------------------------------------------------- */
function computeNightGameRecord(completed, school) {
  /* Format that extracts the local CT hour as a 24-hour number */
  const ctHourFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour:     'numeric',
    hour12:   false,
  });

  let wins = 0, losses = 0;

  completed.forEach(function (g) {
    if (!g.startDate) return;

    const date = new Date(g.startDate);
    if (isNaN(date.getTime())) return;

    /* Extract CT hour as integer (0–23) */
    const hour = parseInt(ctHourFmt.format(date), 10);
    if (isNaN(hour)) return;

    /* Night game = kickoff at 6:00 PM CT (hour 18) or later */
    if (hour < 18) return;

    const { isWin } = _sitMargin(g, school);
    if (isWin) wins++; else losses++;
  });

  return { wins, losses, total: wins + losses };
}

/* ----------------------------------------------------------
   computeRevengeGames
   Finds current-season games against opponents who beat the
   school in the prior season, then flags the outcome.

   Ties (margin === 0) in the prior season are excluded from
   the "beaten by" set — only true losses (margin < 0) count.

   Team name comparison uses the opponent field derived by
   _sitMargin, which correctly reads homeTeam vs awayTeam
   based on which side the school played.

   Returns an empty array if no prior-year losses exist or
   if none of those opponents appear in the current season.

   @param {Array}  completedCurrent — current season completed games
   @param {Array}  completedPrior   — prior season completed games
   @param {string} school           — CFBD team name
   @returns {Array<{ opponent: string, result: string, margin: string, won: boolean }>}
   ---------------------------------------------------------- */
function computeRevengeGames(completedCurrent, completedPrior, school) {
  if (!Array.isArray(completedPrior) || completedPrior.length === 0) return [];

  /* Step 1: collect every opponent who beat school in the prior season.
     Ties (margin === 0) are excluded — only margin < 0 is a loss. */
  const beatenBy = new Set();
  completedPrior.forEach(function (g) {
    const { margin, opponent } = _sitMargin(g, school);
    if (margin < 0) beatenBy.add(opponent);
  });

  if (beatenBy.size === 0) return [];

  /* Step 2: find current season games vs those opponents and record outcome */
  const revengeGames = [];
  completedCurrent.forEach(function (g) {
    const { isWin, margin, opponent } = _sitMargin(g, school);
    if (beatenBy.has(opponent)) {
      revengeGames.push({
        opponent,
        result: isWin ? 'W' : 'L',
        margin: isWin ? `+${margin}` : `${margin}`,
        won:    isWin,
      });
    }
  });

  return revengeGames;
}

/* ----------------------------------------------------------
   computeRecordVsRanked
   Counts W-L against ranked opponents using the homeRank and
   awayRank fields on each CFBD game object. An opponent is
   ranked if their rank field is a positive integer (1–25).

   Returns null if no game in the set has any rank data at all
   (CFBD did not include rankings for this dataset). The caller
   skips the subsection entirely when null is returned.

   @param {Array}  completed — _completedGames() output from school.js
   @param {string} school    — CFBD team name
   @returns {{ wins: number, losses: number, total: number } | null}
   ---------------------------------------------------------- */
function computeRecordVsRanked(completed, school) {
  /* Bail early if CFBD didn't supply ranking data for any game */
  const hasRankData = completed.some(function (g) {
    return (g.homeRank !== null && g.homeRank !== undefined) ||
           (g.awayRank !== null && g.awayRank !== undefined);
  });

  if (!hasRankData) return null;

  let wins = 0, losses = 0;

  completed.forEach(function (g) {
    /* Opponent rank = the other team's rank field */
    const isHome  = g.homeTeam === school;
    const oppRank = isHome ? g.awayRank : g.homeRank;

    /* Only count games where the opponent was ranked (1–25) */
    if (!oppRank || oppRank < 1) return;

    const { isWin } = _sitMargin(g, school);
    if (isWin) wins++; else losses++;
  });

  return { wins, losses, total: wins + losses };
}

/* ----------------------------------------------------------
   computeBowlRecord
   Returns bowl game history from the provided games array.
   Bowl games are identified by seasonType === 'postseason'.

   Games with missing startDate are excluded from the year
   display and sorted to the bottom of the list.

   The caller controls the year range — Phase 7 passes two
   seasons (current + prior). Phase 12 passes more years for
   an all-time record without any changes to this function.

   @param {Array}  completed — completed games (any year range)
   @param {string} school    — CFBD team name
   @returns {{
     wins:   number,
     losses: number,
     games:  Array<{ year: number|null, opponent: string, result: string, score: string }>
   }}
   ---------------------------------------------------------- */
function computeBowlRecord(completed, school) {
  const bowlGames = completed.filter(function (g) {
    return g.seasonType === 'postseason';
  });

  /* Sort descending — most recent bowl first.
     Games missing startDate fall to the bottom (treated as epoch). */
  bowlGames.sort(function (a, b) {
    const dateA = a.startDate ? new Date(a.startDate) : new Date(0);
    const dateB = b.startDate ? new Date(b.startDate) : new Date(0);
    return dateB - dateA;
  });

  let wins = 0, losses = 0;

  const games = bowlGames.map(function (g) {
    const { teamScore, oppScore, isWin, opponent } = _sitMargin(g, school);

    /* Guard startDate before parsing — null if unavailable */
    const year = g.startDate ? new Date(g.startDate).getFullYear() : null;

    if (isWin) wins++; else losses++;

    return {
      year,
      opponent,
      result: isWin ? 'W' : 'L',
      score:  `${teamScore}-${oppScore}`,
    };
  });

  return { wins, losses, games };
}
