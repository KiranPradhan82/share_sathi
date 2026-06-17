import satori from 'satori';
import { readFileSync } from 'fs';

const fontData = readFileSync('public/fonts/Inter-400.woff');
const fontData700 = readFileSync('public/fonts/Inter-700.woff');
const fontData900 = readFileSync('public/fonts/Inter-900.woff');
const opts = {
  width: 1080, height: 1080,
  fonts: [
    { name: 'Inter', data: fontData, weight: 400, style: 'normal' },
    { name: 'Inter', data: fontData700, weight: 700, style: 'normal' },
    { name: 'Inter', data: fontData900, weight: 900, style: 'normal' },
  ]
};

// Simulate a stock card template tree (the most complex one)
const accent = '#059669';
const accentDark = '#065F46';
const accentLight = '#D1FAE5';
const rank = 1;
const pctBar = 30;

const tree = {
  type: 'div',
  props: {
    style: {
      width: 1080, height: 1080,
      background: 'linear-gradient(170deg, #ffffff 0%, #ECFDF5 40%, #D1FAE5 100%)',
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    },
    children: [
      // Top accent bar - no children
      { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: accent } } },
      // Decorative circle - no children
      { type: 'div', props: { style: { position: 'absolute', top: -80, right: -80, width: 250, height: 250, borderRadius: 125, backgroundColor: accentLight, opacity: 0.35 } } },
      // Big rank bg - text children (OK without display)
      { type: 'div', props: { style: { position: 'absolute', bottom: 60, right: 30, fontSize: 220, fontWeight: 900, color: accentLight, opacity: 0.35, lineHeight: 1 }, children: `#${rank}` } },
      // Header with display:flex
      {
        type: 'div',
        props: {
          style: { display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 40, paddingBottom: 5 },
          children: [
            { type: 'div', props: { style: { fontSize: 14, fontWeight: 700, color: accent, letterSpacing: '0.15em' }, children: 'AS OF JUN 17, 2026 SHARE PRICE' } },
          ],
        },
      },
      // Badge container with display:flex, children as single object
      {
        type: 'div',
        props: {
          style: { display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 18 },
          children: {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', gap: 8, backgroundColor: accent, padding: '8px 24px', borderRadius: 30 },
              children: [
                { type: 'div', props: { style: { fontSize: 16, color: '#ffffff' }, children: '🚀' } },
                { type: 'div', props: { style: { fontSize: 16, color: '#ffffff', fontWeight: 700, letterSpacing: '0.08em' }, children: 'TOP GAINER #1' } },
              ],
            },
          },
        },
      },
      // Company card with display:flex
      {
        type: 'div',
        props: {
          style: { display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0px 55px', padding: '20px 24px', backgroundColor: '#ffffff', borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '2px solid #D1FAE5' },
          children: [
            { type: 'div', props: { style: { fontSize: 11, fontWeight: 700, color: accent, letterSpacing: '0.12em' }, children: 'POSITIVE CIRCUIT' } },
            { type: 'div', props: { style: { fontSize: 24, fontWeight: 800, color: '#0F172A', letterSpacing: '0.03em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.3, marginTop: 6 }, children: 'SAMPLE COMPANY LTD' } },
            { type: 'div', props: { style: { fontSize: 22, fontWeight: 700, color: accent, marginTop: 4 }, children: '(SCL)' } },
          ],
        },
      },
      // LTP display
      {
        type: 'div',
        props: {
          style: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 22 },
          children: [
            { type: 'div', props: { style: { fontSize: 13, fontWeight: 600, color: '#94A3B8', letterSpacing: '0.1em', textTransform: 'uppercase' }, children: 'LAST TRADED PRICE' } },
            {
              type: 'div',
              props: {
                style: { display: 'flex', flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
                children: [
                  { type: 'div', props: { style: { fontSize: 24, fontWeight: 600, color: '#64748B' }, children: 'Rs.' } },
                  { type: 'div', props: { style: { fontSize: 56, fontWeight: 900, color: accentDark, lineHeight: 1 }, children: '1234.56' } },
                ],
              },
            },
          ],
        },
      },
      // Metric cards row 1
      {
        type: 'div',
        props: {
          style: { display: 'flex', flexDirection: 'row', width: 1080, padding: '0px 55px', gap: 12, marginTop: 22 },
          children: [
            {
              type: 'div',
              props: {
                style: { flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff', borderRadius: 16, padding: '14px 14px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', borderLeft: '4px solid #059669' },
                children: [
                  { type: 'div', props: { style: { fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.1em' }, children: '% CHANGE' } },
                  { type: 'div', props: { style: { fontSize: 24, fontWeight: 900, color: accent, marginTop: 4 }, children: '+9.99%' } },
                  // Progress bar track with display:flex
                  { type: 'div', props: { style: { display: 'flex', width: '100%', height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, marginTop: 6, overflow: 'hidden' }, children: [
                    // Fill div - NO children property (was children:[], now removed)
                    { type: 'div', props: { style: { width: '30%', height: '100%', backgroundColor: accent, borderRadius: 2 } } },
                  ] } },
                ],
              },
            },
            {
              type: 'div',
              props: {
                style: { flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff', borderRadius: 16, padding: '14px 14px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', borderLeft: '4px solid #2563EB' },
                children: [
                  { type: 'div', props: { style: { fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.1em' }, children: 'POINT CHANGE' } },
                  { type: 'div', props: { style: { fontSize: 24, fontWeight: 900, color: '#1E40AF', marginTop: 4 }, children: 'Rs. +112.34' } },
                ],
              },
            },
          ],
        },
      },
      // Metric cards row 2
      {
        type: 'div',
        props: {
          style: { display: 'flex', flexDirection: 'row', width: 1080, padding: '0px 55px', gap: 12, marginTop: 12 },
          children: [
            {
              type: 'div',
              props: {
                style: { flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff', borderRadius: 16, padding: '14px 14px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', borderLeft: '4px solid #F59E0B' },
                children: [
                  { type: 'div', props: { style: { fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.1em' }, children: 'PREV. DAY CLOSE' } },
                  { type: 'div', props: { style: { fontSize: 24, fontWeight: 900, color: '#92400E', marginTop: 4 }, children: 'Rs. 1122.22' } },
                ],
              },
            },
            {
              type: 'div',
              props: {
                style: { flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: accent, borderRadius: 16, padding: '14px 14px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' },
                children: [
                  { type: 'div', props: { style: { fontSize: 10, fontWeight: 700, color: '#ffffffaa', letterSpacing: '0.1em' }, children: 'TOP GAINER RANK' } },
                  { type: 'div', props: { style: { fontSize: 28, fontWeight: 900, color: '#ffffff', marginTop: 4 }, children: '#1' } },
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
          style: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 70, background: 'linear-gradient(90deg, #059669, #059669dd)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
          children: { type: 'div', props: { style: { fontSize: 22, fontWeight: 900, color: '#ffffff', letterSpacing: '0.15em' }, children: 'SHARE SATHI' } },
        },
      },
    ],
  },
};

try {
  const svg = await satori(tree, opts);
  console.log('✅ FULL STOCK CARD TEMPLATE RENDERS SUCCESSFULLY!');
  console.log(`   SVG length: ${svg.length} chars`);
} catch (e) {
  console.log('❌ FAILED:', e.message);
  console.log('   Stack:', e.stack?.split('\n').slice(0, 5).join('\n   '));
}
