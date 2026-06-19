const { createClient } = require('@libsql/client');

const db = createClient({
  url: 'libsql://sharesaathidb-kiran2057.aws-eu-west-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODEyMDAyNTMsImlkIjoiMDE5ZWI3YzAtNWQwMS03YzBiLWFiMjAtOGViNDZmMTgyNDI5IiwicmlkIjoiNjQ3ZmI1YzktNDYwMy00MmU4LWIxOWYtZjRlMDFkNTk3MTQ4In0.9YptA0IihfFJOqZWHGXxjjy1YNEMc_ZMitqdB_p3UmJFG2L6NnQATllVYHExYHQvapPz760bkBMs84diweDTBA',
});

const statements = [
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
    "isPosted" BOOLEAN NOT NULL DEFAULT 0,
    "postedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "NewsItem_externalId_key" ON "NewsItem"("externalId")`,
];

async function main() {
  for (const sql of statements) {
    try {
      await db.execute(sql);
      console.log('OK:', sql.substring(0, 80) + '...');
    } catch (e) {
      console.error('ERR:', e.message);
    }
  }

  // Verify
  const result = await db.execute(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
  console.log('\nTables in Turso DB:', result.rows.map(r => r.name));

  const count = await db.execute(`SELECT COUNT(*) as c FROM NewsItem`);
  console.log('NewsItem count:', count.rows[0].c);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });