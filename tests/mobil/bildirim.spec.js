// Faz D — bildirimler (uygulama): Ayarlar'daki bölüm ve ana ekrandaki ziller.
// /api/bildirim/* gerçek fonksiyonlar (sahte Upstash/QStash); tarayıcının push servisi taklit.
import { test, expect, devices } from '@playwright/test';
import { mobilAc } from '../yardimci/mobil.js';
import { bildirimKur } from '../yardimci/bildirim-tarayici.js';
import { mockla } from '../yardimci/tv.js';

const ZAMAN = '2026-10-28T10:00:00.500+01:00';
const ana = (page) => page.getByRole('switch', { name: 'Meldingen voor gebedstijden' });
const zil = (page, ad) => page.locator(`.vakitler li[data-key="${ad}"] .v-zil`);
const basili = async (loc) => (await loc.locator('[aria-pressed="true"]').allTextContents()).map((s) => s.trim());

test('sunucu kurulmamışsa bildirim bölümü ve ziller hiç görünmez', async ({ page }) => {
  await bildirimKur(page, { zaman: ZAMAN, aktif: false });
  await mobilAc(page, { zaman: ZAMAN });
  await expect(page.locator('.v-zil:visible')).toHaveCount(0);
  await page.goto('/mobil/#ayarlar');
  await expect(page.locator('#s-ayarlar h1')).toBeVisible();
  await expect(page.locator('#bildirim-ayar')).toBeHidden();
});

test('tasarımdaki başlangıç ayarı; sayfa açılınca izin İSTENMEZ', async ({ page }) => {
  const b = await bildirimKur(page, { zaman: ZAMAN });
  await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#ayarlar' });
  await expect(page.locator('#bildirim-ayar')).toBeVisible();
  await expect(page.locator('#bildirim-ayar h2')).toHaveText('MELDINGEN');
  await expect(ana(page)).toHaveAttribute('aria-checked', 'false');
  expect(await basili(page.locator('#b-once'))).toEqual(['15 min']);
  await expect(page.locator('#b-once button')).toHaveText(['Uit', '5 min', '10 min', '15 min', '30 min']);
  await expect(page.getByRole('switch', { name: 'Melding bij begin gebedstijd' })).toHaveAttribute('aria-checked', 'true');
  expect(await basili(page.locator('#b-vakitler'))).toEqual(['Fadjr', 'Dhoehr', 'Asr', 'Maghrib', 'Isha']);
  await expect(page.locator('#b-secenekler')).toHaveClass(/soluk/);
  await expect(page.locator('.b-gizlilik')).toContainText('Geen naam, account of IP-adres');
  expect(await page.evaluate(() => window.__test.izinSorulan)).toBe(0);
  expect(b.istekler.filter((i) => i.yol === '/api/bildirim/abone')).toHaveLength(0);
});

test('aç → izin bir kez, abonelik sunucuda; ayarlar ve dil değişince sunucu güncellenir; kapat → silinir', async ({ page }) => {
  const b = await bildirimKur(page, { zaman: ZAMAN });
  await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#ayarlar' });
  await ana(page).click();
  await expect(ana(page)).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.bildirim')).toHaveText('Meldingen staan aan');
  expect(await page.evaluate(() => window.__test)).toMatchObject({ izinSorulan: 1, aboneOlunan: 1 });
  expect(b.kayitlar()).toEqual([expect.objectContaining({ abonelik: b.abonelik, dil: 'nl', vakitler: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'], once: 15, giris: true })]);
  await expect(page.locator('#b-secenekler')).not.toHaveClass(/soluk/);
  expect(b.ortam._.kuyrukta.length).toBeGreaterThan(35);                   // bugün + yarın zamanlandı

  // seçimler: hemen değil, kısa bir beklemeden sonra tek istekle
  await page.locator('#b-once').getByRole('button', { name: '5 min', exact: true }).click();
  await page.locator('#b-vakitler').getByRole('button', { name: 'Imsak' }).click();
  await page.getByRole('switch', { name: 'Melding bij begin gebedstijd' }).click();
  await page.clock.runFor(600);
  await expect.poll(() => b.kayitlar()[0]).toMatchObject({ once: 5, giris: false, vakitler: ['Imsak', 'Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] });
  expect(b.istekler.filter((i) => i.yol === '/api/bildirim/abone')).toHaveLength(2);

  await page.getByRole('button', { name: 'Türkçe' }).click();
  await page.clock.runFor(600);
  await expect.poll(() => b.kayitlar()[0].dil).toBe('tr');
  await expect(page.getByRole('switch', { name: 'Namaz vakti bildirimleri' })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('switch', { name: 'Namaz vakti bildirimleri' }).click();
  await expect(page.getByRole('switch', { name: 'Namaz vakti bildirimleri' })).toHaveAttribute('aria-checked', 'false');
  await expect.poll(() => b.kayitlar()).toEqual([]);
  expect(await page.evaluate(() => window.__test.aboneliktenCikilan)).toBe(1);
  await expect(page.locator('.bildirim')).toHaveText('Bildirimler kapalı');
});

test('ana ekrandaki ziller: açıkken vakit açılıp kapanır; kapalıyken dokununca bildirimler açılır', async ({ page }) => {
  const b = await bildirimKur(page, { zaman: ZAMAN });
  await mobilAc(page, { zaman: ZAMAN });
  await expect(page.locator('.v-zil:visible')).toHaveCount(7);
  await expect(zil(page, 'Isha')).toHaveAttribute('aria-label', 'Melding voor Isha uit');
  await zil(page, 'Imsak').click();                                         // izin penceresi → açılır, İmsak da eklenir
  await expect(zil(page, 'Imsak')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => b.kayitlar()[0] && b.kayitlar()[0].vakitler).toEqual(['Imsak', 'Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
  expect(await page.evaluate(() => window.__test.izinSorulan)).toBe(1);
  await expect(zil(page, 'Sunrise')).toHaveAttribute('aria-pressed', 'false');

  await zil(page, 'Isha').click();
  await expect(zil(page, 'Isha')).toHaveAttribute('aria-pressed', 'false');
  await expect(zil(page, 'Isha')).toHaveAttribute('aria-label', 'Melding voor Isha uit');
  await expect(page.locator('.bildirim')).toHaveText('Melding voor Isha uit');
  await page.clock.runFor(600);
  await expect.poll(() => b.kayitlar()[0].vakitler).toEqual(['Imsak', 'Fajr', 'Dhuhr', 'Asr', 'Maghrib']);
  // ana ekran yine kaymaz, Isha menünün üstünde
  const isha = await page.locator('li[data-key="Isha"]').boundingBox();
  const menu = await page.locator('.menu').boundingBox();
  expect(isha.y + isha.height).toBeLessThanOrEqual(menu.y + 1);
});

test('izin verilmezse açıklama çıkar, kapalı kalır', async ({ page }) => {
  const b = await bildirimKur(page, { zaman: ZAMAN, izinCevabi: 'denied' });
  await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#ayarlar' });
  await ana(page).click();
  await expect(page.locator('#b-mesaj')).toHaveText('Meldingen zijn niet toegestaan. Je kunt ze aanzetten in de instellingen van je telefoon.');
  await expect(ana(page)).toHaveAttribute('aria-checked', 'false');
  expect(b.kayitlar()).toEqual([]);
});

test('izin sonradan telefonun ayarlarından kaldırıldıysa: açılışta kapalı görünür', async ({ page }) => {
  await bildirimKur(page, { zaman: ZAMAN });
  await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#ayarlar' });
  await ana(page).click();
  await expect(ana(page)).toHaveAttribute('aria-checked', 'true');
  await page.evaluate(() => sessionStorage.setItem('__izin', 'denied'));
  await page.reload();
  await expect(ana(page)).toHaveAttribute('aria-checked', 'false');
});

test('iPhone, Safari\'de (ana ekranda değil): açıklama gösterilir, izin sorulmaz', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  await bildirimKur(page, { zaman: ZAMAN, destek: false });
  await mockla(page);
  await page.goto('/mobil/');
  await expect(page.locator('.v-zil:visible')).toHaveCount(7);
  await page.locator('.vakitler li[data-key="Maghrib"] .v-zil').click();    // zil → Ayarlar'daki açıklamaya gider
  await expect(page).toHaveURL(/#ayarlar$/);
  await expect(page.locator('#b-mesaj')).toContainText('Op de iPhone werken meldingen alleen als de app op het beginscherm staat');
  await expect(page.getByRole('switch', { name: 'Meldingen voor gebedstijden' })).toHaveAttribute('aria-checked', 'false');
  await context.close();
});

test('ziller varken vakit satırlarında yazılar üst üste binmez, kısalmaz (telefon ve tablet, üç dil)', async ({ page }) => {
  await bildirimKur(page, { zaman: ZAMAN, onceden: true });
  await mobilAc(page, { zaman: ZAMAN, depo: { 'nzm.bildirim': JSON.stringify({ aan: true, once: 15, giris: true, vakitler: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] }) } });
  for (const [w, h] of [[360, 640], [390, 844], [820, 1180], [1024, 768], [1133, 744], [1180, 820], [1366, 1024]]) {
    await page.setViewportSize({ width: w, height: h });
    for (const dil of ['nl', 'tr', 'en']) {
      await page.evaluate((d) => localStorage.setItem('nzm.dil', d), dil);
      await page.reload();
      await expect(page.locator('.v-zil[aria-pressed="true"]')).toHaveCount(5);
      await page.evaluate(() => document.fonts.ready);
      const sorunlar = await page.evaluate(() => [...document.querySelectorAll('.vakitler li')].flatMap((li) => {
        const r = (s) => li.querySelector(s).getBoundingClientRect();
        const ad = li.querySelector('.v-ad');
        const [satir, a, saat, zil] = [li.getBoundingClientRect(), r('.v-ad'), r('.v-saat'), r('.v-zil svg')];
        const s = [];
        if (ad.scrollWidth > ad.clientWidth + 1) s.push('ad kısaldı');
        if (a.right > saat.left - 2) s.push('ad saate değiyor');
        if (saat.right > zil.left - 2) s.push('saat zile değiyor');
        if (zil.right > satir.right - 2) s.push('zil taşıyor');
        return s.map((x) => `${li.dataset.key}: ${x}`);
      }));
      expect(sorunlar, `${w}×${h} ${dil}`).toEqual([]);
    }
  }
});
