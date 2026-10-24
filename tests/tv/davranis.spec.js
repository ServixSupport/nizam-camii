// TV ekranının (index.html) bugünkü davranışı — Faz 0 temel testleri.
// Sonraki fazlarda TV'nin değişmediği bu testlerle kanıtlanır. Testi değil, kodu düzelt.
//
// Test günü: Çarşamba 28-10-2026 (cuma değil, yaz saati bitmiş: +01:00).
//   İmsak 05:34 · Sabah 06:21 (= Güneş − 60) · Güneş 07:21 · Öğle 12:29
//   İkindi 14:54 · Akşam 17:27 · Yatsı 19:02          (yarın İmsak 05:35)
// Zamanlar ".500" ile verilir: saniye yuvarlaması her çalıştırmada aynı kalsın.
import { test, expect } from '@playwright/test';
import { tvAc, ileri, saatGit, vakitleriOku, VAKIT, HUTBE, ALADHAN_VAKIT } from '../yardimci/tv.js';

const GUN = '2026-10-28';
const an = (saat, gun = GUN, ofset = '+01:00') => `${gun}T${saat}${ofset}`;

const swap = (page) => page.locator('.swap-area');
// tema değişimi requestAnimationFrame ile uygulanır: okumadan önce bir kare (50 ms) akıt
const bodyTema = async (page) => {
  await page.clock.runFor(50);
  return page.evaluate(() =>
    document.body.classList.contains('light') ? 'light' : document.body.classList.contains('green') ? 'green' : 'dark');
};

test.describe('vakitler ve tarih', () => {
  test('Diyanet vakitleri düzeltmesiz yazılır; Sabah = Güneş − 60 dk', async ({ page }) => {
    await tvAc(page, { zaman: an('10:05:00.500') });
    expect(await vakitleriOku(page)).toEqual({
      Imsak: '05:34', Fajr: '06:21', Sunrise: '07:21', Dhuhr: '12:29',
      Asr: '14:54', Maghrib: '17:27', Isha: '19:02',
    });
    await expect(page.locator('#date-miladi')).toHaveText('28 Ekim 2026 Çarşamba');
    await expect(page.locator('#date-hicri')).toHaveText('17 Jumada al-Awwal 1448');
    await expect(page.locator('#clk-h')).toHaveText('10');
    await expect(page.locator('#clk-m')).toHaveText('05');
  });

  test('geri sayım sıradaki vakte sayar, sıradaki kutu vurgulanır', async ({ page }) => {
    await tvAc(page, { zaman: an('10:05:00.500') });
    await expect(page.locator('#cd-label')).toHaveText("Öğle'ye kalan süre");
    await expect(page.locator('#cd-timer')).toHaveText('02:23:59');
    await ileri(page, 1000);
    await expect(page.locator('#cd-timer')).toHaveText('02:23:58');
    await expect(page.locator('.next')).toHaveCount(1);
    await expect(page.locator('#box-Dhuhr')).toHaveClass(/\bnext\b/);
  });

  test("Yatsı'dan sonra yarının İmsak'ına sayar", async ({ page }) => {
    await tvAc(page, { zaman: an('21:05:00.500') });
    await expect(page.locator('#cd-label')).toHaveText("İmsak'a kalan süre");
    await expect(page.locator('#cd-timer')).toHaveText('08:29:59');   // → 29-10 05:35
    expect((await vakitleriOku(page)).Isha).toBe('19:02');            // ekranda hâlâ bugünün vakitleri
  });

  test('gece yarısı yeni günün vakitleri ve tarihi gelir', async ({ page }) => {
    await tvAc(page, { zaman: an('23:59:58.500') });
    await expect(page.locator('#date-miladi')).toHaveText('28 Ekim 2026 Çarşamba');
    await ileri(page, 3000);
    await expect(page.locator('#date-miladi')).toHaveText('29 Ekim 2026 Perşembe');
    await expect(page.locator('#date-hicri')).toHaveText('18 Jumada al-Awwal 1448');
    expect(await vakitleriOku(page)).toEqual({
      Imsak: '05:35', Fajr: '06:23', Sunrise: '07:23', Dhuhr: '12:29',
      Asr: '14:53', Maghrib: '17:25', Isha: '19:00',
    });
  });

  test('yaz saati bitişi (25-10-2026): gün değişimi ve geri sayım doğru', async ({ page }) => {
    await tvAc(page, { zaman: '2026-10-24T23:59:58.500+02:00' });
    expect((await vakitleriOku(page)).Imsak).toBe('06:27');
    await ileri(page, 3000);
    await expect(page.locator('#date-miladi')).toHaveText('25 Ekim 2026 Pazar');
    await expect.poll(() => vakitleriOku(page)).toEqual({
      Imsak: '05:29', Fajr: '06:16', Sunrise: '07:16', Dhuhr: '12:30',
      Asr: '14:59', Maghrib: '17:33', Isha: '19:07',
    });
    await saatGit(page, '2026-10-25T03:30:00.500+01:00');               // saat 03:00'te 02:00'ye döndü
    await expect(page.locator('#clk-h')).toHaveText('03');
    await expect(page.locator('#cd-label')).toHaveText("İmsak'a kalan süre");
    await expect(page.locator('#cd-timer')).toHaveText('01:58:59');
  });

  test('son veri tarayıcıya kaydedilir (localStorage "vakitler")', async ({ page }) => {
    await tvAc(page, { zaman: an('10:05:00.500') });
    const kayitli = await page.evaluate(() => JSON.parse(localStorage.getItem('vakitler')));
    expect(kayitli).toEqual(VAKIT.days);
  });
});

test.describe('veri kaynağı', () => {
  test('/api/vakit parametresiz çağrılır; Diyanet\'e tarayıcıdan gidilmez', async ({ page }) => {
    const k = await tvAc(page, { zaman: an('10:05:00.500') });
    const vakit = k.api.filter((u) => u.pathname === '/api/vakit');
    expect(vakit).toHaveLength(1);
    expect(vakit[0].search).toBe('');
    expect(k.api.filter((u) => u.pathname === '/api/hutbe').map((u) => u.search)).toEqual(['']);
    expect(k.dis).toEqual([]);                       // Aladhan'a da gidilmedi: Diyanet verisi var
  });

  test('Aladhan yedeği: Diyanet verisi yoksa, İmsak +48 ve Yatsı −41 dk', async ({ page }) => {
    const k = await tvAc(page, { zaman: '2026-12-01T10:05:00.500+01:00' });   // veri 23-11'de bitiyor
    expect(await vakitleriOku(page)).toEqual({
      Imsak: '05:48', Fajr: '07:00', Sunrise: '08:00', Dhuhr: '12:30',
      Asr: '14:20', Maghrib: '16:40', Isha: '17:49',
    });
    await expect(page.locator('#date-hicri')).toHaveText('10 Jumada al-Thani 1448');
    expect(k.dis.sort()).toEqual([
      'https://api.aladhan.com/v1/timings/01-12-2026?latitude=52.36523&longitude=4.79997&method=13',
      'https://api.aladhan.com/v1/timings/02-12-2026?latitude=52.36523&longitude=4.79997&method=13',
    ]);
    expect(ALADHAN_VAKIT.Imsak).toBe('05:00');
  });

  test('bugün Diyanet, yarın Aladhan: yarının İmsak\'ı düzeltmeli', async ({ page }) => {
    const k = await tvAc(page, { zaman: '2026-11-23T21:05:00.500+01:00' });
    expect((await vakitleriOku(page)).Isha).toBe('18:27');            // bugün: Diyanet, düzeltmesiz
    await expect(page.locator('#cd-label')).toHaveText("İmsak'a kalan süre");
    await expect(page.locator('#cd-timer')).toHaveText('08:42:59');   // → 24-11 05:00 + 48 = 05:48
    expect(k.dis).toEqual([
      'https://api.aladhan.com/v1/timings/24-11-2026?latitude=52.36523&longitude=4.79997&method=13',
    ]);
  });

  test('internet yoksa en son kaydedilen veri kullanılır', async ({ page }) => {
    const k = await tvAc(page, {
      zaman: an('10:05:00.500'), vakit: 'hata', aladhan: 'hata',
      depo: { vakitler: JSON.stringify(VAKIT.days) },
    });
    expect((await vakitleriOku(page)).Dhuhr).toBe('12:29');
    expect(k.dis).toEqual([]);
  });

  test('API "available: false" derse de kayıtlı veri kullanılır', async ({ page }) => {
    await tvAc(page, {
      zaman: an('10:05:00.500'), vakit: { available: false, reason: 'test' },
      depo: { vakitler: JSON.stringify(VAKIT.days) },
    });
    expect((await vakitleriOku(page)).Dhuhr).toBe('12:29');
  });

  test('hiç veri yoksa "Bağlantı bekleniyor…" yazar', async ({ page }) => {
    await tvAc(page, { zaman: an('10:05:00.500'), vakit: 'hata', aladhan: 'hata', bekle: false });
    await expect(page.locator('#loading')).toBeVisible();
    await expect(page.locator('#loading')).toHaveText('Bağlantı bekleniyor…');
  });
});

test.describe('namaz öncesi sayaç ve ezan anı', () => {
  const NAMAZLAR = [
    { key: 'Dhuhr', saat: '12:29', once: 'ÖĞLE NAMAZINA', ezan: 'ÖĞLE', tr: 'Öğle' },
    { key: 'Asr', saat: '14:54', once: 'İKİNDİ NAMAZINA', ezan: 'İKİNDİ', tr: 'İkindi' },
    { key: 'Maghrib', saat: '17:27', once: 'AKŞAM NAMAZINA', ezan: 'AKŞAM', tr: 'Akşam' },
    { key: 'Isha', saat: '19:02', once: 'YATSI NAMAZINA', ezan: 'YATSI', tr: 'Yatsı' },
  ];
  const dk = (hhmm, saniye) => {
    const [h, m] = hhmm.split(':').map(Number);
    const t = h * 3600 + m * 60 + saniye;
    const p = (n) => String(n).padStart(2, '0');
    return `${p(Math.floor(t / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}.500`;
  };

  for (const n of NAMAZLAR) {
    test(`${n.tr}: 60 sn kala sayaç, vakitte EZAN VAKTİ, 60 sn sonra normal`, async ({ page }) => {
      await tvAc(page, { zaman: an(dk(n.saat, -61)) });
      await expect(swap(page)).not.toHaveClass(/show-prepare/);

      await ileri(page, 31000);                                       // 29,5 sn kala
      await expect(swap(page)).toHaveClass(/show-prepare/);
      await expect(page.locator('.prep-card')).not.toHaveClass(/\bezan\b/);
      await expect(page.locator('#prep-name')).toHaveText(n.once);
      await expect(page.locator('#prep-sec')).toHaveText('30');

      await saatGit(page, an(dk(n.saat, 10)));                        // vakit girdi
      await expect(swap(page)).toHaveClass(/show-prepare/);
      await expect(page.locator('.prep-card')).toHaveClass(/\bezan\b/);
      await expect(page.locator('#prep-ezan-name')).toHaveText(n.ezan);
      await expect(page.locator('#prep-ezan-text')).toHaveText('EZAN VAKTİ');
      await expect(page.locator('#box-countdown')).toHaveClass(/\bezan\b/);
      await expect(page.locator('#cd-banner')).toHaveText('EZAN VAKTİ');
      await expect(page.locator('#cd-banner')).not.toHaveClass(/hidden/);
      await expect(page.locator('#cd-label')).toHaveText(n.tr);
      await expect(page.locator(`#box-${n.key}`)).toHaveClass(/\bflash\b/);
      await expect(page.locator('.next')).toHaveCount(0);

      await saatGit(page, an(dk(n.saat, 61)));                        // ezan süresi bitti
      await expect(swap(page)).not.toHaveClass(/show-prepare/);
      await expect(page.locator('#box-countdown')).not.toHaveClass(/\bezan\b/);
      await expect(page.locator('.flash')).toHaveCount(0);
    });
  }

  test('Sabah: 60 sn kala sayaç var, vakitte ezan ekranı yok, kutu yanıp söner', async ({ page }) => {
    await tvAc(page, { zaman: an('06:20:30.500') });
    await expect(swap(page)).toHaveClass(/show-prepare/);
    await expect(page.locator('#prep-name')).toHaveText('SABAH NAMAZINA');
    await saatGit(page, an('06:21:10.500'));
    await expect(swap(page)).not.toHaveClass(/show-prepare/);
    await expect(page.locator('#box-Fajr')).toHaveClass(/\bflash\b/);
    await expect(page.locator('#box-countdown')).not.toHaveClass(/\bezan\b/);
    await expect(page.locator('#cd-label')).toHaveText("Güneş'e kalan süre");
  });

  test('İmsak: sayaç yok, vakitte kutuda İMSAK VAKTİ', async ({ page }) => {
    await tvAc(page, { zaman: an('05:33:30.500') });
    await expect(swap(page)).not.toHaveClass(/show-prepare/);
    await saatGit(page, an('05:34:10.500'));
    await expect(swap(page)).not.toHaveClass(/show-prepare/);
    await expect(page.locator('#box-countdown')).toHaveClass(/\bezan\b/);
    await expect(page.locator('#cd-banner')).toHaveText('İMSAK VAKTİ');
    await expect(page.locator('#cd-label')).toHaveText('İmsak');
    await expect(page.locator('#sun-Imsak')).toHaveClass(/\bflash\b/);
  });

  test('Güneş: sayaç ve ezan yok, sadece panel yanıp söner', async ({ page }) => {
    await tvAc(page, { zaman: an('07:20:30.500') });
    await expect(swap(page)).not.toHaveClass(/show-prepare/);
    await saatGit(page, an('07:21:10.500'));
    await expect(page.locator('#sun-Sunrise')).toHaveClass(/\bflash\b/);
    await expect(page.locator('#box-countdown')).not.toHaveClass(/\bezan\b/);
    await expect(page.locator('#cd-label')).toHaveText("Öğle'ye kalan süre");
  });

  test('ayarlardan kapatılınca sayaç ekranı çıkmaz, kutudaki EZAN VAKTİ kalır', async ({ page }) => {
    await tvAc(page, { zaman: an('12:28:30.500'), depo: { 'nizam-sayac': 'off' } });
    await expect(swap(page)).not.toHaveClass(/show-prepare/);
    await saatGit(page, an('12:29:10.500'));
    await expect(swap(page)).not.toHaveClass(/show-prepare/);
    await expect(page.locator('#cd-banner')).toHaveText('EZAN VAKTİ');
  });

  test('?test=hazirlik sürekli 60\'tan geri sayar; ?test=ezan sürekli EZAN VAKTİ', async ({ page }) => {
    await tvAc(page, { zaman: an('10:05:00.500'), adres: '/?test=hazirlik' });
    await expect(swap(page)).toHaveClass(/show-prepare/);
    await expect(page.locator('#prep-name')).toHaveText('ÖĞLE NAMAZINA');
    const s1 = Number(await page.locator('#prep-sec').textContent());
    await ileri(page, 5000);
    const s2 = Number(await page.locator('#prep-sec').textContent());
    expect(s1).toBeGreaterThan(55);
    expect(s1 - s2).toBeGreaterThanOrEqual(4);                         // ekran ~4 kez/sn tazelenir
    expect(s1 - s2).toBeLessThanOrEqual(6);
    await ileri(page, 120000);
    await expect(swap(page)).toHaveClass(/show-prepare/);

    await page.goto('/?test=ezan');
    await expect(page.locator('#loading')).toBeHidden();
    await ileri(page, 1000);
    await expect(page.locator('.prep-card')).toHaveClass(/\bezan\b/);
    await expect(page.locator('#prep-ezan-text')).toHaveText('EZAN VAKTİ');
  });
});

test.describe('âyet / hadîs / duâ paneli', () => {
  test('her çeyrek saatte sırayla âyet → hadîs → duâ, 30 sn kalır', async ({ page }) => {
    await tvAc(page, { zaman: an('10:14:58.500') });
    await expect(swap(page)).not.toHaveClass(/show-feature/);
    await ileri(page, 2000);                                           // 10:15:00,5
    await expect(swap(page)).toHaveClass(/show-feature/);
    await expect(page.locator('#feat-tag')).toHaveText('ÂYET-İ KERÎME');
    await expect(page.locator('#feat-ar')).toHaveText(/[؀-ۿ]/);
    await expect(page.locator('#feat-tr')).not.toBeEmpty();
    await expect(page.locator('#feat-src')).not.toBeEmpty();
    await ileri(page, 31000);
    await expect(swap(page)).not.toHaveClass(/show-feature/);

    await saatGit(page, an('10:30:00.500'));
    await expect(page.locator('#feat-tag')).toHaveText('HADÎS-İ ŞERÎF');
    await expect(swap(page)).toHaveClass(/show-feature/);
    await saatGit(page, an('10:45:00.500'));
    await expect(page.locator('#feat-tag')).toHaveText('DUÂ');
    await saatGit(page, an('11:00:00.500'));
    await expect(page.locator('#feat-tag')).toHaveText('ÂYET-İ KERÎME');
  });

  test('namaz vaktinden 5 dk önce – 20 dk sonra panel açılmaz, sıra kaybolmaz', async ({ page }) => {
    await tvAc(page, { zaman: an('12:44:58.500') });                   // Öğle 12:29 + 16 dk
    await ileri(page, 2000);
    await expect(swap(page)).not.toHaveClass(/show-feature/);
    await saatGit(page, an('13:00:00.500'));
    await expect(swap(page)).toHaveClass(/show-feature/);
    await expect(page.locator('#feat-tag')).toHaveText('ÂYET-İ KERÎME');
  });

  test('sayfa ilk açıldığında panel hemen çıkmaz', async ({ page }) => {
    await tvAc(page, { zaman: an('10:15:01.500') });                   // sayfa 10:14:59,5'te açıldı
    await ileri(page, 5000);
    await expect(swap(page)).not.toHaveClass(/show-feature/);
  });

  for (const [adres, etiket] of [
    ['/?test=ayet', 'ÂYET-İ KERÎME'], ['/?test=hadis', 'HADÎS-İ ŞERÎF'], ['/?test=dua', 'DUÂ'],
    ['/?test=DU%C3%82', 'DUÂ'], ['/?test=Had%C3%AEs', 'HADÎS-İ ŞERÎF'], ['/?test=ayet-i', 'ÂYET-İ KERÎME'],
  ]) {
    test(`${decodeURIComponent(adres)} paneli kalıcı gösterir`, async ({ page }) => {
      await tvAc(page, { zaman: an('10:05:00.500'), adres });
      await expect(swap(page)).toHaveClass(/show-feature/);
      await expect(page.locator('#feat-tag')).toHaveText(etiket);
      await ileri(page, 60000);
      await expect(swap(page)).toHaveClass(/show-feature/);
    });
  }
});

test.describe('cuma hutbesi', () => {
  const CUMA = '2026-10-30';                                           // Öğle 12:29 → hutbe 12:39–13:09

  test('cuma Öğle + 10 dk açılır, 30 dk sonra kapanır', async ({ page }) => {
    await tvAc(page, { zaman: an('12:38:58.500', CUMA), hutbe: HUTBE });
    await expect(page.locator('#hutbe')).toBeHidden();
    await ileri(page, 2000);                                           // 12:39:00,5
    await expect(page.locator('#hutbe')).toBeVisible();
    await expect(page.locator('#hutbe-title')).toHaveText(HUTBE.title);
    await expect(page.locator('#hutbe-date')).toHaveText(HUTBE.date);
    await expect(page.locator('#hutbe-body p')).toHaveCount(HUTBE.paragraphs.length);
    await expect(page.locator('#hutbe-body p').first()).toHaveClass('lead');
    await expect(page.locator('#hutbe-body p.quote')).toHaveCount(1);
    await expect(page.locator('#hutbe-body p').nth(1)).toHaveText(HUTBE.paragraphs[1].text);

    await saatGit(page, an('13:08:59.500', CUMA));
    await expect(page.locator('#hutbe')).toBeVisible();
    await ileri(page, 1000);
    await expect(page.locator('#hutbe')).toBeHidden();
  });

  test('cuma değilse açılmaz', async ({ page }) => {
    await tvAc(page, { zaman: an('12:45:00.500', '2026-10-29'), hutbe: HUTBE });
    await ileri(page, 2000);
    await expect(page.locator('#hutbe')).toBeHidden();
  });

  test('hutbe metni yoksa cuma da açılmaz', async ({ page }) => {
    await tvAc(page, { zaman: an('12:45:00.500', CUMA) });
    await ileri(page, 2000);
    await expect(page.locator('#hutbe')).toBeHidden();
  });

  test('hutbe açıkken âyet paneli çıkmaz', async ({ page }) => {
    await tvAc(page, { zaman: an('12:59:58.500', CUMA), hutbe: HUTBE });
    await ileri(page, 2000);
    await expect(page.locator('#hutbe')).toBeVisible();
    await expect(swap(page)).not.toHaveClass(/show-feature/);
  });

  test('?test=hutbe her gün gösterir', async ({ page }) => {
    await tvAc(page, { zaman: an('10:05:00.500'), adres: '/?test=hutbe', hutbe: HUTBE });
    await ileri(page, 1000);
    await expect(page.locator('#hutbe')).toBeVisible();
    await expect(page.locator('#hutbe-title')).toHaveText(HUTBE.title);
  });
});

test.describe('tema', () => {
  test('otomatik (varsayılan): Güneş − 1 sn açık, Akşam − 1 sn koyu', async ({ page }) => {
    await tvAc(page, { zaman: an('07:20:58.500') });
    expect(await bodyTema(page)).toBe('dark');
    await ileri(page, 1000);
    expect(await bodyTema(page)).toBe('light');
    await saatGit(page, an('17:26:58.500'));
    expect(await bodyTema(page)).toBe('light');
    await ileri(page, 1000);
    expect(await bodyTema(page)).toBe('dark');
  });

  for (const [adres, saat, beklenen] of [
    ['/?theme=dark', '10:05:00.500', 'dark'],
    ['/?theme=light', '21:05:00.500', 'light'],
    ['/?theme=green', '10:05:00.500', 'green'],
    ['/?theme=auto', '21:05:00.500', 'dark'],
    ['/?theme=bilinmeyen', '10:05:00.500', 'light'],
  ]) {
    test(`${adres} → ${beklenen} (kaydedilmez)`, async ({ page }) => {
      await tvAc(page, { zaman: an(saat), adres });
      expect(await bodyTema(page)).toBe(beklenen);
      expect(await page.evaluate(() => localStorage.getItem('nizam-tema'))).toBeNull();
    });
  }

  test('kayıtlı tema (localStorage "nizam-tema") uygulanır', async ({ page }) => {
    await tvAc(page, { zaman: an('10:05:00.500'), depo: { 'nizam-tema': 'green' } });
    expect(await bodyTema(page)).toBe('green');
  });
});

test.describe('ayarlar penceresi', () => {
  test('dişliyle açılır, tema seçilir ve saklanır', async ({ page }) => {
    await tvAc(page, { zaman: an('10:05:00.500') });
    await expect(page.locator('#settings')).toBeHidden();
    await page.locator('#gear').click();
    await expect(page.locator('#settings')).toBeVisible();
    await expect(page.locator('.set-opt[data-mode="auto"]')).toHaveClass(/\bsel\b/);
    await expect(page.locator('.set-opt[data-mode="auto"]')).toBeFocused();

    await page.locator('.set-opt[data-mode="green"]').click();
    expect(await bodyTema(page)).toBe('green');
    await expect(page.locator('.set-opt[data-mode="green"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('nizam-tema'))).toBe('green');

    await page.locator('#set-close').click();
    await expect(page.locator('#settings')).toBeHidden();

    await page.reload();
    await expect(page.locator('#loading')).toBeHidden();
    await ileri(page, 1000);
    expect(await bodyTema(page)).toBe('green');
  });

  test('sayaç anahtarı kapatılır ve saklanır', async ({ page }) => {
    await tvAc(page, { zaman: an('10:05:00.500') });
    await page.locator('#gear').click();
    const anahtar = page.locator('#set-prep');
    await expect(anahtar).toHaveAttribute('aria-checked', 'true');
    await anahtar.click();
    await expect(anahtar).toHaveAttribute('aria-checked', 'false');
    await expect(anahtar).toHaveText('Kapalı');
    expect(await page.evaluate(() => localStorage.getItem('nizam-sayac'))).toBe('off');
  });

  test('kumanda: ok tuşu dişliyi seçer, OK açar, oklarla gezilir, Geri kapatır', async ({ page }) => {
    await tvAc(page, { zaman: an('10:05:00.500') });
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#gear')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#settings')).toBeVisible();
    await expect(page.locator('.set-opt[data-mode="auto"]')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.set-opt[data-mode="green"]')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#set-prep')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#settings')).toBeHidden();
  });

  test('60 sn dokunulmazsa kendiliğinden kapanır; boşluğa tıklayınca kapanır', async ({ page }) => {
    await tvAc(page, { zaman: an('10:05:00.500') });
    await page.locator('#gear').click();
    await ileri(page, 59000);
    await expect(page.locator('#settings')).toBeVisible();
    await ileri(page, 2000);
    await expect(page.locator('#settings')).toBeHidden();

    await page.locator('#gear').click();
    await page.mouse.click(10, 10);
    await expect(page.locator('#settings')).toBeHidden();
  });
});

test('1920×1080 sahne ölçeklenmeden gösterilir', async ({ page }) => {
  await tvAc(page, { zaman: an('10:05:00.500') });
  expect(await page.locator('#stage').evaluate((e) => e.style.transform)).toBe('translate(-50%, -50%) scale(1)');
});
