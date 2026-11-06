// Play Store tanıtım görseli (1024×500) ve 512 simge → app/magaza/android/
// Kullanım: cd tests && node araclar/magaza-afis.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CIKTI = path.join(KOK, 'app/magaza/android');
const b64 = (f) => fs.readFileSync(path.join(KOK, 'mobil', f)).toString('base64');
fs.mkdirSync(CIKTI, { recursive: true });

const tarayici = await chromium.launch();
const sayfa = await tarayici.newPage({ viewport: { width: 1024, height: 500 } });
await sayfa.setContent(`<!doctype html><html><head><style>
@font-face { font-family: Bodoni; src: url(data:font/woff2;base64,${b64('fonts/bodoni-moda-latin.woff2')}) format('woff2'); }
@font-face { font-family: Bodoni; src: url(data:font/woff2;base64,${b64('fonts/bodoni-moda-latin-ext.woff2')}) format('woff2'); unicode-range: U+0100-024F; }
@font-face { font-family: Hanken; src: url(data:font/woff2;base64,${b64('fonts/hanken-grotesk-latin.woff2')}) format('woff2'); }
@font-face { font-family: Hanken; src: url(data:font/woff2;base64,${b64('fonts/hanken-grotesk-latin-ext.woff2')}) format('woff2'); unicode-range: U+0100-024F; }
body { margin: 0; width: 1024px; height: 500px; display: flex; align-items: center; gap: 48px; padding: 0 72px; box-sizing: border-box;
  background: radial-gradient(circle at 78% 40%, #23396C 0, #14295A 45%, #0C1834 100%); color: #F6F1E7; font-family: Hanken, sans-serif; }
.logo { width: 260px; height: 260px; border-radius: 50%; background: #F6F1E7; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; box-shadow: 0 0 0 6px rgba(232,194,122,.35); }
.logo img { width: 230px; }
h1 { font-family: Bodoni, serif; font-weight: 600; font-size: 64px; line-height: 1.05; margin: 0 0 18px; }
p { margin: 0; font-size: 26px; color: #E8C27A; letter-spacing: .5px; }
small { display: block; margin-top: 14px; font-size: 21px; color: #D4DBEA; }
</style></head><body>
<div class="logo"><img src="data:image/png;base64,${b64('logo.png')}"></div>
<div><h1>Süleymaniye<br>Camii</h1><p>Namaz vakitleri · Gebedstijden</p><small>Nizam-ı Alem Süleymaniye · Amsterdam</small></div>
</body></html>`);
await sayfa.evaluate(() => document.fonts.ready);
await sayfa.screenshot({ path: path.join(CIKTI, 'tanitim-1024x500.png') });
await tarayici.close();
fs.copyFileSync(path.join(KOK, 'mobil/ikon-512.png'), path.join(CIKTI, 'simge-512.png'));
console.log('tanıtım görseli hazır');
