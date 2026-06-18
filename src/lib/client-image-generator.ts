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
  const openedToday = ipo.openedToday;
  const statusColor = isOpen ? '#16A34A' : '#64748B';
  const statusLabel = isOpen ? (openedToday ? 'IPO OPENED TODAY' : 'NOW OPEN') : 'CLOSED';
  const statusEmoji = isOpen ? '\uD83D\uDCC8' : '\uD83D\uDD12';

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

  // Row 4: Oversubscription (always when closed + has data)
  if (!isOpen && !openedToday && hasSubscriptionData && ipo.oversubscription !== null) {
    const subVal = ipo.oversubscription;
    const subColor = subVal >= 10 ? '#DC2626' : subVal >= 3 ? '#D97706' : subVal >= 1 ? '#16A34A' : '#64748B';
    metrics.push({
      label: 'OVERSUBSCRIPTION',
      value: `${subVal.toFixed(2)}x`,
      headerColor: subColor,
      valueColor: subColor,
    });
    // Show issue manager in remaining slot if we have sub data
    // (manager already in row 2, so skip)
  }

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
            style: { flex: 1, display: 'flex', flexDirection: 'column' as const, borderRadius: 14, overflow: 'hidden' },
            children: [
              { type: 'div', props: { style: { fontSize: 14, fontWeight: 800, color: '#ffffff', backgroundColor: m.headerColor, padding: '9px 16px', letterSpacing: '0.1em' }, children: m.label } },
              { type: 'div', props: { style: { fontSize: m.value.length > 18 ? 22 : m.value.length > 12 ? 26 : 30, fontWeight: 900, color: m.valueColor, backgroundColor: '#ffffff', padding: '12px 16px' }, children: m.value } },
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
              style: { display: 'flex', flexDirection: 'row' as const, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: navBar, padding: '24px 30px' },
              children: [
                { type: 'div', props: { style: { fontSize: 30, fontWeight: 800, color: '#ffffff' }, children: '\uD83D\uDCB5' } },
                { type: 'div', props: { style: { fontSize: 22, fontWeight: 900, color: '#ffffff', letterSpacing: '0.12em' }, children: 'IPO UPDATE' } },
                { type: 'div', props: { style: { width: 2, height: 28, backgroundColor: '#ffffff55' } } },
                { type: 'div', props: { style: { fontSize: 22, fontWeight: 900, color: '#ffffff', letterSpacing: '0.12em' }, children: 'NEPAL' } },
              ],
            },
          },
          // Status badge
          {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
              children: {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'row' as const, alignItems: 'center', gap: 10, backgroundColor: statusColor, padding: '8px 28px', borderRadius: 30 },
                  children: [
                    { type: 'div', props: { style: { fontSize: 20, fontWeight: 900, color: '#ffffff', letterSpacing: '0.1em' }, children: `${statusEmoji}  ${statusLabel}` } },
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
                { type: 'div', props: { style: { fontSize: ipo.companyName.length > 30 ? 24 : 28, fontWeight: 900, color: navBar, letterSpacing: '0.04em', textTransform: 'uppercase' as const, textAlign: 'center' as const, lineHeight: 1.2 }, children: ipo.companyName } },
                ...(ipo.companySymbol ? [{ type: 'div', props: { style: { fontSize: 22, fontWeight: 800, color: medBlue, marginTop: 4 }, children: `(${ipo.companySymbol})` } }] : []),
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
                      { type: 'div', props: { style: { fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.1em' }, children: 'OPEN' } },
                      { type: 'div', props: { style: { fontSize: 17, fontWeight: 800, color: navBar, marginTop: 2 }, children: formatDateShort(ipo.openDate) } },
                    ],
                  },
                },
                { type: 'div', props: { style: { width: 2, height: 30, backgroundColor: '#CBD5E1' } } },
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center' },
                    children: [
                      { type: 'div', props: { style: { fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.1em' }, children: 'CLOSE' } },
                      { type: 'div', props: { style: { fontSize: 17, fontWeight: 800, color: navBar, marginTop: 2 }, children: formatDateShort(ipo.closeDate) } },
                    ],
                  },
                },
                ...(ipo.lastUpdate ? [
                  { type: 'div', props: { style: { width: 2, height: 30, backgroundColor: '#CBD5E1' } } },
                  {
                    type: 'div',
                    props: {
                      style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center' },
                      children: [
                        { type: 'div', props: { style: { fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.1em' }, children: 'UPDATED' } },
                        { type: 'div', props: { style: { fontSize: 13, fontWeight: 700, color: '#64748B', marginTop: 2 }, children: ipo.lastUpdate.length > 16 ? ipo.lastUpdate.substring(0, 16) : ipo.lastUpdate } },
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
                { type: 'div', props: { style: { fontSize: 22, fontWeight: 900, color: '#ffffff', letterSpacing: '0.1em' }, children: 'SHARE SATHI' } },
                { type: 'div', props: { style: { fontSize: 12, color: '#ffffff88', letterSpacing: '0.05em' }, children: '#NEPSE #ShareSathi #IPO #NepalIPO #StockMarket' } },
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