import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;
  try {
    const configs = await db.systemConfig.findMany({
      orderBy: { key: 'asc' },
    });

    // Return as key-value map with defaults
    const defaults: Record<string, string> = {
      facebook_app_id: '',
      facebook_app_secret: '',
      facebook_page_id: '',
      facebook_page_access_token: '',
      auto_post_enabled: 'false',
      post_time: '15:00',
      refetch_interval_minutes: '5',
      off_days: '0,6',
      hashtags: '',
      notification_email: '',
      language: 'en',
    };

    const configMap: Record<string, string> = { ...defaults };
    for (const c of configs) {
      configMap[c.key] = c.value;
    }

    return NextResponse.json({ data: configMap });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'settings object is required' },
        { status: 400 },
      );
    }

    const allowedKeys = [
      'facebook_app_id',
      'facebook_app_secret',
      'facebook_page_id',
      'facebook_page_access_token',
      'auto_post_enabled',
      'post_time',
      'refetch_interval_minutes',
      'off_days',
      'hashtags',
      'notification_email',
      'language',
    ];

    const results = [];

    for (const [key, value] of Object.entries(settings)) {
      if (!allowedKeys.includes(key)) continue;

      const result = await db.systemConfig.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
      results.push(result);
    }

    // Log the settings update
    await db.systemEvent.create({
      data: {
        eventType: 'config',
        entityType: 'system_config',
        description: `Settings updated: ${Object.keys(settings).join(', ')}`,
        severity: 'info',
      },
    });

    return NextResponse.json({ data: results, message: 'Settings updated' });
  } catch (error) {
    console.error('Error updating settings:', error);
    const msg = error instanceof Error ? error.message : 'Failed to update settings';
    return NextResponse.json(
      { error: msg },
      { status: 500 },
    );
  }
}