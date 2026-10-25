// Testler için küçük statik sunucu: depo kökünü (tests/'in bir üstü) sunar.
// /api/* burada YOK: testler bu istekleri Playwright ile mock'lar.
// Mock'lanmamış bir API çağrısı 404 alır ve test görünür şekilde düşer.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4173);
const TUR = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

// Sadece testte: /__test/sw-ek?v=… service worker'ın sonuna bir yorum ekler ("yeni sürüm" denemesi).
let swEk = '';

http.createServer((req, res) => {
  const yol = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (yol === '/__test/sw-ek') {
    const v = new URL(req.url, 'http://x').searchParams.get('v') || '';
    swEk = v ? `\n// test sürümü: ${v.replace(/[^\w-]/g, '')}\n` : '';
    res.writeHead(204); return res.end();
  }
  if (yol.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ hata: 'testte mock yok: ' + yol }));
  }
  let dosya = path.join(KOK, yol);
  if (!dosya.startsWith(KOK)) { res.writeHead(403); return res.end(); }
  try {
    if (fs.statSync(dosya).isDirectory()) dosya = path.join(dosya, 'index.html');
    let govde = fs.readFileSync(dosya);
    if (yol === '/mobil/sw.js' && swEk) govde = Buffer.concat([govde, Buffer.from(swEk)]);
    res.writeHead(200, {
      'Content-Type': TUR[path.extname(dosya).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(govde);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('bulunamadı: ' + yol);
  }
}).listen(PORT, '127.0.0.1', () => console.log(`test sunucusu: http://127.0.0.1:${PORT}`));
