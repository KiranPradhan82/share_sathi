// NEPSE Official Website Scraper
// Scrapes nepalstock.com for complete market data including top gainers/losers
// This is used as the PRIMARY data source before falling back to YONEPSE

import type { NepseData, StockData } from './nepse';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.nepalstock.com/',
  Origin: 'https://www.nepalstock.com',
};

interface NepseApiMarketSummary {
  index?: number;
  nepseIndex?: number;
  change?: number;
  indexChange?: number;
  percentChange?: number;
  changePercent?: number;
  totalTurnover?: number;
  turnover?: number;
  totalShareTraded?: number;
  shareTraded?: number;
  totalTrades?: number;
  noOfTransactions?: number;
  gainers?: number;
  losers?: number;
  unchanged?: number;
  totalMarketCap?: number;
  totalFloatMarketCap?: number;
  scripsTraded?: number;
  [key: string]: unknown;
}

interface NepseApiTopStock {
  symbol?: string;
  securityName?: string;
  securitySymbol?: string;
  ltp?: number;
  pointChange?: number;
  percentageChange?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  previousClose?: number;
  tradedShares?: number;
  amount?: number;
}

export interface ScrapedNepseData {
  data: NepseData;
  source: 'nepse-official';
  scrapedAt: string;
}

/**
 * Scrape NEPSE official API for market summary data.
 * Returns full NepseData if successful, null if blocked/failed.
 */
async function scrapeNepseMarketSummary(date: string): Promise<Partial<NepseData> | null> {
  try {
    const response = await fetch('https://www.nepalstock.com/api/nots/market-summary', {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.warn(`NEPSE market-summary API returned ${response.status} — likely WAF blocked`);
      return null;
    }

    const json = (await response.json()) as NepseApiMarketSummary;
    if (!json || typeof json !== 'object') return null;

    const nepseIndex = Number(json.index || json.nepseIndex || 0);
    if (nepseIndex === 0) return null;

    return {
      tradingDate: date,
      nepseIndex,
      change: Number(json.change || json.indexChange || 0),
      changePercentage: Number(json.percentChange || json.changePercent || 0),
      turnover: Number(json.totalTurnover || json.turnover || 0),
      volume: Number(json.totalShareTraded || json.shareTraded || 0),
      trades: Number(json.totalTrades || json.noOfTransactions || 0),
      gainers: Number(json.gainers || 0),
      losers: Number(json.losers || 0),
      unchanged: Number(json.unchanged || 0),
      marketCap: Number(json.totalMarketCap || 0) || undefined,
      floatMarketCap: Number(json.totalFloatMarketCap || 0) || undefined,
      scripsTraded: Number(json.scripsTraded || 0) || undefined,
      transactions: Number(json.totalTrades || json.noOfTransactions || 0) || undefined,
      source: 'nepse-official',
    };
  } catch (e) {
    console.warn('NEPSE market-summary scrape failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Scrape NEPSE official API for today's price data (top gainers & losers).
 * Endpoint: https://www.nepalstock.com/api/nots/today-price
 */
async function scrapeNepseTodayPrice(): Promise<{ gainers: StockData[]; losers: StockData[] } | null> {
  try {
    const response = await fetch('https://www.nepalstock.com/api/nots/today-price', {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.warn(`NEPSE today-price API returned ${response.status}`);
      return null;
    }

    const json = (await response.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(json) || json.length === 0) {
      console.warn('NEPSE today-price: empty or invalid response');
      return null;
    }

    // Parse all stocks with their change data
    const allStocks: StockData[] = json
      .map((item) => {
        const symbol = String(item.symbol || item.securitySymbol || '');
        const name = String(item.securityName || '');
        const ltp = Number(item.ltp || item.close || 0);
        const pointChange = Number(item.pointChange || item.change || 0);
        const pctChange = Number(item.percentageChange || item.percentChange || 0);
        const prevClose = Number(item.previousClose || item.open || 0);

        return {
          symbol,
          name,
          closePrice: ltp,
          change: pointChange,
          changePercent: pctChange,
          previousClose: prevClose > 0 ? prevClose : Math.max(0, ltp - pointChange),
        };
      })
      .filter((s) => s.symbol && s.closePrice > 0);

    // Sort gainers (descending by change%) and losers (ascending by change%)
    const gainers = allStocks
      .filter((s) => s.change > 0)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 10);

    const losers = allStocks
      .filter((s) => s.change < 0)
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, 10);

    if (gainers.length === 0 && losers.length === 0) {
      console.warn('NEPSE today-price: no gainers or losers found');
      return null;
    }

    return { gainers, losers };
  } catch (e) {
    console.warn('NEPSE today-price scrape failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Scrape NEPSE official API for indices data (NEPSE Index, Sensitive, Float, etc.).
 */
async function scrapeNepseIndices(): Promise<{
  sensitiveIndex?: number;
  sensitiveIndexChange?: number;
  sensitiveIndexChangePercent?: number;
  floatIndex?: number;
  floatIndexChange?: number;
  floatIndexChangePercent?: number;
  sensitiveFloatIndex?: number;
  sensitiveFloatIndexChange?: number;
  sensitiveFloatIndexChangePercent?: number;
} | null> {
  try {
    const response = await fetch('https://www.nepalstock.com/api/nots/indices', {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const json = (await response.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(json)) return null;

    const result: Record<string, number | undefined> = {};

    for (const idx of json) {
      const name = String(idx.index || '').toLowerCase();
      if (name.includes('sensitive float')) {
        result.sensitiveFloatIndex = Number(idx.currentValue || idx.close);
        result.sensitiveFloatIndexChange = Number(idx.change);
        result.sensitiveFloatIndexChangePercent = Number(idx.perChange);
      } else if (name.includes('sensitive')) {
        result.sensitiveIndex = Number(idx.currentValue || idx.close);
        result.sensitiveIndexChange = Number(idx.change);
        result.sensitiveIndexChangePercent = Number(idx.perChange);
      } else if (name.includes('float')) {
        result.floatIndex = Number(idx.currentValue || idx.close);
        result.floatIndexChange = Number(idx.change);
        result.floatIndexChangePercent = Number(idx.perChange);
      }
    }

    return result as {
      sensitiveIndex?: number;
      sensitiveIndexChange?: number;
      sensitiveIndexChangePercent?: number;
      floatIndex?: number;
      floatIndexChange?: number;
      floatIndexChangePercent?: number;
      sensitiveFloatIndex?: number;
      sensitiveFloatIndexChange?: number;
      sensitiveFloatIndexChangePercent?: number;
    };
  } catch (e) {
    console.warn('NEPSE indices scrape failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Main entry point: Scrape NEPSE official website for complete market data.
 * Tries market-summary + today-price + indices in parallel.
 * Returns full NepseData with rawData containing top10Gainers/top10Losers.
 * Returns null if WAF blocks or data is invalid.
 */
export async function scrapeNepseOfficialFull(date: string): Promise<NepseData | null> {
  try {
    // Fetch all 3 endpoints in parallel
    const [summaryResult, todayPriceResult, indicesResult] = await Promise.all([
      scrapeNepseMarketSummary(date),
      scrapeNepseTodayPrice(),
      scrapeNepseIndices(),
    ]);

    if (!summaryResult) {
      console.warn('NEPSE official full scrape: market-summary failed (WAF?)');
      return null;
    }

    // Build top stocks data (from today-price if available, else empty)
    const topStocks = todayPriceResult || { gainers: [], losers: [] };

    // If we got today-price data, update gainers/losers counts from actual data
    const gainersCount = topStocks.gainers.length > 0
      ? topStocks.gainers.length
      : (summaryResult.gainers || 0);
    const losersCount = topStocks.losers.length > 0
      ? topStocks.losers.length
      : (summaryResult.losers || 0);
    const unchangedCount = summaryResult.unchanged || 0;

    // Merge indices data
    const indices = indicesResult || {};

    const rawData = JSON.stringify({
      source: 'nepse-official',
      scrapedAt: new Date().toISOString(),
      nepseIndex: summaryResult.nepseIndex,
      change: summaryResult.change,
      changePercent: summaryResult.changePercentage,
      turnover: summaryResult.turnover,
      volume: summaryResult.volume,
      transactions: summaryResult.trades,
      scripsTraded: summaryResult.scripsTraded,
      marketCap: summaryResult.marketCap,
      floatMarketCap: summaryResult.floatMarketCap,
      gainers: gainersCount,
      losers: losersCount,
      unchanged: unchangedCount,
      top10Gainers: topStocks.gainers,
      top10Losers: topStocks.losers,
      sensitiveIndex: indices.sensitiveIndex,
      floatIndex: indices.floatIndex,
      sensitiveFloatIndex: indices.sensitiveFloatIndex,
    });

    const result: NepseData = {
      tradingDate: date,
      nepseIndex: summaryResult.nepseIndex!,
      change: summaryResult.change || 0,
      changePercentage: summaryResult.changePercentage || 0,
      turnover: summaryResult.turnover || 0,
      volume: summaryResult.volume || 0,
      trades: Math.round(summaryResult.trades || 0),
      gainers: gainersCount,
      losers: losersCount,
      unchanged: unchangedCount,
      rawData,
      sensitiveIndex: indices.sensitiveIndex,
      sensitiveIndexChange: indices.sensitiveIndexChange,
      sensitiveIndexChangePercent: indices.sensitiveIndexChangePercent,
      floatIndex: indices.floatIndex,
      floatIndexChange: indices.floatIndexChange,
      floatIndexChangePercent: indices.floatIndexChangePercent,
      sensitiveFloatIndex: indices.sensitiveFloatIndex,
      sensitiveFloatIndexChange: indices.sensitiveFloatIndexChange,
      sensitiveFloatIndexChangePercent: indices.sensitiveFloatIndexChangePercent,
      marketCap: summaryResult.marketCap,
      floatMarketCap: summaryResult.floatMarketCap,
      scripsTraded: summaryResult.scripsTraded,
      transactions: Math.round(summaryResult.trades || 0),
      source: 'nepse-official',
    };

    console.log(
      `NEPSE official scrape SUCCESS. Index: ${result.nepseIndex}, ` +
      `Gainers: ${gainersCount}, Losers: ${losersCount}, ` +
      `Turnover: ${result.turnover.toLocaleString()}, ` +
      `Today-price stocks: ${topStocks.gainers.length + topStocks.losers.length}`
    );

    return result;
  } catch (e) {
    console.error('NEPSE official full scrape error:', e instanceof Error ? e.message : e);
    return null;
  }
}
