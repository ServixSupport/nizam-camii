// Uygulama ikonlarını logodan üretir (Faz C). Çalıştırma: cd tests && node araclar/ikonlar.mjs [logo.png]
// Varsayılan kaynak ontwerp/logo-nizam.png (200×200). Daha büyük bir logo verilirse 512'lik ikonlar daha net olur.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const kaynak = process.argv[2] || path.join(KOK, 'ontwerp', 'logo-nizam.png');
const ZEMIN = '#F6F1E7';
// [dosya, kenar, logonun kenara oranı]  (maskable: logo güvenli alanda, %80 dairenin içinde)
const IKONLAR = [
  ['mobil/ikon-192.png', 192, 0.84],
  ['mobil/ikon-512.png', 512, 0.84],
  ['mobil/ikon-maskable-512.png', 512, 0.62],
  ['mobil/apple-touch-icon.png', 180, 0.80],
];

const b64 = fs.readFileSync(kaynak).toString('base64');
const tarayici = await chromium.launch();
const sayfa = await tarayici.newPage();
for (const [dosya, kenar, oran] of IKONLAR) {
  const veri = await sayfa.evaluate(async ({ b64, kenar, oran, zemin }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = kenar;
    const x = c.getContext('2d');
    x.fillStyle = zemin; x.fillRect(0, 0, kenar, kenar);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    const l = Math.round(kenar * oran);
    x.drawImage(img, Math.round((kenar - l) / 2), Math.round((kenar - l) / 2), l, l);
    return c.toDataURL('image/png').split(',')[1];
  }, { b64, kenar, oran, zemin: ZEMIN });
  fs.writeFileSync(path.join(KOK, dosya), Buffer.from(veri, 'base64'));
  console.log('yazıldı:', dosya, `${kenar}×${kenar}`);
}
await tarayici.close();
