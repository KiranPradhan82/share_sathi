import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL

  // During build time, DATABASE_URL may not be available — return a basic client
  // that won't actually be used (all our routes are dynamic / server-rendered)
  if (!dbUrl) {
    return new PrismaClient()
  }

  // Check if it's a Turso/libsql URL
  if (dbUrl.startsWith('libsql://') || dbUrl.startsWith('http://') || dbUrl.startsWith('https://')) {
    // Dynamic imports to avoid bundling Turso client for local dev
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSql } = require('@prisma/adapter-libsql')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@libsql/client')
    const libsql = createClient({ url: dbUrl })
    const adapter = new PrismaLibSql(libsql)
    return new PrismaClient({ adapter })
  }

  // Local SQLite
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })
}

export const db =
  globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db