// CDSC IPO List Scraper — scrapes cdsc.com.np/ipolist
// Static HTML table, no JS rendering needed

export interface IpoItem {
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
  lastUpdate: string;
  oversubscription: number | null;
}

function parseCompanyInfo(rawName: string): { name: string; symbol: string; ipoType: string } {
  // Format: "Company Name Limited - SYMBOL (IPO - For General Public)"
  // or:    "Company Name Limited (IPO - For General Public)"
  const match = rawName.match(/^(.+?)\s*[-–]\s*([A-Z]+)\s*\((.+)\)$/);
  if (match) {
    return { name: match[1].trim(), symbol: match[2].trim(), ipoType: match[3].trim() };
  }
  // Fallback: no symbol
  const match2 = rawName.match(/^(.+?)\s*\((.+)\)$/);
  if (match2) {
    return { name: match2[1].trim(), symbol: '', ipoType: match2[2].trim() };
  }
  return { name: rawName.trim(), symbol: '', ipoType: '' };
}

function parseAmount(amountStr: string): number {
  // CDSC returns amounts as plain numbers (e.g., "1293772000")
  const cleaned = amountStr.replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseDate(dateStr: string): string {
  return dateStr.trim();
}

export async function scrapeCdscIpoList(): Promise<IpoItem[]> {
  const res = await fetch('https://cdsc.com.np/ipolist', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`CDSC returned HTTP ${res.status}`);
  }

  const html = await res.text();

  // Extract table rows from tbody
  const items: IpoItem[] = [];

  // Match each <tr> block inside tbody
  const trRegex = /<tr>\s*<td>(\d+)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>([\d,]+)<\/td>\s*<td>([\d,]+)<\/td>\s*<td>([\d,]+)<\/td>\s*<td>([\d,]+)<\/td>\s*<td>([\d-]+)<\/td>\s*<td>([\d-]+)<\/td>\s*<td>([^<]+)<\/td>\s*<\/tr>/gi;

  let match;
  while ((match = trRegex.exec(html)) !== null) {
    const rawName = match[2].replace(/<[^>]*>/g, '').trim();
    const { name, symbol, ipoType } = parseCompanyInfo(rawName);
    const issuedUnits = parseInt(match[4].replace(/,/g, ''), 10) || 0;
    const appliedUnits = parseInt(match[6].replace(/,/g, ''), 10) || 0;
    const oversubscription = issuedUnits > 0 ? parseFloat((appliedUnits / issuedUnits).toFixed(2)) : null;

    items.push({
      companyName: name,
      companySymbol: symbol,
      ipoType,
      issueManager: match[3].replace(/<[^>]*>/g, '').trim(),
      issuedUnits,
      numberOfApplications: parseInt(match[5].replace(/,/g, ''), 10) || 0,
      appliedUnits,
      totalAmount: parseAmount(match[7]),
      openDate: parseDate(match[8]),
      closeDate: parseDate(match[9]),
      lastUpdate: match[10].trim(),
      oversubscription,
    });
  }

  return items;
}