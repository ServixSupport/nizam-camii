// Uygulamada faaliyetler ve programlar (Faz B). İçerik /api/icerik'ten (gerçek fonksiyon + sahte depo).
import { test, expect } from '@playwright/test';
import { mobilAc } from '../yardimci/mobil.js';
import { ileri } from '../yardimci/tv.js';
import { tasarimIcerik } from '../fixtures/tasarim-icerik.js';

const ZAMAN = '2026-10-28T16:00:00.500+01:00';     // Çarşamba
const ac = (page, o = {}) => mobilAc(page, { zaman: ZAMAN, icerik: tasarimIcerik(), depo: { 'nzm.dil': 'tr' }, ...o });

test.describe('faaliyetler', () => {
  test('öne çıkan kart, aylara göre liste; taslak görünmez', async ({ page }) => {
    const k = await ac(page, { adres: '/mobil/#faaliyetler' });
    const one = page.locator('.one-cikan');
    await expect(one).toContainText('SIRADAKİ FAALİYET');
    await expect(one.locator('h2')).toHaveText('Aile Kahvaltısı');
    await expect(one).toContainText('10:00 – 12:30 · Konferans salonu');
    await expect(page.locator('.f-oge .f-baslik')).toHaveText(['Gençlik Buluşması', 'Kermes', 'Hanımlar Sohbeti', 'Çocuklar Kur’an Yarışması']);
    await expect(page.locator('.ay-baslik')).toHaveText(['KASIM 2026']);
    await expect(page.locator('#s-faaliyetler')).not.toContainText('Taslak');
    expect(k.api.filter((u) => u.pathname === '/api/icerik').map((u) => u.search)).toEqual(['']);
  });

  test('gruba göre süzme', async ({ page }) => {
    await ac(page, { adres: '/mobil/#faaliyetler' });
    const secim = page.getByRole('combobox', { name: 'Gruba göre süz' });
    await expect(secim.locator('option')).toHaveText(['Tüm gruplar', 'Herkes', 'Erkekler', 'Hanımlar', 'Gençlik', 'Çocuklar']);
    await secim.selectOption('genclik');
    await expect(page.locator('.suz')).toHaveClass(/aktif/);
    await expect(page.locator('.one-cikan')).toHaveCount(0);
    await expect(page.locator('.f-oge .f-baslik')).toHaveText(['Gençlik Buluşması']);
    await page.getByRole('combobox', { name: 'Gruba göre süz' }).selectOption('erkekler');
    await expect(page.locator('.f-oge')).toHaveCount(0);
    await expect(page.locator('#f-icerik')).toContainText('Bu grupta yaklaşan faaliyet yok.');
  });

  test('biten faaliyet listeden düşer', async ({ page }) => {
    await ac(page, { adres: '/mobil/#faaliyetler', zaman: '2026-10-31T12:29:00.500+01:00' });
    await expect(page.locator('.one-cikan h2')).toHaveText('Aile Kahvaltısı');
    await ileri(page, 61000);                                                     // 12:30'da bitti
    await expect(page.locator('.one-cikan')).toHaveCount(0);
    await expect(page.locator('.f-oge').first()).toContainText('Gençlik Buluşması');
  });

  test('detay sayfası, geri dönüş, takvim dosyası', async ({ page }) => {
    await ac(page, { adres: '/mobil/#faaliyetler', depo: { 'nzm.dil': 'nl' } });
    await page.locator('.one-cikan h2 a').click();
    await expect(page).toHaveURL(/#faaliyet\/f-kahvalti$/);
    await expect(page.locator('.d-baslik')).toHaveText('Familieontbijt');
    await expect(page.locator('.d-bilgi')).toContainText('Zaterdag 31 oktober 2026 · 10:00 – 12:30');
    await expect(page.locator('.d-aciklama')).toHaveText('Iedereen is welkom bij het familieontbijt. (Voorbeeldtekst.)');
    await expect(page.getByRole('link', { name: 'Meer informatie' })).toHaveAttribute('href', 'https://example.org/kahvalti');
    await expect(page.locator('.menu-oge[data-sekme="faaliyetler"]')).toHaveAttribute('aria-current', 'page');

    const indir = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Zet in agenda' }).click();
    const d = await indir;
    expect(d.suggestedFilename()).toBe('f-kahvalti.ics');
    const ics = (await (await d.createReadStream()).toArray()).join('');
    expect(ics).toContain('SUMMARY:Familieontbijt');
    expect(ics).toContain('DTSTART:20261031T090000Z');

    await page.getByRole('link', { name: 'Activiteiten' }).first().click();
    await expect(page.locator('#s-faaliyetler')).toBeVisible();
  });

  test('taslak veya olmayan faaliyetin linki: "artık yok"', async ({ page }) => {
    await ac(page, { adres: '/mobil/#faaliyet/f-taslak' });
    await expect(page.locator('#d-icerik')).toContainText('Bu faaliyet artık yok.');
  });

  test('dil: boş dilde Türkçesi gösterilir', async ({ page }) => {
    const ic = tasarimIcerik();
    ic.faaliyetler[1].baslik = { tr: 'Sadece Türkçe başlık', nl: '', en: '' };
    await mobilAc(page, { zaman: ZAMAN, icerik: ic, depo: { 'nzm.dil': 'en' }, adres: '/mobil/#faaliyetler' });
    await expect(page.locator('.f-oge .f-baslik').first()).toHaveText('Sadece Türkçe başlık');
    await expect(page.locator('.one-cikan h2')).toHaveText('Family breakfast');
  });

  test('internet yoksa son kaydedilen içerik gösterilir', async ({ page }) => {
    const ic = (await import('../yardimci/sahte-depo.js')).ornekIcerik();
    await mobilAc(page, {
      zaman: ZAMAN, icerik: 'hata', adres: '/mobil/#faaliyetler',
      depo: { 'nzm.dil': 'tr', 'nzm.icerik': JSON.stringify({ alindi: 0, icerik: { guncelleme: null, faaliyetler: ic.faaliyetler.slice(0, 2), programlar: [] } }) },
    });
    await expect(page.locator('.one-cikan h2')).toHaveText('Aile Kahvaltısı');
  });
});

test.describe('programlar', () => {
  // 19-11-2026: Faaliyetler gibi alt alta liste, gün seçmeden (kullanıcı isteği); telefonda ve tablette aynı
  const SIRA = ['Kur’an kursu', 'Gençlik sohbeti', 'Hadis dersi', 'Cuma namazı ve hutbe', 'Hafta sonu Kur’an kursu', 'İlmihal dersi',
    'Hafızlık hazırlık', 'Tefsir dersi', 'Hanımlar Kur’an dersi'];

  test('bütün programlar alt alta, sıradaki oturuma göre; gün seçici yok', async ({ page }) => {
    await ac(page, { adres: '/mobil/#programlar' });
    await expect(page.locator('.gun-secici')).toHaveCount(0);
    await expect(page.locator('.p-oge .f-baslik')).toHaveText(SIRA);
    const oge = (ad) => page.locator('.p-oge').filter({ has: page.locator('.f-baslik').getByText(ad, { exact: true }) });
    // kemerde sıradaki günün tarihi
    await expect(oge('Kur’an kursu').locator('.tk-gun')).toHaveText('28');
    await expect(oge('Kur’an kursu').locator('.tk-ay')).toHaveText('EKİ');
    await expect(oge('Tefsir dersi').locator('.tk-gun')).toHaveText('2');
    await expect(oge('Tefsir dersi').locator('.tk-ay')).toHaveText('KAS');
    // günler ve saat
    await expect(oge('Kur’an kursu').locator('.f-meta').first()).toHaveText('Pzt – Per · 17:00 – 19:00');
    await expect(oge('Gençlik sohbeti').locator('.f-meta').first()).toHaveText('Çar, Cmt · 19:30 – 21:00');
    await expect(oge('Cuma namazı ve hutbe').locator('.f-meta').first()).toHaveText('Her Cuma · Öğle vaktinde (≈ 12:29)');
    await expect(oge('Tefsir dersi').locator('.f-meta').first()).toHaveText(/^Her Pazartesi · Yatsı sonrası \(≈ \d\d:\d\d\)$/);
    await expect(oge('Hafta sonu Kur’an kursu').locator('.f-meta').first()).toHaveText('Cmt, Paz · 10:00 – 13:00');
    // yer, grup; ekran okuyucu için sıradaki tarih
    await expect(oge('Kur’an kursu').locator('.f-meta').nth(1)).toHaveText('Sınıflar · 7–14 yaş');
    await expect(oge('Kur’an kursu').locator('.grup-etiket')).toHaveText('Çocuklar');
    await expect(oge('Tefsir dersi').locator('.gizli')).toHaveText('Sıradaki: Pazartesi 2 Kasım');
    // link değil (detay sayfası yok)
    await expect(page.locator('.p-oge a')).toHaveCount(0);
  });

  test('bugünkü oturum bitince program sonraki gününe geçer', async ({ page }) => {
    await ac(page, { adres: '/mobil/#programlar', zaman: '2026-10-28T19:01:00.500+01:00' });      // Kur'an kursu 19:00'da bitti
    await expect(page.locator('.p-oge .f-baslik').first()).toHaveText('Gençlik sohbeti');
    await expect(page.locator('.p-oge').first().locator('.tk-gun')).toHaveText('28');
    await expect(page.locator('.p-oge .f-baslik').nth(1)).toHaveText('Kur’an kursu');
    await expect(page.locator('.p-oge').nth(1).locator('.tk-gun')).toHaveText('29');
  });

  test('gruba göre süzme', async ({ page }) => {
    await ac(page, { adres: '/mobil/#programlar' });
    await page.locator('#p-grup').selectOption('erkekler');
    await expect(page.locator('.p-oge .f-baslik')).toHaveText(['Hadis dersi', 'Tefsir dersi']);
    await page.locator('#p-grup').selectOption('tumu');
    await expect(page.locator('.p-oge')).toHaveCount(9);
  });

  test('grupta program yoksa', async ({ page }) => {
    const ic = tasarimIcerik();
    ic.programlar = ic.programlar.filter((p) => p.grup !== 'herkes');
    await mobilAc(page, { zaman: ZAMAN, icerik: ic, depo: { 'nzm.dil': 'tr' }, adres: '/mobil/#programlar' });
    await page.locator('#p-grup').selectOption('herkes');
    await expect(page.locator('#p-icerik')).toContainText('Bu grupta program yok.');
  });

  for (const [dil, beklenen] of [
    ['nl', { Koranles: 'Ma – Do · 17:00 – 19:00', Tafsirles: /^Elke maandag · Na Isha \(≈ \d\d:\d\d\)$/ }],
    ['en', { 'Friday prayer and sermon': 'Every Friday · At Dhuhr (≈ 12:29)', 'Weekend Quran class': 'Sat, Sun · 10:00 – 13:00' }],
  ]) {
    test(`gün adları: ${dil}`, async ({ page }) => {
      await ac(page, { adres: '/mobil/#programlar', depo: { 'nzm.dil': dil } });
      for (const [ad, metin] of Object.entries(beklenen)) {
        const oge = page.locator('.p-oge').filter({ has: page.locator('.f-baslik').getByText(ad, { exact: true }) });
        await expect(oge.locator('.f-meta').first()).toHaveText(metin);
      }
    });
  }

  test('içerik yoksa boş ekran', async ({ page }) => {
    await mobilAc(page, { zaman: ZAMAN, depo: { 'nzm.dil': 'tr' }, adres: '/mobil/#programlar' });
    await expect(page.locator('#p-icerik')).toContainText('Henüz program eklenmedi.');
  });

  test('tablet: aynı liste (haftalık tablo yok)', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await ac(page, { adres: '/mobil/#programlar' });
    await expect(page.locator('.hafta-tablosu')).toHaveCount(0);
    await expect(page.locator('.p-oge .f-baslik')).toHaveText(SIRA);
  });

  test('tablet ana ekran kartları: bugün camide, sıradaki faaliyet', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await ac(page);
    await expect(page.locator('#k-bugun .kb-baslik')).toHaveText(['Kur’an kursu', 'Gençlik sohbeti']);
    await expect(page.locator('#k-bugun .kb-saat')).toHaveText(['17:00', '19:30']);
    await expect(page.locator('#k-faaliyet .kf-baslik')).toHaveText('Aile Kahvaltısı');
    await expect(page.locator('#k-faaliyet')).toHaveAttribute('href', '#faaliyet/f-kahvalti');
  });
});

test.describe('resimli faaliyet', () => {
  const RESIM = 'https://test0store.public.blob.vercel-storage.com/preview/resimler/poster.jpg';
  const resimli = () => { const ic = tasarimIcerik(); ic.faaliyetler[0].resim = RESIM; return ic; };
  const oran = async (loc) => { const k = await loc.boundingBox(); return k.width / k.height; };

  test('öne çıkan + resim: telefonda tarih | ad ve saat | küçük resim sağda, düğmeler altta (19-11-2026)', async ({ page }) => {
    await mobilAc(page, { zaman: ZAMAN, icerik: resimli(), depo: { 'nzm.dil': 'nl' }, adres: '/mobil/#faaliyetler' });
    const img = page.locator('.one-cikan .oc-resim img');
    await expect(img).toHaveAttribute('src', RESIM);
    await expect.poll(() => img.evaluate((e) => e.complete && e.naturalWidth)).toBe(600);
    const metin = await page.locator('.one-cikan .oc-metin').boundingBox();
    const dugme = await page.locator('.one-cikan .oc-dugmeler').boundingBox();
    const r = await img.boundingBox();
    expect(r.x).toBeGreaterThan(metin.x + metin.width - 1);                    // sağda
    expect(r.y).toBeLessThan(metin.y + metin.height);                           // aynı satırda
    expect(r.width).toBeLessThanOrEqual(92.5);                                  // küçük
    expect(dugme.y).toBeGreaterThan(r.y + r.height - 1);                        // düğmeler altta
    expect(await oran(img)).toBeCloseTo(600 / 850, 2);                          // kesilmedi
  });

  test('öne çıkan + resim: tablette tarih | metin | resim yan yana', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await mobilAc(page, { zaman: ZAMAN, icerik: resimli(), depo: { 'nzm.dil': 'nl' }, adres: '/mobil/#faaliyetler' });
    const img = page.locator('.one-cikan .oc-resim img');
    await expect.poll(() => img.evaluate((e) => e.complete && e.naturalWidth)).toBe(600);
    const tarih = await page.locator('.one-cikan .tarih-kemer').boundingBox();
    const metin = await page.locator('.one-cikan .oc-metin').boundingBox();
    const r = await img.boundingBox();
    expect(metin.x).toBeGreaterThan(tarih.x + tarih.width - 1);
    expect(r.x).toBeGreaterThan(metin.x + 100);                                // sağda
    expect(r.y).toBeLessThan(metin.y + metin.height);                          // aynı satırda
    expect(await oran(img)).toBeCloseTo(600 / 850, 2);
  });

  test('detay: dikey afiş bütün görünür (kesilmez, ekrandan taşmaz)', async ({ page }) => {
    for (const [w, hgt] of [[390, 844], [1180, 820]]) {
      await page.setViewportSize({ width: w, height: hgt });
      await mobilAc(page, { zaman: ZAMAN, icerik: resimli(), adres: '/mobil/#faaliyet/f-kahvalti' });
      const img = page.locator('.d-resim');
      await expect.poll(() => img.evaluate((e) => e.complete && e.naturalWidth)).toBe(600);
      expect(await oran(img), `${w}×${hgt}`).toBeCloseTo(600 / 850, 2);
      expect((await img.boundingBox()).height).toBeLessThanOrEqual(hgt * 0.78 + 1);
    }
  });
});
