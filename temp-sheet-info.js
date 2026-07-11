const https = require('https');
const url = 'https://docs.google.com/spreadsheets/d/1nb5gkJcjacVIvY1U2bVnZKnaDv6bCT_NNEM6IM-MpN0/edit?usp=sharing';
const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
if (!idMatch) {
  console.error('id not found');
  process.exit(1);
}
const id = idMatch[1];
const editUrl = `https://docs.google.com/spreadsheets/d/${id}/edit?usp=sharing`;
https.get(editUrl, (res) => {
  let html = '';
  res.on('data', chunk => html += chunk);
  res.on('end', () => {
    console.error('status', res.statusCode);
    const gids = Array.from(new Set([...html.matchAll(/gid=(\d+)/g)].map(m => m[1])));
    console.error('gids', gids);
    const titles = Array.from(new Set([...html.matchAll(/"title":"([^"]+)"/g)].map(m => m[1])));
    console.error('titles', titles.slice(0, 20));
    if (gids.length === 0) {
      console.log(html.slice(0, 4000));
    }
  });
}).on('error', e => { console.error('fetch error', e.message); process.exit(1); });
