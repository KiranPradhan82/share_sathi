import satori from 'satori';
import { readFileSync } from 'fs';
const fontData = readFileSync('/home/z/my-project/public/fonts/Inter-400.woff');
const opts = { width: 200, height: 200, fonts: [{ name: 'Inter', data: fontData, weight: 400, style: 'normal' }] };

// Test: children as string, NO display
try {
  await satori({ type: 'div', props: { style: { width: 200, height: 50 }, children: 'hello' } }, opts);
  console.log('children:"string" NO display → SUCCESS');
} catch (e) {
  console.log('children:"string" NO display → ERROR:', e.message);
}
