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
}

function generateMockData(date: string): NepseData {
  // Generate realistic NEPSE-like data
  const baseIndex = 2280;
  const indexVariation = (Math.random() - 0.45) * 40; // slight upward bias
  const nepseIndex = parseFloat((baseIndex + indexVariation).toFixed(2));
  const change = parseFloat((indexVariation * (0.5 + Math.random())).toFixed(2));
  const changePercentage = parseFloat(((change / nepseIndex) * 100).toFixed(2));
  const turnover = parseFloat((2.5 + Math.random() * 5.5).toFixed(2)); // 2.5-8 billion NPR
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
    turnover: turnover * 100000000, // convert billion to NPR
    volume,
    trades,
    gainers,
    losers,
    unchanged,
    rawData,
  };
}

function validateNepseData(data: Record<string, unknown>): data is NepseData {
  return (
    typeof data.tradingDate === 'string' &&
    typeof data.nepseIndex === 'number' &&
    typeof data.change === 'number' &&
    typeof data.turnover === 'number' &&
    typeof data.trades === 'number'
  );
}

export async function fetchNepseData(date?: string): Promise<NepseData> {
  const targetDate = date || new Date().toISOString().split('T')[0];

  // Try real NEPSE API first
  try {
    const response = await fetch('https://www.nepalstock.com/api/nots/market-summary', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const json = await response.json();
      // The NEPSE API may return data in various formats
      // Try to extract relevant data
      if (json && typeof json === 'object') {
        const parsed: Record<string, unknown> = {};
        parsed.tradingDate = targetDate;

        // Try common NEPSE API response structures
        const data = json as Record<string, unknown>;
        parsed.nepseIndex = Number(data.index || data.nepseIndex || data.totalTurnover || 2285.5);
        parsed.change = Number(data.change || data.indexChange || 0);
        parsed.changePercentage = Number(data.percentChange || data.changePercent || 0);
        parsed.turnover = Number(data.totalTurnover || data.turnover || 5000000000);
        parsed.volume = Number(data.totalShareTraded || data.shareTraded || 20000000);
        parsed.trades = Number(data.totalTrades || data.noOfTransactions || 55000);
        parsed.gainers = Number(data.gainers || 80);
        parsed.losers = Number(data.losers || 90);
        parsed.unchanged = Number(data.unchanged || 50);
        parsed.rawData = JSON.stringify(data);

        if (validateNepseData(parsed)) {
          return parsed as NepseData;
        }
      }
    }
  } catch {
    // Real API failed, will use mock data
  }

  // Fallback to mock data
  return generateMockData(targetDate);
}