// Client-side image generation using Satori + browser Canvas API
// Bright, engaging, Facebook-optimized designs

import satori from 'satori';
import type { NepseData } from './nepse';
import type { StockData } from './nepse';

const WIDTH = 1080;
const HEIGHT = 1080;

let fontsCache: Array<{ name: string; data: ArrayBuffer; weight: number; style: string }> | null = null;

async function loadFonts(): Promise<Array<{ name: string; data: ArrayBuffer; weight: number; style: string }>> {
  if (fontsCache) return fontsCache;

  const weights = [400, 500, 600, 700, 800, 900];
  const fontPromises = weights.map(async (weight) => {
    const res = await fetch(`/fonts/Inter-${weight}.woff`);
    const buf = await res.arrayBuffer();
    return { name: 'Inter', data: buf, weight, style: 'normal' as const };
  });

  fontsCache = await Promise.all(fontPromises);
  return fontsCache;
}

function svgToPngBase64(svg: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('Canvas not supported')); return; }

    const img = new Image();
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to render SVG to canvas'));
    };
    img.src = url;
  });
}

// ---- Helpers ----
function formatDateForPost(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatNepaliAmount(amount: number): string {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(2)} Crore`;
  if (amount >= 100000) return `${(amount / 100000).toFixed(2)} Lakhs`;
  return amount.toLocaleString('en-US');
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// Bright branded footer
function brandedFooter(accentColor: string) {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 70,
        background: `linear-gradient(90deg, ${accentColor}, ${accentColor}dd)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      },
      children: {
        type: 'div',
        props: { style: { fontSize: 22, fontWeight: 900, color: '#ffffff', letterSpacing: '0.15em' }, children: 'SHARE SATHI' },
      },
    },
  };
}

// ---- Template 1: BRIGHT Market Summary ----
async function renderMarketSummarySvg(data: NepseData, fonts: Array<{ name: string; data: ArrayBuffer; weight: number; style: string }>): Promise<string> {
  const isUp = data.change >= 0;
  const accentColor = isUp ? '#059669' : '#DC2626';
  const accentLight = isUp ? '#D1FAE5' : '#FEE2E2';
  const accentBg = isUp ? '#ECFDF5' : '#FEF2F2';
  const arrow = isUp ? '\u25B2' : '\u25BC';
  const sign = isUp ? '+' : '';
  const dateStr = formatDateForPost(data.tradingDate);
  const turnoverFormatted = formatNepaliAmount(data.turnover);
  const volumeFormatted = formatNepaliAmount(data.volume);

  const metrics = [
    { label: 'TURNOVER', value: `Rs. ${turnoverFormatted}`, color: '#2563EB', bg: '#EFF6FF', icon: '\uD83D\uDCB0' },
    { label: 'TRADED SHARES', value: volumeFormatted, color: '#7C3AED', bg: '#F5F3FF', icon: '\uD83D\uDCE6' },
    { label: 'TRANSACTIONS', value: data.trades.toLocaleString(), color: '#EA580C', bg: '#FFF7ED', icon: '\uD83D\uDCCA' },
    { label: 'ADVANCED', value: data.gainers.toString(), color: '#059669', bg: '#ECFDF5', icon: '\uD83D\uDFE2' },
    { label: 'DECLINED', value: data.losers.toString(), color: '#DC2626', bg: '#FEF2F2', icon: '\uD83D\uDFE1' },
    { label: 'UNCHANGED', value: data.unchanged.toString(), color: '#2563EB', bg: '#EFF6FF', icon: '\u26AA' },
  ];

  return satoriWithValidation(
    {
      type: 'div',
      props: {
        style: {
          width: WIDTH, height: HEIGHT,
          background: 'linear-gradient(180deg, #ffffff 0%, #F8FAFC 40%, #F1F5F9 100%)',
          position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column' as const,
        },
        children: [
          // Top colored band
          { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: accentColor } } },
          // Decorative circle top-right
          { type: 'div', props: { style: { position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: accentLight, opacity: 0.5 } } },
          // Decorative circle bottom-left
          { type: 'div', props: { style: { position: 'absolute', bottom: 50, left: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: accentLight, opacity: 0.3 } } },

          // Header
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', paddingTop: 45, paddingBottom: 5 },
              children: [
                { type: 'div', props: { style: { fontSize: 16, fontWeight: 700, color: accentColor, letterSpacing: '0.2em', textTransform: 'uppercase' as const }, children: '\uD83D\uDCC8 DAILY MARKET UPDATE' } },
                { type: 'div', props: { style: { fontSize: 15, color: '#64748B', marginTop: 4, fontWeight: 500 }, children: dateStr } },
              ],
            },
          },

          // Index display card
          {
            type: 'div',
            props: {
              style: {
                display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
                margin: '18px 50px 0px', padding: '28px 30px',
                backgroundColor: '#ffffff', borderRadius: 24,
                boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
                border: `2px solid ${accentLight}`,
              },
              children: [
                { type: 'div', props: { style: { fontSize: 14, fontWeight: 700, color: '#64748B', letterSpacing: '0.15em', textTransform: 'uppercase' as const }, children: 'NEPSE INDEX' } },
                { type: 'div', props: { style: { fontSize: 88, fontWeight: 900, color: '#0F172A', lineHeight: 1, marginTop: 4 }, children: data.nepseIndex.toFixed(2) } },
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', flexDirection: 'row' as const, alignItems: 'center', gap: 14, marginTop: 12, backgroundColor: accentBg, padding: '10px 28px', borderRadius: 40 },
                    children: [
                      { type: 'div', props: { style: { fontSize: 28, fontWeight: 800, color: accentColor }, children: arrow } },
                      { type: 'div', props: { style: { fontSize: 30, fontWeight: 800, color: accentColor }, children: `${sign}${data.change.toFixed(2)}` } },
                      { type: 'div', props: { style: { fontSize: 26, fontWeight: 700, color: accentColor, opacity: 0.8 }, children: `(${sign}${data.changePercentage.toFixed(2)}%)` } },
                    ],
                  },
                },
                // Visual percentage bar
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', alignItems: 'center', width: '100%', height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, marginTop: 16, overflow: 'hidden' },
                    children: {
                      type: 'div',
                      props: {
                        style: {
                          width: `${Math.min(Math.abs(data.changePercentage) * 8, 100)}%`, height: '100%',
                          backgroundColor: accentColor, borderRadius: 4,
                        },
                      },
                    },
                  },
                },
              ],
            },
          },

          // Metrics grid
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, width: WIDTH, padding: '0px 50px', gap: 10, marginTop: 22 },
              children: [0, 1, 2].map((row) => ({
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'row' as const, width: '100%', gap: 10 },
                  children: metrics.slice(row * 2, row * 2 + 2).map((m) => ({
                    type: 'div',
                    props: {
                      style: {
                        flex: 1, display: 'flex', flexDirection: 'row' as const, alignItems: 'center', gap: 12,
                        backgroundColor: '#ffffff', borderRadius: 16, padding: '14px 18px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        borderLeft: `5px solid ${m.color}`,
                      },
                      children: [
                        { type: 'div', props: { style: { fontSize: 24 }, children: m.icon } },
                        {
                          type: 'div',
                          props: {
                            style: { display: 'flex', flexDirection: 'column' as const, flex: 1 },
                            children: [
                              { type: 'div', props: { style: { fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.1em', textTransform: 'uppercase' as const }, children: m.label } },
                              { type: 'div', props: { style: { fontSize: 20, fontWeight: 800, color: '#1E293B', marginTop: 1 }, children: m.value } },
                            ],
                          },
                        },
                      ],
                    },
                  })),
                },
              })),
            },
          },
          brandedFooter(accentColor),
        ],
      },
    },
    { width: WIDTH, height: HEIGHT, fonts }, 'MarketSummary',
  );
}

// ---- Template 2: BRIGHT Top 10 Gainers ----
async function renderGainersSvg(gainers: StockData[], dateStr: string, fonts: Array<{ name: string; data: ArrayBuffer; weight: number; style: string }>): Promise<string> {
  const formattedDate = formatDateShort(dateStr);
  const accent = '#059669';
  const accentLight = '#D1FAE5';

  const headerRow = {
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'row' as const, width: '100%', backgroundColor: '#059669', padding: '12px 16px', borderTopLeftRadius: 16, borderTopRightRadius: 16, alignItems: 'center' },
      children: [
        { type: 'div', props: { style: { width: 40, fontSize: 15, fontWeight: 700, color: '#ffffff' }, children: '#' } },
        { type: 'div', props: { style: { flex: 1, fontSize: 15, fontWeight: 700, color: '#ffffff' }, children: 'STOCK' } },
        { type: 'div', props: { style: { width: 110, fontSize: 15, fontWeight: 700, color: '#ffffff', textAlign: 'right' as const }, children: 'LTP' } },
        { type: 'div', props: { style: { width: 100, fontSize: 15, fontWeight: 700, color: '#ffffff', textAlign: 'right' as const }, children: 'CHANGE' } },
        { type: 'div', props: { style: { width: 90, fontSize: 15, fontWeight: 700, color: '#ffffff', textAlign: 'right' as const }, children: '% CHG' } },
      ],
    },
  };

  const dataRows = gainers.map((stock, idx) => {
    const barWidth = Math.min(Math.abs(stock.changePercent) * 6, 100);
    return {
      type: 'div',
      props: {
        style: { display: 'flex', flexDirection: 'row' as const, width: '100%', backgroundColor: idx % 2 === 0 ? '#F0FDF4' : '#ffffff', padding: '10px 16px', alignItems: 'center', position: 'relative' as const, overflow: 'hidden' },
        children: [
          // Background bar showing relative % change
          {
            type: 'div',
            props: {
              style: { position: 'absolute' as const, right: 0, top: 0, bottom: 0, width: `${barWidth}%`, backgroundColor: '#BBF7D0', opacity: 0.5 },
            },
          },
          { type: 'div', props: { style: { width: 40, fontSize: 15, fontWeight: 700, color: '#6B7280', zIndex: 1 }, children: `${idx + 1}` } },
          {
            type: 'div',
            props: {
              style: { flex: 1, display: 'flex', flexDirection: 'column' as const, zIndex: 1 },
              children: [
                { type: 'div', props: { style: { fontSize: 15, fontWeight: 800, color: '#065F46' }, children: stock.symbol } },
              ],
            },
          },
          { type: 'div', props: { style: { width: 110, fontSize: 14, fontWeight: 600, color: '#374151', textAlign: 'right' as const, zIndex: 1 }, children: stock.closePrice.toFixed(2) } },
          { type: 'div', props: { style: { width: 100, fontSize: 14, fontWeight: 800, color: '#059669', textAlign: 'right' as const, zIndex: 1 }, children: `+${stock.change.toFixed(2)}` } },
          {
            type: 'div',
            props: {
              style: { width: 90, display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', zIndex: 1, gap: 2 },
              children: [
                { type: 'div', props: { style: { fontSize: 14, fontWeight: 800, color: '#059669' }, children: `+${stock.changePercent.toFixed(2)}%` } },
                { type: 'div', props: { style: { display: 'flex', width: 50, height: 4, backgroundColor: '#D1FAE5', borderRadius: 2, overflow: 'hidden' }, children: [
                  { type: 'div', props: { style: { width: `${barWidth}%`, height: '100%', backgroundColor: '#059669', borderRadius: 2 } } },
                ] } },
              ],
            },
          },
        ],
      },
    };
  });

  return satoriWithValidation(
    {
      type: 'div',
      props: {
        style: {
          width: WIDTH, height: HEIGHT,
          background: 'linear-gradient(180deg, #ECFDF5 0%, #F8FAFC 30%, #ffffff 100%)',
          position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column' as const,
        },
        children: [
          { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: '#059669' } } },
          { type: 'div', props: { style: { position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: '#D1FAE5', opacity: 0.4 } } },
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', paddingTop: 42, paddingBottom: 5 },
              children: [
                { type: 'div', props: { style: { fontSize: 36, fontWeight: 900, color: '#065F46', letterSpacing: '0.08em' }, children: 'TOP 10 GAINERS' } },
                { type: 'div', props: { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, backgroundColor: '#059669', padding: '6px 20px', borderRadius: 20 }, children: [
                  { type: 'div', props: { style: { fontSize: 16, color: '#ffffff', fontWeight: 700 }, children: '\u25B2 Bullish Session' } },
                ] } },
                { type: 'div', props: { style: { fontSize: 14, color: '#64748B', marginTop: 6, fontWeight: 500 }, children: formattedDate } },
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, width: WIDTH, padding: '0px 40px', gap: 0, marginTop: 16, borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #BBF7D0' },
              children: [headerRow, ...dataRows],
            },
          },
          brandedFooter('#059669'),
        ],
      },
    },
    { width: WIDTH, height: HEIGHT, fonts }, 'TopGainers',
  );
}

// ---- Template 3: BRIGHT Top 10 Losers ----
async function renderLosersSvg(losers: StockData[], dateStr: string, fonts: Array<{ name: string; data: ArrayBuffer; weight: number; style: string }>): Promise<string> {
  const formattedDate = formatDateShort(dateStr);
  const accent = '#DC2626';
  const accentLight = '#FEE2E2';

  const headerRow = {
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'row' as const, width: '100%', backgroundColor: '#DC2626', padding: '12px 16px', borderTopLeftRadius: 16, borderTopRightRadius: 16, alignItems: 'center' },
      children: [
        { type: 'div', props: { style: { width: 40, fontSize: 15, fontWeight: 700, color: '#ffffff' }, children: '#' } },
        { type: 'div', props: { style: { flex: 1, fontSize: 15, fontWeight: 700, color: '#ffffff' }, children: 'STOCK' } },
        { type: 'div', props: { style: { width: 110, fontSize: 15, fontWeight: 700, color: '#ffffff', textAlign: 'right' as const }, children: 'LTP' } },
        { type: 'div', props: { style: { width: 100, fontSize: 15, fontWeight: 700, color: '#ffffff', textAlign: 'right' as const }, children: 'CHANGE' } },
        { type: 'div', props: { style: { width: 90, fontSize: 15, fontWeight: 700, color: '#ffffff', textAlign: 'right' as const }, children: '% CHG' } },
      ],
    },
  };

  const dataRows = losers.map((stock, idx) => {
    const barWidth = Math.min(Math.abs(stock.changePercent) * 6, 100);
    return {
      type: 'div',
      props: {
        style: { display: 'flex', flexDirection: 'row' as const, width: '100%', backgroundColor: idx % 2 === 0 ? '#FEF2F2' : '#ffffff', padding: '10px 16px', alignItems: 'center', position: 'relative' as const, overflow: 'hidden' },
        children: [
          {
            type: 'div',
            props: {
              style: { position: 'absolute' as const, right: 0, top: 0, bottom: 0, width: `${barWidth}%`, backgroundColor: '#FECACA', opacity: 0.5 },
            },
          },
          { type: 'div', props: { style: { width: 40, fontSize: 15, fontWeight: 700, color: '#6B7280', zIndex: 1 }, children: `${idx + 1}` } },
          {
            type: 'div',
            props: {
              style: { flex: 1, display: 'flex', flexDirection: 'column' as const, zIndex: 1 },
              children: [
                { type: 'div', props: { style: { fontSize: 15, fontWeight: 800, color: '#991B1B' }, children: stock.symbol } },
              ],
            },
          },
          { type: 'div', props: { style: { width: 110, fontSize: 14, fontWeight: 600, color: '#374151', textAlign: 'right' as const, zIndex: 1 }, children: stock.closePrice.toFixed(2) } },
          { type: 'div', props: { style: { width: 100, fontSize: 14, fontWeight: 800, color: '#DC2626', textAlign: 'right' as const, zIndex: 1 }, children: stock.change.toFixed(2) } },
          {
            type: 'div',
            props: {
              style: { width: 90, display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', zIndex: 1, gap: 2 },
              children: [
                { type: 'div', props: { style: { fontSize: 14, fontWeight: 800, color: '#DC2626' }, children: `${stock.changePercent.toFixed(2)}%` } },
                { type: 'div', props: { style: { display: 'flex', width: 50, height: 4, backgroundColor: '#FEE2E2', borderRadius: 2, overflow: 'hidden' }, children: [
                  { type: 'div', props: { style: { width: `${barWidth}%`, height: '100%', backgroundColor: '#DC2626', borderRadius: 2 } } },
                ] } },
              ],
            },
          },
        ],
      },
    };
  });

  return satoriWithValidation(
    {
      type: 'div',
      props: {
        style: {
          width: WIDTH, height: HEIGHT,
          background: 'linear-gradient(180deg, #FEF2F2 0%, #F8FAFC 30%, #ffffff 100%)',
          position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column' as const,
        },
        children: [
          { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: '#DC2626' } } },
          { type: 'div', props: { style: { position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: '#FEE2E2', opacity: 0.4 } } },
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', paddingTop: 42, paddingBottom: 5 },
              children: [
                { type: 'div', props: { style: { fontSize: 36, fontWeight: 900, color: '#991B1B', letterSpacing: '0.08em' }, children: 'TOP 10 LOSERS' } },
                { type: 'div', props: { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, backgroundColor: '#DC2626', padding: '6px 20px', borderRadius: 20 }, children: [
                  { type: 'div', props: { style: { fontSize: 16, color: '#ffffff', fontWeight: 700 }, children: '\u25BC Bearish Session' } },
                ] } },
                { type: 'div', props: { style: { fontSize: 14, color: '#64748B', marginTop: 6, fontWeight: 500 }, children: formattedDate } },
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, width: WIDTH, padding: '0px 40px', gap: 0, marginTop: 16, borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #FECACA' },
              children: [headerRow, ...dataRows],
            },
          },
          brandedFooter('#DC2626'),
        ],
      },
    },
    { width: WIDTH, height: HEIGHT, fonts }, 'TopLosers',
  );
}

// ---- Template 4: BRIGHT Individual Stock Card ----
async function renderStockCardSvg(
  stock: StockData,
  dateStr: string,
  type: 'gainer' | 'loser',
  rank: number,
  fonts: Array<{ name: string; data: ArrayBuffer; weight: number; style: string }>,
): Promise<string> {
  const isGainer = type === 'gainer';
  const primary = '#1E3A5F'; // Deep navy blue
  const primaryLight = '#2B5797'; // Medium blue
  const greenAccent = '#16A34A'; // Bright green for positive
  const greenBg = '#ECFDF5';
  const redAccent = '#DC2626'; // Bright red for negative
  const label = isGainer ? 'TOP GAINER' : 'TOP LOSER';
  const sign = isGainer ? '+' : '';
  const changeColor = isGainer ? greenAccent : redAccent;
  const changeBg = isGainer ? greenBg : '#FEF2F2';

  const formattedDate = formatDateShort(dateStr);
  const d = formattedDate.toUpperCase();
  const changeAbs = Math.abs(stock.change);
  const changePercentAbs = Math.abs(stock.changePercent);

  return satoriWithValidation(
    {
      type: 'div',
      props: {
        style: {
          width: WIDTH, height: HEIGHT,
          background: 'linear-gradient(180deg, #F8FAFC 0%, #EDF2F7 50%, #E2E8F0 100%)',
          position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column' as const,
        },
        children: [
          // Subtle upward arrow decoration in background
          { type: 'div', props: { style: { position: 'absolute', top: 100, right: 40, width: 200, height: 200, borderRadius: 100, backgroundColor: '#CBD5E1', opacity: 0.15 } } },
          { type: 'div', props: { style: { position: 'absolute', bottom: 120, left: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: '#CBD5E1', opacity: 0.12 } } },

          // Blue header banner
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'row' as const, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: primary, padding: '22px 30px' },
              children: [
                { type: 'div', props: { style: { fontSize: 28, fontWeight: 800, color: '#ffffff' }, children: '\uD83D\uDCC8' } },
                { type: 'div', props: { style: { fontSize: 18, fontWeight: 900, color: '#ffffff', letterSpacing: '0.12em' }, children: `AS OF ${d}` } },
                { type: 'div', props: { style: { width: 2, height: 22, backgroundColor: '#ffffff44' } } },
                { type: 'div', props: { style: { fontSize: 18, fontWeight: 900, color: '#ffffff', letterSpacing: '0.12em' }, children: 'SHARE PRICE' } },
              ],
            },
          },

          // Rank badge
          {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
              children: {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'row' as const, alignItems: 'center', gap: 8, backgroundColor: primaryLight, padding: '8px 28px', borderRadius: 30 },
                  children: [
                    { type: 'div', props: { style: { fontSize: 18, fontWeight: 900, color: '#ffffff', letterSpacing: '0.1em' }, children: `${label}  #${rank}` } },
                  ],
                },
              },
            },
          },

          // Company name card
          {
            type: 'div',
            props: {
              style: {
                display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
                margin: '22px 50px 0px', padding: '22px 28px',
                backgroundColor: '#ffffff', borderRadius: 20,
                boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
                border: `2px solid ${primaryLight}22`,
              },
              children: [
                { type: 'div', props: { style: { fontSize: 26, fontWeight: 900, color: primary, letterSpacing: '0.04em', textTransform: 'uppercase' as const, textAlign: 'center' as const, lineHeight: 1.3 }, children: `${stock.name}` } },
                { type: 'div', props: { style: { fontSize: 22, fontWeight: 800, color: primaryLight, marginTop: 6 }, children: `(${stock.symbol})` } },
              ],
            },
          },

          // LTP display
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', marginTop: 24 },
              children: [
                { type: 'div', props: { style: { fontSize: 13, fontWeight: 700, color: '#64748B', letterSpacing: '0.12em', textTransform: 'uppercase' as const }, children: 'LAST TRADED PRICE' } },
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', flexDirection: 'row' as const, alignItems: 'baseline', gap: 6, marginTop: 6 },
                    children: [
                      { type: 'div', props: { style: { fontSize: 24, fontWeight: 600, color: '#64748B' }, children: 'Rs.' } },
                      { type: 'div', props: { style: { fontSize: 54, fontWeight: 900, color: primary, lineHeight: 1 }, children: stock.closePrice.toFixed(2) } },
                    ],
                  },
                },
              ],
            },
          },

          // 2x2 data metrics grid
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, width: WIDTH, padding: '0px 50px', gap: 14, marginTop: 24 },
              children: [
                // Row 1: % Change + Point Change
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', flexDirection: 'row' as const, width: '100%', gap: 14 },
                    children: [
                      // % Change
                      {
                        type: 'div',
                        props: {
                          style: { flex: 1, display: 'flex', flexDirection: 'column' as const, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' },
                          children: [
                            { type: 'div', props: { style: { fontSize: 11, fontWeight: 700, color: '#ffffff', backgroundColor: changeColor, padding: '8px 14px', letterSpacing: '0.1em' }, children: '% CHANGE' } },
                            { type: 'div', props: { style: { fontSize: 26, fontWeight: 900, color: changeColor, backgroundColor: '#ffffff', padding: '14px 14px' }, children: `${sign}${changePercentAbs.toFixed(2)}%` } },
                          ],
                        },
                      },
                      // Point Change
                      {
                        type: 'div',
                        props: {
                          style: { flex: 1, display: 'flex', flexDirection: 'column' as const, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' },
                          children: [
                            { type: 'div', props: { style: { fontSize: 11, fontWeight: 700, color: '#ffffff', backgroundColor: primaryLight, padding: '8px 14px', letterSpacing: '0.1em' }, children: 'POINT CHANGE' } },
                            { type: 'div', props: { style: { fontSize: 26, fontWeight: 900, color: primary, backgroundColor: '#ffffff', padding: '14px 14px' }, children: `Rs. ${sign}${changeAbs.toFixed(2)}` } },
                          ],
                        },
                      },
                    ],
                  },
                },
                // Row 2: Previous Close + Rank
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', flexDirection: 'row' as const, width: '100%', gap: 14 },
                    children: [
                      // Previous Close
                      {
                        type: 'div',
                        props: {
                          style: { flex: 1, display: 'flex', flexDirection: 'column' as const, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' },
                          children: [
                            { type: 'div', props: { style: { fontSize: 11, fontWeight: 700, color: '#ffffff', backgroundColor: '#D97706', padding: '8px 14px', letterSpacing: '0.1em' }, children: 'PREV. DAY CLOSE' } },
                            { type: 'div', props: { style: { fontSize: 26, fontWeight: 900, color: '#92400E', backgroundColor: '#ffffff', padding: '14px 14px' }, children: `Rs. ${stock.previousClose.toFixed(2)}` } },
                          ],
                        },
                      },
                      // Rank
                      {
                        type: 'div',
                        props: {
                          style: { flex: 1, display: 'flex', flexDirection: 'column' as const, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' },
                          children: [
                            { type: 'div', props: { style: { fontSize: 11, fontWeight: 700, color: '#ffffff', backgroundColor: '#64748B', padding: '8px 14px', letterSpacing: '0.1em' }, children: `${label} RANK` } },
                            { type: 'div', props: { style: { fontSize: 30, fontWeight: 900, color: primary, backgroundColor: '#ffffff', padding: '14px 14px' }, children: `#${rank}` } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          brandedFooter(primary),
        ],
      },
    },
    { width: WIDTH, height: HEIGHT, fonts }, 'StockCard',
  );
}

// ---- Satori Tree Validator (diagnostic) ----
// Satori v0.26+ requires display on ANY div with non-string children
// (empty array [], single-object, or multi-element array all need display:flex)
function validateSatoriTree(node: any, path = 'root'): string[] {
  const errors: string[] = [];
  if (!node || typeof node !== 'object') return errors;

  if (Array.isArray(node)) {
    node.forEach((child, i) => errors.push(...validateSatoriTree(child, `${path}[${i}]`)));
    return errors;
  }

  const tag = node.type || '?';
  const children = node.props?.children;
  const style = node.props?.style || {};
  const hasDisplay = 'display' in style;

  // Label for diagnostics
  let label = tag;
  if (typeof children === 'string') label = `${tag} "${children.substring(0, 40)}"`;

  // Satori v0.26 rule: if children is anything other than undefined or a string,
  // the parent div MUST have explicit display
  if (tag === 'div' && children !== undefined && typeof children !== 'string' && !hasDisplay) {
    const childDesc = Array.isArray(children)
      ? `array[${children.length}]`
      : 'object';
    errors.push(
      `❌ ${path} → <${label}> has ${childDesc} children but NO display.\n` +
      `   Style: {${Object.keys(style).join(', ')}}`
    );
  }

  // Recurse
  if (Array.isArray(children)) {
    children.forEach((child, i) => errors.push(...validateSatoriTree(child, `${path}/${tag}[${i}]`)));
  } else if (children && typeof children === 'object') {
    errors.push(...validateSatoriTree(children, `${path}/${tag}`));
  }

  return errors;
}

function satoriWithValidation(
  element: any,
  options: { width: number; height: number; fonts: any[] },
  templateName: string,
): Promise<string> {
  // Validate the tree first
  const errors = validateSatoriTree(element);
  if (errors.length > 0) {
    const msg = `Satori Tree Validation Errors in "${templateName}":\n\n${errors.join('\n\n')}`;
    console.error(msg);
    // Also make it available globally for debugging
    if (typeof window !== 'undefined') {
      (window as any).__satoriErrors = msg;
    }
    // Still try to render - the error from Satori will be more specific
  }
  return satori(element, options);
}

// ---- Public API ----
export interface ClientGeneratedImages {
  marketSummary: string;
  topGainers: string;
  topLosers: string;
  stockCards: Array<{
    type: 'gainer' | 'loser';
    rank: number;
    symbol: string;
    name: string;
    image: string;
  }>;
}

export async function generateImagesInBrowser(
  nepseData: NepseData,
  gainers: StockData[],
  losers: StockData[],
): Promise<ClientGeneratedImages> {
  const fonts = await loadFonts();

  const [svgSummary, svgGainers, svgLosers] = await Promise.all([
    renderMarketSummarySvg(nepseData, fonts),
    renderGainersSvg(gainers, nepseData.tradingDate, fonts),
    renderLosersSvg(losers, nepseData.tradingDate, fonts),
  ]);

  const [pngSummary, pngGainers, pngLosers] = await Promise.all([
    svgToPngBase64(svgSummary),
    svgToPngBase64(svgGainers),
    svgToPngBase64(svgLosers),
  ]);

  const stockCardPromises = [
    ...gainers.map((g, i) => renderStockCardSvg(g, nepseData.tradingDate, 'gainer', i + 1, fonts)),
    ...losers.map((l, i) => renderStockCardSvg(l, nepseData.tradingDate, 'loser', i + 1, fonts)),
  ];

  const stockCardSvgs = await Promise.all(stockCardPromises);
  const stockCardPngs = await Promise.all(stockCardSvgs.map(svg => svgToPngBase64(svg)));

  const stockCards = stockCardPngs.map((png, idx) => {
    const isGainer = idx < gainers.length;
    const stock = isGainer ? gainers[idx] : losers[idx - gainers.length];
    const rank = isGainer ? idx + 1 : idx - gainers.length + 1;
    return {
      type: (isGainer ? 'gainer' : 'loser') as 'gainer' | 'loser',
      rank,
      symbol: stock.symbol,
      name: stock.name,
      image: png,
    };
  });

  return {
    marketSummary: pngSummary,
    topGainers: pngGainers,
    topLosers: pngLosers,
    stockCards,
  };
}