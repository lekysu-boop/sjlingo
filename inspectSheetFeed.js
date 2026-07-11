const https = require('https');
const id = '1nb5gkJcjacVIvY1U2bVnZKnaDv6bCT_NNEM6IM-MpN0';
const url = `https://spreadsheets.google.com/feeds/worksheets/${id}/public/basic?alt=json`;
https.get(url, {headers: {'User-Agent': 'Mozilla/5.0'}}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.error('status', res.statusCode);
    try {
      const obj = JSON.parse(data);
      const entries = (obj.feed && obj.feed.entry) || [];
      console.log('title', obj.feed && obj.feed.title && obj.feed.title.$t);
      entries.forEach((e, i) => {
        console.log(i, e.title.$t, e.id.$t, e.gs$colCount && e.gs$colCount.$t, e.gs$rowCount && e.gs$rowCount.$t);
      });
    } catch (err) {
      console.error('parse error', err.message);
      console.log(data.slice(0, 1000));
    }
  });
}).on('error', err => console.error('fetch error', err.message));
