import satori from 'satori';
import { readFileSync } from 'fs';

const fontData = readFileSync('/home/z/my-project/public/fonts/Inter-400.woff');

const opts = { width: 200, height: 200, fonts: [{ name: 'Inter', data: fontData, weight: 400, style: 'normal' }] };

// Test A: children: [] with NO display
try {
  await satori({ type: 'div', props: { style: { width: 200, height: 50, backgroundColor: 'red' }, children: [] } }, opts);
  console.log('A) children:[] NO display → SUCCESS');
} catch (e) {
  console.log('A) children:[] NO display → ERROR:', e.message);
}

// Test B: children: [] WITH display:flex
try {
  await satori({ type: 'div', props: { style: { width: 200, height: 50, backgroundColor: 'red', display: 'flex' }, children: [] } }, opts);
  console.log('B) children:[] WITH display:flex → SUCCESS');
} catch (e) {
  console.log('B) children:[] WITH display:flex → ERROR:', e.message);
}

// Test C: NO children property at all
try {
  await satori({ type: 'div', props: { style: { width: 200, height: 50, backgroundColor: 'red' } } }, opts);
  console.log('C) no children prop → SUCCESS');
} catch (e) {
  console.log('C) no children prop → ERROR:', e.message);
}

// Test D: children: [single] NO display
try {
  await satori({ type: 'div', props: { style: { width: 200, height: 50 }, children: [{ type: 'div', props: { style: { fontSize: 14 }, children: 'x' } }] } }, opts);
  console.log('D) children:[single] NO display → SUCCESS');
} catch (e) {
  console.log('D) children:[single] NO display → ERROR:', e.message);
}

// Test E: children: [two] NO display
try {
  await satori({ type: 'div', props: { style: { width: 200, height: 50 }, children: [
    { type: 'div', props: { style: { fontSize: 14 }, children: 'a' } },
    { type: 'div', props: { style: { fontSize: 14 }, children: 'b' } },
  ] } }, opts);
  console.log('E) children:[two] NO display → SUCCESS');
} catch (e) {
  console.log('E) children:[two] NO display → ERROR:', e.message);
}

// Test F: children: single-object NO display
try {
  await satori({ type: 'div', props: { style: { width: 200, height: 50 }, children: { type: 'div', props: { style: { fontSize: 14 }, children: 'x' } } } }, opts);
  console.log('F) children:single-object NO display → SUCCESS');
} catch (e) {
  console.log('F) children:single-object NO display → ERROR:', e.message);
}
