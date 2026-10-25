// Faz C — yüklenebilir uygulama (PWA): manifest, ikonlar, service worker, internetsiz açılış, yeni sürüm.
import { test, expect, devices } from '@playwright/test';
import { mobilAc } from '../yardimci/mobil.js';
import { mockla } from '../yardimci/tv.js';
import { surumHesapla } from '../araclar/sw-surum.mjs';

const ZAMAN = '2026-10-28T16:00:00.500+01:00';
const pngBoyut = (buf) => [buf.readUInt32BE(16), buf.readUInt32BE(20)];

test.describe('manifest ve ikonlar', () => {
  test('manifest geçerli; ikonlar doğru boyutta', async ({ page, request }) => {
    await mobilAc(page, { zaman: ZAMAN });
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('/mobil/manifest.webmanifest');
    const m = await (await request.get(href)).json();
    expect(m).toMatchObject({ name: 'Nizam-ı Alem Süleymaniye Camii', short_name: 'Nizam Camii', start_url: '/mobil/', scope: '/mobil/', display: 'standalone' });
    expect(m.icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
    for (const i of m.icons) {
      const r = await request.get(i.src);
      expect(r.ok(), i.src).toBe(true);
      expect(pngBoyut(await r.body()).join('x')).toBe(i.sizes);
    }
    const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    expect(pngBoyut(await (await request.get(apple)).body())).toEqual([180, 180]);
  });

  test('service worker sürümü uygulama dosyalarıyla güncel (değilse: node araclar/sw-surum.mjs)', () => {
    const { surum, mevcut } = surumHesapla();
    expect(mevcut).toBe(surum);
  });
});

test.describe('service worker', () => {
  test.use({ serviceWorkers: 'allow' });
  test.describe.configure({ mode: 'serial' });

  async function kontrolEdilene(page) {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  }

  test('internet yokken uygulama açılır: bugünün vakitleri ve geri sayım', async ({ page, context }) => {
    await mobilAc(page, { zaman: ZAMAN });
    await kontrolEdilene(page);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.vakitler li:not([hidden])')).toHaveCount(7);
    await page.clock.runFor(1000);
    await expect(page.locator('.vakitler li[data-key="Maghrib"] .v-saat')).toHaveText('17:27');
    await expect(page.locator('.sayac')).toHaveText(/^\d:\d\d:\d\d$/);
    await expect(page.locator('.menu-oge')).toHaveCount(4);
    await context.setOffline(false);
  });

  test('TV sayfası service worker\'a girmez', async ({ page }) => {
    await mobilAc(page, { zaman: ZAMAN });
    await kontrolEdilene(page);
    await page.goto('/?ekran=tv');
    await expect(page.locator('#stage')).toBeVisible();
    expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
  });

  test('yeni sürüm: kendiliğinden yenilenmez, "Yenile"ye dokununca geçer', async ({ page, request }) => {
    await mobilAc(page, { zaman: ZAMAN });
    await kontrolEdilene(page);
    await expect(page.locator('#surum-cubugu')).toBeHidden();
    try {
      await request.get('/__test/sw-ek?v=yeni');
      await page.evaluate(async () => (await navigator.serviceWorker.getRegistration('/mobil/')).update());
      await expect(page.locator('#surum-cubugu')).toBeVisible();
      await expect(page.locator('#surum-cubugu')).toContainText('Nieuwe versie klaar');
      await page.clock.runFor(5000);
      expect(new URL(page.url()).pathname).toBe('/mobil/');                    // kendiliğinden yenilenmedi
      const yenilendi = page.waitForEvent('load');
      await page.getByRole('button', { name: 'Vernieuwen' }).click();
      await yenilendi;
      await expect(page.locator('#surum-cubugu')).toBeHidden();
    } finally {
      await request.get('/__test/sw-ek?v=');
    }
  });
});

test.describe('yükleme kartı (Ayarlar)', () => {
  test('iPhone (Safari): Paylaş → "Zet op beginscherm" açıklaması', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await context.newPage();
    await mockla(page);
    await page.goto('/mobil/#ayarlar');
    await expect(page.locator('#kurulum')).toBeVisible();
    await expect(page.locator('#kurulum')).toContainText('Zet de app op je beginscherm');
    await expect(page.locator('#kurulum-metin')).toContainText('Tik in Safari op Deel');
    await expect(page.locator('#kurulum-dugme')).toBeHidden();
    await context.close();
  });

  test('iPhone: zaten ana ekrandaysa kart yok', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await context.newPage();
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }));
    await mockla(page);
    await page.goto('/mobil/#ayarlar');
    await expect(page.locator('#s-ayarlar h1')).toBeVisible();
    await expect(page.locator('#kurulum')).toBeHidden();
    await context.close();
  });

  test('Android Chrome: "Installeren" düğmesi tarayıcının yükleme penceresini açar', async ({ page }) => {
    await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#ayarlar' });
    await expect(page.locator('#kurulum')).toBeHidden();                       // olay gelmeden kart yok
    await page.evaluate(() => {
      const e = new Event('beforeinstallprompt', { cancelable: true });
      e.prompt = () => { window.__istem = (window.__istem || 0) + 1; };
      e.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(e);
    });
    await expect(page.locator('#kurulum')).toBeVisible();
    await page.getByRole('button', { name: 'Installeren' }).click();
    expect(await page.evaluate(() => window.__istem)).toBe(1);
    await expect(page.locator('#kurulum')).toBeHidden();
  });
});
