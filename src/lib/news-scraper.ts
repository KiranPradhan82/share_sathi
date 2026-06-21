// Nepal Share Market News Scraper
// Sources: merolagani.com, sharesansar.com, SEBON, Google News RSS, myRepublica RSS
// Fetches headlines + summaries from article content or RSS descriptions.

export interface NewsItem {
  id: string;            // Unique ID per source (e.g., "merolagani-127644")
  source: string;        // 'merolagani' | 'sharesansar' | 'sebon' | 'google_news' | 'myrepublica'
  headline: string;      // News headline
  summary: string;       // 2-3 line summary (first 200-300 chars of content)
  category: string;      // 'market' | 'ipo' | 'company' | 'regulatory' | 'general'
  language: string;      // 'ne' | 'en'
  publishedAt: string;   // ISO date string
  fetchedAt: string;     // ISO date string when we fetched it
  url?: string;          // Original article URL (for summary fetching)
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
  if (/[\u0900-\u097F]/.test(text)) return 'ne';
  return 'en';
}

/**
 * Clean HTML to plain text and extract first N chars as summary.
 * Strips all tags, normalises whitespace, removes common noise.
 */
function extractSummaryFromHtml(html: string, maxChars = 300): string {
  // Strip scripts, styles, nav, footer, header, sidebar
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    // Remove common noise text
    .replace(/We'd like to send you notifications[\s\S]*?/gi, '')
    .replace(/Subscribe[\s\S]*?newsletter/gi, '')
    .replace(/Sign up[\s\S]*?newsletter/gi, '')
    .replace(/advertisement[\s\S]*?/gi, '')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Normalise whitespace
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove lines that are too short (likely navigation, labels, etc.)
  // But keep lines that contain Devanagari (Nepali text tends to be meaningful even if short)
  const lines = clean.split(/\.\s+/).filter(line => {
    const trimmed = line.trim();
    if (trimmed.length < 20) return false;
    // Skip known noise patterns
    if (/^(merolagani|sharesansar|subscribe|follow|like|comment|share|print|email)/i.test(trimmed)) return false;
    if (/for the latest|newsletter|notification|click here|download app/i.test(trimmed)) return false;
    return true;
  });

  const meaningful = lines.join('. ').trim();

  if (meaningful.length <= maxChars) return meaningful;
  // Cut at last sentence boundary within limit
  const cut = meaningful.lastIndexOf('. ', maxChars);
  if (cut > 50) return meaningful.substring(0, cut + 1);
  // Fall back to cutting at last space
  const spaceCut = meaningful.lastIndexOf(' ', maxChars);
  return meaningful.substring(0, spaceCut > 0 ? spaceCut : maxChars).trim() + '...';
}

function truncateSummary(text: string, maxChars = 300): string {
  if (!text) return '';
  const clean = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.lastIndexOf('. ', maxChars);
  if (cut > 50) return clean.substring(0, cut + 1);
  const spaceCut = clean.lastIndexOf(' ', maxChars);
  return clean.substring(0, spaceCut > 0 ? spaceCut : maxChars) + '...';
}

// ==================== MERO LAGANI ====================
async function scrapeMerolagani(): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  try {
    const res = await fetch('https://merolagani.com/NewsList.aspx', {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return items;
    const html = await res.text();

    const newsItemRegex = /class="(?:media-news|media-news-lg)[^"]*">[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="media-body[^"]*">([\s\S]*?)<\/div>/gi;

    let match;
    while ((match = newsItemRegex.exec(html)) !== null) {
      const link = match[1] || '';
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      const dateStr = match[3].replace(/<[^>]*>/g, '').trim();

      if (title.length < 10) continue;

      const idMatch = link.match(/newsID=(\d+)/i);
      const newsId = idMatch ? idMatch[1] : `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      let publishedAt = new Date().toISOString();
      try {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) publishedAt = parsed.toISOString();
      } catch { /* use now */ }

      items.push({
        id: extractId('merolagani', newsId),
        source: 'merolagani',
        headline: title,
        summary: '',
        category: classifyCategory(title),
        language: detectLanguage(title),
        publishedAt,
        fetchedAt: new Date().toISOString(),
        url: `https://merolagani.com/NewsDetail.aspx?newsID=${newsId}`,
      });
    }

    if (items.length === 0) {
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
          url: `https://merolagani.com/NewsDetail.aspx?newsID=${newsId}`,
        });
      }
    }
  } catch (e) {
    console.error('Merolagani scrape error:', e);
  }
  return items;
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

    const newsRegex = /href="(\/newsdetail\/([^"<]+))"[^>]*>([^<]{20,})</gi;
    const seen = new Set<string>();

    let match;
    while ((match = newsRegex.exec(html)) !== null) {
      const href = match[1];
      const slug = match[2];
      const title = match[3].trim();

      const dedupeKey = slug.split('-').slice(0, 4).join('-');
      if (seen.has(dedupeKey) || title.length < 20) continue;
      seen.add(dedupeKey);

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
        url: `https://www.sharesansar.com/newsdetail/${slug}`,
      });
    }
  } catch (e) {
    console.error('Sharesansar scrape error:', e);
  }
  return items;
}

// ==================== SEBON NOTICES ====================
async function scrapeSebonNotices(): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  try {
    for (let page = 1; page <= 2; page++) {
      const res = await fetch(`https://www.sebon.gov.np/notices?page=${page}`, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const html = await res.text();

      const rowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi;
      let match;
      while ((match = rowRegex.exec(html)) !== null) {
        const titleCell = match[1].replace(/<[^>]*>/g, '').trim();
        const dateCell = match[2].replace(/<[^>]*>/g, '').trim();

        if (titleCell.length < 10) continue;
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

    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];

      const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) ||
                         itemXml.match(/<title>([^<]+)<\/title>/i);
      const pubDateMatch = itemXml.match(/<pubDate>([^<]+)<\/pubDate>/i);
      const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) ||
                        itemXml.match(/<description>([^<]+)<\/description>/i);
      const linkMatch = itemXml.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>/i) ||
                        itemXml.match(/<link>([^<]+)<\/link>/i);

      if (!titleMatch) continue;

      const title = titleMatch[1].trim();
      if (title.length < 10) continue;

      let publishedAt = new Date().toISOString();
      if (pubDateMatch) {
        const parsed = new Date(pubDateMatch[1]);
        if (!isNaN(parsed.getTime())) publishedAt = parsed.toISOString();
      }

      // Google News descriptions are usually decent snippets
      const description = descMatch ? descMatch[1].replace(/<[^>]*>/g, ' ').trim() : '';
      const articleUrl = linkMatch ? linkMatch[1].trim() : '';

      items.push({
        id: extractId('google_news', `${lang}-${title.substring(0, 50).replace(/\s+/g, '-')}`),
        source: 'google_news',
        headline: title,
        summary: truncateSummary(description),
        category: classifyCategory(title + ' ' + description),
        language: lang,
        publishedAt,
        fetchedAt: new Date().toISOString(),
        url: articleUrl || undefined,
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

      if (!SHARE_KEYWORDS.test(title)) continue;

      let publishedAt = new Date().toISOString();
      if (pubDateMatch) {
        const parsed = new Date(pubDateMatch[1]);
        if (!isNaN(parsed.getTime())) publishedAt = parsed.toISOString();
      }

      // MyRepublica RSS has full article content in content:encoded
      const rawContent = contentMatch ? contentMatch[1] : '';
      const summary = extractSummaryFromHtml(rawContent, 300);

      items.push({
        id: extractId('myrepublica', `${title.substring(0, 50).replace(/\s+/g, '-')}`),
        source: 'myrepublica',
        headline: title,
        summary,
        category: classifyCategory(title + ' ' + summary),
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

// ==================== ARTICLE CONTENT FETCHER (for summary) ====================

/**
 * Fetch article page and extract first 300 chars of meaningful content.
 * Used for sources that don't provide summaries in their listing/RSS.
 */
export async function fetchArticleSummary(url: string, source: string): Promise<string> {
  if (!url) return '';

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return '';
    const html = await res.text();

    // Try to find the main content area first
    let contentBlock = '';

    if (source === 'merolagani') {
      // Merolagani: look for news-content, news-detail, or similar
      const patterns = [
        /class="news-content[^"]*">([\s\S]*?)(?=<div\s+class="[^"]*(?:share|comment|related|sidebar|social)|<\/article>|<footer|<script)/i,
        /class="news-detail[^"]*">([\s\S]*?)(?=<div\s+class="[^"]*(?:share|comment|related|sidebar)|<\/article>|<footer|<script)/i,
        /class="post-content[^"]*">([\s\S]*?)(?=<div\s+class="[^"]*(?:share|comment|related)|<\/article>|<footer)/i,
        /id="news-body[^"]*">([\s\S]*?)(?=<div\s+id="[^"]*(?:share|comment)|<\/article>|<footer)/i,
      ];
      for (const p of patterns) {
        const m = html.match(p);
        if (m && m[1].length > 100) { contentBlock = m[1]; break; }
      }
    } else if (source === 'sharesansar') {
      // Sharesansar uses WordPress — content is usually in entry-content or td-post-content
      const patterns = [
        /class="(entry-content|post-content|td-post-content)[^"]*">([\s\S]*?)(?=<div\s+class="[^"]*(?:share|related|comments|sidebar|navigation)|<footer|<script)/i,
      ];
      for (const p of patterns) {
        const m = html.match(p);
        if (m && (m[2] || m[1]).length > 100) { contentBlock = m[2] || m[1]; break; }
      }
    }

    // If we found a content block, extract summary from it
    if (contentBlock) {
      return extractSummaryFromHtml(contentBlock, 300);
    }

    // Fallback: extract from full page (noisy but better than nothing)
    return extractSummaryFromHtml(html, 300);
  } catch (e) {
    console.error(`Article summary fetch error for ${url}:`, e);
    return '';
  }
}

// ==================== MAIN FETCHER ====================

export async function fetchAllNews(options?: { fetchSummaries?: boolean; maxPerSource?: number }): Promise<{
  items: NewsItem[];
  sourceStats: Record<string, number>;
  errors: string[];
}> {
  const maxPerSource = options?.maxPerSource || 15;
  const errors: string[] = [];

  const [merolaganiItems, sharesansarItems, sebonItems, googleEnItems, googleNeItems, myrepublicaItems] = await Promise.all([
    scrapeMerolagani().catch(e => { errors.push(`merolagani: ${e.message}`); return [] as NewsItem[]; }),
    scrapeSharesansar().catch(e => { errors.push(`sharesansar: ${e.message}`); return [] as NewsItem[]; }),
    scrapeSebonNotices().catch(e => { errors.push(`sebon: ${e.message}`); return [] as NewsItem[]; }),
    fetchGoogleNewsRss('en').catch(e => { errors.push(`google_en: ${e.message}`); return [] as NewsItem[]; }),
    fetchGoogleNewsRss('ne').catch(e => { errors.push(`google_ne: ${e.message}`); return [] as NewsItem[]; }),
    fetchMyRepublicaRss().catch(e => { errors.push(`myrepublica: ${e.message}`); return [] as NewsItem[]; }),
  ]);

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

  // Deduplicate by headline similarity
  const seenHeadlines = new Set<string>();
  const deduped = allItems.filter(item => {
    const key = item.headline.trim().toLowerCase().substring(0, 80);
    if (seenHeadlines.has(key)) return false;
    seenHeadlines.add(key);
    return true;
  });

  // Sort by publishedAt (newest first)
  deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return { items: deduped, sourceStats, errors };
}

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