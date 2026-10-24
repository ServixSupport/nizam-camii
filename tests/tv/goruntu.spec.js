// TV ekranının referans görüntüleri — Faz 0.
// Referanslar tv/__goruntuler__/<proje>/ altında. Sonraki fazlarda TV değişmemeli:
// bu test kırmızıysa önce TV'yi neyin değiştirdiğini bul, referansı güncelleme.
// Bilerek değiştirilirse: npm run goruntu-guncelle (ve kullanıcıya göster).
import { test, expect } from '@playwright/test';
import { tvAc, HUTBE } from '../yardimci/tv.js';

const GUN = '2026-10-28';                // Çarşamba
const CUMA = '2026-10-30';

// kucuk: true → 1366×768 ve 960×540'ta da çekilir
const DURUMLAR = [
  { ad: '01-gunduz-normal', zaman: `${GUN}T10:05:00.500+01:00`, kucuk: true },
  { ad: '02-gece-normal', zaman: `${GUN}T21:05:00.500+01:00`, kucuk: true },
  { ad: '03-hazirlik-sayaci', zaman: `${GUN}T12:28:30.500+01:00`, kucuk: true },
  { ad: '04-ezan-vakti', zaman: `${GUN}T12:29:10.500+01:00` },
  { ad: '05-imsak-vakti', zaman: `${GUN}T05:34:10.500+01:00` },
  { ad: '06-sabah-vakti', zaman: `${GUN}T06:21:10.500+01:00` },
  { ad: '07-ayet', zaman: `${GUN}T10:05:00.500+01:00`, adres: '/?test=ayet', kucuk: true },
  { ad: '08-hadis', zaman: `${GUN}T10:05:00.500+01:00`, adres: '/?test=hadis' },
  { ad: '09-dua', zaman: `${GUN}T10:05:00.500+01:00`, adres: '/?test=dua' },
  { ad: '10-cuma-hutbesi', zaman: `${CUMA}T12:40:00.500+01:00`, hutbe: HUTBE, kucuk: true },
  { ad: '11-tema-koyu-gunduz', zaman: `${GUN}T10:05:00.500+01:00`, adres: '/?theme=dark' },
  { ad: '12-tema-acik-gece', zaman: `${GUN}T21:05:00.500+01:00`, adres: '/?theme=light' },
  { ad: '13-tema-yesil', zaman: `${GUN}T10:05:00.500+01:00`, adres: '/?theme=green' },
  { ad: '14-ayarlar', zaman: `${GUN}T10:05:00.500+01:00`, ayarlar: true },
];

for (const d of DURUMLAR) {
  test(d.ad, async ({ page }, info) => {
    test.skip(info.project.name !== 'tv-1920' && !d.kucuk, 'sadece 1920×1080');
    await tvAc(page, { zaman: d.zaman, adres: d.adres, hutbe: d.hutbe });
    if (d.ayarlar) await page.locator('#gear').click();
    await page.clock.runFor(50);   // requestAnimationFrame ile yapılan son değişiklikler
    await expect(page).toHaveScreenshot(`${d.ad}.png`);
  });
}

test('sahne ekrana göre ölçeklenir', async ({ page }, info) => {
  await tvAc(page, { zaman: `${GUN}T10:05:00.500+01:00` });
  const { width, height } = info.project.use.viewport;
  const olcek = Math.min(width / 1920, height / 1080);
  const yazilan = await page.locator('#stage').evaluate((e) => e.style.transform);
  const m = yazilan.match(/^translate\(-50%, -50%\) scale\(([\d.]+)\)$/);
  expect(m, yazilan).not.toBeNull();
  expect(Number(m[1])).toBeCloseTo(olcek, 5);
});
