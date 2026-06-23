// Upcoming IPO Scraper — scrapes sharesansar.com/upcoming-issue DataTable API
// Also scrapes SEBON IPO pipeline page for PDF links

export interface UpcomingIpoItem {
  id: number;
  symbol: string;
  companyName: string;
  sector: string;
  units: number;
  totalAmount: number;
  applicationDate: string;
  sebonDate: string;
  issueManager: string;
  shareType: string;
}

export interface SebonPipelineEntry {
  title: string;
  date: string;
  englishUrl: string;
  nepaliUrl: string;
}

/**
 * Scrape upcoming IPO list from ShareSansar DataTable API.
 * Requires session cookie + XSRF token — we first GET the page, then call the API.
 */
export async function scrapeShareSansarUpcoming(): Promise<UpcomingIpoItem[]> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
  };

  // Step 1: GET the page to obtain session cookies
  const pageRes = await fetch('https://www.sharesansar.com/upcoming-issue', {
    headers,
    signal: AbortSignal.timeout(20000),
  });
  if (!pageRes.ok) {
    throw new Error(`ShareSansar page returned HTTP ${pageRes.status}`);
  }

  // Extract cookies and XSRF token from response
  const setCookies = pageRes.headers.getSetCookie?.() || [];
  const cookieStr = setCookies.map(c => c.split(';')[0]).join('; ');

  let xsrfToken = '';
  for (const c of setCookies) {
    const m = c.match(/^XSRF-TOKEN=([^;]+)/);
    if (m) {
      xsrfToken = decodeURIComponent(m[1]);
      break;
    }
  }

  // Step 2: Call the DataTable API with session cookie + XSRF token
  const apiHeaders: Record<string, string> = {
    ...headers,
    'X-Requested-With': 'XMLHttpRequest',
    'Cookie': cookieStr,
    'Referer': 'https://www.sharesansar.com/upcoming-issue',
  };
  if (xsrfToken) {
    apiHeaders['X-XSRF-TOKEN'] = xsrfToken;
  }

  const url = 'https://www.sharesansar.com/upcoming-issue?type=1&draw=1&start=0&length=100&search%5Bvalue%5D=&search%5Bregex%5D=false';
  const apiRes = await fetch(url, {
    headers: apiHeaders,
    signal: AbortSignal.timeout(20000),
  });

  if (!apiRes.ok) {
    throw new Error(`ShareSansar API returned HTTP ${apiRes.status}`);
  }

  const json = await apiRes.json() as {
    draw: number;
    recordsTotal: number;
    recordsFiltered: number;
    data: Array<Record<string, unknown>>;
  };

  if (!Array.isArray(json.data)) {
    return [];
  }

  return json.data.map((item) => {
    const company = item.company as Record<string, unknown> | undefined;
    const companyNested = company?.company as Record<string, unknown> | undefined;

    const symbolRaw = String(company?.symbol || item.symbol || '');
    const symbolMatch = symbolRaw.match(/>([^<]+)<\/a>/);
    const symbol = symbolMatch ? symbolMatch[1].trim() : symbolRaw.replace(/<[^>]*>/g, '').trim();

    const nameRaw = String(company?.companyname || item.companyname || '');
    const nameMatch = nameRaw.match(/>([^<]+)<\/a>/);
    const companyName = nameMatch ? nameMatch[1].trim() : nameRaw.replace(/<[^>]*>/g, '').trim();

    const sectorName = companyNested?.sectorname || company?.sectorname || '';
    const sector = String(item.sector || sectorName || '');

    return {
      id: Number(item.companyid || item.id || 0),
      symbol,
      companyName,
      sector,
      units: parseFloat(String(item.total_units || 0)) || 0,
      totalAmount: parseFloat(String(item.amount || 0)) || 0,
      applicationDate: String(item.application_date || '').trim(),
      sebonDate: String(item.date_sebon || '').trim(),
      issueManager: String(item.issue_manager || '').trim(),
      shareType: String(item.displayable_share_type || 'IPO'),
    };
  });
}

/**
 * Scrape SEBON IPO pipeline page — extracts downloadable PDF links
 */
export async function scrapeSebonPipeline(): Promise<SebonPipelineEntry[]> {
  const res = await fetch('https://www.sebon.gov.np/ipo-pipeline', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    throw new Error(`SEBON returned HTTP ${res.status}`);
  }

  const html = await res.text();
  const entries: SebonPipelineEntry[] = [];

  const trRegex = /<tr>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;

  let match;
  while ((match = trRegex.exec(html)) !== null) {
    const titleRaw = match[1].replace(/<[^>]*>/g, '').trim();
    const dateRaw = match[2].replace(/<[^>]*>/g, '').trim();

    const engLinkMatch = match[3].match(/href="([^"]+)"/i);
    const engUrl = engLinkMatch ? engLinkMatch[1] : '';

    const nepLinkMatch = match[4].match(/href="([^"]+)"/i);
    const nepUrl = nepLinkMatch ? nepLinkMatch[1] : '';

    if (titleRaw.toLowerCase().includes('ipo') && engUrl) {
      entries.push({
        title: titleRaw,
        date: dateRaw,
        englishUrl: engUrl,
        nepaliUrl: nepUrl,
      });
    }
  }

  return entries;
}