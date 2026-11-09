// Mobil uygulamanın referans görüntüleri: telefon 390×844, tablet dikey 820×1180, tablet yatay 1180×820.
// Her ekranda yatay kaydırma olmamalı.
import { test, expect } from '@playwright/test';
import { mobilAc, yatayTasma } from '../yardimci/mobil.js';
import { tasarimIcerik } from '../fixtures/tasarim-icerik.js';
import { bildirimKur } from '../yardimci/bildirim-tarayici.js';

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
  // Faz D: bildirimler açık (tasarımdaki seçim + İmsak kapalı), ana ekranda ziller
  { ad: '16-ana-ziller-nl', zaman: `${GUN}T16:00:00.500+01:00`, dil: 'nl', bildirim: true },
  { ad: '17-ayarlar-bildirim-tr', zaman: `${GUN}T16:00:00.500+01:00`, dil: 'tr', hash: '#ayarlar', bildirim: true },
  { ad: '18-ayarlar-bildirim-gece-en', zaman: `${GUN}T21:30:00.500+01:00`, dil: 'en', hash: '#ayarlar', bildirim: true },
  // "Liste" tasarımı (07-11-2026): açık ve koyu
  { ad: '23-ana-liste-gunduz-tr', zaman: `${GUN}T16:00:00.500+01:00`, dil: 'tr', stil: 'liste' },
  { ad: '24-ana-liste-gece-nl', zaman: `${GUN}T21:30:00.500+01:00`, dil: 'nl', stil: 'liste' },
  { ad: '25-ayarlar-liste-gece-en', zaman: `${GUN}T21:30:00.500+01:00`, dil: 'en', hash: '#ayarlar', stil: 'liste', bildirim: true },
  // Tema 3 (09-11-2026): lacivert, karolu sayaç, oklu tarih
  { ad: '26-ana-tema3-tr', zaman: `${GUN}T12:00:00.500+01:00`, dil: 'tr', stil: 'cini', tema: 'gece' },
  { ad: '27-ana-tema3-ziller-nl', zaman: `${GUN}T16:00:00.500+01:00`, dil: 'nl', stil: 'cini', tema: 'gece', bildirim: true },
  { ad: '28-ayarlar-tema3-nl', zaman: `${GUN}T16:00:00.500+01:00`, dil: 'nl', hash: '#ayarlar', stil: 'cini', tema: 'gece', bildirim: true },
  { ad: '29-programlar-tema3-tr', zaman: `${GUN}T16:00:00.500+01:00`, dil: 'tr', hash: '#programlar', stil: 'cini', tema: 'gece', icerik: true },
  // Tema 3'ün açık hali (09-11-2026)
  { ad: '30-ana-tema3-acik-tr', zaman: `${GUN}T12:00:00.500+01:00`, dil: 'tr', stil: 'cini', tema: 'gunduz' },
  { ad: '31-ana-tema3-acik-ziller-nl', zaman: `${GUN}T16:00:00.500+01:00`, dil: 'nl', stil: 'cini', tema: 'gunduz', bildirim: true },
  { ad: '32-ayarlar-tema3-acik-nl', zaman: `${GUN}T16:00:00.500+01:00`, dil: 'nl', hash: '#ayarlar', stil: 'cini', tema: 'gunduz', bildirim: true },
  { ad: '33-programlar-tema3-acik-tr', zaman: `${GUN}T16:00:00.500+01:00`, dil: 'tr', hash: '#programlar', stil: 'cini', tema: 'gunduz', icerik: true },
  { ad: '34-faaliyetler-tema3-acik-nl', zaman: `${GUN}T16:00:00.500+01:00`, dil: 'nl', hash: '#faaliyetler', stil: 'cini', tema: 'gunduz', icerik: true },
  // iPhone: Apple yükleme düğmesine izin vermez; Ayarlar'da adım adım "Ana Ekrana Ekle" (06-11-2026)
  { ad: '22-ayarlar-iphone-tr', zaman: `${GUN}T16:00:00.500+01:00`, dil: 'tr', hash: '#ayarlar', ios: true },
];
const BILDIRIM_ACIK = JSON.stringify({ aan: true, once: 15, giris: true, vakitler: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'], endpoint: '', esitleme: 0 });

function icerikHazirla(d) {
  const ic = tasarimIcerik();
  if (d.resim) ic.faaliyetler[0].resim = 'https://test0store.public.blob.vercel-storage.com/preview/resimler/poster.jpg';
  return ic;
}

for (const d of DURUMLAR) {
  test(d.ad, async ({ page }) => {
    if (d.bildirim) await bildirimKur(page, { zaman: d.zaman, onceden: true });
    if (d.ios) await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'userAgent', { get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1' }));
    const depo = { 'nzm.dil': d.dil, ...(d.stil ? { 'nzm.stil': d.stil } : {}), ...(d.tema ? { 'nzm.tema': d.tema } : {}), ...(d.bildirim ? { 'nzm.bildirim': BILDIRIM_ACIK } : {}) };
    await mobilAc(page, { zaman: d.zaman, adres: '/mobil/' + (d.hash || ''), depo, icerik: d.icerik ? icerikHazirla(d) : undefined });
    if (d.bildirim) await expect(page.locator('.v-zil[aria-pressed="true"]')).toHaveCount(5);
    await page.clock.runFor(50);
    await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))));
    expect(await yatayTasma(page), 'yatay kaydırma olmamalı').toBe(false);
    await expect(page).toHaveScreenshot(`${d.ad}.png`, { fullPage: true });
  });
}
