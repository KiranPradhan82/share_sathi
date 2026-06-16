// Nepali stock utilities
// StockData type is re-exported from nepse.ts for convenience
// Mock data generators have been removed — all data now comes from real sources

// Re-export StockData from the central nepse module
export type { StockData } from './nepse';

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