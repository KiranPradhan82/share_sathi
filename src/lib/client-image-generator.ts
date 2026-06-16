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

// ---- Public API ----
export interface ClientGeneratedImages {
  marketSummary: string; // data:image/png;base64,...
  topGainers: string;
  topLosers: string;
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

  return {
    marketSummary: pngSummary,
    topGainers: pngGainers,
    topLosers: pngLosers,
  };
}