const { createClient } = require('@libsql/client');

const db = createClient({
  url: 'libsql://sharesaathidb-kiran2057.aws-eu-west-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODEyMDAyNTMsImlkIjoiMDE5ZWI3YzAtNWQwMS03YzBiLWFiMjAtOGViNDZmMTgyNDI5IiwicmlkIjoiNjQ3ZmI1YzktNDYwMy00MmU4LWIxOWYtZjRlMDFkNTk3MTQ4In0.9YptA0IihfFJOqZWHGXxjjy1YNEMc_ZMitqdB_p3UmJFG2L6NnQATllVYHExYHQvapPz760bkBMs84diweDTBA',
});

async function main() {
  // Get all items
  const result = await db.execute(`SELECT "id", summary FROM NewsItem`);
  console.log(`Total items: ${result.rows.length}`);

  let cleaned = 0;
  for (const row of result.rows) {
    const summary = row.summary || '';
    const isBad = summary.startsWith('merolagani -')
      || summary.startsWith('sharesansar -')
      || summary.includes("We'd like to send")
      || summary.includes('Subscribe');
    if (isBad) {
      await db.execute({
        sql: `UPDATE NewsItem SET summary = '' WHERE "id" = ?`,
        args: [row.id],
      });
      cleaned++;
    }
  }
  console.log(`Cleaned ${cleaned} bad summaries`);

  // Verify
  const check = await db.execute(`SELECT "id", headline, summary FROM NewsItem LIMIT 5`);
  check.rows.forEach(r => {
    console.log(`  H: ${(r.headline || '').substring(0, 50)}...`);
    console.log(`  S: "${(r.summary || '').substring(0, 60) || '(empty)'}"`);
    console.log('---');
  });
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });