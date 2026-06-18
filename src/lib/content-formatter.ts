import type { NepseData } from './nepse';

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

export function formatImageCaption(data: NepseData): string {
  const arrow = getChangeEmoji(data.change);
  const sign = getSign(data.change);

  let caption = `NEPSE Index ${data.nepseIndex.toFixed(2)} ${arrow} ${sign}${data.change.toFixed(2)} (${sign}${data.changePercentage.toFixed(2)}%)\n\n`;
  caption += `Turnover: Rs. ${formatNumber(data.turnover)} | Transactions: ${data.trades.toLocaleString()}\n`;
  caption += `Traded Shares: ${formatNumber(data.volume)}\n`;
  caption += `Advanced: ${data.gainers} | Declined: ${data.losers} | Unchanged: ${data.unchanged}`;

  if (data.marketCap) {
    caption += `\nMarket Cap: Rs. ${formatNumber(data.marketCap)}`;
  }

  caption += `\n\n#NEPSE #ShareSathi #NepalStockExchange #ShareMarket #StockMarketNepal #StockMarket`;
  return caption;
}

export function formatGainersCaption(date: string, gainers: Array<{ symbol: string; change: number; changePercent: number }>): string {
  const rows = gainers.slice(0, 5).map((g, i) => `${i + 1}. ${g.symbol}: +${g.change.toFixed(2)} (+${g.changePercent.toFixed(2)}%)`).join('\n');
  return `Today's Top Gainers - ${date}\n\n${rows}\n\n#NEPSE #ShareSathi #TopGainers #NepalStockMarket #StockMarket #NepalStockExchange #ShareMarket`;
}

export function formatLosersCaption(date: string, losers: Array<{ symbol: string; change: number; changePercent: number }>): string {
  const rows = losers.slice(0, 5).map((l, i) => `${i + 1}. ${l.symbol}: ${l.change.toFixed(2)} (${l.changePercent.toFixed(2)}%)`).join('\n');
  return `Today's Top Losers - ${date}\n\n${rows}\n\n#NEPSE #ShareSathi #TopLosers #NepalStockMarket #StockMarket #NepalStockExchange #ShareMarket`;
}

export function formatStockCardCaption(stock: { symbol: string; change: number; changePercent: number; closePrice: number }, type: 'gainer' | 'loser'): string {
  const heart = type === 'gainer' ? '\uD83D\uDC9A' : '\uD83D\uDC94';
  const sign = type === 'gainer' ? '+' : '';
  return `${stock.symbol} today ${heart}\n\nLTP: Rs. ${stock.closePrice.toFixed(2)}\nChange: ${sign}${stock.change.toFixed(2)} (${sign}${stock.changePercent.toFixed(2)}%)\n\n#NEPSE #ShareSathi #StockMarket #NepalStockExchange #ShareMarket #NepalStockMarket #StockMarketNepal`;
}

export function formatIpoCardCaption(ipo: {
  companyName: string;
  companySymbol: string;
  ipoType: string;
  issuedUnits: number;
  numberOfApplications: number;
  appliedUnits: number;
  totalAmount: number;
  openDate: string;
  closeDate: string;
  oversubscription: number | null;
  isOpen: boolean;
  openedToday: boolean;
}): string {
  const symbol = ipo.companySymbol ? ` (${ipo.companySymbol})` : '';
  let caption: string;

  if (ipo.openedToday || ipo.isOpen) {
    // Open or opened today — no oversubscription info
    const pricePerUnit = ipo.issuedUnits > 0 ? Math.round(ipo.totalAmount / ipo.issuedUnits) : 0;
    caption = `${ipo.companyName}${symbol} - IPO ${ipo.openedToday ? 'Opening Today' : 'Now Open'}! 📊\n\n`;
    caption += `${ipo.ipoType}\n`;
    caption += `Issue: ${ipo.issuedUnits.toLocaleString()} units`;
    if (pricePerUnit > 0) caption += ` @ Rs. ${pricePerUnit} per unit`;
    caption += `\n`;
    caption += `Period: ${ipo.openDate} to ${ipo.closeDate}\n`;
    caption += `Issue Manager: ${ipo.issueManager}`;
  } else {
    // Closed IPO — show oversubscription data
    const sub = ipo.oversubscription;
    caption = `${ipo.companyName}${symbol} - IPO Results 📊\n\n`;
    caption += `${ipo.ipoType}\n`;
    caption += `Issued: ${ipo.issuedUnits.toLocaleString()} units\n`;
    caption += `Applications: ${ipo.numberOfApplications.toLocaleString()}\n`;
    caption += `Applied Units: ${ipo.appliedUnits.toLocaleString()}\n`;
    if (sub !== null && sub > 0) {
      caption += `Oversubscription: ${sub.toFixed(2)}x\n`;
    }
    caption += `Period: ${ipo.openDate} to ${ipo.closeDate}`;
  }

  caption += `\n\n#NEPSE #ShareSathi #IPO #NepalIPO #StockMarket #NepalStockExchange #ShareMarket`;
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