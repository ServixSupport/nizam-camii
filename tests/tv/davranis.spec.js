// TV ekranının (index.html) bugünkü davranışı — Faz 0 temel testleri.
// Sonraki fazlarda TV'nin değişmediği bu testlerle kanıtlanır. Testi değil, kodu düzelt.
//
// Test günü: Çarşamba 28-10-2026 (cuma değil, yaz saati bitmiş: +01:00).
//   İmsak 05:34 · Sabah 06:21 (= Güneş − 60) · Güneş 07:21 · Öğle 12:29
//   İkindi 14:54 · Akşam 17:27 · Yatsı 19:02          (yarın İmsak 05:35)
// Zamanlar ".500" ile verilir: saniye yuvarlaması her çalıştırmada aynı kalsın.
import { test, expect } from '@playwright/test';
import { tvAc, ileri, saatGit, vakitleriOku, VAKIT, HUTBE, ALADHAN_VAKIT } from '../yardimci/tv.js';
import { tasarimIcerik } from '../fixtures/tasarim-icerik.js';

const GUN = '2026-10-28';
const an = (saat, gun = GUN, ofset = '+01:00') => `${gun}T${saat}${ofset}`;

const swap = (page) => page.locator('.swap-area');
// tema değişimi requestAnimationFrame ile uygulanır: okumadan önce bir kare (50 ms) akıt
const bodyTema = async (page) => {
  await page.clock.runFor(50);
  return page.evaluate(() =>
    document.body.classList.contains('krem') ? 'krem' : document.body.classList.contains('light') ? 'light' : 'dark');
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

  test('ayarlardan: başlangıç ve süre değiştirilir, saklanır ve uygulanır', async ({ page }) => {
    await tvAc(page, { zaman: an('12:37:00.500', CUMA), hutbe: HUTBE });
    await page.locator('#gear').click();
    await expect(page.locator('#hutbe-gecikme')).toHaveText('Öğle + 10 dk');
    await expect(page.locator('#hutbe-sure')).toHaveText('30 dk');
    await page.locator('#hutbe-gecikme-arti').click();
    await page.locator('#hutbe-gecikme-arti').click();
    await page.locator('#hutbe-sure-eksi').click();
    await page.locator('#hutbe-sure-eksi').click();
    await expect(page.locator('#hutbe-gecikme')).toHaveText('Öğle + 20 dk');
    await expect(page.locator('#hutbe-sure')).toHaveText('20 dk');
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('nizam-hutbe')))).toEqual({ gecikme: 20, sure: 20 });
    await page.locator('#set-close').click();
    await saatGit(page, an('12:40:00.500', CUMA));
    await expect(page.locator('#hutbe')).toBeHidden();                 // 12:40: varsayılanda açıktı, artık Öğle + 20'den önce
    await saatGit(page, an('12:49:00.500', CUMA));
    await expect(page.locator('#hutbe')).toBeVisible();                // 12:49 = 12:29 + 20
    await saatGit(page, an('13:08:59.500', CUMA));
    await expect(page.locator('#hutbe')).toBeVisible();
    await ileri(page, 1000);
    await expect(page.locator('#hutbe')).toBeHidden();                 // 12:49 + 20 dk
  });

  test('ayar sınırları: Öğle vaktinde başlayabilir; süre en az 5, en çok 90 dk', async ({ page }) => {
    await tvAc(page, { zaman: an('10:05:00.500'), depo: { 'nizam-hutbe': JSON.stringify({ gecikme: 5, sure: 10 }) } });
    await page.locator('#gear').click();
    await page.locator('#hutbe-gecikme-eksi').click();
    await expect(page.locator('#hutbe-gecikme')).toHaveText('Öğle vaktinde');
    await expect(page.locator('#hutbe-gecikme-eksi')).toBeDisabled();
    await page.locator('#hutbe-sure-eksi').click();
    await expect(page.locator('#hutbe-sure')).toHaveText('5 dk');
    await expect(page.locator('#hutbe-sure-eksi')).toBeDisabled();
  });

  test('bozuk kayıt: varsayılan (Öğle + 10, 30 dk)', async ({ page }) => {
    await tvAc(page, { zaman: an('10:05:00.500'), depo: { 'nizam-hutbe': 'bozuk' } });
    await page.locator('#gear').click();
    await expect(page.locator('#hutbe-gecikme')).toHaveText('Öğle + 10 dk');
    await expect(page.locator('#hutbe-sure')).toHaveText('30 dk');
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
  test('varsayılan krem; gün içinde tema kendiliğinden değişmez (otomatik mod kaldırıldı)', async ({ page }) => {
    await tvAc(page, { zaman: an('07:20:58.500') });
    expect(await bodyTema(page)).toBe('krem');
    await ileri(page, 1000);                                           // Güneş
    expect(await bodyTema(page)).toBe('krem');
    await saatGit(page, an('17:27:00.500'));                           // Akşam
    expect(await bodyTema(page)).toBe('krem');
  });

  test('eskiden "gündüz açık · akşam koyu" seçilmiş TV krem temayla açılır', async ({ page }) => {
    await tvAc(page, { zaman: an('21:05:00.500'), depo: { 'nizam-tema': 'auto' } });
    expect(await bodyTema(page)).toBe('krem');
  });

  for (const [adres, saat, beklenen] of [
    ['/?theme=dark', '10:05:00.500', 'dark'],
    ['/?theme=light', '21:05:00.500', 'light'],
    ['/?theme=krem', '10:05:00.500', 'krem'],
    ['/?theme=green', '10:05:00.500', 'krem'],          // yeşil tema kaldırıldı (04-11-2026): eski adres krem açar
    ['/?theme=auto', '21:05:00.500', 'krem'],
    ['/?theme=bilinmeyen', '10:05:00.500', 'krem'],
  ]) {
    test(`${adres} → ${beklenen} (kaydedilmez)`, async ({ page }) => {
      await tvAc(page, { zaman: an(saat), adres });
      expect(await bodyTema(page)).toBe(beklenen);
      expect(await page.evaluate(() => localStorage.getItem('nizam-tema'))).toBeNull();
    });
  }

  test('kayıtlı tema (localStorage "nizam-tema") uygulanır', async ({ page }) => {
    await tvAc(page, { zaman: an('10:05:00.500'), depo: { 'nizam-tema': 'krem' } });
    expect(await bodyTema(page)).toBe('krem');
  });

  test('eskiden yeşil seçilmiş TV krem temayla açılır', async ({ page }) => {
    await tvAc(page, { zaman: an('10:05:00.500'), depo: { 'nizam-tema': 'green' } });
    expect(await bodyTema(page)).toBe('krem');
    await page.locator('#gear').click();
    await expect(page.locator('.set-opt[data-mode="krem"]')).toHaveClass(/\bsel\b/);
  });
});

test.describe('ayarlar penceresi', () => {
  test('dişliyle açılır, tema seçilir ve saklanır', async ({ page }) => {
    await tvAc(page, { zaman: an('10:05:00.500') });
    await expect(page.locator('#settings')).toBeHidden();
    await page.locator('#gear').click();
    await expect(page.locator('#settings')).toBeVisible();
    // üç tema, açıklama yazısı yok, her birinde gerçek görüntü
    await expect(page.locator('.set-opt .set-name')).toHaveText(['Koyu', 'Açık', 'Krem']);
    await expect(page.locator('.set-desc, .set-opt[data-mode="auto"]')).toHaveCount(0);
    for (const m of ['dark', 'light', 'krem']) {
      expect(await page.locator(`.set-opt[data-mode="${m}"] .set-prev`).evaluate((e) => getComputedStyle(e).backgroundImage)).toMatch(/^url\("data:image\/jpeg;base64,/);
    }
    await expect(page.locator('.set-opt[data-mode="krem"]')).toHaveClass(/\bsel\b/);
    await expect(page.locator('.set-opt[data-mode="krem"]')).toBeFocused();

    await page.locator('.set-opt[data-mode="dark"]').click();
    expect(await bodyTema(page)).toBe('dark');
    await expect(page.locator('.set-opt[data-mode="dark"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('nizam-tema'))).toBe('dark');

    await page.locator('#set-close').click();
    await expect(page.locator('#settings')).toBeHidden();

    await page.reload();
    await expect(page.locator('#loading')).toBeHidden();
    await ileri(page, 1000);
    expect(await bodyTema(page)).toBe('dark');
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
    await expect(page.locator('.set-opt[data-mode="krem"]')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.set-opt[data-mode="light"]')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#set-prep')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#set-dil')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#hutbe-gecikme-eksi')).toBeFocused();
    await page.keyboard.press('Enter');                                   // kumandayla da değişir
    await expect(page.locator('#hutbe-gecikme')).toHaveText('Öğle + 5 dk');
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

// Türkçe ↔ Hollandaca ve Arapça harfler (kullanıcı isteği, 04-11-2026)
test.describe('dil: Türkçe ↔ Hollandaca, Arapça adlar', () => {
  const AR = { Fajr: 'الفجر', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' };
  const adlar = (page) => page.locator('.box .tr').allTextContents();

  test('Türkçe dönemde Latin harfli Arapça adlar (eskisi gibi), Hollandaca dönemde Arapça harfler', async ({ page }) => {
    await tvAc(page, { zaman: an('10:02:00.500') });
    await expect(page.locator('.box .ar')).toHaveText(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
    await expect(page.locator('.sun-ar')).toHaveText(['İmsâk', 'Shuruq']);
    expect(await page.locator('.box .ar[lang]').count()).toBe(0);
    await page.goto('about:blank');
    await tvAc(page, { zaman: an('10:07:00.500'), dil: 'nl' });
    for (const [k, ar] of Object.entries(AR)) {
      const el = page.locator(`#box-${k} .ar`);
      await expect(el).toHaveText(ar);
      await expect(el).toHaveAttribute('lang', 'ar');
      await expect(el).toHaveAttribute('dir', 'rtl');
    }
    await expect(page.locator('.sun-ar')).toHaveText(['الإمساك', 'الشروق']);
  });

  test('5 dakikada bir: :00–:04 Türkçe, :05–:09 Hollandaca; sadece yazılar değişir', async ({ page }) => {
    await tvAc(page, { zaman: an('10:04:58.500'), dil: 'oto', adres: '/?theme=light' });   // kutuların yeri: eski düzen
    expect(await adlar(page)).toEqual(['Sabah', 'Öğle', 'İkindi', 'Akşam', 'Yatsı']);
    await expect(page.locator('#date-miladi')).toHaveText('28 Ekim 2026 Çarşamba');
    await expect(page.locator('#cd-label')).toHaveText("Öğle'ye kalan süre");
    const kutu = await page.locator('#box-Dhuhr').boundingBox();

    await ileri(page, 1700);                                           // 10:05:00,2: yazılar sönüyor
    expect(await page.evaluate(() => document.body.classList.contains('dil-gecis'))).toBe(true);
    await ileri(page, 800);                                            // yeni dilde
    expect(await page.evaluate(() => document.body.classList.contains('dil-gecis'))).toBe(false);
    expect(await adlar(page)).toEqual(['Ochtend', 'Middag', 'Namiddag', 'Avond', 'Nacht']);
    await expect(page.locator('.sun-tr')).toHaveText(['Imsak', 'Zonsopgang']);
    await expect(page.locator('#date-miladi')).toHaveText('Woensdag 28 oktober 2026');
    await expect(page.locator('#cd-label')).toHaveText('Nog tot Middag');
    await expect(page.locator('#box-Dhuhr .ar')).toHaveText('الظهر');            // Hollandaca dönemde Arapça harfler
    expect(await page.locator('#box-Dhuhr').boundingBox()).toEqual(kutu);       // kayma yok
    await expect(page.locator('.swap-area')).not.toHaveClass(/show-/);

    await saatGit(page, an('10:10:01.500'));
    await ileri(page, 1000);
    expect(await adlar(page)).toEqual(['Sabah', 'Öğle', 'İkindi', 'Akşam', 'Yatsı']);
    await expect(page.locator('#date-miladi')).toHaveText('28 Ekim 2026 Çarşamba');
  });

  test('vakit girince sayaç kutusundaki ad da o anki dilde', async ({ page }) => {
    await tvAc(page, { zaman: an('12:29:10.500'), dil: 'nl' });
    await expect(page.locator('#cd-label')).toHaveText('Middag');
    await expect(page.locator('#cd-banner')).toHaveText('EZAN VAKTİ');
  });

  test('?dil=tr ve ?dil=nl dili sabitler (kaydedilmez)', async ({ page }) => {
    test.slow();                                                       // 6 dk sahte saat (krem olmadan da ~29 sn sürüyordu)
    await tvAc(page, { zaman: an('10:07:00.500'), dil: 'tr' });
    await ileri(page, 6 * 60 * 1000);
    expect(await adlar(page)).toEqual(['Sabah', 'Öğle', 'İkindi', 'Akşam', 'Yatsı']);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => /dil/.test(k)))).toEqual([]);
  });
});

test('Hollandaca uzun adlar kutulara sığar, Arapça adla üst üste binmez (1920 ve 960 genişlik)', async ({ page }) => {
  for (const [w, h] of [[1920, 1080], [960, 540]]) {
    await page.setViewportSize({ width: w, height: h });
    await tvAc(page, { zaman: an('13:07:00.500'), dil: 'nl', adres: '/?theme=light' });   // 6 kutulu düzen; krem aşağıda
    const sorunlar = await page.evaluate(() => {
      const s = [];
      for (const kutu of document.querySelectorAll('.grid .box')) {
        const k = kutu.getBoundingClientRect();
        const tr = kutu.querySelector('.tr, .cd-label').getBoundingClientRect();
        const ar = kutu.querySelector('.ar');
        if (tr.right > k.right - 4) s.push(kutu.id + ': ad kutudan taşıyor');
        if (ar && tr.right > ar.getBoundingClientRect().left - 6) s.push(kutu.id + ': ad Arapçaya değiyor');
      }
      // üstteki Güneş/İmsak panelleri: yazı küçültülmeden sahnenin içinde ("Zonsopgang")
      const sahne = document.getElementById('stage').getBoundingClientRect();
      const olcek = sahne.width / 1920;
      for (const p of document.querySelectorAll('.sun-panel')) {
        const zaman = p.querySelector('.time').getBoundingClientRect();
        if (zaman.right > sahne.right - 40 * olcek) s.push(p.id + ': saat kenara taşıyor');
        if (parseFloat(getComputedStyle(p.querySelector('.sun-tr')).fontSize) !== 42) s.push(p.id + ': ad küçültülmüş');
      }
      return s;
    });
    expect(sorunlar, `${w}×${h}`).toEqual([]);
  }
});

test.describe('ayar: Türkçe ↔ Hollandaca', () => {
  const adlar = (page) => page.locator('.box .tr').allTextContents();

  test('varsayılan açık; kapatınca hep Türkçe (hemen döner), saklanır; tekrar açılır', async ({ page }) => {
    await tvAc(page, { zaman: an('10:07:00.500'), dil: 'oto' });            // Hollandaca dönem
    expect(await adlar(page)).toEqual(['Ochtend', 'Middag', 'Namiddag', 'Avond', 'Nacht']);
    await page.locator('#gear').click();
    const anahtar = page.locator('#set-dil');
    await expect(anahtar).toHaveAttribute('aria-checked', 'true');
    await expect(anahtar).toHaveText('Açık');
    await anahtar.click();
    await expect(anahtar).toHaveAttribute('aria-checked', 'false');
    await expect(anahtar).toHaveText('Kapalı');
    expect(await page.evaluate(() => localStorage.getItem('nizam-dil'))).toBe('off');
    await ileri(page, 1000);
    expect(await adlar(page)).toEqual(['Sabah', 'Öğle', 'İkindi', 'Akşam', 'Yatsı']);
    await expect(page.locator('.box .ar').first()).toHaveText('Fajr');
    await page.locator('#set-close').click();
    await saatGit(page, an('10:17:00.500'));                                // yine Hollandaca dönem: kapalı kalır
    expect(await adlar(page)).toEqual(['Sabah', 'Öğle', 'İkindi', 'Akşam', 'Yatsı']);

    await page.locator('#gear').click();
    await anahtar.click();                                                  // tekrar aç
    await ileri(page, 1000);
    expect(await adlar(page)).toEqual(['Ochtend', 'Middag', 'Namiddag', 'Avond', 'Nacht']);
    expect(await page.evaluate(() => localStorage.getItem('nizam-dil'))).toBe('on');
  });

  test('kayıtlı "kapalı" ayar açılışta uygulanır', async ({ page }) => {
    await tvAc(page, { zaman: an('10:07:00.500'), dil: 'oto', depo: { 'nizam-dil': 'off' } });
    expect(await adlar(page)).toEqual(['Sabah', 'Öğle', 'İkindi', 'Akşam', 'Yatsı']);
    await expect(page.locator('#date-miladi')).toHaveText('28 Ekim 2026 Çarşamba');
  });

  test('ayarlar penceresi 1080 ve 540 yüksekliğe sığar', async ({ page }) => {
    for (const [w, h] of [[1920, 1080], [960, 540]]) {
      await page.setViewportSize({ width: w, height: h });
      await tvAc(page, { zaman: an('10:02:00.500') });
      await page.locator('#gear').click();
      const k = await page.locator('.set-card').boundingBox();
      expect(k.y, `${w}×${h} üst`).toBeGreaterThanOrEqual(0);
      expect(k.y + k.height, `${w}×${h} alt`).toBeLessThanOrEqual(h);
    }
  });
});

// ===================== KREM TEMA: uygulamanın tasarımı (kullanıcı isteği, 07-11-2026) =====================
// Solda: logo ve cami adı (küçük), tarih, kemer (sıradaki vakte geri sayım, şimdiki saat, altta İmsak ve Güneş).
// Sağda: en üstten 5 vakit alt alta, altta /admin'den iki küçük kutu. 60 sn sayacı solda, kemerin üstünde.
// Koyu ve açık temalar eskisi gibi (yukarıdaki testler ve referans görüntüler).
test.describe('krem tema: kemer, vakit listesi, /admin kutuları', () => {
  const satir = (page, k) => page.locator(`[data-k2="${k}"]`);
  const satirAdlari = (page) => page.locator('.k2-v [data-ad]').allTextContents();
  const gunesAdlari = (page) => page.locator('.k2-g [data-ad]').allTextContents();
  const icerikAc = (page, zaman, ek = {}) => tvAc(page, { zaman, icerikSaati: new Date(zaman).getTime(), ...ek });
  // içerik isteği gerçek zamanda biter; ekran saniyede bir çizilir: sahte saati azar azar akıtarak bekle
  const akitarakBekle = (page, fn) => expect(async () => { await ileri(page, 500); await fn(); }).toPass({ timeout: 15000 });

  test('varsayılan: sağda en üstten 5 vakit, sıradaki kırmızı; kemerde geri sayım, saat, İmsak ve Güneş', async ({ page }) => {
    await tvAc(page, { zaman: an('10:05:00.500') });
    expect(await satirAdlari(page)).toEqual(['Sabah', 'Öğle', 'İkindi', 'Akşam', 'Yatsı']);
    await expect(page.locator('.k2-v .k2-vt')).toHaveText(['06:21', '12:29', '14:54', '17:27', '19:02']);
    expect(await gunesAdlari(page)).toEqual(['İmsak', 'Güneş']);
    await expect(page.locator('.k2-g .k2-g-vt')).toHaveText(['05:34', '07:21']);
    await expect(page.locator('.k2-g .k2-g-ar')).toHaveText(['İmsâk', 'Shuruq']);
    await expect(page.locator('.k2-g .k2-g-ikon svg')).toHaveCount(2);         // açık temadaki güneş simgeleri
    for (const k of ['Imsak', 'Sunrise', 'Fajr']) await expect(satir(page, k)).toHaveClass(/\bk2-gecti\b/);
    await expect(page.locator('.k2-v.k2-sira')).toHaveCount(1);
    await expect(satir(page, 'Dhuhr')).toHaveClass(/\bk2-sira\b/);
    await expect(page.locator('.k2-v.k2-simdi')).toHaveCount(0);           // Güneş namaz vakti değil
    await expect(page.locator('#k2-etiket')).toHaveText("ÖĞLE'YE KALAN SÜRE");
    await expect(page.locator('#k2-sayac')).toHaveText('2:23:59');
    await expect(page.locator('.k2-kemer .k2-saat')).toHaveText('10:05');      // şimdiki saat, kemerde
    await ileri(page, 1000);
    await expect(page.locator('#k2-sayac')).toHaveText('2:23:58');
    // kemer: güneş yolda, Öğle halkası sıradaki
    await expect(page.locator('#k2-gok [data-gok="gunes"]')).toHaveCount(1);
    await expect(page.locator('#k2-noktalar [data-key="Dhuhr"]')).toHaveClass('kn-halka');
    await expect(page.locator('#k2-noktalar [data-key="Imsak"]')).toHaveClass('kn-gecti');
    for (const s of ['.k2-kemer', '.k2-sag', '.k2-kartlar']) await expect(page.locator(s)).toBeVisible();
    for (const s of ['.midrow', '.grid', '.rule']) await expect(page.locator(s)).toBeHidden();
    // düzen: liste en üstten başlar; cami adı ve dişli sol sütunda kalır; Yatsı ile kutular arasında boşluk
    const sag = await page.locator('.k2-sag').boundingBox();
    expect(sag.y).toBeCloseTo(38, 0);
    const ad = await page.locator('.brand .name').boundingBox();
    const disli = await page.locator('#gear').boundingBox();
    expect(ad.x + ad.width).toBeLessThan(sag.x);
    expect(disli.x + disli.width).toBeLessThan(sag.x);
    const yatsi = await satir(page, 'Isha').boundingBox();
    const kutular = await page.locator('.k2-kartlar').boundingBox();
    expect(kutular.y - (yatsi.y + yatsi.height)).toBeGreaterThanOrEqual(24);
    expect(kutular.height).toBeLessThanOrEqual(150);
    // eski elemanlar arka planda yine güncel (diğer temaya geçince hazır)
    await expect(page.locator('#cd-timer')).toHaveText('02:23:58');
  });

  for (const tema of ['dark', 'light']) {
    test(`${tema}: krem elemanları görünmez, /api/icerik istenmez`, async ({ page }) => {
      const k = await tvAc(page, { zaman: an('10:05:00.500'), adres: `/?theme=${tema}` });
      for (const s of ['.k2-kemer', '.k2-sag']) await expect(page.locator(s)).toBeHidden();
      await expect(page.locator('.grid')).toBeVisible();
      await expect(page.locator('.rule')).toBeVisible();
      await ileri(page, 30 * 1000);
      expect(k.api.filter((u) => u.pathname === '/api/icerik')).toEqual([]);
    });
  }

  test("İmsak'tan önce kemerin altındaki İmsak sıradaki (kırmızı)", async ({ page }) => {
    await tvAc(page, { zaman: an('05:00:00.500') });
    await expect(satir(page, 'Imsak')).toHaveClass(/\bk2-sira\b/);
    await expect(page.locator('.k2-v.k2-sira')).toHaveCount(0);
    await expect(page.locator('#k2-etiket')).toHaveText("İMSAK'A KALAN SÜRE");
    await expect(page.locator('#k2-sayac')).toHaveText('0:33:59');
  });

  test("Akşam'dan sonra ay; Yatsı'dan sonra yarının İmsak'ına; 10 saatten uzun sayaç küçülür", async ({ page }) => {
    await tvAc(page, { zaman: an('18:10:00.500') });
    await expect(satir(page, 'Maghrib')).toHaveClass(/\bk2-simdi\b/);
    await expect(satir(page, 'Maghrib').locator('.k2-simdi-yazi')).toHaveText('ŞİMDİ');
    await expect(satir(page, 'Isha')).toHaveClass(/\bk2-sira\b/);
    await expect(page.locator('#k2-gok [data-gok="ay"]')).toHaveCount(1);

    await saatGit(page, an('19:20:00.500'));
    await expect(satir(page, 'Isha')).toHaveClass(/\bk2-simdi\b/);
    await expect(page.locator('.k2-sira')).toHaveCount(0);                 // bugünün vakitleri; hepsi geçti
    await expect(page.locator('#k2-etiket')).toHaveText("İMSAK'A KALAN SÜRE");
    await expect(page.locator('#k2-sayac')).toHaveText('10:14:59');          // → 29-10 05:35
    await expect(page.locator('#k2-sayac')).toHaveClass(/k2-uzun/);
    await expect(page.locator('#k2-noktalar [data-key]')).toHaveCount(2);    // gece: Yatsı → İmsak

    await saatGit(page, an('21:05:00.500'));
    await expect(page.locator('#k2-sayac')).toHaveText('8:29:59');
    await expect(page.locator('#k2-sayac')).not.toHaveClass(/k2-uzun/);
    await expect(page.locator('.k2-kemer .k2-saat')).toHaveText('21:05');
  });

  test('60 sn kala sayaç solda kemerin üstünde (telefon simgesi yok), vakitler yerinde; vakitte EZAN VAKTİ', async ({ page }) => {
    await tvAc(page, { zaman: an('12:28:30.500') });
    await expect(swap(page)).toHaveClass(/show-prepare/);
    await ileri(page, 1000);
    // kayma geçişi gerçek zamanda (0,7 sn): yerine oturmasını bekle
    await expect.poll(async () => Math.round((await page.locator('.prep-card').boundingBox()).x)).toBe(54);
    const kart = await page.locator('.prep-card').boundingBox();
    const kemer = await page.locator('.k2-kemer').boundingBox();
    const sag = await page.locator('.k2-sag').boundingBox();
    expect(kart.x + kart.width).toBeLessThanOrEqual(sag.x);                // solda
    expect(kart.x).toBeLessThanOrEqual(kemer.x);                           // kemerin üstünü örter
    expect(kart.x + kart.width).toBeGreaterThanOrEqual(kemer.x + kemer.width);
    expect(sag.x).toBeCloseTo(800, 0);                                     // vakitler kaymadı
    await expect(page.locator('.k2-sag')).toBeVisible();
    await expect(page.locator('.prep-phone')).toBeHidden();
    await expect(page.locator('#prep-name')).toHaveText('ÖĞLE NAMAZINA');

    await saatGit(page, an('12:29:10.500'));                               // vakit girdi
    await expect(page.locator('.prep-card')).toHaveClass(/\bezan\b/);
    await expect(page.locator('#k2-etiket')).toHaveText('ÖĞLE');
    await expect(page.locator('#k2-ezan')).toHaveText('EZAN VAKTİ');
    await expect(page.locator('#k2-sayac')).toBeHidden();
    await expect(satir(page, 'Dhuhr')).toHaveClass(/\bk2-yanar\b/);
    await expect(page.locator('.k2-v.k2-sira')).toHaveCount(0);
    await saatGit(page, an('12:30:10.500'));
    await expect(swap(page)).not.toHaveClass(/show-prepare/);
    await expect(page.locator('#k2-ezan')).toBeHidden();
    await expect(page.locator('#k2-etiket')).toHaveText("İKİNDİ'YE KALAN SÜRE");
    await expect(page.locator('.k2-yanar')).toHaveCount(0);
    await expect(satir(page, 'Asr')).toHaveClass(/\bk2-sira\b/);
  });

  test('İmsak vaktinde kemerde İMSAK VAKTİ, İmsak yanıp söner', async ({ page }) => {
    await tvAc(page, { zaman: an('05:34:10.500') });
    await expect(page.locator('#k2-ezan')).toHaveText('İMSAK VAKTİ');
    await expect(satir(page, 'Imsak')).toHaveClass(/\bk2-yanar\b/);
  });

  test('Hollandaca dönemde liste, kemer ve kutular Hollandaca (Arapça harflerle)', async ({ page }) => {
    await icerikAc(page, an('16:04:58.500'), { dil: 'oto', icerik: tasarimIcerik() });
    expect(await satirAdlari(page)).toEqual(['Sabah', 'Öğle', 'İkindi', 'Akşam', 'Yatsı']);
    await expect(page.locator('#k2-bugun-etiket')).toHaveText('BUGÜN CAMİDE');
    await expect(page.locator('#k2-bugun .k2-p-ad')).toHaveText(['Kur’an kursu', 'Gençlik sohbeti']);
    await ileri(page, 2500);                                               // 16:05: Hollandaca
    expect(await satirAdlari(page)).toEqual(['Ochtend', 'Middag', 'Namiddag', 'Avond', 'Nacht']);
    expect(await gunesAdlari(page)).toEqual(['Imsak', 'Zonsopgang']);
    await expect(satir(page, 'Maghrib').locator('.k2-ar')).toHaveText('المغرب');
    await expect(satir(page, 'Maghrib').locator('.k2-ar')).toHaveAttribute('lang', 'ar');
    await expect(satir(page, 'Sunrise').locator('.k2-g-ar')).toHaveText('الشروق');
    await expect(satir(page, 'Asr').locator('.k2-simdi-yazi')).toHaveText('NU');
    await expect(page.locator('#k2-etiket')).toHaveText('NOG TOT AVOND');
    await expect(page.locator('#k2-bugun-etiket')).toHaveText('VANDAAG IN DE MOSKEE');
    await expect(page.locator('#k2-faaliyet-etiket')).toHaveText('VOLGENDE ACTIVITEIT');
    await expect(page.locator('#k2-bugun .k2-p-ad')).toHaveText(['Koranles', 'Jongerenbijeenkomst']);
    await expect(page.locator('#k2-faaliyet .k2-f-ad')).toHaveText('Familieontbijt');
    await expect(page.locator('#k2-faaliyet .k2-f-meta')).toHaveText('Zaterdag 31 oktober · 10:00 – 12:30');
  });

  test('/admin içeriği: bugünkü programlar (vakte bağlı saat dahil), biten gizlenir; sıradaki faaliyet', async ({ page }) => {
    const k = await icerikAc(page, an('10:00:30.500', '2026-10-26'), { icerik: tasarimIcerik() });   // Pazartesi
    expect(k.api.filter((u) => u.pathname === '/api/icerik').map((u) => u.search)).toEqual(['']);   // parametresiz
    await expect(page.locator('#k2-bugun .k2-p-saat')).toHaveText(['17:00', '19:35']);   // Tefsir: Yatsı (19:05) + 30
    await expect(page.locator('#k2-bugun .k2-p-ad')).toHaveText(['Kur’an kursu', 'Tefsir dersi']);
    await expect(page.locator('#k2-bugun .k2-p-yer')).toHaveText(['Sınıflar · 7–14 yaş', 'Ana salon']);
    await expect(page.locator('#k2-faaliyet .k2-f-ad')).toHaveText('Aile Kahvaltısı');
    await expect(page.locator('#k2-faaliyet .k2-f-meta')).toHaveText('Cumartesi 31 Ekim · 10:00 – 12:30');
    await expect(page.locator('#k2-faaliyet .k2-f-yer')).toHaveText('Konferans salonu');
    // 19:00: kurs bitti (17:00–19:00), tefsir kaldı
    await saatGit(page, an('19:00:30.500', '2026-10-26'));
    await expect(page.locator('#k2-bugun .k2-p-ad')).toHaveText(['Tefsir dersi']);
    // 20:36: tefsir de bitti
    await saatGit(page, an('20:36:00.500', '2026-10-26'));
    await expect(page.locator('#k2-bugun')).toHaveText('Bugün başka program yok.');
  });

  test("içerik yoksa boş yazılar; /admin'de eklenen 5 dk içinde gelir; bağlantı yokken son içerik", async ({ page }) => {
    const ic = tasarimIcerik();
    await icerikAc(page, an('10:00:30.500', '2026-10-26'), { icerik: { guncelleme: null, faaliyetler: [], programlar: [] } });
    await expect(page.locator('#k2-bugun')).toHaveText('Bugün için program yok.');
    await expect(page.locator('#k2-faaliyet')).toHaveText('Henüz yaklaşan faaliyet yok.');
    // /admin'de eklendi (sonra eklenen route önceliklidir)
    await page.route((u) => u.pathname === '/api/icerik', (route) => route.fulfill({
      status: 200, contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ guncelleme: 'x', faaliyetler: ic.faaliyetler.filter((f) => f.yayinda), programlar: ic.programlar }),
    }));
    await ileri(page, 4 * 60 * 1000);
    await expect(page.locator('#k2-faaliyet')).toHaveText('Henüz yaklaşan faaliyet yok.');   // henüz sorulmadı
    await ileri(page, 60 * 1000);
    await akitarakBekle(page, () => expect(page.locator('#k2-faaliyet .k2-f-ad')).toHaveText('Aile Kahvaltısı', { timeout: 200 }));
    await expect(page.locator('#k2-bugun .k2-p-ad')).toHaveText(['Kur’an kursu', 'Tefsir dersi']);
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('nizam-icerik'))).faaliyetler.length).toBe(5);
    // bağlantı koptu, sayfa yeniden açıldı: kayıtlı içerik gösterilir
    await page.route((u) => u.pathname === '/api/icerik', (route) => route.abort());
    await page.reload();
    await expect(page.locator('#loading')).toBeHidden();
    await akitarakBekle(page, () => expect(page.locator('#k2-faaliyet .k2-f-ad')).toHaveText('Aile Kahvaltısı', { timeout: 200 }));
  });

  test('küçük kutularda en fazla 2 program; uzun başlıklar kutudan taşmaz (1920 ve 960)', async ({ page }) => {
    const ic = tasarimIcerik();
    const p0 = ic.programlar[0];
    ic.programlar = [
      { ...p0, id: 'p-a', baslik: { tr: 'Çok uzun bir program adı: Kur’an-ı Kerîm tilâveti ve meali', nl: '', en: '' }, saat: { tip: 'sabit', baslangic: '11:00', bitis: '12:00' } },
      { ...p0, id: 'p-b', saat: { tip: 'sabit', baslangic: '13:00', bitis: '14:00' } },
      { ...p0, id: 'p-c', saat: { tip: 'sabit', baslangic: '15:00', bitis: '16:00' } },
    ];
    ic.faaliyetler[0].baslik = { tr: 'Çok uzun bir faaliyet adı: Bütün cemaat için aile kahvaltısı ve sohbet', nl: '', en: '' };
    for (const [w, h] of [[1920, 1080], [960, 540]]) {
      await page.setViewportSize({ width: w, height: h });
      await icerikAc(page, an('10:00:30.500', '2026-10-26'), { icerik: ic });
      await expect(page.locator('#k2-bugun .k2-p-saat')).toHaveText(['11:00', '13:00']);
      const sorunlar = await page.evaluate(() => {
        const s = [];
        for (const kart of document.querySelectorAll('.k2-kart')) {
          const k = kart.getBoundingClientRect();
          for (const e of kart.querySelectorAll('.k2-p, .k2-f-ad, .k2-f-alt, .k2-kart-etiket')) {
            const r = e.getBoundingClientRect();
            if (r.right > k.right + 0.5 || r.bottom > k.bottom + 0.5) s.push(e.className + ': kutudan taşıyor');
          }
        }
        return s;
      });
      expect(sorunlar, `${w}×${h}`).toEqual([]);
    }
  });

  test('Hollandaca uzun adlar sığar; ad, Arapça ad ve saat üst üste binmez; kemerin yazıları içeride (1920 ve 960)', async ({ page }) => {
    for (const [w, h] of [[1920, 1080], [960, 540]]) {
      await page.setViewportSize({ width: w, height: h });
      await tvAc(page, { zaman: an('13:07:00.500'), dil: 'nl' });               // "Nog tot Namiddag", "Zonsopgang"
      const sorunlar = await page.evaluate(() => {
        const s = [];
        const kutu = (e) => e.getBoundingClientRect();
        for (const li of document.querySelectorAll('.k2-v')) {
          const k = kutu(li), ad = kutu(li.querySelector('.k2-ad')), ar = kutu(li.querySelector('.k2-ar')), vt = kutu(li.querySelector('.k2-vt'));
          if (ad.right > ar.left - 6) s.push(li.dataset.k2 + ': ad Arapçaya değiyor');
          if (ar.right > vt.left - 6) s.push(li.dataset.k2 + ': Arapça saate değiyor');
          if (vt.right > k.right - 4 || vt.bottom > k.bottom || vt.top < k.top) s.push(li.dataset.k2 + ': saat satırdan taşıyor');
        }
        // kemerin içi: iç çizginin (viewBox x 26–274, alt 348) içinde
        const kemer = kutu(document.querySelector('.k2-kemer'));
        const sol = kemer.left + kemer.width * 26 / 300, sag = kemer.left + kemer.width * 274 / 300, alt = kemer.top + kemer.height * 348 / 360;
        for (const e of document.querySelectorAll('#k2-etiket, #k2-sayac, .k2-kemer .k2-saat, .k2-g-ikon, .k2-g-ad, .k2-g-ar, .k2-g-vt')) {
          const r = kutu(e);
          if (r.left < sol || r.right > sag || r.bottom > alt) s.push((e.id || e.className) + ': kemerden taşıyor');
        }
        const [imsak, gunes] = document.querySelectorAll('.k2-g');
        for (const e of imsak.querySelectorAll('*')) if (kutu(e).right > kutu(gunes).left + 1) s.push('İmsak Güneş\'e değiyor');
        const sagAlan = kutu(document.querySelector('.k2-sag'));
        const sahne = kutu(document.getElementById('stage'));
        if (sagAlan.bottom > sahne.bottom + 0.5 || sagAlan.right > sahne.right + 0.5) s.push('sağ alan sahneden taşıyor');
        return s;
      });
      expect(sorunlar, `${w}×${h}`).toEqual([]);
    }
  });

  test('âyet paneli sağdaki alana gelir, kemer görünür kalır', async ({ page }) => {
    await tvAc(page, { zaman: an('10:05:00.500'), adres: '/?test=ayet' });
    await expect(swap(page)).toHaveClass(/show-feature/);
    await ileri(page, 1000);
    const panel = await page.locator('.feat-card').boundingBox();
    const kemer = await page.locator('.k2-kemer').boundingBox();
    expect(panel.x).toBeGreaterThan(kemer.x + kemer.width);
    expect(panel.y).toBeCloseTo(38, 0);
    await expect(page.locator('.k2-kemer')).toBeVisible();
  });
});
