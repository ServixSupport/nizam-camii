// mobil/zaman.js — saf mantık testleri (tarayıcısız).
import { test, expect } from '@playwright/test';
import {
  amsZaman, amsParcalar, amsGun, gunEkle, diyanetGunu, aladhanGunu, gunOlaylari, hicriYazi,
  geriSayim, anDurumu, gunduzMu, aladhanAdresi,
} from '../../mobil/zaman.js';
import { VAKIT, aladhanCevap } from '../yardimci/tv.js';

const iso = (ms) => new Date(ms).toISOString().slice(0, 16) + 'Z';
const gun = (tarih) => diyanetGunu(VAKIT.days.find((d) => d.date === tarih));
const saatler = (olaylar) => Object.fromEntries(olaylar.map((e) => [e.key, e.saat]));
const an = (s) => new Date(s).getTime();

test.describe('Amsterdam saati', () => {
  test('kış ve yaz saatinde duvar saati → an', () => {
    expect(iso(amsZaman(2026, 10, 28, 12, 29))).toBe('2026-10-28T11:29Z');   // CET +1
    expect(iso(amsZaman(2026, 10, 24, 13, 30))).toBe('2026-10-24T11:30Z');   // CEST +2
    expect(iso(amsZaman(2026, 10, 28, 0, 6 * 60 + 21))).toBe('2026-10-28T05:21Z');   // dakika taşması
  });

  test('yaz saati bitişi 25-10-2026 (03:00 → 02:00)', () => {
    expect(iso(amsZaman(2026, 10, 25, 1, 30))).toBe('2026-10-24T23:30Z');   // hâlâ CEST
    expect(iso(amsZaman(2026, 10, 25, 5, 29))).toBe('2026-10-25T04:29Z');   // artık CET
    expect(amsGun(Date.UTC(2026, 9, 24, 22, 30))).toBe('2026-10-25');       // 00:30 CEST
    expect(amsParcalar(Date.UTC(2026, 9, 25, 1, 30)).h).toBe(2);            // 02:30 CET (ikinci kez)
  });

  test('yaz saati başlangıcı 28-03-2027 (02:00 → 03:00)', () => {
    expect(iso(amsZaman(2027, 3, 28, 1, 30))).toBe('2027-03-28T00:30Z');    // CET
    expect(iso(amsZaman(2027, 3, 28, 4, 0))).toBe('2027-03-28T02:00Z');     // CEST
    expect(amsParcalar(Date.UTC(2027, 2, 28, 1, 0)).h).toBe(3);             // 01:00Z = 03:00 CEST
  });

  test('takvim günü ve haftanın günü', () => {
    expect(amsGun(Date.UTC(2026, 9, 28, 23, 30))).toBe('2026-10-29');       // 00:30 Amsterdam
    expect(amsParcalar(Date.UTC(2026, 9, 28, 12)).hg).toBe(3);              // Çarşamba
    expect(gunEkle('2026-10-31', 1)).toBe('2026-11-01');
    expect(gunEkle('2027-01-01', -1)).toBe('2026-12-31');
  });
});

test.describe('vakit kuralları (TV ile aynı)', () => {
  test('Diyanet: düzeltme yok, Sabah = Güneş − 60', () => {
    expect(saatler(gunOlaylari(gun('28.10.2026'), '2026-10-28'))).toEqual({
      Imsak: '05:34', Fajr: '06:21', Sunrise: '07:21', Dhuhr: '12:29', Asr: '14:54', Maghrib: '17:27', Isha: '19:02',
    });
  });

  test('yaz saati günü (25-10-2026) vakitleri doğru ana düşer', () => {
    const o = gunOlaylari(gun('25.10.2026'), '2026-10-25');
    expect(iso(o.find((e) => e.key === 'Imsak').ms)).toBe('2026-10-25T04:29Z');
    expect(iso(o.find((e) => e.key === 'Isha').ms)).toBe('2026-10-25T18:07Z');
  });

  test('Aladhan: İmsak +48, Yatsı −41; Sabah = Güneş − 60', () => {
    const g = aladhanGunu(aladhanCevap().data);
    expect(saatler(gunOlaylari(g, '2026-12-01'))).toEqual({
      Imsak: '05:48', Fajr: '07:00', Sunrise: '08:00', Dhuhr: '12:30', Asr: '14:20', Maghrib: '16:40', Isha: '17:49',
    });
    expect(hicriYazi(g.hicri)).toBe('10 Jumada al-Thani 1448');
    expect(aladhanAdresi('2026-12-01'))
      .toBe('https://api.aladhan.com/v1/timings/01-12-2026?latitude=52.36523&longitude=4.79997&method=13');
  });

  test('hicri tarih: Diyanet "hijri" alanı + HICRI_AY', () => {
    expect(hicriYazi(gun('28.10.2026').hicri)).toBe('17 Jumada al-Awwal 1448');
    expect(hicriYazi(gun('23.11.2026').hicri)).toBe('14 Jumada al-Thani 1448');
  });

  test('geri sayım H:MM:SS', () => {
    expect(geriSayim(5219000)).toBe('1:26:59');
    expect(geriSayim(59999)).toBe('0:00:59');
    expect(geriSayim(-5)).toBe('0:00:00');
    expect(geriSayim(10 * 3600e3)).toBe('10:00:00');
  });
});

test.describe('ekran durumu ve kemer', () => {
  const bugun = gunOlaylari(gun('28.10.2026'), '2026-10-28');
  const yarin = gunOlaylari(gun('29.10.2026'), '2026-10-29');
  const dun = gunOlaylari(gun('27.10.2026'), '2026-10-27');

  test('16:00 — İkindi şimdi, Akşam sıradaki, güneş kemerde', () => {
    const d = anDurumu(an('2026-10-28T16:00:00.500+01:00'), bugun, yarin, dun);
    expect(d.siradaki.key).toBe('Maghrib');
    expect(geriSayim(d.kalan)).toBe('1:26:59');
    expect(d.satirlar.map((s) => s.durum)).toEqual(['gecti', 'gecti', 'gecti', 'gecti', 'gecti', 'siradaki', 'gelecek']);
    expect(d.satirlar.filter((s) => s.simdi).map((s) => s.key)).toEqual(['Asr']);
    expect(d.kemer.mod).toBe('gunduz');
    expect(d.kemer.gok).toBe('gunes');
    expect(d.kemer.oran).toBeCloseTo(626.008 / 808, 4);                     // (16:00 − 05:34) / (19:02 − 05:34)
    expect(d.kemer.noktalar[0].oran).toBe(0);
    expect(d.kemer.noktalar[6].oran).toBe(1);
    expect(d.gunduz).toBe(true);
  });

  test('Güneş ile Öğle arası "şimdi" yok (Güneş namaz vakti değil)', () => {
    const d = anDurumu(an('2026-10-28T10:05:00+01:00'), bugun, yarin, dun);
    expect(d.satirlar.some((s) => s.simdi)).toBe(false);
    expect(d.siradaki.key).toBe('Dhuhr');
  });

  test('Akşam ile Yatsı arası ay; tema gece', () => {
    const d = anDurumu(an('2026-10-28T18:20:00+01:00'), bugun, yarin, dun);
    expect(d.kemer.gok).toBe('ay');
    expect(d.siradaki.key).toBe('Isha');
    expect(d.gunduz).toBe(false);
  });

  test('Yatsı sonrası gece kemeri: Yatsı → yarın İmsak', () => {
    const d = anDurumu(an('2026-10-28T21:30:00+01:00'), bugun, yarin, dun);
    expect(d.kemer.mod).toBe('gece');
    expect(d.kemer.oran).toBeCloseTo(148 / 633, 4);                         // 19:02 → 05:35 (633 dk)
    expect(d.kemer.noktalar.map((n) => n.key + ':' + n.durum)).toEqual(['Isha:gecti', 'Imsak:siradaki']);
    expect(d.siradaki).toMatchObject({ key: 'Imsak', saat: '05:35', ymd: '2026-10-29' });
    expect(d.satirlar.every((s) => s.durum === 'gecti')).toBe(true);
    expect(d.satirlar.find((s) => s.simdi).key).toBe('Isha');
  });

  test('gece yarısından sonra: dünün Yatsı\'sı → bugünün İmsak\'ı', () => {
    const b = gunOlaylari(gun('29.10.2026'), '2026-10-29');
    const d = anDurumu(an('2026-10-29T03:00:00+01:00'), b, [], bugun);
    expect(d.kemer.mod).toBe('gece');
    expect(d.kemer.oran).toBeCloseTo((24 * 60 + 180 - 19 * 60 - 2) / (24 * 60 + 5 * 60 + 35 - 19 * 60 - 2), 4);
    expect(d.satirlar.some((s) => s.simdi)).toBe(false);
    expect(d.siradaki.key).toBe('Imsak');
  });

  test('otomatik tema: Güneş − 1 sn ile Akşam − 1 sn arası gündüz', () => {
    expect(gunduzMu(an('2026-10-28T07:20:58.500+01:00'), bugun)).toBe(false);
    expect(gunduzMu(an('2026-10-28T07:20:59.000+01:00'), bugun)).toBe(true);
    expect(gunduzMu(an('2026-10-28T17:26:58.999+01:00'), bugun)).toBe(true);
    expect(gunduzMu(an('2026-10-28T17:26:59.000+01:00'), bugun)).toBe(false);
  });
});
