// /admin testleri: /api/admin/* istekleri GERÇEK fonksiyonlara (api/admin/*.js) gider, sadece Blob deposu sahte.
import { expect } from '@playwright/test';
import { mockla } from './tv.js';
import { cagir, TEST_ANAHTAR } from './sahte-depo.js';
import { veriIsleyici } from '../../api/admin/veri.js';
import { kaydetIsleyici } from '../../api/admin/kaydet.js';
import { resimIsleyici } from '../../api/admin/resim.js';

/**
 * @param {import('@playwright/test').Page} page
 * @param {object} o
 * @param {string} o.zaman       sahte saat (sabit)
 * @param {object} o.depo        sahteDepo(...)
 * @param {string|null} [o.anahtar]  linkteki anahtar (null = anahtarsız cihaz)
 */
export async function adminAc(page, o) {
  process.env.ADMIN_ANAHTAR = TEST_ANAHTAR;
  const T = new Date(o.zaman).getTime();
  await mockla(page, {});
  const istekler = [];
  const isle = async (route, handler) => {
    const req = route.request();
    const body = req.postData() ? JSON.parse(req.postData()) : undefined;
    istekler.push({ yol: new URL(req.url()).pathname, method: req.method(), yetki: !!req.headers().authorization });
    const r = await cagir(handler, { method: req.method(), headers: req.headers(), body });
    return route.fulfill({ status: r.durum, contentType: 'application/json; charset=utf-8', body: JSON.stringify(r.govde) });
  };
  await page.route((u) => u.pathname === '/api/admin/veri', (r) => isle(r, veriIsleyici(o.depo)));
  await page.route((u) => u.pathname === '/api/admin/kaydet', (r) => isle(r, kaydetIsleyici(o.depo, () => T)));
  await page.route((u) => u.pathname === '/api/admin/resim', (r) => isle(r, resimIsleyici(o.depo)));
  await page.clock.setFixedTime(T);
  const anahtar = o.anahtar === undefined ? TEST_ANAHTAR : o.anahtar;
  await page.goto('/admin/' + (anahtar ? `#anahtar=${anahtar}` : ''));
  await expect(page.locator('#yetki')).not.toHaveText('…');
  if (o.adres) {                                        // anahtar linkinden sonra istenen bölüme geç
    await page.evaluate((a) => { location.hash = a; }, o.adres);
    await expect(page.locator('main > section:not([hidden])')).toHaveCount(1);
  }
  return istekler;
}
