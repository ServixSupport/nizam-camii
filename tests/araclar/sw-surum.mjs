// Service worker sürümünü (SURUM) uygulama dosyalarının özetinden hesaplar.
// Kullanım: cd tests && node araclar/sw-surum.mjs        → mobil/sw.js içindeki SURUM'u günceller
//           node araclar/sw-surum.mjs --kontrol           → sadece hesaplar ve karşılaştırır
// Uygulama dosyası değişip SURUM değişmezse telefonlar eski dosyaları cache'ten açmaya devam eder;
// tests/mobil/pwa.spec.js bunu yakalar.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SW = path.join(KOK, 'mobil', 'sw.js');

export function surumHesapla() {
  const sw = fs.readFileSync(SW, 'utf8');
  const liste = sw.match(/const DOSYALAR = \[([\s\S]*?)\];/)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  const ozet = crypto.createHash('sha256');
  for (const u of liste) {
    const dosya = path.join(KOK, u === '/mobil/' ? 'mobil/index.html' : u.replace(/^\//, ''));
    ozet.update(u).update(fs.readFileSync(dosya));
  }
  ozet.update(sw.replace(/const SURUM = '[^']*';/, ''));          // sw.js'in kendisi de (SURUM satırı hariç)
  return { surum: ozet.digest('hex').slice(0, 10), mevcut: sw.match(/const SURUM = '([^']*)';/)[1], liste };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { surum, mevcut } = surumHesapla();
  if (process.argv.includes('--kontrol')) {
    console.log(surum === mevcut ? `SURUM güncel: ${surum}` : `SURUM eski: ${mevcut} → olmalı ${surum}`);
  } else if (surum !== mevcut) {
    fs.writeFileSync(SW, fs.readFileSync(SW, 'utf8').replace(/const SURUM = '[^']*';/, `const SURUM = '${surum}';`));
    console.log(`SURUM güncellendi: ${mevcut} → ${surum}`);
  } else {
    console.log(`SURUM zaten güncel: ${surum}`);
  }
}
