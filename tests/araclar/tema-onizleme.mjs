// TV ayarlarındaki tema önizlemeleri: TV'nin gerçek görüntüsü (referans ekran görüntüleri, 10:05),
// küçültülüp JPEG olarak index.html'e gömülür. Tema renkleri değişince:
//   cd tests && npx playwright test --project=tv-1920 tv/goruntu.spec.js -g "01-|11-|13-" --update-snapshots=all
//   node araclar/tema-onizleme.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REF = path.join(KOK, 'tests', 'tv', '__goruntuler__', 'tv-1920');
const TEMALAR = [['dark', '11-tema-koyu-gunduz.png'], ['light', '01-gunduz-normal.png'], ['krem', '13-tema-krem.png']];
const [GEN, YUK] = [480, 270];

const tarayici = await chromium.launch();
const sayfa = await tarayici.newPage();
const satirlar = [];
for (const [tema, dosya] of TEMALAR) {
  const b64 = fs.readFileSync(path.join(REF, dosya)).toString('base64');
  const jpeg = await sayfa.evaluate(async ({ b64, GEN, YUK }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = GEN; c.height = YUK;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, GEN, YUK);
    return c.toDataURL('image/jpeg', 0.82);
  }, { b64, GEN, YUK });
  satirlar.push(`.prev-${tema}{background-image:url(${jpeg})}`);
  console.log(`${tema}: ${Math.round(jpeg.length / 1024)} kB`);
}
await tarayici.close();

const p = path.join(KOK, 'index.html');
const html = fs.readFileSync(p, 'utf8');
const bas = '/* tema-onizleme:basla';
const bit = '/* tema-onizleme:bitti */';
const i = html.indexOf(bas), j = html.indexOf(bit);
if (i < 0 || j < 0) throw new Error('index.html: tema-onizleme işaretleri yok');
const satirSonu = html.indexOf('\n', i) + 1;
fs.writeFileSync(p, html.slice(0, satirSonu) + satirlar.join('\n') + '\n' + html.slice(j));
console.log('index.html güncellendi');
