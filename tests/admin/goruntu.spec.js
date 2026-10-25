// /admin referans görüntüleri: bilgisayar (1280×900) ve telefon (390×844).
import { test, expect } from '@playwright/test';
import { adminAc } from '../yardimci/admin.js';
import { sahteDepo } from '../yardimci/sahte-depo.js';
import { tasarimIcerik } from '../fixtures/tasarim-icerik.js';

const DURUMLAR = [
  { ad: '01-faaliyetler', adres: '' },
  { ad: '02-faaliyet-formu', adres: '#faaliyet/f-kahvalti' },
  { ad: '03-programlar', adres: '#programlar' },
  { ad: '04-program-formu', adres: '#program/p-tefsir' },
  { ad: '05-yetkisiz', adres: '', anahtar: null },
];

for (const d of DURUMLAR) {
  test(d.ad, async ({ page }) => {
    await adminAc(page, { zaman: '2026-10-28T16:00:00+01:00', depo: sahteDepo(tasarimIcerik()), anahtar: d.anahtar, adres: d.adres });
    await page.evaluate(() => document.fonts.ready);
    const genis = page.viewportSize().width > 800;
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 0.5), 'yatay kaydırma olmamalı').toBe(false);
    // yapışkan "Kaydet" çubuğu tam sayfa görüntüde ortada görünmesin
    await page.addStyleTag({ content: '.form-alt { position: static !important; }' });
    await expect(page).toHaveScreenshot(`${d.ad}.png`, { fullPage: genis });
  });
}
