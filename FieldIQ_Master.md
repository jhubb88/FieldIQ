# FieldIQ — Master Reference Document
*Upload this ONE file to the FieldIQ Projects page. Replace it only when major decisions change.*
*Last updated: Phase 12 complete. Phases 1–12 complete.*

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
- **API:** College Football Data API (CFBD) — free tier, 1000 req/month
  - Base URL: `https://api.collegefootballdata.com`
  - Key stored in: `config.js` (gitignored, never committed)
- **Maps:** Leaflet.js + OpenStreetMap (consistent with Live Traffic Dashboard project)
- **Fonts:** Bebas Neue, Playfair Display, Barlow, Oswald (Google Fonts CDN)

## File Structure

```
FieldIQ/                          ← Lives on Windows Desktop
├── index.html                    ← Single entry point, SPA
├── config.js                     ← API key (gitignored, never commit)
├── css/
│   ├── variables.css             ← All CSS custom properties (includes --color-win, --color-loss variants)
│   ├── base.css                  ← Reset, fonts, scrollbar
│   ├── layout.css                ← App shell, sidebar, topbar, page-content
│   └── components.css            ← All reusable UI components (includes rankings-history, coach-history-table, longterm-year-list, result-badge)
├── js/
│   ├── theme.js                  ← applyTheme(), resetTheme(), restoreTheme()
│   ├── api.js                    ← cfbdFetch() wrapper + named fetch functions
│   ├── router.js                 ← Hash router (#home, #school)
│   ├── app.js                    ← Entry point, init, sidebar nav
│   ├── gamecontrol.js            ← Pure compute module — Game Control + Volatility
│   ├── situational.js            ← Pure compute module — Situational analytics
│   └── market.js                 ← Pure compute module — Market Performance analytics
├── data/
│   └── schools.json              ← Static school data (all 130+ FBS schools, lat/lng, identity info)
├── assets/
│   └── logos/                    ← School logos (Phase 11)
└── pages/
    ├── home.js                   ← Homepage render + data fetching
    └── school.js                 ← School page render + data fetching
```

## Design System

**Theme:** Mixed (navy-black base + school color accents)
- Dark navy-black background (`#080a0f`, `#0d0f18`)
- School colors applied via CSS variables on school pages
- Neutral/no school colors on homepage

**Key CSS Variables:**
```css
--school-primary: #BF5700    /* Default Texas orange, swaps per school */
--school-secondary: #FFFFFF
--school-accent: #FF8C42     /* Auto-derived: primary lightened 20% */
--bg-base: #080a0f
--bg-surface: #0d0f18
--bg-card: #0a0c14
--border-color: #1a1d2e
--sidebar-width: 220px
--topbar-height: 52px
```

**Typography:**
- Display/hero: `Bebas Neue` (all-caps wordmarks)
- Editorial: `Playfair Display` (section titles, school names)
- UI labels: `Oswald` (nav, badges, tags)
- Body/data: `Barlow` (stats, body text)

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

## Caching Strategy

- Past game results → cache forever (won't change)
- Rankings → cache 24 hours
- School/team info → cache indefinitely
- Current week games → cache 1 hour
- News → cache 30 minutes

## GitHub

- Repo: `FieldIQ` (public-safe — config.js is gitignored)
- Old API key was exposed in commit history — scrubbed with git filter-repo
- New key is in config.js only, never touches GitHub
- Commit at end of each phase: `"Phase X: [name] complete"`
- Open locally: `file:///C:/Users/jimmy/Desktop/FieldIQ/index.html`

---

# PART 3 — APP STRUCTURE

## Homepage Sections (live — Phase 3 complete)

| Section | Source | Notes |
|---|---|---|
| AP Top 25 | CFBD /rankings | Live, sorted 1-25. School names are clickable — navigate to school page (Phase 11) |
| Top Games of Week | CFBD /games + /lines | Ranked matchups, spread/O&U |
| Movers of the Week | CFBD /rankings | Teams that jumped/dropped most in AP/CFP polls |
| Top Performers | CFBD /games + /lines | Best ATS covers, biggest wins vs spread, high scorers |
| This Week in History | CFBD /games (2013) | Same week, 10 years back |
| CFP Rankings | CFBD /rankings | AP fallback if CFP unavailable |
| This Week's Results | CFBD /games | Final scores only, fetched once, no polling |

Constants at top of `pages/home.js` — update each season:
```js
const CURRENT_YEAR = 2024;
const CURRENT_WEEK = 15;
```

## School Page — Analytical Lens Architecture (Phase 4+)

The school page is the core product. Organized around six analytical lenses that answer one question: "What kind of program is this?"

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
- Leaflet.js + OpenStreetMap
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
- Full season schedule, upcoming games with spread/O/U

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

Rules: max 4 labels per team, no contradictory labels, minimum 4 games before any labels fire. Under 4 games shows a waiting message instead. Trap Game Risk and Home Dependent have additional natural data requirements on top of the 4 game minimum.

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
| 13 | Polish + Performance | Pending |

---

# PART 5 — KNOWN ISSUES & FUTURE FLAGS

| Issue | Flag |
|---|---|
| Secondary color hover accents | Use `--school-secondary` as hover border on stat cards, sidebar nav items, and section header accents. Subtle — border-color swap at ~60% opacity. Flagged for Phase 13 polish. |
| School color audit | CFBD color data is unreliable for some schools (e.g. Notre Dame shows grey instead of gold, Florida shows grey instead of blue/orange). Pre-Phase 13 task: cross-reference all 130+ FBS schools against teamcolorcodes.com, add `colorOverride: { primary, secondary }` to schools.json for any school with wrong/missing CFBD colors. applyThemeFromTeam() checks override first, CFBD as fallback. Reference source: teamcolorcodes.com (same source used by beanumber/teamcolors R package). ✅ Complete — 129 schools updated. |
| Oregon State + Washington State missing from schools.json | These two schools are not in schools.json at all and were skipped during the color audit. They may not belong to a recognized FBS conference in the CFBD dataset. Need to be added as full school entries (not just color overrides) during Phase 13 or as a standalone fix. |
| colorOverride system broken in schools.js | The `colorOverride` fields exist in `schools.json` and are checked by `applyThemeFromTeam()` in `theme.js`, but `data/schools.js` (the file the app actually loads as `SCHOOLS_DATA`) was auto-generated before `colorOverride` was introduced and has no `colorOverride` fields on any entry. Result: the entire Phase 13 color audit is silently not applying — all schools use raw CFBD colors with brightness/contrast validation as a fallback instead. Fix: regenerate `schools.js` from `schools.json` including all `colorOverride` fields, or manually add them. Oregon State was patched individually as a one-off (Phase 13). Remaining 128 schools need the same pass. Flagged for a future phase. |
| Conf. Championships data gap | CFBD /coaches endpoint does not return reliable conference championship data. Column was dropped from coaching history table. Best AP Rank used instead (pulled from postseasonRank field). Championships data would require manual entry in schools.json — deferred indefinitely. |
| Record vs Ranked skipping | CFBD doesn't reliably embed rank in team-filtered game queries. Needs separate /rankings fetch cross-referenced by week. Deferred — not worth API budget now. |
| JSDoc `@.cache/node-gyp` paths | Recurring CC issue — always clean before writing any file to disk |
| Gemini used for code review | Jimmy prints code, reviews in Gemini before confirming write |
| Campus map tile rendering | OpenStreetMap tiles 403-block requests from file:// URLs. Using CartoDB Voyager tiles as replacement — same OSM data, more color than light_all. Will revert to standard OSM tiles once app is hosted over HTTP. |

---

# PART 6 — KEY DECISIONS LOG

| Decision | Detail |
|---|---|
| No live score tracker | Bandwidth used for analytics instead. Results shown after the fact. |
| No recruiting data | Subjective star ratings, more fan-facing than analytical. Draft production covers the outcome better. |
| No transfer portal | Changes daily, hard to keep accurate, roster gossip not analytics. |
| No news feed | CFB News (ESPN RSS) removed. Replaced by Movers of the Week + Top Performers. More analytical, no proxy dependency. |
| No mobile responsiveness | Until Phase 13 polish |
| Single Page App | One index.html, JS hash router (#home, #school) |
| API key storage | config.js only, gitignored, never committed |
| Default school | Texas Longhorns — school page only, not homepage |
| Homepage identity | Neutral dark, FieldIQ branding only, no school colors ever |
| CFP section | Ranked list only, not bracket visual |
| Maps | Leaflet.js + OpenStreetMap — consistent with other projects |
| Wordmark | FIELDIQ all-caps for hero only. FieldIQ everywhere else. |
| Coach salary | Static JSON from USA Today. Private schools = N/A. |
| H2H Search | Any two FBS schools, not just traditional rivals |
| H2H year range | Capped at 1990–2024. Full history (1968–present) = 57 CFBD calls per pair, which exhausts the 1000 req/month free tier after ~17 unique lookups. 1990 cap = 36 game calls + N lines calls (only for years with actual matchups) = ~40–50 calls per pair. Covers the full modern era. Results cached indefinitely after first lookup. |
| Rankings history | Week-by-week poll movement added to analytics |
| Key analytical metrics | Turnover margin + red zone efficiency added to scope |
| Betting data | Consensus line shown. CFBD /lines used throughout. |
| Results section | Homepage only. Final scores, fetched once, no polling. |
| Stat card display | Option A (stat cards) for all analytics — no charts, gauges, or donuts |
| Default season | 2024 |
| Coaching history | Capped at 1995 |
| Phase 11 split | Phase 11 was split into 11a (Dynamic Theming) and 11b (School Switcher + Homepage Navigation) and run as separate CC sessions. |
| No separate map.js module | Campus map logic lives in school.js — same pattern as all other sections. No new JS module needed. |
| Campus map tile provider | CartoDB Voyager tiles used for local file:// compatibility. Standard OSM blocked locally due to referer policy. Switch to OSM when hosted. |
| _loadAnalyticsData() refactor | Split into _loadGameControlData(), _loadSituationalData(), _loadMarketData() in Phase 8 File 1. Thin coordinator pattern. Zero behavior change. |
| Phase 12 split | Phase 12 was split into 12 (Long-Term Strength) and 12b (Draft Production expanded + player drawer). Run as separate CC sessions. |
| Draft Production year range | 2015–2025. Single /draft/picks call, filtered client-side. Cached forever. |
| Draft Production player drawer | Clicking a year card expands a drawer showing player name, position, round, pick number, NFL team. One drawer open at a time. Zero-pick years not clickable. Data already in cached /draft/picks response — no extra API calls. |
| Coaching history table columns | Coach, Years, Record, Best AP Rank. Conf. Championships dropped — CFBD data gap (see Known Issues). |
| Long-Term Strength year ceiling | All subsections run through 2025, not 2024. |
| Coach salary formatting | Displayed as $10,000,000 (formatted currency). Private schools show N/A. |
