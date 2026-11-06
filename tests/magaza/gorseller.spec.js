// App Store görselleri: iPhone 6,9" (1320×2868) ve iPad 13" (2064×2752), Hollandaca ve Türkçe.
// Uygulamanın kendisi (mağaza uygulaması modu, iPhone), sabit bir günde. Android görselleri emülatörden (app/magaza/android).
// Çalıştırma: cd tests && MAGAZA=1 npx playwright test --project=magaza
import { test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { mobilAc } from '../yardimci/mobil.js';

// gerçek vakitler: canlı /api/vakit'in bir kopyası (MAGAZA_VAKIT=dosya); yoksa test verisi
const VAKIT = process.env.MAGAZA_VAKIT ? JSON.parse(fs.readFileSync(process.env.MAGAZA_VAKIT, 'utf8')) : undefined;

const CIKTI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', 'magaza', 'ios');
const GUN = '2026-11-07';
const BILDIRIM = JSON.stringify({ aan: true, once: 15, giris: true, vakitler: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] });
const CIHAZLAR = [
  ['iphone', { width: 440, height: 956 }, 3],
  ['ipad', { width: 1032, height: 1376 }, 2],
];
const EKRANLAR = [
  ['01-ana', '12:50', ''],
  ['02-ana-gece', '19:30', ''],
  ['03-ayarlar', '12:50', '#ayarlar'],
];

async function iphoneGibi(page) {
  await page.addInitScript(() => {
    const izin = { bildirim: 'granted', tamAlarm: true, sessiz: false };
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', nativePromise: async (_, m) => (m === 'izinDurumu' || m === 'bildirimIzniIste' ? izin : {}) };
  });
}

for (const [cihaz, viewport, olcek] of CIHAZLAR) {
  test.describe(cihaz, () => {
    test.use({ viewport, deviceScaleFactor: olcek });
    for (const dil of ['nl', 'tr']) {
      for (const [ad, saat, hash] of EKRANLAR) {
        test(`${dil} ${ad}`, async ({ page }) => {
          await iphoneGibi(page);
          await mobilAc(page, { zaman: `${GUN}T${saat}:00.500+01:00`, adres: '/mobil/' + hash, depo: { 'nzm.dil': dil, 'nzm.bildirim': BILDIRIM }, vakit: VAKIT });
          await page.clock.runFor(500);
          await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))));
          await page.screenshot({ path: path.join(CIKTI, dil, `${cihaz}-${ad}.png`) });
        });
      }
    }
  });
}
