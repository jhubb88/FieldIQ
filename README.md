# FieldIQ

College football analytics dashboard — program-level data, nine analytical lenses, zero framework overhead.

**Live demo:** https://d1q3x6tsvbllgg.cloudfront.net

## Overview

FieldIQ is a browser-based single-page application for exploring FBS college football programs. It pulls live data from the College Football Data API (CFBD) and presents it across three views: a live dashboard (rankings, top games, news), per-school analytics profiles (DNA, situational splits, market performance, campus map), and a league-wide standings page. Built without any framework or build step — just HTML, CSS, and JavaScript.

## Features

- **Home dashboard** — AP Top 25, Top Games of the Week, ESPN CFB news, This Week in CFB History, CFP rankings; all fetched concurrently on load with per-section error handling
- **School profiles** — nine analytical lenses per program:
  - Program DNA: identity labels derived from stat patterns
  - Game Control & Volatility: blowout profile, consistency rating, close-game record
  - Situational: home/away splits, night game record, record vs. ranked, bowl history
  - Market Performance: ATS record, O/U record, home-underdog ATS, cover streaks
  - Schedule, Roster, Campus Map (Leaflet.js + OpenStreetMap), Long-Term Strength (rankings history, draft production, coaching continuity, 10-year record)
- **School theming** — sidebar and UI colors update to match each school's brand on navigation
- **League page** — FBS standings grouped by conference across all 10 conferences
- **164 FBS programs** in the schools dataset
- 24-hour client-side cache on all API responses

## Tech stack

| Layer | Technology |
|---|---|
| Markup / style / logic | Vanilla HTML5, CSS3, JavaScript (ES6+, strict mode) |
| Data | College Football Data API (CFBD) |
| News | ESPN RSS via rss2json.com |
| Maps | Leaflet.js 1.9.4 + OpenStreetMap |
| Fonts | Google Fonts CDN (Bebas Neue, Playfair Display, Barlow, Oswald) |
| Hosting | AWS S3 + CloudFront |

No npm, no bundler, no framework.

## Architecture

FieldIQ is a hash-based SPA (`#home`, `#school?id=texas`, `#league`). `router.js` listens for `hashchange` events and calls the matching page module's `render()` function, injecting output into `#page-content`. All API calls run through `cfbdFetch()` in `api.js`, which attaches a Bearer token from a locally configured file and caches responses for 24 hours in memory. Analytics lenses (DNA, Game Control, Situational, Market) are pure-computation modules with no DOM or API dependencies — they receive pre-fetched data arrays and return plain objects that `school.js` renders.

## Local development

```bash
# From the project root
python3 -m http.server 8770
```

Open `http://localhost:8770` in a browser. A CFBD API key configured in a local file (excluded from version control) is required to fetch live data. Get a free key at https://collegefootballdata.com/key

## Deployment

Deployed manually to AWS S3 + CloudFront. There is no CI/CD workflow — deploy and invalidate by hand:

```bash
# Sync to S3 (excludes local config and .git)
aws s3 sync . s3://jimmy-fieldiq \
  --profile portfolio-user \
  --exclude "config.js" \
  --exclude ".git/*"

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id E12Z80TRB0P2XR \
  --paths "/*" \
  --profile portfolio-user
```

**S3 bucket:** `jimmy-fieldiq` (us-east-1)  
**CloudFront distribution:** `E12Z80TRB0P2XR`

## Project structure

```
FieldIQ/
├── index.html              # App shell, CSS/JS load order
├── css/
│   ├── variables.css       # Design tokens — all colors, fonts, spacing
│   ├── base.css            # Reset, body defaults, Google Fonts import
│   ├── layout.css          # App shell, sidebar, topbar, page-content
│   └── components.css      # Cards, nav, chips, badges, section components
├── js/
│   ├── api.js              # cfbdFetch(), fetchRankings(), fetchGames(), fetchESPNNews()
│   ├── app.js              # Entry point — sidebar, init sequence
│   ├── router.js           # Hash router, navigate(), hashchange listener
│   ├── theme.js            # applyTheme(), restoreTheme(), resetTheme()
│   ├── dna.js              # Program DNA compute engine
│   ├── gamecontrol.js      # Game Control & Volatility compute engine
│   ├── situational.js      # Situational splits compute engine
│   └── market.js           # Market performance (ATS/O-U) compute engine
├── pages/
│   ├── home.js             # Home dashboard — live data, mosaic background
│   ├── school.js           # School profile — all nine analytics lenses
│   └── league.js           # FBS standings by conference
└── data/
    └── schools.js          # 164 FBS programs
```

## Known issues

- CFP poll fallback: CFBD does not always return the CFP committee poll by its exact name for all weeks; the CFP card falls back to AP Top 25 when the poll is absent.
- Top Games at week 15 (conference championship week): `homeRank`/`awayRank` fields are not populated in CFBD game records for this week; the card falls back to highest-scoring games.
- No CI/CD: deployment is manual. GitHub Actions workflow is a planned addition.

## License

MIT — see [LICENSE](LICENSE)

## Author

Jimmy Hubbard — [github.com/jhubb88](https://github.com/jhubb88)

---

*Part of [jhubb88's portfolio](https://jimmyhubbard2.cc)*
