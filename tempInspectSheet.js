const https = require('https');
const url = 'https://docs.google.com/spreadsheets/d/1nb5gkJcjacVIvY1U2bVnZKnaDv6bCT_NNEM6IM-MpN0/edit?usp=sharing';
const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
if (!idMatch) {
  console.error('id not found');
  process.exit(1);
}
const id = idMatch[1];
const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=0`;
https.get(csvUrl, (res) => {
  console.error('status', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const rows = data.split(/\r?\n/);
    console.log('line count:', rows.length);
    rows.slice(0, 80).forEach((line, idx) => console.log(`${idx+1}: ${line}`));
  });
}).on('error', e => {
  console.error('fetch error', e.message);
  process.exit(1);
});
