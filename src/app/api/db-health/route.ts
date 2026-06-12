import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Test 1: Can we query SystemConfig?
    const count = await db.systemConfig.count();

    // Test 2: Can we write?
    const test = await db.systemConfig.upsert({
      where: { key: '_db_health_check' },
      update: { value: String(Date.now()) },
      create: { key: '_db_health_check', value: String(Date.now()) },
    });

    return NextResponse.json({
      status: 'ok',
      configCount: count,
      healthCheck: test.value,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { status: 'error', error: msg },
      { status: 500 },
    );
  }
}