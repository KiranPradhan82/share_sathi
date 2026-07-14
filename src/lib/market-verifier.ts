// Market Data Verifier
// Scrapes NEPSE official + Mero Lagani to verify YONEPSE data is final/live

export interface VerifiedMarketData {
  source: string;
  nepseIndex: number;
  turnover: number;
  change: number;
  changePercent: number;
  scrapedAt: string;
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Scrape NEPSE official website (nepalstock.com) for market summary.
 * Tries the JSON API endpoint; may be blocked by WAF/Cloudflare.
 */
async function scrapeNepseOfficial(): Promise<VerifiedMarketData | null> {
  try {
    const response = await fetch(
      'https://www.nepalstock.com/api/nots/market-summary',
      {
        headers: {
          ...BROWSER_HEADERS,
          Accept: 'application/json',
          Referer: 'https://www.nepalstock.com/',
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      console.warn(
        `NEPSE official API returned ${response.status} — likely blocked by WAF`
      );
      return null;
    }

    const json = (await response.json()) as Record<string, unknown>;
    if (!json || typeof json !== 'object') return null;

    const nepseIndex = Number(json.index || json.nepseIndex || 0);
    if (nepseIndex === 0) return null;

    return {
      source: 'nepse-official',
      nepseIndex,
      turnover: Number(json.totalTurnover || json.turnover || 0),
      change: Number(json.change || json.indexChange || 0),
      changePercent: Number(json.percentChange || json.changePercent || 0),
      scrapedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.warn('NEPSE official scrape failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Scrape Mero Lagani (merolagani.com/LatestMarket.aspx) for market summary.
 * Parses the HTML to extract NEPSE index, change, change %, and turnover.
 */
async function scrapeMeroLagani(): Promise<VerifiedMarketData | null> {
  try {
    const response = await fetch('https://merolagani.com/LatestMarket.aspx', {
      headers: {
        ...BROWSER_HEADERS,
        Referer: 'https://merolagani.com/',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.warn(`Mero Lagani returned ${response.status}`);
      return null;
    }

    const html = await response.text();

    // --- Extract NEPSE Index ---
    // The page typically has a prominent index display.
    // Look for patterns like:
    //   <span id="...">2,456.78</span>  near "NEPSE Index"
    //   or data attributes like data-index-value="2456.78"
    // Try multiple strategies:

    let nepseIndex = 0;
    let change = 0;
    let changePercent = 0;
    let turnover = 0;

    // Strategy 1: Look for a JSON blob embedded in the page (common in SPAs)
    const jsonBlobMatch = html.match(
      /var\s+marketData\s*=\s*(\{[\s\S]*?\});/
    );
    if (jsonBlobMatch) {
      try {
        const blob = JSON.parse(jsonBlobMatch[1]) as Record<string, unknown>;
        nepseIndex = Number(blob.index || blob.nepseIndex || 0);
        change = Number(blob.change || blob.indexChange || 0);
        changePercent = Number(
          blob.percentChange || blob.changePercent || blob.changePercentage || 0
        );
        turnover = Number(blob.totalTurnover || blob.turnover || 0);
      } catch {
        // JSON parse failed, continue with HTML parsing
      }
    }

    // Strategy 2: If JSON blob didn't work, parse HTML elements
    if (nepseIndex === 0) {
      // Try to find the NEPSE index value near a label
      // Common patterns on Mero Lagani:
      //   <td>NEPSE Index</td><td><span>2,456.78</span></td>
      //   or a div with class containing "index"

      // Look for a large number near "NEPSE" text
      const indexPattern =
        /(?:NEPSE\s*Index[^0-9]*?)([\d,]+\.\d{2})/i;
      const indexMatch = html.match(indexPattern);
      if (indexMatch) {
        nepseIndex = parseFloat(indexMatch[1].replace(/,/g, ''));
      }
    }

    if (nepseIndex === 0) {
      // Broader fallback: find the first large decimal number that looks like
      // a stock index (100–100,000 range)
      const indexCandidatesRe = /(?:value|index|close|ltp)[^0-9]*?([\d,]+\.\d{2})/gi;
      let indexExec: RegExpExecArray | null;
      while ((indexExec = indexCandidatesRe.exec(html)) !== null) {
        const val = parseFloat(indexExec[1].replace(/,/g, ''));
        if (val >= 100 && val <= 100000) {
          nepseIndex = val;
          break;
        }
      }
    }

    // --- Extract Change & Change Percent ---
    // Look for patterns like "+12.34" or "-5.67" near the index
    // and percentage like "(0.50%)" or "0.50%"
    if (change === 0) {
      const changeMatch = html.match(
        /(?:change|point)[^0-9\-+]*?([\-+]?[\d,]+\.\d{1,2})/i
      );
      if (changeMatch) {
        change = parseFloat(changeMatch[1].replace(/,/g, ''));
      }
    }

    if (changePercent === 0) {
      const pctMatch = html.match(
        /([\-\+]?\d+\.?\d*)\s*%/g
      );
      if (pctMatch) {
        // The first percentage near the index area is likely the change percent
        for (const p of pctMatch) {
          const val = parseFloat(p.replace(/[%\s,]/g, ''));
          if (Math.abs(val) < 20) {
            // Index change percent is typically < 10%
            changePercent = val;
            break;
          }
        }
      }
    }

    // --- Extract Turnover ---
    // Mero Lagani shows turnover like "Rs. 1,23,45,678.00" or similar
    if (turnover === 0) {
      const turnoverMatch = html.match(
        /(?:total\s*turnover|turnover)[^0-9]*?(?:Rs\.?\s*)?([\d,]+\.\d{2})/i
      );
      if (turnoverMatch) {
        turnover = parseFloat(turnoverMatch[1].replace(/,/g, ''));
      }
    }

    // Final validation — we must at least have the index
    if (nepseIndex === 0) {
      console.warn('Mero Lagani: could not parse NEPSE index from HTML');
      return null;
    }

    return {
      source: 'mero-lagani',
      nepseIndex,
      turnover,
      change,
      changePercent,
      scrapedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.warn(
      'Mero Lagani scrape failed:',
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * Compare a single field between YONEPSE and a source, returning true if within tolerance.
 */
function matchesWithinTolerance(
  yonepse: number,
  source: number,
  tolerance: number,
  mode: 'absolute' | 'relative' = 'absolute'
): boolean {
  if (mode === 'relative') {
    // Relative tolerance: e.g. 1% means source can be ±1% of yonepse value
    if (yonepse === 0) return source === 0;
    return Math.abs(yonepse - source) / Math.abs(yonepse) <= tolerance;
  }
  return Math.abs(yonepse - source) <= tolerance;
}

/**
 * Verify YONEPSE data against official sources.
 * Returns true if the data matches (within tolerance) with at least one official source.
 */
export async function verifyMarketData(yonepseData: {
  nepseIndex: number;
  change: number;
  changePercentage: number;
  turnover: number;
}): Promise<{
  verified: boolean;
  nepseOfficial: VerifiedMarketData | null;
  meroLagani: VerifiedMarketData | null;
  matchDetails: string;
}> {
  // 1. Scrape both sources in parallel
  const [nepseOfficial, meroLagani] = await Promise.all([
    scrapeNepseOfficial(),
    scrapeMeroLagani(),
  ]);

  const details: string[] = [];

  // 2. Compare each source
  let verified = false;

  if (nepseOfficial) {
    const indexMatch = matchesWithinTolerance(
      yonepseData.nepseIndex,
      nepseOfficial.nepseIndex,
      0.05 // 0.05 points tolerance for rounding differences
    );
    const pctMatch = matchesWithinTolerance(
      yonepseData.changePercentage,
      nepseOfficial.changePercent,
      0.01 // 0.01% tolerance
    );
    const turnoverMatch = matchesWithinTolerance(
      yonepseData.turnover,
      nepseOfficial.turnover,
      0.01, // 1% relative tolerance
      'relative'
    );

    if (indexMatch && pctMatch) {
      verified = true;
      details.push(
        `NEPSE Official: ✅ Index ${nepseOfficial.nepseIndex} (Δ${nepseOfficial.change}, ${nepseOfficial.changePercent}%)`
      );
    } else {
      details.push(
        `NEPSE Official: ❌ Index ${nepseOfficial.nepseIndex} vs YONEPSE ${yonepseData.nepseIndex} (indexMatch=${indexMatch}, pctMatch=${pctMatch})`
      );
    }
  } else {
    details.push('NEPSE Official: ⚠️ Unreachable (WAF/blocked)');
  }

  if (meroLagani) {
    const indexMatch = matchesWithinTolerance(
      yonepseData.nepseIndex,
      meroLagani.nepseIndex,
      0.05
    );
    const pctMatch = meroLagani.changePercent !== 0
      ? matchesWithinTolerance(
          yonepseData.changePercentage,
          meroLagani.changePercent,
          0.01
        )
      : true; // If we couldn't parse change%, don't fail on it

    const turnoverMatch = meroLagani.turnover !== 0
      ? matchesWithinTolerance(
          yonepseData.turnover,
          meroLagani.turnover,
          0.01,
          'relative'
        )
      : true;

    if (indexMatch && pctMatch) {
      verified = true;
      details.push(
        `Mero Lagani: ✅ Index ${meroLagani.nepseIndex} (Δ${meroLagani.change}, ${meroLagani.changePercent}%)`
      );
    } else {
      details.push(
        `Mero Lagani: ❌ Index ${meroLagani.nepseIndex} vs YONEPSE ${yonepseData.nepseIndex} (indexMatch=${indexMatch}, pctMatch=${pctMatch})`
      );
    }
  } else {
    details.push('Mero Lagani: ⚠️ Unreachable (scrape failed)');
  }

  const matchDetails = details.join('\n');

  if (!verified && nepseOfficial === null && meroLagani === null) {
    details.push(
      '\n⚠️ No external sources could be reached — cannot verify. YONEPSE data may still be correct.'
    );
  }

  console.log(`Market verification result: verified=${verified}\n${matchDetails}`);

  return {
    verified,
    nepseOfficial,
    meroLagani,
    matchDetails,
  };
}