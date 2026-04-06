'use strict';

/* =============================================================
   js/dna.js — FieldIQ Program DNA Engine
   Exposes: computeDNA(school, games, lines)

   Takes raw CFBD game and line data for a school and season.
   Returns { labels: [{ label, stat }], note: string }
   or      { labels: [], note: '...' } if under 4 games played.

   Label thresholds and contradictory pairs are defined in the
   FieldIQ_Master.md Program DNA System section.

   Depends on: nothing — pure computation, no DOM, no API calls.
   ============================================================= */

/* ----------------------------------------------------------
   Contradictory pairs — only one label from each pair can fire.
   When both qualify, the one with a higher priority score wins.
   ---------------------------------------------------------- */
const DNA_CONTRADICTORY_PAIRS = [
  ['Volatile',         'Reliable'],
  ['Fast Starter',     'Second Half Team'],
  ['Grinder',          'Front Runner'],
  ['Market Overrated', 'Market Undervalued'],
];

/* ----------------------------------------------------------
   computeDNA
   Primary export. Evaluates all DNA labels and returns up to
   4 label objects with supporting stats.

   @param {string} school — e.g. 'Texas'
   @param {Array}  games  — result of fetchSeasonRecord()
   @param {Array}  lines  — result of fetchGameLines()
   @returns {{ labels: Array<{label:string, stat:string}>, note: string }}
   ---------------------------------------------------------- */
function computeDNA(school, games, lines) {

  /* 1. Build a flat, enriched list of completed games */
  const played = _buildPlayedGames(school, games, lines);

  /* 2. Enforce 4-game minimum before any labels fire */
  if (played.length < 4) {
    return {
      labels: [],
      note: `${played.length} game${played.length === 1 ? '' : 's'} played \u2014 DNA labels unlock after 4.`,
    };
  }

  /* 3. Evaluate each label — each pushes to candidates if threshold met */
  const candidates = [];

  _tryFastStarter(played, candidates);
  _trySecondHalfTeam(played, candidates);
  _tryGrinder(played, candidates);
  _tryFrontRunner(played, candidates);
  _tryVolatile(played, candidates);
  _tryReliable(played, candidates);
  _tryTrapGameRisk(played, candidates);
  _tryHomeDependent(played, candidates);
  _tryMarketOverrated(played, candidates);
  _tryMarketUndervalued(played, candidates);

  /* 4. Drop contradictory labels, sort by priority, cap at 4 */
  const labels = _resolveLabels(candidates);

  const n  = played.length;
  const yr = (games.length > 0 && games[0].season) ? games[0].season : '';
  return {
    labels,
    note: `Based on ${n} game${n === 1 ? '' : 's'}${yr ? ' \u00b7 ' + yr + ' season' : ''}`,
  };
}

/* =============================================================
   Internal — Game Normalization
   ============================================================= */

/* ----------------------------------------------------------
   _buildPlayedGames
   Converts raw CFBD game + lines arrays into a flat list of
   enriched game objects containing everything the label
   functions need. Incomplete games (null scores) are skipped.

   Each returned object:
   {
     isHome:      bool         — true if school is home team
     teamScore:   number       — this school's points
     oppScore:    number       — opponent's points
     margin:      number       — teamScore - oppScore (+ = win)
     isWin:       bool
     half1:       number|null  — Q1+Q2 points scored
     half2:       number|null  — Q3+Q4 points scored
     teamSpread:  number|null  — spread from this team's side
                                 (negative = favored)
     isFavorite:  bool|null
     atsCovered:  true | false | 'push' | null
     week:        number
     season:      number
   }
   ---------------------------------------------------------- */
function _buildPlayedGames(school, games, lines) {
  /* Build a lines lookup by game id for O(1) access */
  const linesById = {};
  lines.forEach(function (entry) {
    linesById[entry.id] = entry;
  });

  const played = [];

  games.forEach(function (game) {
    /* Skip games that haven't been played yet */
    if (game.homePoints === null || game.homePoints === undefined ||
        game.awayPoints === null || game.awayPoints === undefined) {
      return;
    }

    const isHome    = game.homeTeam === school;
    const teamScore = isHome ? game.homePoints : game.awayPoints;
    const oppScore  = isHome ? game.awayPoints  : game.homePoints;
    const margin    = teamScore - oppScore;

    /* Half scores: homeLineScores / awayLineScores are Q-by-Q arrays
       e.g. [7, 14, 10, 3] — Q1, Q2, Q3, Q4 */
    const rawLS = isHome ? game.homeLineScores : game.awayLineScores;
    let half1 = null;
    let half2 = null;
    if (Array.isArray(rawLS) && rawLS.length >= 4) {
      half1 = (rawLS[0] || 0) + (rawLS[1] || 0);
      half2 = (rawLS[2] || 0) + (rawLS[3] || 0);
    }

    /* Betting spread — prefer consensus provider, fall back to first */
    let teamSpread = null;
    let isFavorite = null;
    let atsCovered = null;

    const lineEntry = linesById[game.id];
    if (lineEntry && Array.isArray(lineEntry.lines) && lineEntry.lines.length > 0) {
      const consensus = lineEntry.lines.find(function (l) {
        return l.provider === 'consensus';
      });
      const raw = consensus || lineEntry.lines[0];

      if (raw && raw.spread !== null && raw.spread !== '') {
        /* spreadNum is from the home team's perspective:
           negative = home is favored, positive = home is underdog */
        const spreadNum = parseFloat(raw.spread);
        if (!isNaN(spreadNum)) {
          teamSpread = isHome ? spreadNum : -spreadNum;
          isFavorite = teamSpread < 0;

          /* ATS: margin + teamSpread > 0 means covered.
             e.g. favored by 7 (teamSpread = -7), win by 10:
             10 + (-7) = 3 > 0 → covered */
          const atsResult = margin + teamSpread;
          if (Math.abs(atsResult) < 0.01) {
            atsCovered = 'push';
          } else {
            atsCovered = atsResult > 0;
          }
        }
      }
    }

    played.push({
      isHome,
      teamScore,
      oppScore,
      margin,
      isWin:     margin > 0,
      half1,
      half2,
      teamSpread,
      isFavorite,
      atsCovered,
      week:   game.week,
      season: game.season,
    });
  });

  return played;
}

/* =============================================================
   Internal — Label Evaluators
   Each function receives the played array and the candidates
   array. If the threshold is met, a candidate object is pushed:
   { label, stat, priority }
   priority is a relative strength score used to break ties
   when contradictory labels both qualify.
   ============================================================= */

/* Fast Starter: 1st half PPG >= 115% of 2nd half PPG */
function _tryFastStarter(played, candidates) {
  const withHalf = played.filter(function (g) {
    return g.half1 !== null && g.half2 !== null;
  });
  if (withHalf.length < 4) return;

  const avg1 = _avg(withHalf.map(function (g) { return g.half1; }));
  const avg2 = _avg(withHalf.map(function (g) { return g.half2; }));

  if (avg2 > 0 && avg1 >= avg2 * 1.15) {
    candidates.push({
      label:    'Fast Starter',
      stat:     `1st half avg ${avg1.toFixed(1)} pts vs ${avg2.toFixed(1)} 2nd half`,
      priority: avg1 / avg2,
    });
  }
}

/* Second Half Team: 2nd half PPG >= 115% of 1st half PPG */
function _trySecondHalfTeam(played, candidates) {
  const withHalf = played.filter(function (g) {
    return g.half1 !== null && g.half2 !== null;
  });
  if (withHalf.length < 4) return;

  const avg1 = _avg(withHalf.map(function (g) { return g.half1; }));
  const avg2 = _avg(withHalf.map(function (g) { return g.half2; }));

  if (avg1 > 0 && avg2 >= avg1 * 1.15) {
    candidates.push({
      label:    'Second Half Team',
      stat:     `2nd half avg ${avg2.toFixed(1)} pts vs ${avg1.toFixed(1)} 1st half`,
      priority: avg2 / avg1,
    });
  }
}

/* Grinder: >= 55% of wins by 8 points or less */
function _tryGrinder(played, candidates) {
  const wins = played.filter(function (g) { return g.isWin; });
  if (wins.length < 4) return;

  const closeWins = wins.filter(function (g) { return g.margin <= 8; });
  const pct = closeWins.length / wins.length;

  if (pct >= 0.55) {
    candidates.push({
      label:    'Grinder',
      stat:     `${closeWins.length} of ${wins.length} wins by 8 pts or less (${Math.round(pct * 100)}%)`,
      priority: pct,
    });
  }
}

/* Front Runner: >= 60% blowout wins (15+) AND losses avg under 10 pts */
function _tryFrontRunner(played, candidates) {
  const wins   = played.filter(function (g) { return g.isWin; });
  const losses = played.filter(function (g) { return !g.isWin; });
  if (wins.length < 4) return;

  const blowoutWins = wins.filter(function (g) { return g.margin >= 15; });
  const blowoutPct  = blowoutWins.length / wins.length;
  if (blowoutPct < 0.60) return;

  if (losses.length > 0) {
    const avgLossMargin = _avg(losses.map(function (g) { return Math.abs(g.margin); }));
    if (avgLossMargin >= 10) return;
    candidates.push({
      label:    'Front Runner',
      stat:     `${Math.round(blowoutPct * 100)}% blowout wins \u00b7 avg loss margin ${avgLossMargin.toFixed(1)} pts`,
      priority: blowoutPct,
    });
  } else {
    /* Undefeated — automatic qualification */
    candidates.push({
      label:    'Front Runner',
      stat:     `${Math.round(blowoutPct * 100)}% of wins by 15+ pts \u00b7 no losses`,
      priority: blowoutPct,
    });
  }
}

/* Volatile: margin std dev >= 14 points */
function _tryVolatile(played, candidates) {
  const margins = played.map(function (g) { return g.margin; });
  const sd = _stdDev(margins);
  if (sd >= 14) {
    candidates.push({
      label:    'Volatile',
      stat:     `Margin std dev ${sd.toFixed(1)} pts`,
      priority: sd / 14,
    });
  }
}

/* Reliable: margin std dev <= 7 points */
function _tryReliable(played, candidates) {
  const margins = played.map(function (g) { return g.margin; });
  const sd = _stdDev(margins);
  if (sd <= 7) {
    candidates.push({
      label:    'Reliable',
      stat:     `Margin std dev ${sd.toFixed(1)} pts`,
      priority: 1 - (sd / 7),
    });
  }
}

/* Trap Game Risk: avg margin drops >= 10 pts the week after a blowout win.
   Requires at least 2 blowout-win situations to fire. */
function _tryTrapGameRisk(played, candidates) {
  /* Sort by week for sequential before/after comparison */
  const sorted = played.slice().sort(function (a, b) { return a.week - b.week; });

  /* Identify games that fall the week immediately after a blowout win */
  const trapGames = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    if (prev.isWin && prev.margin >= 15) {
      trapGames.push(sorted[i]);
    }
  }

  /* Need at least 2 trap situations and 2 normal games for a valid comparison */
  if (trapGames.length < 2) return;

  const normalGames = played.filter(function (g) {
    return !trapGames.includes(g);
  });
  if (normalGames.length < 2) return;

  const avgTrap   = _avg(trapGames.map(function (g) { return g.margin; }));
  const avgNormal = _avg(normalGames.map(function (g) { return g.margin; }));
  const drop = avgNormal - avgTrap;

  if (drop >= 10) {
    candidates.push({
      label:    'Trap Game Risk',
      stat:     `Avg margin drops ${drop.toFixed(1)} pts after blowout wins`,
      priority: drop / 10,
    });
  }
}

/* Home Dependent: home PPG >= 120% of away PPG, OR home wins exceed
   away wins by 2+. Requires at least one home and one away game. */
function _tryHomeDependent(played, candidates) {
  const homeGames = played.filter(function (g) { return g.isHome; });
  const awayGames = played.filter(function (g) { return !g.isHome; });
  if (homeGames.length === 0 || awayGames.length === 0) return;

  const homePPG = _avg(homeGames.map(function (g) { return g.teamScore; }));
  const awayPPG = _avg(awayGames.map(function (g) { return g.teamScore; }));

  const homeWins = homeGames.filter(function (g) { return g.isWin; }).length;
  const awayWins = awayGames.filter(function (g) { return g.isWin; }).length;

  const scoreTrigger  = awayPPG > 0 && homePPG >= awayPPG * 1.20;
  const recordTrigger = (homeWins - awayWins) >= 2;

  if (scoreTrigger || recordTrigger) {
    candidates.push({
      label:    'Home Dependent',
      stat:     `Home ${homePPG.toFixed(1)} PPG vs Away ${awayPPG.toFixed(1)} PPG`,
      priority: awayPPG > 0 ? homePPG / awayPPG : 1.20,
    });
  }
}

/* Market Overrated: ATS cover rate as favorite < 40%.
   Requires at least 4 games as a favorite with spread data. */
function _tryMarketOverrated(played, candidates) {
  const asFav = played.filter(function (g) {
    return g.isFavorite === true && typeof g.atsCovered === 'boolean';
  });
  if (asFav.length < 4) return;

  const covers = asFav.filter(function (g) { return g.atsCovered === true; });
  const pct = covers.length / asFav.length;

  if (pct < 0.40) {
    candidates.push({
      label:    'Market Overrated',
      stat:     `Covers as favorite: ${covers.length}-${asFav.length - covers.length} (${Math.round(pct * 100)}%)`,
      priority: 1 - (pct / 0.40),
    });
  }
}

/* Market Undervalued: ATS cover rate as underdog > 60%.
   Requires at least 4 games as an underdog with spread data. */
function _tryMarketUndervalued(played, candidates) {
  const asUdog = played.filter(function (g) {
    return g.isFavorite === false && typeof g.atsCovered === 'boolean';
  });
  if (asUdog.length < 4) return;

  const covers = asUdog.filter(function (g) { return g.atsCovered === true; });
  const pct = covers.length / asUdog.length;

  if (pct > 0.60) {
    candidates.push({
      label:    'Market Undervalued',
      stat:     `Covers as underdog: ${covers.length}-${asUdog.length - covers.length} (${Math.round(pct * 100)}%)`,
      priority: pct / 0.60,
    });
  }
}

/* =============================================================
   Internal — Resolution
   ============================================================= */

/* ----------------------------------------------------------
   _resolveLabels
   Removes one label from each contradictory pair (keeps the
   higher-priority one), sorts remaining by priority descending,
   and returns at most 4 label objects (priority not exposed).
   ---------------------------------------------------------- */
function _resolveLabels(candidates) {
  let pool = candidates.slice();

  DNA_CONTRADICTORY_PAIRS.forEach(function (pair) {
    const a = pool.find(function (c) { return c.label === pair[0]; });
    const b = pool.find(function (c) { return c.label === pair[1]; });
    if (a && b) {
      const toRemove = a.priority >= b.priority ? b : a;
      pool = pool.filter(function (c) { return c !== toRemove; });
    }
  });

  pool.sort(function (a, b) { return b.priority - a.priority; });

  return pool.slice(0, 4).map(function (c) {
    return { label: c.label, stat: c.stat };
  });
}

/* =============================================================
   Internal — Math Utilities
   ============================================================= */

function _avg(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce(function (sum, v) { return sum + v; }, 0) / arr.length;
}

function _stdDev(arr) {
  if (arr.length < 2) return 0;
  const mean     = _avg(arr);
  const variance = _avg(arr.map(function (v) { return (v - mean) * (v - mean); }));
  return Math.sqrt(variance);
}
