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

  test('sabit temalar (20-11-2026): açık/koyu seçimi yok; akşam da aynı görünüm, eski "Koyu" seçimi etkisiz', async ({ page }) => {
    await mobilAc(page, { zaman: an('21:30:00.500'), adres: '/mobil/#ayarlar', depo: { 'nzm.tema': 'gece' } });
    expect(await tema(page)).toBe('gunduz');
    await expect(page.locator('#tema-secim, #tema-ayar')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Donker', exact: true })).toHaveCount(0);
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

test('ana ekran (varsayılan Tema 1) kaydırmasız sığar ve kaymaz; Yatsı alt menünün üstünde; kısa telefonlarda kaydırılır (farklı telefonlar)', async ({ page }) => {
  for (const [w, h] of [[390, 844], [412, 915], [384, 780], [384, 720], [360, 740], [375, 667], [360, 640]]) {   // 384 × 780: Samsung (sistem çubukları hariç)
    await page.setViewportSize({ width: w, height: h });
    await mobilAc(page, { zaman: an('16:00:00.500'), depo: { 'nzm.stil': null } });
    await page.evaluate(() => document.fonts.ready);
    await page.clock.runFor(100);
    await expect(page.locator('html')).toHaveAttribute('data-stil', 'cini');
    if (h >= 700) {
      const [yukseklik, ekran] = await page.evaluate(() => [document.documentElement.scrollHeight, window.innerHeight]);
      expect(yukseklik, `${w}×${h}`).toBeLessThanOrEqual(ekran);
      await page.mouse.wheel(0, 400);
      await page.evaluate(() => window.scrollTo(0, 400));
      expect(await page.evaluate(() => window.scrollY), `${w}×${h} kaydırma`).toBe(0);
    } else {
      await page.evaluate(() => window.scrollTo(0, 2000));              // kısa telefon: kaydırılır, hiçbir şey kesilmez
    }
    const yatsi = await page.locator('li[data-key="Isha"]').boundingBox();
    const menu = await page.locator('.menu').boundingBox();
    expect(yatsi.y + yatsi.height, `${w}×${h}`).toBeLessThanOrEqual(menu.y + 1);
  }
});

// Gerçek Android'de (yüklü uygulama, 25-10-2026) belge içerikten ~55 px uzun ölçülüyordu (100dvh sistem çubuğunu
// da sayıyordu): kemer boşuna küçülüyor, sayfa yine kayıyordu, yenileyince eski kaydırma yeri geri geliyordu.
test('belge içerikten uzun ölçülse de ana ekran kaymaz; yenileyince de', async ({ page }) => {
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

test('Android ve iPhone: kök ve gövde aynı zemin, sayfa zemini ekranı kaplar (dört tema; 20-11-2026)', async ({ browser }) => {
  for (const cihaz of ['Pixel 7', 'iPhone 13']) {
    const context = await browser.newContext({ ...devices[cihaz] });
    const page = await context.newPage();
    await mockla(page);
    await page.goto('/mobil/');
    for (const stil of ['cini', 'gok', 'liste', 'zumrut']) {
      await page.evaluate((s) => localStorage.setItem('nzm.stil', s), stil);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-stil', stil);
      await expect(page.locator('.vakitler li:not([hidden])')).toHaveCount(7);
      const r = await page.evaluate(() => ({
        kok: getComputedStyle(document.documentElement).backgroundColor,
        govde: getComputedStyle(document.body).backgroundColor,
        kaplar: document.body.getBoundingClientRect().height >= window.innerHeight,
      }));
      expect(r.kok, `${cihaz} ${stil}`).toBe(r.govde);
      expect(r.kaplar, `${cihaz} ${stil}: sayfa zemini ekranı kaplar`).toBe(true);
    }
    await context.close();
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
  test('renk seçimi yok; eski renk seçimi etkisiz; tarayıcı çubuğu temanın üst rengini alır', async ({ page }) => {
    await mobilAc(page, { zaman: an('16:00:00.500'), adres: '/mobil/#ayarlar', depo: { 'nzm.stil': 'liste', 'nzm.renk': 'bordo' } });
    await expect(page.locator('#renk-secim')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-renk'))).toBe(false);   // eski seçim etkisiz
    expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe('#1F4D2B');
  });

  test('temalarda yazılar okunaklı (WCAG kontrastı)', async ({ page }) => {
    await mobilAc(page, { zaman: an('16:00:00.500') });
    const sonuc = await page.evaluate(() => {
      const rgb = (c) => { const x = document.createElement('div'); x.style.color = c; document.body.append(x); const v = getComputedStyle(x).color; x.remove(); return v.match(/[\d.]+/g).map(Number); };
      const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const kon = (a, b) => { const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      const kok = document.documentElement;
      const sorunlar = [];
      for (const stil of [null, 'gok', 'liste', 'zumrut']) for (const tema of ['gunduz']) {
        if (stil) kok.dataset.stil = stil; else kok.removeAttribute('data-stil');
        kok.dataset.tema = tema;
        const v = (n) => getComputedStyle(kok).getPropertyValue(n).trim();
        // [yazı, zemin, en az]: ana yazı 7, küçük yazılar 4.5 (lacivert kartların üstündeki sabit renkler dahil)
        for (const [a, b, enAz] of [['--ink', '--ground', 7], ['--soft', '--ground', 4.5], ['--soft', '--card', 4.5], ['--cobalt', '--ground', 4.5],
          ['--coral', '--ground', 4.5], ['--turq', '--ground', 4.5], ['--past', '--ground', 4.5], ['#F6F1E7', '--navy', 7], ['#D4DBEA', '--navy', 4.5], ['#E8C27A', '--navy', 4.5],
          // Tema 1 (liste): bandın üstündeki beyaz yazılar ve saat (gündüz sarı, gece beyaz) bandın rengine göre (11-11-2026)
          ...(stil === 'liste' ? [['#FFFFFF', '--bant', 4.5], [v('--saatRenk') || v('--kahramanAltin'), '--bant', 4.5], ['--coral', '--card', 4.5]] : [])]) {
          const k = kon(a.startsWith('--') ? v(a) : a, v(b));
          if (k < enAz) sorunlar.push(`${stil}-${tema}: ${a} / ${b} = ${k.toFixed(2)} (< ${enAz})`);
        }
      }
      return sorunlar;
    });
    expect(sonuc).toEqual([]);
  });
});

// ---------------- Tema 3 (data-stil="liste"; yeşil desenli; 20-11-2026'dan beri Tema 3, ters çevrilmiş: yeşil zemin, beyaz kutular) ----------------
// Temalar (20-11-2026): Tema 1 = 'cini' (fotoğraflı, varsayılan), Tema 2 = 'gok' (güneş yayı), Tema 3 = 'liste', Tema 4 = 'zumrut' (koyu).
test.describe('Tema 3 (liste)', () => {
  test('Ayarlar: tema tam ekran canlı önizlemede kaydırılarak seçilir, saklanır, ilk boyamadan önce uygulanır (dört tema)', async ({ page }) => {
    await mobilAc(page, { zaman: an('16:00:00.500'), adres: '/mobil/#ayarlar', depo: { 'nzm.stil': 'liste' } });
    const satir = page.getByRole('button', { name: /^Ontwerp/ });
    await expect(satir).toContainText('Thema 3');
    await expect(page.locator('html')).toHaveAttribute('data-stil', 'liste');
    expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe('#1F4D2B');

    await satir.click();
    const on = page.locator('#tema-on');
    await expect(on).toBeVisible();
    await expect(page.locator('#to-ad')).toHaveText('Thema 3');
    await expect(page.locator('#to-sec')).toHaveText('Gekozen');
    await expect(page.locator('#to-sec')).toBeDisabled();

    // tam ekran ve canlı: her tema uygulamanın kendisi (menü çubuğu dahil), sırayla Tema 1 … 4; sayaç işler
    await expect(on.locator('iframe')).toHaveCount(4);
    const boyut = await on.locator('iframe').nth(2).boundingBox();             // seçili tema (Tema 3) ekranda
    expect(boyut).toMatchObject({ x: 0, y: 0, width: page.viewportSize().width, height: page.viewportSize().height - 58 });
    for (const [i, stil] of ['cini', 'gok', 'liste', 'zumrut'].entries()) {
      const f = page.frameLocator(`#to-serit iframe >> nth=${i}`);
      await expect(f.locator('.vakitler li:not([hidden])')).toHaveCount(7);
      await expect(f.locator('html')).toHaveAttribute('data-stil', stil);
    }
    const t2 = page.frameLocator('#to-serit iframe >> nth=1');
    const sayac = await t2.locator('.sayac').textContent();
    await page.clock.runFor(3000);
    await expect(t2.locator('.sayac')).not.toHaveText(sayac);

    // kaydırınca sıradaki tema; kapatınca hiçbir şey değişmez
    await page.locator('#to-serit').evaluate((el) => el.scrollTo({ left: el.clientWidth * 3, behavior: 'auto' }));
    await expect(page.locator('#to-ad')).toHaveText('Thema 4');
    await expect(page.locator('#to-sec')).toHaveText('Kies dit thema');
    await expect(page.getByRole('button', { name: 'Volgend thema' })).toBeDisabled();
    await page.getByRole('button', { name: 'Sluiten' }).click();
    await expect(on).toBeHidden();
    await expect(page.locator('#to-serit iframe')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-stil', 'liste');
    expect(await page.evaluate(() => localStorage.getItem('nzm.stil'))).toBe('liste');

    // ok düğmesiyle de geçilir; "Kies" kaydeder
    await satir.click();
    await page.getByRole('button', { name: 'Vorig thema' }).click();
    await expect(page.locator('#to-ad')).toHaveText('Thema 2');
    await page.getByRole('button', { name: 'Kies dit thema' }).click();
    await expect(on).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-stil', 'gok');
    expect(await page.evaluate(() => localStorage.getItem('nzm.stil'))).toBe('gok');
    await expect(satir).toContainText('Thema 2');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-stil', 'gok');
    await expect(satir).toContainText('Thema 2');

    // Thema 1: önizleme seçili temada açılır
    await satir.click();
    await expect(page.locator('#to-ad')).toHaveText('Thema 2');
    await page.getByRole('button', { name: 'Vorig thema' }).click();
    await expect(page.locator('#to-ad')).toHaveText('Thema 1');
    await expect(page.getByRole('button', { name: 'Vorig thema' })).toBeDisabled();
    await page.getByRole('button', { name: 'Kies dit thema' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-stil', 'cini');
    expect(await page.evaluate(() => localStorage.getItem('nzm.stil'))).toBe('cini');
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.dataset.stil)).toBe('cini');
  });

  test('ana ekran (ters çevrilmiş, 20-11-2026): zemin yeşil ve desenli; üstte logo, ad, "Amsterdam"; beyaz kartta "Vaktin çıkmasına", kalan süre, kerahat; altında oklu tarih ve beyaz kutularda 7 vakit', async ({ page }) => {
    await mobilAc(page, { zaman: an('16:00:00.500'), depo: { 'nzm.stil': 'liste', 'nzm.dil': 'tr' } });
    for (const s of ['.kemer-svg', '.tarih-satir', '.sira', '.sira-ar', '.kalan-kisa', '.kalan-etiket']) await expect(page.locator(s)).toBeHidden();
    await expect(page.locator('.ust-alt')).toHaveText('Amsterdam');
    await expect(page.locator('.sira-etiket')).toHaveText('Vaktin çıkmasına');
    await expect(page.locator('.sayac')).toHaveText('1:26:59');                            // İkindi vakti Akşam'da çıkar
    await expect(page.locator('.kh-cumle')).toHaveText('Kerahat vaktine 0:41:59 kaldı');
    await expect(page.locator('#gun-miladi')).toHaveText('Çarşamba 28 Ekim 2026');
    await expect(page.locator('#gun-hicri')).toHaveText('17 Jumada al-Awwal 1448');
    const zemin = await page.locator('.sekme-ana').evaluate((e) => { const c = getComputedStyle(e, '::before'); return { renk: c.backgroundColor, bg: c.backgroundImage }; });
    expect(zemin.renk).toBe('rgb(31, 77, 43)');
    expect(zemin.bg).toContain('data:image/svg+xml');
    expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe('#1F4D2B');
    await expect(page.locator('.kemer-ic')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('.vakit[data-key="Imsak"]')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('.vakit.siradaki')).toHaveAttribute('data-key', 'Maghrib');
    await expect(page.locator('.vakit.siradaki .v-ad')).toHaveCSS('color', 'rgb(255, 255, 255)');
    expect(await page.locator('.sayac').evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/^"?Oswald/);
    const k = (s) => page.locator(s).boundingBox();
    const [logo, kart, tarih, ilk, son, menu] = await Promise.all(['.ust img', '.kemer-ic', '.gun-gez', '.vakit[data-key="Imsak"]', '.vakit[data-key="Isha"]', '.menu'].map(k));
    expect(logo.width).toBe(34);
    for (const [a, b] of [[logo, kart], [kart, tarih], [tarih, ilk], [son, menu]]) expect(a.y + a.height).toBeLessThanOrEqual(b.y + 1);
    await page.waitForFunction(() => document.documentElement.classList.contains('kaydirma-yok'));
    // oklarla başka gün; sayaç bugünün
    await page.getByRole('button', { name: 'Sonraki gün' }).click();
    await expect(page.locator('#gun-miladi')).toHaveText('Perşembe 29 Ekim 2026');
    await expect(page.locator('.vakit.siradaki')).toHaveCount(0);
    await page.clock.runFor(1000);
    await expect(page.locator('.sayac')).toHaveText('1:26:58');
  });

  test('kısa telefon (360 × 640): 7 vakit kaydırmadan sığar', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await mobilAc(page, { zaman: an('16:00:00.500'), depo: { 'nzm.stil': 'liste', 'nzm.dil': 'nl', 'nzm.tema': 'gunduz' } });
    await page.waitForFunction(() => document.documentElement.classList.contains('kaydirma-yok'));
    const [isha, menu] = await Promise.all([page.locator('.vakit[data-key="Isha"]').boundingBox(), page.locator('.menu').boundingBox()]);
    expect(isha.y + isha.height).toBeLessThanOrEqual(menu.y + 1);
  });

  test('"Vaktin çıkmasına": sayaç vaktin bitişine; İmsak → Sabah namazı "Sabah namazına", Güneş → Öğle "Öğle namazına"; Tema 2 (güneş yayı) sıradaki vakte', async ({ page }) => {
    const ac = (saat, dil = 'tr') => mobilAc(page, { zaman: an(saat), depo: { 'nzm.stil': 'liste', 'nzm.dil': dil } });
    const etiket = page.locator('.sira-etiket'), sayac = page.locator('.sayac');
    // 28-10: İmsak 05:34, Sabah 06:21, Güneş 07:21, Öğle 12:29, İkindi 14:54, Akşam 17:27, Yatsı 19:02
    for (const [saat, yazi, kalan] of [
      ['04:00:00.500', 'Vaktin çıkmasına', '1:33:59'],     // Yatsı vakti İmsak'ta çıkar
      ['06:00:00.500', 'Sabah namazına', '0:20:59'],       // İmsak → Sabah namazı (06:21)
      ['06:30:00.500', 'Vaktin çıkmasına', '0:50:59'],     // Sabah namazından sonra: vakit Güneş'te çıkar
      ['09:00:00.500', 'Öğle namazına', '3:28:59'],        // Güneş → Öğle namazı
      ['13:00:00.500', 'Vaktin çıkmasına', '1:53:59'],
      ['18:00:00.500', 'Vaktin çıkmasına', '1:01:59'],
      ['21:30:00.500', 'Vaktin çıkmasına', '8:04:59'],     // Yatsı vakti ertesi günün İmsak'ında çıkar
    ]) {
      await ac(saat);
      await expect(etiket, saat).toHaveText(yazi);
      await expect(sayac, saat).toHaveText(kalan);
    }
    // dil ve tema localStorage + reload ile (mobilAc depoyu oturumda bir kez yazar)
    const degistir = async (k, v) => { await page.evaluate(([k, v]) => localStorage.setItem(k, v), [k, v]); await page.reload(); await expect(page.locator('.vakit')).toHaveCount(7); };
    await ac('09:00:00.500');
    await degistir('nzm.dil', 'en');
    await expect(etiket).toHaveText('Dhuhr begins in');
    await ac('06:00:00.500');
    await degistir('nzm.dil', 'nl');
    await expect(etiket).toHaveText('Fadjr begint over');
    await ac('06:30:00.500');
    await expect(etiket).toHaveText('Gebedstijd eindigt over');
    await ac('06:00:00.500');
    await degistir('nzm.dil', 'tr');
    // Tema 2 (güneş yayı): sayaç sıradaki vakte (06:00 → Sabah 06:21)
    await page.evaluate(() => localStorage.setItem('nzm.stil', 'gok'));
    await page.reload();
    await expect(page.locator('.vakit')).toHaveCount(7);
    await expect(page.locator('.kalan-etiket')).toHaveText("SABAH'A KALAN");
    await expect(sayac).toHaveText(/^0:20:5\d$/);
    await expect(etiket).toBeHidden();
  });


  test('kerahat: sadece İkindi vaktinde tek cümle (kerahate ya da bitişine kalan süre); güneş doğduktan sonra 45 dk “Kerahat vakti” (20-11-2026); Sabah vaktinde ve başka zaman yok; bütün temalarda', async ({ page }) => {
    test.slow();                                                               // çok sayfa açar; tam koşuda yük altında 30 sn yetmeyebilir
    const ac = (saat) => mobilAc(page, { zaman: an(saat), depo: { 'nzm.stil': 'liste', 'nzm.dil': 'tr' } });
    const kh = page.locator('.kh-cumle');
    // 28-10: İmsak 05:34, Güneş 07:21, İkindi 14:54, Akşam 17:27 (kerahat 45 dk)
    // Sabah vaktinde yok (kullanıcı isteği, 08-11-2026); güneş doğduktan sonra 45 dk (07:21–08:06) "Kerahat vakti" (kullanıcı isteği, 20-11-2026)
    await ac('06:40:00.500');
    await expect(kh).toBeHidden();
    await ac('07:40:00.500');
    await expect(kh).toHaveText('Kerahat vakti');
    await ac('08:10:00.500');
    await expect(kh).toBeHidden();
    await ac('12:00:00.500');
    await expect(kh).toBeHidden();
    await ac('16:50:00.500');
    await expect(kh).toHaveText('Kerahat vakti');                              // kerahat girince sadece bu (kullanıcı isteği, 08-11-2026)
    await expect(kh).toHaveClass(/icinde/);
    await ac('21:00:00.500');
    await expect(kh).toBeHidden();
    // İkindi girince kerahate kalan süre (kullanıcı isteği, 08-11-2026): İkindi 14:54, kerahat 16:42
    await ac('14:54:00.500');
    await expect(kh).toHaveText('Kerahat vaktine 1:47:59 kaldı');
    await expect(kh).not.toHaveClass(/icinde/);
    await ac('06:00:00.500');                                                  // Sabah vakti
    await expect(kh).toBeHidden();
    await ac('16:00:00.500');
    await expect(kh).toBeVisible();
    for (const [stil, yer] of [['gok', '.kh-cumle'], ['cini', '.kh-cumle'], ['zumrut', '.t4-kerahat']]) {   // mobilAc depoyu oturumda bir kez yazar
      await page.evaluate((x) => localStorage.setItem('nzm.stil', x), stil);
      await page.reload();
      await expect(page.locator('.vakit')).toHaveCount(7);
      await expect(page.locator(yer), stil).toBeVisible();
      await expect(page.locator(yer), stil).toHaveText(/^Kerahat vaktine 0:41:5\d kaldı$/);
    }
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

  test('şimdiki vakit: "ŞİMDİ" yazısı yerine solda çizgi; adlar hiç kısalmaz (kullanıcı isteği, 08-11-2026: "İ…")', async ({ page }) => {
    for (const [w, h] of [[390, 844], [360, 640]]) {
      await page.setViewportSize({ width: w, height: h });
      await mobilAc(page, { zaman: an('06:08:00.500'), depo: { 'nzm.stil': 'liste', 'nzm.dil': 'tr', 'nzm.tema': 'gunduz' } });   // İmsak vakti
      const imsak = page.locator('.vakit[data-key="Imsak"]');
      await expect(imsak).toHaveClass(/simdi/);
      // yazı ekran okuyucu için var ama görünmez (1 px)
      await expect(imsak.locator('.v-simdi')).toHaveText('ŞİMDİ');
      expect((await imsak.locator('.v-simdi').boundingBox()).width).toBeLessThanOrEqual(1);
      const cizgi = await imsak.evaluate((e) => { const c = getComputedStyle(e, '::after'); return { icerik: c.content, en: c.width, zemin: c.backgroundColor, sol: c.left }; });
      expect(cizgi).toEqual({ icerik: '""', en: '4px', zemin: 'rgb(230, 196, 122)', sol: '0px' });   // yeşil zeminde altın (20-11-2026)
      expect(await page.locator('.vakit[data-key="Fajr"]').evaluate((e) => getComputedStyle(e, '::after').content)).toBe('none');
      // hiçbir ad kısalmaz (İmsak, Güneş … tam görünür)
      const kesik = await page.locator('.vakit .v-ad').evaluateAll((l) => l.filter((e) => e.scrollWidth > e.clientWidth + 0.5).map((e) => e.textContent));
      expect(kesik, `${w}px`).toEqual([]);
      await expect(imsak.locator('.v-ad')).toHaveText('İmsak');
    }
  });
});

// ---------------- Tema 1 ('cini'; kullanıcının örnek resmine göre, 09-11-2026; 20-11-2026'dan beri Tema 1, varsayılan) ----------------
// Lacivert, üstte caminin fotoğrafı; sıradaki namaza kalan süre karolarda, kerahat, oklu tarih, turuncu sıradaki satır, kendine özgü menü. Koyu ve açık hali var.
test.describe('Tema 1 (cini)', () => {
  const ac = (page, saat, depo = {}) => mobilAc(page, { zaman: an(saat), depo: { 'nzm.stil': 'cini', 'nzm.dil': 'nl', ...depo } });

  test('varsayılan tema (hiç seçmeyen): Tema 1; depoya bir şey yazılmaz', async ({ page }) => {
    await mobilAc(page, { zaman: an('12:00:00.500'), adres: '/mobil/#ayarlar', depo: { 'nzm.stil': null, 'nzm.dil': 'nl' } });
    await expect(page.locator('html')).toHaveAttribute('data-stil', 'cini');
    await expect(page.getByRole('button', { name: /^Ontwerp/ })).toContainText('Thema 1');
    expect(await page.evaluate(() => localStorage.getItem('nzm.stil'))).toBe(null);
  });

  test('fotoğraf tarihin hemen üstünde biter; fotoğraf–tarih ve tarih–liste arası eşit (kullanıcı isteği, 20-11-2026)', async ({ page }) => {
    await ac(page, '16:00:00.500');
    const [tarih, liste] = await Promise.all([page.locator('.gun-gez').boundingBox(), page.locator('.vakitler').boundingBox()]);
    const foto = await page.locator('.sekme-ana').evaluate((e) => { const c = getComputedStyle(e, '::before'); return { alt: e.getBoundingClientRect().top + parseFloat(c.top) + parseFloat(c.height), bg: c.backgroundImage }; });
    expect(foto.bg).toContain('cami-gece.jpg');
    const ust = tarih.y - foto.alt, alt = liste.y - (tarih.y + tarih.height);
    expect(ust).toBeGreaterThanOrEqual(0);
    expect(Math.abs(ust - alt)).toBeLessThan(3);
    await expect(page.locator('html')).toHaveClass(/kaydirma-yok/);
  });


  test('açık zemin, beyaz satırlar, turuncu sıradaki; fotoğrafın üstündeki yazılar beyaz', async ({ page }) => {
    await ac(page, '16:00:00.500');
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'gunduz');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(238, 242, 248)');
    const imsak = page.locator('.vakit[data-key="Imsak"]');
    await expect(imsak).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(imsak.locator('.v-ad')).toHaveCSS('color', 'rgb(20, 35, 61)');
    for (const s of ['.sira-etiket', '.sayac']) await expect(page.locator(s)).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(page.locator('.vakit.siradaki .v-ad')).toHaveCSS('color', 'rgb(255, 255, 255)');
    expect(await page.locator('.vakit.siradaki').evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('linear-gradient');
    expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe('#141D2E');   // tarayıcı çubuğu fotoğrafın üstüyle aynı
  });



  test('ana ekran sırayla: logo, ad ve "Amsterdam" (kutusuz); "Vaktin çıkmasına", düz sayaç, sıradaki vakit ve saati, kerahat; altında oklu tarih, 7 vakit; kaymadan sığar', async ({ page }) => {
    await ac(page, '16:00:00.500');
    await expect(page.locator('.ust img')).toBeVisible();
    await expect(page.locator('.ust-ad')).toBeVisible();
    await expect(page.locator('.ust-alt')).toHaveText('Amsterdam');
    await expect(page.locator('.kalan-etiket')).toBeHidden();
    await expect(page.locator('.sira-etiket')).toHaveText('Gebedstijd eindigt over');
    await expect(page.locator('.sayac')).toHaveText('1:26:59');
    await expect(page.locator('.sira-saat')).toHaveText('17:27');
    await expect(page.locator('.kh-cumle')).toHaveText('Nog 0:41:59 tot de afgeraden gebedstijd');   // NL'de "kerahat" yazılmaz (23-11-2026)
    await expect(page.locator('#gun-miladi')).toHaveText('Woensdag 28 oktober 2026');
    await expect(page.locator('#gun-hicri')).toHaveText('17 Jumada al-Awwal 1448');     // arkasında H/AH yok
    await page.clock.runFor(1000);
    await expect(page.locator('.sayac')).toHaveText('1:26:58');

    const k = async (s) => page.locator(s).boundingBox();
    const [ust, etiket, sayac, sira, kerahat, tarih, ilk, son, menu] = await Promise.all(['.ust', '.sira-etiket', '.sayac', '.sira', '.kh-cumle', '.gun-gez', '.vakit[data-key="Imsak"]', '.vakit[data-key="Isha"]', '.menu'].map(k));
    for (const [a, b] of [[ust, etiket], [etiket, sayac], [sayac, sira], [sira, kerahat], [kerahat, tarih], [tarih, ilk], [son, menu]]) expect(a.y + a.height).toBeLessThanOrEqual(b.y + 1);
    await expect(page.locator('html')).toHaveClass(/kaydirma-yok/);

    // sıradaki satır turuncu; geçmiş vakitler soluk değil
    expect(await page.locator('.vakit.siradaki').evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('linear-gradient');
    await expect(page.locator('.vakit.siradaki')).toHaveAttribute('data-key', 'Maghrib');
    await expect(page.locator('.vakit[data-key="Imsak"] .v-ad')).toHaveCSS('opacity', '1');
    // menü: seçili sekmenin simgesi turuncu kapsülde
    expect(await page.locator('.menu-oge[aria-current="page"] svg').evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('linear-gradient');
  });

  test('Öğle’den önce sayaç Öğle namazına; kerahat sadece İkindi vaktinde', async ({ page }) => {
    await ac(page, '12:00:00.500');
    await expect(page.locator('.sayac')).toHaveText('0:28:59');
    await expect(page.locator('.sira-saat')).toHaveText('12:29');
    await expect(page.locator('.kh-cumle')).toBeHidden();
    await page.clock.fastForward('04:45:00');                                  // 16:45: kerahat (16:42–17:27)
    await page.clock.runFor(1000);
    await expect(page.locator('.kh-cumle')).toHaveText('Afgeraden gebedstijd');
  });

  test('kerahat süresi Ayarlar’da seçilir (15–45 dk, varsayılan 45; kullanıcı isteği 23-11-2026); seçim saklanır', async ({ page }) => {
    await ac(page, '16:00:00.500');
    await expect(page.locator('.kh-cumle')).toHaveText('Nog 0:41:59 tot de afgeraden gebedstijd');   // 45 dk: 16:42
    await page.locator('.menu-oge[data-sekme="ayarlar"]').click();
    await expect(page.locator('#s-ayarlar')).toContainText('GEBEDSTIJDEN');
    const sec = page.getByRole('combobox', { name: 'Afgeraden gebedstijd' });
    await expect(sec).toHaveValue('45');
    await expect(sec.locator('option')).toHaveText(['15 min', '20 min', '25 min', '30 min', '35 min', '40 min', '45 min']);
    await sec.selectOption('20');
    expect(await page.evaluate(() => localStorage.getItem('nzm.kerahat'))).toBe('20');
    await page.locator('.menu-oge[data-sekme="ana"]').click();
    await expect(page.locator('.kh-cumle')).toHaveText(/^Nog 1:06:5\d tot de afgeraden gebedstijd$/);    // 20 dk: 17:07
    // güneş doğduktan sonra da 20 dk
    await page.reload();
    await expect(page.locator('.kh-cumle')).toHaveText(/^Nog 1:06:5\d tot de afgeraden gebedstijd$/);
    await page.locator('.menu-oge[data-sekme="ayarlar"]').click();
    await page.getByRole('button', { name: 'Uitleg: Afgeraden gebedstijd' }).click();
    await expect(page.locator('#ip-kerahat')).toContainText('makroeh');
  });

  test('tarih okları: başka günlerin vakitleri (veri kadar), sayaç bugünün; sıradaki vurgusu sadece bugün; sekme değişince bugüne döner', async ({ page }) => {
    await ac(page, '16:00:00.500');
    const miladi = page.locator('#gun-miladi'), isha = page.locator('.vakit[data-key="Isha"] .v-saat');
    const sonraki = page.getByRole('button', { name: 'Volgende dag' }), onceki = page.getByRole('button', { name: 'Vorige dag' });
    await expect(isha).toHaveText('19:02');
    await expect(page.locator('.vakit.simdi')).toHaveCount(1);

    await sonraki.click();
    await expect(miladi).toHaveText('Donderdag 29 oktober 2026');
    await expect(page.locator('#gun-hicri')).toHaveText('18 Jumada al-Awwal 1448');
    await expect(isha).toHaveText('19:00');
    await expect(page.locator('.vakit.siradaki')).toHaveCount(0);
    await expect(page.locator('.vakit.simdi')).toHaveCount(0);
    await page.clock.runFor(1000);
    await expect(page.locator('.sayac')).toHaveText('1:26:58');                   // sayaç hep bugünün
    await expect(isha).toHaveText('19:00');                                     // saat işleyince de o gün kalır

    await onceki.click();
    await expect(miladi).toHaveText('Woensdag 28 oktober 2026');
    await expect(page.locator('.vakit.siradaki')).toHaveAttribute('data-key', 'Maghrib');

    // eldeki veri 23.10'da başlıyor: daha geriye gidilmez
    for (let i = 0; i < 5; i++) await onceki.click();
    await expect(miladi).toHaveText('Vrijdag 23 oktober 2026');
    await expect(onceki).toBeDisabled();
    await expect(sonraki).toBeEnabled();

    await page.evaluate(() => { location.hash = '#ayarlar'; });
    await page.evaluate(() => { location.hash = '#ana'; });
    await page.clock.runFor(1000);
    await expect(miladi).toHaveText('Woensdag 28 oktober 2026');
  });

  test('oklu tarih bütün temalarda (20-11-2026)', async ({ page }) => {
    await ac(page, '16:00:00.500');
    for (const stil of ['cini', 'gok', 'liste', 'zumrut']) {
      await page.evaluate((x) => localStorage.setItem('nzm.stil', x), stil);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-stil', stil);
      await expect(page.locator('#gun-miladi'), stil).toHaveText('Woensdag 28 oktober 2026');
      await expect(page.getByRole('button', { name: 'Volgende dag' }), stil).toBeVisible();
    }
  });
});

// ---------------- Tema 2 ('gok') ve Tema 4 ('zumrut'; kullanıcı isteği ve örnek resimleri, 20-11-2026; sadece telefon tasarımı) ----------------
test.describe('Tema 2 ve 4', () => {
  test('Tema 2: gökyüzü içinde bulunulan vakte göre; güneş yayında vakitlerin noktaları (ad ve saat yok); ortada sıradaki vakte kalan süre; gece ay', async ({ page }) => {
    await mobilAc(page, { zaman: an('05:40:00.500'), depo: { 'nzm.stil': 'gok', 'nzm.dil': 'tr' } });
    const kok = page.locator('html');
    await expect(kok).toHaveAttribute('data-gok', 'seher');
    for (const [saat, faz] of [['08:00:00.500', 'sabah'], ['13:00:00.500', 'ogle'], ['16:00:00.500', 'ikindi']]) {
      await saatGit(page, an(saat));
      await expect(kok, saat).toHaveAttribute('data-gok', faz);
    }
    await expect(page.locator('.kalan-etiket')).toHaveText("AKŞAM'A KALAN");
    await expect(page.locator('.sayac')).toHaveText(/^1:26:5\d$/);
    await expect(page.locator('.gok-saat')).toHaveText('saat 17:27');
    await expect(page.locator('.gok-yay .gy-nokta')).toHaveCount(7);
    await expect(page.locator('.gok-yay text')).toHaveCount(0);                // yayda ad ve saat yok (kullanıcı isteği, 20-11-2026)
    // kerahat ufuk çizgisinin altında (kullanıcı isteği, 20-11-2026)
    const [yay, kh] = await Promise.all([page.locator('.gok-yay').boundingBox(), page.locator('.kh-cumle').boundingBox()]);
    expect(kh.y).toBeGreaterThanOrEqual(yay.y + yay.height * 146 / 196);
    await expect(page.locator('.gok-yay .gy-gunes')).toHaveCount(1);
    await expect(page.locator('#gun-miladi')).toHaveText('Çarşamba 28 Ekim 2026');
    for (const [saat, faz] of [['18:00:00.500', 'aksam'], ['21:30:00.500', 'gece']]) {
      await saatGit(page, an(saat));
      await expect(kok, saat).toHaveAttribute('data-gok', faz);
    }
    await expect(page.locator('.gok-yay .gy-ay')).toHaveCount(1);
  });

  test('Tema 4: "Şimdi" kartı, kalan süre halkası, altında kerahat (zaman çizgisi yok), tarih kartı, vakit kartları; sıradaki "Sıradaki" rozetli', async ({ page }) => {
    await mobilAc(page, { zaman: an('16:00:00.500'), depo: { 'nzm.stil': 'zumrut', 'nzm.dil': 'tr' } });
    await expect(page.locator('.t4-etiket')).toHaveText('Şimdi');
    await expect(page.locator('.t4-ad')).toHaveText('İkindi');
    await expect(page.locator('.t4-saat')).toHaveText('16:00');
    await expect(page.locator('.t4-kalan')).toHaveText('1:26:59');
    await expect(page.locator('.t4-kerahat')).toHaveText('Kerahat vaktine 0:41:59 kaldı');
    const [kutu, kerahat, tarih] = await Promise.all(['.t4-ust', '.t4-kerahat', '.gun-gez'].map((s) => page.locator(s).boundingBox()));
    expect(kutu.y + kutu.height).toBeLessThanOrEqual(kerahat.y + 1);                 // iki kutunun altında, tarihin üstünde
    expect(kerahat.y + kerahat.height).toBeLessThanOrEqual(tarih.y + 1);
    // halka: İkindi 14:54 → Akşam 17:27, 66 / 153 dk geçti
    expect(parseFloat(await page.locator('.t4-dolu').getAttribute('stroke-dasharray'))).toBeCloseTo(2 * Math.PI * 52 * (66 / 153), 0);
    expect(await page.locator('.vakit.siradaki .v-ad').evaluate((e) => getComputedStyle(e, '::after').content)).toBe('"Sıradaki"');
    await expect(page.locator('.kemer')).toBeHidden();
    await expect(page.locator('#gun-miladi')).toHaveText('Çarşamba 28 Ekim 2026');
    await page.clock.runFor(1000);
    await expect(page.locator('.t4-kalan')).toHaveText('1:26:58');
  });
});

// ---------------- Ayarlar: açıklamalar "?" düğmesinin arkasında (kullanıcı isteği, 11-11-2026) ----------------
test.describe('Ayarlar: açıklamalar', () => {
  const ac = (page, dil = 'nl') => mobilAc(page, { zaman: an('16:00:00.500'), adres: '/mobil/#ayarlar', depo: { 'nzm.dil': dil, 'nzm.tema': 'gunduz' } });


  test('her açıklamanın "?" düğmesi var, hepsi kapalı başlar; görünür açıklama yazısı kalmaz (kaynak satırı hariç); düğmenin adı dile göre', async ({ page }) => {
    await ac(page);
    const notlar = await page.locator('.ipucu-not').evaluateAll((els) => els.map((e) => ({ id: e.id, kapali: e.hidden, dugme: !!document.querySelector(`.ipucu[aria-controls="${e.id}"]`) })));
    expect(notlar.map((x) => x.id)).toEqual(['ip-kerahat', 'ip-sayac', 'ip-widget', 'ip-ses', 'ip-sessiz']);   // sessize alma ayrı sayfada (20-11-2026)   // tema açıklaması kalktı (sabit temalar, 20-11-2026)   // ses: bildirim sayfasında (19-11-2026)
    for (const x of notlar) expect(x, x.id).toMatchObject({ kapali: true, dugme: true });
    await expect(page.locator('#s-ayarlar .ayar-not:visible')).toHaveText(['Gebedstijden: Diyanet']);
    await page.getByRole('button', { name: 'Türkçe' }).click();
    await expect(page.locator('.ipucu[aria-controls="ip-sayac"]')).toHaveAttribute('aria-label', 'Açıklama: Vakitler ve geri sayım');
  });
});
