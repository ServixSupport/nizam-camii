// /admin — Faz B: ekle / değiştir / taslak / kopyala / sil, resim, doğrulama, çakışma, anahtar.
// /api/admin/* gerçek fonksiyonlara gider; sadece Blob deposu sahte (bellekte).
import { test, expect } from '@playwright/test';
import { adminAc } from '../yardimci/admin.js';
import { sahteDepo, ornekIcerik, TEST_ANAHTAR, RESIM_KOK } from '../yardimci/sahte-depo.js';

const ZAMAN = '2026-10-28T16:00:00+01:00';
const kayit = (depo) => depo.durum().kayit.icerik;

test.describe('anahtar (S3)', () => {
  test('linkteki anahtar cihazda saklanır ve adres çubuğundan silinir', async ({ page }) => {
    await adminAc(page, { zaman: ZAMAN, depo: sahteDepo(ornekIcerik()) });
    await expect(page.locator('#yetki')).toHaveText('Bu cihaz yetkili');
    expect(page.url()).not.toContain('anahtar');
    expect(await page.evaluate(() => localStorage.getItem('nzm.admin.anahtar'))).toBe(TEST_ANAHTAR);
    await page.reload();
    await expect(page.locator('#yetki')).toHaveText('Bu cihaz yetkili');           // sonraki girişte hiçbir şey sorulmaz
  });

  test('anahtarsız cihaz görür ama kaydedemez', async ({ page }) => {
    const depo = sahteDepo(ornekIcerik());
    await adminAc(page, { zaman: ZAMAN, depo, anahtar: null });
    await expect(page.locator('#yetki')).toHaveText('Bu cihaz yetkili değil');
    await expect(page.locator('#uyari')).toContainText('yetkili değil');
    await expect(page.locator('.satir').first()).toBeVisible();
    await expect(page.locator('.satir-dugmeler button', { hasText: 'Sil' }).first()).toBeDisabled();
    await page.goto('/admin/#faaliyet/f-kahvalti');
    await expect(page.getByRole('button', { name: 'Kaydet' })).toBeDisabled();
    expect(depo.durum().kayit.etag).toBe('"e1"');
  });

  test('yanlış anahtarla kaydetme sunucuda reddedilir', async ({ page }) => {
    const depo = sahteDepo(ornekIcerik());
    await adminAc(page, { zaman: ZAMAN, depo, anahtar: 'yanlis-anahtar-0123456789abcdef0123456789' });
    await expect(page.locator('#yetki')).toHaveText('Bu cihaz yetkili değil');
    const durum = await page.evaluate(async () => (await fetch('/api/admin/kaydet', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer yanlis-anahtar-0123456789abcdef0123456789' },
      body: JSON.stringify({ icerik: { faaliyetler: [], programlar: [] }, etag: '"e1"' }),
    })).status);
    expect(durum).toBe(401);
    expect(kayit(depo).faaliyetler).toHaveLength(4);
  });
});

test.describe('faaliyetler', () => {
  test('yeni faaliyet ekle (TR + NL başlık)', async ({ page }) => {
    const depo = sahteDepo(ornekIcerik());
    await adminAc(page, { zaman: ZAMAN, depo });
    await page.getByRole('link', { name: '+ Yeni faaliyet' }).click();
    await page.getByLabel('Başlık (TR)').fill('Kermes');
    await page.getByLabel('Açıklama (TR)').fill('Test açıklaması');
    await page.getByRole('tab', { name: /NL/ }).click();
    await page.getByLabel('Başlık (NL)').fill('Bazaar');
    await page.getByLabel('Grup').selectOption('herkes');
    await page.getByLabel('Tarih').fill('2026-11-15');
    await page.getByLabel('Başlangıç saati').fill('11:00');
    await page.getByLabel('Bitiş saati').fill('17:00');
    await page.getByLabel('Yer').fill('Cami avlusu');
    await expect(page.locator('#onizleme')).toContainText('Bazaar');                // önizleme seçili dilde
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await expect(page.locator('#bildirim')).toContainText('Kaydedildi');
    await expect(page).toHaveURL(/#faaliyetler$/);
    const yeni = kayit(depo).faaliyetler.find((f) => f.baslik.tr === 'Kermes');
    expect(yeni).toMatchObject({ grup: 'herkes', baslangic: '2026-11-15T11:00', bitis: '2026-11-15T17:00', yer: 'Cami avlusu', yayinda: true,
      baslik: { tr: 'Kermes', nl: 'Bazaar', en: '' }, aciklama: { tr: 'Test açıklaması', nl: '', en: '' } });
    expect(yeni.id).toMatch(/^f-[a-z0-9]{6}$/);
    await expect(page.locator('.satir', { hasText: 'Kermes' })).toBeVisible();
  });

  test('değiştir ve taslağa çevir', async ({ page }) => {
    const depo = sahteDepo(ornekIcerik());
    await adminAc(page, { zaman: ZAMAN, depo });
    await page.locator('.satir', { hasText: 'Aile Kahvaltısı' }).getByRole('link', { name: /düzenle/ }).click();
    await page.getByLabel('Başlık (TR)').fill('Aile Kahvaltısı (yeni saat)');
    await page.getByLabel('Başlangıç saati').fill('09:30');
    await page.getByLabel(/^Yayında/).uncheck();
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await expect(page.locator('#bildirim')).toContainText('Kaydedildi');
    const f = kayit(depo).faaliyetler.find((x) => x.id === 'f-kahvalti');
    expect(f).toMatchObject({ baslangic: '2026-10-31T09:30', yayinda: false });
    expect(f.baslik.tr).toBe('Aile Kahvaltısı (yeni saat)');
    await expect(page.locator('.satir[data-id="f-kahvalti"] .rozet')).toHaveText('Taslak');
  });

  test('tüm gün', async ({ page }) => {
    const depo = sahteDepo(ornekIcerik());
    await adminAc(page, { zaman: ZAMAN, depo });
    await page.goto('/admin/#faaliyet/f-gencler');
    await page.getByLabel('Tüm gün').check();
    await expect(page.getByLabel('Başlangıç saati')).toHaveCount(0);
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await expect(page.locator('#bildirim')).toContainText('Kaydedildi');
    expect(kayit(depo).faaliyetler.find((x) => x.id === 'f-gencler')).toMatchObject({ tumGun: true, baslangic: '2026-11-07T00:00', bitis: null });
  });

  test('kopyala: yeni kimlik, taslak olarak açılır', async ({ page }) => {
    const depo = sahteDepo(ornekIcerik());
    await adminAc(page, { zaman: ZAMAN, depo });
    await page.locator('.satir', { hasText: 'Gençlik Buluşması' }).getByRole('link', { name: /kopyala/ }).click();
    await expect(page.locator('#s-form h1')).toHaveText('Yeni faaliyet');
    await expect(page.getByLabel('Başlık (TR)')).toHaveValue('Gençlik Buluşması');
    await page.getByLabel('Tarih').fill('2026-11-14');
    await page.getByLabel(/^Yayında/).check();
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await expect(page.locator('#bildirim')).toContainText('Kaydedildi');
    const gencler = kayit(depo).faaliyetler.filter((f) => f.baslik.tr === 'Gençlik Buluşması');
    expect(gencler.map((f) => f.baslangic).sort()).toEqual(['2026-11-07T19:30', '2026-11-14T19:30']);
    expect(new Set(gencler.map((f) => f.id)).size).toBe(2);
  });

  test('sil: sayfa içinde onay (confirm() yok)', async ({ page }) => {
    const depo = sahteDepo(ornekIcerik());
    await adminAc(page, { zaman: ZAMAN, depo });
    page.on('dialog', () => { throw new Error('confirm() kullanılmamalı'); });
    const satir = page.locator('.satir[data-id="f-gencler"]');
    await satir.getByRole('button', { name: /sil/ }).click();
    await expect(satir).toContainText('Silinsin mi?');
    await satir.getByRole('button', { name: 'Vazgeç' }).click();
    expect(kayit(depo).faaliyetler).toHaveLength(4);
    await satir.getByRole('button', { name: /sil/ }).click();
    await satir.getByRole('button', { name: 'Evet, sil' }).click();
    await expect(page.locator('#bildirim')).toContainText('Silindi');
    expect(kayit(depo).faaliyetler.map((f) => f.id)).not.toContain('f-gencler');
    await expect(page.locator('.satir[data-id="f-gencler"]')).toHaveCount(0);
  });

  test('geçmiş faaliyetler kapalı bölümde', async ({ page }) => {
    await adminAc(page, { zaman: ZAMAN, depo: sahteDepo(ornekIcerik()) });
    const gecmis = page.locator('details.gecmis');
    await expect(gecmis.locator('summary')).toHaveText('Geçmiş faaliyetler (1)');
    await expect(gecmis.locator('.satir')).toBeHidden();
    await gecmis.locator('summary').click();
    await expect(gecmis.locator('.satir')).toContainText('Geçmiş faaliyet');
  });

  test('doğrulama: başlıksız ve http link kaydedilmez, hata alanın yanında', async ({ page }) => {
    const depo = sahteDepo(ornekIcerik());
    await adminAc(page, { zaman: ZAMAN, depo });
    await page.getByRole('link', { name: '+ Yeni faaliyet' }).click();
    await page.getByLabel('Link').fill('http://ornek.nl');
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await expect(page.locator('.alan.hatali')).toHaveCount(2);
    await expect(page.locator('.hata', { hasText: 'En az bir dilde başlık yazın.' })).toBeVisible();
    await expect(page.locator('.hata', { hasText: 'https://' })).toBeVisible();
    await expect(page.getByLabel('Başlık (TR)')).toBeFocused();
    expect(kayit(depo).faaliyetler).toHaveLength(4);
  });

  test('resim: tarayıcıda JPEG\'e çevrilip yüklenir, kaydedilir; faaliyet silinince resim de silinir', async ({ page }) => {
    const depo = sahteDepo(ornekIcerik());
    await adminAc(page, { zaman: ZAMAN, depo });
    await page.goto('/admin/#faaliyet/f-kahvalti');
    // 3000×2000 PNG: tarayıcı 1600 px'e küçültüp JPEG yapmalı
    const png = await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 3000; c.height = 2000;
      const x = c.getContext('2d'); x.fillStyle = '#14295A'; x.fillRect(0, 0, 3000, 2000); x.fillStyle = '#E8C27A'; x.fillRect(500, 500, 2000, 1000);
      return Array.from(new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/png'))).arrayBuffer()));
    });
    await page.locator('#f-resim').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from(png) });
    await expect(page.locator('#bildirim')).toContainText('Resim yüklendi');
    const [[url, veri]] = [...depo.durum().yuklenen];
    expect(url.startsWith(RESIM_KOK)).toBe(true);
    expect([veri[0], veri[1], veri[2]]).toEqual([0xFF, 0xD8, 0xFF]);                // JPEG
    expect(veri.length).toBeLessThan(430 * 1024);
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await expect(page.locator('#bildirim')).toContainText('Kaydedildi');
    expect(kayit(depo).faaliyetler.find((f) => f.id === 'f-kahvalti').resim).toBe(url);

    const satir = page.locator('.satir[data-id="f-kahvalti"]');
    await satir.getByRole('button', { name: /sil/ }).click();
    await satir.getByRole('button', { name: 'Evet, sil' }).click();
    await expect(page.locator('#bildirim')).toContainText('Silindi');
    expect(depo.durum().silinen).toEqual([url]);
  });

  test('çakışma: başka biri değiştirdiyse uyarı, veri kaybolmaz', async ({ page }) => {
    const depo = sahteDepo(ornekIcerik());
    await adminAc(page, { zaman: ZAMAN, depo });
    await page.goto('/admin/#faaliyet/f-kahvalti');
    depo.disaridanDegistir();
    await page.getByLabel('Başlık (TR)').fill('Benim değişikliğim');
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await expect(page.locator('#uyari')).toContainText('Başka biri');
    await expect(page.locator('#uyari').getByRole('button', { name: 'Sayfayı yenile' })).toBeVisible();
    expect(kayit(depo).faaliyetler.find((f) => f.id === 'f-kahvalti').baslik.tr).toBe('Aile Kahvaltısı');
    await expect(page.getByLabel('Başlık (TR)')).toHaveValue('Benim değişikliğim');   // form kaybolmadı
  });
});

test.describe('programlar', () => {
  test('vakte bağlı program: günler, "Yatsı + 30 dk", sonraki gün yardımı', async ({ page }) => {
    const depo = sahteDepo(ornekIcerik());
    await adminAc(page, { zaman: ZAMAN, depo });
    await page.getByRole('link', { name: 'Programlar' }).click();
    await page.getByRole('link', { name: '+ Yeni program' }).click();
    await page.getByLabel('Başlık (TR)').fill('Siyer dersi');
    await page.getByLabel('Grup').selectOption('erkekler');
    await page.getByRole('button', { name: 'Sal', exact: true }).click();
    await page.getByLabel(/Vakte bağlı/).check();
    await page.getByLabel('Vakit', { exact: true }).selectOption('Isha');
    await page.getByLabel('Vakitten kaç dk sonra').fill('30');
    await page.getByLabel('Süre (dk)').fill('45');
    await expect(page.locator('#sonraki')).toHaveText('Sonraki: 3 Kasım Salı ≈ 19:22');   // 3-11 Yatsı 18:52 + 30
    await page.getByLabel('Yer').fill('Ana salon');
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await expect(page.locator('#bildirim')).toContainText('Kaydedildi');
    const p = kayit(depo).programlar.find((x) => x.baslik.tr === 'Siyer dersi');
    expect(p).toMatchObject({ grup: 'erkekler', gunler: [2], saat: { tip: 'vakit', vakit: 'Isha', fark: 30, sure: 45 }, yer: 'Ana salon', aktif: true });
    await expect(page.locator('.satir', { hasText: 'Siyer dersi' })).toContainText('Sal · Yatsı +30 dk (45 dk)');
  });

  test('gün seçilmezse kaydedilmez; haftalık tablodan düzenle; pasif yap', async ({ page }) => {
    const depo = sahteDepo(ornekIcerik());
    await adminAc(page, { zaman: ZAMAN, depo, adres: '#programlar' });
    await page.getByRole('link', { name: '+ Yeni program' }).click();
    await page.getByLabel('Başlık (TR)').fill('Günsüz');
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await expect(page.locator('.hata', { hasText: 'En az bir gün seçin.' })).toBeVisible();
    await page.getByRole('link', { name: '‹ Programlar' }).click();
    await page.locator('.mt-blok', { hasText: 'Kur’an kursu' }).first().click();
    await expect(page.locator('#s-form h1')).toHaveText('Programı düzenle');
    await page.getByLabel(/^Aktif/).uncheck();
    await page.getByRole('button', { name: 'Kaydet' }).click();
    await expect(page.locator('#bildirim')).toContainText('Kaydedildi');
    expect(kayit(depo).programlar.find((x) => x.id === 'p-kurs').aktif).toBe(false);
  });
});
