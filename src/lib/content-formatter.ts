import type { NepseData } from './nepse';

// Default hashtags used when no custom hashtags are configured
export const DEFAULT_HASHTAGS = '#NEPSE #ShareSathi #NepalStockExchange #ShareMarket #StockMarketNepal #StockMarket';
const DEFAULT_GAINERS_HASHTAGS = '#NEPSE #ShareSathi #TopGainers #NepalStockMarket #StockMarket #NepalStockExchange #ShareMarket';
const DEFAULT_LOSERS_HASHTAGS = '#NEPSE #ShareSathi #TopLosers #NepalStockMarket #StockMarket #NepalStockExchange #ShareMarket';
const DEFAULT_STOCK_HASHTAGS = '#NEPSE #ShareSathi #StockMarket #NepalStockExchange #ShareMarket #NepalStockMarket #StockMarketNepal';

function formatNumber(num: number): string {
  if (num >= 100000000000) {
    return `${(num / 100000000000).toFixed(2)} Kharab`;
  }
  if (num >= 1000000000) {
    return `${(num / 1000000000).toFixed(2)} Arba`;
  }
  if (num >= 10000000) {
    return `${(num / 10000000).toFixed(2)} Crore`;
  }
  if (num >= 100000) {
    return `${(num / 100000).toFixed(2)} Lakhs`;
  }
  return num.toLocaleString('en-US');
}

function getChangeEmoji(change: number): string {
  return change >= 0 ? '\u25B2' : '\u25BC'; // ▲ or ▼
}

function getSign(change: number): string {
  return change >= 0 ? '+' : '';
}

export function formatMarketUpdate(data: NepseData): string {
  const arrow = getChangeEmoji(data.change);
  const sign = getSign(data.change);
  const turnoverFormatted = formatNumber(data.turnover);
  const volumeFormatted = formatNumber(data.volume);

  // Build sub-indexes line if available
  let subIndicesLine = '';
  if (data.sensitiveIndex) {
    const sArrow = getChangeEmoji(data.sensitiveIndexChange || 0);
    const sSign = getSign(data.sensitiveIndexChange || 0);
    subIndicesLine += `\n📊 Sensitive: ${data.sensitiveIndex.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${sArrow} ${sSign}${(data.sensitiveIndexChange || 0).toFixed(2)})`;
  }
  if (data.floatIndex) {
    const fArrow = getChangeEmoji(data.floatIndexChange || 0);
    const fSign = getSign(data.floatIndexChange || 0);
    subIndicesLine += `\n📊 Float: ${data.floatIndex.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${fArrow} ${fSign}${(data.floatIndexChange || 0).toFixed(2)})`;
  }

  // Build market cap line if available
  let marketCapLine = '';
  if (data.marketCap) {
    marketCapLine = `\n🏢 Market Cap: NPR ${formatNumber(data.marketCap)}`;
  }

  const message = `📈 NEPSE Daily Market Update
📅 Date: ${data.tradingDate}

🏛️ NEPSE Index: ${data.nepseIndex.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${arrow} ${sign}${data.change.toLocaleString('en-US', { minimumFractionDigits: 2 })} | ${sign}${data.changePercentage.toFixed(2)}%)
💰 Total Turnover: NPR ${turnoverFormatted}
📊 Total Transactions: ${data.trades.toLocaleString()}
📦 Total Traded Shares: ${volumeFormatted}${marketCapLine}
${subIndicesLine}
🟢 Advanced: ${data.gainers} | 🔴 Declined: ${data.losers} | ⚪ Unchanged: ${data.unchanged}

#NEPSE #NepalStockExchange #ShareMarket #ShareSathi`;

  return message;
}

export function formatImageCaption(data: NepseData, hashtags?: string): string {
  const arrow = getChangeEmoji(data.change);
  const sign = getSign(data.change);

  let caption = `NEPSE Index ${data.nepseIndex.toFixed(2)} ${arrow} ${sign}${data.change.toFixed(2)} (${sign}${data.changePercentage.toFixed(2)}%)\n\n`;
  caption += `Turnover: Rs. ${formatNumber(data.turnover)} | Transactions: ${data.trades.toLocaleString()}\n`;
  caption += `Traded Shares: ${formatNumber(data.volume)}\n`;
  caption += `Advanced: ${data.gainers} | Declined: ${data.losers} | Unchanged: ${data.unchanged}`;

  if (data.marketCap) {
    caption += `\nMarket Cap: Rs. ${formatNumber(data.marketCap)}`;
  }

  const sourceLabel = data.source === 'nepse-official'
    ? 'NEPSE Official (nepalstock.com)'
    : data.source === 'nepse-api'
      ? 'NEPSE API'
      : 'YONEPSE';

  caption += `\n\n${hashtags || DEFAULT_HASHTAGS}`;
  caption += `\n\nData Source: ${sourceLabel}`;
  return caption;
}

export function formatGainersCaption(date: string, gainers: Array<{ symbol: string; change: number; changePercent: number }>, hashtags?: string, source?: string): string {
  const rows = gainers.slice(0, 5).map((g, i) => `${i + 1}. ${g.symbol}: +${g.change.toFixed(2)} (+${g.changePercent.toFixed(2)}%)`).join('\n');
  const sourceLabel = source === 'nepse-official' ? 'NEPSE Official (nepalstock.com)' : source === 'nepse-api' ? 'NEPSE API' : 'YONEPSE';
  return `Today's Top Gainers - ${date}\n\n${rows}\n\n${hashtags || DEFAULT_GAINERS_HASHTAGS}\n\nData Source: ${sourceLabel}`;
}

export function formatLosersCaption(date: string, losers: Array<{ symbol: string; change: number; changePercent: number }>, hashtags?: string, source?: string): string {
  const rows = losers.slice(0, 5).map((l, i) => `${i + 1}. ${l.symbol}: ${l.change.toFixed(2)} (${l.changePercent.toFixed(2)}%)`).join('\n');
  const sourceLabel = source === 'nepse-official' ? 'NEPSE Official (nepalstock.com)' : source === 'nepse-api' ? 'NEPSE API' : 'YONEPSE';
  return `Today's Top Losers - ${date}\n\n${rows}\n\n${hashtags || DEFAULT_LOSERS_HASHTAGS}\n\nData Source: ${sourceLabel}`;
}

export function formatStockCardCaption(stock: { symbol: string; change: number; changePercent: number; closePrice: number }, type: 'gainer' | 'loser', hashtags?: string, source?: string): string {
  const heart = type === 'gainer' ? '\uD83D\uDC9A' : '\uD83D\uDC94';
  const sign = type === 'gainer' ? '+' : '';
  const sourceLabel = source === 'nepse-official' ? 'NEPSE Official (nepalstock.com)' : source === 'nepse-api' ? 'NEPSE API' : 'YONEPSE';
  return `${stock.symbol} today ${heart}\n\nLTP: Rs. ${stock.closePrice.toFixed(2)}\nChange: ${sign}${stock.change.toFixed(2)} (${sign}${stock.changePercent.toFixed(2)}%)\n\n${hashtags || DEFAULT_STOCK_HASHTAGS}\n\nData Source: ${sourceLabel}`;
}

function formatDateForCaption(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function formatIpoCardCaption(ipo: {
  companyName: string;
  companySymbol: string;
  ipoType: string;
  issueManager: string;
  issuedUnits: number;
  numberOfApplications: number;
  appliedUnits: number;
  totalAmount: number;
  openDate: string;
  closeDate: string;
  oversubscription: number | null;
  isOpen: boolean;
  openedToday: boolean;
  isLastDay?: boolean;
  dayNumber?: number;
}): string {
  const formatAmt = (n: number) => {
    if (n >= 10000000) return `${(n / 10000000).toFixed(2)} Crore`;
    if (n >= 100000) return `${(n / 100000).toFixed(2)} Lakhs`;
    return n.toLocaleString('en-US');
  };

  const symbol = ipo.companySymbol ? `(${ipo.companySymbol})` : '';
  const closeStr = ipo.closeDate ? formatDateForCaption(ipo.closeDate) : '';

  // Helper: ordinal suffix
  const ordinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // LAST DAY caption
  if (ipo.isLastDay) {
    return `\u26A0\uFE0F LAST DAY TO APPLY!\n\n` +
      `Last day to apply for the IPO of ${ipo.companyName} ${symbol}\n\n` +
      `\uD83D\uDCB5 Issued Units: ${ipo.issuedUnits.toLocaleString()}\n` +
      `\uD83D\uDCB0 Price Per Unit: Rs. 100\n` +
      `\uD83D\uDC64 Issue Manager: ${ipo.issueManager}\n` +
      `\uD83D\uDCC5 Closes: ${closeStr}\n` +
      (ipo.oversubscription && ipo.oversubscription > 0 ? `\uD83D\uDCC8 Oversubscribed: ${ipo.oversubscription.toFixed(2)}x times\n` : '') +
      `\n#NEPSE #ShareSathi #IPO #NepalIPO #${ipo.companySymbol || 'NepalStockMarket'} #StockMarket`;
  }

  // DAY 1 — IPO just opened
  if (ipo.openedToday || (ipo.dayNumber === 1)) {
    return `\uD83D\uDCE2 IPO OPENED TODAY!\n\n` +
      `${ipo.companyName} ${symbol}\n` +
      `${ipo.ipoType}\n\n` +
      `\uD83D\uDCB5 Issued Units: ${ipo.issuedUnits.toLocaleString()}\n` +
      `\uD83D\uDCB0 Price Per Unit: Rs. 100\n` +
      `\uD83D\uDC64 Issue Manager: ${ipo.issueManager}\n` +
      `\uD83D\uDCC5 Open: ${ipo.openDate ? formatDateForCaption(ipo.openDate) : ''}\n` +
      `\uD83D\uDCC5 Close: ${closeStr}\n` +
      `\nApply now through your Demat/CMMS account!\n\n` +
      `#NEPSE #ShareSathi #IPO #NepalIPO #${ipo.companySymbol || 'NepalStockMarket'} #StockMarket`;
  }

  // DAY 2+ — ongoing (show which day)
  if (ipo.isOpen && ipo.dayNumber && ipo.dayNumber >= 2) {
    const dayLabel = ordinal(ipo.dayNumber);
    let caption = `\uD83D\uDCC8 ${dayLabel} day for ${ipo.companyName} ${symbol}\n\n` +
      `${ipo.ipoType}\n\n` +
      `\uD83D\uDCB5 Issued Units: ${ipo.issuedUnits.toLocaleString()}\n` +
      `\uD83D\uDCB0 Price Per Unit: Rs. 100\n` +
      `\uD83D\uDC64 Issue Manager: ${ipo.issueManager}\n` +
      `\uD83D\uDCC5 Closes: ${closeStr}\n`;

    if (ipo.numberOfApplications > 0) {
      caption += `\uD83D\uDC65 Applications: ${ipo.numberOfApplications.toLocaleString()}\n`;
    }
    if (ipo.oversubscription && ipo.oversubscription > 0) {
      caption += `\uD83D\uDCC8 Oversubscribed: ${ipo.oversubscription.toFixed(2)}x times\n`;
    }
    if (ipo.totalAmount > 0) {
      caption += `\uD83D\uDCB0 Total Amount: Rs. ${formatAmt(ipo.totalAmount)}\n`;
    }

    caption += `\nApply now through your Demat/CMMS account!\n\n` +
      `#NEPSE #ShareSathi #IPO #NepalIPO #${ipo.companySymbol || 'NepalStockMarket'} #StockMarket`;
    return caption;
  }

  // OPEN (fallback — day number unknown, not today, not last day)
  if (ipo.isOpen) {
    let caption = `\uD83D\uDCC8 IPO NOW OPEN\n\n` +
      `${ipo.companyName} ${symbol}\n\n` +
      `\uD83D\uDCB5 Issued Units: ${ipo.issuedUnits.toLocaleString()}\n` +
      `\uD83D\uDCB0 Price Per Unit: Rs. 100\n` +
      `\uD83D\uDC64 Issue Manager: ${ipo.issueManager}\n` +
      `\uD83D\uDCC5 Closes: ${closeStr}\n`;

    if (ipo.numberOfApplications > 0) {
      caption += `\uD83D\uDC65 Applications: ${ipo.numberOfApplications.toLocaleString()}\n`;
    }
    if (ipo.oversubscription && ipo.oversubscription > 0) {
      caption += `\uD83D\uDCC8 Oversubscribed: ${ipo.oversubscription.toFixed(2)}x times\n`;
    }
    if (ipo.totalAmount > 0) {
      caption += `\uD83D\uDCB0 Total Amount: Rs. ${formatAmt(ipo.totalAmount)}\n`;
    }

    caption += `\n#NEPSE #ShareSathi #IPO #NepalIPO #${ipo.companySymbol || 'NepalStockMarket'} #StockMarket`;
    return caption;
  }

  // CLOSED caption
  let caption = `\uD83D\uDD12 IPO CLOSED\n\n` +
    `${ipo.companyName} ${symbol}\n\n` +
    `\uD83D\uDCB5 Issued Units: ${ipo.issuedUnits.toLocaleString()}\n` +
    `\uD83D\uDC64 Issue Manager: ${ipo.issueManager}\n`;

  if (ipo.numberOfApplications > 0) {
    caption += `\uD83D\uDC65 Applications: ${ipo.numberOfApplications.toLocaleString()}\n`;
  }
  if (ipo.appliedUnits > 0) {
    caption += `\uD83D\uDCC8 Applied Units: ${ipo.appliedUnits.toLocaleString()}\n`;
  }
  if (ipo.totalAmount > 0) {
    caption += `\uD83D\uDCB0 Total Amount: Rs. ${formatAmt(ipo.totalAmount)}\n`;
  }
  if (ipo.oversubscription && ipo.oversubscription > 0) {
    caption += `\uD83D\uDD25 Oversubscribed: ${ipo.oversubscription.toFixed(2)}x times\n`;
  }

  caption += `\n#NEPSE #ShareSathi #IPO #NepalIPO #${ipo.companySymbol || 'NepalStockMarket'} #StockMarket`;
  return caption;
}

export function getPostTemplate(): string {
  return `📈 NEPSE Daily Market Update
📅 Date: {tradingDate}

🏛️ NEPSE Index: {nepseIndex} ({change > 0 ? '▲' : '▼'} {change} | {changePercentage}%)
💰 Total Turnover: NPR {turnover}
📊 Total Transactions: {trades}
📦 Total Traded Shares: {volume}

🟢 Advanced: {gainers} | 🔴 Declined: {losers} | ⚪ Unchanged: {unchanged}

#NEPSE #NepalStockExchange #ShareMarket #ShareSathi`;
}

export function formatIpoResultCaption(ipo: {
  companyName: string;
  companySymbol: string;
  ipoType: string;
  issueManager: string;
  issuedUnits: number;
  numberOfApplications: number;
  appliedUnits: number;
  totalAmount: number;
  openDate: string;
  closeDate: string;
  oversubscription: number | null;
}): string {
  const formatAmt = (n: number) => {
    if (n >= 10000000) return `${(n / 10000000).toFixed(2)} Crore`;
    if (n >= 100000) return `${(n / 100000).toFixed(2)} Lakhs`;
    return n.toLocaleString('en-US');
  };

  const symbol = ipo.companySymbol ? `(${ipo.companySymbol})` : '';
  const closeStr = ipo.closeDate ? formatDateForCaption(ipo.closeDate) : '';

  let caption = `\uD83C\uDFC6 IPO RESULT OUT!\n\n` +
    `${ipo.companyName} ${symbol}\n` +
    `${ipo.ipoType}\n\n` +
    `\uD83D\uDCB5 Issued Units: ${ipo.issuedUnits.toLocaleString()}\n`;

  if (ipo.numberOfApplications > 0) {
    caption += `\uD83D\uDC65 Applications: ${ipo.numberOfApplications.toLocaleString()}\n`;
  }
  if (ipo.appliedUnits > 0) {
    caption += `\uD83D\uDCC8 Applied Units: ${formatAmt(ipo.appliedUnits)}\n`;
  }
  if (ipo.totalAmount > 0) {
    caption += `\uD83D\uDCB0 Total Amount: Rs. ${formatAmt(ipo.totalAmount)}\n`;
  }
  if (ipo.oversubscription && ipo.oversubscription > 0) {
    caption += `\uD83D\uDD25 Oversubscribed: ${ipo.oversubscription.toFixed(2)}x times\n`;
  }

  caption += `\nIssue Manager: ${ipo.issueManager}\n`;
  caption += `Period: ${ipo.openDate || '?'} to ${closeStr}\n\n`;
  caption += `#NEPSE #ShareSathi #IPOResult #NepalIPO #${ipo.companySymbol || 'NepalStockMarket'} #StockMarket`;
  return caption;
}

export function formatNewsCardCaption(news: {
  headline: string;
  source: string;
  category: string;
}): string {
  const sourceLabel = news.source === 'merolagani' ? 'Mero Lagani' :
    news.source === 'sharesansar' ? 'Share Sansar' :
    news.source === 'google_news' ? 'Google News' :
    news.source === 'myrepublica' ? 'My Republica' :
    news.source === 'sebon' ? 'SEBON' : news.source;

  return `${news.headline}\n\n📡 Source: ${sourceLabel}\n\n#NEPSE #ShareSathi #NepalStockMarket #ShareMarket #StockMarketNepal`;
}