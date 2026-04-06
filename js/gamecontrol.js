'use strict';

/* =============================================================
   js/gamecontrol.js — FieldIQ Game Control + Volatility Engine
   Exposes: computeBlowoutProfile, computeHalfScoring,
            computeCloseGameRecord, computeScoreDifferentials,
            computeConsistencyRating, computeTrapGameIndex,
            computeLargestWinLoss

   Takes the completed games array already built in school.js
   loadData() — raw CFBD game objects with null scores filtered
   out. Pure computation — no DOM, no API calls.

   Phase 7 note: computeCloseGameRecord accepts any subset of
   games so it can be reused for situational splits (home-only,
   away-only, vs ranked, etc.) without modification.
   ============================================================= */

/* =============================================================
   Internal — Math Utilities
   Reimplemented locally — do not import from dna.js.
   ============================================================= */

/* Returns the arithmetic mean of a number array. */
function _gcAvg(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce(function (sum, v) { return sum + v; }, 0) / arr.length;
}

/* Returns population standard deviation of a number array. */
function _gcStdDev(arr) {
  if (arr.length < 2) return 0;
  const mean     = _gcAvg(arr);
  const variance = _gcAvg(arr.map(function (v) { return (v - mean) * (v - mean); }));
  return Math.sqrt(variance);
}

/* =============================================================
   Internal — Game Normalization
   Derives team/opp scores and margin from a raw CFBD game
   object and school name. Used by all compute functions.
   ============================================================= */

/* ----------------------------------------------------------
   _gcMargin
   Returns { teamScore, oppScore, margin, isWin, isHome }
   for a single completed game.
   @param {Object} game   — raw CFBD game object
   @param {string} school — CFBD team name
   ---------------------------------------------------------- */
function _gcMargin(game, school) {
  const isHome    = game.homeTeam === school;
  const teamScore = isHome ? game.homePoints : game.awayPoints;
  const oppScore  = isHome ? game.awayPoints  : game.homePoints;
  const margin    = teamScore - oppScore;
  return { teamScore, oppScore, margin, isWin: margin > 0, isHome };
}

/* =============================================================
   Public — Compute Functions
   ============================================================= */

/* ----------------------------------------------------------
   computeBlowoutProfile
   Categorizes wins by margin into three buckets:
     Blowout:     margin >= 15 pts
     Competitive: margin  9–14 pts
     Grinder:     margin <= 8 pts
   Only wins are counted — losses are excluded.

   @param {Array}  completed — _completedGames() output
   @param {string} school    — CFBD team name
   @returns {{ blowout, competitive, grinder,
               blowoutPct, competitivePct, grinderPct }}
   ---------------------------------------------------------- */
function computeBlowoutProfile(completed, school) {
  const wins = completed.filter(function (g) {
    return _gcMargin(g, school).isWin;
  });

  let blowout     = 0;
  let competitive = 0;
  let grinder     = 0;

  wins.forEach(function (g) {
    const { margin } = _gcMargin(g, school);
    if (margin >= 15)      blowout++;
    else if (margin >= 9)  competitive++;
    else                   grinder++;
  });

  const total = wins.length;
  return {
    blowout,
    competitive,
    grinder,
    blowoutPct:     total > 0 ? Math.round((blowout     / total) * 100) : 0,
    competitivePct: total > 0 ? Math.round((competitive / total) * 100) : 0,
    grinderPct:     total > 0 ? Math.round((grinder     / total) * 100) : 0,
  };
}

/* ----------------------------------------------------------
   computeHalfScoring
   Calculates average points scored and allowed by half,
   using homeLineScores / awayLineScores Q-by-Q arrays.
   Returns null when fewer than 4 games have half data —
   the caller skips rendering the Half Scoring subsection.

   @param {Array}  completed — _completedGames() output
   @param {string} school    — CFBD team name
   @returns {{ avg1stHalf, avg2ndHalf,
               avgAllowed1st, avgAllowed2nd }} | null
   ---------------------------------------------------------- */
function computeHalfScoring(completed, school) {
  const withHalf = completed.filter(function (g) {
    const isHome = g.homeTeam === school;
    const ls     = isHome ? g.homeLineScores : g.awayLineScores;
    return Array.isArray(ls) && ls.length >= 4;
  });

  if (withHalf.length < 4) return null;

  const scored1st  = [];
  const scored2nd  = [];
  const allowed1st = [];
  const allowed2nd = [];

  withHalf.forEach(function (g) {
    const isHome  = g.homeTeam === school;
    const teamLS  = isHome ? g.homeLineScores : g.awayLineScores;
    const oppLS   = isHome ? g.awayLineScores  : g.homeLineScores;

    scored1st.push((teamLS[0] || 0) + (teamLS[1] || 0));
    scored2nd.push((teamLS[2] || 0) + (teamLS[3] || 0));

    /* Opponent half scores may be null if not tracked */
    if (Array.isArray(oppLS) && oppLS.length >= 4) {
      allowed1st.push((oppLS[0] || 0) + (oppLS[1] || 0));
      allowed2nd.push((oppLS[2] || 0) + (oppLS[3] || 0));
    }
  });

  return {
    avg1stHalf:    _gcAvg(scored1st).toFixed(1),
    avg2ndHalf:    _gcAvg(scored2nd).toFixed(1),
    avgAllowed1st: allowed1st.length > 0 ? _gcAvg(allowed1st).toFixed(1) : null,
    avgAllowed2nd: allowed2nd.length > 0 ? _gcAvg(allowed2nd).toFixed(1) : null,
  };
}

/* ----------------------------------------------------------
   computeCloseGameRecord
   Counts wins and losses in games decided by 8 pts or less.
   Accepts any subset of completed games — pass home-only,
   away-only, vs-ranked, etc. for Phase 7 situational splits.

   @param {Array}  games  — any subset of completed games
   @param {string} school — CFBD team name
   @returns {{ closeWins, closeLosses, total }}
   ---------------------------------------------------------- */
function computeCloseGameRecord(games, school) {
  const closeGames = games.filter(function (g) {
    const { margin } = _gcMargin(g, school);
    return Math.abs(margin) <= 8;
  });

  const closeWins   = closeGames.filter(function (g) {
    return _gcMargin(g, school).isWin;
  }).length;
  const closeLosses = closeGames.length - closeWins;

  return { closeWins, closeLosses, total: closeGames.length };
}

/* ----------------------------------------------------------
   computeScoreDifferentials
   Returns a week-by-week array of { week, margin, opponent,
   isWin } objects sorted by week ascending.
   Used to render the season arc display.

   @param {Array}  completed — _completedGames() output
   @param {string} school    — CFBD team name
   @returns {Array<{ week, margin, opponent, isWin }>}
   ---------------------------------------------------------- */
function computeScoreDifferentials(completed, school) {
  return completed
    .map(function (g) {
      const { margin, isWin, isHome } = _gcMargin(g, school);
      return {
        week:     g.week,
        margin,
        opponent: isHome ? g.awayTeam : g.homeTeam,
        isWin,
      };
    })
    .sort(function (a, b) { return a.week - b.week; });
}

/* ----------------------------------------------------------
   computeConsistencyRating
   Measures game-to-game variance using the standard deviation
   of point differentials (margin). Lower = more predictable.

   Labels:
     stdDev <= 7  → 'Reliable'
     stdDev >= 14 → 'Volatile'
     otherwise    → 'Consistent'

   Thresholds match the DNA label system in dna.js and
   FieldIQ_Master.md.

   @param {Array}  completed — _completedGames() output
   @param {string} school    — CFBD team name
   @returns {{ stdDev: string, label: string }}
   ---------------------------------------------------------- */
function computeConsistencyRating(completed, school) {
  const margins = completed.map(function (g) {
    return _gcMargin(g, school).margin;
  });

  const sd = _gcStdDev(margins);
  let label;
  if (sd <= 7)       label = 'Reliable';
  else if (sd >= 14) label = 'Volatile';
  else               label = 'Consistent';

  return { stdDev: sd.toFixed(1), label };
}

/* ----------------------------------------------------------
   computeTrapGameIndex
   Measures performance drop the week immediately after a
   blowout win (margin >= 15). Requires at least 2 trap
   situations and 2 normal games for a valid comparison.
   Returns null when conditions are not met.

   Mirrors the logic in dna.js _tryTrapGameRisk but operates
   on raw CFBD game objects rather than the dna.js enriched
   played array.

   @param {Array}  completed — _completedGames() output
   @param {string} school    — CFBD team name
   @returns {{ avgTrapMargin: string, avgNormalMargin: string,
               drop: string, trapCount: number }} | null
   ---------------------------------------------------------- */
function computeTrapGameIndex(completed, school) {
  /* Sort by week for sequential before/after comparison */
  const sorted = completed.slice().sort(function (a, b) {
    return a.week - b.week;
  });

  /* Identify games that fall immediately after a blowout win */
  const trapGames = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = _gcMargin(sorted[i - 1], school);
    if (prev.isWin && prev.margin >= 15) {
      trapGames.push(sorted[i]);
    }
  }

  /* Need at least 2 trap situations and 2 non-trap games */
  if (trapGames.length < 2) return null;

  const normalGames = sorted.filter(function (g) {
    return !trapGames.includes(g);
  });
  if (normalGames.length < 2) return null;

  const avgTrap   = _gcAvg(trapGames.map(function (g) {
    return _gcMargin(g, school).margin;
  }));
  const avgNormal = _gcAvg(normalGames.map(function (g) {
    return _gcMargin(g, school).margin;
  }));
  const drop = avgNormal - avgTrap;

  return {
    avgTrapMargin:   avgTrap.toFixed(1),
    avgNormalMargin: avgNormal.toFixed(1),
    drop:            drop.toFixed(1),
    trapCount:       trapGames.length,
  };
}

/* ----------------------------------------------------------
   computeLargestWinLoss
   Returns the single largest win and largest loss of the
   season by margin, with opponent and score string.

   @param {Array}  completed — _completedGames() output
   @param {string} school    — CFBD team name
   @returns {{ largestWin:  { margin, opponent, score } | null,
               largestLoss: { margin, opponent, score } | null }}
   ---------------------------------------------------------- */
function computeLargestWinLoss(completed, school) {
  let largestWin  = null;
  let largestLoss = null;

  completed.forEach(function (g) {
    const { teamScore, oppScore, margin, isWin, isHome } = _gcMargin(g, school);
    const opponent = isHome ? g.awayTeam : g.homeTeam;
    const score    = `${teamScore}-${oppScore}`;

    if (isWin) {
      if (!largestWin || margin > largestWin.margin) {
        largestWin = { margin, opponent, score };
      }
    } else {
      const absMargin = Math.abs(margin);
      if (!largestLoss || absMargin > largestLoss.margin) {
        largestLoss = { margin: absMargin, opponent, score };
      }
    }
  });

  return { largestWin, largestLoss };
}
