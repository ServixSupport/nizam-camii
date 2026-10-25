// Android bildirim rozeti (durum çubuğundaki küçük, tek renkli simge): mihrap kemeri, içinde sekiz köşeli yıldız.
// Android sadece saydamlığı kullanır (rengi sistem verir). Çalıştırma: cd tests && node araclar/rozet.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tarayici = await chromium.launch();
const sayfa = await tarayici.newPage();
const veri = await sayfa.evaluate(() => {
  const K = 96;
  const c = document.createElement('canvas');
  c.width = c.height = K;
  const x = c.getContext('2d');
  // kemer (uygulamadaki SVG ile aynı yol, viewBox 0 0 300 360) → 96'lık kareye ortalı
  const s = 84 / 360;
  x.translate((K - 300 * s) / 2, (K - 360 * s) / 2 + 2);
  x.scale(s, s);
  const kemer = new Path2D('M16 352 V200 A190 190 0 0 1 150 18.4 A190 190 0 0 1 284 200 V352 Z');
  // yıldız: iki iç içe kare (45° döndürülmüş), kemerin ortasında
  const yildiz = new Path2D();
  const r = 58, cx = 150, cy = 205;
  for (const a of [0, Math.PI / 4]) {
    for (let i = 0; i < 4; i++) {
      const t = a + Math.PI / 4 + (i * Math.PI) / 2;
      const px = cx + r * Math.cos(t), py = cy + r * Math.sin(t);
      if (i === 0) yildiz.moveTo(px, py); else yildiz.lineTo(px, py);
    }
    yildiz.closePath();
  }
  x.fillStyle = '#fff';
  x.fill(kemer);
  x.globalCompositeOperation = 'destination-out';
  x.fill(yildiz, 'nonzero');
  return c.toDataURL('image/png').split(',')[1];
});
fs.writeFileSync(path.join(KOK, 'mobil', 'rozet-96.png'), Buffer.from(veri, 'base64'));
console.log('yazıldı: mobil/rozet-96.png 96×96');
await tarayici.close();
