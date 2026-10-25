// api/vakit.js asıl mod (hafızalı, 25-10-2026): Diyanet sınırına takılmamak için son iyi liste Blob'da.
// Diyanet ve Blob sahte; gerçek Diyanet'e hiç istek gitmez.
import { test, expect } from '@playwright/test';
import { vakitAnaMod, TAZE_MS, DENEME_MS } from '../../api/vakit.js';
import { VAKIT } from '../yardimci/tv.js';

const SAAT = 3600e3;
const T0 = new Date('2026-10-25T15:30:00+01:00').getTime();
const AYLIK = VAKIT.days.slice(2);                                   // 25.10 → 23.11 (30 gün)
const GUNLUK = [VAKIT.days[2]];                                      // sadece 25.10
const bugun = (ms) => {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms))) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
};

function kur({ kayit = null, aylik = 'tamam', gunluk = 'tamam', uretim = true } = {}) {
  const s = { kayit: kayit && structuredClone(kayit), yazma: 0, aylikCagri: 0, gunlukCagri: 0, saat: T0, aylik, gunluk };
  const depo = { oku: async () => s.kayit && structuredClone(s.kayit), yaz: async (k) => { s.kayit = structuredClone(k); s.yazma++; } };
  const diyanet = {
    aylik: async (id) => { s.aylikCagri++; if (s.aylik !== 'tamam') throw new Error('/api/PrayerTime/Monthly/' + id + ' -> HTTP 429'); return { path: '/api/PrayerTime/Monthly/' + id, days: AYLIK }; },
    gunluk: async (id) => { s.gunlukCagri++; if (s.gunluk !== 'tamam') throw new Error('HTTP 429'); return { path: '/api/PrayerTime/Daily/' + id, days: GUNLUK }; },
  };
  const mod = vakitAnaMod({ depo, diyanet, saat: () => s.saat, uretim, canliAdres: 'https://canli.test/api/vakit', bugun });
  return { s, iste: () => mod('13976') };
}

test('kayıt yoksa aylık liste alınır ve saklanır; cevap biçimi eskisiyle aynı', async () => {
  const { s, iste } = kur();
  const r = await iste();
  expect(r.govde).toMatchObject({ available: true, source: 'diyanet', cityId: '13976', path: '/api/PrayerTime/Monthly/13976', count: 30 });
  expect(r.govde.days).toEqual(AYLIK);
  expect(r.saniye).toBe(6 * 3600);
  expect(s.kayit.aylik.path).toBe('/api/PrayerTime/Monthly/{id}');            // kayıtta şehir kimliği yok
  expect(JSON.stringify(s.kayit)).not.toContain('13976');
});

test('taze kayıt varken (deploy sonrası bile) Diyanet\'e hiç gidilmez', async () => {
  const { s, iste } = kur({ kayit: { aylik: { alindi: T0 - 2 * SAAT, path: '/api/PrayerTime/Monthly/{id}', days: AYLIK } } });
  for (let i = 0; i < 10; i++) await iste();                                   // 10 deploy / cache temizliği
  expect(s.aylikCagri).toBe(0);
  expect(s.yazma).toBe(0);
});

test('kayıt 20 saatten eskiyse yenilenir', async () => {
  const { s, iste } = kur({ kayit: { aylik: { alindi: T0 - TAZE_MS - 1, path: 'x', days: AYLIK } } });
  await iste();
  expect(s.aylikCagri).toBe(1);
  expect(s.kayit.aylik.alindi).toBe(T0);
});

test('BUGÜNKÜ DURUM: aylık yol sınıra takıldı → 1 günlük liste DEĞİL, kayıtlı 30 günlük liste verilir', async () => {
  const { s, iste } = kur({ aylik: '429', kayit: { aylik: { alindi: T0 - 30 * SAAT, path: '/api/PrayerTime/Monthly/{id}', days: AYLIK } } });
  const r = await iste();
  expect(r.govde.count).toBe(30);
  expect(r.saniye).toBe(3600);
  expect(s.aylikCagri).toBe(1);
  expect(s.gunlukCagri).toBe(0);
  // 4 saat boyunca yeniden denenmez
  s.saat += DENEME_MS - 60e3;
  await iste(); await iste();
  expect(s.aylikCagri).toBe(1);
  s.saat += 2 * 60e3;
  s.aylik = 'tamam';
  await iste();
  expect(s.aylikCagri).toBe(2);
  expect(s.kayit.aylik.alindi).toBe(s.saat);
});

test('hiç kayıt yok ve aylık yol kapalı → günlük liste, o gün tekrar Diyanet\'e gidilmez', async () => {
  const { s, iste } = kur({ aylik: '429' });
  const r1 = await iste();
  expect(r1.govde.count).toBe(1);
  expect(r1.saniye).toBe(1800);                                              // 24 saat değil: kısa cache
  s.saat += 30 * 60e3;
  const r2 = await iste();
  expect(r2.govde.count).toBe(1);
  expect([s.aylikCagri, s.gunlukCagri]).toEqual([1, 1]);
});

test('Diyanet tamamen kapalı ve kayıt yok → available:false, kısa cache (TV kendi kaydını kullanır)', async () => {
  const { iste } = kur({ aylik: '429', gunluk: '429' });
  const r = await iste();
  expect(r.govde.available).toBe(false);
  expect(r.saniye).toBe(600);
});

test('önizleme Diyanet\'e asla gitmez: kayıt varsa onu verir', async () => {
  const { s, iste } = kur({ uretim: false, kayit: { aylik: { alindi: T0 - 50 * SAAT, path: 'x', days: AYLIK } } });
  const r = await iste();
  expect(r.govde.count).toBe(30);
  expect([s.aylikCagri, s.gunlukCagri, s.yazma]).toEqual([0, 0, 0]);
});

test('Blob çalışmazsa (okuma boş) eskisi gibi doğrudan Diyanet', async () => {
  const { s, iste } = kur();
  s.kayit = null;
  const r = await iste();
  expect(r.govde.count).toBe(30);
  expect(s.aylikCagri).toBe(1);
});
