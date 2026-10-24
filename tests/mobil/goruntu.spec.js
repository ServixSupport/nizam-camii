// Mobil uygulamanın referans görüntüleri: telefon 390×844, tablet dikey 820×1180, tablet yatay 1180×820.
// Her ekranda yatay kaydırma olmamalı.
import { test, expect } from '@playwright/test';
import { mobilAc, yatayTasma } from '../yardimci/mobil.js';

const GUN = '2026-10-28';      // Çarşamba
const DURUMLAR = [
  { ad: '01-ana-gunduz-tr', zaman: `${GUN}T16:00:00.500+01:00`, dil: 'tr' },
  { ad: '02-ana-gece-nl', zaman: `${GUN}T18:20:00.500+01:00`, dil: 'nl' },
  { ad: '03-ana-yatsi-sonrasi-tr', zaman: `${GUN}T21:30:00.500+01:00`, dil: 'tr' },
  { ad: '04-ana-sabah-en', zaman: `${GUN}T06:00:00.500+01:00`, dil: 'en' },
  { ad: '05-faaliyetler-nl', zaman: `${GUN}T16:00:00.500+01:00`, dil: 'nl', hash: '#faaliyetler' },
  { ad: '06-programlar-tr', zaman: `${GUN}T16:00:00.500+01:00`, dil: 'tr', hash: '#programlar' },
  { ad: '07-ayarlar-tr', zaman: `${GUN}T16:00:00.500+01:00`, dil: 'tr', hash: '#ayarlar' },
  { ad: '08-ayarlar-gece-nl', zaman: `${GUN}T21:30:00.500+01:00`, dil: 'nl', hash: '#ayarlar' },
];

for (const d of DURUMLAR) {
  test(d.ad, async ({ page }) => {
    await mobilAc(page, { zaman: d.zaman, adres: '/mobil/' + (d.hash || ''), depo: { 'nzm.dil': d.dil } });
    await page.clock.runFor(50);
    expect(await yatayTasma(page), 'yatay kaydırma olmamalı').toBe(false);
    await expect(page).toHaveScreenshot(`${d.ad}.png`, { fullPage: true });
  });
}
