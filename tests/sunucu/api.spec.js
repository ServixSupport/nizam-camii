// /api/icerik ve /api/admin/* fonksiyonları — sahte Blob deposuyla (gerçek Blob'a dokunulmaz).
import { test, expect } from '@playwright/test';
import { icerikIsleyici } from '../../api/icerik.js';
import { veriIsleyici } from '../../api/admin/veri.js';
import { kaydetIsleyici } from '../../api/admin/kaydet.js';
import { resimIsleyici } from '../../api/admin/resim.js';
import { sahteDepo, cagir, yetki, ornekIcerik, TEST_ANAHTAR, RESIM_KOK } from '../yardimci/sahte-depo.js';

const SIMDI = () => new Date('2026-10-28T12:00:00+01:00').getTime();
const JPEG = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 4]).toString('base64');

test.beforeEach(() => { process.env.ADMIN_ANAHTAR = TEST_ANAHTAR; });
test.afterEach(() => { delete process.env.ADMIN_ANAHTAR; });

test.describe('/api/icerik (uygulama)', () => {
  test('sadece yayındaki ve bitmemiş faaliyetler, aktif programlar; CDN cache 2 dk', async () => {
    const r = await cagir(icerikIsleyici(sahteDepo(ornekIcerik()), SIMDI));
    expect(r.durum).toBe(200);
    expect(r.govde.faaliyetler.map((f) => f.id)).toEqual(['f-kahvalti', 'f-gencler']);
    expect(r.govde.programlar.map((p) => p.id)).toEqual(['p-tefsir', 'p-kurs', 'p-cuma', 'p-hanim']);
    expect(r.basliklar['cache-control']).toBe('public, max-age=0, s-maxage=120, stale-while-revalidate=86400');
  });

  test('henüz içerik yoksa boş liste', async () => {
    const r = await cagir(icerikIsleyici(sahteDepo(null), SIMDI));
    expect(r.govde).toEqual({ guncelleme: null, faaliyetler: [], programlar: [] });
  });

  test('depo hata verirse 503 ve cache yok', async () => {
    const depo = { ...sahteDepo(), oku: async () => { throw new Error('blob kapalı'); } };
    const r = await cagir(icerikIsleyici(depo, SIMDI));
    expect(r.durum).toBe(503);
    expect(r.basliklar['cache-control']).toBe('no-store');
  });
});

test.describe('/api/admin/veri', () => {
  test('taslaklar dahil tam içerik + etag; anahtara göre "yetkili"', async () => {
    const depo = sahteDepo(ornekIcerik());
    const anahtarsiz = await cagir(veriIsleyici(depo));
    expect(anahtarsiz.govde).toMatchObject({ etag: '"e1"', yetkili: false, anahtarTanimli: true });
    expect(anahtarsiz.govde.icerik.faaliyetler).toHaveLength(4);
    expect(anahtarsiz.basliklar['cache-control']).toBe('no-store');
    expect((await cagir(veriIsleyici(depo), { headers: yetki() })).govde.yetkili).toBe(true);
    expect((await cagir(veriIsleyici(depo), { headers: yetki('yanlis-anahtar-0123456789abcdef0123456789') })).govde.yetkili).toBe(false);
  });
});

test.describe('/api/admin/kaydet', () => {
  const kaydet = (depo, body, headers = yetki()) => cagir(kaydetIsleyici(depo, SIMDI), { method: 'POST', headers, body });

  test('anahtarsız veya yanlış anahtarla kaydetme reddedilir', async () => {
    const depo = sahteDepo(ornekIcerik());
    expect((await kaydet(depo, { icerik: ornekIcerik(), etag: '"e1"' }, {})).durum).toBe(401);
    expect((await kaydet(depo, { icerik: ornekIcerik(), etag: '"e1"' }, yetki('x'.repeat(40)))).durum).toBe(401);
    expect((await kaydet(depo, { icerik: ornekIcerik(), etag: '"e1"' }, { authorization: TEST_ANAHTAR })).durum).toBe(401);
    expect(depo.durum().kayit.etag).toBe('"e1"');                         // hiçbir şey yazılmadı
  });

  test('sunucuda anahtar tanımlı değilse (veya kısaysa) kimse kaydedemez', async () => {
    process.env.ADMIN_ANAHTAR = 'kisa';
    const r = await kaydet(sahteDepo(), { icerik: ornekIcerik(), etag: null }, yetki('kisa'));
    expect(r.durum).toBe(503);
  });

  test('ekle / değiştir / taslak / sil', async () => {
    const depo = sahteDepo(null);
    // ilk kayıt (depo boş): ekle
    let r = await kaydet(depo, { icerik: ornekIcerik(), etag: null });
    expect(r.durum).toBe(200);
    expect(r.govde.guncelleme).toBe('2026-10-28T11:00:00.000Z');
    let etag = r.govde.etag;
    // değiştir + taslağa çevir
    const ic = r.govde.icerik;
    ic.faaliyetler[0].baslik.tr = 'Aile Kahvaltısı (güncel)';
    ic.faaliyetler[1].yayinda = false;
    r = await kaydet(depo, { icerik: ic, etag });
    expect(r.durum).toBe(200);
    etag = r.govde.etag;
    expect(depo.durum().kayit.icerik.faaliyetler[0].baslik.tr).toBe('Aile Kahvaltısı (güncel)');
    const uyg = await cagir(icerikIsleyici(depo, SIMDI));
    expect(uyg.govde.faaliyetler.map((f) => f.id)).toEqual(['f-kahvalti']);   // taslak uygulamada yok
    // sil
    ic.faaliyetler = ic.faaliyetler.filter((f) => f.id !== 'f-kahvalti');
    r = await kaydet(depo, { icerik: ic, etag });
    expect(r.durum).toBe(200);
    expect(depo.durum().kayit.icerik.faaliyetler.map((f) => f.id)).toEqual(['f-gencler', 'f-taslak', 'f-gecmis']);
  });

  test('geçersiz içerik 400 ve hata listesi; hiçbir şey yazılmaz', async () => {
    const depo = sahteDepo(ornekIcerik());
    const ic = ornekIcerik();
    ic.faaliyetler[0].baslik = { tr: '', nl: '', en: '' };
    const r = await kaydet(depo, { icerik: ic, etag: '"e1"' });
    expect(r.durum).toBe(400);
    expect(r.govde.hatalar).toEqual([{ yol: 'faaliyetler[0].baslik', mesaj: 'En az bir dilde başlık yazın.' }]);
    expect(depo.durum().kayit.etag).toBe('"e1"');
  });

  test('başka biri değiştirdiyse 409; veri kaybolmaz', async () => {
    const depo = sahteDepo(ornekIcerik());
    depo.disaridanDegistir();
    const r = await kaydet(depo, { icerik: ornekIcerik(), etag: '"e1"' });
    expect(r.durum).toBe(409);
    expect(r.govde.hata).toContain('Başka biri');
  });

  test('faaliyet silinince (ve hiçbir yerde kullanılmıyorsa) resmi de silinir', async () => {
    const depo = sahteDepo(null);
    const yukle = await cagir(resimIsleyici(depo), { method: 'POST', headers: yetki(), body: { veri: JPEG } });
    const url = yukle.govde.url;
    expect(url.startsWith(RESIM_KOK)).toBe(true);
    const ic = ornekIcerik();
    ic.faaliyetler[0].resim = url;
    ic.faaliyetler[1].resim = url;                                          // kopyalanmış faaliyet aynı resmi kullanıyor
    let r = await kaydet(depo, { icerik: ic, etag: null });
    ic.faaliyetler.shift();
    r = await kaydet(depo, { icerik: ic, etag: r.govde.etag });
    expect(depo.durum().silinen).toEqual([]);                               // hâlâ kullanılıyor
    ic.faaliyetler.shift();
    await kaydet(depo, { icerik: ic, etag: r.govde.etag });
    expect(depo.durum().silinen).toEqual([url]);
  });
});

test.describe('/api/admin/resim', () => {
  const yukle = (depo, body, headers = yetki()) => cagir(resimIsleyici(depo), { method: 'POST', headers, body });

  test('anahtarsız yükleme reddedilir; sadece JPEG; boyut sınırı', async () => {
    const depo = sahteDepo();
    expect((await yukle(depo, { veri: JPEG }, {})).durum).toBe(401);
    expect((await yukle(depo, { veri: Buffer.from('<svg/>').toString('base64') })).durum).toBe(415);
    expect((await yukle(depo, { veri: Buffer.alloc(1.6 * 1024 * 1024, 0xFF).toString('base64') })).durum).toBe(413);
    expect((await yukle(depo, {})).durum).toBe(400);
    expect(depo.durum().yuklenen.size).toBe(0);
    expect((await yukle(depo, { veri: JPEG })).durum).toBe(200);
    expect(depo.durum().yuklenen.size).toBe(1);
  });
});
