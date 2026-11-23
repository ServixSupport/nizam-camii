// mobil/yerel-plan.js — mağaza uygulamasının telefona verdiği plan (saf mantık, tarayıcısız).
import { test, expect } from '@playwright/test';
import { yerelPlan, SESSIZ_VARSAYILAN } from '../../mobil/yerel-plan.js';
import { diyanetGunu, gunOlaylari, gunEkle } from '../../mobil/zaman.js';
import { METIN } from '../../mobil/metin.js';
import { VAKIT } from '../yardimci/tv.js';

const an = (s) => new Date(s).getTime();
const gunler = (ilk, n) => Array.from({ length: n }, (_, i) => {
  const ymd = gunEkle(ilk, i);
  const [y, m, d] = ymd.split('-');
  return { ymd, olaylar: gunOlaylari(diyanetGunu(VAKIT.days.find((x) => x.date === `${d}.${m}.${y}`)), ymd) };
});
const KAPALI = { aan: false, once: 15, giris: true, vakitler: [] };
const SIMDI = an('2026-10-28T16:00:00+01:00');
const plan = (o = {}) => yerelPlan({
  gunler: gunler('2026-10-28', 2), bildirim: KAPALI, sessiz: SESSIZ_VARSAYILAN, sayac: true, dil: 'nl', t: METIN.nl, simdi: SIMDI, ...o,
});

test('vakitler: sadece gelecektekiler, sıralı, dile göre başlık', () => {
  const p = plan();
  expect(p.vakitler.every((v) => v.an > SIMDI)).toBe(true);
  expect(p.vakitler.map((v) => v.an)).toEqual([...p.vakitler.map((v) => v.an)].sort((a, b) => a - b));
  expect(p.vakitler[0]).toEqual({ an: an('2026-10-28T17:27:00+01:00'), vakit: 'Maghrib', baslik: 'Maghrib · 17:27' });
  expect(p.vakitler.slice(0, 3).map((v) => v.vakit)).toEqual(['Maghrib', 'Isha', 'Imsak']);
  expect(p.vakitler).toHaveLength(2 + 7);                                   // bugün kalan 2 + yarın 7
  expect(p).toMatchObject({ surum: 1, dil: 'nl', sayac: true, sayacAlt: 'Volgende gebedstijd', bildirimler: [], sessiz: [] });
  expect(yerelPlan({ gunler: gunler('2026-10-28', 1), bildirim: KAPALI, sessiz: SESSIZ_VARSAYILAN, sayac: false, dil: 'tr', t: METIN.tr, simdi: SIMDI })
    .vakitler[0].baslik).toBe('Akşam · 17:27');
});

test('bildirim paneli: günler (7 vakit, kısa ad, hicri), "kalan" yazısı', () => {
  const p = plan({ gunler: gunler('2026-10-28', 2).map((g, i) => ({ ...g, hicri: ['17 Jumada al-Awwal 1448', '18 Jumada al-Awwal 1448'][i] })) });
  expect(p.gunler).toHaveLength(2);
  expect(p.gunler[0].hicri).toBe('17 Jumada al-Awwal 1448');
  expect(p.gunler[0].vakitler.map((v) => v.vakit)).toEqual(['Imsak', 'Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
  expect(p.gunler[0].vakitler[5]).toEqual({ vakit: 'Maghrib', ad: 'Maghrib', saat: '17:27', an: an('2026-10-28T17:27:00+01:00') });
  expect(p.kalanKisa.Dhuhr).toBe('Dhoehr over');
  expect(p.gunler[0].vakitler[2].ad).toBe('Zon');                              // tabloda kısa: "Zonsopgang" değil
  expect(yerelPlan({ gunler: gunler('2026-10-28', 1), bildirim: KAPALI, sessiz: SESSIZ_VARSAYILAN, sayac: true, dil: 'tr', t: METIN.tr, simdi: SIMDI }).kalanKisa.Dhuhr).toBe("Öğle'ye");
});

test('bildirimler: önce ve vakit girince, aynı vaktin etiketi aynı; geçmiştekiler yok', () => {
  const p = plan({ bildirim: { aan: true, once: 15, giris: true, vakitler: ['Asr', 'Maghrib'] } });
  const aksam = p.bildirimler.filter((b) => b.etiket === '2026-10-28-Maghrib');
  expect(aksam).toEqual([
    { an: an('2026-10-28T17:12:00+01:00'), etiket: '2026-10-28-Maghrib', baslik: 'Nog 15 minuten tot Maghrib', govde: 'Maghrib begint om 17:27.' },
    { an: an('2026-10-28T17:27:00+01:00'), etiket: '2026-10-28-Maghrib', baslik: 'Maghrib is begonnen · 17:27', govde: '' },
  ]);
  expect(p.bildirimler.some((b) => b.etiket === '2026-10-28-Asr')).toBe(false);          // bugünkü İkindi geçti
  expect(p.bildirimler.filter((b) => b.etiket === '2026-10-29-Asr')).toHaveLength(2);
  expect(p.bildirimler.every((b) => b.an > SIMDI)).toBe(true);
  const sadeceGiris = plan({ bildirim: { aan: true, once: 0, giris: true, vakitler: ['Maghrib'] } }).bildirimler;
  expect(sadeceGiris.map((b) => b.etiket)).toEqual(['2026-10-28-Maghrib', '2026-10-29-Maghrib']);
  expect(sadeceGiris.every((b) => b.baslik.startsWith('Maghrib is begonnen · '))).toBe(true);
  expect(plan({ bildirim: { aan: false, once: 15, giris: true, vakitler: ['Maghrib'] } }).bildirimler).toEqual([]);
});

test('vakit girince ezan (kullanıcı isteği, 08-11-2026): sadece beş vakit namazın giriş bildiriminde; önceden hatırlatma, İmsak ve Güneş telefonun sesiyle', () => {
  const hepsi = ['Imsak', 'Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  for (const ses of ['ezan-1', 'ezan-7']) {
    const p = plan({ bildirim: { aan: true, once: 15, giris: true, vakitler: hepsi, ses } });
    const giris = p.bildirimler.filter((b) => b.baslik.includes('is begonnen'));
    const ezanli = giris.filter((b) => b.ses === ses).map((b) => b.etiket.slice(11));
    expect([...new Set(ezanli)].sort()).toEqual(['Asr', 'Dhuhr', 'Fajr', 'Isha', 'Maghrib']);
    expect(giris.filter((b) => /-(Imsak|Sunrise)$/.test(b.etiket)).every((b) => !('ses' in b))).toBe(true);
    expect(p.bildirimler.filter((b) => b.baslik.startsWith('Nog ')).every((b) => !('ses' in b))).toBe(true);   // önceden hatırlatma
    expect(p.bildirimler.find((b) => b.etiket === '2026-10-28-Maghrib' && b.ses)).toMatchObject({ an: an('2026-10-28T17:27:00+01:00'), ses });
  }
  // telefonun sesi (varsayılan): hiçbir bildirimde ses alanı yok
  for (const ses of ['telefon', undefined]) {
    expect(plan({ bildirim: { aan: true, once: 15, giris: true, vakitler: hepsi, ses } }).bildirimler.some((b) => 'ses' in b)).toBe(false);
  }
  // Android bildirim kanallarının adları (telefonun ayarlarında görünür)
  expect(plan().kanallar).toEqual({ vakit: 'Gebedstijden', sayac: 'Gebedstijden-widget', tablo: 'Gebedstijden-tabel', sessiz: 'Op stil zetten' });
  // bilinmeyen ses (eski sürümlerin ezan-kisa'sı): telefonun sesi
  expect(plan({ bildirim: { aan: true, once: 0, giris: true, vakitler: ['Maghrib'], ses: 'ezan-kisa' } }).bildirimler.some((b) => 'ses' in b)).toBe(false);
});

test('her namaz için ayrı ses (kullanıcı isteği, 19-11-2026): sesler[vakit]; eski kayıtta tek ses hepsine', () => {
  const sesler = { Fajr: 'ezan-6', Dhuhr: 'telefon', Asr: 'ezan-2', Maghrib: 'ezan-5', Isha: 'telefon' };
  const p = plan({ bildirim: { aan: true, once: 15, giris: true, vakitler: ['Imsak', 'Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'], sesler } });
  const ses = (etiket) => p.bildirimler.find((b) => b.etiket === etiket && b.baslik.includes('is begonnen')).ses;
  expect(ses('2026-10-28-Maghrib')).toBe('ezan-5');
  expect(ses('2026-10-29-Fajr')).toBe('ezan-6');
  expect(ses('2026-10-29-Asr')).toBe('ezan-2');
  expect(ses('2026-10-29-Dhuhr')).toBeUndefined();                           // telefonun sesi
  expect(ses('2026-10-28-Isha')).toBeUndefined();
  expect(ses('2026-10-29-Imsak')).toBeUndefined();                           // İmsak hep telefonun sesiyle
  // sessize alma: ezan okunan namazda ezan bitince, okunmayanda vakit girince başlar
  const sessiz = { aan: true, dakikalar: { Fajr: 30, Dhuhr: 30, Asr: 30, Maghrib: 30, Isha: 30 }, vakitler: ['Maghrib', 'Isha'], mod: 'sessiz' };
  const s = plan({ sessiz, bildirim: { aan: true, once: 0, giris: true, vakitler: ['Maghrib', 'Isha'], sesler } }).sessiz;
  const aksam = an('2026-10-28T17:27:00+01:00');
  expect(s[0].bas).toBe(aksam + 35000);
  const yatsi = p.vakitler.find((v) => v.vakit === 'Isha').an;
  expect(s.find((x) => x.bit === yatsi + 30 * 60000).bas).toBe(yatsi);
});

test('her namaz için ayrı sessiz kalma süresi (kullanıcı isteği, 19-11-2026): dakikalar[vakit]; eski kayıtta tek süre', () => {
  const sessiz = { aan: true, dakikalar: { Fajr: 20, Dhuhr: 15, Asr: 30, Maghrib: 45, Isha: 60 }, vakitler: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'], mod: 'titresim' };
  const p = plan({ sessiz });
  const sure = (vakit, gun = 0) => {
    const v = p.vakitler.filter((x) => x.vakit === vakit)[gun].an;
    return (p.sessiz.find((x) => x.bas === v).bit - v) / 60000;
  };
  expect(sure('Maghrib')).toBe(45);
  expect(sure('Isha')).toBe(60);
  expect(sure('Fajr')).toBe(20);
  expect(sure('Dhuhr')).toBe(15);
  expect(sure('Asr')).toBe(30);
  // eski kayıt: tek "dakika" hepsine
  const eski = plan({ sessiz: { aan: true, dakika: 20, vakitler: ['Maghrib'], mod: 'sessiz' } }).sessiz;
  expect(eski.every((x) => x.bit - x.bas === 20 * 60000)).toBe(true);
  expect(SESSIZ_VARSAYILAN.dakikalar).toEqual({ Fajr: 30, Dhuhr: 30, Asr: 30, Maghrib: 30, Isha: 30 });
});

test('vakitten önce: her vakit ayrı dakika (onceDk, 19-11-2026); olmayan vakitte tek "once"', () => {
  const p = plan({ bildirim: { aan: true, once: 15, onceDk: { Maghrib: 30, Isha: 5 }, giris: false, vakitler: [], onceVakitler: ['Maghrib', 'Isha', 'Fajr'] } });
  const once = (etiket) => p.bildirimler.find((b) => b.etiket === etiket);
  expect(once('2026-10-28-Maghrib')).toMatchObject({ an: an('2026-10-28T16:57:00+01:00'), baslik: 'Nog 30 minuten tot Maghrib' });
  expect(once('2026-10-28-Isha').baslik).toBe('Nog 5 minuten tot Isha');
  expect(once('2026-10-29-Fajr').baslik).toMatch(/^Nog 15 minuten tot /);
});

test('vakitten önce ve vakit girince ayrı vakitler (kullanıcı isteği, 08-11-2026)', () => {
  const p = plan({ bildirim: { aan: true, once: 15, giris: true, vakitler: ['Isha'], onceVakitler: ['Maghrib'] } });
  const bugun = p.bildirimler.filter((b) => b.etiket.startsWith('2026-10-28'));
  expect(bugun.map((b) => [b.etiket, b.an])).toEqual([
    ['2026-10-28-Maghrib', an('2026-10-28T17:12:00+01:00')],                  // sadece önceden
    ['2026-10-28-Isha', bugun[1].an],                                         // sadece vakit girince
  ]);
  expect(bugun[1].baslik).toContain('is begonnen');
  // eski kayıt (onceVakitler yok): tek liste
  expect(plan({ bildirim: { aan: true, once: 15, giris: true, vakitler: ['Maghrib'] } }).bildirimler.filter((b) => b.etiket === '2026-10-28-Maghrib')).toHaveLength(2);
});

test('ezan ve sessize alma aynı vakitte: telefon ezan bitince susar (kullanıcı isteği, 08-11-2026), bitiş aynı', () => {
  const sessiz = { aan: true, dakika: 30, vakitler: ['Maghrib', 'Isha'], mod: 'sessiz' };
  const aksam = an('2026-10-28T17:27:00+01:00');
  const ilk = (bildirim) => plan({ sessiz, bildirim }).sessiz[0];
  expect(ilk({ aan: true, once: 0, giris: true, vakitler: ['Maghrib'], ses: 'ezan-3' })).toMatchObject({ bas: aksam + 35000, bit: aksam + 30 * 60000 });
  // ezan yoksa (telefonun sesi, bildirim kapalı, o vakit seçili değil, giriş bildirimi kapalı) vakit girince
  for (const b of [{ aan: true, once: 0, giris: true, vakitler: ['Maghrib'], ses: 'telefon' },
    { aan: false, once: 0, giris: true, vakitler: ['Maghrib'], ses: 'ezan-3' },
    { aan: true, once: 0, giris: true, vakitler: ['Isha'], ses: 'ezan-3' },
    { aan: true, once: 15, giris: false, vakitler: ['Maghrib'], ses: 'ezan-3' }]) expect(ilk(b).bas).toBe(aksam);
});

test('sessize alma: seçilen namazlarda vakit girince, süre kadar; Güneş ve İmsak hiç', () => {
  const sessiz = { aan: true, dakika: 30, vakitler: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'], mod: 'sessiz' };
  const p = plan({ sessiz });
  expect(p.sessizMod).toBe('sessiz');
  expect(p.sessiz[0]).toEqual({
    bas: an('2026-10-28T17:27:00+01:00'), bit: an('2026-10-28T17:57:00+01:00'),
  });
  expect(p.sessiz).toHaveLength(2 + 5);
  expect(p.sessiz.every((s) => s.bit - s.bas === 30 * 60000)).toBe(true);
  // süre içindeyken plan yenilenirse o dönem yine listede (telefon bitişte eski haline döndürür)
  const icinde = plan({ sessiz, simdi: an('2026-10-28T17:40:00+01:00') });
  expect(icinde.sessiz[0].bas).toBe(an('2026-10-28T17:27:00+01:00'));
  // titreşim ve Türkçe
  const tr = yerelPlan({ gunler: gunler('2026-10-28', 1), bildirim: KAPALI, sessiz: { ...sessiz, mod: 'titresim', vakitler: ['Isha'] }, sayac: true, dil: 'tr', t: METIN.tr, simdi: SIMDI });
  expect(tr.sessizMod).toBe('titresim');
  expect(tr.sessiz).toHaveLength(1);
  expect(Object.keys(tr.sessiz[0])).toEqual(['bas', 'bit']);       // sessize alındı diye yazı yok (kullanıcı isteği, 23-11-2026)
  // kapalı: hiç dönem yok
  expect(plan({ sessiz: { ...sessiz, aan: false } }).sessiz).toEqual([]);
});

test('iç içe geçen sessiz dönemler birleşir', () => {
  const ymd = '2026-10-28';
  const olay = (key, saat) => ({ key, ms: an(`${ymd}T${saat}:00+01:00`), saat });
  const p = yerelPlan({
    gunler: [{ ymd, olaylar: [olay('Maghrib', '17:27'), olay('Isha', '18:20')] }],
    bildirim: KAPALI, sessiz: { aan: true, dakika: 60, vakitler: ['Maghrib', 'Isha'], mod: 'sessiz' },
    sayac: false, dil: 'nl', t: METIN.nl, simdi: SIMDI,
  });
  expect(p.sessiz.map((s) => [s.bas, s.bit])).toEqual([[an(`${ymd}T17:27:00+01:00`), an(`${ymd}T19:20:00+01:00`)]]);
});
