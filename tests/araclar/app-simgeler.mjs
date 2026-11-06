// Mağaza uygulamasının simgeleri ve açılış ekranı, web uygulamasının simgelerinden (mobil/ikon-*.png).
// Kullanım: cd tests && node araclar/app-simgeler.mjs
//   - Android: mipmap-*/ic_launcher*.png, drawable*/splash.png, values/ic_launcher_background.xml
//   - iOS: Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png, Splash.imageset/*
// Görüntüler tarayıcıda (Chromium) çizilir: ek bir resim kütüphanesi gerekmez.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RES = path.join(KOK, 'app/android/app/src/main/res');
const IOS = path.join(KOK, 'app/ios/App/App/Assets.xcassets');
const veri = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(KOK, 'mobil', f)).toString('base64');

const tarayici = await chromium.launch();
const sayfa = await tarayici.newPage();
await sayfa.setContent('<canvas></canvas>');
await sayfa.evaluate(async ([maskable, ikon]) => {
  const yukle = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
  window.__r = { maskable: await yukle(maskable), ikon: await yukle(ikon) };
}, [veri('ikon-maskable-512.png'), veri('ikon-512.png')]);

/** g × y tuval; resim `olcek` oranında ortada; zemin rengi; daire kırpma isteğe bağlı */
async function ciz(dosya, { g, y = g, resim, olcek = 1, zemin = null, daire = false }) {
  const b64 = await sayfa.evaluate(({ g, y, resim, olcek, zemin, daire }) => {
    const c = document.querySelector('canvas');
    c.width = g; c.height = y;
    const x = c.getContext('2d');
    x.clearRect(0, 0, g, y);
    x.imageSmoothingQuality = 'high';
    if (daire) { x.beginPath(); x.arc(g / 2, y / 2, g / 2, 0, Math.PI * 2); x.clip(); }
    if (zemin) { x.fillStyle = zemin; x.fillRect(0, 0, g, y); }
    const k = Math.min(g, y) * olcek;
    x.drawImage(window.__r[resim], (g - k) / 2, (y - k) / 2, k, k);
    return c.toDataURL('image/png').split(',')[1];
  }, { g, y, resim, olcek, zemin, daire });
  fs.mkdirSync(path.dirname(dosya), { recursive: true });
  fs.writeFileSync(dosya, Buffer.from(b64, 'base64'));
}

// zemin: simgenin kendi krem rengi (köşe pikseli)
const ZEMIN = await sayfa.evaluate(() => {
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const x = c.getContext('2d'); x.drawImage(window.__r.maskable, -4, -4);
  const [r, g, b] = x.getImageData(0, 0, 1, 1).data;
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
});

// ---------- Android ----------
const YOGUNLUK = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [ad, k] of Object.entries(YOGUNLUK)) {
  const d = path.join(RES, `mipmap-${ad}`);
  // uyarlanabilir simge: ön katman 108 dp; maskable simgenin logosu güvenli dairenin (66 dp) içinde kalır
  await ciz(path.join(d, 'ic_launcher_foreground.png'), { g: 108 * k, resim: 'maskable' });
  await ciz(path.join(d, 'ic_launcher.png'), { g: 48 * k, resim: 'ikon' });
  await ciz(path.join(d, 'ic_launcher_round.png'), { g: 48 * k, resim: 'ikon', daire: true });
}
fs.writeFileSync(path.join(RES, 'values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${ZEMIN}</color>\n</resources>\n`);
// açılış ekranı (Android 11 ve öncesi; 12+ simgeyi kendisi gösterir): krem zemin, ortada logo
const SPLASH = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
for (const [ad, [g, y]] of Object.entries(SPLASH)) {
  await ciz(path.join(RES, `drawable-port-${ad}/splash.png`), { g, y, resim: 'maskable', olcek: 0.6, zemin: ZEMIN });
  await ciz(path.join(RES, `drawable-land-${ad}/splash.png`), { g: y, y: g, resim: 'maskable', olcek: 0.6, zemin: ZEMIN });
}
await ciz(path.join(RES, 'drawable/splash.png'), { g: 480, y: 320, resim: 'maskable', olcek: 0.6, zemin: ZEMIN });

// ---------- iOS ----------
if (fs.existsSync(IOS)) {
  // App Store simgesi: saydamlık olmamalı (krem zemin, logo büyük)
  await ciz(path.join(IOS, 'AppIcon.appiconset/AppIcon-512@2x.png'), { g: 1024, resim: 'ikon', zemin: ZEMIN });
  for (const f of fs.readdirSync(path.join(IOS, 'Splash.imageset')).filter((f) => f.endsWith('.png'))) {
    await ciz(path.join(IOS, 'Splash.imageset', f), { g: 2732, resim: 'maskable', olcek: 0.32, zemin: ZEMIN });
  }
}

await tarayici.close();
console.log(`simgeler hazır (zemin ${ZEMIN})`);
