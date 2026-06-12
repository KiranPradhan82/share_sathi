import ZAI from 'z-ai-web-dev-sdk';

export interface NepseData {
  tradingDate: string;
  nepseIndex: number;
  change: number;
  changePercentage: number;
  turnover: number;
  volume: number;
  trades: number;
  gainers: number;
  losers: number;
  unchanged: number;
  rawData: string;
  // Extended fields from scraped data
  sensitiveIndex?: number;
  sensitiveIndexChange?: number;
  floatIndex?: number;
  floatIndexChange?: number;
  sensitiveFloatIndex?: number;
  sensitiveFloatIndexChange?: number;
  marketCap?: number;
  floatMarketCap?: number;
  scripsTraded?: number;
  transactions?: number;
  source?: string;
}

function generateMockData(date: string): NepseData {
  const baseIndex = 2280;
  const indexVariation = (Math.random() - 0.45) * 40;
  const nepseIndex = parseFloat((baseIndex + indexVariation).toFixed(2));
  const change = parseFloat((indexVariation * (0.5 + Math.random())).toFixed(2));
  const changePercentage = parseFloat(((change / nepseIndex) * 100).toFixed(2));
  const turnover = parseFloat((2.5 + Math.random() * 5.5).toFixed(2));
  const volume = parseFloat((15000000 + Math.random() * 25000000).toFixed(0));
  const trades = Math.floor(40000 + Math.random() * 30000);
  const totalListed = 220;
  const gainers = Math.floor(totalListed * (0.2 + Math.random() * 0.35));
  const losers = Math.floor(totalListed * (0.2 + Math.random() * 0.3));
  const unchanged = totalListed - gainers - losers;

  const rawData = JSON.stringify({
    source: 'mock',
    generatedAt: new Date().toISOString(),
    index: nepseIndex,
    turnover,
    volume,
  });

  return {
    tradingDate: date,
    nepseIndex,
    change,
    changePercentage,
    turnover: turnover * 100000000,
    volume,
    trades,
    gainers,
    losers,
    unchanged,
    rawData,
    source: 'mock',
  };
}

function parseNumber(text: string): number {
  if (!text) return 0;
  // Remove commas, spaces, Rs: prefix, NPR prefix
  const cleaned = text.replace(/[,Rs:\sNPR]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseNepseHtml(html: string): NepseData | null {
  // Convert HTML to plain text for easier regex matching
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

  try {
    // === Extract NEPSE Index ===
    // Pattern: "NEPSE Index Jun 12 | 3:00 PM Market Closed Jun 12 | 3:00 PM 2,724.03 -4.00 -0.14%"
    // Or: "NEPSE Index 2,724.03 -4.00 -0.14"
    let nepseIndex = 0;
    let change = 0;
    let changePercentage = 0;

    const indexPatterns = [
      // Pattern: "NEPSE Index Jun 12 | 3:00 PM Market Closed Jun 12 | 3:00 PM 2,724.03 -4.00 -0.14%"
      /NEPSE\s*Index.*?(\d{1,3}(?:,\d{3})+\.\d{2})\s+(-?\d+\.\d{2})\s+(-?\d+\.\d+)%/i,
      // Fallback simpler pattern
      /NEPSE\s*Index[:\s]*(\d[\d,.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)%/i,
    ];

    for (const pattern of indexPatterns) {
      const match = text.match(pattern);
      if (match) {
        nepseIndex = parseNumber(match[1]);
        change = parseNumber(match[2]);
        changePercentage = parseNumber(match[3].replace('%', ''));
        break;
      }
    }

    if (nepseIndex === 0) return null; // Can't find index, data is invalid

    // === Extract Turnover ===
    // Pattern: "Total Turnover Rs: | 4,341,094,764.19"
    let turnover = 0;
    const turnoverPatterns = [
      /Total\s*Turnover\s*Rs[:\s|]*(\d[\d,.]+)/i,
      /Total\s*Turnover[:\s]*Rs[:\s]*(\d[\d,.]+)/i,
    ];
    for (const pattern of turnoverPatterns) {
      const match = text.match(pattern);
      if (match) {
        turnover = parseNumber(match[1]);
        break;
      }
    }

    // === Extract Total Traded Shares ===
    // Pattern: "Total Traded Shares | 9,856,525"
    let volume = 0;
    const volumePatterns = [
      /Total\s*Traded\s*Shares\s*[|:]*\s*(\d[\d,.]+)/i,
    ];
    for (const pattern of volumePatterns) {
      const match = text.match(pattern);
      if (match) {
        volume = parseNumber(match[1]);
        break;
      }
    }

    // === Extract Transactions ===
    // Pattern: "Total Transactions 54,177"
    let transactions = 0;
    const transMatch = text.match(/Total\s*Transactions?\s*(\d[\d,.]*)/i);
    if (transMatch) {
      transactions = parseNumber(transMatch[1]);
    }

    // === Extract Advanced/Declined/Unchanged ===
    let gainers = 0;
    let losers = 0;
    let unchanged = 0;

    const advMatch = text.match(/Advanced[:\s]*(\d+)/i);
    if (advMatch) gainers = parseInt(advMatch[1], 10);

    const decMatch = text.match(/Declined[:\s]*(\d+)/i);
    if (decMatch) losers = parseInt(decMatch[1], 10);

    const unchMatch = text.match(/Unchanged[:\s]*(\d+)/i);
    if (unchMatch) unchanged = parseInt(unchMatch[1], 10);

    // === Extract Trading Date ===
    // Pattern: "NEPSE Index Jun 12 | 3:00 PM" -> today's date
    const today = new Date().toISOString().split('T')[0];

    // === Extract Sub-indices ===
    let sensitiveIndex = 0;
    let sensitiveIndexChange = 0;
    let floatIndex = 0;
    let floatIndexChange = 0;
    let sensitiveFloatIndex = 0;
    let sensitiveFloatIndexChange = 0;

    const sensMatch = text.match(/Sensitive\s*Index\s+(\d[\d,.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/i);
    if (sensMatch) {
      sensitiveIndex = parseNumber(sensMatch[1]);
      sensitiveIndexChange = parseNumber(sensMatch[2]);
    }

    const floatMatch = text.match(/Float\s*Index\s+(\d[\d,.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/i);
    if (floatMatch) {
      floatIndex = parseNumber(floatMatch[1]);
      floatIndexChange = parseNumber(floatMatch[2]);
    }

    const sfMatch = text.match(/Sensitive\s*Float\s*Index\s+(\d[\d,.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/i);
    if (sfMatch) {
      sensitiveFloatIndex = parseNumber(sfMatch[1]);
      sensitiveFloatIndexChange = parseNumber(sfMatch[2]);
    }

    // === Extract Market Cap ===
    let marketCap = 0;
    let floatMarketCap = 0;

    const mcapMatch = text.match(/Total\s*Market\s*Capitalization\s*Rs[:\s]*(\d[\d,.]+)/i);
    if (mcapMatch) {
      marketCap = parseNumber(mcapMatch[1]);
    }

    const fmcapMatch = text.match(/Total\s*Float\s*Market\s*Capitalization\s*Rs[:\s]*(\d[\d,.]+)/i);
    if (fmcapMatch) {
      floatMarketCap = parseNumber(fmcapMatch[1]);
    }

    // === Extract Scrips Traded ===
    let scripsTraded = 0;
    const scripsMatch = text.match(/Total\s*Scrips\s*Traded\s*(\d[\d,.]*)/i);
    if (scripsMatch) {
      scripsTraded = parseNumber(scripsMatch[1]);
    }

    // Build rawData
    const rawData = JSON.stringify({
      source: 'nepse-website',
      scrapedAt: new Date().toISOString(),
      nepseIndex,
      change,
      changePercentage,
      turnover,
      volume,
      transactions,
      scripsTraded,
      gainers,
      losers,
      unchanged,
      sensitiveIndex,
      sensitiveIndexChange,
      floatIndex,
      floatIndexChange,
      sensitiveFloatIndex,
      sensitiveFloatIndexChange,
      marketCap,
      floatMarketCap,
    });

    return {
      tradingDate: today,
      nepseIndex,
      change,
      changePercentage,
      turnover,
      volume,
      trades: transactions || 0,
      gainers,
      losers,
      unchanged,
      rawData,
      sensitiveIndex: sensitiveIndex || undefined,
      sensitiveIndexChange: sensitiveIndexChange || undefined,
      floatIndex: floatIndex || undefined,
      floatIndexChange: floatIndexChange || undefined,
      sensitiveFloatIndex: sensitiveFloatIndex || undefined,
      sensitiveFloatIndexChange: sensitiveFloatIndexChange || undefined,
      marketCap: marketCap || undefined,
      floatMarketCap: floatMarketCap || undefined,
      scripsTraded: scripsTraded || undefined,
      transactions: transactions || undefined,
      source: 'nepse-website',
    };
  } catch (e) {
    console.error('Error parsing NEPSE HTML:', e);
    return null;
  }
}

/**
 * Scrape NEPSE data from the official website using web-reader SDK.
 * This is the primary data source since the NEPSE API is blocked from server-side.
 */
async function fetchFromNepseWebsite(): Promise<NepseData | null> {
  try {
    const zai = await ZAI.create();
    const result = await zai.functions.invoke('page_reader', {
      url: 'https://www.nepalstock.com/main/todays-price',
    });

    const html = result?.data?.html || '';
    if (!html || html.length < 1000) {
      console.error('NEPSE website returned too little data');
      return null;
    }

    const parsed = parseNepseHtml(html);
    if (parsed && parsed.nepseIndex > 0) {
      console.log(`Successfully scraped NEPSE data from website. Index: ${parsed.nepseIndex}`);
      return parsed;
    }

    console.error('Failed to parse NEPSE data from scraped HTML');
    return null;
  } catch (e) {
    console.error('Error fetching NEPSE website:', e);
    return null;
  }
}

/**
 * Try the NEPSE API directly (may be blocked by WAF/Cloudflare).
 */
async function fetchFromNepseApi(date: string): Promise<NepseData | null> {
  try {
    const response = await fetch('https://www.nepalstock.com/api/nots/market-summary', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'application/json',
        Referer: 'https://www.nepalstock.com/',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const json = await response.json();
    if (!json || typeof json !== 'object') return null;

    const data = json as Record<string, unknown>;
    const nepseIndex = Number(data.index || data.nepseIndex || 0);
    if (nepseIndex === 0) return null;

    return {
      tradingDate: date,
      nepseIndex,
      change: Number(data.change || data.indexChange || 0),
      changePercentage: Number(data.percentChange || data.changePercent || 0),
      turnover: Number(data.totalTurnover || data.turnover || 0),
      volume: Number(data.totalShareTraded || data.shareTraded || 0),
      trades: Number(data.totalTrades || data.noOfTransactions || 0),
      gainers: Number(data.gainers || 0),
      losers: Number(data.losers || 0),
      unchanged: Number(data.unchanged || 0),
      rawData: JSON.stringify({ source: 'nepse-api', ...data }),
      source: 'nepse-api',
    };
  } catch {
    return null;
  }
}

export async function fetchNepseData(date?: string): Promise<NepseData> {
  const targetDate = date || new Date().toISOString().split('T')[0];

  // Method 1: Try the direct API first (fastest if it works)
  const apiResult = await fetchFromNepseApi(targetDate);
  if (apiResult) {
    console.log('NEPSE data fetched via API');
    return apiResult;
  }

  // Method 2: Scrape from NEPSE website using web-reader SDK
  const webResult = await fetchFromNepseWebsite();
  if (webResult) {
    console.log('NEPSE data fetched via website scraping');
    return webResult;
  }

  // Method 3: Fallback to mock data (last resort)
  console.warn('WARNING: Both NEPSE API and website scraping failed. Using MOCK data!');
  return generateMockData(targetDate);
}