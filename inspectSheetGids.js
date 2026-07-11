const https = require('https');
const id = '1nb5gkJcjacVIvY1U2bVnZKnaDv6bCT_NNEM6IM-MpN0';
const gids = Array.from({ length: 30 }, (_, i) => i);

function fetchGid(gid) {
  return new Promise((resolve) => {
    const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`;
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const lines = data.split(/\r?\n/);
        resolve({ gid, status: res.statusCode, lineCount: lines.length, firstLine: lines[0], secondLine: lines[1] || '', sample: lines.slice(0, 10) });
      });
    });
    req.on('error', (err) => resolve({ gid, error: err.message }));
  });
}

(async () => {
  for (const gid of gids) {
    const result = await fetchGid(gid);
    console.log('GID', gid, 'status', result.status, 'lines', result.lineCount, 'firstLine', result.firstLine ? result.firstLine.slice(0, 80) : '');
  }
})();
