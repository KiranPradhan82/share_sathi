// Server-side news card image generator using Satori + resvg-js
// Ported from client-image-generator.ts for use in auto-post cron pipeline
// Generates 1080x1080 news card images with headline + AI summary

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const WIDTH = 1080;
const HEIGHT = 1080;

// ---- Font Loading (same pattern as image-generator.ts) ----
let fontsCache: Array<{ name: string; data: ArrayBuffer; weight: number; style: string }> | null = null;

function loadFonts() {
  if (fontsCache) return fontsCache;

  const bundledDir = join(process.cwd(), 'src', 'lib', 'fonts');
  const nodeModulesDir = join(process.cwd(), 'node_modules', '@fontsource', 'inter', 'files');

  let fontDir = bundledDir;
  let useBundledNaming = true;

  try {
    readFileSync(join(bundledDir, 'Inter-400.woff'), { flag: 'r' });
  } catch {
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

// ---- SVG to PNG ----
function svgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
  });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}

// ---- Types ----
export interface NewsCardData {
  headline: string;
  summary: string;
  source: string;
  category: string;
  publishedAt: string;
  language: string;
}

// ---- Styles ----
const CATEGORY_STYLES: Record<string, { bg: string; text: string; accent: string }> = {
  market: { bg: '#F0F9FF', text: '#0369A1', accent: '#0284C7' },
  ipo: { bg: '#FFFBEB', text: '#92400E', accent: '#D97706' },
  company: { bg: '#FAF5FF', text: '#6B21A8', accent: '#7C3AED' },
  regulatory: { bg: '#FFF1F2', text: '#9F1239', accent: '#E11D48' },
  general: { bg: '#F9FAFB', text: '#374151', accent: '#6B7280' },
};

// ---- Helpers ----
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

function wrapText(text: string, maxCharsPerLine: number): string[] {
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
}

function getSourceLabel(source: string): string {
  switch (source) {
    case 'merolagani': return 'Mero Lagani';
    case 'sharesansar': return 'Share Sansar';
    case 'google_news': return 'Google News';
    case 'myrepublica': return 'My Republica';
    case 'sebon': return 'SEBON';
    default: return source.charAt(0).toUpperCase() + source.slice(1);
  }
}

// ---- Main Generator ----
export async function generateNewsCardImage(news: NewsCardData): Promise<Buffer> {
  const fonts = loadFonts();
  const catStyle = CATEGORY_STYLES[news.category] || CATEGORY_STYLES.general;
  const dateLabel = formatDateLabel(news.publishedAt);
  const sourceLabel = getSourceLabel(news.source);
  const langLabel = news.language === 'ne' ? 'NEPALI' : 'ENGLISH';

  // Truncate headline to fit (~8-10 lines at 38px in 1080px width)
  const headlineText = truncateText(news.headline, 120);
  const headlineLines = wrapText(headlineText, 32);

  // Truncate summary — filter out garbage summaries
  const hasSummary = news.summary && news.summary.trim().length > 0 &&
    !/^(merolagani|sharesansar|google_news|myrepublica)\s*[-\u2013\u2014]/i.test(news.summary) &&
    !news.summary.includes('for the latest');
  const summaryText = hasSummary ? truncateText(news.summary, 300) : '';
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
        // Header row: source + category + language + date
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
                    {
                      type: 'div' as const,
                      props: {
                        style: { backgroundColor: catStyle.bg, padding: '8px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 },
                        children: [
                          { type: 'div' as const, props: { style: { fontSize: 12, fontWeight: 700, color: catStyle.text, letterSpacing: '0.5px', display: 'flex' }, children: ['\uD83D\uDCF0 ' + sourceLabel.toUpperCase()] } },
                        ],
                      },
                    },
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
        {
          type: 'div' as const,
          props: {
            style: {
              position: 'absolute', top: '50%', left: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: 'translate(-50%, -50%) scale(2.5)', opacity: 0.04,
            },
            children: {
              type: 'div' as const,
              props: { style: { fontSize: 140, fontWeight: 900, color: '#ffffff', letterSpacing: '0.05em', textTransform: 'uppercase' as const, display: 'flex' }, children: 'SS' },
            },
          },
        },
      ],
    },
  };

  // @ts-expect-error Satori accepts this JSX-like object format at runtime
  const svg = await satori(jsx, { width: WIDTH, height: HEIGHT, fonts });
  return svgToPng(svg);
}