const http = require('http');
const fs = require('fs');

const PORT = 8080;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/tracker.js') {
    fs.readFile('tracker.js', (err, data) => {
      if (err) {
        res.writeHead(500).end();
      } else {
        res.writeHead(200, { 'Content-Type': 'application/javascript' }).end(data);
      }
    });
  } else if (req.method === 'POST' && req.url === '/report') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      const traceId = req.headers['x-trace-id'] || 'unknown-trace-id';

      try {
        const { payload } = JSON.parse(body);

        // 1. recentLogs einzeln loggen
        if (Array.isArray(payload?.recentLogs)) {
          payload.recentLogs.forEach(log => {
            const line = JSON.stringify({ traceId, ...log }) + '\n';
            process.stdout.write(line);
          });
        }

        // 2. error block loggen
        if (payload?.error) {
          const errorLine = JSON.stringify({ traceId, error: payload.error }) + '\n';
          process.stdout.write(errorLine);
        }

        res.writeHead(200).end();
      } catch {
        res.writeHead(400).end();
      }
    });
  } else {
    res.writeHead(404).end();
  }
});

server.listen(PORT, () => {
  process.stdout.write(`Listening on http://localhost:${PORT}\n`);
});
