// Mobil uygulama (/mobil/) — Faz A davranış testleri (telefon, 390×844).
// Test günü Çarşamba 28-10-2026 (TV testleriyle aynı veri).
import { test, expect, devices } from '@playwright/test';
import { mobilAc, uygulamaVakitleri } from '../yardimci/mobil.js';
import { tvAc, ileri, saatGit, vakitleriOku, VAKIT, HUTBE, mockla } from '../yardimci/tv.js';

const an = (saat, gun = '2026-10-28', ofset = '+01:00') => `${gun}T${saat}${ofset}`;
const DIYANET_28 = { Imsak: '05:34', Fajr: '06:21', Sunrise: '07:21', Dhuhr: '12:29', Asr: '14:54', Maghrib: '17:27', Isha: '19:02' };
const tema = async (page) => { await page.clock.runFor(50); return page.evaluate(() => document.documentElement.dataset.tema); };

test.describe('ana ekran', () => {
  test('ilk açılış Hollandaca; vakitler Diyanet\'ten, Sabah = Güneş − 60', async ({ page }) => {
    await mobilAc(page, { zaman: an('16:00:00.500') });
    await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
    expect(await uygulamaVakitleri(page)).toEqual(DIYANET_28);
    await expect(page.locator('.vakitler .v-ad')).toHaveText(['Imsak', 'Fadjr', 'Zonsopgang', 'Dhoehr', 'Asr', 'Maghrib', 'Isha']);
    await expect(page.locator('.miladi')).toHaveText('WOENSDAG · 28 OKTOBER 2026');
    await expect(page.locator('.hicri')).toHaveText('17 Jumada al-Awwal 1448');
    await expect(page.locator('.menu-oge span')).toHaveText(['Home', 'Activiteiten', 'Programma’s', 'Instellingen']);
  });

  test('geri sayım, şimdiki ve sıradaki vakit', async ({ page }) => {
    await mobilAc(page, { zaman: an('16:00:00.500') });
    await expect(page.locator('.kalan-etiket')).toHaveText('NOG TOT MAGHRIB');
    await expect(page.locator('.sayac')).toHaveText('1:26:59');
    await expect(page.locator('.sira-ad')).toHaveText('Maghrib');
    await expect(page.locator('.sira-saat')).toHaveText('17:27');
    await expect(page.locator('.sira-ar')).toHaveText('المغرب');
    await ileri(page, 1000);
    await expect(page.locator('.sayac')).toHaveText('1:26:58');
    await expect(page.locator('li[data-key="Asr"]')).toHaveClass(/\bsimdi\b/);
    await expect(page.locator('li[data-key="Asr"] .v-simdi')).toHaveText('NU');
    await expect(page.locator('li[data-key="Maghrib"]')).toHaveClass(/\bsiradaki\b/);
    await expect(page.locator('li.siradaki')).toHaveCount(1);
    await expect(page.locator('li.gecti')).toHaveCount(5);
  });

  test('kemer: ilerleme ve noktalar gerçek saatlerden', async ({ page }) => {
    await mobilAc(page, { zaman: an('16:00:00.500') });
    // (16:00 − 05:34) / (19:02 − 05:34) = 0,7748
    await expect(page.locator('.k-ilerleme')).toHaveAttribute('stroke-dasharray', '774.8 1000');
    await expect(page.locator('.kemer-svg [data-durum="siradaki"]')).toHaveAttribute('data-key', 'Maghrib');
    await expect(page.locator('.kemer-svg [data-durum="gecti"]')).toHaveCount(5);
    await expect(page.locator('.kemer-svg [data-gok="gunes"]')).toHaveCount(1);
    const imsak = page.locator('.kemer-svg [data-key="Imsak"]');
    await expect(imsak).toHaveAttribute('cx', '16');
    await expect(imsak).toHaveAttribute('cy', '348');
    const yatsi = page.locator('.kemer-svg [data-key="Isha"]');
    await expect(yatsi).toHaveAttribute('cx', '284');

    await saatGit(page, an('18:20:00.500'));                     // Akşam'dan sonra: ay
    await expect(page.locator('.kemer-svg [data-gok="ay"]')).toHaveCount(1);
    await expect(page.locator('.kemer-svg [data-durum="siradaki"]')).toHaveAttribute('data-key', 'Isha');

    await saatGit(page, an('21:30:00.500'));                     // Yatsı'dan sonra: gece kemeri
    await expect(page.locator('.kemer-svg [data-key]')).toHaveCount(2);
    await expect(page.locator('.kemer-svg [data-durum="siradaki"]')).toHaveAttribute('data-key', 'Imsak');
    await expect(page.locator('.kalan-etiket')).toHaveText('NOG TOT IMSAK');
    await expect(page.locator('.sira-saat')).toHaveText('05:35');
  });

  test('gece yarısı yeni gün; yaz saati bitişinde geri sayım doğru', async ({ page }) => {
    await mobilAc(page, { zaman: '2026-10-24T23:59:58.500+02:00' });
    await expect(page.locator('.miladi')).toHaveText('ZATERDAG · 24 OKTOBER 2026');
    await ileri(page, 3000);
    await expect(page.locator('.miladi')).toHaveText('ZONDAG · 25 OKTOBER 2026');
    await expect.poll(() => uygulamaVakitleri(page)).toMatchObject({ Imsak: '05:29', Fajr: '06:16', Isha: '19:07' });
    await saatGit(page, '2026-10-25T03:30:00.500+01:00');
    await expect(page.locator('.sayac')).toHaveText('1:58:59');
  });
});

test.describe('veri', () => {
  test('/api/vakit parametresiz; Diyanet\'e gidilmez; TV anahtarlarına dokunulmaz', async ({ page }) => {
    const k = await mobilAc(page, {
      zaman: an('16:00:00.500'),
      depo: { vakitler: 'TV-VERISI', 'nizam-tema': 'green', 'nizam-sayac': 'off' },
    });
    const vakit = k.api.filter((u) => u.pathname === '/api/vakit');
    expect(vakit).toHaveLength(1);
    expect(vakit[0].search).toBe('');
    expect(k.dis).toEqual([]);
    const depo = await page.evaluate(() => ({ ...localStorage }));
    expect(depo).toMatchObject({ vakitler: 'TV-VERISI', 'nizam-tema': 'green', 'nizam-sayac': 'off' });
    expect(Object.keys(depo).filter((x) => !['vakitler', 'nizam-tema', 'nizam-sayac'].includes(x)).every((x) => x.startsWith('nzm.'))).toBe(true);
  });

  test('internet yoksa son kaydedilen vakitlerle açılır', async ({ page }) => {
    await mobilAc(page, {
      zaman: an('16:00:00.500'), vakit: 'hata', aladhan: 'hata',
      depo: { 'nzm.vakit': JSON.stringify({ alindi: 0, days: VAKIT.days }) },
    });
    expect(await uygulamaVakitleri(page)).toEqual(DIYANET_28);
  });

  test('hiç veri yoksa açıklayıcı mesaj', async ({ page }) => {
    await mobilAc(page, { zaman: an('16:00:00.500'), vakit: 'hata', aladhan: 'hata', bekle: false });
    await expect(page.locator('.durum-mesaj')).toContainText('konden niet worden geladen');
    await expect(page.locator('.vakitler li')).toHaveCount(0);
  });

  test('Aladhan yedeği (Diyanet verisi yoksa): İmsak +48, Yatsı −41', async ({ page }) => {
    const k = await mobilAc(page, { zaman: '2026-12-01T10:05:00.500+01:00' });
    expect(await uygulamaVakitleri(page)).toEqual({
      Imsak: '05:48', Fajr: '07:00', Sunrise: '08:00', Dhuhr: '12:30', Asr: '14:20', Maghrib: '16:40', Isha: '17:49',
    });
    await expect(page.locator('.hicri')).toHaveText('10 Jumada al-Thani 1448');
    expect(k.dis.sort()).toEqual([
      'https://api.aladhan.com/v1/timings/01-12-2026?latitude=52.36523&longitude=4.79997&method=13',
      'https://api.aladhan.com/v1/timings/02-12-2026?latitude=52.36523&longitude=4.79997&method=13',
    ]);
  });

  test('TV ve uygulama aynı anda aynı vakitleri gösterir', async ({ page, browser }) => {
    for (const zaman of [an('16:00:00.500'), '2026-10-25T10:00:00.500+01:00', '2026-11-23T21:05:00.500+01:00']) {
      // TV: dokunmatik değil (yoksa yönlendirme betiği haklı olarak /mobil/'e gönderir)
      const tvContext = await browser.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: false, isMobile: false, timezoneId: 'Europe/Amsterdam' });
      const tv = await tvContext.newPage();
      await tvAc(tv, { zaman });
      const app = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, timezoneId: 'Europe/Amsterdam' });
      const mp = await app.newPage();
      await mobilAc(mp, { zaman });
      expect(await uygulamaVakitleri(mp), zaman).toEqual(await vakitleriOku(tv));
      await tvContext.close(); await app.close();
    }
  });

  test('telefon başka saat diliminde olsa da Amsterdam saati kullanılır', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, timezoneId: 'America/New_York' });
    const page = await context.newPage();
    await mobilAc(page, { zaman: an('16:00:00.500') });
    expect(await uygulamaVakitleri(page)).toEqual(DIYANET_28);
    await expect(page.locator('.sayac')).toHaveText('1:26:59');
    await expect(page.locator('.ams-not')).toBeVisible();
    await expect(page.locator('.ams-not')).toHaveText('Tijden in Amsterdamse tijd · nu 16:00');
    await context.close();
  });

  test('Amsterdam\'da "Amsterdam saati" notu çıkmaz', async ({ page }) => {
    await mobilAc(page, { zaman: an('16:00:00.500') });
    await expect(page.locator('.ams-not')).toBeHidden();
  });
});

test.describe('ayarlar', () => {
  test('dil değişir ve cihazda saklanır', async ({ page }) => {
    await mobilAc(page, { zaman: an('16:00:00.500'), adres: '/mobil/#ayarlar' });
    await expect(page.locator('#s-ayarlar h1')).toHaveText('Instellingen');
    await expect(page.locator('#dil-secim button[aria-pressed="true"]')).toHaveText('Nederlands');
    await page.getByRole('button', { name: 'Türkçe' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
    await expect(page.locator('#s-ayarlar h1')).toHaveText('Ayarlar');
    await expect(page.locator('#dil-secim button[aria-pressed="true"]')).toHaveText('Türkçe');
    expect(await page.evaluate(() => localStorage.getItem('nzm.dil'))).toBe('tr');
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.locator('.menu-oge span')).toHaveText(['Home', 'Activities', 'Programs', 'Settings']);

    await page.getByRole('button', { name: 'Türkçe' }).click();
    await page.goto('/mobil/#ana');
    await expect(page.locator('.vakitler li')).toHaveCount(7);
    await ileri(page, 1000);
    await expect(page.locator('.vakitler .v-ad')).toHaveText(['İmsak', 'Sabah', 'Güneş', 'Öğle', 'İkindi', 'Akşam', 'Yatsı']);
    await expect(page.locator('.kalan-etiket')).toHaveText("AKŞAM'A KALAN");
    await expect(page.locator('.miladi')).toHaveText('ÇARŞAMBA · 28 EKİM 2026');
    await expect(page.locator('li[data-key="Asr"] .v-simdi')).toHaveText('ŞİMDİ');
  });

  test('tema: otomatik Güneş − 1 sn açık, Akşam − 1 sn koyu', async ({ page }) => {
    await mobilAc(page, { zaman: an('07:20:58.500') });
    expect(await tema(page)).toBe('gece');
    await ileri(page, 1000);
    expect(await tema(page)).toBe('gunduz');
    await saatGit(page, an('17:26:58.500'));
    expect(await tema(page)).toBe('gunduz');
    await ileri(page, 1000);
    expect(await tema(page)).toBe('gece');
  });

  test('tema elle seçilir ve saklanır', async ({ page }) => {
    await mobilAc(page, { zaman: an('16:00:00.500'), adres: '/mobil/#ayarlar' });
    expect(await tema(page)).toBe('gunduz');
    await expect(page.locator('#tema-secim button[aria-pressed="true"]')).toHaveText('Automatisch');
    await page.getByRole('button', { name: 'Donker' }).click();
    expect(await tema(page)).toBe('gece');
    expect(await page.evaluate(() => localStorage.getItem('nzm.tema'))).toBe('gece');
    await page.reload();
    expect(await tema(page)).toBe('gece');
    await page.getByRole('button', { name: 'Licht' }).click();
    expect(await tema(page)).toBe('gunduz');
  });

  test('cami kartı; TV linki yok (06-11-2026)', async ({ page }) => {
    await mobilAc(page, { zaman: an('16:00:00.500'), adres: '/mobil/#ayarlar' });
    await expect(page.locator('.cami-adres')).toHaveAttribute('href', /google\.com\/maps\/search\/\?api=1&query=Ookmeerweg\+206\+Amsterdam/);
    await expect(page.locator('#s-ayarlar')).toContainText('Gebedstijden: Diyanet');
    await expect(page.locator('#s-ayarlar a[href*="ekran=tv"]')).toHaveCount(0);
  });
});

test.describe('sekmeler', () => {
  test('menüyle gezilir; boş içerik mesajları', async ({ page }) => {
    await mobilAc(page, { zaman: an('16:00:00.500') });
    await expect(page.locator('#s-ana')).toBeVisible();
    await expect(page.locator('.menu-oge[data-sekme="ana"]')).toHaveAttribute('aria-current', 'page');

    await page.getByRole('link', { name: 'Activiteiten' }).click();
    await expect(page.locator('#s-faaliyetler')).toBeVisible();
    await expect(page.locator('#s-ana')).toBeHidden();
    await expect(page.locator('.menu-oge[data-sekme="faaliyetler"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#s-faaliyetler')).toContainText('Nog geen komende activiteiten.');

    await page.getByRole('link', { name: 'Programma’s' }).click();
    await expect(page.locator('#s-programlar')).toContainText('Nog geen programma’s.');

    await page.goBack();
    await expect(page.locator('#s-faaliyetler')).toBeVisible();
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.locator('#s-ana')).toBeVisible();
  });

  test('dokunma hedefleri en az 44×44 px', async ({ page }) => {
    await mobilAc(page, { zaman: an('16:00:00.500'), adres: '/mobil/#ayarlar' });
    for (const el of await page.locator('.menu-oge, #s-ayarlar button:visible').all()) {
      const k = await el.boundingBox();
      expect(k.width, await el.textContent()).toBeGreaterThanOrEqual(44);
      expect(k.height, await el.textContent()).toBeGreaterThanOrEqual(44);
    }
  });

  test('Arapça etiketler lang="ar" dir="rtl"', async ({ page }) => {
    await mobilAc(page, { zaman: an('16:00:00.500') });
    for (const el of await page.locator('.v-ar, .sira-ar').all()) {
      await expect(el).toHaveAttribute('lang', 'ar');
      await expect(el).toHaveAttribute('dir', 'rtl');
    }
  });
});

test('ana ekran kaydırmasız sığar ve kaymaz; Yatsı alt menünün üstünde (farklı telefonlar)', async ({ page }) => {
  for (const [w, h] of [[390, 844], [412, 915], [360, 740], [375, 667], [360, 640]]) {
    await page.setViewportSize({ width: w, height: h });
    await mobilAc(page, { zaman: an('16:00:00.500') });
    await page.evaluate(() => document.fonts.ready);
    await page.clock.runFor(100);
    const [yukseklik, ekran] = await page.evaluate(() => [document.documentElement.scrollHeight, window.innerHeight]);
    expect(yukseklik, `${w}×${h}`).toBeLessThanOrEqual(ekran);
    const yatsi = await page.locator('li[data-key="Isha"]').boundingBox();
    const menu = await page.locator('.menu').boundingBox();
    expect(yatsi.y + yatsi.height, `${w}×${h}`).toBeLessThanOrEqual(menu.y + 1);
    const kemer = await page.locator('.kemer').boundingBox();
    expect(kemer.height, `${w}×${h} kemer`).toBeGreaterThanOrEqual(316 * 0.5 - 1);
    // kaydırma denemesi: ana ekran yerinden oynamaz
    await page.mouse.wheel(0, 400);
    await page.evaluate(() => window.scrollTo(0, 400));
    expect(await page.evaluate(() => window.scrollY), `${w}×${h} kaydırma`).toBe(0);
  }
});

// Gerçek Android'de (yüklü uygulama, 25-10-2026) belge içerikten ~55 px uzun ölçülüyordu (100dvh sistem çubuğunu
// da sayıyordu): kemer boşuna küçülüyor, sayfa yine kayıyordu, yenileyince eski kaydırma yeri geri geliyordu.
test('belge içerikten uzun ölçülse de ana ekran kaymaz, kemer boşuna küçülmez; yenileyince de', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 860 });
  await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style');
    s.textContent = 'body { min-height: calc(100vh + 56px) !important; }';   // Android'deki uzun ölçü
    document.head.append(s);
  }));
  await mobilAc(page, { zaman: an('16:00:00.500') });
  const kontrol = async (tur) => {
    await page.clock.runFor(100);
    await expect(page.locator('html'), tur).toHaveClass(/kaydirma-yok/);
    expect((await page.locator('.kemer').boundingBox()).height, `${tur}: kemer tam boy`).toBeCloseTo(316, 0);
    await page.mouse.wheel(0, 400);
    await page.evaluate(() => window.scrollTo(0, 300));
    await expect.poll(() => page.evaluate(() => window.scrollY), `${tur}: kaymaz`).toBe(0);
  };
  await kontrol('ilk açılış');
  // eski davranış: kaydırılmış sayfa yenilenince aynı yere dönüyordu
  await page.evaluate(() => { document.documentElement.classList.remove('kaydirma-yok'); window.scrollTo(0, 56); });
  await page.reload();
  await expect(page.locator('.vakitler li:not([hidden])')).toHaveCount(7);
  await page.evaluate(() => document.fonts.ready);
  await kontrol('yenileyince');
});

test('Android ve iPhone: sistem çubuğunun arkası temanın zemin rengi (açık temada açık, koyu temada koyu; 06-11-2026)', async ({ browser }) => {
  for (const cihaz of ['Pixel 7', 'iPhone 13']) {
    for (const [tema, zemin] of [['gunduz', 'rgb(246, 241, 231)'], ['gece', 'rgb(12, 24, 52)']]) {
      const context = await browser.newContext({ ...devices[cihaz] });
      const page = await context.newPage();
      await page.addInitScript((t) => localStorage.setItem('nzm.tema', t), tema);
      await mockla(page);
      await page.goto('/mobil/');
      await expect(page.locator('.vakitler li:not([hidden])')).toHaveCount(7);
      const r = await page.evaluate(() => ({
        kok: getComputedStyle(document.documentElement).backgroundColor,
        govde: getComputedStyle(document.body).backgroundColor,
        kaplar: document.body.getBoundingClientRect().height >= window.innerHeight,
      }));
      expect(r.kok, `${cihaz} ${tema}`).toBe(zemin);
      expect(r.govde, `${cihaz} ${tema}`).toBe(zemin);
      expect(r.kaplar, `${cihaz}: sayfa zemini ekranı kaplar`).toBe(true);
      await context.close();
    }
  }
});

test('diğer sekmeler kaydırılabilir kalır', async ({ page }) => {
  await mobilAc(page, { zaman: an('16:00:00.500'), adres: '/mobil/#ayarlar' });
  await page.setViewportSize({ width: 360, height: 480 });                  // Ayarlar kısaldı (06-11-2026): küçük ekranda yine taşar
  await page.evaluate(() => window.scrollTo(0, 300));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.classList.contains('kaydirma-yok'))).toBe(false);
});

// Cuma hutbesi sadece TV ekranında (kullanıcı sorusu, 25-10-2026). Uygulama /api/hutbe'yi hiç istemez.
test("cuma hutbesi sadece TV'de: uygulama hutbe istemez, hiçbir sekmede göstermez", async ({ page }) => {
  const CUMA_HUTBE = '2026-10-30T12:45:00.500+01:00';                 // Öğle 12:29 → TV'de hutbe 12:39–13:09
  const k = await mobilAc(page, { zaman: CUMA_HUTBE, hutbe: HUTBE });
  for (const sekme of ['#faaliyetler', '#programlar', '#ayarlar', '']) {
    await page.evaluate((h) => { location.hash = h; }, sekme);
    await page.clock.runFor(60 * 1000);
    await expect(page.locator('body')).not.toContainText(HUTBE.title);
  }
  await page.clock.runFor(20 * 60 * 1000);
  expect(k.api.filter((u) => u.pathname.startsWith('/api/hutbe'))).toEqual([]);
});

test('aynı anda TV ekranı hutbeyi gösterir; telefon "/" açınca uygulamaya gider, hutbe görmez', async ({ browser }) => {
  const CUMA_HUTBE = '2026-10-30T12:45:00.500+01:00';
  const tv = await browser.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: false, isMobile: false });
  const tvSayfa = await tv.newPage();
  await tvAc(tvSayfa, { zaman: CUMA_HUTBE, hutbe: HUTBE });
  await ileri(tvSayfa, 2000);
  await expect(tvSayfa.locator('#hutbe')).toBeVisible();
  await tv.close();
  const tel = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  const telSayfa = await tel.newPage();
  await mobilAc(telSayfa, { zaman: CUMA_HUTBE, hutbe: HUTBE, adres: '/' });
  await expect(telSayfa).toHaveURL(/\/mobil\/$/);
  await telSayfa.clock.runFor(5 * 60 * 1000);
  await expect(telSayfa.locator('body')).not.toContainText(HUTBE.title);
  await expect(telSayfa.locator('#hutbe')).toHaveCount(0);
  await tel.close();
});

// ---------------- Renk temaları kaldırıldı (kullanıcı isteği, 06-11-2026): sadece lacivert, gündüz ve gece ----------------
test.describe('tema renkleri', () => {
  test('renk seçimi yok; üst çubuk zemin rengini alır (gündüz krem, gece koyu)', async ({ page }) => {
    await mobilAc(page, { zaman: an('16:00:00.500'), adres: '/mobil/#ayarlar', depo: { 'nzm.tema': 'gunduz', 'nzm.renk': 'bordo' } });
    await expect(page.locator('#renk-secim')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-renk'))).toBe(false);   // eski seçim etkisiz
    const ustCubuk = () => page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(await ustCubuk()).toBe('#F6F1E7');
    await page.getByRole('button', { name: 'Donker' }).click();
    expect(await ustCubuk()).toBe('#0C1834');
  });

  test('her iki tasarım, gündüz ve gece: yazılar okunaklı (WCAG kontrastı)', async ({ page }) => {
    await mobilAc(page, { zaman: an('16:00:00.500') });
    const sonuc = await page.evaluate(() => {
      const rgb = (c) => { const x = document.createElement('div'); x.style.color = c; document.body.append(x); const v = getComputedStyle(x).color; x.remove(); return v.match(/[\d.]+/g).map(Number); };
      const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const kon = (a, b) => { const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      const kok = document.documentElement;
      const sorunlar = [];
      for (const stil of ['klasik', 'liste']) for (const tema of ['gunduz', 'gece']) {
        if (stil === 'liste') kok.dataset.stil = 'liste'; else kok.removeAttribute('data-stil');
        kok.dataset.tema = tema;
        const v = (n) => getComputedStyle(kok).getPropertyValue(n).trim();
        // [yazı, zemin, en az]: ana yazı 7, küçük yazılar 4.5 (lacivert kartların üstündeki sabit renkler dahil)
        for (const [a, b, enAz] of [['--ink', '--ground', 7], ['--soft', '--ground', 4.5], ['--soft', '--card', 4.5], ['--cobalt', '--ground', 4.5],
          ['--coral', '--ground', 4.5], ['--turq', '--ground', 4.5], ['--past', '--ground', 4.5], ['#F6F1E7', '--navy', 7], ['#D4DBEA', '--navy', 4.5], ['#E8C27A', '--navy', 4.5],
          ...(stil === 'liste' ? [['--kahramanYazi', '--kahraman1', 7], ['--kahramanYazi', '--kahraman2', 4.5], ['--kahramanAltin', '--kahraman1', 4.5], ['--coral', '--card', 4.5]] : [])]) {
          const k = kon(a.startsWith('--') ? v(a) : a, v(b));
          if (k < enAz) sorunlar.push(`${stil}-${tema}: ${a} / ${b} = ${k.toFixed(2)} (< ${enAz})`);
        }
      }
      return sorunlar;
    });
    expect(sonuc).toEqual([]);
  });
});

// ---------------- Tema 2 (data-stil="liste"; kullanıcı isteği, 07-11-2026) ----------------
// Üstte logo + ad ve tarihler, caminin gece fotoğrafında sıradaki vakit ve kalan süre, kerahate geri sayım, 7 vakitlik liste.
test.describe('Tema 2', () => {
  test('Ayarlar: Thema 1 / Thema 2 seçilir, saklanır, ilk boyamadan önce uygulanır; varsayılan Thema 1', async ({ page }) => {
    await mobilAc(page, { zaman: an('16:00:00.500'), adres: '/mobil/#ayarlar', depo: { 'nzm.tema': 'gunduz' } });
    await expect(page.locator('#stil-secim button')).toHaveText(['Thema 1', 'Thema 2']);
    await expect(page.locator('#stil-secim [aria-pressed="true"]')).toHaveText('Thema 1');
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-stil'))).toBe(false);
    await page.getByRole('button', { name: 'Thema 2' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-stil', 'liste');
    expect(await page.evaluate(() => localStorage.getItem('nzm.stil'))).toBe('liste');
    expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe('#1F4D2B');   // üstteki yeşil bant
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.dataset.stil)).toBe('liste');
    await page.getByRole('button', { name: 'Thema 1' }).click();
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-stil'))).toBe(false);
  });

  test('ana ekran (örnek resim gibi): yeşil bantta logo + ad ve tek satır tarih; altın çerçeveli kartta bütün cami fotoğrafı, solda sıradaki vakit, ad ve Arapça yan yana, sarı kalan süre, kerahat cümlesi; altta üstü yuvarlak yaprakta 7 vakit', async ({ page }) => {
    await mobilAc(page, { zaman: an('16:00:00.500'), depo: { 'nzm.stil': 'liste', 'nzm.dil': 'tr', 'nzm.tema': 'gunduz' } });
    await expect(page.locator('.kemer-svg')).toBeHidden();
    await expect(page.locator('.tarih-kisa')).toHaveText('17 Jumada al-Awwal 1448 H • 28 Eki 2026');
    for (const s of ['.miladi', '.hicri', '.sira-saat', '.kalan-kisa', '.kalan-etiket']) await expect(page.locator(s)).toBeHidden();
    await expect(page.locator('.sira-etiket')).toHaveText('Sıradaki vakit');
    await expect(page.locator('.sira-ad')).toHaveText('Akşam');
    await expect(page.locator('.sira-ar')).toHaveText('المغرب');
    await expect(page.locator('.sayac')).toHaveText('1:26:59');
    await expect(page.locator('.kh-cumle')).toHaveText('Kerahat vaktine 0:41:59 kaldı');
    const st = (s, ps = null) => page.locator(s).evaluate((e, ps) => { const c = getComputedStyle(e, ps); return { bg: c.backgroundImage, renk: c.color, cerceve: c.borderTopColor, ust: c.borderTopLeftRadius, alt: c.borderBottomLeftRadius, zemin: c.backgroundColor, h: c.height }; }, ps);
    const kartSt = await st('.kemer-ic');
    expect(kartSt.bg).toContain('/mobil/cami-gece.jpg');
    expect(kartSt.bg).not.toContain('gradient');                               // fotoğraf olduğu gibi, karartma yok
    expect(kartSt.cerceve).toBe('rgba(230, 196, 122, 0.85)');                   // altın çerçeve
    expect((await st('.sayac')).renk).toBe('rgb(230, 196, 122)');              // kalan süre sarı
    expect((await st('.kh-cumle')).renk).toBe('rgb(255, 255, 255)');          // kerahat cümlesi beyaz
    const k = async (s) => page.locator(s).boundingBox();
    const [logo, ad, tarih, kart, etiket, sAd, sAr, sayac, cumle, liste] = await Promise.all(
      ['.ust img', '.ust-ad', '.tarih-kisa', '.kemer-ic', '.sira-etiket', '.sira-ad', '.sira-ar', '.sayac', '.kh-cumle', '.vakitler'].map(k));
    expect(ad.x).toBeGreaterThan(logo.x + logo.width);
    expect(tarih.x).toBeGreaterThan(logo.x + logo.width);
    expect(ad.y).toBeLessThan(tarih.y);
    expect(tarih.y + tarih.height).toBeLessThanOrEqual(kart.y);
    expect(tarih.height).toBeLessThan(22);                                     // tek satır
    expect(Math.abs(kart.width / kart.height - 16 / 10)).toBeLessThan(0.03);    // örnek resimdeki oran
    expect(kart.height / 844).toBeLessThan(0.3);                                // ekranın ~%27'si
    // kartta yazılar solda; ad ve Arapça ad yan yana; kalan süre altında; kerahat hemen altında
    for (const b of [sAd, sayac, cumle]) expect(Math.abs(b.x - etiket.x)).toBeLessThan(2);
    expect(etiket.x - kart.x).toBeLessThan(30);
    expect(sAr.x).toBeGreaterThan(sAd.x + sAd.width);
    expect(Math.abs((sAr.y + sAr.height / 2) - (sAd.y + sAd.height / 2))).toBeLessThan(12);
    expect(sAd.y).toBeGreaterThan(etiket.y);
    expect(sayac.y).toBeGreaterThan(sAd.y + sAd.height - 4);
    expect(cumle.y).toBeGreaterThanOrEqual(sayac.y + sayac.height - 2);
    expect(cumle.y - (sayac.y + sayac.height)).toBeLessThan(40);
    // satırlar kartın yüksekliğine dağılır (örnekteki gibi): ilk satır üstte, son satır altta, aralar dengeli
    expect(etiket.y - kart.y).toBeGreaterThan(14);
    expect(kart.y + kart.height - (cumle.y + cumle.height)).toBeGreaterThan(14);
    expect(kart.y + kart.height - (cumle.y + cumle.height)).toBeLessThan(45);
    // yeşil bant; liste yaprağı: kenardan kenara, üst köşeler yuvarlak, alt düz; bant yaprağın üst köşelerinin arkasına kadar
    const bant = await page.locator('.sekme-ana').evaluate((e) => { const c = getComputedStyle(e, '::before'); return { renk: c.backgroundColor, yuk: parseFloat(c.height), ust: e.getBoundingClientRect().top }; });
    expect(bant.renk).toBe('rgb(31, 77, 43)');
    expect(bant.ust + bant.yuk).toBeGreaterThan(liste.y + 20);
    expect(bant.ust + bant.yuk).toBeLessThan(liste.y + 60);
    const yaprak = await st('.vakitler');
    expect(yaprak.ust).toBe('26px');
    expect(yaprak.alt).toBe('0px');
    expect(liste.x).toBe(0);
    expect(liste.width).toBe(390);
    expect(liste.y).toBeGreaterThan(kart.y + kart.height);
    await expect(page.locator('.vakit:not([hidden]) .v-ad')).toHaveText(['İmsak', 'Sabah', 'Güneş', 'Öğle', 'İkindi', 'Akşam', 'Yatsı']);
    await expect(page.locator('.vakit.siradaki .v-ad')).toHaveText('Akşam');
    expect(parseFloat(await page.locator('.v-ad').first().evaluate((e) => getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(20);   // büyük adlar
    // her vaktin simgesi var
    for (const v of await page.locator('.vakit .v-ikon').all()) {
      expect(await v.evaluate((e) => getComputedStyle(e, '::before').maskImage || getComputedStyle(e, '::before').webkitMaskImage)).toMatch(/^url\(/);
    }
    // TV'deki yazı tipleri
    expect(await page.locator('.sayac').evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/^"?Oswald/);
    expect(await page.locator('.v-ad').first().evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/^"?Inter/);
    await page.waitForFunction(() => document.documentElement.classList.contains('kaydirma-yok'));
    const sonSatir = await k('.vakit[data-key="Isha"]');
    const menu = await k('.menu');
    expect(sonSatir.y + sonSatir.height).toBeLessThanOrEqual(menu.y + 1);       // Yatsı menünün üstünde, kaydırmadan görünür
  });

  test('gece: yeşil değil, koyu temaların nötr renkleri', async ({ page }) => {
    await mobilAc(page, { zaman: an('21:30:00.500'), depo: { 'nzm.stil': 'liste', 'nzm.dil': 'nl', 'nzm.tema': 'gece' } });
    await expect(page.locator('.tarih-kisa')).toHaveText('17 Jumada al-Awwal 1448 AH • 28 okt 2026');
    const renk = (s, o) => page.locator(s).evaluate((e, o) => getComputedStyle(e, o.ps)[o.ozellik], o);
    expect(await renk('body', { ps: null, ozellik: 'backgroundColor' })).toBe('rgb(18, 18, 18)');
    expect(await renk('.sekme-ana', { ps: '::before', ozellik: 'backgroundColor' })).toBe('rgb(35, 35, 37)');
    expect(await renk('.vakitler', { ps: null, ozellik: 'backgroundColor' })).toBe('rgb(18, 18, 18)');
    expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe('#232325');
  });

  test('kerahat: Sabah ve İkindi vaktinde kartta tek cümle (kerahate ya da bitişine kalan süre); başka zaman ve Thema 1\'de yok', async ({ page }) => {
    const ac = (saat) => mobilAc(page, { zaman: an(saat), depo: { 'nzm.stil': 'liste', 'nzm.dil': 'tr' } });
    const kh = page.locator('.kh-cumle');
    // 28-10: İmsak 05:34, Güneş 07:21, İkindi 14:54, Akşam 17:27 (kerahat 45 dk)
    await ac('06:40:00.500');
    await expect(kh).toHaveText('Kerahat vaktine 0:40:59 kaldı');
    await expect(kh).not.toHaveClass(/icinde/);
    await ac('07:40:00.500');
    await expect(kh).toHaveText('Kerahat vakti, 0:25:59 sonra bitiyor');
    await expect(kh).toHaveClass(/icinde/);
    await ac('12:00:00.500');
    await expect(kh).toBeHidden();
    await ac('16:50:00.500');
    await expect(kh).toHaveText('Kerahat vakti, 0:36:59 sonra bitiyor');
    await ac('21:00:00.500');
    await expect(kh).toBeHidden();
    await ac('15:00:00.500');
    await expect(kh).toBeVisible();
    await page.evaluate(() => localStorage.setItem('nzm.stil', 'klasik'));   // Thema 1 (mobilAc depoyu oturumda bir kez yazar)
    await page.reload();
    await expect(page.locator('.vakit')).toHaveCount(7);
    await expect(kh).toBeHidden();
  });

  test('her iki temada geçmiş vakitler soluk değil (sadece sıradaki farklı renkte)', async ({ page }) => {
    await mobilAc(page, { zaman: an('16:00:00.500'), depo: { 'nzm.dil': 'tr', 'nzm.tema': 'gunduz' } });
    for (const stil of [null, 'liste']) {
      if (stil) { await page.evaluate((x) => localStorage.setItem('nzm.stil', x), stil); await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-stil', stil); }
      await expect(page.locator('.vakit.siradaki')).toHaveCount(1);
      const renk = (k, s) => page.locator(`.vakit[data-key="${k}"] ${s}`).evaluate((e) => getComputedStyle(e).color);
      for (const s of ['.v-ad', '.v-saat']) {
        expect(await renk('Fajr', s), `${stil || 'klasik'} ${s}`).toBe(await renk('Isha', s));
        expect(await renk('Maghrib', s)).not.toBe(await renk('Isha', s));
      }
    }
  });
});
