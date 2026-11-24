// /admin testleri: /api/admin/* istekleri GERÇEK fonksiyonlara (api/admin/*.js) gider, sadece Blob deposu sahte.
import { expect } from '@playwright/test';
import { mockla } from './tv.js';
import { cagir, TEST_ANAHTAR } from './sahte-depo.js';
import { veriIsleyici } from '../../api/admin/veri.js';
import { kaydetIsleyici } from '../../api/admin/kaydet.js';
import { resimIsleyici } from '../../api/admin/resim.js';
import fs from 'node:fs';

// vercel.json'daki CSP testte de uygulanır: panel canlıdaki kurallarla çalışmalı (güvenlik başlıkları, 24-11-2026)
const VERCEL = JSON.parse(fs.readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
export const ADMIN_CSP = VERCEL.headers.find((k) => k.source === '/admin/:yol*').headers.find((x) => x.key === 'Content-Security-Policy').value;

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
  await page.route((u) => u.pathname === '/admin/' || u.pathname === '/admin', async (r) => {
    const yanit = await r.fetch();
    await r.fulfill({ response: yanit, headers: { ...yanit.headers(), 'content-security-policy': ADMIN_CSP } });
  });
  // CSP ihlali olursa test görsün (window.__csp)
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
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
