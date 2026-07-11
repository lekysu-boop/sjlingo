const https = require('https');
const url = 'https://docs.google.com/spreadsheets/d/1nb5gkJcjacVIvY1U2bVnZKnaDv6bCT_NNEM6IM-MpN0/edit?usp=sharing';
const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
if (!idMatch) { console.error('id not found'); process.exit(1); }
const id = idMatch[1];
const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=0`;
https.get(csvUrl, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const rows = data.split(/\r?\n/);
    const headerCandidates = ['문제', '질문', 'question', '정답', 'answer', '보기', 'option', '선택지', 'Options'];
    const matchedRows = rows
      .map((line, idx) => ({ idx, line }))
      .filter(({ line }) => headerCandidates.some(term => line.includes(term)))
      .slice(0, 200);
    console.log('Total rows:', rows.length);
    console.log('Matched rows count:', matchedRows.length);
    matchedRows.slice(0, 50).forEach(({ idx, line }) => {
      console.log(`${idx+1}: ${line}`);
    });
    const sample = rows.slice(0, 200).map((line, idx) => `${idx+1}: ${line}`);
    // console.log(sample.join('\n'));
  });
}).on('error', e => { console.error('fetch error', e.message); process.exit(1); });
