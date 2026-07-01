const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function main() {
  // Get homepage and find all newsdetail links with IPO result/allotment keywords
  const res = await fetch('https://www.sharesansar.com', {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' },
    signal: AbortSignal.timeout(15000),
  });
  const html = await res.text();
  console.log('Homepage length:', html.length);

  // Find all newsdetail links
  const detailRegex = /href="(\/newsdetail\/([^"<]+))"[^>]*>([\s\S]*?)<\/a>/gi;
  const resultNews: Array<{title: string; href: string; slug: string}> = [];
  const seen = new Set<string>();
  let match;

  while ((match = detailRegex.exec(html)) !== null) {
    const href = match[1] as string;
    const slug = match[2] as string;
    const title = (match[3] as string).replace(/<[^>]*>/g, '').trim();
    if (!/allotment|result|आवंटन|निष्कासन/i.test(title + ' ' + slug)) continue;
    const key = slug.split('-').slice(0, 4).join('-');
    if (seen.has(key) || title.length < 20) continue;
    seen.add(key);
    resultNews.push({ title: title.substring(0, 120), href, slug: slug.substring(0, 80) });
  }

  console.log('\n=== IPO result news from homepage ===');
  console.log('Found:', resultNews.length);
  for (const item of resultNews.slice(0, 15)) {
    console.log(' -', item.title);
    console.log('   ', item.href);
  }

  // Also try: fetch a specific IPO allotment article to see structure
  if (resultNews.length > 0) {
    console.log('\n=== Fetching first result article ===');
    const articleRes = await fetch('https://www.sharesansar.com' + resultNews[0].href, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' },
      signal: AbortSignal.timeout(15000),
    });
    const articleHtml = await articleRes.text();
    
    // Extract article content
    const contentMatch = articleHtml.match(/id="newsdetail-content"[^>]*>([\s\S]*?)(?=<div[^>]*id="[^"]*(?:comment|related|share))/i);
    if (contentMatch) {
      const text = contentMatch[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log('Article content (first 500 chars):', text.substring(0, 500));
    } else {
      console.log('No newsdetail-content found. Checking for other content divs...');
      const bodyIdx = articleHtml.indexOf('<body');
      const mid = articleHtml.indexOf('allotment');
      if (mid > -1) {
        console.log(articleHtml.substring(Math.max(0, mid - 200), mid + 500));
      }
    }
  }
}
main().catch(console.error);