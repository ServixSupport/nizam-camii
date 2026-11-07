// TV ekranının referans görüntüleri — Faz 0.
// Referanslar tv/__goruntuler__/<proje>/ altında. Sonraki fazlarda TV değişmemeli:
// bu test kırmızıysa önce TV'yi neyin değiştirdiğini bul, referansı güncelleme.
// Bilerek değiştirilirse: npm run goruntu-guncelle (ve kullanıcıya göster).
import { test, expect } from '@playwright/test';
import { tvAc, HUTBE } from '../yardimci/tv.js';
import { tasarimIcerik } from '../fixtures/tasarim-icerik.js';

const GUN = '2026-10-28';                // Çarşamba
const CUMA = '2026-10-30';
const PAZARTESI = '2026-10-26';

// kucuk: true → 1366×768 ve 960×540'ta da çekilir
const DURUMLAR = [
  { ad: '01-gunduz-normal', zaman: `${GUN}T10:05:00.500+01:00`, adres: '/?theme=light', kucuk: true },
  { ad: '02-gece-normal', zaman: `${GUN}T21:05:00.500+01:00`, adres: '/?theme=dark', kucuk: true },
  { ad: '03-hazirlik-sayaci', zaman: `${GUN}T12:28:30.500+01:00`, adres: '/?theme=light', kucuk: true },
  { ad: '04-ezan-vakti', zaman: `${GUN}T12:29:10.500+01:00`, adres: '/?theme=light' },
  { ad: '05-imsak-vakti', zaman: `${GUN}T05:34:10.500+01:00`, adres: '/?theme=dark' },
  { ad: '06-sabah-vakti', zaman: `${GUN}T06:21:10.500+01:00`, adres: '/?theme=dark' },
  { ad: '07-ayet', zaman: `${GUN}T10:05:00.500+01:00`, adres: '/?test=ayet&theme=light', kucuk: true },
  { ad: '08-hadis', zaman: `${GUN}T10:05:00.500+01:00`, adres: '/?test=hadis&theme=light' },
  { ad: '09-dua', zaman: `${GUN}T10:05:00.500+01:00`, adres: '/?test=dua&theme=light' },
  { ad: '10-cuma-hutbesi', zaman: `${CUMA}T12:40:00.500+01:00`, adres: '/?theme=light', hutbe: HUTBE, kucuk: true },
  { ad: '11-tema-koyu-gunduz', zaman: `${GUN}T10:05:00.500+01:00`, adres: '/?theme=dark' },
  { ad: '12-tema-acik-gece', zaman: `${GUN}T21:05:00.500+01:00`, adres: '/?theme=light' },
  { ad: '13-tema-krem', zaman: `${GUN}T10:05:00.500+01:00`, adres: '/?theme=krem', kucuk: true },
  { ad: '14-ayarlar', zaman: `${GUN}T10:05:00.500+01:00`, ayarlar: true },
  // krem tema (yeşilin yerine, 04-11-2026; 07-11-2026'dan beri uygulamanın tasarımı: kemer, liste, /admin kutuları)
  { ad: '15-krem-ayet', zaman: `${GUN}T10:05:00.500+01:00`, adres: '/?theme=krem&test=ayet' },
  { ad: '16-krem-hazirlik', zaman: `${GUN}T12:28:30.500+01:00`, adres: '/?theme=krem' },
  { ad: '17-krem-ezan', zaman: `${GUN}T12:29:10.500+01:00`, adres: '/?theme=krem' },
  { ad: '18-krem-hutbe', zaman: `${CUMA}T12:40:00.500+01:00`, adres: '/?theme=krem', hutbe: HUTBE },
  // Hollandaca (5 dk'da bir Türkçe ile değişir)
  { ad: '19-krem-hollandaca', zaman: `${GUN}T10:05:00.500+01:00`, adres: '/?theme=krem', dil: 'nl' },
  { ad: '20-koyu-hollandaca-gece', zaman: `${GUN}T21:05:00.500+01:00`, adres: '/?theme=dark', dil: 'nl', kucuk: true },
  // krem: /admin içeriğiyle (örnek içerik, tests/fixtures/tasarim-icerik.js) ve gece (ay)
  { ad: '21-krem-icerikli', zaman: `${PAZARTESI}T10:00:30.500+01:00`, adres: '/?theme=krem', icerik: true, kucuk: true },
  { ad: '22-krem-icerikli-hollandaca', zaman: `${GUN}T16:07:00.500+01:00`, adres: '/?theme=krem', dil: 'nl', icerik: true },
  { ad: '23-krem-gece', zaman: `${GUN}T21:05:00.500+01:00`, adres: '/?theme=krem' },
];

for (const d of DURUMLAR) {
  test(d.ad, async ({ page }, info) => {
    test.skip(info.project.name !== 'tv-1920' && !d.kucuk, 'sadece 1920×1080');
    await tvAc(page, { zaman: d.zaman, adres: d.adres, hutbe: d.hutbe, dil: d.dil,
      ...(d.icerik ? { icerik: tasarimIcerik(), icerikSaati: new Date(d.zaman).getTime() } : {}) });
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
