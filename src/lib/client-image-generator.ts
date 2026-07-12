// Client-side image generation using Satori + browser Canvas API
// No WASM, no native addons — works everywhere

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

// SVG string → PNG base64 using browser Canvas
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

// ---- Date/Number formatting (client-side copies) ----
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

// ---- Shared Satori Elements ----
function logoWatermark() {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute', top: '50%', left: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: 'translate(-50%, -50%) scale(2.5)', opacity: 0.04,
      },
      children: {
        type: 'div',
        props: { style: { fontSize: 140, fontWeight: 900, color: '#ffffff', letterSpacing: '0.05em', textTransform: 'uppercase' as const }, children: 'SS' },
      },
    },
  };
}

function footerBar(theme: 'dark' | 'green' | 'red') {
  const bgColor = theme === 'green' ? '#166534' : theme === 'red' ? '#991B1B' : '#0F172A';
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 90,
        backgroundColor: bgColor, display: 'flex', flexDirection: 'column' as const,
        alignItems: 'center', justifyContent: 'center', gap: 4,
        borderTop: `1px solid ${theme === 'green' ? '#22C55E33' : theme === 'red' ? '#EF444433' : '#33415566'}`,
      },
      children: [
        { type: 'div', props: { style: { fontSize: 20, fontWeight: 800, color: '#ffffff', letterSpacing: '0.08em' }, children: 'SHARE SATHI' } },
        { type: 'div', props: { style: { fontSize: 13, color: '#ffffff88', letterSpacing: '0.05em' }, children: '#NEPSE #ShareSathi #NepalStockExchange #StockMarket' } },
      ],
    },
  };
}

// ---- Template 1: Market Summary ----
async function renderMarketSummarySvg(data: NepseData, fonts: Array<{ name: string; data: ArrayBuffer; weight: number; style: string }>): Promise<string> {
  const isUp = data.change >= 0;
  const arrow = isUp ? '\u25B2' : '\u25BC';
  const sign = isUp ? '+' : '';
  const color = isUp ? '#22C55E' : '#EF4444';
  const dateStr = formatDateForPost(data.tradingDate);
  const turnoverFormatted = formatNepaliAmount(data.turnover);
  const volumeFormatted = formatNepaliAmount(data.volume);

  const metrics = [
    { label: 'Turnover', value: `Rs. ${turnoverFormatted}`, color: '#3B82F6' },
    { label: 'Traded Shares', value: volumeFormatted, color: '#8B5CF6' },
    { label: 'Trades', value: data.trades.toLocaleString(), color: '#F59E0B' },
    { label: 'Advanced', value: data.gainers.toString(), color: '#22C55E' },
    { label: 'Declined', value: data.losers.toString(), color: '#EF4444' },
    { label: 'Unchanged', value: data.unchanged.toString(), color: '#3B82F6' },
  ];

  return satori(
    {
      type: 'div',
      props: {
        style: { width: WIDTH, height: HEIGHT, display: 'flex', flexDirection: 'column' as const, background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)', position: 'relative', overflow: 'hidden' },
        children: [
          logoWatermark(),
          { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: color } } },
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', paddingTop: 55, paddingBottom: 10 },
              children: [
                { type: 'div', props: { style: { fontSize: 44, fontWeight: 900, color: '#ffffff', letterSpacing: '0.12em', textTransform: 'uppercase' as const }, children: 'NEPSE TODAY' } },
                { type: 'div', props: { style: { fontSize: 22, color: '#ffffff99', marginTop: 8, fontWeight: 500 }, children: dateStr } },
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', paddingTop: 30, paddingBottom: 20 },
              children: [
                { type: 'div', props: { style: { fontSize: 96, fontWeight: 900, color: '#ffffff', lineHeight: 1 }, children: data.nepseIndex.toFixed(2) } },
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', flexDirection: 'row' as const, alignItems: 'center', gap: 16, marginTop: 16 },
                    children: [
                      { type: 'div', props: { style: { fontSize: 36, fontWeight: 700, color }, children: `${arrow} ${sign}${data.change.toFixed(2)}` } },
                      { type: 'div', props: { style: { fontSize: 30, fontWeight: 600, color, opacity: 0.85 }, children: `(${sign}${data.changePercentage.toFixed(2)}%)` } },
                    ],
                  },
                },
                { type: 'div', props: { style: { width: 300, height: 2, backgroundColor: '#334155', marginTop: 25, borderRadius: 1 } } },
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', width: WIDTH, padding: '0px 50px', gap: 12 },
              children: [0, 1, 2].map((row) => ({
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'row' as const, width: '100%', gap: 12 },
                  children: metrics.slice(row * 2, row * 2 + 2).map((m) => ({
                    type: 'div',
                    props: {
                      style: { flex: 1, display: 'flex', flexDirection: 'row' as const, alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1E293B99', borderRadius: 12, padding: '16px 22px', borderLeft: `4px solid ${m.color}` },
                      children: [
                        { type: 'div', props: { style: { fontSize: 20, color: '#ffffff99', fontWeight: 500 }, children: m.label } },
                        { type: 'div', props: { style: { fontSize: 24, color: '#ffffff', fontWeight: 700 }, children: m.value } },
                      ],
                    },
                  })),
                },
              })),
            },
          },
          footerBar('dark'),
        ],
      },
    },
    { width: WIDTH, height: HEIGHT, fonts },
  );
}

// ---- Template 2: Top 10 Gainers ----
async function renderGainersSvg(gainers: StockData[], dateStr: string, fonts: Array<{ name: string; data: ArrayBuffer; weight: number; style: string }>): Promise<string> {
  const formattedDate = formatDateForPost(dateStr);
  const headerRow = {
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'row' as const, width: '100%', backgroundColor: '#166534', padding: '14px 20px', borderTopLeftRadius: 12, borderTopRightRadius: 12 },
      children: [
        { type: 'div', props: { style: { width: 50, fontSize: 18, fontWeight: 700, color: '#ffffff' }, children: 'SN' } },
        { type: 'div', props: { style: { flex: 1, fontSize: 18, fontWeight: 700, color: '#ffffff' }, children: 'Symbol' } },
        { type: 'div', props: { style: { width: 140, fontSize: 18, fontWeight: 700, color: '#ffffff', textAlign: 'right' as const }, children: 'Close' } },
        { type: 'div', props: { style: { width: 120, fontSize: 18, fontWeight: 700, color: '#ffffff', textAlign: 'right' as const }, children: 'Change' } },
        { type: 'div', props: { style: { width: 120, fontSize: 18, fontWeight: 700, color: '#ffffff', textAlign: 'right' as const }, children: '% Chg' } },
      ],
    },
  };

  const dataRows = gainers.map((stock, idx) => ({
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'row' as const, width: '100%', backgroundColor: idx % 2 === 0 ? '#F0FDF4' : '#ffffff', padding: '13px 20px' },
      children: [
        { type: 'div', props: { style: { width: 50, fontSize: 17, fontWeight: 600, color: '#374151' }, children: (idx + 1).toString() } },
        { type: 'div', props: { style: { flex: 1, fontSize: 17, fontWeight: 700, color: '#166534' }, children: stock.symbol } },
        { type: 'div', props: { style: { width: 140, fontSize: 17, fontWeight: 500, color: '#374151', textAlign: 'right' as const }, children: stock.closePrice.toFixed(2) } },
        { type: 'div', props: { style: { width: 120, fontSize: 17, fontWeight: 700, color: '#166534', textAlign: 'right' as const }, children: `+${stock.change.toFixed(2)}` } },
        { type: 'div', props: { style: { width: 120, fontSize: 17, fontWeight: 700, color: '#166534', textAlign: 'right' as const }, children: `+${stock.changePercent.toFixed(2)}%` } },
      ],
    },
  }));

  return satori(
    {
      type: 'div',
      props: {
        style: { width: WIDTH, height: HEIGHT, display: 'flex', flexDirection: 'column' as const, background: 'linear-gradient(135deg, #052E16 0%, #14532D 40%, #052E16 100%)', position: 'relative', overflow: 'hidden' },
        children: [
          logoWatermark(),
          { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: '#22C55E' } } },
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', paddingTop: 50, paddingBottom: 10 },
              children: [
                { type: 'div', props: { style: { fontSize: 38, fontWeight: 900, color: '#ffffff', letterSpacing: '0.08em', textTransform: 'uppercase' as const }, children: "TODAY'S TOP 10 GAINERS" } },
                { type: 'div', props: { style: { fontSize: 22, color: '#ffffff88', marginTop: 8, fontWeight: 500 }, children: formattedDate } },
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 15, marginBottom: 20 },
              children: {
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'center', gap: 10, backgroundColor: '#22C55E22', padding: '8px 24px', borderRadius: 30, border: '1px solid #22C55E44' },
                  children: [
                    { type: 'div', props: { style: { fontSize: 26, color: '#22C55E', fontWeight: 700 }, children: '\u25B2' } },
                    { type: 'div', props: { style: { fontSize: 20, color: '#22C55E', fontWeight: 600 }, children: 'Bullish Session' } },
                  ],
                },
              },
            },
          },
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, width: WIDTH, padding: '0px 35px', gap: 0, borderRadius: 12, overflow: 'hidden', border: '1px solid #22C55E33' },
              children: [headerRow, ...dataRows],
            },
          },
          footerBar('green'),
        ],
      },
    },
    { width: WIDTH, height: HEIGHT, fonts },
  );
}

// ---- Template 3: Top 10 Losers ----
async function renderLosersSvg(losers: StockData[], dateStr: string, fonts: Array<{ name: string; data: ArrayBuffer; weight: number; style: string }>): Promise<string> {
  const formattedDate = formatDateForPost(dateStr);
  const headerRow = {
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'row' as const, width: '100%', backgroundColor: '#991B1B', padding: '14px 20px', borderTopLeftRadius: 12, borderTopRightRadius: 12 },
      children: [
        { type: 'div', props: { style: { width: 50, fontSize: 18, fontWeight: 700, color: '#ffffff' }, children: 'SN' } },
        { type: 'div', props: { style: { flex: 1, fontSize: 18, fontWeight: 700, color: '#ffffff' }, children: 'Symbol' } },
        { type: 'div', props: { style: { width: 140, fontSize: 18, fontWeight: 700, color: '#ffffff', textAlign: 'right' as const }, children: 'Close' } },
        { type: 'div', props: { style: { width: 120, fontSize: 18, fontWeight: 700, color: '#ffffff', textAlign: 'right' as const }, children: 'Change' } },
        { type: 'div', props: { style: { width: 120, fontSize: 18, fontWeight: 700, color: '#ffffff', textAlign: 'right' as const }, children: '% Chg' } },
      ],
    },
  };

  const dataRows = losers.map((stock, idx) => ({
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'row' as const, width: '100%', backgroundColor: idx % 2 === 0 ? '#FEF2F2' : '#ffffff', padding: '13px 20px' },
      children: [
        { type: 'div', props: { style: { width: 50, fontSize: 17, fontWeight: 600, color: '#374151' }, children: (idx + 1).toString() } },
        { type: 'div', props: { style: { flex: 1, fontSize: 17, fontWeight: 700, color: '#991B1B' }, children: stock.symbol } },
        { type: 'div', props: { style: { width: 140, fontSize: 17, fontWeight: 500, color: '#374151', textAlign: 'right' as const }, children: stock.closePrice.toFixed(2) } },
        { type: 'div', props: { style: { width: 120, fontSize: 17, fontWeight: 700, color: '#991B1B', textAlign: 'right' as const }, children: stock.change.toFixed(2) } },
        { type: 'div', props: { style: { width: 120, fontSize: 17, fontWeight: 700, color: '#991B1B', textAlign: 'right' as const }, children: `${stock.changePercent.toFixed(2)}%` } },
      ],
    },
  }));

  return satori(
    {
      type: 'div',
      props: {
        style: { width: WIDTH, height: HEIGHT, display: 'flex', flexDirection: 'column' as const, background: 'linear-gradient(135deg, #450A0A 0%, #7F1D1D 40%, #450A0A 100%)', position: 'relative', overflow: 'hidden' },
        children: [
          logoWatermark(),
          { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: '#EF4444' } } },
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', paddingTop: 50, paddingBottom: 10 },
              children: [
                { type: 'div', props: { style: { fontSize: 38, fontWeight: 900, color: '#ffffff', letterSpacing: '0.08em', textTransform: 'uppercase' as const }, children: "TODAY'S TOP 10 LOSERS" } },
                { type: 'div', props: { style: { fontSize: 22, color: '#ffffff88', marginTop: 8, fontWeight: 500 }, children: formattedDate } },
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 15, marginBottom: 20 },
              children: {
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'center', gap: 10, backgroundColor: '#EF444422', padding: '8px 24px', borderRadius: 30, border: '1px solid #EF444444' },
                  children: [
                    { type: 'div', props: { style: { fontSize: 26, color: '#EF4444', fontWeight: 700 }, children: '\u25BC' } },
                    { type: 'div', props: { style: { fontSize: 20, color: '#EF4444', fontWeight: 600 }, children: 'Bearish Session' } },
                  ],
                },
              },
            },
          },
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, width: WIDTH, padding: '0px 35px', gap: 0, borderRadius: 12, overflow: 'hidden', border: '1px solid #EF444433' },
              children: [headerRow, ...dataRows],
            },
          },
          footerBar('red'),
        ],
      },
    },
    { width: WIDTH, height: HEIGHT, fonts },
  );
}

// ---- Template 4: Individual Stock Card (big fonts, efficient, no wasted space) ----
function renderStockCardSvg(
  stock: StockData,
  dateStr: string,
  type: 'gainer' | 'loser',
  rank: number,
  fonts: Array<{ name: string; data: ArrayBuffer; weight: number; style: string }>,
): Promise<string> {
  const isGainer = type === 'gainer';
  const navBar = '#1E3A5F';
  const medBlue = '#2B5797';
  const changeColor = isGainer ? '#16A34A' : '#DC2626';
  const label = isGainer ? 'TOP GAINER' : 'TOP LOSER';
  const sign = isGainer ? '+' : '';
  const changeAbs = Math.abs(stock.change);
  const changePct = Math.abs(stock.changePercent);

  let d: string;
  try {
    const dt = new Date(dateStr + 'T00:00:00');
    d = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  } catch { d = dateStr.toUpperCase(); }

  return satori(
    {
      type: 'div',
      props: {
        style: {
          width: WIDTH, height: HEIGHT,
          background: 'linear-gradient(180deg, #F0F4F8 0%, #E2E8F0 100%)',
          position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column' as const,
        },
        children: [
          // Blue header bar
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'row' as const, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: navBar, padding: '28px 30px' },
              children: [
                { type: 'div', props: { style: { fontSize: 32, fontWeight: 800, color: '#ffffff' }, children: '\uD83D\uDCC8' } },
                { type: 'div', props: { style: { fontSize: 22, fontWeight: 900, color: '#ffffff', letterSpacing: '0.12em' }, children: `AS OF ${d}` } },
                { type: 'div', props: { style: { width: 2, height: 28, backgroundColor: '#ffffff55' } } },
                { type: 'div', props: { style: { fontSize: 22, fontWeight: 900, color: '#ffffff', letterSpacing: '0.12em' }, children: 'SHARE PRICE' } },
              ],
            },
          },
          // Rank badge
          {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 28 },
              children: {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'row' as const, alignItems: 'center', gap: 10, backgroundColor: medBlue, padding: '10px 32px', borderRadius: 30 },
                  children: [
                    { type: 'div', props: { style: { fontSize: 22, fontWeight: 900, color: '#ffffff', letterSpacing: '0.1em' }, children: `${label}  #${rank}` } },
                  ],
                },
              },
            },
          },
          // Company name
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', marginTop: 28, marginHorizontal: 50 },
              children: [
                { type: 'div', props: { style: { fontSize: 30, fontWeight: 900, color: navBar, letterSpacing: '0.04em', textTransform: 'uppercase' as const, textAlign: 'center' as const, lineHeight: 1.3 }, children: stock.name } },
                { type: 'div', props: { style: { fontSize: 26, fontWeight: 800, color: medBlue, marginTop: 6 }, children: `(${stock.symbol})` } },
              ],
            },
          },
          // LTP — large
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', marginTop: 32 },
              children: [
                { type: 'div', props: { style: { fontSize: 18, fontWeight: 700, color: '#64748B', letterSpacing: '0.12em' }, children: 'LAST TRADED PRICE' } },
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', flexDirection: 'row' as const, alignItems: 'baseline', gap: 8, marginTop: 8 },
                    children: [
                      { type: 'div', props: { style: { fontSize: 30, fontWeight: 600, color: '#64748B' }, children: 'Rs.' } },
                      { type: 'div', props: { style: { fontSize: 72, fontWeight: 900, color: navBar, lineHeight: 1 }, children: stock.closePrice.toFixed(2) } },
                    ],
                  },
                },
              ],
            },
          },
          // 2x2 metrics grid
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, width: WIDTH, padding: '0px 50px', gap: 16, marginTop: 36 },
              children: [
                // Row 1
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', flexDirection: 'row' as const, width: '100%', gap: 16 },
                    children: [
                      // % Change
                      {
                        type: 'div',
                        props: {
                          style: { flex: 1, display: 'flex', flexDirection: 'column' as const, borderRadius: 16, overflow: 'hidden' },
                          children: [
                            { type: 'div', props: { style: { fontSize: 16, fontWeight: 800, color: '#ffffff', backgroundColor: changeColor, padding: '12px 18px', letterSpacing: '0.1em' }, children: '% CHANGE' } },
                            { type: 'div', props: { style: { fontSize: 36, fontWeight: 900, color: changeColor, backgroundColor: '#ffffff', padding: '18px 18px' }, children: `${sign}${changePct.toFixed(2)}%` } },
                          ],
                        },
                      },
                      // Point Change
                      {
                        type: 'div',
                        props: {
                          style: { flex: 1, display: 'flex', flexDirection: 'column' as const, borderRadius: 16, overflow: 'hidden' },
                          children: [
                            { type: 'div', props: { style: { fontSize: 16, fontWeight: 800, color: '#ffffff', backgroundColor: medBlue, padding: '12px 18px', letterSpacing: '0.1em' }, children: 'POINT CHANGE' } },
                            { type: 'div', props: { style: { fontSize: 36, fontWeight: 900, color: navBar, backgroundColor: '#ffffff', padding: '18px 18px' }, children: `Rs. ${sign}${changeAbs.toFixed(2)}` } },
                          ],
                        },
                      },
                    ],
                  },
                },
                // Row 2
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', flexDirection: 'row' as const, width: '100%', gap: 16 },
                    children: [
                      // Previous Close
                      {
                        type: 'div',
                        props: {
                          style: { flex: 1, display: 'flex', flexDirection: 'column' as const, borderRadius: 16, overflow: 'hidden' },
                          children: [
                            { type: 'div', props: { style: { fontSize: 16, fontWeight: 800, color: '#ffffff', backgroundColor: '#D97706', padding: '12px 18px', letterSpacing: '0.1em' }, children: 'PREV. DAY CLOSE' } },
                            { type: 'div', props: { style: { fontSize: 36, fontWeight: 900, color: '#92400E', backgroundColor: '#ffffff', padding: '18px 18px' }, children: `Rs. ${stock.previousClose.toFixed(2)}` } },
                          ],
                        },
                      },
                      // Rank
                      {
                        type: 'div',
                        props: {
                          style: { flex: 1, display: 'flex', flexDirection: 'column' as const, borderRadius: 16, overflow: 'hidden' },
                          children: [
                            { type: 'div', props: { style: { fontSize: 16, fontWeight: 800, color: '#ffffff', backgroundColor: '#64748B', padding: '12px 18px', letterSpacing: '0.1em' }, children: `${label} RANK` } },
                            { type: 'div', props: { style: { fontSize: 40, fontWeight: 900, color: navBar, backgroundColor: '#ffffff', padding: '18px 18px' }, children: `#${rank}` } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          // Footer
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
                backgroundColor: navBar, display: 'flex', flexDirection: 'column' as const,
                alignItems: 'center', justifyContent: 'center', gap: 4,
              },
              children: [
                { type: 'div', props: { style: { fontSize: 24, fontWeight: 900, color: '#ffffff', letterSpacing: '0.1em' }, children: 'SHARE SATHI' } },
                { type: 'div', props: { style: { fontSize: 14, color: '#ffffff88', letterSpacing: '0.05em' }, children: '#NEPSE #ShareSathi #StockMarket #NepalStockExchange' } },
              ],
            },
          },
        ],
      },
    },
    { width: WIDTH, height: HEIGHT, fonts },
  );
}

// ---- Template 5: IPO Card (blue theme, matching stock card style) ----
export interface IpoCardData {
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
  isOpen: boolean;
  openedToday: boolean;
}

function isSameDay(dateStr: string): boolean {
  try {
    const d = new Date(dateStr + 'T00:00:00+05:45');
    const now = new Date();
    // Convert both to Nepal timezone for comparison
    const nepalOffset = 5 * 60 + 45; // +5:45
    const nowNepal = new Date(now.getTime() + (now.getTimezoneOffset() + nepalOffset) * 60000);
    return d.getUTCFullYear() === nowNepal.getUTCFullYear() &&
      d.getUTCMonth() === nowNepal.getUTCMonth() &&
      d.getUTCDate() === nowNepal.getUTCDate();
  } catch {
    return false;
  }
}

function getIpoDayNumber(ipo: IpoCardData): number {
  try {
    const now = new Date();
    const nepalDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kathmandu' }); // "2026-06-22"
    if (!ipo.openDate) return 0;
    const todayMs = new Date(nepalDateStr + 'T12:00:00').getTime();
    const openMs = new Date(ipo.openDate + 'T12:00:00').getTime();
    const diffDays = Math.round((todayMs - openMs) / (24 * 60 * 60 * 1000));
    return diffDays >= 0 ? diffDays + 1 : 0;
  } catch {
    return 0;
  }
}

function getIpoStatusLabel(ipo: IpoCardData, isLastDay: boolean): string {
  if (!ipo.isOpen) return 'CLOSED';
  if (isLastDay) return 'LAST DAY TO APPLY';
  const dayNum = getIpoDayNumber(ipo);
  if (dayNum === 1 || ipo.openedToday) return 'IPO OPENED TODAY';
  if (dayNum >= 2) {
    const ordinal = getOrdinal(dayNum);
    return `${ordinal} DAY FOR THIS IPO`;
  }
  return 'NOW OPEN';
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatIpoAmount(n: number): string {
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(2)} L`;
  return n.toLocaleString('en-US');
}

export async function generateIpoCardImage(
  ipo: IpoCardData,
  fonts: Array<{ name: string; data: ArrayBuffer; weight: number; style: string }>,
): Promise<string> {
  const navBar = '#1E3A5F';
  const medBlue = '#2B5797';
  const isOpen = ipo.isOpen;
  const isLastDay = isSameDay(ipo.closeDate);
  const statusColor = isOpen ? (isLastDay ? '#DC2626' : '#16A34A') : '#64748B';
  const statusLabel = getIpoStatusLabel(ipo, isLastDay);
  const statusEmoji = isOpen ? (isLastDay ? '\u26A0\uFE0F' : '\uD83D\uDCC8') : '\uD83D\uDD12';

  const hasSubscriptionData = ipo.numberOfApplications > 0 || ipo.appliedUnits > 0 || ipo.totalAmount > 0;

  // Build all available metrics based on data
  const metrics: Array<{ label: string; value: string; headerColor: string; valueColor: string }> = [];

  // Row 1: Issued Units + Price Per Unit (always shown)
  metrics.push({
    label: 'ISSUED UNITS',
    value: ipo.issuedUnits.toLocaleString(),
    headerColor: medBlue,
    valueColor: navBar,
  });
  metrics.push({
    label: 'PRICE PER UNIT',
    value: 'Rs. 100',
    headerColor: '#059669',
    valueColor: '#065F46',
  });

  // Row 2: Issue Manager (always shown)
  const mgrDisplay = ipo.issueManager.length > 26 ? ipo.issueManager.substring(0, 24) + '...' : ipo.issueManager;
  metrics.push({
    label: 'ISSUE MANAGER',
    value: mgrDisplay,
    headerColor: '#7C3AED',
    valueColor: '#5B21B6',
  });
  // Row 2 right: depends on status
  if (hasSubscriptionData) {
    metrics.push({
      label: 'APPLICATIONS',
      value: ipo.numberOfApplications.toLocaleString(),
      headerColor: '#0891B2',
      valueColor: '#155E75',
    });
  } else {
    metrics.push({
      label: 'IPO TYPE',
      value: ipo.ipoType.length > 24 ? ipo.ipoType.substring(0, 22) + '...' : ipo.ipoType,
      headerColor: '#64748B',
      valueColor: '#334155',
    });
  }

  // Row 3: subscription data (only when available)
  if (hasSubscriptionData) {
    metrics.push({
      label: 'APPLIED UNITS',
      value: ipo.appliedUnits.toLocaleString(),
      headerColor: '#0284C7',
      valueColor: '#0C4A6E',
    });
    metrics.push({
      label: 'TOTAL AMOUNT',
      value: `Rs. ${formatIpoAmount(ipo.totalAmount)}`,
      headerColor: '#D97706',
      valueColor: '#92400E',
    });
  }

  // Oversubscription — handled as a prominent banner below the grid (not in metrics)
  const showOversubBanner = hasSubscriptionData && ipo.oversubscription !== null && ipo.oversubscription > 0;

  // Build the metrics grid (2 columns)
  const metricRows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < metrics.length; i += 2) {
    const rowMetrics = metrics.slice(i, i + 2);
    metricRows.push({
      type: 'div',
      props: {
        style: { display: 'flex', flexDirection: 'row' as const, width: '100%', gap: 14 },
        children: rowMetrics.map((m) => ({
          type: 'div',
          props: {
            style: { flex: 1, display: 'flex', flexDirection: 'column' as const, borderRadius: 16, overflow: 'hidden' },
            children: [
              { type: 'div', props: { style: { fontSize: 16, fontWeight: 800, color: '#ffffff', backgroundColor: m.headerColor, padding: '10px 18px', letterSpacing: '0.1em' }, children: m.label } },
              { type: 'div', props: { style: { fontSize: m.value.length > 20 ? 26 : m.value.length > 14 ? 32 : 38, fontWeight: 900, color: m.valueColor, backgroundColor: '#ffffff', padding: '14px 18px' }, children: m.value } },
            ],
          },
        })),
      },
    });
  }

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: WIDTH, height: HEIGHT,
          background: 'linear-gradient(180deg, #F0F4F8 0%, #E2E8F0 100%)',
          position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column' as const,
        },
        children: [
          // Blue header bar
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'row' as const, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: navBar, padding: '22px 30px' },
              children: [
                { type: 'div', props: { style: { fontSize: 32, fontWeight: 800, color: '#ffffff' }, children: '\uD83D\uDCB5' } },
                { type: 'div', props: { style: { fontSize: 24, fontWeight: 900, color: '#ffffff', letterSpacing: '0.12em' }, children: 'IPO UPDATE' } },
                { type: 'div', props: { style: { width: 2, height: 28, backgroundColor: '#ffffff55' } } },
                { type: 'div', props: { style: { fontSize: 24, fontWeight: 900, color: '#ffffff', letterSpacing: '0.12em' }, children: 'NEPAL' } },
              ],
            },
          },
          // Status badge
          {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
              children: {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'row' as const, alignItems: 'center', gap: 10, backgroundColor: statusColor, padding: '10px 32px', borderRadius: 30 },
                  children: [
                    { type: 'div', props: { style: { fontSize: 22, fontWeight: 900, color: '#ffffff', letterSpacing: '0.1em' }, children: `${statusEmoji}  ${statusLabel}` } },
                  ],
                },
              },
            },
          },
          // Company name + symbol
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', marginTop: 16, marginHorizontal: 40 },
              children: [
                { type: 'div', props: { style: { fontSize: ipo.companyName.length > 30 ? 26 : 32, fontWeight: 900, color: navBar, letterSpacing: '0.04em', textTransform: 'uppercase' as const, textAlign: 'center' as const, lineHeight: 1.2 }, children: ipo.companyName } },
                ...(ipo.companySymbol ? [{ type: 'div', props: { style: { fontSize: 24, fontWeight: 800, color: medBlue, marginTop: 4 }, children: `(${ipo.companySymbol})` } }] : []),
              ],
            },
          },
          // Dates row
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'row' as const, alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 14, marginHorizontal: 40 },
              children: [
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center' },
                    children: [
                      { type: 'div', props: { style: { fontSize: 13, fontWeight: 700, color: '#64748B', letterSpacing: '0.1em' }, children: 'OPEN' } },
                      { type: 'div', props: { style: { fontSize: 19, fontWeight: 800, color: navBar, marginTop: 2 }, children: formatDateShort(ipo.openDate) } },
                    ],
                  },
                },
                { type: 'div', props: { style: { width: 2, height: 34, backgroundColor: '#CBD5E1' } } },
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center' },
                    children: [
                      { type: 'div', props: { style: { fontSize: 13, fontWeight: 700, color: '#64748B', letterSpacing: '0.1em' }, children: 'CLOSE' } },
                      { type: 'div', props: { style: { fontSize: 19, fontWeight: 800, color: navBar, marginTop: 2 }, children: formatDateShort(ipo.closeDate) } },
                    ],
                  },
                },
                ...(ipo.lastUpdate ? [
                  { type: 'div', props: { style: { width: 2, height: 34, backgroundColor: '#CBD5E1' } } },
                  {
                    type: 'div',
                    props: {
                      style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center' },
                      children: [
                        { type: 'div', props: { style: { fontSize: 13, fontWeight: 700, color: '#64748B', letterSpacing: '0.1em' }, children: 'UPDATED' } },
                        { type: 'div', props: { style: { fontSize: 14, fontWeight: 700, color: '#64748B', marginTop: 2 }, children: ipo.lastUpdate.length > 16 ? ipo.lastUpdate.substring(0, 16) : ipo.lastUpdate } },
                      ],
                    },
                  },
                ] : []),
              ],
            },
          },
          // Metrics grid
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, width: WIDTH, padding: '0px 40px', gap: 12, marginTop: 18 },
              children: metricRows,
            },
          },
          // Oversubscription banner — prominent full-width callout
          ...(showOversubBanner ? [
            {
              type: 'div' as const,
              props: {
                style: {
                  display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
                  marginHorizontal: 40, marginTop: 14, padding: '16px 20px', borderRadius: 16,
                  backgroundColor: (() => {
                    const v = ipo.oversubscription!;
                    if (v >= 10) return '#FEF2F2';
                    if (v >= 3) return '#FFFBEB';
                    return '#F0FDF4';
                  })(),
                  border: `3px solid ${(() => {
                    const v = ipo.oversubscription!;
                    if (v >= 10) return '#DC2626';
                    if (v >= 3) return '#D97706';
                    return '#16A34A';
                  })()}`,
                },
                children: [
                  {
                    type: 'div' as const,
                    props: {
                      style: {
                        fontSize: 20, fontWeight: 800, letterSpacing: '0.12em',
                        color: (() => {
                          const v = ipo.oversubscription!;
                          if (v >= 10) return '#DC2626';
                          if (v >= 3) return '#D97706';
                          return '#16A34A';
                        })(),
                      },
                      children: 'OVERSUBSCRIBED',
                    },
                  },
                  {
                    type: 'div' as const,
                    props: {
                      style: {
                        fontSize: ipo.oversubscription! >= 10 ? 44 : ipo.oversubscription! >= 3 ? 40 : 36,
                        fontWeight: 900, color: '#1E293B', marginTop: 4,
                      },
                      children: `by ${ipo.oversubscription!.toFixed(2)} times`,
                    },
                  },
                ],
              },
            },
          ] : []),
          // Footer
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute', bottom: 0, left: 0, right: 0, height: 72,
                backgroundColor: navBar, display: 'flex', flexDirection: 'column' as const,
                alignItems: 'center', justifyContent: 'center', gap: 3,
              },
              children: [
                { type: 'div', props: { style: { fontSize: 24, fontWeight: 900, color: '#ffffff', letterSpacing: '0.1em' }, children: 'SHARE SATHI' } },
                { type: 'div', props: { style: { fontSize: 13, color: '#ffffff88', letterSpacing: '0.05em' }, children: '#NEPSE #ShareSathi #IPO #NepalIPO #StockMarket' } },
              ],
            },
          },
        ],
      },
    },
    { width: WIDTH, height: HEIGHT, fonts },
  );

  return svgToPngBase64(svg);
}

// ---- Public API ----
export interface ClientGeneratedImages {
  marketSummary: string; // data:image/png;base64,...
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

  // Generate individual stock cards for top 10 gainers + top 10 losers
  const top10Gainers = gainers.slice(0, 10);
  const top10Losers = losers.slice(0, 10);

  const cardPromises = [
    ...top10Gainers.map((s, i) =>
      renderStockCardSvg(s, nepseData.tradingDate, 'gainer', i + 1, fonts).then((svg) =>
        svgToPngBase64(svg).then((img) => ({
          type: 'gainer' as const, rank: i + 1, symbol: s.symbol, name: s.name, image: img,
        }))
      )
    ),
    ...top10Losers.map((s, i) =>
      renderStockCardSvg(s, nepseData.tradingDate, 'loser', i + 1, fonts).then((svg) =>
        svgToPngBase64(svg).then((img) => ({
          type: 'loser' as const, rank: i + 1, symbol: s.symbol, name: s.name, image: img,
        }))
      )
    ),
  ];

  const stockCards = await Promise.all(cardPromises);

  return {
    marketSummary: pngSummary,
    topGainers: pngGainers,
    topLosers: pngLosers,
    stockCards,
  };
}

// ---- Story image generation (1080x1920 portrait) ----

const STORY_W = 1080;
const STORY_H = 1920;

function svgToPngBase64Story(svg: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = STORY_W;
    canvas.height = STORY_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('Canvas not supported')); return; }

    const img = new Image();
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, STORY_W, STORY_H);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to render Story SVG to canvas'));
    };
    img.src = url;
  });
}

export async function generateIpoStoryImage(
  ipo: IpoCardData,
  fonts: Array<{ name: string; data: ArrayBuffer; weight: number; style: string }>,
): Promise<string> {
  const navBar = '#1E3A5F';
  const medBlue = '#2B5797';
  const isOpen = ipo.isOpen;
  const openedToday = ipo.openedToday;
  const isLastDay = isSameDay(ipo.closeDate);
  const statusColor = isOpen ? (isLastDay ? '#DC2626' : '#16A34A') : '#64748B';
  const statusLabel = getIpoStatusLabel(ipo, isLastDay);
  const statusEmoji = isOpen ? (isLastDay ? '\u26A0\uFE0F' : '\uD83D\uDCC8') : '\uD83D\uDD12';

  const hasSubscriptionData = ipo.numberOfApplications > 0 || ipo.appliedUnits > 0 || ipo.totalAmount > 0;
  const showOversubBanner = hasSubscriptionData && ipo.oversubscription !== null && ipo.oversubscription > 0;

  // Build vertical metric items (full-width in portrait)
  const metricItems: Array<Record<string, unknown>> = [
    {
      type: 'div' as const,
      props: {
        style: { display: 'flex', flexDirection: 'row' as const, justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 14, padding: '16px 22px', borderLeft: `5px solid ${medBlue}` },
        children: [
          { type: 'div' as const, props: { style: { fontSize: 18, fontWeight: 700, color: '#64748B', letterSpacing: '0.08em' }, children: 'ISSUED UNITS' } },
          { type: 'div' as const, props: { style: { fontSize: 28, fontWeight: 900, color: navBar }, children: ipo.issuedUnits.toLocaleString() } },
        ],
      },
    },
    {
      type: 'div' as const,
      props: {
        style: { display: 'flex', flexDirection: 'row' as const, justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 14, padding: '16px 22px', borderLeft: `5px solid #059669` },
        children: [
          { type: 'div' as const, props: { style: { fontSize: 18, fontWeight: 700, color: '#64748B', letterSpacing: '0.08em' }, children: 'PRICE PER UNIT' } },
          { type: 'div' as const, props: { style: { fontSize: 28, fontWeight: 900, color: '#065F46' }, children: 'Rs. 100' } },
        ],
      },
    },
    {
      type: 'div' as const,
      props: {
        style: { display: 'flex', flexDirection: 'row' as const, justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 14, padding: '16px 22px', borderLeft: `5px solid #7C3AED` },
        children: [
          { type: 'div' as const, props: { style: { fontSize: 18, fontWeight: 700, color: '#64748B', letterSpacing: '0.08em' }, children: 'ISSUE MANAGER' } },
          { type: 'div' as const, props: { style: { fontSize: 22, fontWeight: 800, color: '#5B21B6' }, children: ipo.issueManager.length > 28 ? ipo.issueManager.substring(0, 26) + '...' : ipo.issueManager } },
        ],
      },
    },
  ];

  if (hasSubscriptionData) {
    metricItems.push({
      type: 'div' as const,
      props: {
        style: { display: 'flex', flexDirection: 'row' as const, justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 14, padding: '16px 22px', borderLeft: `5px solid #0891B2` },
        children: [
          { type: 'div' as const, props: { style: { fontSize: 18, fontWeight: 700, color: '#64748B', letterSpacing: '0.08em' }, children: 'APPLICATIONS' } },
          { type: 'div' as const, props: { style: { fontSize: 28, fontWeight: 900, color: '#155E75' }, children: ipo.numberOfApplications.toLocaleString() } },
        ],
      },
    });
    metricItems.push({
      type: 'div' as const,
      props: {
        style: { display: 'flex', flexDirection: 'row' as const, justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 14, padding: '16px 22px', borderLeft: `5px solid #D97706` },
        children: [
          { type: 'div' as const, props: { style: { fontSize: 18, fontWeight: 700, color: '#64748B', letterSpacing: '0.08em' }, children: 'TOTAL AMOUNT' } },
          { type: 'div' as const, props: { style: { fontSize: 28, fontWeight: 900, color: '#92400E' }, children: `Rs. ${formatIpoAmount(ipo.totalAmount)}` } },
        ],
      },
    });
  }

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: STORY_W, height: STORY_H,
          background: 'linear-gradient(180deg, #1E3A5F 0%, #0F2844 40%, #1E3A5F 100%)',
          position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column' as const,
        },
        children: [
          // Top spacer for FB story UI
          { type: 'div', props: { style: { height: 180 } } },
          // Status badge
          {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
              children: {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'row' as const, alignItems: 'center', gap: 12, backgroundColor: statusColor, padding: '14px 40px', borderRadius: 40 },
                  children: [
                    { type: 'div', props: { style: { fontSize: 28, fontWeight: 900, color: '#ffffff', letterSpacing: '0.1em' }, children: `${statusEmoji}  ${statusLabel}` } },
                  ],
                },
              },
            },
          },
          // Company name + symbol
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', marginTop: 30, marginHorizontal: 50 },
              children: [
                { type: 'div', props: { style: { fontSize: ipo.companyName.length > 30 ? 36 : 42, fontWeight: 900, color: '#ffffff', letterSpacing: '0.04em', textTransform: 'uppercase' as const, textAlign: 'center' as const, lineHeight: 1.2 }, children: ipo.companyName } },
                ...(ipo.companySymbol ? [{ type: 'div', props: { style: { fontSize: 28, fontWeight: 800, color: '#93C5FD', marginTop: 8 }, children: `(${ipo.companySymbol})` } }] : []),
              ],
            },
          },
          // IPO type
          { type: 'div', props: { style: { fontSize: 22, fontWeight: 700, color: '#ffffff88', textAlign: 'center' as const, marginTop: 8 }, children: ipo.ipoType } },
          // Dates
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'row' as const, alignItems: 'center', justifyContent: 'center', gap: 28, marginTop: 28, marginHorizontal: 60 },
              children: [
                {
                  type: 'div' as const,
                  props: {
                    style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center' },
                    children: [
                      { type: 'div' as const, props: { style: { fontSize: 14, fontWeight: 700, color: '#ffffff66', letterSpacing: '0.1em' }, children: 'OPEN' } },
                      { type: 'div' as const, props: { style: { fontSize: 22, fontWeight: 800, color: '#ffffff', marginTop: 4 }, children: formatDateShort(ipo.openDate) } },
                    ],
                  },
                },
                { type: 'div' as const, props: { style: { width: 2, height: 40, backgroundColor: '#ffffff33' } } },
                {
                  type: 'div' as const,
                  props: {
                    style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center' },
                    children: [
                      { type: 'div' as const, props: { style: { fontSize: 14, fontWeight: 700, color: '#ffffff66', letterSpacing: '0.1em' }, children: 'CLOSE' } },
                      { type: 'div' as const, props: { style: { fontSize: 22, fontWeight: 900, color: isLastDay ? '#FCA5A5' : '#ffffff', marginTop: 4 }, children: formatDateShort(ipo.closeDate) } },
                    ],
                  },
                },
              ],
            },
          },
          // Metrics (vertical stack)
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' as const, width: STORY_W, padding: '0px 50px', gap: 14, marginTop: 36 },
              children: metricItems,
            },
          },
          // Oversubscription banner
          ...(showOversubBanner ? [
            {
              type: 'div' as const,
              props: {
                style: {
                  display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
                  marginHorizontal: 50, marginTop: 20, padding: '20px 24px', borderRadius: 18,
                  backgroundColor: (() => {
                    const v = ipo.oversubscription!;
                    if (v >= 10) return 'rgba(220,38,38,0.15)';
                    if (v >= 3) return 'rgba(217,119,6,0.15)';
                    return 'rgba(22,163,74,0.15)';
                  })(),
                  border: `3px solid ${(() => {
                    const v = ipo.oversubscription!;
                    if (v >= 10) return '#EF4444';
                    if (v >= 3) return '#F59E0B';
                    return '#22C55E';
                  })()}`,
                },
                children: [
                  {
                    type: 'div' as const,
                    props: {
                      style: { fontSize: 22, fontWeight: 800, letterSpacing: '0.12em', color: '#ffffff' },
                      children: 'OVERSUBSCRIBED',
                    },
                  },
                  {
                    type: 'div' as const,
                    props: {
                      style: {
                        fontSize: ipo.oversubscription! >= 10 ? 52 : ipo.oversubscription! >= 3 ? 46 : 40,
                        fontWeight: 900, color: '#ffffff', marginTop: 6,
                      },
                      children: `by ${ipo.oversubscription!.toFixed(2)} times`,
                    },
                  },
                ],
              },
            },
          ] : []),
          // Bottom CTA for open IPOs
          ...(isOpen ? [
            {
              type: 'div' as const,
              props: {
                style: {
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginHorizontal: 80, marginTop: 'auto', marginBottom: 120,
                  backgroundColor: '#ffffff', padding: '20px 40px', borderRadius: 40,
                },
                children: [
                  { type: 'div' as const, props: { style: { fontSize: 26, fontWeight: 900, color: navBar, letterSpacing: '0.06em' }, children: 'APPLY NOW' } },
                ],
              },
            },
          ] : []),
          // Bottom spacer for FB story UI
          { type: 'div', props: { style: { height: isOpen ? 0 : 160 } } },
          // Footer watermark
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute', bottom: 50, left: 0, right: 0,
                display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 4,
              },
              children: [
                { type: 'div', props: { style: { fontSize: 28, fontWeight: 900, color: '#ffffff55', letterSpacing: '0.12em' }, children: 'SHARE SATHI' } },
                { type: 'div', props: { style: { fontSize: 14, color: '#ffffff33', letterSpacing: '0.06em' }, children: '#NEPSE #ShareSathi #IPO #NepalIPO' } },
              ],
            },
          },
        ],
      },
    },
    { width: STORY_W, height: STORY_H, fonts },
  );

  return svgToPngBase64Story(svg);
}

/**
 * Generate a 1080x1920 Facebook Story from an existing 1080x1080 market image.
 * Wraps the square image in a portrait story frame with label and date.
 */
export async function generateMarketStoryFromImage(
  squareImageBase64: string,
  marketData: { tradingDate: string; nepseIndex: number; change: number; changePercentage: number },
  label: string,
  fonts: Array<{ name: string; data: ArrayBuffer; weight: number; style: string }>,
): Promise<string> {
  // Convert base64 to Image element
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = squareImageBase64;
  });

  // Create 1080x1920 canvas
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d')!;

  // Dark gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, 1920);
  grad.addColorStop(0, '#0F172A');
  grad.addColorStop(0.5, '#1E293B');
  grad.addColorStop(1, '#0F172A');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1920);

  // Draw the square image centered, with rounded corners effect
  const imgSize = 1000;
  const imgX = (1080 - imgSize) / 2;
  const imgY = 250;
  const radius = 24;

  // Clip rounded rect
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(imgX + radius, imgY);
  ctx.lineTo(imgX + imgSize - radius, imgY);
  ctx.quadraticCurveTo(imgX + imgSize, imgY, imgX + imgSize, imgY + radius);
  ctx.lineTo(imgX + imgSize, imgY + imgSize - radius);
  ctx.quadraticCurveTo(imgX + imgSize, imgY + imgSize, imgX + imgSize - radius, imgY + imgSize);
  ctx.lineTo(imgX + radius, imgY + imgSize);
  ctx.quadraticCurveTo(imgX, imgY + imgSize, imgX, imgY + imgSize - radius);
  ctx.lineTo(imgX, imgY + radius);
  ctx.quadraticCurveTo(imgX, imgY, imgX + radius, imgY);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, imgX, imgY, imgSize, imgSize);
  ctx.restore();

  // Label at top
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label.toUpperCase(), 540, 160);

  // Date below image
  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 32px Inter, sans-serif';
  ctx.fillText(marketData.tradingDate, 540, imgY + imgSize + 60);

  // Index info
  const isPositive = marketData.change >= 0;
  ctx.fillStyle = isPositive ? '#22C55E' : '#EF4444';
  ctx.font = 'bold 52px Inter, sans-serif';
  const changeStr = `${isPositive ? '+' : ''}${marketData.change.toFixed(2)} (${isPositive ? '+' : ''}${marketData.changePercentage.toFixed(2)}%)`;
  ctx.fillText(`${marketData.nepseIndex.toFixed(2)}  ${changeStr}`, 540, imgY + imgSize + 130);

  // Watermark at bottom
  ctx.fillStyle = '#ffffff33';
  ctx.font = '800 28px Inter, sans-serif';
  ctx.fillText('SHARE SATHI', 540, 1870);

  // Convert to base64 PNG
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Failed to create story image')); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }, 'image/png');
  });
}

// ---- IPO Result Card Image (1080x1080) ----
export async function generateIpoResultCardImage(
  ipo: IpoCardData,
  fonts: Array<{ name: string; data: ArrayBuffer; weight: number; style: string }>,
): Promise<string> {
  const gold = '#D97706';
  const darkGold = '#92400E';
  const white = '#FFFFFF';
  const lightBg = '#FFFBEB';
  const fmtAmt = (n: number) => formatIpoAmount(n);
  const mgrDisplay = ipo.issueManager.length > 28 ? ipo.issueManager.substring(0, 26) + '...' : ipo.issueManager;

  const statusLabel = 'IPO RESULT OUT';
  const sub = ipo.oversubscription;

  const metrics: Array<{ label: string; value: string; color: string }> = [];
  metrics.push({ label: 'ISSUED UNITS', value: ipo.issuedUnits.toLocaleString(), color: '#1E3A5F' });
  metrics.push({ label: 'APPLICATIONS', value: ipo.numberOfApplications > 0 ? ipo.numberOfApplications.toLocaleString() : 'N/A', color: '#7C3AED' });
  metrics.push({ label: 'APPLIED UNITS', value: ipo.appliedUnits > 0 ? fmtAmt(ipo.appliedUnits) : 'N/A', color: '#059669' });
  metrics.push({ label: 'TOTAL AMOUNT', value: ipo.totalAmount > 0 ? `Rs. ${fmtAmt(ipo.totalAmount)}` : 'N/A', color: '#DC2626' });
  if (sub !== null && sub > 0) {
    metrics.push({ label: 'OVERSUBSCRIPTION', value: `${sub.toFixed(2)}x Times`, color: '#EA580C' });
  }

  const jsx = {
    type: 'div' as const,
    props: {
      style: {
        width: '100%', height: '100%', padding: '60px', backgroundColor: lightBg,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden',
      },
      children: [
        // Top status bar
        {
          type: 'div' as const,
          props: {
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
            children: [
              { type: 'div' as const, props: { style: { display: 'flex', alignItems: 'center', gap: '10px' }, children: [
                { type: 'div' as const, props: { style: { width: '48px', height: '48px', borderRadius: '12px', backgroundColor: gold, display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: [
                  { type: 'div' as const, props: { style: { fontSize: '24px', color: white } , children: ['\uD83C\uDFC6'] } },
                ] } },
                { type: 'div' as const, props: { style: { fontSize: '18px', fontWeight: 800, color: darkGold, letterSpacing: '2px' }, children: [statusLabel] } },
              ] } },
              { type: 'div' as const, props: { style: { fontSize: '12px', color: '#78716C', fontWeight: 500 }, children: ['Share Sathi'] } },
            ],
          },
        },
        // Company name
        { type: 'div' as const, props: { style: { fontSize: '34px', fontWeight: 900, color: '#1C1917', lineHeight: 1.2, marginBottom: '4px' }, children: [ipo.companyName] } },
        { type: 'div' as const, props: { style: { fontSize: '16px', color: '#57534E', fontWeight: 600, marginBottom: '24px' }, children: [
          ipo.companySymbol ? `${ipo.companySymbol}  |  ${ipo.ipoType}` : ipo.ipoType,
        ] } },
        // Metrics grid
        {
          type: 'div' as const,
          props: {
            style: { display: 'grid', gridTemplateColumns: metrics.length >= 5 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' },
            children: metrics.map(m => ({
              type: 'div' as const,
              props: {
                style: { backgroundColor: white, borderRadius: '16px', padding: '20px', border: '1px solid #E7E5E4' },
                children: [
                  { type: 'div' as const, props: { style: { fontSize: '11px', fontWeight: 700, color: m.color, letterSpacing: '1px', marginBottom: '8px' }, children: [m.label] } },
                  { type: 'div' as const, props: { style: { fontSize: '22px', fontWeight: 800, color: '#1C1917' }, children: [m.value] } },
                ],
              },
            })),
          },
        },
        // Issue manager
        { type: 'div' as const, props: { style: { fontSize: '13px', color: '#78716C', marginBottom: '4px' }, children: [`Issue Manager: ${mgrDisplay}`] } },
        // Date range
        { type: 'div' as const, props: { style: { fontSize: '13px', color: '#78716C' }, children: [
          `${ipo.openDate ? formatDateShort(ipo.openDate) : '?'}  to  ${ipo.closeDate ? formatDateShort(ipo.closeDate) : '?'}`,
        ] } },
        // Watermark
        logoWatermark(),
      ],
    },
  };

  const svg = await satori(jsx, { width: WIDTH, height: HEIGHT, fonts });
  return svgToPngBase64(svg);
}

// ---- IPO Result Story Image (1080x1920) ----
export async function generateIpoResultStoryImage(
  ipo: IpoCardData,
  fonts: Array<{ name: string; data: ArrayBuffer; weight: number; style: string }>,
): Promise<string> {
  const cardImage = await generateIpoResultCardImage(ipo, fonts);
  const blob = await (await fetch(cardImage)).blob();
  const img = await createImageBitmap(blob);

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d')!;

  // Dark gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, 1920);
  grad.addColorStop(0, '#1C1917');
  grad.addColorStop(1, '#292524');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1920);

  // Title at top
  ctx.fillStyle = '#D97706';
  ctx.font = 'bold 36px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('IPO RESULT OUT', 540, 120);

  // Card image in center
  const imgSize = 920;
  const imgX = (1080 - imgSize) / 2;
  const imgY = 200;
  const radius = 24;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(imgX + radius, imgY);
  ctx.lineTo(imgX + imgSize - radius, imgY);
  ctx.quadraticCurveTo(imgX + imgSize, imgY, imgX + imgSize, imgY + radius);
  ctx.lineTo(imgX + imgSize, imgY + imgSize - radius);
  ctx.quadraticCurveTo(imgX + imgSize, imgY + imgSize, imgX + imgSize - radius, imgY + imgSize);
  ctx.lineTo(imgX + radius, imgY + imgSize);
  ctx.quadraticCurveTo(imgX, imgY + imgSize, imgX, imgY + imgSize - radius);
  ctx.lineTo(imgX, imgY + radius);
  ctx.quadraticCurveTo(imgX, imgY, imgX + radius, imgY);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, imgX, imgY, imgSize, imgSize);
  ctx.restore();

  // Watermark
  ctx.fillStyle = '#ffffff33';
  ctx.font = '800 28px Inter, sans-serif';
  ctx.fillText('SHARE SATHI', 540, 1870);

  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Failed to create result story image')); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }, 'image/png');
  });
}

// ---- News Card Image (1080x1080) ----
// Generates a professional news card with headline and optional AI summary

interface NewsCardData {
  headline: string;
  summary: string;
  source: string;
  category: string;
  publishedAt: string;
  language: string;
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars).trim() + '...';
}

function formatDateLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; accent: string }> = {
  market: { bg: '#F0F9FF', text: '#0369A1', accent: '#0284C7' },
  ipo: { bg: '#FFFBEB', text: '#92400E', accent: '#D97706' },
  company: { bg: '#FAF5FF', text: '#6B21A8', accent: '#7C3AED' },
  regulatory: { bg: '#FFF1F2', text: '#9F1239', accent: '#E11D48' },
  general: { bg: '#F9FAFB', text: '#374151', accent: '#6B7280' },
};

export async function generateNewsCardImage(
  news: NewsCardData,
  fonts: Array<{ name: string; data: ArrayBuffer; weight: number; style: string }>,
): Promise<string> {
  const catStyle = CATEGORY_STYLES[news.category] || CATEGORY_STYLES.general;
  const dateLabel = formatDateLabel(news.publishedAt);
  const sourceLabel = news.source === 'merolagani' ? 'Mero Lagani' :
    news.source === 'sharesansar' ? 'Share Sansar' :
    news.source === 'google_news' ? 'Google News' :
    news.source === 'myrepublica' ? 'My Republica' :
    news.source === 'sebon' ? 'SEBON' : news.source.charAt(0).toUpperCase() + news.source.slice(1);
  const langLabel = news.language === 'ne' ? 'NEPALI' : 'ENGLISH';

  // Word-wrap summary for Satori (it doesn't auto-wrap long text)
  const wrapText = (text: string, maxCharsPerLine: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length > maxCharsPerLine && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  // Truncate headline to fit (roughly 8-10 lines at 38px in 1080px width)
  const maxHeadlineChars = 120;
  const headlineText = truncateText(news.headline, maxHeadlineChars);
  const headlineLines = wrapText(headlineText, 32);

  // Truncate summary
  const hasSummary = news.summary && news.summary.trim().length > 0 &&
    !/^(merolagani|sharesansar|google_news|myrepublica)\s*[-–—]/i.test(news.summary) &&
    !news.summary.includes("for the latest");
  const maxSummaryChars = 300;
  const summaryText = hasSummary ? truncateText(news.summary, maxSummaryChars) : '';
  const summaryLines = hasSummary ? wrapText(summaryText, 48) : [];

  const jsx = {
    type: 'div' as const,
    props: {
      style: {
        width: '100%', height: '100%', padding: '60px', backgroundColor: '#FFFFFF',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden',
      },
      children: [
        // Top accent bar
        { type: 'div' as const, props: { style: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: catStyle.accent } } },
        // Header row: logo + source + date
        {
          type: 'div' as const,
          props: {
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
            children: [
              // Left: Source + Category
              {
                type: 'div' as const,
                props: {
                  style: { display: 'flex', alignItems: 'center', gap: 10 },
                  children: [
                    // Source badge
                    {
                      type: 'div' as const,
                      props: {
                        style: { backgroundColor: catStyle.bg, padding: '8px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 },
                        children: [
                          { type: 'div' as const, props: { style: { fontSize: 12, fontWeight: 700, color: catStyle.text, letterSpacing: '0.5px', display: 'flex' }, children: ['\uD83D\uDCF0 ' + sourceLabel.toUpperCase()] } },
                        ],
                      },
                    },
                    // Category badge
                    {
                      type: 'div' as const,
                      props: {
                        style: { backgroundColor: '#F3F4F6', padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center' },
                        children: [
                          { type: 'div' as const, props: { style: { fontSize: 11, fontWeight: 600, color: '#6B7280', letterSpacing: '0.5px', textTransform: 'uppercase' as const, display: 'flex' }, children: [news.category] } },
                        ],
                      },
                    },
                  ],
                },
              },
              // Right: Language + Date
              {
                type: 'div' as const,
                props: {
                  style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 4 },
                  children: [
                    { type: 'div' as const, props: { style: { fontSize: 11, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.5px', display: 'flex' }, children: [langLabel] } },
                    ...(dateLabel ? [{ type: 'div' as const, props: { style: { fontSize: 12, color: '#6B7280', fontWeight: 500, display: 'flex' }, children: [dateLabel] } }] : []),
                  ],
                },
              },
            ],
          },
        },
        // Headline
        {
          type: 'div' as const,
          props: {
            style: { display: 'flex', flexDirection: 'column' as const, gap: 4, flex: 1, justifyContent: 'flex-start' },
            children: [
              ...headlineLines.map((line, i) => ({
                type: 'div' as const,
                props: {
                  style: {
                    fontSize: i === 0 ? 38 : 36,
                    fontWeight: 800,
                    color: '#111827',
                    lineHeight: 1.25,
                    display: 'flex',
                  },
                  children: [line],
                },
              })),
            ],
          },
        },
        // Summary section (if available)
        ...(summaryLines.length > 0 ? [
          {
            type: 'div' as const,
            props: {
              style: {
                display: 'flex', flexDirection: 'column' as const, gap: 4,
                marginTop: 24, paddingTop: 20,
                borderTop: '1px solid #E5E7EB',
              },
              children: [
                { type: 'div' as const, props: { style: { fontSize: 12, fontWeight: 700, color: catStyle.accent, letterSpacing: '1px', marginBottom: 8, display: 'flex' }, children: ['SUMMARY'] } },
                ...summaryLines.map((line) => ({
                  type: 'div' as const,
                  props: {
                    style: { fontSize: 20, fontWeight: 500, color: '#4B5563', lineHeight: 1.5, display: 'flex' },
                    children: [line],
                  },
                })),
              ],
            },
          },
        ] : []),
        // Footer: Share Sathi branding
        {
          type: 'div' as const,
          props: {
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 16, borderTop: '1px solid #F3F4F6' },
            children: [
              { type: 'div' as const, props: { style: { fontSize: 16, fontWeight: 800, color: '#D97706', letterSpacing: '0.08em', display: 'flex' }, children: ['SHARE SATHI'] } },
              { type: 'div' as const, props: { style: { fontSize: 11, color: '#9CA3AF', display: 'flex' }, children: ['NEPSE Market Updates'] } },
            ],
          },
        },
        // Watermark
        logoWatermark(),
      ],
    },
  };

  const svg = await satori(jsx, { width: WIDTH, height: HEIGHT, fonts });
  return svgToPngBase64(svg);
}