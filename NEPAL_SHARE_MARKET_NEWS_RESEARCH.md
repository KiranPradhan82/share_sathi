# Nepal Share Market News Sources — Comprehensive Research Report
**For: Share Sathi — NEPSE Market Automation Dashboard**
**Date: June 2026**

---

## Executive Summary

After visiting and analyzing 17+ sources, this report identifies **Tier 1 (production-ready)**, **Tier 2 (feasible with effort)**, and **Tier 3 (limited/restricted)** news sources for programmatically fetching Nepal share market news. The recommended architecture combines **merolagani.com scraping** (Nepali + English financial news), **sharesansar.com homepage scraping** (IPO/company/analysis news), **SEBON API scraping** (regulatory/IPO pipeline), **myrepublica RSS** (English business news), and **Google News RSS** (aggregated Nepali+English news) as a catch-all.

---

## TIER 1: Production-Ready Sources (Scrape Directly)

### 1. merolagani.com — ⭐ HIGHEST PRIORITY
| Attribute | Details |
|---|---|
| **Base URL** | `https://merolagani.com` |
| **News Page** | `https://merolagani.com/NewsList.aspx` |
| **English News** | `https://eng.merolagani.com/NewsList.aspx?id=10&type=latest` |
| **Announcements** | `https://merolagani.com/AnnouncementList.aspx` |
| **News Detail** | `https://merolagani.com/NewsDetail.aspx?newsID={ID}` |
| **Announcement Detail** | `https://merolagani.com/AnnouncementDetail.aspx?id={ID}` |
| **RSS Feed** | ❌ None found |
| **Public API** | ❌ None |
| **Auth Required** | ❌ No |
| **Scrapable?** | ✅ YES — Server-rendered ASP.NET, all content in initial HTML |
| **Language** | Nepali (main), English (eng.merolagani.com) |
| **Content Types** | NEPSE updates, company announcements, dividends, AGM, IPO, gold/silver prices, pre-open session updates, economic news |
| **Reliability** | ★★★★★ — Largest Nepali financial portal, stable, well-structured |

**HTML Structure (verified):**
- News list items use CSS class `media-news` / `media-news-lg`
- Title in `media-title` class
- Date/time in `media-body` (format: "Jun 19, 2026 11:25 AM")
- 8 news items per page load
- News IDs are sequential integers (currently ~127644)
- Mixed content: ~50% share market, ~50% general Nepali news (filter by title keywords)

**Scraping Pattern (Node.js/axios/cheerio):**
```javascript
// News list
const { data } = await axios.get('https://merolagani.com/NewsList.aspx');
const $ = cheerio.load(data);
$('.media-news').each((i, el) => {
  const title = $(el).find('.media-title a').text().trim();
  const link = $(el).find('.media-title a').attr('href');
  const date = $(el).find('.media-body').text().trim();
  // Parse: link = "/NewsDetail.aspx?newsID=127644"
});

// Announcements
const { data: annData } = await axios.get('https://merolagani.com/AnnouncementList.aspx');
// Same structure, links to /AnnouncementDetail.aspx?id={ID}

// English version
const { data: engData } = await axios.get('https://eng.merolagani.com/NewsList.aspx?id=10&type=latest');
```

**Key Category IDs (from nav):** id=10 (latest/English), id=12, 13, 15, 17, 23, 25

**Content Quality for Facebook Posts:** EXCELLENT — Titles like "प्रि ओपन सेसन अपडेटः ११ अंक बढ्यो नेप्से" / "Pre-Open Session Update: NEPSE Index Increases 11 Points" are perfect for auto-posting.

---

### 2. sharesansar.com — ⭐ HIGH PRIORITY
| Attribute | Details |
|---|---|
| **Base URL** | `https://www.sharesansar.com` |
| **News (Homepage)** | `https://www.sharesansar.com` (news in homepage HTML) |
| **News Detail** | `https://www.sharesansar.com/newsdetail/{slug}-{date}` |
| **Featured/Static** | `https://www.sharesansar.com/news-page` (only 5 pinned articles) |
| **RSS Feed** | ❌ None found |
| **Public API** | ❌ None official (third-party: `parse.bot` — paid) |
| **Auth Required** | ❌ No |
| **Scrapable?** | ✅ YES — WordPress-based, server-rendered |
| **Language** | English |
| **Content Types** | NEPSE weekly summaries, IPO allotments, company profits, dividends, right shares, auction results, IPO opening/closing, market analysis |
| **Reliability** | ★★★★★ — Second largest portal, established 2011 |

**CRITICAL FINDING:** The `news-page` and `category/news` pages only show 5 static/pinned articles. The **actual latest 20+ news articles are embedded in the homepage HTML** as `newsdetail` links with full slugs.

**Scraping Pattern:**
```javascript
const { data } = await axios.get('https://www.sharesansar.com');
const $ = cheerio.load(data);
const newsLinks = [];
$('a[href*="/newsdetail/"]').each((i, el) => {
  const href = $(el).attr('href');
  const title = $(el).text().trim();
  if (title.length > 20 && !newsLinks.find(n => n.url === href)) {
    newsLinks.push({ title, url: href });
  }
});
// Returns 20+ articles including:
// - "NEPSE concludes the week with 0.50% loss..."
// - "IPO shares of Appolo Hydropower Limited listed in NEPSE..."
// - "United Ajod Insurance Limited proposes 45.113% dividend..."
```

**Note:** To filter share-market-specific content, use keyword matching on the URL slugs (e.g., `nepse`, `ipo`, `dividend`, `share`, `bonus`, `right`, `auction`, `profit`, `bank`).

---

### 3. SEBON (sebon.gov.np) — ⭐ HIGH PRIORITY (Regulatory)
| Attribute | Details |
|---|---|
| **Base URL** | `https://www.sebon.gov.np` |
| **Notices** | `https://www.sebon.gov.np/notices` (paginated: `?page=1,2,...20+`) |
| **News** | `https://www.sebon.gov.np/news` (paginated: `?page=1,2,...6+`) |
| **Circulars** | `https://www.sebon.gov.np/circulars` |
| **IPO Pipeline** | `https://www.sebon.gov.np/ipo-pipeline` |
| **IPO Approved** | `https://www.sebon.gov.np/ipo-approved` |
| **Prospectus** | `https://www.sebon.gov.np/prospectus` |
| **Newsletters** | `https://www.sebon.gov.np/news-letters` |
| **RSS Feed** | ❌ None |
| **Public API** | ❌ None |
| **Auth Required** | ❌ No |
| **Scrapable?** | ✅ YES — Server-rendered HTML tables |
| **Language** | Nepali (mostly), some English |
| **Content Types** | Regulatory circulars, IPO approvals, securities rules, policy consultations, SEBON announcements |
| **Reliability** | ★★★★★ — Official regulator, highly authoritative |

**HTML Structure (verified):**
- Notices page: HTML table with rows containing notice title, date (YYYY-MM-DD), and language
- 21+ PDF downloads found per page
- News articles have Nepali URL slugs (e.g., `/news/बीज-पुँजी-सम्बन्धमा।`)
- Pagination: `?page=1` through at least `?page=20`

**Scraping Pattern:**
```javascript
// Notices with pagination
for (let page = 1; page <= 20; page++) {
  const { data } = await axios.get(`https://www.sebon.gov.np/notices?page=${page}`);
  const $ = cheerio.load(data);
  $('table tr').each((i, el) => {
    const title = $(el).find('td').first().text().trim();
    const date = $(el).find('td').eq(1).text().trim();
    const lang = $(el).find('td').eq(2).text().trim();
    const pdfLink = $(el).find('a[href*=".pdf"]').attr('href');
  });
}
```

---

### 4. myrepublica.nagariknetwork.com — ⭐ RSS FEED (Unique!)
| Attribute | Details |
|---|---|
| **Base URL** | `https://myrepublica.nagariknetwork.com` |
| **Business Section** | `https://myrepublica.nagariknetwork.com/category/market` |
| **Economy Section** | `https://myrepublica.nagariknetwork.com/category/economy` |
| **RSS Feed** | ✅ `https://myrepublica.nagariknetwork.com/feeds` — **VALID RSS 2.0** |
| **Auth Required** | ❌ No |
| **Scrapable?** | ✅ RSS feed works perfectly |
| **Language** | English |
| **Content Types** | Business news, economy, gold/silver prices, fiscal policy, budget |
| **Reliability** | ★★★★☆ — New York Times Partner, professional journalism |

**This is the ONLY working RSS feed found among all Nepali news sources.**

**RSS Feed Structure (verified):**
```xml
<rss version="2.0" xmlns:content="...">
  <channel>
    <title>Republica</title>
    <item>
      <title>Gold, silver prices drop sharply in Nepali market</title>
      <link>https://myrepublica.nagariknetwork.com/news/gold-silver-prices-drop-sharply...html</link>
      <description>CDATA HTML with image and text</description>
      <content:encoded>CDATA HTML with full content</content:encoded>
      <pubDate>Fri, 19 Jun 2026 11:38:25 +0545</pubDate>
    </item>
  </channel>
</rss>
```

**Usage:**
```javascript
import Parser from 'rss-parser';
const parser = new Parser();
const feed = await parser.parseURL('https://myrepublica.nagariknetwork.com/feeds');
// Filter for market/finance keywords in titles
const marketNews = feed.items.filter(item =>
  /gold|silver|nepse|share|stock|bank|ipo|market|finance|budget|economy|interest rate/i.test(item.title)
);
```

---

### 5. Kathmandu Post — kathmandupost.com/money
| Attribute | Details |
|---|---|
| **Base URL** | `https://kathmandupost.com` |
| **Money Section** | `https://kathmandupost.com/money` |
| **RSS Feed** | ❌ `/feed` returns HTML page (not RSS XML) |
| **Auth Required** | ❌ No |
| **Scrapable?** | ✅ YES — Server-rendered, clean HTML |
| **Language** | English |
| **Content Types** | NEPSE analysis, business, economy, fintech, trade |
| **Reliability** | ★★★★☆ — High-quality English journalism |

**Verified articles include:**
- "Bearish week wipes Rs50 billion off investor wealth as NEPSE falls 31 points"
- "Promoters step down to sell shares as loophole in lock-in rules fuels concern"
- "Nepal's industrial slowdown deepens as new factory registrations fall"
- "Nepse this week" (weekly market summary)

**Scraping Pattern:**
```javascript
const { data } = await axios.get('https://kathmandupost.com/money');
const $ = cheerio.load(data);
$('a[href*="/money/"]').each((i, el) => {
  const href = $(el).attr('href');
  // URLs like: /money/2026/06/19/article-slug
  const title = $(el).text().trim();
  // Filter for share market keywords
});
```

---

## TIER 2: Feasible With Effort

### 6. Google News RSS — ⭐ RECOMMENDED AGGREGATOR
| Attribute | Details |
|---|---|
| **English RSS** | `https://news.google.com/rss/search?q=nepal+stock+market+NEPSE&hl=en&gl=US&ceid=US:en` |
| **Nepali RSS** | `https://news.google.com/rss/search?q=नेपाल+शेयर+बजार&hl=ne&gl=NP&ceid=NP:ne` |
| **IPO-specific** | `https://news.google.com/rss/search?q=nepal+IPO+share+market&hl=en&gl=US&ceid=US:en` |
| **Auth Required** | ❌ No |
| **Works?** | ✅ Standard Google News RSS (verified format — page_reader couldn't test due to query param handling, but this is a well-documented, globally-used endpoint) |
| **Language** | English or Nepali (configurable) |
| **Content Types** | Aggregated from ALL Nepali and international sources mentioning Nepal stock market |
| **Reliability** | ★★★★★ — Google infrastructure |

**⚠️ IMPORTANT NOTE:** The Google News RSS URL could not be verified by the page_reader tool due to query parameter stripping, but this is a **well-documented, globally-used, and stable endpoint**. It should work with `fetch()`, `axios`, or `rss-parser` in production.

**Usage:**
```javascript
import Parser from 'rss-parser';
const parser = new Parser();
const feed = await parser.parseURL(
  'https://news.google.com/rss/search?q=nepal+stock+market+NEPSE+IPO&hl=en&gl=US&ceid=US:en'
);
// Returns articles from merolagani, sharesansar, kathmandupost, THT, etc.
```

**This is a EXCELLENT catch-all source** — it aggregates news from all the sources above plus ones you haven't thought of. Use as a secondary source to supplement your primary scrapers.

---

### 7. stockmandu.com
| Attribute | Details |
|---|---|
| **Base URL** | `https://stockmandu.com` |
| **News** | `https://stockmandu.com/news` |
| **Blogs** | `https://stockmandu.com/blogs` |
| **RSS Feed** | ❌ None |
| **Public API** | ❌ None |
| **Auth Required** | ❌ No |
| **Scrapable?** | ⚠️ PARTIAL — Vue.js/Inertia.js SPA, content loaded dynamically. The `/news` page only shows 1 article link in static HTML. Full content requires JS rendering (Puppeteer/Playwright). |
| **Language** | English |
| **Content Types** | Market analysis, regulatory analysis (e.g., "Smart Telecom probe: Banking vs Telecom laws collide") |
| **Reliability** | ★★★☆☆ — Smaller site, less frequent updates |

**Recommendation:** Use Puppeteer only if you need their analysis content. Not worth the overhead for a primary source.

---

### 8. bizshala.com
| Attribute | Details |
|---|---|
| **Base URL** | `https://bizshala.com` |
| **Articles** | `https://bizshala.com/article/{numeric_id}` |
| **RSS Feed** | ❌ None |
| **Public API** | ❌ None |
| **Auth Required** | ❌ No |
| **Scrapable?** | ✅ YES — Server-rendered, numeric article IDs |
| **Language** | Nepali |
| **Content Types** | Business analysis, Nepal Rastra Bank policy, market expectations |
| **Reliability** | ★★★☆☆ — Good content, moderate update frequency |

---

### 9. SEBON IPO Pipeline
| Attribute | Details |
|---|---|
| **URL** | `https://www.sebon.gov.np/ipo-pipeline` |
| **IPO Approved** | `https://www.sebon.gov.np/ipo-approved` |
| **Prospectus** | `https://www.sebon.gov.np/prospectus` |
| **Auth Required** | ❌ No |
| **Scrapable?** | ✅ YES |
| **Language** | English |
| **Content Types** | Upcoming IPOs, approved IPOs, prospectus PDFs |
| **Reliability** | ★★★★★ — Official SEBON data |

**This is ESSENTIAL for IPO alert content.** Perfect for auto-posting "New IPO Opening Tomorrow" type posts.

---

## TIER 3: Limited / Restricted / Not Recommended

### 10. nepalstock.com / nepalstock.com.np (NEPSE Official)
| Attribute | Details |
|---|---|
| **URL** | `https://www.nepalstock.com.np` / `https://nepalstock.com` |
| **RSS Feed** | ❌ None |
| **Public API** | ⚠️ Exists but RESTRICTED — `nepalstock.com/api/nots/...` returns "WARNING: UNAUTHORIZED ACCESS" (401). Authorization token changes every 5 minutes. |
| **Auth Required** | ✅ YES for API; No for website |
| **Scrapable?** | ❌ NO — Angular SPA, all content rendered client-side. Would need Puppeteer, and even then the site has limited news content (primarily market data). |
| **Content Types** | Market data (prices, indices, floor sheet), NOT news |
| **Reliability** | ★★★★★ for data, ★☆☆☆☆ for news |

**Workaround:** Use `@rumess/nepse-api` npm package or `nepse-api-unofficial` (see npm section) for market data. For news, use merolagani/sharesansar instead.

**Unofficial API Endpoints (from community):**
- `https://nepalstock.com/api/nots/securityDailyTradeStat/58` (requires rotating auth)
- `https://newweb.nepalstock.com/api` (community-maintained mirror)

---

### 11. cdsc.com.np (CDS and Clearing)
| Attribute | Details |
|---|---|
| **URL** | `https://cdsc.com.np` |
| **News** | `https://cdsc.com.np/Home/news` |
| **IPO Results** | `https://iporesult.cdsc.com.np` (you already scrape this) |
| **MeroShare** | `https://meroshare.cdsc.com.np` |
| **RSS Feed** | ❌ None |
| **Public API** | ❌ None (they have internal APIs for IPO data you already use) |
| **Auth Required** | ⚠️ WAF blocks automated access — `/notices` returns "Request Rejected" |
| **Scrapable?** | ⚠️ DIFFICULT — WAF (Web Application Firewall) blocks simple HTTP requests. `/Home/news` times out. Main page accessible but slow. |
| **Content Types** | IPO-related notices, tender notices, vacancy notices (mostly PDFs at `/news_notice_files/`) |
| **Reliability** | ★★☆☆☆ for news — Mostly tender/vacancy notices, not market news |

**Note:** CDSC is valuable for IPO result data (which Share Sathi already scrapes), but has minimal news content. Their "news" section is mostly internal procurement/vacancy notices, not share market news.

---

### 12. nepalipaisa.com
| Attribute | Details |
|---|---|
| **URL** | `https://nepalipaisa.com` |
| **IPO** | `https://nepalipaisa.com/ipo` |
| **Scrapable?** | ✅ YES |
| **Language** | English |
| **Content Types** | IPO listings with prospectus PDFs, today's share prices |
| **Reliability** | ★★★☆☆ |

---

### 13. nepsealpha.com
| Attribute | Details |
|---|---|
| **URL** | `https://nepsealpha.com` |
| **Scrapable?** | ❌ NO — Cloudflare Turnstile protection blocks all automated access |
| **Content** | Live market data, IPO calendar, news |
| **Reliability** | ★★★★★ for content, ★☆☆☆☆ for accessibility |

---

### 14. nepselightning.com
| Attribute | Details |
|---|---|
| **URL** | `https://nepselightning.com/news` |
| **Scrapable?** | ⚠️ Unclear — No article links found in static HTML (likely JS-rendered) |
| **Content** | Pre-IPO analysis, investment insights |
| **Reliability** | ★★★☆☆ |

---

### Dead / Unreachable Sources
| Source | Status |
|---|---|
| nepalipos.com.np | ❌ Domain does not resolve |
| nepalstockhub.com | ❌ Domain does not resolve |
| thestockhub.com.np | ❌ Domain does not resolve |
| sipabiti.com | Not tested (SEBON gov site used instead) |

---

## Social Media Sources

### 15. Facebook Graph API
| Attribute | Details |
|---|---|
| **Target Pages** | "Nepal Share Market", "FIX IPO & News", "Share Sansar" |
| **Endpoint** | `GET /v25.0/{page-id}/published_posts` |
| **Auth Required** | ✅ YES — Requires `pages_read_user_content` permission + App Review by Meta |
| **Feasibility** | ❌ VERY DIFFICULT — Meta requires App Review for "Page Public Content Access" which is hard to get approved for third-party pages. Even then, you can only read YOUR OWN page's posts, not competitors' pages. |
| **Recommendation** | ❌ DO NOT pursue — Not viable for reading other pages' posts. Post TO Facebook (which Share Sathi already does), don't try to read FROM it. |

**Key pages for reference (manual posting):**
- facebook.com/ShareSansar.com.np (ShareSansar official)
- "Nepal Share Market" page
- "FIX IPO & News" page

### 16. Twitter/X API
| Attribute | Details |
|---|---|
| **Notable Accounts** | `@share_sansar` (ShareSansar), `@nepalshare_` (IPO alerts), `@b360nepal` (Business360 NEPSE updates) |
| **Endpoint** | `GET /2/users/{id}/tweets` |
| **Auth Required** | ✅ YES — Twitter API v2 requires developer account + Bearer token. Free tier: 1,500 tweets/month read. Basic: $100/mo. |
| **Feasibility** | ⚠️ POSSIBLE but expensive for production |
| **Recommendation** | LOW PRIORITY — @share_sansar posts duplicate what's on sharesansar.com. Use only if budget allows. Free tier gets you ~50 tweets/day. |

### 17. YouTube
| Attribute | Details |
|---|---|
| **Notable Channels** | "NEPAL SHARE KHABAR", "share market in nepal", "Trading Talks Nepal", "Ram Hari Nepal" |
| **RSS Feed** | ✅ `https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}` |
| **Auth Required** | ❌ No for public channel RSS |
| **Feasibility** | ✅ RSS works for video title/link notifications |
| **Content** | Daily NEPSE analysis, market commentary (mostly video, not text) |
| **Recommendation** | LOW PRIORITY — Video content doesn't translate well to text-based Facebook posts. Could use for "New video: {title}" link posts. |

---

## Nepali News Outlets (Business Sections)

| Source | Business URL | RSS? | Scrapable? | Language | Market-Relevant Content |
|---|---|---|---|---|---|
| **Kathmandu Post** | `/money` | ❌ | ✅ Clean HTML | English | NEPSE analysis, business, economy |
| **ekantipur** | `/english/news/business/` | ❌ | ⚠️ JS-rendered | English/Nepali | Business news |
| **myrepublica** | `/category/market` | ✅ `/feeds` | ✅ RSS works | English | Business, economy, gold/silver |
| **The Himalayan Times** | `/category/business/` | ❌ | ⚠️ Limited articles | English | General business |
| **onlinekhabar** | `/english/news/business` | ❌ (returns HTML, not RSS) | ✅ | English/Nepali | Business news |

**Recommendation:** myrepublica RSS is the only real RSS feed. Kathmandu Post `/money` is the best for NEPSE-specific English articles. Use Google News RSS as an alternative aggregator.

---

## Existing npm Packages for Nepal Stock Market

| Package | URL | Type | Purpose |
|---|---|---|---|
| `@rumess/nepse-api` | npmjs.com/package/@rumess/nepse-api | Node.js/TypeScript | NEPSE data client (prices, indices, floor sheet) |
| `nepse-api-unofficial` | npmx.dev/package/nepse-api-unofficial | Node.js (Bun) | Auto-scaling NEPSE client with retry logic |
| `nepse-api` (Python) | pypi.org/project/nepse-api | Python | Async NEPSE API wrapper |
| `nepse_scraper` (Python) | github.com/polymorphisma/nepse_scraper | Python | Full NEPSE data scraper |

**Third-Party APIs:**
| Service | URL | Notes |
|---|---|---|
| **ShareBazaar** | `nepsetty.kokomo.workers.dev` | Free, real-time + historical NEPSE data via Cloudflare Workers |
| **Parse.bot (ShareSansar)** | parse.bot marketplace | Paid, 4 endpoints for ShareSansar data |
| **Parse.bot (NEPSE)** | parse.bot marketplace | Paid, 7 endpoints for NEPSE market data |
| **SmartWealthPro MDP** | data.smartwealthpro.com | Official NEPSE-licensed, commercial API |
| **NepseAPI-Unofficial** | github.com/surajrimal07 | REST + WebSocket + MCP, self-hosted |

**Note:** These packages focus on MARKET DATA (prices, indices, floor sheets), NOT news content. For news, you need to scrape the sources above.

---

## Legal Considerations

### Nepal-Specific Laws
1. **Securities Act 2006 (2063 BS)** — Governs securities market. No specific provision against scraping publicly available data.
2. **Individual Privacy Act 2018 (2075 BS)** — Protects personal data. Don't scrape personal investor data.
3. **Individual Privacy Regulation 2020 (2077 BS)** — Data protection rules.
4. **Electronic Transactions Act 2008 (2064 BS)** — Governs cyber activities. Unauthorized access to computer systems is illegal.
5. **Copyright Act** — Don't reproduce full articles. Use headlines + links (fair dealing).

### Scraping Best Practices for Nepal
- ✅ **DO:** Scrape publicly accessible pages with reasonable rate limits (1-2 requests/second)
- ✅ **DO:** Use proper User-Agent headers identifying your bot
- ✅ **DO:** Respect `robots.txt` if present
- ✅ **DO:** Cache results to minimize requests
- ✅ **DO:** Only use headlines/summaries, link back to source for full content
- ❌ **DON'T:** Scrape behind login walls
- ❌ **DON'T:** Reproduce full article text
- ❌ **DON'T:** Use scraped data for commercial resale without permission
- ❌ **DON'T:** Bypass WAF/anti-bot protections (e.g., CDSC, Cloudflare-protected sites)

### Practical Assessment
Nepal has **no specific anti-scraping legislation**. The major financial portals (merolagani, sharesansar, SEBON) serve their data publicly and don't employ anti-scraping measures. The community (GitHub repos, ITSNepal Facebook group) actively shares scraping tools and techniques. Share Sathi's use case (aggregating headlines for Facebook posts with source attribution) falls well within acceptable use.

---

## Recommended Architecture for Share Sathi

### Primary News Sources (scrape every 15-30 min)
```
1. merolagani.com/NewsList.aspx        → Nepali NEPSE news, company announcements
2. merolagani.com/AnnouncementList.aspx → Company AGM/dividend/IPO announcements
3. sharesansar.com (homepage)           → English market analysis, IPO news, company profits
4. sebon.gov.np/notices                 → Regulatory circulars, IPO approvals
5. sebon.gov.np/ipo-pipeline            → Upcoming IPOs (for IPO alert posts)
```

### Secondary Sources (scrape hourly or daily)
```
6. myrepublica.nagariknetwork.com/feeds → RSS feed, English business news
7. kathmandupost.com/money              → English NEPSE analysis articles
8. sebon.gov.np/news                    → SEBON official news
```

### Tertiary/Catch-all Sources
```
9. Google News RSS (English)            → Aggregated from all sources
10. Google News RSS (Nepali)            -> Aggregated Nepali news
```

### Content Filtering Strategy
For Facebook auto-posting, filter by keywords in title/slug:
- **NEPSE-specific:** `nepse`, `index`, `point`, `turnover`, `market`
- **IPO:** `ipo`, `fpo`, `right share`, `allotment`, `public issue`
- **Company:** `dividend`, `bonus`, `agm`, `sgm`, `book close`, `profit`, `q1/q2/q3/q4`
- **Regulatory:** `sebon`, `circular`, `nepal stock exchange`, `regulation`
- **Market movers:** `gold`, `silver`, `interest rate`, `nrb`, `monetary policy`

### Tech Stack Recommendation
```javascript
// Scheduler: node-cron (every 15 min)
// HTTP: axios with retry (axios-retry)
// HTML Parser: cheerio
// RSS Parser: rss-parser
// Cache: node-cache (TTL: 1 hour)
// Facebook Post: facebook-graph-api (already in Share Sathi)
// Dedup: Store seen news IDs in SQLite/JSON
```

---

## Summary Table

| # | Source | Method | Language | News Types | Difficulty | Priority |
|---|---|---|---|---|---|---|
| 1 | merolagani.com | Scrape | NE+EN | Market, Company, General | Easy | ⭐⭐⭐ |
| 2 | sharesansar.com | Scrape | EN | Market, IPO, Analysis, Company | Easy | ⭐⭐⭐ |
| 3 | sebon.gov.np/notices | Scrape | NE | Regulatory, IPO | Easy | ⭐⭐⭐ |
| 4 | sebon.gov.np/ipo-pipeline | Scrape | EN | IPO | Easy | ⭐⭐⭐ |
| 5 | myrepublica/feeds | RSS | EN | Business, Economy | Trivial | ⭐⭐ |
| 6 | kathmandupost.com/money | Scrape | EN | NEPSE Analysis, Business | Easy | ⭐⭐ |
| 7 | Google News RSS | RSS | NE+EN | Aggregated everything | Trivial | ⭐⭐ |
| 8 | bizshala.com | Scrape | NE | Business Analysis | Easy | ⭐ |
| 9 | stockmandu.com | Puppeteer | EN | Analysis | Hard | ⭐ |
| 10 | nepalstock.com.np | API (restricted) | EN | Market data only | Very Hard | ❌ |
| 11 | cdsc.com.np | Blocked by WAF | EN | Tenders only | Impossible | ❌ |
| 12 | Facebook Graph API | API | Mixed | Page posts | Very Hard (approval) | ❌ |
| 13 | nepsealpha.com | Cloudflare block | EN | Market+News | Impossible | ❌ |