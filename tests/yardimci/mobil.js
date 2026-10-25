// Mobil uygulama (/mobil/) testleri için yardımcılar. Mock'lar ve sahte saat TV ile aynı (tv.js).
import { expect } from '@playwright/test';
import { mockla } from './tv.js';

const PAY_MS = 2000;

/**
 * Uygulamayı verilen anda açar; saat durdurulmuş döner.
 * @param {object} o  tvAc ile aynı (zaman, depo, vakit, aladhan) + adres (varsayılan '/mobil/')
 * @param {boolean} [o.bekle=true]  vakit listesinin dolmasını bekle
 */
export async function mobilAc(page, o) {
  const T = new Date(o.zaman).getTime();
  if (Number.isNaN(T)) throw new Error('geçersiz zaman: ' + o.zaman);
  if (o.depo) {
    await page.addInitScript((depo) => {
      if (sessionStorage.getItem('__test_depo')) return;
      for (const [k, v] of Object.entries(depo)) localStorage.setItem(k, v);
      sessionStorage.setItem('__test_depo', '1');
    }, o.depo);
  }
  const kayit = await mockla(page, { icerikSaati: T, ...o });
  await page.clock.install({ time: T - PAY_MS - 1000 });
  await page.clock.pauseAt(T - PAY_MS);
  await page.goto(o.adres || '/mobil/');
  if (o.bekle !== false) await expect(page.locator('.vakitler li:not([hidden])')).toHaveCount(7);
  await page.evaluate(() => document.fonts.ready);
  await page.clock.runFor(PAY_MS);
  return kayit;
}

/** Ekrandaki 7 vakit: { Imsak: '05:34', … } */
export async function uygulamaVakitleri(page) {
  return page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('.vakitler li')].map((li) => [li.dataset.key, li.querySelector('.v-saat').textContent]),
  ));
}

/** Yatay kaydırma var mı? (sayfa genişliği ekrandan büyükse true) */
export async function yatayTasma(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 0.5);
}
