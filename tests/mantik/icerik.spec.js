// veri/dogrula.js ve mobil/icerik.js — tarayıcısız mantık testleri.
import { test, expect } from '@playwright/test';
import { dogrula, resimler, GRUPLAR } from '../../veri/dogrula.js';
import {
  metinSec, gorunurFaaliyetler, faaliyetBitis, programGunde, programZamani, gununProgramlari, haftaGunleri, icsOlustur, yerelAn,
} from '../../mobil/icerik.js';
import { gunOlaylari, diyanetGunu } from '../../mobil/zaman.js';
import { ornekIcerik, RESIM_KOK } from '../yardimci/sahte-depo.js';
import { VAKIT } from '../yardimci/tv.js';

const izin = { resimIzinli: (u) => u.startsWith(RESIM_KOK) };
const an = (s) => new Date(s).getTime();
const olay = (tarih, ymd) => gunOlaylari(diyanetGunu(VAKIT.days.find((d) => d.date === tarih)), ymd);

test.describe('doğrulama (veri/dogrula.js)', () => {
  test('örnek içerik geçerli; gruplar sabit liste', () => {
    const s = dogrula(ornekIcerik(), izin);
    expect(s.hatalar).toEqual([]);
    expect(s.gecerli).toBe(true);
    expect(GRUPLAR).toEqual(['herkes', 'erkekler', 'hanimlar', 'genclik', 'cocuklar']);
  });

  test('en az bir dilde başlık zorunlu; uzunluk sınırları', () => {
    const ic = ornekIcerik();
    ic.faaliyetler[0].baslik = { tr: '  ', nl: '', en: '' };
    ic.faaliyetler[1].aciklama.tr = 'x'.repeat(2001);
    ic.faaliyetler[1].yer = 'y'.repeat(121);
    ic.programlar[0].hoca = 'h'.repeat(81);
    const yollar = dogrula(ic, izin).hatalar.map((h) => h.yol);
    expect(yollar).toEqual(['faaliyetler[0].baslik', 'faaliyetler[1].aciklama.tr', 'faaliyetler[1].yer', 'programlar[0].hoca']);
  });

  test('link sadece https; resim sadece bu depodan', () => {
    const ic = ornekIcerik();
    ic.faaliyetler[0].link = 'http://ornek.nl';
    ic.faaliyetler[1].link = 'javascript:alert(1)';
    ic.faaliyetler[2].resim = 'https://baska-site.com/a.jpg';
    ic.faaliyetler[3].resim = RESIM_KOK + 'a.jpg';
    expect(dogrula(ic, izin).hatalar.map((h) => h.yol)).toEqual(['faaliyetler[0].link', 'faaliyetler[1].link', 'faaliyetler[2].resim']);
  });

  test('tarih, saat, günler ve vakit alanları', () => {
    const ic = ornekIcerik();
    ic.faaliyetler[0].baslangic = '2026-02-30T10:00';
    ic.faaliyetler[1].bitis = '2026-11-07T18:00';                      // başlangıçtan önce
    ic.programlar[0].gunler = [];
    ic.programlar[1].saat = { tip: 'sabit', baslangic: '19:00', bitis: '17:00' };
    ic.programlar[2].saat = { tip: 'vakit', vakit: 'Sunrise', fark: 0, sure: 60 };
    ic.programlar[3].gecerliBitis = '2026-10-01';                        // başlangıçtan önce
    expect(dogrula(ic, izin).hatalar.map((h) => h.yol)).toEqual([
      'faaliyetler[0].baslangic', 'faaliyetler[1].bitis', 'programlar[0].gunler',
      'programlar[1].saat.bitis', 'programlar[2].saat.vakit', 'programlar[3].gecerliBitis',
    ]);
  });

  test('aynı kimlik iki kez olamaz; bilinmeyen alanlar atılır; kontrol karakterleri temizlenir', () => {
    const ic = ornekIcerik();
    ic.faaliyetler[1].id = 'f-kahvalti';
    ic.faaliyetler[0].gizli = '<script>';
    ic.faaliyetler[0].baslik.tr = ' Aile\u0000 Kahvaltısı ';
    const s = dogrula(ic, izin);
    expect(s.hatalar.map((h) => h.yol)).toEqual(['faaliyetler[1].id']);
    expect(s.icerik.faaliyetler[0]).not.toHaveProperty('gizli');
    expect(s.icerik.faaliyetler[0].baslik.tr).toBe('Aile Kahvaltısı');
  });

  test('tüm gün faaliyetin saati 00:00 olur', () => {
    const ic = ornekIcerik();
    Object.assign(ic.faaliyetler[0], { tumGun: true, baslangic: '2026-10-31T10:00', bitis: '2026-11-01T13:00' });
    const f = dogrula(ic, izin).icerik.faaliyetler[0];
    expect([f.baslangic, f.bitis]).toEqual(['2026-10-31T00:00', '2026-11-01T00:00']);
  });

  test('resim kümesi', () => {
    const ic = ornekIcerik();
    ic.faaliyetler[0].resim = RESIM_KOK + 'a.jpg';
    expect([...resimler(ic)]).toEqual([RESIM_KOK + 'a.jpg']);
  });
});

test.describe('faaliyet görünürlüğü ve dil', () => {
  test('dil sırası: ziyaretçinin dili → tr → dolu olan ilk dil', () => {
    expect(metinSec({ tr: 'A', nl: 'B', en: 'C' }, 'nl')).toBe('B');
    expect(metinSec({ tr: 'A', nl: '', en: 'C' }, 'nl')).toBe('A');
    expect(metinSec({ tr: '', nl: '', en: 'C' }, 'nl')).toBe('C');
    expect(metinSec({ tr: '', nl: 'B', en: '' }, 'en')).toBe('B');
  });

  test('taslaklar ve geçmiş faaliyetler görünmez; bitiş yoksa başlangıç + 6 saat', () => {
    const ic = ornekIcerik();
    const ids = (s) => gorunurFaaliyetler(ic.faaliyetler, an(s)).map((f) => f.id);
    expect(ids('2026-10-28T12:00:00+01:00')).toEqual(['f-kahvalti', 'f-gencler']);
    expect(ids('2026-10-31T12:59:00+01:00')).toEqual(['f-kahvalti', 'f-gencler']);
    expect(ids('2026-10-31T13:00:00+01:00')).toEqual(['f-gencler']);
    expect(ids('2026-11-08T01:29:00+01:00')).toEqual(['f-gencler']);     // 19:30 + 6 saat
    expect(ids('2026-11-08T01:30:00+01:00')).toEqual([]);
  });

  test('tüm gün faaliyet gün sonuna kadar görünür', () => {
    const f = { id: 'f-tumgun', tumGun: true, baslangic: '2026-10-31T00:00', bitis: null, yayinda: true };
    expect(faaliyetBitis(f)).toBe(an('2026-11-01T00:00:00+01:00'));
  });

  test('yaz saati günü (25-10-2026) faaliyet saati', () => {
    expect(yerelAn('2026-10-25T01:30')).toBe(an('2026-10-25T01:30:00+02:00'));
    expect(yerelAn('2026-10-25T10:00')).toBe(an('2026-10-25T10:00:00+01:00'));
  });
});

test.describe('program saatleri', () => {
  const ic = ornekIcerik();
  const p = (id) => ic.programlar.find((x) => x.id === id);

  test('sabit saat', () => {
    expect(programZamani(p('p-kurs'), [])).toEqual({ bas: 17 * 60, bit: 19 * 60, vakteBagli: false });
  });

  test('vakte bağlı: o günün vaktinden + fark (mevsime göre kayar)', () => {
    const z28 = programZamani(p('p-tefsir'), olay('28.10.2026', '2026-10-28'));          // Yatsı 19:02
    expect(z28).toMatchObject({ bas: 19 * 60 + 32, bit: 20 * 60 + 32, vakteBagli: true, vakit: 'Isha', fark: 30 });
    const z23 = programZamani(p('p-tefsir'), olay('23.11.2026', '2026-11-23'));          // Yatsı 18:27
    expect(z23.bas).toBe(18 * 60 + 57);
    const cuma = programZamani(p('p-cuma'), olay('30.10.2026', '2026-10-30'));           // Öğle 12:29, vaktinde
    expect([cuma.bas, cuma.fark]).toEqual([12 * 60 + 29, 0]);
  });

  test('vakit verisi olmayan haftada saat yok (sadece "Yatsı sonrası")', () => {
    expect(programZamani(p('p-tefsir'), [])).toMatchObject({ bas: null, bit: null, vakit: 'Isha', fark: 30 });
  });

  test('geçerlilik tarihleri, aktiflik ve haftanın günü', () => {
    expect(programGunde(p('p-hanim'), '2026-10-31', 6)).toBe(false);                     // 1 Kasım'dan önce
    expect(programGunde(p('p-hanim'), '2026-11-07', 6)).toBe(true);
    expect(programGunde(p('p-pasif'), '2026-10-28', 3)).toBe(false);
    expect(programGunde(p('p-kurs'), '2026-10-30', 5)).toBe(false);
  });

  test('hafta Pazartesi başlar; günün programları saate göre sıralı', () => {
    expect(haftaGunleri('2026-10-28').map((g) => g.ymd)).toEqual(
      ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
    expect(haftaGunleri('2026-11-01')[0].ymd).toBe('2026-10-26');
    const pzt = gununProgramlari(ic.programlar, '2026-10-26', 1, olay('26.10.2026', '2026-10-26'));
    expect(pzt.map((x) => x.p.id)).toEqual(['p-kurs', 'p-tefsir']);
  });
});

test('takvim dosyası (.ics)', () => {
  const f = ornekIcerik().faaliyetler[0];
  const ics = icsOlustur(f, 'nl', an('2026-10-28T12:00:00+01:00'));
  expect(ics).toContain('BEGIN:VEVENT');
  expect(ics).toContain('DTSTART:20261031T090000Z');
  expect(ics).toContain('DTEND:20261031T120000Z');
  expect(ics).toContain('SUMMARY:Familieontbijt');
  expect(ics).toContain('LOCATION:Konferans salonu\\, Ookmeerweg 206\\, Amsterdam');
  expect(ics).toContain('DESCRIPTION:Test açıklaması.');                   // NL boş → TR
  expect(ics.split('\r\n').every((s) => new TextEncoder().encode(s).length <= 75)).toBe(true);
  const tumGun = icsOlustur({ ...f, tumGun: true, baslangic: '2026-10-31T00:00', bitis: null }, 'tr', 0);
  expect(tumGun).toContain('DTSTART;VALUE=DATE:20261031');
  expect(tumGun).toContain('DTEND;VALUE=DATE:20261101');
});
