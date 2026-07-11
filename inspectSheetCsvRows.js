const https = require('https');
const url = 'https://docs.google.com/spreadsheets/d/1nb5gkJcjacVIvY1U2bVnZKnaDv6bCT_NNEM6IM-MpN0/gviz/tq?tqx=out:csv&gid=1932163322';
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((value) => value.trim() !== ''));
};
https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
  let text = '';
  res.on('data', (chunk) => text += chunk);
  res.on('end', () => {
    console.error('status', res.statusCode);
    const rows = parseCsv(text);
    console.log('parsed rows:', rows.length);
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      console.log(i + 1, JSON.stringify(rows[i]));
    }
  });
}).on('error', (err) => {
  console.error('fetch error', err.message);
});
