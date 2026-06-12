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

/**
 * Fetch from YONEPSE static JSON API (GitHub Pages).
 * Free, no auth, no WAF, works from any server.
 * Updates every 30 min during market hours (11 AM - 3 PM NPT, Mon-Fri).
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
    
    // Count gainers/losers/unchanged from top stocks data
    // top_gainer contains ALL stocks with positive change, top_loser has ALL with negative
    const gainers = topGainers.length;
    const losers = topLosers.length;
    const totalTraded = topGainers.length + topLosers.length;
    
    // We need to find unchanged too - approximate from scrips traded
    // YONEPSE doesn't directly provide unchanged count, so we compute:
    // unchanged = scrips_traded - gainers - losers (if we have scrips data)
    const unchanged = Math.max(0, Math.round(scripsTraded) - gainers - losers);

    // Extract top 5 gainers/losers for image posts
    const top5Gainers = topGainers.slice(0, 5).map(g => ({
      symbol: String(g.symbol || ''),
      name: String(g.securityName || ''),
      change: Number(g.pointChange || 0),
      changePercent: Number(g.percentageChange || 0),
    }));

    const top5Losers = topLosers.slice(0, 5).map(l => ({
      symbol: String(l.symbol || ''),
      name: String(l.securityName || ''),
      change: Number(l.pointChange || 0),
      changePercent: Number(l.percentageChange || 0),
    }));

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
      top5Gainers,
      top5Losers,
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

  // Method 1: YONEPSE static JSON API (most reliable, free, no WAF)
  const yonepseResult = await fetchFromYonepse(targetDate);
  if (yonepseResult) {
    console.log(`NEPSE data fetched via YONEPSE. Index: ${yonepseResult.nepseIndex}`);
    return yonepseResult;
  }

  // Method 2: Try the direct NEPSE API
  const apiResult = await fetchFromNepseApi(targetDate);
  if (apiResult) {
    console.log('NEPSE data fetched via direct API');
    return apiResult;
  }

  // Method 3: Fallback to mock data (last resort)
  console.warn('WARNING: All data sources failed. Using MOCK data!');
  return generateMockData(targetDate);
}

// Re-export for use in image generation / gainers-losers formatting
export interface TopStock {
  symbol: string;
  name: string;
  change: number;
  changePercent: number;
}

export function parseTopStocksFromRawData(rawData: string): { gainers: TopStock[]; losers: TopStock[] } {
  try {
    const parsed = JSON.parse(rawData);
    return {
      gainers: parsed.top5Gainers || [],
      losers: parsed.top5Losers || [],
    };
  } catch {
    return { gainers: [], losers: [] };
  }
}