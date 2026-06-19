import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

// One-time endpoint to create any missing tables on the remote (Turso) DB.
// All statements use IF NOT EXISTS — safe to call multiple times.
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) return auth.response;

  const statements = [
    `CREATE TABLE IF NOT EXISTS "MarketData" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "tradingDate" TEXT NOT NULL,
      "nepseIndex" REAL NOT NULL,
      "change" REAL NOT NULL,
      "changePercentage" REAL NOT NULL,
      "turnover" REAL NOT NULL,
      "volume" REAL NOT NULL,
      "trades" INTEGER NOT NULL,
      "gainers" INTEGER NOT NULL,
      "losers" INTEGER NOT NULL,
      "unchanged" INTEGER NOT NULL,
      "rawData" TEXT NOT NULL DEFAULT '{}',
      "status" TEXT NOT NULL DEFAULT 'pending',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "MarketData_tradingDate_key" ON "MarketData"("tradingDate")`,

    `CREATE TABLE IF NOT EXISTS "FacebookPost" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "marketDataId" TEXT NOT NULL,
      "facebookPostId" TEXT,
      "message" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "scheduledTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "postedTime" DATETIME,
      "attemptCount" INTEGER NOT NULL DEFAULT 0,
      "errorMessage" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS "SystemEvent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "eventType" TEXT NOT NULL,
      "entityType" TEXT,
      "entityId" TEXT,
      "description" TEXT NOT NULL,
      "metadata" TEXT NOT NULL DEFAULT '{}',
      "severity" TEXT NOT NULL DEFAULT 'info',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "marketDataId" TEXT,
      "facebookPostId" TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS "SystemConfig" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "key" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "updatedAt" DATETIME NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "SystemConfig_key_key" ON "SystemConfig"("key")`,

    `CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,

    `CREATE TABLE IF NOT EXISTS "IpoStatus" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "companyName" TEXT NOT NULL,
      "companySymbol" TEXT NOT NULL,
      "ipoType" TEXT NOT NULL,
      "issueManager" TEXT NOT NULL,
      "issuedUnits" INTEGER NOT NULL,
      "numberOfApplications" INTEGER NOT NULL,
      "appliedUnits" INTEGER NOT NULL,
      "totalAmount" REAL NOT NULL,
      "openDate" TEXT NOT NULL,
      "closeDate" TEXT NOT NULL,
      "lastUpdate" TEXT NOT NULL,
      "oversubscription" REAL,
      "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS "NewsItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "externalId" TEXT NOT NULL,
      "source" TEXT NOT NULL,
      "headline" TEXT NOT NULL,
      "summary" TEXT NOT NULL DEFAULT '',
      "category" TEXT NOT NULL DEFAULT 'general',
      "language" TEXT NOT NULL DEFAULT 'en',
      "publishedAt" DATETIME NOT NULL,
      "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "isPosted" BOOLEAN NOT NULL DEFAULT false,
      "postedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "NewsItem_externalId_key" ON "NewsItem"("externalId")`,
  ];

  const results: string[] = [];
  const errors: string[] = [];

  for (const sql of statements) {
    try {
      await db.$executeRawUnsafe(sql);
      const tableMatch = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/i);
      const indexMatch = sql.match(/CREATE\s+UNIQUE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/i);
      const name = tableMatch?.[1] || indexMatch?.[1] || 'unknown';
      results.push(`Created ${name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg);
      results.push(`Error: ${msg.substring(0, 120)}`);
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    message: errors.length === 0
      ? 'All tables synced successfully'
      : `Completed with ${errors.length} error(s)`,
    results,
    errors: errors.length > 0 ? errors : undefined,
  });
}