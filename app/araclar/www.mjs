// Mağaza uygulamasının web dosyaları: /mobil/ klasörü olduğu gibi uygulamanın içine kopyalanır (www/).
// Uygulama telefondan https://localhost/ (Android) veya capacitor://localhost/ (iOS) olarak açılır:
// kök index.html = mobil/index.html; sayfadaki /mobil/… adresleri www/mobil/… dosyalarına gider.
// Vakitler ve içerik internetten (yerel.js: https://nizam-camii.vercel.app/api/…).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KOK = path.resolve(APP, '..');
const WWW = path.join(APP, 'www');

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });
// service worker ve web manifest'leri uygulamada gereksiz (telefon dosyaları zaten içinde taşır)
const atla = (ad) => ad === 'sw.js' || ad.endsWith('.webmanifest');
fs.cpSync(path.join(KOK, 'mobil'), path.join(WWW, 'mobil'), { recursive: true, filter: (k) => !atla(path.basename(k)) });
fs.copyFileSync(path.join(KOK, 'mobil', 'index.html'), path.join(WWW, 'index.html'));
const say = fs.readdirSync(path.join(WWW, 'mobil'), { recursive: true }).length;
console.log(`www hazır: ${say} dosya (mobil/) + index.html`);
