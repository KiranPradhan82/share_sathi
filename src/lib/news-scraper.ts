// Nepal Share Market News Scraper
// Sources: merolagani.com, sharesansar.com, SEBON, Google News RSS, myRepublica RSS
// Fetches headlines + 2-3 line summaries only. No full articles, no links.

export interface NewsItem {
  id: string;            // Unique ID per source (e.g., "merolagani-127644")
  source: string;        // 'merolagani' | 'sharesansar' | 'sebon' | 'google_news' | 'myrepublica'
  headline: string;      // News headline
  summary: string;       // 2-3 line summary (first 200-300 chars of content)
  category: string;      // 'market' | 'ipo' | 'company' | 'regulatory' | 'general'
  language: string;      // 'ne' | 'en'
  publishedAt: string;   // ISO date string
  fetchedAt: string;     // ISO date string when we fetched it
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const SHARE_KEYWORDS = /नेप्से|nepse|share|stock|शेयर|IPO|FPO|dividend|bonus|AGM|SGM|right share|allotment|बजार|सूचकांक|turnover|gainer|loser|SEBON|सिक्युरिटी|bank|बैंक|insurance|जीवन बिमा|profit|लाभांश|hydro|जलविद्युत|debenture|bond/i;

function extractId(source: string, rawId: string): string {
  return `${source}-${rawId}`.replace(/[^a-zA-Z0-9\-_]/g, '');
}

function classifyCategory(text: string): string {
  const t = text.toLowerCase();
  if (/ipo|fpo|public.?issue| allotment|प्राथमिक/.test(t)) return 'ipo';
  if (/dividend|bonus|लाभांश| AGM|SGM|book.?close|right.?share/.test(t)) return 'company';
  if (/sebon|सिक्युरिटी बोर्ड|regulation|circular|नियमन/.test(t)) return 'regulatory';
  if (/nepse|सूचकांक|index|turnover|gainer|loser|market|बजार/.test(t)) return 'market';
  return 'general';
}

function detectLanguage(text: string): 'ne' | 'en' {
  // If text contains Devanagari characters, it's Nepali
  if (/[\u0900-\u097F]/.test(text)) return 'ne';
  return 'en';
}

function truncateSummary(text: string, maxChars = 280): string {
  if (!text) return '';
  // Strip HTML tags
  const clean = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  // Find last space before maxChars to avoid cutting words
  const cut = clean.lastIndexOf(' ', maxChars);
  return clean.substring(0, cut > 0 ? cut : maxChars) + '...';
}

// ==================== MERO LAGANI ====================
async function scrapeMerolagani(): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  try {
    // Fetch Nepali news
    const res = await fetch('https://merolagani.com/NewsList.aspx', {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return items;
    const html = await res.text();

    // Parse with regex (no cheerio dependency needed)
    // Pattern: news items have class media-news or media-news-lg
    // Title in <a> tags inside elements with media-title class
    // Date in media-body area
    const newsItemRegex = /class="(?:media-news|media-news-lg)[^"]*">[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="media-body[^"]*">([\s\S]*?)<\/div>/gi;

    let match;
    while ((match = newsItemRegex.exec(html)) !== null) {
      const link = match[1] || '';
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      const dateStr = match[3].replace(/<[^>]*>/g, '').trim();

      if (title.length < 10) continue;

      // Extract news ID from link
      const idMatch = link.match(/newsID=(\d+)/i);
      const newsId = idMatch ? idMatch[1] : `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      // Parse date (format: "Jun 19, 2026 11:25 AM")
      let publishedAt = new Date().toISOString();
      try {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) publishedAt = parsed.toISOString();
      } catch { /* use now */ }

      items.push({
        id: extractId('merolagani', newsId),
        source: 'merolagani',
        headline: title,
        summary: '', // Will be fetched from detail page if needed
        category: classifyCategory(title),
        language: detectLanguage(title),
        publishedAt,
        fetchedAt: new Date().toISOString(),
      });
    }

    // If regex didn't find items, try a simpler approach
    if (items.length === 0) {
      // Fallback: find all links to NewsDetail
      const linkRegex = /href="(\/NewsDetail\.aspx\?newsID=(\d+))"[^>]*>([^<]+)</gi;
      while ((match = linkRegex.exec(html)) !== null) {
        const title = match[3].trim();
        const newsId = match[2];
        if (title.length < 10) continue;
        items.push({
          id: extractId('merolagani', newsId),
          source: 'merolagani',
          headline: title,
          summary: '',
          category: classifyCategory(title),
          language: detectLanguage(title),
          publishedAt: new Date().toISOString(),
          fetchedAt: new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.error('Merolagani scrape error:', e);
  }
  return items;
}

// Fetch summary from individual merolagani news article
async function fetchMerolaganiSummary(newsId: string): Promise<string> {
  try {
    const res = await fetch(`https://merolagani.com/NewsDetail.aspx?newsID=${newsId}`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return '';
    const html = await res.text();
    // Find the news body — usually in a div with class news-content or similar
    const bodyMatch = html.match(/class="news-content[^"]*">([\s\S]*?)(?=<div|<footer|<script)/i);
    if (bodyMatch) {
      return truncateSummary(bodyMatch[1]);
    }
    // Fallback: find largest text block
    const textBlocks = html.replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .match(/.{100,500}/g);
    if (textBlocks && textBlocks.length > 0) {
      // Return the longest meaningful block
      const sorted = textBlocks.sort((a, b) => b.length - a.length);
      return truncateSummary(sorted[0]);
    }
  } catch (e) {
    console.error(`Merolagani summary fetch error for ${newsId}:`, e);
  }
  return '';
}

// ==================== SHARE SANSAR ====================
async function scrapeSharesansar(): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  try {
    const res = await fetch('https://www.sharesansar.com', {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return items;
    const html = await res.text();

    // Sharesansar news links contain /newsdetail/ in href
    const newsRegex = /href="(\/newsdetail\/([^"<]+))"[^>]*>([^<]{20,})</gi;
    const seen = new Set<string>();

    let match;
    while ((match = newsRegex.exec(html)) !== null) {
      const href = match[1];
      const slug = match[2];
      const title = match[3].trim();

      // Deduplicate by slug prefix
      const dedupeKey = slug.split('-').slice(0, 4).join('-');
      if (seen.has(dedupeKey) || title.length < 20) continue;
      seen.add(dedupeKey);

      // Extract date from slug (usually ends with YYYYMMDD)
      const dateMatch = slug.match(/(\d{4})(\d{2})(\d{2})$/);
      let publishedAt = new Date().toISOString();
      if (dateMatch) {
        const d = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`);
        if (!isNaN(d.getTime())) publishedAt = d.toISOString();
      }

      items.push({
        id: extractId('sharesansar', slug.substring(0, 50)),
        source: 'sharesansar',
        headline: title,
        summary: '',
        category: classifyCategory(title),
        language: detectLanguage(title),
        publishedAt,
        fetchedAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error('Sharesansar scrape error:', e);
  }
  return items;
}

// Fetch summary from sharesansar article
async function fetchSharesansarSummary(slug: string): Promise<string> {
  try {
    const res = await fetch(`https://www.sharesansar.com/newsdetail/${slug}`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return '';
    const html = await res.text();
    // Sharesansar uses WordPress — content is usually in entry-content or post-content
    const bodyMatch = html.match(/class="(entry-content|post-content|td-post-content)[^"]*">([\s\S]*?)(?=<div\s+class="(share|related|comments|sidebar)|<footer|<script)/i);
    if (bodyMatch) {
      return truncateSummary(bodyMatch[2] || bodyMatch[0]);
    }
    // Fallback
    const textBlocks = html.replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .match(/.{100,500}/g);
    if (textBlocks && textBlocks.length > 0) {
      return truncateSummary(textBlocks.sort((a, b) => b.length - a.length)[0]);
    }
  } catch (e) {
    console.error(`Sharesansar summary fetch error for ${slug}:`, e);
  }
  return '';
}

// ==================== SEBON NOTICES ====================
async function scrapeSebonNotices(): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  try {
    // Fetch first 2 pages of notices
    for (let page = 1; page <= 2; page++) {
      const res = await fetch(`https://www.sebon.gov.np/notices?page=${page}`, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const html = await res.text();

      // SEBON notices are in table rows — extract title and date
      const rowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi;
      let match;
      while ((match = rowRegex.exec(html)) !== null) {
        const titleCell = match[1].replace(/<[^>]*>/g, '').trim();
        const dateCell = match[2].replace(/<[^>]*>/g, '').trim();

        if (titleCell.length < 10) continue;
        // Skip header row
        if (/notice|title|मिति|अवस्था/i.test(titleCell) && titleCell.length < 30) continue;

        let publishedAt = new Date().toISOString();
        if (dateCell && dateCell.length >= 8) {
          const parsed = new Date(dateCell);
          if (!isNaN(parsed.getTime())) publishedAt = parsed.toISOString();
        }

        items.push({
          id: extractId('sebon', `${titleCell.substring(0, 40).replace(/\s+/g, '-')}-${page}-${items.length}`),
          source: 'sebon',
          headline: titleCell,
          summary: 'SEBON notice — see details on SEBON website.',
          category: classifyCategory(titleCell),
          language: detectLanguage(titleCell),
          publishedAt,
          fetchedAt: new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.error('SEBON scrape error:', e);
  }
  return items;
}

// ==================== GOOGLE NEWS RSS ====================
async function fetchGoogleNewsRss(lang: 'en' | 'ne'): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  try {
    const query = lang === 'ne'
      ? 'नेपाल+शेयर+बजार+आईपीओ+नेप्से'
      : 'nepal+stock+market+NEPSE+IPO+share';
    const url = `https://news.google.com/rss/search?q=${query}&hl=${lang}&gl=NP&ceid=NP:${lang}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return items;

    const xml = await res.text();

    // Parse RSS XML with regex (no xml2js dependency needed)
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];

      const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) ||
                         itemXml.match(/<title>([^<]+)<\/title>/i);
      const pubDateMatch = itemXml.match(/<pubDate>([^<]+)<\/pubDate>/i);
      const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) ||
                        itemXml.match(/<description>([^<]+)<\/description>/i);

      if (!titleMatch) continue;

      const title = titleMatch[1].trim();
      if (title.length < 10) continue;

      let publishedAt = new Date().toISOString();
      if (pubDateMatch) {
        const parsed = new Date(pubDateMatch[1]);
        if (!isNaN(parsed.getTime())) publishedAt = parsed.toISOString();
      }

      const description = descMatch ? descMatch[1].replace(/<[^>]*>/g, ' ').trim() : '';

      items.push({
        id: extractId('google_news', `${lang}-${title.substring(0, 50).replace(/\s+/g, '-')}`),
        source: 'google_news',
        headline: title,
        summary: truncateSummary(description),
        category: classifyCategory(title + ' ' + description),
        language: lang,
        publishedAt,
        fetchedAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error(`Google News RSS (${lang}) error:`, e);
  }
  return items;
}

// ==================== MYREPUBLICA RSS ====================
async function fetchMyRepublicaRss(): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  try {
    const res = await fetch('https://myrepublica.nagariknetwork.com/feeds', {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return items;

    const xml = await res.text();
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];

      const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) ||
                         itemXml.match(/<title>([^<]+)<\/title>/i);
      const pubDateMatch = itemXml.match(/<pubDate>([^<]+)<\/pubDate>/i);
      const contentMatch = itemXml.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/i) ||
                           itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i);

      if (!titleMatch) continue;

      const title = titleMatch[1].trim();
      if (title.length < 10) continue;

      // Filter for market/finance relevance
      if (!SHARE_KEYWORDS.test(title)) continue;

      let publishedAt = new Date().toISOString();
      if (pubDateMatch) {
        const parsed = new Date(pubDateMatch[1]);
        if (!isNaN(parsed.getTime())) publishedAt = parsed.toISOString();
      }

      const content = contentMatch ? contentMatch[1].replace(/<[^>]*>/g, ' ').trim() : '';

      items.push({
        id: extractId('myrepublica', `${title.substring(0, 50).replace(/\s+/g, '-')}`),
        source: 'myrepublica',
        headline: title,
        summary: truncateSummary(content),
        category: classifyCategory(title + ' ' + content),
        language: 'en',
        publishedAt,
        fetchedAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error('MyRepublica RSS error:', e);
  }
  return items;
}

// ==================== MAIN FETCHER ====================

/**
 * Fetch news from all sources in parallel.
 * Returns deduplicated items sorted by publishedAt (newest first).
 * Optionally fetches summaries for top items (adds ~2-3s per item).
 */
export async function fetchAllNews(options?: { fetchSummaries?: boolean; maxPerSource?: number }): Promise<{
  items: NewsItem[];
  sourceStats: Record<string, number>;
  errors: string[];
}> {
  const maxPerSource = options?.maxPerSource || 15;
  const fetchSummaries = options?.fetchSummaries || false;
  const errors: string[] = [];

  // Fetch all sources in parallel
  const [merolaganiItems, sharesansarItems, sebonItems, googleEnItems, googleNeItems, myrepublicaItems] = await Promise.all([
    scrapeMerolagani().catch(e => { errors.push(`merolagani: ${e.message}`); return [] as NewsItem[]; }),
    scrapeSharesansar().catch(e => { errors.push(`sharesansar: ${e.message}`); return [] as NewsItem[]; }),
    scrapeSebonNotices().catch(e => { errors.push(`sebon: ${e.message}`); return [] as NewsItem[]; }),
    fetchGoogleNewsRss('en').catch(e => { errors.push(`google_en: ${e.message}`); return [] as NewsItem[]; }),
    fetchGoogleNewsRss('ne').catch(e => { errors.push(`google_ne: ${e.message}`); return [] as NewsItem[]; }),
    fetchMyRepublicaRss().catch(e => { errors.push(`myrepublica: ${e.message}`); return [] as NewsItem[]; }),
  ]);

  // Limit per source and collect stats
  const sourceStats: Record<string, number> = {};
  const allItems: NewsItem[] = [];

  for (const sourceItems of [merolaganiItems, sharesansarItems, sebonItems, googleEnItems, googleNeItems, myrepublicaItems]) {
    const limited = sourceItems.slice(0, maxPerSource);
    for (const item of limited) {
      const sourceKey = item.source;
      sourceStats[sourceKey] = (sourceStats[sourceKey] || 0) + 1;
    }
    allItems.push(...limited);
  }

  // Deduplicate by headline similarity (exact match after trimming)
  const seenHeadlines = new Set<string>();
  const deduped = allItems.filter(item => {
    const key = item.headline.trim().toLowerCase().substring(0, 80);
    if (seenHeadlines.has(key)) return false;
    seenHeadlines.add(key);
    return true;
  });

  // Sort by publishedAt (newest first)
  deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  // Fetch summaries for items that don't have one (top 10 only to save time)
  if (fetchSummaries) {
    const needsSummary = deduped.filter(item => !item.summary).slice(0, 10);
    await Promise.all(needsSummary.map(async (item) => {
      try {
        if (item.source === 'merolagani') {
          const idMatch = item.id.match(/merolagani-(\d+)/);
          if (idMatch) {
            item.summary = await fetchMerolaganiSummary(idMatch[1]);
          }
        } else if (item.source === 'sharesansar') {
          const slugMatch = item.id.match(/sharesansar-(.+)/);
          if (slugMatch) {
            item.summary = await fetchSharesansarSummary(slugMatch[1]);
          }
        }
      } catch { /* skip summary for this item */ }
    }));
  }

  return { items: deduped, sourceStats, errors };
}

/**
 * Fetch news from a single source.
 */
export async function fetchNewsFromSource(source: string): Promise<NewsItem[]> {
  switch (source) {
    case 'merolagani': return scrapeMerolagani();
    case 'sharesansar': return scrapeSharesansar();
    case 'sebon': return scrapeSebonNotices();
    case 'google_news_en': return fetchGoogleNewsRss('en');
    case 'google_news_ne': return fetchGoogleNewsRss('ne');
    case 'myrepublica': return fetchMyRepublicaRss();
    default: return [];
  }
}