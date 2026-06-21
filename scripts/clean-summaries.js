const { createClient } = require('@libsql/client');
const db = createClient({
  url: 'libsql://sharesaathidb-kiran2057.aws-eu-west-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODEyMDAyNTMsImlkIjoiMDE5ZWI3YzAtNWQwMS03YzBiLWFiMjAtOGViNDZmMTgyNDI5IiwicmlkIjoiNjQ3ZmI1YzktNDYwMy00MmU4LWIxOWYtZjRlMDFkNTk3MTQ4In0.9YptA0IihfFJOqZWHGXxjjy1YNEMc_ZMitqdB_p3UmJFG2L6NnQATllVYHExYHQvapPz760bkBMs84diweDTBA',
});
async function main() {
  await db.execute({ sql: 'UPDATE NewsItem SET summary = ?', args: [''] });
  console.log('Cleared all summaries');
  await db.execute({ sql: 'UPDATE NewsItem SET isPosted = 0, postedAt = NULL', args: [] });
  console.log('Reset posted status');
  const check = await db.execute('SELECT COUNT(*) as c FROM NewsItem WHERE summary = ? OR summary IS NULL', ['']);
  console.log('Items with empty/null summary:', check.rows[0].c);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });