// NEPSE Market Data Fetcher
// Primary source: NEPSE Official (nepalstock.com) — scraped directly
// Secondary source: YONEPSE (GitHub Pages, free, no auth, no WAF)
// Tertiary source: NEPSE direct API fallback (may be blocked by WAF)
// NO mock/fallback data — throws clear error if all sources fail

import { scrapeNepseOfficialFull } from './nepse-scraper';

const YONEPSE_BASE = 'https://shubhamnpk.github.io/yonepse';

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
  sensitiveIndex?: number;
  sensitiveIndexChange?: number;
  sensitiveIndexChangePercent?: number;
  floatIndex?: number;
  floatIndexChange?: number;
  floatIndexChangePercent?: number;
  sensitiveFloatIndex?: number;
  sensitiveFloatIndexChange?: number;
  sensitiveFloatIndexChangePercent?: number;
  marketCap?: number;
  floatMarketCap?: number;
  scripsTraded?: number;
  transactions?: number;
  source?: string;
}

export interface TopStock {
  symbol: string;
  name: string;
  change: number;
  changePercent: number;
}

// Re-exported StockData type (used by client-image-generator)
export interface StockData {
  symbol: string;
  name: string;
  closePrice: number;
  change: number;
  changePercent: number;
  previousClose: number;
}

/**
 * Fetch from YONEPSE static JSON API (GitHub Pages).
 * Free, no auth, no WAF, works from any server.
 * Updates every 30 min during market hours (11 AM - 3 PM NPT, Sun-Thu).
 * Returns the most reliable free NEPSE data available.
 */
async function fetchFromYonepse(date: string): Promise<NepseData | null> {
  try {
    const [summaryRes, indicesRes, topStocksRes] = await Promise.all([
      fetch(`${YONEPSE_BASE}/data/market/summary.json`, { signal: AbortSignal.timeout(15000) }),
      fetch(`${YONEPSE_BASE}/data/market/indices.json`, { signal: AbortSignal.timeout(15000) }),
      fetch(`${YONEPSE_BASE}/data/market/top_stocks.json`, { signal: AbortSignal.timeout(15000) }),
    ]);

    if (!summaryRes.ok || !indicesRes.ok) {
      console.error('YONEPSE API returned non-OK status');
      return null;
    }

    const summary: Array<{ detail: string; value: number }> = await summaryRes.json();
    const indices: Array<Record<string, unknown>> = await indicesRes.json();
    let topStocks: Record<string, Array<Record<string, unknown>>> = {};
    if (topStocksRes.ok) {
      topStocks = await topStocksRes.json();
    }

    // Parse summary
    const getSummaryValue = (label: string): number => {
      const item = summary.find(s => s.detail.includes(label));
      return item ? item.value : 0;
    };

    const turnover = getSummaryValue('Total Turnover');
    const volume = getSummaryValue('Total Traded Shares');
    const transactions = getSummaryValue('Total Transactions');
    const scripsTraded = getSummaryValue('Total Scrips Traded');
    const marketCap = getSummaryValue('Total Market Capitalization');
    const floatMarketCap = getSummaryValue('Total Float Market Capitalization');

    if (turnover === 0 && volume === 0) {
      console.error('YONEPSE: summary data is empty (market likely closed or weekend)');
      return null;
    }

    // Parse indices - find NEPSE Index
    const nepseIdx = indices.find(i => i.index === 'NEPSE Index');
    const sensIdx = indices.find(i => i.index === 'Sensitive Index');
    const floatIdx = indices.find(i => i.index === 'Float Index');
    const sfIdx = indices.find(i => i.index === 'Sensitive Float Index');

    if (!nepseIdx) {
      console.error('YONEPSE: NEPSE Index not found in indices data');
      return null;
    }

    const nepseIndex = Number(nepseIdx.currentValue || nepseIdx.close || 0);
    const change = Number(nepseIdx.change || 0);
    const changePercent = Number(nepseIdx.perChange || 0);

    if (nepseIndex === 0) {
      console.error('YONEPSE: NEPSE Index value is 0');
      return null;
    }

    // Parse top stocks for gainers/losers counts
    const topGainers = (topStocks.top_gainer || []) as Array<Record<string, unknown>>;
    const topLosers = (topStocks.top_loser || []) as Array<Record<string, unknown>>;

    const gainers = topGainers.length;
    const losers = topLosers.length;
    const unchanged = Math.max(0, Math.round(scripsTraded) - gainers - losers);

    // Extract top 10 gainers/losers for image posts (with full StockData format)
    const top10Gainers: StockData[] = topGainers.slice(0, 10).map(g => {
      const ltp = Number(g.ltp || 0);
      const pointChange = Number(g.pointChange || 0);
      return {
        symbol: String(g.symbol || ''),
        name: String(g.securityName || ''),
        closePrice: ltp,
        change: pointChange,
        changePercent: Number(g.percentageChange || 0),
        previousClose: Math.max(0, ltp - pointChange),
      };
    });

    const top10Losers: StockData[] = topLosers.slice(0, 10).map(l => {
      const ltp = Number(l.ltp || 0);
      const pointChange = Number(l.pointChange || 0);
      return {
        symbol: String(l.symbol || ''),
        name: String(l.securityName || ''),
        closePrice: ltp,
        change: pointChange,
        changePercent: Number(l.percentageChange || 0),
        previousClose: Math.max(0, ltp - pointChange),
      };
    });

    // Get trading date from indices generatedTime or use provided date
    const generatedTime = String(nepseIdx.generatedTime || '');
    let tradingDate = date;
    if (generatedTime) {
      try {
        tradingDate = generatedTime.split('T')[0];
      } catch { /* use provided date */ }
    }

    const rawData = JSON.stringify({
      source: 'yonepse',
      fetchedAt: new Date().toISOString(),
      generatedTime,
      nepseIndex,
      change,
      changePercent,
      turnover,
      volume,
      transactions,
      scripsTraded,
      marketCap,
      floatMarketCap,
      gainers,
      losers,
      unchanged,
      top10Gainers,
      top10Losers,
      sensitiveIndex: sensIdx ? Number(sensIdx.currentValue || sensIdx.close) : undefined,
      floatIndex: floatIdx ? Number(floatIdx.currentValue || floatIdx.close) : undefined,
      sensitiveFloatIndex: sfIdx ? Number(sfIdx.currentValue || sfIdx.close) : undefined,
    });

    return {
      tradingDate,
      nepseIndex,
      change,
      changePercentage: changePercent,
      turnover,
      volume,
      trades: Math.round(transactions),
      gainers,
      losers,
      unchanged,
      rawData,
      sensitiveIndex: sensIdx ? Number(sensIdx.currentValue || sensIdx.close) : undefined,
      sensitiveIndexChange: sensIdx ? Number(sensIdx.change) : undefined,
      sensitiveIndexChangePercent: sensIdx ? Number(sensIdx.perChange) : undefined,
      floatIndex: floatIdx ? Number(floatIdx.currentValue || floatIdx.close) : undefined,
      floatIndexChange: floatIdx ? Number(floatIdx.change) : undefined,
      floatIndexChangePercent: floatIdx ? Number(floatIdx.perChange) : undefined,
      sensitiveFloatIndex: sfIdx ? Number(sfIdx.currentValue || sfIdx.close) : undefined,
      sensitiveFloatIndexChange: sfIdx ? Number(sfIdx.change) : undefined,
      sensitiveFloatIndexChangePercent: sfIdx ? Number(sfIdx.perChange) : undefined,
      marketCap: marketCap || undefined,
      floatMarketCap: floatMarketCap || undefined,
      scripsTraded: Math.round(scripsTraded) || undefined,
      transactions: Math.round(transactions) || undefined,
      source: 'yonepse',
    };
  } catch (e) {
    console.error('YONEPSE fetch error:', e);
    return null;
  }
}

/**
 * Try the NEPSE API directly (may be blocked by WAF/Cloudflare).
 * Fallback only — YONEPSE is more reliable from server-side.
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

  const errors: string[] = [];

  // Source 1: NEPSE Official website scrape (most authoritative, includes top stocks)
  try {
    const nepseOfficialResult = await scrapeNepseOfficialFull(targetDate);
    if (nepseOfficialResult) {
      console.log(`NEPSE data fetched via Official Website. Index: ${nepseOfficialResult.nepseIndex}`);
      return nepseOfficialResult;
    }
    errors.push('NEPSE Official: scrape failed or returned invalid data (likely WAF blocked)');
  } catch (e) {
    errors.push(`NEPSE Official: ${e instanceof Error ? e.message : 'unknown error'}`);
  }

  // Source 2: YONEPSE static JSON API (free, no WAF, very reliable)
  try {
    const yonepseResult = await fetchFromYonepse(targetDate);
    if (yonepseResult) {
      console.log(`NEPSE data fetched via YONEPSE (fallback). Index: ${yonepseResult.nepseIndex}`);
      return yonepseResult;
    }
    errors.push('YONEPSE: no valid data returned (market may be closed)');
  } catch (e) {
    errors.push(`YONEPSE: ${e instanceof Error ? e.message : 'unknown error'}`);
  }

  // Source 3: Try the direct NEPSE API (redundant with Source 1 but simpler endpoint)
  try {
    const apiResult = await fetchFromNepseApi(targetDate);
    if (apiResult) {
      console.log('NEPSE data fetched via direct API (fallback)');
      return apiResult;
    }
    errors.push('NEPSE Direct API: no valid data returned');
  } catch (e) {
    errors.push(`NEPSE Direct API: ${e instanceof Error ? e.message : 'unknown error'}`);
  }

  // All sources failed — throw a clear error (NO mock data)
  throw new Error(
    `All NEPSE data sources failed. The market may be closed (weekends/holidays) or all APIs are unreachable.\n\n` +
    `Attempted:\n${errors.map(e => `  - ${e}`).join('\n')}\n\n` +
    `Please try again during market hours (11:00 AM - 3:00 PM NPT, Sunday-Thursday).`
  );
}

/**
 * Parse top gainers/losers from rawData (stored by YONEPSE fetch).
 * Returns empty arrays if data not available.
 */
export function parseTopStocksFromRawData(rawData: string): { gainers: TopStock[]; losers: TopStock[] } {
  try {
    const parsed = JSON.parse(rawData);
    // top10Gainers has full StockData format with closePrice
    const gainerData = parsed.top10Gainers || parsed.top5Gainers || [];
    const loserData = parsed.top10Losers || parsed.top5Losers || [];
    return {
      gainers: gainerData.map((g: Record<string, unknown>) => ({
        symbol: String(g.symbol || ''),
        name: String(g.name || ''),
        change: Number(g.change || 0),
        changePercent: Number(g.changePercent || 0),
      })),
      losers: loserData.map((l: Record<string, unknown>) => ({
        symbol: String(l.symbol || ''),
        name: String(l.name || ''),
        change: Number(l.change || 0),
        changePercent: Number(l.changePercent || 0),
      })),
    };
  } catch {
    return { gainers: [], losers: [] };
  }
}

/**
 * Parse full StockData[] (with closePrice) from rawData for image generation.
 */
export function parseStockDataFromRawData(rawData: string): { gainers: StockData[]; losers: StockData[] } {
  try {
    const parsed = JSON.parse(rawData);
    return {
      gainers: (parsed.top10Gainers || []).map((g: Record<string, unknown>) => ({
        symbol: String(g.symbol || ''),
        name: String(g.name || ''),
        closePrice: Number(g.closePrice || 0),
        change: Number(g.change || 0),
        changePercent: Number(g.changePercent || 0),
        previousClose: Number(g.previousClose || 0),
      })),
      losers: (parsed.top10Losers || []).map((l: Record<string, unknown>) => ({
        symbol: String(l.symbol || ''),
        name: String(l.name || ''),
        closePrice: Number(l.closePrice || 0),
        change: Number(l.change || 0),
        changePercent: Number(l.changePercent || 0),
        previousClose: Number(l.previousClose || 0),
      })),
    };
  } catch {
    return { gainers: [], losers: [] };
  }
}