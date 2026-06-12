// Mock data generator for Nepali stocks with REAL Nepali stock names and symbols

export interface StockData {
  symbol: string;
  name: string;
  closePrice: number;
  change: number;
  changePercent: number;
  previousClose: number;
}

export interface GainersLosersData {
  gainers: StockData[];
  losers: StockData[];
}

// Real Nepali stock data with realistic price ranges
const STOCKS: Array<{ symbol: string; name: string; basePrice: number }> = [
  { symbol: 'NHPC', name: 'Nepal Hydropower Co. Ltd.', basePrice: 285 },
  { symbol: 'AHPC', name: 'Arun Hydropower Co. Ltd.', basePrice: 312 },
  { symbol: 'CHCL', name: 'Chilime Hydropower Co. Ltd.', basePrice: 378 },
  { symbol: 'NABIL', name: 'Nabil Bank Ltd.', basePrice: 1255 },
  { symbol: 'NICA', name: 'Nepal Investment Bank Ltd.', basePrice: 780 },
  { symbol: 'PRVU', name: 'Prabhu Bank Ltd.', basePrice: 215 },
  { symbol: 'HBL', name: 'Himalayan Bank Ltd.', basePrice: 345 },
  { symbol: 'NMB', name: 'NMB Bank Ltd.', basePrice: 198 },
  { symbol: 'GBIME', name: 'Global IME Bank Ltd.', basePrice: 175 },
  { symbol: 'SLBBL', name: 'Sanima Bank Ltd.', basePrice: 285 },
  { symbol: 'NCCB', name: 'Nepal Credit & Commerce Bank', basePrice: 132 },
  { symbol: 'ADBL', name: 'Agriculture Development Bank', basePrice: 258 },
  { symbol: 'CEDB', name: 'Citizens Bank International Ltd.', basePrice: 178 },
  { symbol: 'KBL', name: 'Kumari Bank Ltd.', basePrice: 145 },
  { symbol: 'MEGA', name: 'Mega Bank Nepal Ltd.', basePrice: 88 },
  { symbol: 'NIMB', name: 'Nepal Investment Mega Bank', basePrice: 165 },
  { symbol: 'SBL', name: 'Siddhartha Bank Ltd.', basePrice: 245 },
  { symbol: 'SRBL', name: 'Sunrise Bank Ltd.', basePrice: 128 },
  { symbol: 'NEBL', name: 'Nepal Bangladesh Bank Ltd.', basePrice: 95 },
  { symbol: 'BOKL', name: 'Bank of Kathmandu Ltd.', basePrice: 72 },
  { symbol: 'CBL', name: 'Civil Bank Ltd.', basePrice: 82 },
  { symbol: 'RLI', name: 'Reliable Life Insurance Ltd.', basePrice: 525 },
  { symbol: 'NLIC', name: 'Nepal Life Insurance Co.', basePrice: 2150 },
  { symbol: 'SBI', name: 'Siddhartha Insurance Ltd.', basePrice: 1125 },
  { symbol: 'PRVUL', name: 'Prime Life Insurance Co.', basePrice: 680 },
  { symbol: 'JVL', name: 'Jyoti Life Insurance Co.', basePrice: 320 },
  { symbol: 'PLIC', name: 'Prabhu Life Insurance Ltd.', basePrice: 240 },
  { symbol: 'UPPER', name: 'Upper Tamakoshi Hydropower', basePrice: 68 },
  { symbol: 'NHDL', name: 'Nagarik Network Ltd.', basePrice: 198 },
  { symbol: 'APSDCL', name: 'Butwal Power Company Ltd.', basePrice: 545 },
  { symbol: 'BPC', name: 'Butwal Power Company Ltd.', basePrice: 485 },
];

function generatePriceMovement(basePrice: number, volatility: number = 0.03): {
  closePrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
} {
  const previousClose = basePrice + (Math.random() - 0.5) * basePrice * 0.02;
  const changePercent = (Math.random() - 0.45) * volatility * 100; // slight upward bias
  const closePrice = previousClose * (1 + changePercent / 100);
  const change = closePrice - previousClose;

  return {
    closePrice: Math.round(closePrice * 100) / 100,
    previousClose: Math.round(previousClose * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
  };
}

export function generateGainersLosers(): GainersLosersData {
  // Generate data for all stocks
  const allStocks: StockData[] = STOCKS.map((stock) => {
    const { closePrice, previousClose, change, changePercent } = generatePriceMovement(stock.basePrice);
    return {
      symbol: stock.symbol,
      name: stock.name,
      closePrice,
      change,
      changePercent,
      previousClose,
    };
  });

  // Sort by change percent to get top gainers and losers
  const gainers = [...allStocks]
    .filter((s) => s.changePercent > 0)
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 10);

  const losers = [...allStocks]
    .filter((s) => s.changePercent < 0)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 10);

  return { gainers, losers };
}

export function generateSingleStock(symbol: string): StockData | undefined {
  const stock = STOCKS.find((s) => s.symbol === symbol);
  if (!stock) return undefined;

  const { closePrice, previousClose, change, changePercent } = generatePriceMovement(stock.basePrice);
  return {
    symbol: stock.symbol,
    name: stock.name,
    closePrice,
    change,
    changePercent,
    previousClose,
  };
}

// Format number in Nepali style (Arba, Crore, Lakhs)
export function formatNepaliAmount(amount: number): string {
  if (amount >= 1000000000) {
    return `${(amount / 1000000000).toFixed(2)} Arba`;
  }
  if (amount >= 10000000) {
    return `${(amount / 10000000).toFixed(2)} Crore`;
  }
  if (amount >= 100000) {
    return `${(amount / 100000).toFixed(2)} Lakhs`;
  }
  return amount.toLocaleString('en-US');
}

export function formatDateForPost(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
