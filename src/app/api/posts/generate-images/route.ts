import { NextResponse } from 'next/server';

// Legacy route — server-side image generation is no longer used.
// Images are now generated in the browser via client-image-generator.ts
// to avoid native addon (@resvg/resvg-js) dependency issues.
export async function POST() {
  return NextResponse.json({
    success: false,
    error: 'Server-side image generation has been deprecated. Images are now generated in the browser. Please use the "Generate Images" button on the dashboard instead.',
  }, { status: 410 });
}