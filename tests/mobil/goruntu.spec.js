// Mobil uygulamanın referans görüntüleri: telefon 390×844, tablet dikey 820×1180, tablet yatay 1180×820.
// Her ekranda yatay kaydırma olmamalı.
import { test, expect } from '@playwright/test';
import { mobilAc, yatayTasma } from '../yardimci/mobil.js';
import { tasarimIcerik } from '../fixtures/tasarim-icerik.js';

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
  // Faz B: içerikli ekranlar (tasarımdaki örnek içerik)
  { ad: '09-faaliyetler-icerikli-tr', zaman: `${GUN}T16:00:00.500+01:00`, dil: 'tr', hash: '#faaliyetler', icerik: true },
  { ad: '10-faaliyet-detay-nl', zaman: `${GUN}T16:00:00.500+01:00`, dil: 'nl', hash: '#faaliyet/f-kahvalti', icerik: true },
  { ad: '11-programlar-icerikli-tr', zaman: `${GUN}T16:00:00.500+01:00`, dil: 'tr', hash: '#programlar', icerik: true },
  { ad: '12-ana-icerikli-tr', zaman: `${GUN}T16:00:00.500+01:00`, dil: 'tr', icerik: true },
  { ad: '14-faaliyetler-resimli-nl', zaman: `${GUN}T16:00:00.500+01:00`, dil: 'nl', hash: '#faaliyetler', icerik: true, resim: true },
  { ad: '15-detay-dikey-resim-tr', zaman: `${GUN}T16:00:00.500+01:00`, dil: 'tr', hash: '#faaliyet/f-kahvalti', icerik: true, resim: true },
  { ad: '13-programlar-gece-nl', zaman: `${GUN}T21:30:00.500+01:00`, dil: 'nl', hash: '#programlar', icerik: true },
];

function icerikHazirla(d) {
  const ic = tasarimIcerik();
  if (d.resim) ic.faaliyetler[0].resim = 'https://test0store.public.blob.vercel-storage.com/preview/resimler/poster.jpg';
  return ic;
}

for (const d of DURUMLAR) {
  test(d.ad, async ({ page }) => {
    await mobilAc(page, { zaman: d.zaman, adres: '/mobil/' + (d.hash || ''), depo: { 'nzm.dil': d.dil }, icerik: d.icerik ? icerikHazirla(d) : undefined });
    await page.clock.runFor(50);
    await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))));
    expect(await yatayTasma(page), 'yatay kaydırma olmamalı').toBe(false);
    await expect(page).toHaveScreenshot(`${d.ad}.png`, { fullPage: true });
  });
}
