# FieldIQ — Dev Notes

College football data app. Vanilla HTML/CSS/JS, no frameworks, no bundlers.
Hosted locally for now. Future: deploy to AWS S3 + CloudFront.

---

## Stack

- **Frontend:** Vanilla HTML/CSS/JS (strict mode throughout)
- **Data:** College Football Data API (CFBD) + ESPN RSS via rss2json.com
- **Fonts:** Google Fonts CDN (Bebas Neue, Playfair Display, Barlow, Oswald)
- **Routing:** Hash-based (`#home`, `#school`)
- **Repo:** https://github.com/jhubb88/FieldIQ
- **Local dev:** `python3 -m http.server 8770` from project root

---

## Project Structure

```
FieldIQ/
├── index.html          # App shell, all CSS/JS links
├── css/
│   ├── variables.css   # All design tokens (colors, fonts, spacing)
│   ├── base.css        # Reset, body, Google Fonts import, scrollbar
│   ├── layout.css      # App shell, sidebar, topbar, page-content
│   └── components.css  # Cards, nav, chips, badges, homepage components
├── js/
│   ├── theme.js        # applyTheme(), restoreTheme(), resetTheme()
│   ├── api.js          # cfbdFetch(), fetchRankings(), fetchGames(), fetchESPNNews()
│   ├── router.js       # Hash router, navigate(), initRouter()
│   └── app.js          # Entry point — init, sidebar nav, DOMContentLoaded
├── pages/
│   ├── home.js         # Full homepage — live data, mosaic bg, dashboard grid
│   └── school.js       # Placeholder render() — Phase 4+
├── data/
│   └── schools.json    # School records (Texas only for now)
└── assets/
    └── logos/          # Empty — real logos Phase 7
```

---

## Phases Completed

### Phase 1 — Project Scaffold
- Full folder structure and file stubs
- CSS design system: variables, reset, layout, components
- Hash router with `navigate()` and `hashchange` listener
- Theme engine: `applyTheme()` / `resetTheme()` / `restoreTheme()`
- CFBD API wrapper: `cfbdFetch()` with Bearer auth
- App init sequence: theme → sidebar → router
- `data/schools.json` seeded with Texas

### Phase 2 — Homepage Shell
- Hero section: FieldIQ wordmark + tagline
- Mosaic background: 112 CSS grid tiles, 60s drift animation, dark overlay
- Dashboard grid: 4-column layout, 5 sections
  - AP Top 25 (left, spans 2 rows)
  - Top Games of Week (center, row 1)
  - CFB News (right, spans 2 rows)
  - This Week in CFB History (center-left, row 2)
  - CFP Rankings (center-right, row 2)
- Placeholder content in all sections
- `body.is-home` class for transparent page-content (lets mosaic show through)
- `HomePage.unmount()` clears mosaic on route change

### Phase 3 — Homepage Live Data
- All 5 sections wired to real data sources
- `fetchRankings(year, seasonType)` → CFBD `/rankings`
- `fetchGames(year, week, seasonType, options)` → CFBD `/games`
- `fetchESPNNews()` → ESPN RSS via rss2json.com (handles CORS)
- `CURRENT_YEAR = 2024` / `CURRENT_WEEK = 15` constants at top of `home.js`
- `HISTORY_YEAR = 2013` for "This Week in History" section
- `Promise.allSettled` fires all fetches concurrently
- Loading states per section; error states per section (page never crashes)
- CFP poll falls back to AP Top 25 if CFP data absent (early season)
- Rankings sorted by rank (API returns unordered)
- Games filtered to `classification: fbs` to exclude FCS/DIII
- `timeAgo()` normalizes rss2json UTC dates correctly

---

## ⚠️ Known Issues / Tech Debt

### API Key Exposed
The CFBD API key is currently hardcoded in `js/api.js` and **is in the public GitHub commit history**.
- Before making this repo public or sharing it: revoke the key at collegefootballdata.com and generate a new one
- Long-term: load from a local `config.js` file added to `.gitignore`

### CFP Rankings Fallback
CFBD doesn't appear to store the "College Football Playoff" committee rankings under that exact poll name for 2024 week 15. The CFP card shows AP Top 25 as fallback.
- Investigate exact poll name in CFBD response for CFP era (may be "FBS Coaches Poll" or similar)
- Or pull from a different endpoint

### Top Games — No Rank Data at Week 15
Week 15 = conference championship week. CFBD games for this week don't have `homeRank`/`awayRank` populated (likely because the ranking snapshot isn't linked to the game record). Falls back to highest-scoring FBS games.
- Consider using week 14 for "games of the week" (final regular season week)
- Or cross-reference team names against the rankings data to inject ranks manually

### School Page
`pages/school.js` is still a placeholder `render(params)`. Clicking "Schools" in nav goes nowhere useful.

---

## What's Next

### Phase 4 — School Page Shell
- Layout: school header (logo, name, colors, conference, record)
- School theme applied on navigate (`applyTheme()` with school's primary/secondary)
- Stat summary cards (season record, scoring avg, ranking)
- Tab navigation: Overview | Schedule | Roster | Stats
- Wire from `data/schools.json` — Texas as working example

### Phase 5 — School Page Live Data
- Season schedule with scores (`/games?team=Texas&year=2024`)
- Season stats (`/games/teams` or `/stats/season`)
- Roster (`/roster?team=Texas&year=2024`)

### Phase 6 — School Picker / Search
- Sidebar school browser or search input
- Populate `data/schools.json` with all FBS teams
- Navigate to `#school?id=<team>` with correct theming

### Phase 7 — Real Logos
- Download/link FBS team logos into `assets/logos/`
- Replace mosaic tile abbreviations with actual logo images
- Replace `.school-emblem` initials with logo

### Phase 8 — Polish & Deploy
- Sidebar logo styling (`.sidebar-logo-text`, `.sidebar-logo-accent`)
- Loading skeleton animations (shimmer effect instead of plain "Loading…")
- Deploy to AWS S3 + CloudFront
- Move API key out of source — serve via Lambda proxy or environment config

---

## Data Sources

| Source | Endpoint | Used For |
|--------|----------|----------|
| CFBD | `/rankings?year=&seasonType=` | AP Top 25, CFP Rankings |
| CFBD | `/games?year=&week=&seasonType=&classification=fbs` | Top Games, History |
| ESPN RSS via rss2json.com | `api.rss2json.com/v1/api.json?rss_url=espn...` | CFB News |

CFBD API docs: https://api.collegefootballdata.com/api/docs
Get/manage API key: https://collegefootballdata.com/key

---

*Last updated: Phase 3 complete — 2026-03-29*
