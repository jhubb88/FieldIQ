# FieldIQ — Master Reference Document
*Upload this ONE file to the FieldIQ Projects page. Replace it only when major decisions change.*
*Last updated: Phase 19 complete. Homepage offseason onboarding shipped — Welcome card replaces empty Top Games during offseason; broken "Week 18, 2013" history empty-state hidden when CURRENT_WEEK is null. Phase 18 static-cache architecture intact.*

---

# PART 1 — CLAUDE INSTRUCTIONS
*How to work with Jimmy on this project*

## Who I'm Working With

Jimmy is not a developer by trade but is highly capable and building real, production-quality projects. He thinks like a product owner — focused on the end result, user experience, and making smart decisions before touching code. Treat him as an intelligent non-developer, not a beginner.

## Critical Rules for CC Sessions

- **Never use the brainstorming skill** — it breaks terminal output formatting and obscures what CC is doing. This is a build project, not an ideation session. Execute plans directly.
- **No design docs, no approval steps, no transition plans** — just plan, confirm, build.
- **Terminal output must stay clean** — if any skill or mode is changing the output format, turn it off immediately.
- **All CC prompts are self-contained** — no dependency on project files CC can't see. All context, rules, current status, known issues, and build plan are baked into the prompt itself.
- **Never remove existing buttons when adding new ones** — only append. Recurring issue on the advanced projects portfolio page.

## How We Build

**Slow and methodical — always.**
- Never rush to code — plan first, confirm, then build
- One file at a time. Stop after each file and confirm before moving to the next
- If a file is under 700 lines, print it in full before writing to disk. If 700 lines or over, write directly to disk without printing.
- Do NOT reprint large files after small fixes — just confirm the fix and write to disk
- Explain what you're about to do before you do it
- If something seems wrong or could cause problems later, flag it immediately

**Phase-based development:**
- Each phase has a clear scope — do not build beyond it
- At the end of each phase: summarize what was built, commit to GitHub with message `"Phase X: [name] complete"`
- Run all git commits yourself — do not give Jimmy the command
- Never carry work from one phase into another without flagging it

## Code Rules — Non-Negotiable

- **Vanilla HTML / CSS / JS only** — no React, no Vue, no bundlers, no npm
- **CSS variables everywhere** — zero hardcoded colors in any stylesheet, ever
- **`'use strict'`** at the top of every JS file
- **Comments explaining every section** — Jimmy needs to be able to read and understand the code
- **No shortcuts** — if something is worth building, build it right the first time
- **Clean all JSDoc comments** — no `@.cache/node-gyp/...` paths ever. Use proper `@param {Type} name` tags only. Check before every write to disk.

## Communication Style

- Brief and direct — no unnecessary padding
- Flag problems early — if you see an issue coming 3 phases away, mention it now
- Full instructions — Jimmy executes these himself, so be specific and complete
- No assumptions — if something is ambiguous, ask before building
- Don't repeat troubleshooting steps already tried in the same conversation

---

# PART 2 — PROJECT CONTEXT

## What is FieldIQ?

A personal college football analytics and information dashboard. Not a fan app, not a live score tracker — a serious analytical tool for understanding CFB at the program level. Think ESPN meets a coordinator's film room.

- **App name:** FieldIQ (one word, F and I capitalized. FIELDIQ for hero/wordmark only)
- **Scope:** All 130+ FBS (NCAA Division I Football Bowl Subdivision) schools
- **For:** Personal use, may appear on portfolio projects page
- **Identity:** Data-heavy, analytical, information-first. Not hype, not fan culture.

## Tech Stack

- **Language:** Vanilla HTML / CSS / JS — no frameworks, no bundlers, no npm
- **API:** College Football Data API (CFBD) — Tier 2 ($5/month, 30,000 req/month)
  - Base URL: `https://api.collegefootballdata.com`
  - Key stored in: `config.js` (gitignored, never committed)
  - Tier 2 chosen over free tier (1k/month) — required for weekly prewarm (~2,000 calls steady-state)
- **Maps:** Leaflet.js + OpenStreetMap (consistent with Live Traffic Dashboard project)
- **Fonts:** Bebas Neue, Playfair Display, Barlow, Oswald (Google Fonts CDN)

## File Structure

```
FieldIQ/                          ← Lives on Windows Desktop
├── index.html                    ← Single entry point, SPA
├── config.js                     ← API key (gitignored, never commit)
├── css/
│   ├── variables.css             ← All CSS custom properties (includes --color-win, --color-loss, --text-muted variants)
│   ├── base.css                  ← Reset, fonts, scrollbar
│   ├── layout.css                ← App shell, sidebar, topbar, page-content, mobile breakpoints, hamburger
│   └── components.css            ← All reusable UI components (includes rankings-history, coach-history-table, longterm-year-list, result-badge, schedule rows)
├── js/
│   ├── theme.js                  ← applyTheme(), resetTheme(), restoreTheme()
│   ├── api.js                    ← cfbdFetch() wrapper + named fetch functions
│   ├── router.js                 ← Hash router (#home, #school)
│   ├── app.js                    ← Entry point, init, sidebar nav, hamburger toggle
│   ├── gamecontrol.js            ← Pure compute module — Game Control + Volatility
│   ├── situational.js            ← Pure compute module — Situational analytics
│   └── market.js                 ← Pure compute module — Market Performance analytics
├── data/
│   └── schools.json              ← Static school data (all 130+ FBS schools, lat/lng, identity info). Oregon State + Washington State added in Phase 13.
├── assets/
│   └── logos/                    ← School logos (Phase 11)
└── pages/
    ├── home.js                   ← Homepage render + data fetching
    ├── league.js                 ← League page — Conference Standings, Best ATS, Movers, Top Performers. Added Phase 15.
    └── school.js                 ← School page render + data fetching. SCHEDULE_YEAR = 2026 constant separate from CURRENT_YEAR = 2025.
```

## Design System

**Theme:** Mixed (navy-black base + school color accents)
- Dark navy-black background (lifted slightly in Phase 13 for readability)
- School colors applied via CSS variables on school pages
- Neutral/no school colors on homepage

**Key CSS Variables:**
```css
--school-primary: #BF5700    /* Default Texas orange, swaps per school */
--school-secondary: #FFFFFF
--school-accent: #FF8C42     /* Auto-derived: primary lightened 20% */
--bg-base: #0d1117           /* Lifted from #080a0f in Phase 13 */
--bg-surface: #0d0f18
--bg-card: #0f1218           /* Lifted from #0a0c14 in Phase 13 */
--border-color: #1a1d2e
--text-primary: #ffffff
--text-muted: #a0a8bf        /* Added Phase 13 — supporting/label text */
--sidebar-width: 220px
--topbar-height: 52px
```

**Typography:**
- Display/hero: `Bebas Neue` (all-caps wordmarks)
- Editorial: `Playfair Display` (section titles, school names)
- UI labels: `Oswald` (nav, badges, tags)
- Body/data: `Barlow` (stats, body text)

**Text hierarchy (three levels — never flatten):**
- `--text-primary` (#ffffff) — stat values, school name, section titles
- School color (`--school-primary`) — badges, accents, active states
- `--text-muted` (#a0a8bf) — supporting stats, card labels, footnotes

**Theming rules:**
- Homepage → `resetTheme()` — neutral dark, no school colors
- School page → `restoreTheme()` or `applyTheme(primary, secondary)`
- Router owns all theme switching — nothing else touches the theme
- Theme persists in localStorage across page refreshes

## API & Data Rules

- CFBD API key lives in `config.js` — gitignored, never committed
- Always use `cfbdFetch()` wrapper in `api.js` — never fetch CFBD directly from page files
- Cache aggressively — past results forever, rankings 24hrs, news 30min
- Never poll — fetch once, cache, serve from cache
- 1000 requests/month limit — every fetch decision should be conscious of this
- Handle all errors per-section — one failing fetch never crashes the whole page
- Cache keys must include school name or team identifier — never use generic keys that collide across schools

## Caching Strategy (Phase 18 — three-layer architecture)

Checked top-down by every named fetch in `api.js`:

1. **Layer 0 — Static cache** (Phase 18). Pre-baked JSON at `/data/cache/{schoolId}/{section}.json` and `/data/cache/_shared/`. Generated by `scripts/prewarm.js`, refreshed weekly via GitHub Actions. Hit means **zero CFBD calls**.
2. **Layer 1 — Phase 16 dual-layer cache**. localStorage `fiq:v1:*` keys + in-memory `_apiCache`. Survives reloads. Empty-response guard rejects `[]`, `{}`, `undefined`. `null` is **allowed** as a valid hit. Shape guard rejects malformed LS entries.
3. **Layer 2 — Live CFBD via Phase 17 queue + dedup**. Concurrency cap N=5; request deduplication via `_inFlight` Map. Last resort.

**TTL rules:**
- Past game results, postseason rankings, draft picks, coaches → cache forever (immutable).
- Regular rankings → cache forever (past seasons immutable).
- 2026 schedules + lines → 24h (still updating mid-offseason).
- News (homepage RSS) → 30 minutes.

**Cache-key rule:** every cache key must include the school name or team identifier. Generic keys collide across schools.

## GitHub & Deployment

- Repo: `github.com/jhubb88/FieldIQ` (public-safe — config.js is gitignored)
- Old API key was exposed in commit history — scrubbed with git filter-repo
- New key is in config.js only, never touches GitHub
- Commit at end of each phase: `"Phase X: [name] complete"`
- Open locally: `file:///C:/Users/jimmy/Desktop/FieldIQ/index.html`

**Production Deployment (AWS S3 + CloudFront):**
- S3 Bucket: `jimmy-fieldiq` (us-east-1)
- CloudFront Distribution: `E12Z80TRB0P2XR`
- Live URL: `https://d1q3x6tsvbllgg.cloudfront.net`
- Deploy command: `aws s3 sync . s3://jimmy-fieldiq --profile portfolio-user --exclude "config.js" --exclude ".git/*"`
- Cache invalidation: `aws cloudfront create-invalidation --distribution-id E12Z80TRB0P2XR --paths "/*" --profile portfolio-user`
- config.js must be uploaded manually to S3 after every sync — it is gitignored and excluded from sync
- Featured on Advanced Projects portfolio page with Live Demo button

## Portfolio Page — Advanced Projects

- **File:** `C:\Users\jimmy\Desktop\Projects\advanced-projects`
- **S3 bucket:** `jimmy-advanced-projects`
- **Live URL:** `https://d2uisqfxjzeo6a.cloudfront.net`
- **Deploy command:** `aws s3 sync /mnt/c/Users/jimmy/Desktop/Projects/advanced-projects/ s3://jimmy-advanced-projects --exclude ".git/*" --profile portfolio-user`
- **Cache invalidation:** find CloudFront distribution ID in folder or `.git` config before deploying

**FieldIQ card buttons:** Coming Soon · Live Demo (`https://d1q3x6tsvbllgg.cloudfront.net`) · Architecture (modal)

**Architecture modal content:**
- What it is: college football analytics dashboard, data-driven stats and performance breakdowns
- Tech stack: vanilla HTML, CSS, JavaScript — no frameworks
- Data layer: CFBD API, client-side fetch, aggressive caching (past results forever / rankings 24hrs / current week 1hr), 1,000 req/month free tier, per-section error handling
- Key decisions: client-side only, no backend, API-driven rendering, `_deriveIdentity()` concatenates firstName/lastName from CFBD `/coaches`
- Structure: nine analytical lenses built across fifteen phases
- What I learned: third-party sports APIs, client-side data transformation, modular vanilla JS without a framework

**Recurring issue:** CC removes existing buttons when adding new ones. Every portfolio page prompt must include: *"Never remove existing buttons — only append."*

---

# PART 3 — APP STRUCTURE

## Homepage Sections (live — Phase 13 complete)

| Section | Source | Notes |
|---|---|---|
| AP Top 25 | CFBD /rankings | Live, sorted 1-25. School names clickable → school page |
| Top Games of Week | CFBD /games + /lines | Ranked matchups, spread/O&U |
| Movers of the Week | CFBD /rankings | Teams that jumped/dropped most in AP/CFP polls |
| Top Performers | CFBD /games + /lines | Best ATS covers, biggest wins vs spread, high scorers |
| This Week in History | CFBD /games (2013) | Same week, 10 years back. Box shrunk in Phase 13. |
| Conference Standings | CFBD /games | All 10 FBS conferences ranked by win %. Added Phase 13. |
| Best ATS Conferences | CFBD /lines + /games | All 10 FBS conferences ranked by ATS cover rate. Added Phase 13. |
| CFP Rankings | CFBD /rankings | AP fallback if CFP unavailable |
| This Week's Results | CFBD /games | Final scores only, fetched once, no polling |

Constants at top of `pages/home.js` — update each season:
```js
const CURRENT_YEAR = 2024;
const CURRENT_WEEK = 15;
```

## School Page — Analytical Lens Architecture

Sidebar navigation:
1. Overview (default)
2. Game Control
3. Volatility
4. Situational
5. Market Performance
6. Long-Term Strength
7. Campus Map
8. H2H Search
9. Schedule

### Overview (default view)
- Program DNA card — 3-5 plain-language analytical labels with supporting stats
- Season Snapshot — Record, Rank, Avg Margin, PPG (four cards only)
- Last Game card — result, score, ATS outcome
- Next Game card — opponent, date, spread, O/U
- School Identity card — city, stadium, founded, conference, championships

### Game Control
- Blowout vs Grinder Profile — % of wins by margin (blowout 15+, competitive 9-14, grinder 8 or less)
- First Half vs Second Half Scoring — avg points scored/allowed by half
- Close Game Record — games decided by 8 points or less
- Score Differential trend — season arc
- Red Zone Efficiency + Turnover Margin

### Volatility
- Consistency Rating — std dev of point differential (low = reliable, high = Jekyll & Hyde)
- Trap Game Index — performance week after big wins or rivalry games
- Sign convention: positive = underperformed (bad), negative = outperformed (good)
- Footnote reads: "+ = outperformed normal avg · − = underperformed"
- Week-by-week results chart — visual season arc
- Largest win / largest loss of season

### Situational
- Home vs Away record + scoring splits
- Night game record
- Bowl game history
- Revenge game flags
- Record vs ranked opponents (deferred — CFBD data gap, needs separate /rankings cross-reference)

### Market Performance
- ATS record — overall, home, away
- O/U record
- Home underdog ATS record (skips gracefully when no situations exist)
- Best/worst cover streaks

### Long-Term Strength
- Rankings history — week-by-week chart, last 3 seasons
- Draft production — NFL picks by year/round
- Coaching continuity — current coach tenure + record
- Full coaching history — every coach, years, record, championships (from 1995)
- Coach salary — USA Today public records (private schools = N/A)
- Bowl game history — all-time record

### Campus Map
- Leaflet.js + OpenStreetMap (CartoDB Voyager tiles for local file:// compatibility)
- Zoom to campus, school-colored pin using --school-primary via getComputedStyle
- Click pin to expand full-screen modal
- Coordinates stored in schools.json (lat/lng per school)
- Texas default: Darrell K Royal stadium (30.2840, -97.7324)
- Graceful fallback if lat/lng missing: "Map coming soon for [school name]"

### H2H Search
- Search any two FBS schools
- Full historical record from 1990–present (year range capped — see Key Decisions)
- ATS record in matchups, scoring trends

### Schedule
- Full 2026 season schedule (SCHEDULE_YEAR = 2026, separate from CURRENT_YEAR = 2024)
- Future games: opponent, date, home/away indicator, spread + O/U ("Line TBD" if unavailable)
- Past games: opponent, date, final score, W/L badge, ATS outcome
- Grouped by week number. Graceful fallback if no 2026 data available yet.

## Program DNA System

Conservative threshold-based label system. Labels only assigned when thresholds clearly met. Minimum sample sizes enforced. Supporting stat always shown inline.

| Label | Threshold |
|---|---|
| Fast Starter | 1st half PPG ≥ 115% of 2nd half PPG |
| Second Half Team | 2nd half PPG ≥ 115% of 1st half PPG |
| Grinder | ≥ 55% of wins by 8 points or less |
| Front Runner | ≥ 60% blowout wins + losses avg under 10 pts |
| Volatile | Consistency Rating std dev ≥ 14 points |
| Reliable | Consistency Rating std dev ≤ 7 points |
| Trap Game Risk | Trap Game Index drops ≥ 10 pts vs normal games |
| Home Dependent | Home PPG ≥ 120% of away PPG or 2+ game record gap |
| Market Overrated | ATS as favorite below 40% cover rate |
| Market Undervalued | ATS as underdog above 60% cover rate |

Rules: max 4 labels per team, no contradictory labels, minimum 4 games before any labels fire. Under 4 games shows a waiting message instead.

Contradictory pairs that can never coexist:
- Volatile + Reliable
- Fast Starter + Second Half Team
- Grinder + Front Runner
- Market Overrated + Market Undervalued

---

# PART 4 — BUILD PHASES

| Phase | Name | Status |
|---|---|---|
| 01 | Project Scaffold | ✅ Complete |
| 02 | Homepage Shell | ✅ Complete |
| 03 | Homepage Data | ✅ Complete |
| 04 | School Page Shell | ✅ Complete |
| 05 | Program Identity Layer | ✅ Complete |
| 06 | Game Control + Volatility | ✅ Complete |
| 07 | Situational + Market Performance | ✅ Complete |
| 08 | Campus Map (Leaflet.js) | ✅ Complete |
| 09 | School Info Static JSON | ✅ Complete |
| 10 | H2H Search | ✅ Complete |
| 11 | Dynamic Theming + School Switcher | ✅ Complete |
| 12 | Draft Production + Long-Term Strength | ✅ Complete |
| 13 | Polish + Performance | ✅ Complete |
| 14 | Data Refresh + Color Override Fix | ✅ Complete |
| 15 | Homepage Fixes + League Tab | ✅ Complete |
| 16 | Caching Persistence (localStorage) | ✅ Complete |
| 17 | Concurrency-Limited Queue + Request Dedup + Rankings allSettled | ✅ Complete |
| 18 | Static Cache Prewarm + Weekly GitHub Actions Refresh | ✅ Complete |
| 19 | Homepage Offseason Onboarding + History Empty-State Fix | ✅ Complete |

### Phase 15 — What Was Built (commit d669261)

- Week null bug fixed — history section now uses live ISO calendar week, never shows "Week null" (`pages/home.js`)
- Fast Facts card added — 100-item static array, random fact on each page load, stacked below history box (`pages/home.js`)
- History box and Fast Facts box sized equally with gap between them (`css/components.css`)
- League page built — Conference Standings, Best ATS Conferences, Movers of the Week, Top Performers (`pages/league.js`)
- Conference Standings and Best ATS both computed client-side from CFBD 2025 data, cached 24hrs
- Movers of the Week + Top Performers show offseason graceful fallback when CURRENT_WEEK = null
- #league route added to router (`js/router.js`)
- League nav item added to sidebar (`js/app.js`)
- league.js script tag added (`index.html`)
- Stacked column layout for history/facts column (`css/components.css`)
- --color-positive / --color-negative tokens added (`css/variables.css`)

### Phase 19 — What Was Built (commit c4aa078)

- Top Games card on the homepage replaced with a **Welcome to FieldIQ** card during offseason (`CURRENT_WEEK === null`). Onboarding copy directs first-time visitors to Schools nav and the search bar in the top right.
- "This Week in CFB History" card hidden entirely during offseason — Fast Facts card naturally fills the column via existing `flex: 1` rule on `.home-card-col--facts .home-card`. No CSS layout change needed.
- History fetch (`fetchGames(HISTORY_YEAR, calWeek, 'regular', { classification: 'fbs' })`) skipped when `CURRENT_WEEK === null` — saves one CFBD call per offseason cold load.
- New `.home-welcome` CSS rule in `css/components.css` — uses existing variables (`--font-serif`, `--text-primary`, `--text-secondary`); zero new colors.
- Empty-state bug eliminated: no more "No games found for Week 18, 2013" (Week 18 doesn't exist; the section was attempting an impossible fetch when calendar week landed outside football season).
- When `CURRENT_WEEK` is set to an integer for the new season, both Top Games and History cards reappear automatically — no further code change needed.
- Files touched: `pages/home.js` (3 edits), `css/components.css` (1 insertion).
- Files NOT touched: `js/api.js`, `pages/league.js`, `pages/school.js`, `renderGames`, `renderHistory`, `setSection`, `getCalendarWeek`, `FAST_FACTS`.

### Phase 18 — What Was Built (commit 7d29e75)

- Static cache layer (Layer 0) prewarmed via `scripts/prewarm.js` for all 136 FBS schools
- Cache files at `data/cache/{schoolId}/{section}.json` + `data/cache/_shared/` for league-wide data (teamsFBS, regularRankings)
- ~3,574 cache files, 62 MB local / 53.6 MiB on S3
- `js/api.js` modified: 11 named fetch functions check Layer 0 (static) before Layer 1 (Phase 16 LS) before Layer 2 (live `cfbdFetch` via Phase 17 queue). Helpers `_tryStaticCache` and `_tryStaticCacheForSchool` mirror Phase 16's `undefined`-on-miss / `null`-as-valid-hit contract.
- GitHub Actions workflow (`.github/workflows/prewarm.yml`) runs every Sunday at 02:00 UTC; manual `workflow_dispatch` trigger available. Auto-commits regenerated cache, syncs to S3, invalidates CloudFront. Required secrets: `CFBD_API_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `CLOUDFRONT_DISTRIBUTION_ID`.
- Weekly steady-state cost: ~2,000 CFBD calls (well under 30k budget on $5 Tier 2). First-time run ~4,000 calls.
- Throttle: 250ms between CFBD calls (~4 req/sec sequential) — well under burst threshold.
- Critical fixes during build: filter `draftPicks` at write time (CFBD ignores `college` filter and returns the full 13,080-pick NFL history; without filter, cache was 821 MB); filter `teamsFBS` to FBS-only (CFBD's `division=fbs` returns 1903 entries across all classifications; filter saves 873 KB on the shared file).
- Live verification on cold-load: Ohio State / Indiana / Oregon all populate every Long-Term Strength section + Schedule on first click. Cold-load CFBD calls reduced from ~38 (with ~18 CORS rejections, pre-Phase 17) to 1–14 (all empty-response cases for known no-bowl years).

### Phase 17 — What Was Built (commits b8921b2 + 6811b55 + bdf22c1)

- Concurrency-limited queue at `cfbdFetch` level (N=5 max in-flight). Sequential `_enqueue` helper with FIFO `_waiting` array; drains as in-flight slots free up.
- Request deduplication via `_inFlight` Map (URL → Promise). Collapses identical concurrent fetches into a single shared promise — example: Bowl History IIFE and 10-Year Record IIFE both calling `fetchSeasonRecord(school, 2024)` now produce one HTTP request, two awaiters.
- Rankings IIFE in `pages/school.js` refactored from `Promise.all` to `Promise.allSettled` with 3-state row rendering: **Data unavailable** (regularRankings fetch failed, can't compute anything), **Unranked** (genuine unranked-all-season case), **Ranked with em-dash on failed postseason** (peakRank known but finalRank fetch failed — em-dash honors "we don't know" instead of substituting `lastRank`).
- `fetchFinalRank` TTL changed from 24h to forever — postseason ranks for completed seasons are immutable, so the 24h holdover from Phase 12 was a liability that forced a CORS-vulnerable refetch every 24 hours.
- Cosmetic: replaced literal `—` escape sequences with em-dash characters in five comment lines that the Edit tool's auto-swap had introduced (commit `bdf22c1`).

### Phase 16 — What Was Built (commit a049376)

- `_cacheGet` / `_cacheSet` upgraded to dual-layer (localStorage + in-memory). localStorage is the source of truth across reloads; `_apiCache` is a session-level read-through for speed.
- All localStorage entries written under `fiq:v1:` prefix for schema versioning. Bumping to `v2:` later will cause old entries to be ignored automatically.
- `_isEmptyResponse` predicate — single source of truth for the "never persist a fetch that returned nothing useful" invariant. Rejects `undefined`, `[]`, `{}`. `null` is **allowed** (legitimate "unranked" answer for `fetchFinalRank`, "no current coach" for `fetchCoachInfo`).
- Empty-response guard applied symmetrically on **both** write and read paths — defends against bad data from older code paths or external writes.
- Shape guard on LS reads — rejects entries missing the `{ data, expires }` structure (catches partial writes and manual edits).
- Lazy expiry pruning: stale LS entries are deleted on the read that detects them.
- `window.clearFieldIQCache()` dev utility wipes all `fiq:v1:*` LS keys and resets the in-memory cache. Logs the count cleared.
- Misleading "Resets on page reload — sufficient for a single session" comment from Phase 3 removed.

### Phase 14 — What Was Built (commits 86a3a7a + c2b68d2 + f298d48)

**14a (86a3a7a):**
- colorOverride synced for 134 schools + 5 new — 135/136 now covered (`data/schools.js`)
- colorOverride added for 5 previously missing schools — 136/136 (`data/schools.json`)
- `SCHOOL_YEAR` 2024 → 2025; 2015–2024 UI string fixed; stale comments cleaned (`pages/school.js`)
- `CURRENT_WEEK = null` offseason sentinel; Top Games title + empty state updated; fetchGames guarded (`pages/home.js`)
- `completed2024`/`completed2023` → `completedCurrent`/`completedPrior` (`js/situational.js`)

**14b (c2b68d2):**
- Revenge game label fixed — `${SCHOOL_YEAR - 1}` → `${SCHOOL_YEAR}`, now correctly reads "Opponents who beat us in 2025" (`pages/school.js`)
- Full sweep — no stale hardcoded 2024 analytics-year refs in any of the four files
- `renderCoachingContinuity` — `coachOverride` check added; override card shows name + hire year + salary (N/A if null); "Interim" suffix for NIU (`pages/school.js`)
- 27 schools patched with `coachOverride`, 27/27 verified, JSON valid (`data/schools.json` + `data/schools.js`)

**14b patch (f298d48):**
- `_deriveIdentity` coachOverride check added — fixes Overview card for all 28 override schools (`pages/school.js`)
- Ole Miss entry corrected to Pete Golding, 2026, $6.8M (`data/schools.js` + `data/schools.json`)

### Phase 13 — What Was Built (commits 00d3650 + b11d9ca)

**13a (00d3650):**
- Background lift + text visibility fix (`css/variables.css`) — `--bg-base`, `--bg-card` lightened; `--text-muted: #a0a8bf` introduced
- Secondary hover borders, card scale on hover, section fadeIn, mosaic fix (`css/components.css`)
- Page fade-in on route change (`css/layout.css`)
- Oregon State + Washington State added (`data/schools.json`)
- colorOverride bypasses brightness validation (`js/theme.js`)
- colorOverride bug documented (`FieldIQ_Master.md`)

**13b (b11d9ca):**
- Hamburger + overlay toggle (`js/app.js`)
- Sidebar slide-in, overlay, breakpoints (`css/layout.css`)
- Grid reflows, tab nav, touch targets (`css/components.css`)

**Also added in Phase 13:**
- Schedule section built and wired (SCHEDULE_YEAR = 2026)
- Conference Standings + Best ATS Conferences cards on homepage
- History fact box shrunk to make room for new cards
- Caching audit — all sections verified to have try/catch and visible fallbacks

---

# PART 5 — KNOWN ISSUES & FUTURE FLAGS

| Issue | Flag |
|---|---|
| Caching in-memory only | ✅ Resolved across Phases 16 + 17 + 18 collectively. Phase 16 added dual-layer localStorage. Phase 17 added concurrency cap + dedup. Phase 18 added Layer 0 static cache that eliminates cold-load CFBD calls entirely. |
| colorOverride silently not applying | ✅ Fixed in Phase 14a — 136/136 schools now have colorOverride data. applyThemeFromTeam() override path fully operational. |
| Coaching data stale — 2025 carousel | ✅ Fixed in Phase 14b — 28 schools patched with coachOverride in schools.json. _deriveIdentity and renderCoachingContinuity both check override before CFBD. |
| Season data stale — analytics on 2024 | ✅ Fixed in Phase 14a — CURRENT_YEAR rolled to 2025. All analytics, banners, and labels now reflect 2025 season. |
| Homepage constants offseason update | ✅ Fixed in Phase 14a — CURRENT_WEEK = null offseason sentinel. Top Games section handles null gracefully. |
| Top Games offseason dead space | ✅ Resolved in Phase 19. Replaced with a Welcome to FieldIQ onboarding card during offseason (CURRENT_WEEK === null). The broken "No games found for Week 18, 2013" history empty-state was also fixed in the same phase by hiding the History card during offseason. |
| Conf. Championships data gap | CFBD /coaches endpoint does not return reliable conference championship data. Column dropped from coaching history table. Best AP Rank used instead. Deferred indefinitely. |
| Record vs Ranked skipping | CFBD doesn't reliably embed rank in team-filtered game queries. Needs separate /rankings fetch cross-referenced by week. Deferred — not worth API budget now. |
| JSDoc `@.cache/node-gyp` paths | Recurring CC issue — always clean before writing any file to disk. |
| Campus map tile rendering | CartoDB Voyager tiles used for local file:// compatibility. Switch to standard OSM tiles once app is hosted over HTTP. |
| 5-school name mismatch | `schools.json` and CFBD disagree on the canonical `school` field for 5 programs (Hawaii vs Hawai'i, San Jose State vs San José State, Appalachian State vs App State, Louisiana Monroe vs UL Monroe, FIU vs Florida International). `fetchTeamInfo`'s `find(t => t.school === X)` returns null for these — Team Info panels show placeholders. Pre-existing bug, deferred indefinitely; recruiters won't click these schools. |

---

# PART 6 — KEY DECISIONS LOG

| Decision | Detail |
|---|---|
| No live score tracker | Bandwidth used for analytics instead. Results shown after the fact. |
| No recruiting data | Subjective star ratings, more fan-facing than analytical. Draft production covers the outcome better. |
| No transfer portal | Changes daily, hard to keep accurate, roster gossip not analytics. |
| No news feed | CFB News (ESPN RSS) removed. Replaced by Movers of the Week + Top Performers. More analytical, no proxy dependency. |
| Single Page App | One index.html, JS hash router (#home, #school) |
| API key storage | config.js only, gitignored, never committed |
| Default school | Texas Longhorns — school page only, not homepage |
| Homepage identity | Neutral dark, FieldIQ branding only, no school colors ever |
| CFP section | Ranked list only, not bracket visual |
| Maps | Leaflet.js + OpenStreetMap — consistent with other projects |
| Wordmark | FIELDIQ all-caps for hero only. FieldIQ everywhere else. |
| Coach salary | Static JSON from USA Today. Private schools = N/A. |
| H2H Search | Any two FBS schools, not just traditional rivals |
| H2H year range | Capped at 1990–2024. Full history (1968–present) = 57 CFBD calls per pair, which exhausts the 1000 req/month free tier after ~17 unique lookups. 1990 cap = ~40–50 calls per pair. Covers the full modern era. Results cached indefinitely after first lookup. |
| Rankings history | Week-by-week poll movement added to analytics |
| Key analytical metrics | Turnover margin + red zone efficiency added to scope |
| Betting data | Consensus line shown. CFBD /lines used throughout. |
| Results section | Homepage only. Final scores, fetched once, no polling. |
| Stat card display | Option A (stat cards) for all analytics — no charts, gauges, or donuts |
| Default season | 2024 (rolling to 2025 in Phase 14) |
| Coaching history | Capped at 1995 |
| Schedule year | SCHEDULE_YEAR = 2026, separate constant from CURRENT_YEAR. Lives at top of school.js. |
| Phase 13 split | Split into 13a (visual polish, Oregon State/Washington State, colorOverride fix, schedule, homepage cards) and 13b (mobile responsiveness — hamburger, sidebar, grid reflows). |
| No separate map.js module | Campus map logic lives in school.js — same pattern as all other sections. |
| Campus map tile provider | CartoDB Voyager tiles for local file:// compatibility. Switch to OSM when hosted. |
| _loadAnalyticsData() refactor | Split into _loadGameControlData(), _loadSituationalData(), _loadMarketData() in Phase 8. Thin coordinator pattern. Zero behavior change. |
| Draft Production year range | 2015–2025. Single /draft/picks call, filtered client-side. Cached forever. |
| Draft Production player drawer | Clicking a year card expands drawer: player name, position, round, pick number, NFL team. One drawer open at a time. Zero-pick years not clickable. |
| Coaching history table columns | Coach, Years, Record, Best AP Rank. Conf. Championships dropped — CFBD data gap. |
| Long-Term Strength year ceiling | All subsections run through 2025, not 2024. |
| Coach salary formatting | Displayed as $10,000,000 (formatted currency). Private schools show N/A. |
| Text hierarchy | Three levels: --text-primary (#fff) for values, school color for accents, --text-muted (#a0a8bf) for labels/supporting text. Never collapse to all-white. |
| Homepage layout Phase 13 | History fact box shrunk. Conference Standings + Best ATS Conferences added as two side-by-side cards (no toggle — both visible simultaneously). |
| colorOverride bug | schools.json entries are missing the colorOverride field — color audit data exists in theme.js logic but has no data to read. Fix is Phase 14a priority. |
| Cache key collision rule | All cache keys must include school name or team identifier. Generic keys (e.g. "games_2024") will collide across schools. |
| 2025 season complete | CFP National Championship played January 19, 2026. Indiana defeated Miami. Full 2025 CFBD dataset available. Season rollover to CURRENT_YEAR = 2025 complete in Phase 14. |
| coachOverride pattern | 28 schools have coachOverride in schools.json. Both _deriveIdentity (Overview card) and renderCoachingContinuity (Long-Term Strength) check override before CFBD. Override wins unconditionally. Non-override schools fall through to CFBD unchanged. |
| Revenge game label | Uses CURRENT_YEAR directly (not SCHOOL_YEAR - 1). Reads "Opponents who beat us in 2025" — correct for showing prior-season losses as 2026 revenge candidates. |
| League tab | Third sidebar nav item. Routes to #league. resetTheme() always applies — no school colors. league.js handles all four sections. |
| Fast Facts | 100-item static JS array in home.js. Random pick on each page load. No API call, zero dependency on season state. Always populated. |
| History box layout | History fact and Fast Facts card stacked in same column, equal height, small gap between. No grid restructuring — wrapped in a column div. |
| Conference Standings method | Cross-conference records only — computed from CFBD /games?year=2025&seasonType=regular filtered for inter-conference matchups. Ranked by win %. |
| CURRENT_YEAR = 2025 | Rolled from 2024 in Phase 14. All analytics, banners, DNA labels reflect 2025 season. |
| Portfolio Architecture modal | Added to FieldIQ card on advanced projects page. Nine lenses, fifteen phases, accurate caching strategy. Live Demo button preserved alongside Architecture button. |
| Phase 17 concurrency cap N=5 | Observed CFBD burst threshold ~6–10 simultaneous requests (rejections kicked in above that). Picked N=5 — one below the floor of the observed range, leaves margin without unnecessarily slowing cold load. Drop to 4 if rejections ever recur. |
| Phase 18 architectural choice | Static prewarm over lazy-load. Pre-baking the data and serving it from CloudFront eliminates the burst-limit problem entirely instead of mitigating it. Cold-load CFBD calls drop to 0–14 per page (only the empty-response cases) vs ~38 before. |
| CFBD Tier 2 over free tier | $5/month for 30,000 req/month, vs free tier's 1,000 req/month. Required for weekly prewarm (~2,000 calls/week steady-state, ~4,000 first run). Free tier was a non-starter for the prewarm architecture. |
| GitHub Actions over manual refresh | Weekly auto-refresh removes ongoing maintenance burden — zero human action required between weekly runs. Workflow auto-commits regenerated cache, syncs to S3, invalidates CloudFront. Manual `workflow_dispatch` button available for on-demand refreshes. |
| Cache committed to repo | 53.6 MB of cache JSON committed to `main`. Trade-off accepted for portability (any clone reproduces the deploy state), atomic refresh (one commit = one refresh), and disaster recovery (S3 can be rebuilt from repo). Cost: each weekly auto-commit adds ~2 MB to repo size. |
