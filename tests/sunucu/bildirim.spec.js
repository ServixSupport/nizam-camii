// Faz D — bildirimler (sunucu): anlar, metinler, abonelik, planlama (QStash), gönderim (Web Push).
// Gerçek Upstash/QStash/push servisine gidilmez: sahte-bildirim.js.
import crypto from 'node:crypto';
import http from 'node:http';
import { test, expect } from '@playwright/test';
import ece from 'http_ece';
import {
  gunAnlari, saatEki, bildirimMetni, aboneDogrula, istiyorMu, aboneId, pushAdresiGecerli, anGecerli, SINIR_ABONE, VARSAYILAN,
} from '../../api/_lib/bildirim.js';
import {
  redisDepo, qstashKuyruk, vapidAnahtarlari, webPush, bildirimOrtami, planYap, VAPID_KONU,
} from '../../api/_lib/bildirim-servis.js';
import { aboneIsleyici } from '../../api/bildirim/abone.js';
import { planlaIsleyici } from '../../api/bildirim/planla.js';
import { gonderIsleyici } from '../../api/bildirim/gonder.js';
import { anahtarIsleyici } from '../../api/bildirim/anahtar.js';
import { cagir } from '../yardimci/sahte-depo.js';
import { sahteOrtam, testAboneligi, aboneGovdesi, cronYetki, TEST_CRON, TEST_KOK } from '../yardimci/sahte-bildirim.js';
import { vapidSleutels } from '../araclar/vapid.mjs';
import { VAKIT } from '../yardimci/tv.js';

const T = (s) => new Date(s).getTime();
const SIMDI = T('2026-10-28T12:00:00+01:00');
const gun = (tarih) => VAKIT.days.find((d) => d.date === tarih);
const anBul = (ymd, vakit, tur) => gunAnlari(gun(ymd.split('-').reverse().join('.')), ymd).find((a) => a.vakit === vakit && a.tur === tur);

test.describe('anlar ve metinler', () => {
  test('bir gün = 7 vakit × (giriş + 5/10/15/30 dk önce); Sabah = Güneş − 60; Amsterdam saati', () => {
    const anlar = gunAnlari(gun('28.10.2026'), '2026-10-28');
    expect(anlar).toHaveLength(35);
    const giris = Object.fromEntries(anlar.filter((a) => a.tur === 'giris').map((a) => [a.vakit, a.saat]));
    expect(giris).toEqual({ Imsak: '05:34', Fajr: '06:21', Sunrise: '07:21', Dhuhr: '12:29', Asr: '14:54', Maghrib: '17:27', Isha: '19:02' });
    const aksam = anlar.find((a) => a.vakit === 'Maghrib' && a.tur === 'giris');
    expect(aksam.an).toBe(T('2026-10-28T17:27:00+01:00'));
    expect(anlar.find((a) => a.vakit === 'Maghrib' && a.tur === 'once-15').an).toBe(T('2026-10-28T17:12:00+01:00'));
    expect(anlar.find((a) => a.vakit === 'Fajr' && a.tur === 'giris').an).toBe(anlar.find((a) => a.vakit === 'Sunrise' && a.tur === 'giris').an - 3600e3);
    expect(aksam.id).toBe('2026-10-28_Maghrib_giris');
    expect(anGecerli(aksam)).toBe(true);
  });

  test('yaz/kış saati geçişi: anlar o günün Amsterdam saatine göre', () => {
    const yaz = { date: '29.03.2026', imsak: '05:30', gunes: '07:20', ogle: '13:45', ikindi: '17:05', aksam: '20:10', yatsi: '21:40' };
    const a = gunAnlari(yaz, '2026-03-29');
    expect(a.find((x) => x.vakit === 'Imsak' && x.tur === 'giris').an).toBe(T('2026-03-29T05:30:00+02:00'));
    expect(a.find((x) => x.vakit === 'Imsak' && x.tur === 'once-30').an).toBe(T('2026-03-29T05:00:00+02:00'));
    // 25-10-2026: saat 03:00'te 02:00'ye döndü; İmsak 05:29 kış saatiyle (+01:00)
    expect(anBul('2026-10-25', 'Imsak', 'giris').an).toBe(T('2026-10-25T05:29:00+01:00'));
  });

  test('Türkçe saat eki okunuşa göre', () => {
    expect(['18:34', '20:09', '12:00', '13:40', '00:00', '17:27', '06:21', '19:02', '05:30', '14:50', '07:16']
      .map(saatEki)).toEqual(['18:34’te', '20:09’da', '12:00’de', '13:40’ta', '00:00’da', '17:27’de', '06:21’de', '19:02’de', '05:30’da', '14:50’de', '07:16’da']);
  });

  test('metinler tasarımdaki gibi (ontwerp/Mobil-Bildirim.dc.html), üç dilde', () => {
    const aksam = { tarih: '2026-10-28', vakit: 'Maghrib', tur: 'giris', saat: '18:34' };
    expect(bildirimMetni('tr', aksam)).toEqual({ baslik: 'Akşam vakti girdi · 18:34', govde: 'Camiye geliyorsanız telefonunuzu sessize almayı unutmayın.' });
    expect(bildirimMetni('tr', { ...aksam, tur: 'once-15' })).toEqual({ baslik: 'Akşam namazına 15 dakika', govde: 'Akşam vakti 18:34’te giriyor.' });
    expect(bildirimMetni('nl', { vakit: 'Isha', tur: 'once-10', saat: '20:09' })).toEqual({ baslik: 'Nog 10 minuten tot Isha', govde: 'Isha begint om 20:09.' });
    expect(bildirimMetni('en', { ...aksam, tur: 'once-5' })).toEqual({ baslik: '5 minutes until Maghrib', govde: 'Maghrib begins at 18:34.' });
    // İmsak ve Güneş namaz değil: "camiye geliyorsanız" yok
    expect(bildirimMetni('tr', { vakit: 'Imsak', tur: 'giris', saat: '05:29' })).toEqual({ baslik: 'İmsak vakti girdi · 05:29', govde: '' });
    expect(bildirimMetni('nl', { vakit: 'Sunrise', tur: 'giris', saat: '07:16' })).toEqual({ baslik: 'Zonsopgang · 07:16', govde: '' });
    expect(bildirimMetni('tr', { vakit: 'Sunrise', tur: 'once-15', saat: '07:16' }).baslik).toBe('Güneşin doğmasına 15 dakika');
    expect(bildirimMetni('tr', { vakit: 'Imsak', tur: 'once-30', saat: '05:29' }).baslik).toBe('İmsak vaktine 30 dakika');
  });

  test('kim hangi anı ister', () => {
    const ab = { vakitler: ['Maghrib', 'Isha'], once: 15, giris: false };
    const an = (vakit, tur) => ({ vakit, tur });
    expect(istiyorMu(ab, an('Maghrib', 'once-15'))).toBe(true);
    expect(istiyorMu(ab, an('Maghrib', 'once-10'))).toBe(false);
    expect(istiyorMu(ab, an('Maghrib', 'giris'))).toBe(false);
    expect(istiyorMu(ab, an('Dhuhr', 'once-15'))).toBe(false);
    expect(istiyorMu({ ...ab, giris: true, once: 0 }, an('Isha', 'giris'))).toBe(true);
    expect(istiyorMu({ ...ab, once: 0 }, an('Isha', 'once-5'))).toBe(false);
  });
});

test.describe('abonelik doğrulama', () => {
  test('geçerli abonelik; sadece push adresi, anahtarlar ve seçimler saklanır', () => {
    const { abonelik } = testAboneligi();
    const d = aboneDogrula({ ...aboneGovdesi(abonelik, { vakitler: ['Isha', 'Fajr', 'Isha'] }), isim: 'x', ip: '1.2.3.4' });
    expect(d.gecerli).toBe(true);
    expect(Object.keys(d.abone).sort()).toEqual(['abonelik', 'dil', 'giris', 'once', 'vakitler']);
    expect(d.abone.vakitler).toEqual(['Fajr', 'Isha']);        // sıralı, tekrarsız
    expect(VARSAYILAN).toEqual({ once: 15, giris: true, vakitler: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] });
  });

  test('push servisi dışındaki adresler reddedilir (sunucu keyfi adrese istek atmaz)', () => {
    for (const u of ['https://fcm.googleapis.com/fcm/send/x', 'https://updates.push.services.mozilla.com/wpush/v2/x',
      'https://web.push.apple.com/QO', 'https://wns2-par02p.notify.windows.com/w/?token=x']) expect(pushAdresiGecerli(u), u).toBe(true);
    for (const u of ['http://fcm.googleapis.com/x', 'https://fcm.googleapis.com.kotu.com/x', 'https://kotu.com/fcm.googleapis.com',
      'https://fcm.googleapis.com:8443/x', 'https://a:b@fcm.googleapis.com/x', 'javascript:alert(1)', 'https://localhost/x', '']) expect(pushAdresiGecerli(u), u).toBe(false);
  });

  test('bozuk alanlar reddedilir', () => {
    const { abonelik } = testAboneligi();
    const g = aboneGovdesi(abonelik);
    const bozuk = [
      { ...g, abonelik: { ...abonelik, keys: { ...abonelik.keys, p256dh: 'kisa' } } },
      { ...g, abonelik: { ...abonelik, keys: { ...abonelik.keys, auth: 'a b c d e f g h i j k l' } } },
      { ...g, dil: 'de' }, { ...g, vakitler: ['Cuma'] }, { ...g, vakitler: 'Isha' },
      { ...g, once: 7 }, { ...g, once: '15' }, { ...g, giris: 'evet' }, null,
    ];
    for (const b of bozuk) expect(aboneDogrula(b).gecerli, JSON.stringify(b && { ...b, abonelik: undefined })).toBe(false);
  });
});

test.describe('/api/bildirim/abone', () => {
  test('kurulmamışsa 503 (uygulama bildirimleri hiç göstermez)', async () => {
    const r = await cagir(aboneIsleyici(() => ({ ...sahteOrtam(), aktif: false })), { method: 'POST', body: {} });
    expect(r.durum).toBe(503);
  });

  test('kaydeder; bugünün kalanı ve yarın QStash\'e zamanlanır (bir kez)', async () => {
    const o = sahteOrtam();
    const isle = aboneIsleyici(() => o, () => SIMDI);
    const { abonelik } = testAboneligi();
    const r = await cagir(isle, { method: 'POST', body: aboneGovdesi(abonelik) });
    expect(r.durum).toBe(200);
    expect(r.govde).toEqual({ tamam: true, planlanan: 54 });
    expect(r.basliklar['cache-control']).toBe('no-store');
    // ilk kayıtta hemen onay bildirimi, abonenin dilinde
    expect(o._.gonderilen).toEqual([{ abonelik, yuk: { baslik: 'Meldingen staan aan', govde: 'Je krijgt een melding bij de gebedstijden die je hebt gekozen.', etiket: 'bildirim-acik', dil: 'nl', adres: '/mobil/' } }]);
    const kayit = o._.redis.hash.get('nzm:preview:aboneler');
    expect([...kayit.keys()]).toEqual([aboneId(abonelik.endpoint)]);          // anahtar adresin kendisi değil
    expect(JSON.parse(kayit.get(aboneId(abonelik.endpoint)))).toMatchObject({ abonelik, dil: 'nl', once: 15, giris: true });
    // 28.10 12:00'den sonra: Öğle (12:29) giriş + 5/10/15 önce, İkindi/Akşam/Yatsı 5'er = 19; 29.10: 35
    expect(o._.kuyrukta).toHaveLength(19 + 35);
    const m = o._.kuyrukta.find((x) => x.govde.id === '2026-10-28_Maghrib_once-15');
    expect(m).toEqual({ hedef: `${TEST_KOK}/api/bildirim/gonder`, govde: anBul('2026-10-28', 'Maghrib', 'once-15'), zaman: T('2026-10-28T17:12:00+01:00'), yetki: TEST_CRON });
    expect(o._.kuyrukta.every((x) => x.zaman > SIMDI)).toBe(true);
    // ikinci kayıt / ayar değişikliği: yeniden zamanlanmaz, kayıt güncellenir
    const r2 = await cagir(isle, { method: 'POST', body: aboneGovdesi(abonelik, { dil: 'tr', once: 5 }) });
    expect(r2.durum).toBe(200);
    expect(r2.govde).toEqual({ tamam: true, planlanan: 0 });
    expect(o._.gonderilen).toHaveLength(1);                                   // güncellemede onay yok
    expect(o._.kuyrukta).toHaveLength(54);
    expect(JSON.parse(kayit.get(aboneId(abonelik.endpoint)))).toMatchObject({ dil: 'tr', once: 5 });
    expect(o._.vakitIstekleri).toHaveLength(1);                               // /api/vakit bir kez
  });

  test('başka cihazın aboneliği değiştirilemez/silinemez (auth gerekir)', async () => {
    const o = sahteOrtam();
    const isle = aboneIsleyici(() => o, () => SIMDI);
    const { abonelik } = testAboneligi();
    await cagir(isle, { method: 'POST', body: aboneGovdesi(abonelik) });
    const sahte = { ...abonelik, keys: { ...abonelik.keys, auth: crypto.randomBytes(16).toString('base64url') } };
    expect((await cagir(isle, { method: 'POST', body: aboneGovdesi(sahte, { vakitler: [] }) })).durum).toBe(403);
    expect((await cagir(isle, { method: 'DELETE', body: { endpoint: abonelik.endpoint, auth: sahte.keys.auth } })).durum).toBe(403);
    expect(o._.redis.hash.get('nzm:preview:aboneler').size).toBe(1);
    const sil = await cagir(isle, { method: 'DELETE', body: { endpoint: abonelik.endpoint, auth: abonelik.keys.auth } });
    expect(sil.durum).toBe(200);
    expect(o._.redis.hash.get('nzm:preview:aboneler').size).toBe(0);
    // olmayan aboneliği silmek: 200 (iki kez basılırsa sorun yok)
    expect((await cagir(isle, { method: 'DELETE', body: { endpoint: abonelik.endpoint, auth: abonelik.keys.auth } })).durum).toBe(200);
  });

  test('geçersiz gövde 400, yanlış yöntem 405, abone sınırı 503', async () => {
    const o = sahteOrtam();
    const isle = aboneIsleyici(() => o, () => SIMDI);
    expect((await cagir(isle, { method: 'POST', body: { abonelik: { endpoint: 'https://kotu.com/x' } } })).durum).toBe(400);
    expect((await cagir(isle, { method: 'GET' })).durum).toBe(405);
    o.depo.aboneSayisi = async () => SINIR_ABONE;
    expect((await cagir(isle, { method: 'POST', body: aboneGovdesi(testAboneligi().abonelik) })).durum).toBe(503);
  });

  test('vakitler alınamazsa abonelik yine kaydedilir; plan işareti kalkar, sonra tekrar denenir', async () => {
    const o = sahteOrtam({ vakit: 'hata' });
    const isle = aboneIsleyici(() => o, () => SIMDI);
    const r = await cagir(isle, { method: 'POST', body: aboneGovdesi(testAboneligi().abonelik) });
    expect(r.govde).toEqual({ tamam: true, planlanan: 0, planHatasi: true });
    expect(o._.kuyrukta).toHaveLength(0);
    expect(o._.redis.kv.size).toBe(0);
    o.vakitGetir = async () => VAKIT;
    expect(await planYap(o, SIMDI)).toEqual({ planlanan: 54, gunler: ['2026-10-28', '2026-10-29'] });
  });
});

test.describe('/api/bildirim/planla (günlük cron)', () => {
  test('CRON_SECRET olmadan 401; kurulmamışsa 503 ve eksiklerin adı', async () => {
    const o = sahteOrtam();
    expect((await cagir(planlaIsleyici(() => o, () => SIMDI))).durum).toBe(401);
    expect((await cagir(planlaIsleyici(() => o, () => SIMDI), { headers: cronYetki('yanlis-yanlis-yanlis-yanlis') })).durum).toBe(401);
    const r = await cagir(planlaIsleyici(() => ({ ...o, aktif: false, eksik: ['VAPID_PRIVATE_KEY'] }), () => SIMDI), { headers: cronYetki() });
    expect(r.durum).toBe(503);
    expect(r.govde.eksik).toEqual(['VAPID_PRIVATE_KEY']);
  });

  test('bugün ve yarın; ertesi gün sadece yeni gün eklenir', async () => {
    const o = sahteOrtam();
    const r = await cagir(planlaIsleyici(() => o, () => SIMDI), { headers: cronYetki() });
    expect(r.govde).toEqual({ planlanan: 54, gunler: ['2026-10-28', '2026-10-29'] });
    const ertesi = await cagir(planlaIsleyici(() => o, () => T('2026-10-29T04:10:00+01:00')), { headers: cronYetki() });
    expect(ertesi.govde).toEqual({ planlanan: 35, gunler: ['2026-10-30'] });
    expect(new Set(o._.kuyrukta.map((m) => m.govde.id)).size).toBe(o._.kuyrukta.length);   // aynı an iki kez yok
  });

  test('QStash hata verirse 500 ve işaret kalkar (sonraki çağrı yeniden dener)', async () => {
    const o = sahteOrtam({ kuyrukHata: true });
    const r = await cagir(planlaIsleyici(() => o, () => SIMDI), { headers: cronYetki() });
    expect(r.durum).toBe(500);
    expect(r.govde.hatalar).toEqual(['2026-10-28: qstash kapalı', '2026-10-29: qstash kapalı']);
    expect(o._.redis.kv.size).toBe(0);
  });

  test('yarının vakti yoksa bugünkü plan yine yapılır; yarın sonra tekrar denenir', async () => {
    const tekGun = { ...VAKIT, days: VAKIT.days.filter((d) => d.date === '28.10.2026'), count: 1 };
    const o = sahteOrtam({ vakit: tekGun });
    const r = await cagir(planlaIsleyici(() => o, () => SIMDI), { headers: cronYetki() });
    expect(r.durum).toBe(500);
    expect(r.govde).toEqual({ planlanan: 19, gunler: ['2026-10-28'], hatalar: ['2026-10-29: 2026-10-29 için vakit yok'] });
    expect([...o._.redis.kv.keys()]).toEqual(['nzm:preview:plan:2026-10-28']);
    o.vakitGetir = async () => VAKIT;
    expect((await cagir(planlaIsleyici(() => o, () => SIMDI), { headers: cronYetki() })).govde).toEqual({ planlanan: 35, gunler: ['2026-10-29'] });
  });
});

test.describe('/api/bildirim/gonder (QStash çağırır)', () => {
  async function hazir(abonelerAyar) {
    const o = sahteOrtam({ pushSonuc: (a) => (a.endpoint.includes('/gitti-') ? { tamam: false, durum: 410 } : a.endpoint.includes('/bozuk-') ? { tamam: false, durum: 500 } : { tamam: true }) });
    const isle = aboneIsleyici(() => o, () => SIMDI);
    const abonelikler = [];
    for (const [ad, ayar] of abonelerAyar) {
      const { abonelik } = testAboneligi(ad);
      abonelikler.push(abonelik);
      expect((await cagir(isle, { method: 'POST', body: aboneGovdesi(abonelik, ayar) })).durum).toBe(200);
    }
    o._.gonderilen.length = 0;                 // kayıttaki onay bildirimleri sayılmasın
    return { o, abonelikler };
  }
  const gonder = (o, an, saat, headers = cronYetki()) => cagir(gonderIsleyici(() => o, () => saat), { method: 'POST', headers, body: an });

  test('sadece o anı isteyenlere, kendi dillerinde; ikinci çağrı gönderilmez', async () => {
    const { o, abonelikler } = await hazir([
      ['tr', { dil: 'tr', vakitler: ['Maghrib'], once: 15 }],
      ['nl', { dil: 'nl', vakitler: ['Maghrib', 'Isha'], once: 15 }],
      ['baska', { dil: 'en', vakitler: ['Maghrib'], once: 10 }],
      ['yatsi', { dil: 'en', vakitler: ['Isha'], once: 15 }],
    ]);
    const an = anBul('2026-10-28', 'Maghrib', 'once-15');
    const r = await gonder(o, an, an.an + 1500);
    expect(r.govde).toEqual({ gonderilen: 2, silinen: 0, hata: 0 });
    expect(o._.gonderilen.map((g) => g.abonelik.endpoint)).toEqual([abonelikler[0].endpoint, abonelikler[1].endpoint]);
    expect(o._.gonderilen.map((g) => g.yuk)).toEqual([
      { baslik: 'Akşam namazına 15 dakika', govde: 'Akşam vakti 17:27’de giriyor.', etiket: '2026-10-28-Maghrib', dil: 'tr', adres: '/mobil/' },
      { baslik: 'Nog 15 minuten tot Maghrib', govde: 'Maghrib begint om 17:27.', etiket: '2026-10-28-Maghrib', dil: 'nl', adres: '/mobil/' },
    ]);
    expect((await gonder(o, an, an.an + 5000)).govde).toEqual({ atlandi: 'tekrar' });
    expect(o._.gonderilen).toHaveLength(2);
  });

  test('vaktinden çok önce veya 10 dk\'dan geç gelirse gönderilmez', async () => {
    const { o } = await hazir([['a', { vakitler: ['Isha'], giris: true }]]);
    const an = anBul('2026-10-28', 'Isha', 'giris');
    expect((await gonder(o, an, an.an - 3 * 60e3)).govde).toEqual({ atlandi: 'zaman' });
    expect((await gonder(o, an, an.an + 11 * 60e3)).govde).toEqual({ atlandi: 'zaman' });
    expect(o._.gonderilen).toHaveLength(0);
    expect((await gonder(o, an, an.an + 9 * 60e3)).govde.gonderilen).toBe(1);
  });

  test('404/410 veren abonelik silinir; başka hatada kalır', async () => {
    const { o } = await hazir([['gitti', { vakitler: ['Isha'] }], ['bozuk', { vakitler: ['Isha'] }], ['iyi', { vakitler: ['Isha'] }]]);
    const an = anBul('2026-10-28', 'Isha', 'giris');
    expect((await gonder(o, an, an.an)).govde).toEqual({ gonderilen: 1, silinen: 1, hata: 1 });
    expect(o._.redis.hash.get('nzm:preview:aboneler').size).toBe(2);
  });

  test('yetkisiz 401, uydurma an 400', async () => {
    const { o } = await hazir([]);
    const an = anBul('2026-10-28', 'Isha', 'giris');
    expect((await gonder(o, an, an.an, {})).durum).toBe(401);
    expect((await gonder(o, { ...an, id: 'x' }, an.an)).durum).toBe(400);
    expect((await gonder(o, { ...an, vakit: 'Cuma', id: '2026-10-28_Cuma_giris' }, an.an)).durum).toBe(400);
  });
});

test.describe('ortam ve dış servisler', () => {
  test('eksik değişkenlerin adları; Upstash\'in iki ad biçimi; production/önizleme adresi', () => {
    expect(bildirimOrtami({}).eksik).toEqual(['VAPID_PRIVATE_KEY', 'Upstash Redis', 'QSTASH_TOKEN', 'CRON_SECRET', 'VERCEL_URL']);
    const tam = { VAPID_PRIVATE_KEY: vapidSleutels().geheim, KV_REST_API_URL: 'https://x.upstash.io', KV_REST_API_TOKEN: 't',
      QSTASH_TOKEN: 'q', CRON_SECRET: TEST_CRON, VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'nizam-camii.vercel.app',
      VERCEL_BRANCH_URL: 'nizam-camii-git-main-x.vercel.app' };
    const o = bildirimOrtami(tam);
    expect(o.aktif).toBe(true);
    expect(o.kok).toBe('https://nizam-camii.vercel.app');
    expect(bildirimOrtami({ ...tam, VERCEL_ENV: 'preview' }).kok).toBe('https://nizam-camii-git-main-x.vercel.app');
    expect(bildirimOrtami({ ...tam, CRON_SECRET: 'kisa' }).eksik).toEqual(['CRON_SECRET']);
    expect(bildirimOrtami({ ...tam, VAPID_PRIVATE_KEY: 'bozuk' }).eksik).toEqual(['VAPID_PRIVATE_KEY']);
    // Vercel bağlarken önek ekleyebilir: NIZAM_KV_REST_API_URL, NIZAM_QSTASH_TOKEN …
    const onekli = { ...tam, KV_REST_API_URL: undefined, KV_REST_API_TOKEN: undefined, QSTASH_TOKEN: undefined,
      NIZAM_KV_REST_API_URL: 'https://onekli.upstash.io', NIZAM_KV_REST_API_TOKEN: 't2', QS_QSTASH_TOKEN: 'q2' };
    expect(bildirimOrtami(onekli).aktif).toBe(true);
    // eksikken: ilgili değişkenlerin sadece ADLARI (kurulum yardımı), değerleri asla
    const yarim = bildirimOrtami({ ...tam, QSTASH_TOKEN: undefined, KV_REST_API_TOKEN: undefined, REDIS_URL: 'rediss://gizli@x' });
    expect(yarim.eksik).toEqual(['Upstash Redis', 'QSTASH_TOKEN']);
    expect(yarim.bulunan).toEqual(['KV_REST_API_URL', 'REDIS_URL']);
    expect(JSON.stringify(yarim.bulunan)).not.toContain('gizli');
  });

  test('/api/bildirim/anahtar: açık anahtar gizli anahtardan; değer asla gösterilmez', async () => {
    const s = vapidSleutels();
    const o = { ...sahteOrtam(), vapid: vapidAnahtarlari(s.geheim) };
    const r = await cagir(anahtarIsleyici(() => o));
    expect(r.govde).toEqual({ aktif: true, publicKey: s.openbaar, eksik: [] });
    expect(JSON.stringify(r.govde)).not.toContain(s.geheim);
    const kapali = await cagir(anahtarIsleyici(() => bildirimOrtami({})));
    expect(kapali.govde).toMatchObject({ aktif: false, publicKey: null });
  });

  test('Upstash REST: komutlar doğru biçimde, ortam önekiyle', async () => {
    const istekler = [];
    const f = async (url, init) => { istekler.push({ url, init }); return { ok: true, status: 200, json: async () => ({ result: 'OK' }) }; };
    const d = redisDepo({ UPSTASH_REDIS_REST_URL: 'https://eu1-test.upstash.io/', UPSTASH_REDIS_REST_TOKEN: 'tok', VERCEL_ENV: 'production' }, f);
    expect(await d.isaretle('plan:2026-10-28', 60)).toBe(true);
    expect(istekler[0].url).toBe('https://eu1-test.upstash.io');
    expect(istekler[0].init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(istekler[0].init.body)).toEqual(['SET', 'nzm:production:plan:2026-10-28', '1', 'NX', 'EX', '60']);
    const hatali = redisDepo({ UPSTASH_REDIS_REST_URL: 'https://x', UPSTASH_REDIS_REST_TOKEN: 't' }, async () => ({ ok: false, status: 401, json: async () => ({ error: 'WRONGPASS' }) }));
    await expect(hatali.aboneSayisi()).rejects.toThrow('WRONGPASS');
  });

  test('QStash: tek toplu istek; her mesaj kendi anında, yetki başlığı iletilir', async () => {
    const istekler = [];
    const f = async (url, init) => { istekler.push({ url, init }); return { ok: true, status: 200, text: async () => '[]' }; };
    const k = qstashKuyruk({ QSTASH_TOKEN: 'qtok' }, f);
    const an = anBul('2026-10-28', 'Isha', 'giris');
    await k.gonder([{ hedef: `${TEST_KOK}/api/bildirim/gonder`, govde: an, zaman: an.an, yetki: TEST_CRON }]);
    expect(istekler[0].url).toBe('https://qstash.upstash.io/v2/batch');
    expect(istekler[0].init.headers.Authorization).toBe('Bearer qtok');
    expect(JSON.parse(istekler[0].init.body)).toEqual([{
      destination: `${TEST_KOK}/api/bildirim/gonder`,
      headers: { 'Content-Type': 'application/json', 'Upstash-Not-Before': String(an.an / 1000), 'Upstash-Retries': '2', 'Upstash-Forward-Authorization': `Bearer ${TEST_CRON}` },
      body: JSON.stringify(an),
    }]);
    const bolge = qstashKuyruk({ QSTASH_TOKEN: 'q', QSTASH_URL: 'https://qstash-eu-central-1.upstash.io/' }, f);
    await bolge.gonder([{ hedef: 'https://x', govde: {}, zaman: 0, yetki: 'y' }]);
    expect(istekler[1].url).toBe('https://qstash-eu-central-1.upstash.io/v2/batch');
    const hata = qstashKuyruk({ QSTASH_TOKEN: 'q' }, async () => ({ ok: false, status: 429, text: async () => 'too many' }));
    await expect(hata.gonder([{ hedef: 'https://x', govde: {}, zaman: 0, yetki: 'y' }])).rejects.toThrow('429');
  });

  test('Web Push uçtan uca: şifreli içerik telefonda doğru açılır, VAPID imzası geçerli', async () => {
    const gelen = [];
    const sunucu = http.createServer((req, res) => {
      const parcalar = [];
      req.on('data', (p) => parcalar.push(p));
      req.on('end', () => { gelen.push({ url: req.url, headers: req.headers, govde: Buffer.concat(parcalar) }); res.writeHead(req.url.includes('gitti') ? 410 : 201); res.end(); });
    });
    await new Promise((r) => sunucu.listen(0, '127.0.0.1', r));
    const port = sunucu.address().port;
    try {
      const s = vapidSleutels();
      const vapid = vapidAnahtarlari(s.geheim);
      const wp = webPush(vapid, { modul: () => import('web-push') });
      const { abonelik, ecdh, auth } = testAboneligi();
      const yerel = { ...abonelik, endpoint: `http://127.0.0.1:${port}/push/abc` };
      const yuk = JSON.stringify({ baslik: 'Akşam vakti girdi · 17:27', govde: 'Test', etiket: '2026-10-28-Maghrib', dil: 'tr', adres: '/mobil/' });
      expect(await wp.gonder(yerel, yuk)).toEqual({ tamam: true });
      const g = gelen[0];
      expect(g.headers.ttl).toBe('600');
      expect(g.headers.urgency).toBe('high');
      expect(g.headers['content-encoding']).toBe('aes128gcm');
      // telefon tarafı: kendi gizli anahtarı + auth ile çözer
      const cozulen = ece.decrypt(g.govde, { version: 'aes128gcm', privateKey: ecdh, authSecret: auth });
      expect(cozulen.toString('utf8')).toBe(yuk);
      // push servisi tarafı: VAPID JWT, açık anahtarımızla doğrulanır
      const m = g.headers.authorization.match(/^vapid t=([^,]+), k=(.+)$/);
      expect(m[2]).toBe(s.openbaar);
      const [h, p, imza] = m[1].split('.');
      const claims = JSON.parse(Buffer.from(p, 'base64url'));
      expect(claims.aud).toBe(`http://127.0.0.1:${port}`);
      expect(claims.sub).toBe(VAPID_KONU);
      const ham = Buffer.from(s.openbaar, 'base64url');
      const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: ham.subarray(1, 33).toString('base64url'), y: ham.subarray(33).toString('base64url') }, format: 'jwk' });
      expect(crypto.verify('sha256', Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(imza, 'base64url'))).toBe(true);
      // abonelik bitmişse (410) gönderici bunu bildirir
      expect(await wp.gonder({ ...yerel, endpoint: `http://127.0.0.1:${port}/push/gitti` }, yuk)).toEqual({ tamam: false, durum: 410 });
    } finally {
      sunucu.close();
    }
  });
});
