#!/usr/bin/env node
'use strict';

/* =============================================================
   prewarm.js — FieldIQ static cache generator (Phase 18)

   Reads data/schools.json, fetches every CFBD endpoint per
   school with throttling, writes static JSON to
   data/cache/{schoolId}/{endpoint}_{params}.json.

   Usage:
     node scripts/prewarm.js
     node scripts/prewarm.js --force          (rebuild immutable historical files)
     CFBD_API_KEY=xxx node scripts/prewarm.js (preferred for CI)

   Requires Node 18+ (built-in fetch).

   Validation scope: only the empty-response guard from Phase 16
   is applied to writes. No field-level schema validation.
   Rationale: the browser-side render code is already defensive
   ((x || []).forEach, optional chaining), HTTP errors throw
   before reaching writeJson, and a CFBD breaking change would
   fail both static and live paths simultaneously — moving the
   failure to CI doesn't help users. If CFBD ever ships a
   non-additive schema change, add validation here.

   Output layout:
     data/cache/_shared/teamsFBS.json
     data/cache/_shared/regularRankings_{year}.json
     data/cache/{id}/seasonRecord_{year}.json   (2015-2025)
     data/cache/{id}/postseasonGames_{year}.json (2000-2014, immutable)
     data/cache/{id}/finalRank_{year}.json       (derived from shared call)
     data/cache/{id}/draftPicks.json
     data/cache/{id}/allCoaches.json
     data/cache/{id}/coachInfo.json              (derived from allCoaches)
     data/cache/{id}/gameLines_2025.json
     data/cache/{id}/schedule_2026.json
     data/cache/{id}/scheduleLines_2026.json
     data/cache/manifest.json
   ============================================================= */

const fs   = require('fs');
const path = require('path');

/* --------------------------------------------------------------
   Configuration
   -------------------------------------------------------------- */

const CFBD_BASE_URL = 'https://api.collegefootballdata.com';
const THROTTLE_MS   = 250;   // 4 req/sec — well under CFBD burst limits

const SEASON_RECORD_YEARS    = range(2015, 2025);  // 11 yrs, mutable
const POSTSEASON_HIST_YEARS  = range(2000, 2014);  // 15 yrs, immutable
const FINAL_RANK_YEARS       = [2023, 2024, 2025];
const REGULAR_RANKINGS_YEARS = [2023, 2024, 2025];
const COACH_INFO_YEAR        = 2025;
const GAME_LINES_YEAR        = 2025;
const SCHEDULE_YEAR          = 2026;

const REPO_ROOT  = path.resolve(__dirname, '..');
const CACHE_ROOT = path.join(REPO_ROOT, 'data', 'cache');
const SHARED_DIR = path.join(CACHE_ROOT, '_shared');

const FORCE = process.argv.includes('--force');

/* --------------------------------------------------------------
   Utilities
   -------------------------------------------------------------- */

function range(start, end) {
  const out = [];
  for (let y = start; y <= end; y++) out.push(y);
  return out;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Mirror of api.js _isEmptyResponse — never persist a fetch that returned nothing useful.
// null is NOT empty (legitimate "unranked" answer for finalRank, "no current coach" for coachInfo).
function isEmptyResponse(data) {
  if (data === undefined) return true;
  if (Array.isArray(data) && data.length === 0) return true;
  if (data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0) return true;
  return false;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data, pretty = false) {
  ensureDir(path.dirname(filePath));
  // Atomic: write to .tmp, then rename. fs.renameSync is atomic on POSIX
  // and Windows when source/dest are on the same filesystem, which they
  // always are here. A process kill mid-write leaves the .tmp file
  // (cleaned up on next run); the original is never truncated.
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, pretty ? 2 : 0));
  fs.renameSync(tmp, filePath);
}

function loadApiKey() {
  if (process.env.CFBD_API_KEY) return process.env.CFBD_API_KEY;

  const configPath = path.join(REPO_ROOT, 'config.js');
  if (!fs.existsSync(configPath)) {
    throw new Error('CFBD_API_KEY env var not set and config.js not found');
  }
  const txt = fs.readFileSync(configPath, 'utf8');
  const m = txt.match(/apiKey\s*:\s*['"]([^'"]+)['"]/);
  if (!m) throw new Error('Could not parse apiKey from config.js');
  return m[1];
}

function loadSchools() {
  const p = path.join(REPO_ROOT, 'data', 'schools.json');
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!Array.isArray(data.teams)) throw new Error('schools.json: teams array missing');
  return data.teams;
}

// Same derivation as school.js (lines 60, 76, 955, 1706, 2034)
function cfbdName(team) {
  return team.name.replace(team.mascot || '', '').trim();
}

/* --------------------------------------------------------------
   CFBD HTTP client (sequential, throttled)
   -------------------------------------------------------------- */

const API_KEY = loadApiKey();
let totalCalls = 0;

async function cfbdGet(endpoint, params = {}) {
  await sleep(THROTTLE_MS);

  // Match api.js cfbdFetch param-stringification exactly so a fallback
  // call from the browser would produce the identical URL.
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const url = `${CFBD_BASE_URL}${endpoint}${query ? `?${query}` : ''}`;

  // Count BEFORE await — DNS/network rejections still tally against the budget.
  totalCalls++;

  const r = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Accept': 'application/json',
    },
  });

  if (!r.ok) {
    throw new Error(`CFBD ${r.status} ${r.statusText} — ${url}`);
  }
  return r.json();
}

/* --------------------------------------------------------------
   Per-school endpoint runners
   Each returns { written: [...], skipped: [...], failed: [...] }.
   -------------------------------------------------------------- */

async function fetchSeasonRecords(team) {
  const cfbd = cfbdName(team);
  const out = { written: [], skipped: [], failed: [] };

  for (const year of SEASON_RECORD_YEARS) {
    const filePath = path.join(CACHE_ROOT, team.id, `seasonRecord_${year}.json`);
    try {
      const data = await cfbdGet('/games', { year, team: cfbd, seasonType: 'both' });
      if (isEmptyResponse(data)) { out.skipped.push(`seasonRecord_${year}:empty`); continue; }
      writeJson(filePath, data);
      out.written.push(`seasonRecord_${year}`);
    } catch (e) {
      out.failed.push({ endpoint: `seasonRecord_${year}`, error: e.message });
    }
  }
  return out;
}

async function fetchPostseasonHistoric(team) {
  const cfbd = cfbdName(team);
  const out = { written: [], skipped: [], failed: [] };

  for (const year of POSTSEASON_HIST_YEARS) {
    const filePath = path.join(CACHE_ROOT, team.id, `postseasonGames_${year}.json`);

    // Immutable historical: skip if file exists (unless --force).
    if (!FORCE && fs.existsSync(filePath)) {
      out.skipped.push(`postseasonGames_${year}:immutable`);
      continue;
    }
    try {
      const data = await cfbdGet('/games', { year, team: cfbd, seasonType: 'postseason' });
      if (isEmptyResponse(data)) { out.skipped.push(`postseasonGames_${year}:empty`); continue; }
      writeJson(filePath, data);
      out.written.push(`postseasonGames_${year}`);
    } catch (e) {
      out.failed.push({ endpoint: `postseasonGames_${year}`, error: e.message });
    }
  }
  return out;
}

async function fetchDraftPicks(team) {
  const cfbd = cfbdName(team);
  const out = { written: [], skipped: [], failed: [] };
  const filePath = path.join(CACHE_ROOT, team.id, 'draftPicks.json');
  try {
    const data = await cfbdGet('/draft/picks', { college: cfbd });
    // CFBD's /draft/picks ignores the `college` filter — every call returns
    // the full historical NFL draft (~13,000 picks, ~6 MB). Filter here so
    // each per-school file contains only that school's picks. Match the
    // client-side filter at pages/school.js:1535-1538 exactly:
    //   p.college === SCHOOL_NAME || p.collegeTeam === SCHOOL_NAME
    const filtered = Array.isArray(data)
      ? data.filter(p => p.college === cfbd || p.collegeTeam === cfbd)
      : data;
    if (isEmptyResponse(filtered)) { out.skipped.push('draftPicks:empty'); return out; }
    writeJson(filePath, filtered);
    out.written.push('draftPicks');
  } catch (e) {
    out.failed.push({ endpoint: 'draftPicks', error: e.message });
  }
  return out;
}

async function fetchCoachesAndCoachInfo(team) {
  const cfbd = cfbdName(team);
  const out = { written: [], skipped: [], failed: [] };
  const allPath  = path.join(CACHE_ROOT, team.id, 'allCoaches.json');
  const infoPath = path.join(CACHE_ROOT, team.id, 'coachInfo.json');
  try {
    const data = await cfbdGet('/coaches', { team: cfbd });
    if (isEmptyResponse(data)) {
      out.skipped.push('allCoaches:empty');
      return out;
    }
    writeJson(allPath, data);
    out.written.push('allCoaches');

    // Derive coachInfo using the same logic as api.js fetchCoachInfo —
    // the CFBD URL is identical, so we save a second HTTP call per school.
    const current = data.find(c =>
      Array.isArray(c.seasons) && c.seasons.some(s => s.year === COACH_INFO_YEAR)
    );
    let info = null;
    if (current) {
      const seasons = current.seasons.filter(s => s.school === cfbd);
      const wins   = seasons.reduce((sum, s) => sum + (s.wins   || 0), 0);
      const losses = seasons.reduce((sum, s) => sum + (s.losses || 0), 0);
      info = {
        name:    `${current.firstName} ${current.lastName}`,
        seasons: seasons.length,
        record:  `${wins}-${losses}`,
      };
    }
    // null is a legitimate cached value (no current coach found at this school in COACH_INFO_YEAR).
    // isEmptyResponse(null) === false — Phase 16 invariant: null IS valid.
    writeJson(infoPath, info);
    out.written.push('coachInfo');
  } catch (e) {
    out.failed.push({ endpoint: 'allCoaches+coachInfo', error: e.message });
  }
  return out;
}

async function fetchGameLines2025(team) {
  const cfbd = cfbdName(team);
  const out = { written: [], skipped: [], failed: [] };
  const filePath = path.join(CACHE_ROOT, team.id, `gameLines_${GAME_LINES_YEAR}.json`);
  try {
    const data = await cfbdGet('/lines', { year: GAME_LINES_YEAR, team: cfbd });
    if (isEmptyResponse(data)) { out.skipped.push(`gameLines_${GAME_LINES_YEAR}:empty`); return out; }
    writeJson(filePath, data);
    out.written.push(`gameLines_${GAME_LINES_YEAR}`);
  } catch (e) {
    out.failed.push({ endpoint: `gameLines_${GAME_LINES_YEAR}`, error: e.message });
  }
  return out;
}

async function fetchSchedule(team) {
  const cfbd = cfbdName(team);
  const out = { written: [], skipped: [], failed: [] };
  const filePath = path.join(CACHE_ROOT, team.id, `schedule_${SCHEDULE_YEAR}.json`);
  try {
    const data = await cfbdGet('/games', { year: SCHEDULE_YEAR, team: cfbd, seasonType: 'regular' });
    if (isEmptyResponse(data)) { out.skipped.push(`schedule_${SCHEDULE_YEAR}:empty`); return out; }
    writeJson(filePath, data);
    out.written.push(`schedule_${SCHEDULE_YEAR}`);
  } catch (e) {
    out.failed.push({ endpoint: `schedule_${SCHEDULE_YEAR}`, error: e.message });
  }
  return out;
}

async function fetchScheduleLines(team) {
  const cfbd = cfbdName(team);
  const out = { written: [], skipped: [], failed: [] };
  const filePath = path.join(CACHE_ROOT, team.id, `scheduleLines_${SCHEDULE_YEAR}.json`);
  try {
    const data = await cfbdGet('/lines', { year: SCHEDULE_YEAR, team: cfbd });
    if (isEmptyResponse(data)) { out.skipped.push(`scheduleLines_${SCHEDULE_YEAR}:empty`); return out; }
    writeJson(filePath, data);
    out.written.push(`scheduleLines_${SCHEDULE_YEAR}`);
  } catch (e) {
    out.failed.push({ endpoint: `scheduleLines_${SCHEDULE_YEAR}`, error: e.message });
  }
  return out;
}

/* --------------------------------------------------------------
   Shared (cross-school) endpoints + per-school finalRank derivation
   -------------------------------------------------------------- */

async function fetchSharedAndPerSchoolFinalRanks(teams, sharedManifest) {
  // teamsFBS — used by api.js fetchTeamInfo via _shared/.
  const teamsFbsPath = path.join(SHARED_DIR, 'teamsFBS.json');
  try {
    const teamsFbs = await cfbdGet('/teams', { division: 'fbs' });
    // CFBD's /teams?division=fbs returns ~1903 teams across all
    // classifications (FBS + FCS + others). Filter to just the
    // FBS-classified entries — matches the intent of the query and
    // saves ~91% of the file size (963 KB -> 89 KB). Runtime uses
    // teams.find(t => t.school === X) so unfiltered data is functionally
    // equivalent, but smaller is better for cold-load bandwidth.
    const fbsOnly = Array.isArray(teamsFbs)
      ? teamsFbs.filter(t => t.classification === 'fbs')
      : teamsFbs;
    const empty = isEmptyResponse(fbsOnly);
    if (!empty) writeJson(teamsFbsPath, fbsOnly);
    sharedManifest.teamsFBS = empty ? 'failed:empty-response' : 'ok';
    if (empty) {
      console.error('  shared: teamsFBS returned empty — skipping write (existing file untouched)');
    } else {
      console.log(`  shared: teamsFBS ✓ (${Array.isArray(fbsOnly) ? fbsOnly.length : '?'} FBS teams, filtered from ${Array.isArray(teamsFbs) ? teamsFbs.length : '?'})`);
    }
  } catch (e) {
    sharedManifest.teamsFBS = `failed:${e.message}`;
    console.error(`  shared: teamsFBS ✗ ${e.message}`);
  }

  // regularRankings × 3 → _shared/
  for (const year of REGULAR_RANKINGS_YEARS) {
    const fp = path.join(SHARED_DIR, `regularRankings_${year}.json`);
    try {
      const data = await cfbdGet('/rankings', { year, seasonType: 'regular' });
      const empty = isEmptyResponse(data);
      if (!empty) writeJson(fp, data);
      sharedManifest[`regularRankings_${year}`] = empty ? 'failed:empty-response' : 'ok';
      if (empty) {
        console.error(`  shared: regularRankings_${year} returned empty — skipping write (existing file untouched)`);
      } else {
        console.log(`  shared: regularRankings_${year} ✓`);
      }
    } catch (e) {
      sharedManifest[`regularRankings_${year}`] = `failed:${e.message}`;
      console.error(`  shared: regularRankings_${year} ✗ ${e.message}`);
    }
  }

  // Postseason rankings — 3 shared CFBD calls, up to 408 per-school files derived.
  // CRITICAL: validate the source response before deriving anything. If the
  // postseason fetch returns empty / lacks an AP poll / has zero ranked teams,
  // we MUST NOT write null for all 136 schools — that would persist a bad
  // empty response forever. Skip the year and leave any existing files alone.
  let derivedCount = 0;
  for (const year of FINAL_RANK_YEARS) {
    let postseason;
    try {
      postseason = await cfbdGet('/rankings', { year, seasonType: 'postseason' });
    } catch (e) {
      console.error(`  shared: finalRank source ${year} ✗ ${e.message}`);
      sharedManifest[`finalRankSource_${year}`] = `failed:${e.message}`;
      continue;
    }

    if (isEmptyResponse(postseason)) {
      console.error(`  shared: finalRank source ${year} returned empty — skipping per-school derivation`);
      sharedManifest[`finalRankSource_${year}`] = 'failed:empty-response';
      continue;
    }
    const lastWeek = postseason[postseason.length - 1];
    const apPoll = lastWeek && Array.isArray(lastWeek.polls)
      ? lastWeek.polls.find(p => p.poll === 'AP Top 25')
      : null;
    if (!apPoll || !Array.isArray(apPoll.ranks) || apPoll.ranks.length === 0) {
      console.error(`  shared: finalRank source ${year} has no AP Top 25 ranks — skipping per-school derivation`);
      sharedManifest[`finalRankSource_${year}`] = 'failed:no-ap-poll';
      continue;
    }
    const apRanks = apPoll.ranks;

    for (const team of teams) {
      const cfbd = cfbdName(team);
      const entry = apRanks.find(r => r.school === cfbd);
      // null = legitimately unranked. Phase 16 invariant: null IS a valid cached value.
      const rank = entry ? entry.rank : null;
      const fp = path.join(CACHE_ROOT, team.id, `finalRank_${year}.json`);
      writeJson(fp, rank);
      derivedCount++;
    }
    sharedManifest[`finalRankSource_${year}`] = 'ok';
    console.log(`  shared: finalRank source ${year} ✓ (derived ${teams.length} per-school files)`);
  }
  sharedManifest.finalRanksDerived = derivedCount;
  console.log(`  shared: total finalRank files written = ${derivedCount}`);
}

/* --------------------------------------------------------------
   Per-school orchestrator
   -------------------------------------------------------------- */

async function processSchool(team) {
  ensureDir(path.join(CACHE_ROOT, team.id));

  const all = { written: [], skipped: [], failed: [] };

  for (const fn of [
    fetchSeasonRecords,
    fetchPostseasonHistoric,
    fetchDraftPicks,
    fetchCoachesAndCoachInfo,
    fetchGameLines2025,
    fetchSchedule,
    fetchScheduleLines,
  ]) {
    let result;
    try {
      result = await fn(team);
    } catch (e) {
      // Catastrophic failure inside an endpoint runner — record and move on.
      result = { written: [], skipped: [], failed: [{ endpoint: fn.name, error: e.message }] };
    }
    all.written.push(...result.written);
    all.skipped.push(...result.skipped);
    all.failed.push(...result.failed);
  }
  return all;
}

/* --------------------------------------------------------------
   Main
   -------------------------------------------------------------- */

async function main() {
  const teams = loadSchools();
  console.log(`Prewarming ${teams.length} schools (force=${FORCE})`);
  console.log(`Throttle: ${THROTTLE_MS}ms between calls (~${(1000/THROTTLE_MS).toFixed(1)} req/sec)`);
  console.log('');

  ensureDir(SHARED_DIR);
  const startTime = Date.now();

  // Phase A — shared endpoints + per-school finalRank derivation.
  console.log('--- Shared endpoints ---');
  const sharedManifest = {};
  await fetchSharedAndPerSchoolFinalRanks(teams, sharedManifest);
  console.log('');

  // Phase B — per-school endpoints.
  console.log('--- Per-school endpoints ---');
  const manifest = {
    generatedAt: new Date().toISOString(),
    schoolCount: teams.length,
    forceFlag: FORCE,
    schools: {},
  };

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    const idx = `[${String(i + 1).padStart(3, ' ')}/${teams.length}]`;
    let result;
    try {
      result = await processSchool(team);
    } catch (e) {
      console.error(`${idx} ${team.id}: catastrophic failure — ${e.message}`);
      manifest.schools[team.id] = { written: 0, skipped: 0, failed: 1, error: e.message };
      continue;
    }
    const status = result.failed.length === 0 ? '✓' : '⚠';
    const failNames = result.failed.length ? ` (${result.failed.map(f => f.endpoint).join(', ')})` : '';
    console.log(
      `${idx} ${team.id}: ${result.written.length}w / ${result.skipped.length}s / ${result.failed.length}f ${status}${failNames}`
    );
    manifest.schools[team.id] = {
      written: result.written.length,
      skipped: result.skipped.length,
      failed:  result.failed.length,
      ...(result.failed.length ? { failures: result.failed } : {}),
    };
  }

  // Phase C — manifest. Aggregate summary covers per-school + shared phases.
  const schoolStats = Object.values(manifest.schools);
  const totalWritten = schoolStats.reduce((s, x) => s + (x.written || 0), 0);
  const totalSkipped = schoolStats.reduce((s, x) => s + (x.skipped || 0), 0);
  const totalFailed  = schoolStats.reduce((s, x) => s + (x.failed  || 0), 0);
  const sharedFailures = Object.values(sharedManifest)
    .filter(v => typeof v === 'string' && v.startsWith('failed')).length;

  manifest.shared  = sharedManifest;
  manifest.summary = {
    totalSchools:         teams.length,
    schoolsClean:         schoolStats.filter(s => (s.failed || 0) === 0).length,
    schoolsWithFailures:  schoolStats.filter(s => (s.failed || 0) >  0).length,
    totalEndpointWrites:  totalWritten,
    totalEndpointSkipped: totalSkipped,
    totalEndpointFailed:  totalFailed,
    sharedFailures:       sharedFailures,
    totalCfbdAttempts:    totalCalls,
    durationMs:           Date.now() - startTime,
  };
  manifest.totalCfbdCalls = totalCalls;       // kept for back-compat
  manifest.durationMs     = manifest.summary.durationMs;

  writeJson(path.join(CACHE_ROOT, 'manifest.json'), manifest, /* pretty */ true);

  // Summary log.
  const dur = Math.round(manifest.summary.durationMs / 1000);
  console.log('');
  console.log(
    `Done. ${teams.length} schools (${manifest.summary.schoolsClean} clean, ${manifest.summary.schoolsWithFailures} with failures).`
  );
  console.log(
    `Endpoint writes: ${totalWritten}, skipped: ${totalSkipped}, failed: ${totalFailed}. Shared failures: ${sharedFailures}.`
  );
  console.log(`Total CFBD attempts: ${totalCalls}. Duration: ${dur}s.`);
  console.log(`Manifest: ${path.relative(REPO_ROOT, path.join(CACHE_ROOT, 'manifest.json'))}`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
