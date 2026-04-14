'use strict';

/* =============================================================
   pages/home.js — FieldIQ Home Page
   Exposes: HomePage.render(), HomePage.unmount()
   Depends on: api.js (fetchRankings, fetchGames, fetchESPNNews)
   Theme: neutral only — resetTheme() called by router before render.
   ============================================================= */

/* ----------------------------------------------------------
   Season Constants
   Update these each season. All data fetches use these values.
   ---------------------------------------------------------- */
const CURRENT_YEAR = 2026;
const CURRENT_WEEK = null; /* null = offseason; set to integer week when season is live */

/* ----------------------------------------------------------
   History Constants
   "This Week in CFB History" pulls from the same week,
   10 years prior. Update HISTORY_YEAR each season.
   ---------------------------------------------------------- */
const HISTORY_YEAR = 2013;

/* ----------------------------------------------------------
   MOSAIC CONFIG
   Muted FBS-style color palette for placeholder tiles.
   Each entry: [backgroundColor, abbreviation]
   ---------------------------------------------------------- */
const MOSAIC_TILES = [
  ['#1a2a4a', 'ALA'], ['#2a1a1a', 'UGA'], ['#1a2a1a', 'MSU'],
  ['#2a2a1a', 'LSU'], ['#1a1a2a', 'OU' ], ['#2a2a1a', 'OSU'],
  ['#1a3a2a', 'ND' ], ['#3a1a1a', 'TEX'], ['#1a1a3a', 'UNC'],
  ['#2a3a1a', 'USC'], ['#3a2a1a', 'AUB'], ['#1a2a3a', 'PSU'],
  ['#2a1a3a', 'MIA'], ['#3a1a2a', 'TEN'], ['#1a3a1a', 'ORE'],
  ['#3a2a2a', 'FLA'], ['#2a2a3a', 'WIS'], ['#3a3a1a', 'ARK'],
  ['#1a3a3a', 'IOW'], ['#3a1a3a', 'KSU'], ['#2a3a3a', 'WVU'],
  ['#3a3a2a', 'KEN'], ['#243040', 'UCF'], ['#302430', 'TCU'],
  ['#243024', 'MIZ'], ['#302418', 'CLM'], ['#182430', 'PUR'],
];

/* ----------------------------------------------------------
   buildMosaicTiles
   Generates HTML for ~112 tiles (7 rows × 16 cols).
   ---------------------------------------------------------- */
function buildMosaicTiles() {
  const count = 112;
  let html = '';
  for (let i = 0; i < count; i++) {
    const [bg, abbr] = MOSAIC_TILES[i % MOSAIC_TILES.length];
    html += `<div class="mosaic-tile" style="background-color:${bg}">${abbr}</div>`;
  }
  return html;
}

/* ----------------------------------------------------------
   timeAgo
   Converts an RFC 2822 date string (from RSS pubDate) into
   a human-readable relative time: "2h ago", "3d ago", etc.
   Falls back to the raw date string if parsing fails.
   ---------------------------------------------------------- */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const normalized = dateStr.includes('T') || dateStr.endsWith('Z')
    ? dateStr
    : dateStr.replace(' ', 'T') + 'Z';
  const then = new Date(normalized);
  if (isNaN(then)) return dateStr;
  const diffMs  = Date.now() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)   return 'just now';
  if (diffMin < 60)  return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr  < 24)  return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

/* ----------------------------------------------------------
   loadingRows
   Returns N placeholder rows shown while a section is fetching.
   ---------------------------------------------------------- */
function loadingRows(count = 5) {
  return Array.from({ length: count }, () => `
    <div class="home-list-row home-list-row--loading">
      <span class="home-list-label" style="opacity:0.3;font-style:italic">Loading\u2026</span>
    </div>
  `).join('');
}

/* ----------------------------------------------------------
   getCalendarWeek
   Returns the ISO 8601 week number (1–53) for today's date.
   Used by the "This Week in CFB History" section so the fetch
   always targets the current time of year regardless of whether
   the football season is active. Completely independent of
   CURRENT_WEEK — that sentinel is for live-season sections only.
   ---------------------------------------------------------- */
function getCalendarWeek() {
  const now = new Date();
  const d   = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/* ----------------------------------------------------------
   errorHTML
   Inline error message displayed inside a card when a fetch
   fails. Never crashes the page — each section fails alone.
   ---------------------------------------------------------- */
function errorHTML(message) {
  return `
    <div class="home-list-row" style="flex-direction:column;gap:4px;opacity:0.6">
      <span class="home-list-label" style="font-size:0.78rem;color:var(--text-secondary)">
        Unable to load data
      </span>
      <span class="home-list-meta">${message}</span>
    </div>
  `;
}

/* ----------------------------------------------------------
   setSection
   Finds a section container by ID and replaces its innerHTML.
   No-ops if the element has been removed (user navigated away).
   ---------------------------------------------------------- */
function setSection(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

/* ----------------------------------------------------------
   _schoolLink
   Wraps a CFBD school name in a .school-link <span>.
   Looks up the school's conference from SCHOOLS_DATA so the
   CSS tooltip can show "School · Conference" on hover.
   The delegated click listener in app.js handles navigation.

   @param {string} cfbdName    — CFBD school name, e.g. 'Texas'
   @param {string} [innerHtml] — optional custom inner HTML
                                 (e.g. rank prefix already included)
   @returns {string} — HTML string
   ---------------------------------------------------------- */
function _schoolLink(cfbdName, innerHtml) {
  /* Look up conference from the SCHOOLS_DATA global */
  const entry   = (SCHOOLS_DATA && SCHOOLS_DATA.teams || []).find(function (t) {
    return t.name.replace(t.mascot, '').trim() === cfbdName;
  });
  const conf    = entry ? entry.conference : '';
  const tooltip = conf ? `${cfbdName} \u00b7 ${conf}` : cfbdName;
  const label   = innerHtml !== undefined ? innerHtml : cfbdName;

  return `<span class="school-link" data-team="${cfbdName}" data-tooltip="${tooltip}">${label}</span>`;
}

/* =============================================================
   DATA RENDERERS
   Each function receives raw API data and returns an HTML string.
   School names are wrapped in .school-link spans so the delegated
   click handler in app.js can navigate to the school page.
   ============================================================= */

/* ----------------------------------------------------------
   _hasRankingData
   Returns true if a rankings API response contains at least
   one poll with ranked teams. Used to detect offseason empty
   responses so we can fall back to the prior year's final poll.
   ---------------------------------------------------------- */
function _hasRankingData(data) {
  if (!Array.isArray(data) || !data.length) return false;
  return data.some(function (w) {
    return Array.isArray(w.polls) && w.polls.some(function (p) {
      return Array.isArray(p.ranks) && p.ranks.length > 0;
    });
  });
}

/* ----------------------------------------------------------
   renderTop25
   Receives the full rankings API response array.
   Finds the most recent week with an "AP Top 25" poll entry.
   ---------------------------------------------------------- */
function renderTop25(rankingsData) {
  for (const week of rankingsData) {
    const apPoll = week.polls?.find(p => p.poll === 'AP Top 25');
    if (!apPoll || !apPoll.ranks?.length) continue;

    return apPoll.ranks
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map(r => `
        <div class="home-list-row">
          <span class="home-list-rank">${r.rank}</span>
          <span class="home-list-label">${_schoolLink(r.school)}</span>
          ${r.wins != null ? `<span class="home-list-meta">${r.wins}\u2013${r.losses}</span>` : ''}
        </div>
      `).join('');
  }
  return errorHTML('No AP Top 25 data found for this week.');
}

/* ----------------------------------------------------------
   renderGames
   Receives all games for the current week. Filters to ranked
   matchups, sorts by best combined rank. Both team names are
   wrapped in .school-link spans.
   ---------------------------------------------------------- */
function renderGames(gamesData) {
  /* Only show games involving at least one AP Top 25 team.
     Sorted by best combined rank so the marquee matchup leads. */
  const ranked = gamesData
    .filter(g => g.homeRank != null || g.awayRank != null)
    .sort((a, b) => {
      const rankA = Math.min(a.homeRank ?? 99, a.awayRank ?? 99);
      const rankB = Math.min(b.homeRank ?? 99, b.awayRank ?? 99);
      return rankA - rankB;
    });

  const displayGames = ranked;

  if (!displayGames.length) {
    const msg = CURRENT_WEEK !== null
      ? `No ranked matchups scheduled for Week ${CURRENT_WEEK}, ${CURRENT_YEAR}.`
      : `No games in progress \u2014 season starts in late August.`;
    return `<div class="home-list-row"><span class="home-list-label" style="opacity:0.5">${msg}</span></div>`;
  }

  return displayGames.map(g => {
    const awayRk  = g.awayRank ? `<span style="opacity:0.5">#${g.awayRank}</span> ` : '';
    const homeRk  = g.homeRank ? `<span style="opacity:0.5">#${g.homeRank}</span> ` : '';
    const atSign  = `<span style="opacity:0.35"> @ </span>`;

    let timeStr = '';
    if (g.startDate) {
      const d = new Date(g.startDate);
      timeStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    const network  = g.tvBroadcast || g.tv || '';
    const awayLink = _schoolLink(g.awayTeam, `${awayRk}${g.awayTeam}`);
    const homeLink = _schoolLink(g.homeTeam, `${homeRk}${g.homeTeam}`);

    return `
      <div class="home-list-row">
        <span class="home-list-label">${awayLink}${atSign}${homeLink}</span>
        ${timeStr  ? `<span class="home-list-meta">${timeStr}</span>` : ''}
        ${network  ? `<span class="home-list-meta" style="min-width:40px;text-align:right">${network}</span>` : ''}
      </div>
    `;
  }).join('');
}

/* ----------------------------------------------------------
   renderNews
   Receives array of {title, pubDate, link} from ESPN RSS.
   Displays up to 10 most recent items.
   ---------------------------------------------------------- */
function renderNews(newsItems) {
  if (!newsItems.length) {
    return errorHTML('No news items returned.');
  }

  return newsItems.slice(0, 10).map(n => `
    <div class="home-list-row" style="flex-direction:column;align-items:flex-start;gap:3px">
      <span class="home-list-label" style="white-space:normal;font-size:0.8rem;line-height:1.35">
        ${n.title}
      </span>
      <span class="home-list-meta">${timeAgo(n.pubDate)}</span>
    </div>
  `).join('');
}

/* ----------------------------------------------------------
   renderHistory
   Receives games from HISTORY_YEAR / current calendar week.
   Picks the most notable game and formats it as a fact card.
   Both team names in the fact sentence are school links.
   ---------------------------------------------------------- */
function renderHistory(gamesData, week) {
  if (!gamesData.length) {
    return errorHTML(`No games found for Week ${week}, ${HISTORY_YEAR}.`);
  }

  /* Prefer a ranked matchup; otherwise take the highest-scoring game */
  const ranked = gamesData
    .filter(g => g.homeRank != null || g.awayRank != null)
    .sort((a, b) => {
      const rankA = Math.min(a.homeRank ?? 99, a.awayRank ?? 99);
      const rankB = Math.min(b.homeRank ?? 99, b.awayRank ?? 99);
      return rankA - rankB;
    });

  const game = ranked[0] || gamesData.sort((a, b) =>
    ((b.homePoints || 0) + (b.awayPoints || 0)) - ((a.homePoints || 0) + (a.awayPoints || 0))
  )[0];

  const homeWon  = (game.homePoints ?? 0) > (game.awayPoints ?? 0);
  const winner   = homeWon ? game.homeTeam : game.awayTeam;
  const loser    = homeWon ? game.awayTeam : game.homeTeam;
  const winScore = homeWon ? game.homePoints : game.awayPoints;
  const losScore = homeWon ? game.awayPoints : game.homePoints;

  const scoreStr = (winScore != null && losScore != null)
    ? ` ${winScore}\u2013${losScore}`
    : '';

  const winnerLink = _schoolLink(winner);
  const loserLink  = _schoolLink(loser);

  const rankNote = (() => {
    const wr = homeWon ? game.homeRank : game.awayRank;
    const lr = homeWon ? game.awayRank : game.homeRank;
    if (wr && lr) return ` #${wr} ${winnerLink} defeated #${lr} ${loserLink}`;
    if (wr)       return ` #${wr} ${winnerLink} defeated ${loserLink}`;
    return ` ${winnerLink} defeated ${loserLink}`;
  })();

  const sentence = `${HISTORY_YEAR}, Week ${week}:${rankNote}${scoreStr}.`;

  return `
    <div style="font-family:var(--font-serif);font-size:0.95rem;line-height:1.6;color:var(--text-primary);font-style:italic">
      \u201c${sentence}\u201d
    </div>
    <div class="home-list-meta" style="margin-top:6px">\u2014 ${HISTORY_YEAR} Season, Week ${week}</div>
  `;
}

/* ----------------------------------------------------------
   FAST_FACTS
   100 curated CFB facts. One is selected at random on each
   page load by renderFastFact(). No API call — purely static.
   ---------------------------------------------------------- */
const FAST_FACTS = [
  'Barry Sanders averaged 238.9 rushing yards per game in 1988 — a record so untouchable that the second-best ever (Ashton Jeanty, 2024) was 53 yards per game behind him.',
  'Oklahoma and Texas Tech combined for 1,708 yards of total offense in a single 2016 game — an FBS record. Patrick Mahomes threw for 734 yards in a loss.',
  'Georgia Tech beat Cumberland 222\u20130 in 1916 — the most lopsided game in college football history.',
  'Oklahoma holds the record for the longest winning streak in FBS history — 47 consecutive wins between 1953 and 1957.',
  'Florida has scored in 461 consecutive games — the longest active streak in FBS history. They haven\u2019t been shut out since 1988.',
  'Houston\u2019s 1989 offense put up 1,021 yards in a single game against SMU. Andre Ware threw for 517 yards and 6 TDs — in the first half alone.',
  'Connor Halliday of Washington State threw 89 passes in a single game against Oregon in 2013 — an FBS record.',
  'Michigan has more all-time wins than any program in college football history.',
  'Yale has won more claimed national championships than any program in history — 18.',
  'Notre Dame has the highest all-time winning percentage of any major college football program.',
  'USC has produced more Heisman Trophy winners than any other school — 7 (though Reggie Bush\u2019s was vacated).',
  'Ron Dayne rushed for 7,125 career yards at Wisconsin — the FBS career rushing record.',
  'The 1939 Tennessee Volunteers went an entire regular season without allowing a single point — undefeated, untied, and unscored upon across 10 games.',
  'Terrell Suggs recorded 24 sacks in a single season at Arizona State in 2002 — the official FBS record.',
  'Case Keenum finished his Houston career with over 20,000 yards of total offense — the most ever in college football history at the time.',
  'Montee Ball set an FBS record with 39 touchdowns in a single season at Wisconsin.',
  'The longest field goal in college football history was 69 yards, kicked by Ove Johansson of Abilene Christian in 1976.',
  'Kansas holds the Division I record for most tie games in history — 57.',
  'The first college football game was played on November 6, 1869 between Rutgers and Princeton. It looked more like soccer than modern football.',
  'The first college football game ever broadcast on radio was West Virginia vs. Pittsburgh in 1921.',
  'The first college football game on television was Fordham vs. Waynesburg on September 30, 1939 — watched by an estimated 500 to 5,000 people.',
  'Instant replay made its debut during the 1963 Army-Navy game. The announcer warned viewers: \u201cArmy did not score again!\u201d',
  'The AP Poll has ranked college football teams since 1936 — predating the Super Bowl, the NBA, and the NHL\u2019s modern era.',
  'The first Heisman Trophy was awarded to Jay Berwanger of Chicago in 1935. He never played a single down in the NFL.',
  'The BCS era began in 1998 when Tennessee defeated Florida State in the Fiesta Bowl — the first official FBS national championship game.',
  'Army and Navy have played every year since 1930 — one of the longest uninterrupted rivalries in American sports.',
  'The first college football game played under the lights was West Virginia vs. Pittsburgh in 1891.',
  'Notre Dame\u2019s first mascots weren\u2019t leprechauns — they were dogs, a goat, and a canary bird.',
  'Georgia\u2019s first mascot at their first intercollegiate game in 1892 was a goat, not a bulldog.',
  'Michigan was the first band to dot the \u201ci\u201d in Ohio State\u2019s Script Ohio — not Ohio State.',
  'The USC Trojan Marching Band recorded with Fleetwood Mac on the album \u201cTusk\u201d in 1979 — the only college band ever to appear on a platinum album.',
  'Auburn\u2019s very first bowl game was the 1937 Bacardi Bowl in Havana, Cuba — played under dictator Fulgencio Batista.',
  'Princeton won 28 national championships in the early era of college football — more than any other program in history by raw count.',
  'Clemson and Auburn share the Tigers mascot because Clemson\u2019s founder played at Auburn and brought the name with him.',
  'Michigan Stadium — \u201cThe Big House\u201d — is the largest stadium in the United States, holding over 107,000 fans.',
  'Franklin Field at Penn is the oldest continuously operating college football stadium in America. It also hosted the NFL\u2019s Philadelphia Eagles from 1958 to 1970.',
  'There are 8 college football stadiums in the United States that hold more fans than any NFL stadium.',
  'Death Valley at LSU is one of the loudest stadiums in the world — crowd noise has been measured at over 130 decibels.',
  'The on-field turf temperature at a typical afternoon game in the SEC can exceed 120\u00b0F in September.',
  'Ohio State and Notre Dame are tied for the most Heisman Trophy winners with 7 each.',
  'Archie Griffin of Ohio State is the only player in history to win the Heisman Trophy twice — 1974 and 1975.',
  'Barry Sanders won the 1988 Heisman by the largest margin in history at the time, despite playing for unranked Oklahoma State.',
  'Vinny Testaverde won the Heisman, Maxwell, O\u2019Brien, and Walter Camp awards all in the same year (1986) — then went first overall in the NFL Draft.',
  'Johnny Manziel became the first freshman in history to win the Heisman Trophy in 2012.',
  'The Iron Bowl (Alabama vs. Auburn) was not played from 1907 to 1948 — a 41-year gap caused by a dispute over officiating fees.',
  'The Red River Showdown between Texas and Oklahoma has been played at the Cotton Bowl in Dallas — neutral ground — since 1929.',
  'LSU\u2019s Death Valley and Clemson\u2019s Death Valley share the same nickname — both fan bases claim it as their own.',
  'Wisconsin\u2019s student section has developed a multi-step Wave ritual — clockwise, slow-motion, double-speed, counter-clockwise, and split — performed at every home game.',
  'Nick Saban retired as the winningest coach in SEC history with 7 national championships — 6 at Alabama and 1 at LSU.',
  'Knute Rockne of Notre Dame had the highest winning percentage of any major college football coach in history at .881.',
  'Dabo Swinney was hired at Clemson as an interim coach in 2008 with the team at 3\u20133. He never left — and won 2 national championships.',
  'The 2007 Fiesta Bowl — Boise State vs. Oklahoma — is widely considered the greatest bowl game ever played. Boise State won in overtime with a hook-and-lateral, a halfback pass, and a two-point Statue of Liberty conversion.',
  'In 2006, Michigan and Ohio State played each other as the #1 and #2 teams in the country for the first time in history.',
  'The 2011 BCS National Championship was a rematch — Alabama beat LSU 21\u20130. LSU never scored.',
  'The longest game in FBS history lasted over 7 hours — Arkansas vs. Kentucky went 7 overtimes in 2003. Arkansas won 71\u201363.',
  'Vince Young\u2019s 4th-and-5 scramble with 19 seconds left gave Texas the 2005 national championship over USC — widely considered one of the greatest plays in college football history.',
  'The 2013 Iron Bowl \u201cKick Six\u201d — Auburn returning a missed field goal 109 yards as time expired — is the most stunning finish in modern college football history.',
  'There are 134 FBS programs competing across 10 conferences and as independents.',
  'The SEC has won 12 of the last 20 national championships — the most dominant conference run in the modern era.',
  'The CFP expanded from 4 to 12 teams in 2024 — the biggest structural change to college football\u2019s postseason in history.',
  'Indiana won the 2026 CFP National Championship — their first ever — one of the most unlikely championships in modern college football history.',
  'Notre Dame has never been a member of a football conference — they\u2019ve played as an independent since 1887.',
  'The Big Ten has 18 members — making its name a mathematical relic from when it had 10.',
  'Texas and Oklahoma joined the SEC in 2024 — the first time the conference included programs from Texas, Oklahoma, Alabama, Georgia, and Florida simultaneously.',
  'Boise State\u2019s blue turf — \u201cThe Smurf Turf\u201d — was installed in 1986. It was the first non-green artificial turf in college football history.',
  'The 2018 Clemson Tigers went 15\u20130 — the only perfect 15-win season in FBS history.',
  'Michigan State overcame a 35-point deficit against Northwestern in 2006 — the largest comeback in FBS history. They trailed 38\u20133 with under 10 minutes left in the third quarter.',
  'LSU\u2019s Bengal Punch sports drink was invented in 1958 — seven years before Gatorade. It may be the first sports drink ever created.',
  'Missouri is credited with inventing the tradition of Homecoming — later adopted by colleges and high schools across the country.',
  'The first Rose Bowl was played on January 1, 1902. Michigan beat Stanford 49\u20130. It was so lopsided that the game wasn\u2019t played again until 1916.',
  'The oldest player ever to appear in a college football game was Tom Thompson, who played for Austin College at age 61 in 2009.',
  'The first African-American player in college football history was William Henry Lewis, who played for Amherst in 1889. He later became an All-American at Harvard.',
  'The first woman to score in a college football game was Liz Heaston, who kicked two extra points for Willamette University in 1997.',
  'There is technically no BCS national champion for the 2004 season — USC\u2019s Orange Bowl victory was later vacated due to NCAA violations, leaving no champion on the books.',
  'Fresno State scored 49 points in 6 minutes and 25 seconds against Utah State in 2001 — the fastest scoring explosion in FBS history.',
  'Army went 0\u201313 in 2003 — the only FBS program ever to lose more than 12 games in a single season. They were outscored 476\u2013206 on the year.',
  'Virginia Tech\u2019s football team was originally called the \u201cFighting Gobblers\u201d before becoming the Hokies.',
  'Oklahoma State was retroactively named the 1945 football national champion — making them technically the first school ever to win a football and basketball national championship in the same year.',
  'John Gagliardi compiled 489 wins over a 64-year coaching career — more than any other coach at any level of college football.',
  'West Virginia is the winningest FBS program in history to never win a national championship.',
  'Kansas holds the all-time FBS record for tie games — 57. The NCAA eliminated ties in 1996.',
  'Gatorade was invented at the University of Florida in 1965 to help Gator players replenish fluids — which is where the name came from.',
  'The College Football Hall of Fame is located in Atlanta, Georgia — the same city that hosted the CFP National Championship in 2018 and 2025.',
  'Football chains — used to measure first downs — have been in use since 1906. They remain one of the most low-tech officiating tools in major American sports.',
  'National champions used to be declared before bowl games were played. From the 1930s to the 1960s, teams were sometimes crowned champion and then went on to lose their bowl game.',
  'In 1945, Oklahoma was named national champion after the regular season — then lost their bowl game. The title stood anyway.',
  'Notre Dame struck a deal with the BCS in 2005 guaranteeing them $1 million per year even in seasons they didn\u2019t qualify for a bowl game.',
  'The first college football game ever played in a foreign country was Auburn\u2019s 1937 Bacardi Bowl in Havana, Cuba.',
  'Indiana\u2019s 2025 national championship capped a season in which they became the first Hoosiers team in history to finish the regular season undefeated — and the first to be ranked #1 in the AP Poll.',
  'Barry Sanders\u2019 1988 season stats included bowl game stats that weren\u2019t officially counted — if they were, his single-season rushing record would be 2,850 yards, not 2,628.',
  'The first college football game played outdoors at night was West Virginia vs. Pittsburgh in 1891 — lit by electric lights strung around the field.',
  'Appalachian State\u2019s 2007 upset of Michigan in Ann Arbor — a 34\u201332 win as an FCS team over a top-5 FBS program — is considered the greatest upset in college football history.',
  'The forward pass was legalized in college football in 1906 — largely to reduce the number of deaths and serious injuries caused by mass-formation plays.',
  'College football\u2019s first overtime game under current rules was played in 1996 — before that, tied games simply ended as ties.',
  'The SEC\u2019s total revenue in 2023 exceeded $1 billion — making it one of the most financially powerful athletic conferences in the world.',
  'Oklahoma\u2019s 47-game winning streak from 1953\u20131957 was snapped by Notre Dame — a team they had beaten 7 straight times before that.',
  'The first college football game to sell out was the 1916 Rose Bowl — Harvard vs. Oregon drew a crowd of 7,000, which was considered massive at the time.',
  'Penn State\u2019s Beaver Stadium was originally built in 1960 with a capacity of 46,284. It has since been expanded 9 times and now holds over 106,000.',
  'Texas A&M\u2019s 12th Man tradition — where the entire student section stands for the whole game — dates back to 1922, when a student named E. King Gill was called from the stands to suit up for an injured player.',
  'The longest field goal attempt in FBS history — 72 yards — was attempted by Memphis in 2017. It fell short, but remains the longest attempt ever recorded.',
];

/* ----------------------------------------------------------
   renderFastFact
   Picks one fact at random from FAST_FACTS and returns the
   styled HTML. Called once per page load from render().
   No API call — static only.
   ---------------------------------------------------------- */
function renderFastFact() {
  const fact = FAST_FACTS[Math.floor(Math.random() * FAST_FACTS.length)];
  return `
    <div style="font-family:var(--font-serif);font-size:0.88rem;line-height:1.65;color:var(--text-primary);font-style:italic">
      ${fact}
    </div>
  `;
}

/* ----------------------------------------------------------
   renderCFP
   Receives the full rankings API response.
   Tries "College Football Playoff" poll first; falls back to
   AP Top 25 if CFP data isn't available yet (early season).
   School names are wrapped in .school-link spans.
   ---------------------------------------------------------- */
function renderCFP(rankingsData) {
  let pollName = 'College Football Playoff';
  let pollData = null;

  for (const week of rankingsData) {
    const cfp = week.polls?.find(p => p.poll === 'College Football Playoff');
    if (cfp?.ranks?.length) {
      pollData = cfp;
      break;
    }
  }

  if (!pollData) {
    pollName = 'AP Top 25 (CFP N/A)';
    for (const week of rankingsData) {
      const ap = week.polls?.find(p => p.poll === 'AP Top 25');
      if (ap?.ranks?.length) {
        pollData = ap;
        break;
      }
    }
  }

  if (!pollData) {
    return errorHTML('No ranking data available.');
  }

  const displayRanks = pollData.ranks.slice().sort((a, b) => a.rank - b.rank).slice(0, 12);

  return displayRanks.map(r => `
    <div class="home-list-row">
      <span class="home-list-rank">${r.rank}</span>
      <span class="home-list-label">${_schoolLink(r.school)}</span>
      ${r.wins != null ? `<span class="home-list-meta">${r.wins}\u2013${r.losses}</span>` : ''}
    </div>
  `).join('');
}

/* =============================================================
   HomePage Object
   ============================================================= */
const HomePage = {

  /* ----------------------------------------------------------
     render
     Returns the full page skeleton HTML with loading states.
     Schedules loadData() via microtask so it fires after the
     router injects this string into #page-content.
     ---------------------------------------------------------- */
  render() {
    /* Mount mosaic into dedicated root outside the app shell */
    const mosaicRoot = document.getElementById('mosaic-root');
    if (mosaicRoot) {
      mosaicRoot.innerHTML = `
        <div class="mosaic-bg">
          <div class="mosaic-grid">${buildMosaicTiles()}</div>
          <div class="mosaic-overlay"></div>
        </div>
      `;
    }

    Promise.resolve().then(function () { HomePage.loadData(); });

    return `
      <!-- Hero -->
      <div class="home-hero">
        <div class="home-hero-wordmark">FieldIQ</div>
        <div class="home-hero-tagline">FBS College Football &mdash; Data, Stats, Information</div>
      </div>

      <!-- Dashboard grid -->
      <div class="home-grid">

        <!-- AP Top 25 -->
        <div class="home-card home-card--top25">
          <div class="home-card-title" id="section-top25-title">AP Top 25</div>
          <div class="home-list" id="section-top25">${loadingRows(10)}</div>
        </div>

        <!-- Top Games of Week -->
        <div class="home-card home-card--games">
          <div class="home-card-title">Top Games \u2014 ${CURRENT_WEEK !== null ? `Week ${CURRENT_WEEK}, ${CURRENT_YEAR}` : `Offseason ${CURRENT_YEAR}`}</div>
          <div class="home-list" id="section-games">${loadingRows(4)}</div>
        </div>

        <!-- CFB News Feed -->
        <div class="home-card home-card--news">
          <div class="home-card-title">CFB News</div>
          <div class="home-list" id="section-news">${loadingRows(6)}</div>
        </div>

        <!-- History + Fast Facts — stacked column, grid slot col 2 / row 2 -->
        <div class="home-card-col home-card-col--facts">
          <div class="home-card home-card--fact">
            <div class="home-card-title">This Week in CFB History</div>
            <div id="section-fact">${loadingRows(1)}</div>
          </div>
          <div class="home-card home-card--fastfacts">
            <div class="home-card-title">Did You Know?</div>
            <div id="section-fastfact">${renderFastFact()}</div>
          </div>
        </div>

        <!-- CFP Rankings -->
        <div class="home-card home-card--cfp">
          <div class="home-card-title" id="section-cfp-title">CFP Rankings</div>
          <div class="home-list" id="section-cfp">${loadingRows(8)}</div>
        </div>

      </div>
    `;
  },

  /* ----------------------------------------------------------
     loadData
     Fires all data fetches concurrently via Promise.allSettled.
     Rankings are fetched once and shared between Top 25 + CFP.
     History uses the same games endpoint with different params.
     ---------------------------------------------------------- */
  async loadData() {
    /* Compute the current ISO calendar week — used only for the history fetch.
       Independent of CURRENT_WEEK, which is the live-season sentinel. */
    const calWeek = getCalendarWeek();

    const [rankingsResult, gamesResult, newsResult, historyResult] =
      await Promise.allSettled([
        fetchRankings(CURRENT_YEAR, 'regular'),
        CURRENT_WEEK !== null
          ? fetchGames(CURRENT_YEAR, CURRENT_WEEK, 'regular', { classification: 'fbs' })
          : Promise.resolve([]),
        fetchESPNNews(),
        fetchGames(HISTORY_YEAR, calWeek, 'regular', { classification: 'fbs' }),
      ]);

    /* ----------------------------------------------------------
       Rankings — if current year has no data (offseason), fall
       back to prior year postseason and relabel both cards.
       ---------------------------------------------------------- */
    let rankingsData  = null;
    let top25Label    = 'AP Top 25';
    let cfpLabel      = 'CFP Rankings';

    if (rankingsResult.status === 'fulfilled' && _hasRankingData(rankingsResult.value)) {
      rankingsData = rankingsResult.value;
    } else {
      /* Offseason fallback — fetch prior year final standings */
      try {
        const fallback = await fetchRankings(CURRENT_YEAR - 1, 'postseason');
        if (_hasRankingData(fallback)) {
          rankingsData = fallback;
          top25Label   = `Final ${CURRENT_YEAR - 1} AP Rankings`;
          cfpLabel     = `Final ${CURRENT_YEAR - 1} CFP Rankings`;
        }
      } catch (e) { /* fallback failed — rankingsData stays null */ }
    }

    /* AP Top 25 */
    const top25TitleEl = document.getElementById('section-top25-title');
    if (top25TitleEl) top25TitleEl.textContent = top25Label;

    if (rankingsData) {
      setSection('section-top25', renderTop25(rankingsData));
    } else {
      setSection('section-top25', errorHTML('Rankings data unavailable.'));
    }

    /* Top Games */
    if (gamesResult.status === 'fulfilled') {
      setSection('section-games', renderGames(gamesResult.value));
    } else {
      setSection('section-games', errorHTML(gamesResult.reason?.message || 'Fetch failed'));
    }

    /* CFB News */
    if (newsResult.status === 'fulfilled') {
      setSection('section-news', renderNews(newsResult.value));
    } else {
      setSection('section-news', errorHTML(newsResult.reason?.message || 'Fetch failed'));
    }

    /* CFB History */
    if (historyResult.status === 'fulfilled') {
      setSection('section-fact', renderHistory(historyResult.value, calWeek));
    } else {
      setSection('section-fact', errorHTML(historyResult.reason?.message || 'Fetch failed'));
    }

    /* CFP Rankings — reuses rankings data, updates title */
    const cfpTitleEl = document.getElementById('section-cfp-title');

    if (rankingsData) {
      const hasCFP = rankingsData.some(function (w) {
        return w.polls && w.polls.some(function (p) {
          return p.poll === 'College Football Playoff' && p.ranks && p.ranks.length;
        });
      });
      if (cfpTitleEl) {
        cfpTitleEl.textContent = hasCFP ? cfpLabel : cfpLabel.replace('CFP', 'CFP (AP Fallback)');
      }
      setSection('section-cfp', renderCFP(rankingsData));
    } else {
      if (cfpTitleEl) cfpTitleEl.textContent = cfpLabel;
      setSection('section-cfp', errorHTML('Rankings data unavailable.'));
    }
  },

  /* ----------------------------------------------------------
     unmount
     Called by the router when navigating away from home.
     Clears the mosaic so it doesn't persist on other pages.
     ---------------------------------------------------------- */
  unmount() {
    const mosaicRoot = document.getElementById('mosaic-root');
    if (mosaicRoot) mosaicRoot.innerHTML = '';
  },

};
