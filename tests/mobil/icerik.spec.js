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
  test('telefon: bugün seçili; gün seçici; vakte bağlı saat', async ({ page }) => {
    await ac(page, { adres: '/mobil/#programlar' });
    await expect(page.locator('.gun-secici button[aria-pressed="true"]')).toHaveText('Çar');
    await expect(page.locator('.gun-baslik')).toContainText('Çarşamba · bugün');
    await expect(page.locator('.gun-baslik')).toContainText('2 program');
    await expect(page.locator('.zc-baslik')).toHaveText(['Kur’an kursu', 'Gençlik sohbeti']);

    await page.getByRole('button', { name: 'Pazartesi 26 Ekim' }).click();
    await expect(page.locator('.zc-baslik')).toHaveText(['Kur’an kursu', 'Tefsir dersi']);
    const tefsir = page.locator('.zaman-cizelgesi li').nth(1);
    await expect(tefsir.locator('.zc-bas')).toHaveText('≈ 19:35');                // 26-10 Yatsı 19:05 + 30
    await expect(tefsir.locator('.zc-bit')).toHaveText('Yatsı sonrası');

    await page.getByRole('button', { name: 'Cuma 30 Ekim' }).click();
    await expect(page.locator('.zc-bas')).toHaveText(['≈ 12:29']);
    await expect(page.locator('.zc-bit')).toHaveText(['Öğle vaktinde']);

    await page.getByRole('button', { name: /Çarşamba 28 Ekim/ }).click();
    await page.locator('#p-grup').selectOption('genclik');                      // telefonda da grup süzgeci
    await expect(page.locator('.zc-baslik')).toHaveText(['Gençlik sohbeti']);
    await expect(page.locator('.gun-baslik')).toContainText('1 program');
    await page.locator('#p-grup').selectOption('tumu');
    await expect(page.locator('.zc-baslik')).toHaveCount(2);
  });

  test('içerik yoksa boş ekran', async ({ page }) => {
    await mobilAc(page, { zaman: ZAMAN, depo: { 'nzm.dil': 'tr' }, adres: '/mobil/#programlar' });
    await expect(page.locator('#p-icerik')).toContainText('Henüz program eklenmedi.');
  });

  test('tablet: haftalık tablo, seçili program kartı, süzme, hafta ileri/geri', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await ac(page, { adres: '/mobil/#programlar' });
    await expect(page.locator('.hafta-aralik')).toHaveText('26 Ekim – 1 Kasım');
    await expect(page.locator('.ht-blok')).toHaveCount(14);                                 // 2+2+2+2+1+3+2
    await expect(page.locator('.ht-gun-ic.bugun')).toContainText('28');
    await expect(page.locator('.ht-vakit-ad')).toHaveText(['Öğle', 'İkindi', 'Akşam', 'Yatsı']);
    await expect(page.locator('.ht-simdi')).toHaveCount(1);
    await expect(page.locator('.secili-kart .sk-baslik')).toHaveText('Kur’an kursu');          // bugünün sıradaki programı
    await page.locator('.ht-blok', { hasText: 'Cuma namazı' }).click();
    await expect(page.locator('.secili-kart .sk-baslik')).toHaveText('Cuma namazı ve hutbe');
    await expect(page.locator('.secili-kart .sk-meta')).toContainText('Öğle vaktinde (≈ 12:29)');

    await page.locator('#p-grup').selectOption('hanimlar');
    await expect(page.locator('.ht-blok', { hasText: 'İlmihal' })).toHaveCSS('opacity', '1');
    await expect(page.locator('.ht-blok', { hasText: 'Hadis dersi' })).toHaveCSS('opacity', '0.22');

    await page.getByRole('button', { name: 'Sonraki hafta' }).click();
    await expect(page.locator('.hafta-aralik')).toHaveText('2 – 8 Kasım');
    await expect(page.locator('.ht-simdi')).toHaveCount(0);
    await page.getByRole('button', { name: 'Bu hafta' }).click();
    await expect(page.locator('.hafta-aralik')).toHaveText('26 Ekim – 1 Kasım');
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

  test('öne çıkan + resim: telefonda resim metnin altında, kesilmeden', async ({ page }) => {
    await mobilAc(page, { zaman: ZAMAN, icerik: resimli(), depo: { 'nzm.dil': 'nl' }, adres: '/mobil/#faaliyetler' });
    const img = page.locator('.one-cikan .oc-resim img');
    await expect(img).toHaveAttribute('src', RESIM);
    await expect.poll(() => img.evaluate((e) => e.complete && e.naturalWidth)).toBe(600);
    const metin = await page.locator('.one-cikan .oc-metin').boundingBox();
    const r = await img.boundingBox();
    expect(r.y).toBeGreaterThan(metin.y + metin.height - 1);                  // altta
    expect(await oran(img)).toBeCloseTo(600 / 850, 2);                        // kesilmedi
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
