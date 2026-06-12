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

export function formatMarketUpdate(data: NepseData): string {
  const arrow = data.change >= 0 ? '▲' : '▼';
  const sign = data.change >= 0 ? '+' : '';
  const turnoverFormatted = formatNumber(data.turnover);
  const volumeFormatted = formatNumber(data.volume);

  const message = `📈 NEPSE Daily Market Update
📅 Date: ${data.tradingDate}

🏛️ NEPSE Index: ${data.nepseIndex.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${arrow} ${sign}${data.change.toLocaleString('en-US', { minimumFractionDigits: 2 })} | ${sign}${data.changePercentage}%)
💰 Total Turnover: NPR ${turnoverFormatted}
📊 Total Trades: ${data.trades.toLocaleString()}
📦 Volume: ${volumeFormatted} shares

🟢 Gainers: ${data.gainers} | 🔴 Losers: ${data.losers} | ⚪ Unchanged: ${data.unchanged}

#NEPSE #NepalStockExchange #ShareMarket #ShareSathi`;

  return message;
}

export function getPostTemplate(): string {
  return `📈 NEPSE Daily Market Update
📅 Date: {tradingDate}

🏛️ NEPSE Index: {nepseIndex} ({change > 0 ? '▲' : '▼'} {change} | {changePercentage}%)
💰 Total Turnover: NPR {turnover}
📊 Total Trades: {trades}
📦 Volume: {volume} shares

🟢 Gainers: {gainers} | 🔴 Losers: {losers} | ⚪ Unchanged: {unchanged}

#NEPSE #NepalStockExchange #ShareMarket #ShareSathi`;
}