// Image generation service using Satori + resvg-js for NEPSE market posts
// Generates professional Facebook-style images (1080x1080)
// Uses @resvg/resvg-js (native addon) for reliable SVG-to-PNG on Vercel

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { NepseData } from './nepse';
import type { StockData } from './nepse-stocks';
import { formatDateForPost, formatNepaliAmount } from './nepse-stocks';

const WIDTH = 1080;
const HEIGHT = 1080;

// ---- Font Loading ----
// Fonts are bundled in src/lib/fonts/ to ensure availability on Vercel serverless
let fontsCache: Array<{ name: string; data: ArrayBuffer; weight: number; style: string }> | null = null;

function loadFonts() {
  if (fontsCache) return fontsCache;

  // Try bundled fonts first (most reliable on Vercel)
  const bundledDir = join(process.cwd(), 'src', 'lib', 'fonts');
  const nodeModulesDir = join(process.cwd(), 'node_modules', '@fontsource', 'inter', 'files');

  let fontDir = bundledDir;
  let useBundledNaming = true;

  try {
    readFileSync(join(bundledDir, 'Inter-400.woff'), { flag: 'r' });
  } catch {
    // Fall back to node_modules
    fontDir = nodeModulesDir;
    useBundledNaming = false;
  }

  const weightMap: Array<[number, string]> = useBundledNaming
    ? [
        [400, 'Inter-400.woff'],
        [500, 'Inter-500.woff'],
        [600, 'Inter-600.woff'],
        [700, 'Inter-700.woff'],
        [800, 'Inter-800.woff'],
        [900, 'Inter-900.woff'],
      ]
    : [
        [400, 'inter-latin-400-normal.woff'],
        [500, 'inter-latin-500-normal.woff'],
        [600, 'inter-latin-600-normal.woff'],
        [700, 'inter-latin-700-normal.woff'],
        [800, 'inter-latin-800-normal.woff'],
        [900, 'inter-latin-900-normal.woff'],
      ];

  fontsCache = weightMap.map(([weight, filename]) => {
    const buf = readFileSync(join(fontDir, filename));
    return {
      name: 'Inter',
      data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      weight,
      style: 'normal' as const,
    };
  });

  return fontsCache;
}

// ---- SVG to PNG (using resvg-js native addon - reliable on Vercel) ----
function svgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: WIDTH,
    },
  });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}

// ---- Shared Elements ----
function logoWatermark(): React.ReactNode {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: 'translate(-50%, -50%) scale(2.5)',
        opacity: 0.04,
      },
      children: {
        type: 'div',
        props: {
          style: {
            fontSize: 140,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          },
          children: 'SS',
        },
      },
    },
  };
}

function footerBar(theme: 'dark' | 'green' | 'red'): React.ReactNode {
  const bgColor = theme === 'green' ? '#166534' : theme === 'red' ? '#991B1B' : '#0F172A';
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 90,
        backgroundColor: bgColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        borderTop: `1px solid ${theme === 'green' ? '#22C55E33' : theme === 'red' ? '#EF444433' : '#33415566'}`,
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              fontSize: 20,
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '0.08em',
            },
            children: 'SHARE SATHI',
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontSize: 13,
              color: '#ffffff88',
              letterSpacing: '0.05em',
            },
            children: '#NEPSE #ShareSathi #NepalStockExchange #StockMarket',
          },
        },
      ],
    },
  };
}

// ===================================================
// Template 1: Market Summary (NEPSE TODAY)
// ===================================================
async function renderMarketSummary(data: NepseData): Promise<Buffer> {
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

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: WIDTH,
          height: HEIGHT,
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
          position: 'relative',
          overflow: 'hidden',
        },
        children: [
          // Watermark
          logoWatermark(),

          // Top accent line
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                backgroundColor: color,
              },
            },
          },

          // Header
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: 55,
                paddingBottom: 10,
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 44,
                      fontWeight: 900,
                      color: '#ffffff',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    },
                    children: 'NEPSE TODAY',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 22,
                      color: '#ffffff99',
                      marginTop: 8,
                      fontWeight: 500,
                    },
                    children: dateStr,
                  },
                },
              ],
            },
          },

          // Main index display
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: 30,
                paddingBottom: 20,
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 96,
                      fontWeight: 900,
                      color: '#ffffff',
                      lineHeight: 1,
                    },
                    children: data.nepseIndex.toFixed(2),
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 16,
                      marginTop: 16,
                    },
                    children: [
                      {
                        type: 'div',
                        props: {
                          style: {
                            fontSize: 36,
                            fontWeight: 700,
                            color: color,
                          },
                          children: `${arrow} ${sign}${data.change.toFixed(2)}`,
                        },
                      },
                      {
                        type: 'div',
                        props: {
                          style: {
                            fontSize: 30,
                            fontWeight: 600,
                            color: color,
                            opacity: 0.85,
                          },
                          children: `(${sign}${data.changePercentage.toFixed(2)}%)`,
                        },
                      },
                    ],
                  },
                },
                // Separator line
                {
                  type: 'div',
                  props: {
                    style: {
                      width: 300,
                      height: 2,
                      backgroundColor: '#334155',
                      marginTop: 25,
                      borderRadius: 1,
                    },
                  },
                },
              ],
            },
          },

          // Metrics grid (2 columns, 3 rows)
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: WIDTH,
                padding: '0px 50px',
                gap: 12,
              },
              children: [0, 1, 2].map((row) => ({
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'row',
                    width: '100%',
                    gap: 12,
                  },
                  children: metrics.slice(row * 2, row * 2 + 2).map((m) => ({
                    type: 'div',
                    props: {
                      style: {
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: '#1E293B99',
                        borderRadius: 12,
                        padding: '16px 22px',
                        borderLeft: `4px solid ${m.color}`,
                      },
                      children: [
                        {
                          type: 'div',
                          props: {
                            style: {
                              fontSize: 20,
                              color: '#ffffff99',
                              fontWeight: 500,
                            },
                            children: m.label,
                          },
                        },
                        {
                          type: 'div',
                          props: {
                            style: {
                              fontSize: 24,
                              color: '#ffffff',
                              fontWeight: 700,
                            },
                            children: m.value,
                          },
                        },
                      ],
                    },
                  })),
                },
              })),
            },
          },

          // Footer
          footerBar('dark'),
        ],
      },
    },
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: loadFonts(),
    },
  );

  return svgToPng(svg);
}

// ===================================================
// Template 2: Top 10 Gainers
// ===================================================
async function renderTopGainers(
  gainers: StockData[],
  dateStr: string,
): Promise<Buffer> {
  const formattedDate = formatDateForPost(dateStr);

  const headerRow = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        backgroundColor: '#166534',
        padding: '14px 20px',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
      },
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
      style: {
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        backgroundColor: idx % 2 === 0 ? '#F0FDF4' : '#ffffff',
        padding: '13px 20px',
      },
      children: [
        { type: 'div', props: { style: { width: 50, fontSize: 17, fontWeight: 600, color: '#374151' }, children: (idx + 1).toString() } },
        { type: 'div', props: { style: { flex: 1, fontSize: 17, fontWeight: 700, color: '#166534' }, children: stock.symbol } },
        { type: 'div', props: { style: { width: 140, fontSize: 17, fontWeight: 500, color: '#374151', textAlign: 'right' as const }, children: stock.closePrice.toFixed(2) } },
        { type: 'div', props: { style: { width: 120, fontSize: 17, fontWeight: 700, color: '#166534', textAlign: 'right' as const }, children: `+${stock.change.toFixed(2)}` } },
        { type: 'div', props: { style: { width: 120, fontSize: 17, fontWeight: 700, color: '#166534', textAlign: 'right' as const }, children: `+${stock.changePercent.toFixed(2)}%` } },
      ],
    },
  }));

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: WIDTH,
          height: HEIGHT,
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #052E16 0%, #14532D 40%, #052E16 100%)',
          position: 'relative',
          overflow: 'hidden',
        },
        children: [
          logoWatermark(),

          // Top accent
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                backgroundColor: '#22C55E',
              },
            },
          },

          // Header
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: 50,
                paddingBottom: 10,
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 38,
                      fontWeight: 900,
                      color: '#ffffff',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    },
                    children: "TODAY'S TOP 10 GAINERS",
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 22,
                      color: '#ffffff88',
                      marginTop: 8,
                      fontWeight: 500,
                    },
                    children: formattedDate,
                  },
                },
              ],
            },
          },

          // Green arrow indicator
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 15,
                marginBottom: 20,
              },
              children: {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: '#22C55E22',
                    padding: '8px 24px',
                    borderRadius: 30,
                    border: '1px solid #22C55E44',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: { fontSize: 26, color: '#22C55E', fontWeight: 700 },
                        children: '\u25B2',
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: { fontSize: 20, color: '#22C55E', fontWeight: 600 },
                        children: 'Bullish Session',
                      },
                    },
                  ],
                },
              },
            },
          },

          // Table
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                width: WIDTH,
                padding: '0px 35px',
                gap: 0,
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid #22C55E33',
              },
              children: [headerRow, ...dataRows],
            },
          },

          // Footer
          footerBar('green'),
        ],
      },
    },
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: loadFonts(),
    },
  );

  return svgToPng(svg);
}

// ===================================================
// Template 3: Top 10 Losers
// ===================================================
async function renderTopLosers(
  losers: StockData[],
  dateStr: string,
): Promise<Buffer> {
  const formattedDate = formatDateForPost(dateStr);

  const headerRow = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        backgroundColor: '#991B1B',
        padding: '14px 20px',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
      },
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
      style: {
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        backgroundColor: idx % 2 === 0 ? '#FEF2F2' : '#ffffff',
        padding: '13px 20px',
      },
      children: [
        { type: 'div', props: { style: { width: 50, fontSize: 17, fontWeight: 600, color: '#374151' }, children: (idx + 1).toString() } },
        { type: 'div', props: { style: { flex: 1, fontSize: 17, fontWeight: 700, color: '#991B1B' }, children: stock.symbol } },
        { type: 'div', props: { style: { width: 140, fontSize: 17, fontWeight: 500, color: '#374151', textAlign: 'right' as const }, children: stock.closePrice.toFixed(2) } },
        { type: 'div', props: { style: { width: 120, fontSize: 17, fontWeight: 700, color: '#991B1B', textAlign: 'right' as const }, children: stock.change.toFixed(2) } },
        { type: 'div', props: { style: { width: 120, fontSize: 17, fontWeight: 700, color: '#991B1B', textAlign: 'right' as const }, children: `${stock.changePercent.toFixed(2)}%` } },
      ],
    },
  }));

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: WIDTH,
          height: HEIGHT,
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #450A0A 0%, #7F1D1D 40%, #450A0A 100%)',
          position: 'relative',
          overflow: 'hidden',
        },
        children: [
          logoWatermark(),

          // Top accent
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                backgroundColor: '#EF4444',
              },
            },
          },

          // Header
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: 50,
                paddingBottom: 10,
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 38,
                      fontWeight: 900,
                      color: '#ffffff',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    },
                    children: "TODAY'S TOP 10 LOSERS",
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 22,
                      color: '#ffffff88',
                      marginTop: 8,
                      fontWeight: 500,
                    },
                    children: formattedDate,
                  },
                },
              ],
            },
          },

          // Red arrow indicator
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 15,
                marginBottom: 20,
              },
              children: {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: '#EF444422',
                    padding: '8px 24px',
                    borderRadius: 30,
                    border: '1px solid #EF444444',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: { fontSize: 26, color: '#EF4444', fontWeight: 700 },
                        children: '\u25BC',
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: { fontSize: 20, color: '#EF4444', fontWeight: 600 },
                        children: 'Bearish Session',
                      },
                    },
                  ],
                },
              },
            },
          },

          // Table
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                width: WIDTH,
                padding: '0px 35px',
                gap: 0,
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid #EF444433',
              },
              children: [headerRow, ...dataRows],
            },
          },

          // Footer
          footerBar('red'),
        ],
      },
    },
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: loadFonts(),
    },
  );

  return svgToPng(svg);
}

// ===================================================
// Public API
// ===================================================
export interface GeneratedImages {
  marketSummary: Buffer;
  topGainers: Buffer;
  topLosers: Buffer;
}

export interface GeneratedImagesBase64 {
  marketSummary: string;
  topGainers: string;
  topLosers: string;
  data: {
    marketData: NepseData;
    gainers: StockData[];
    losers: StockData[];
  };
}

export async function generateAllImages(
  nepseData: NepseData,
  gainers: StockData[],
  losers: StockData[],
): Promise<GeneratedImages> {
  const [marketSummary, topGainers, topLosers] = await Promise.all([
    renderMarketSummary(nepseData),
    renderTopGainers(gainers, nepseData.tradingDate),
    renderTopLosers(losers, nepseData.tradingDate),
  ]);

  return { marketSummary, topGainers, topLosers };
}

export async function generateAllImagesAsBase64(
  nepseData: NepseData,
  gainers: StockData[],
  losers: StockData[],
): Promise<GeneratedImagesBase64> {
  const images = await generateAllImages(nepseData, gainers, losers);

  return {
    marketSummary: images.marketSummary.toString('base64'),
    topGainers: images.topGainers.toString('base64'),
    topLosers: images.topLosers.toString('base64'),
    data: {
      marketData: nepseData,
      gainers,
      losers,
    },
  };
}