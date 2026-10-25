// Faz D testleri: gerçek Upstash/QStash/push servisleri yerine bellekte çalışan kopyalar.
// Redis'in kendisi değil REST arayüzü taklit edilir: redisDepo() gerçek koduyla komut gönderir.
import crypto from 'node:crypto';
import { redisDepo, vapidAnahtarlari } from '../../api/_lib/bildirim-servis.js';
import { vapidSleutels } from '../araclar/vapid.mjs';
import { VAKIT } from './tv.js';

export const TEST_CRON = 'test-cron-gizli-0123456789abcdef';
export const TEST_KOK = 'https://nizam-camii-git-faz-d-test.vercel.app';

/** Upstash REST (POST, gövde = ["KOMUT", ...]) taklidi: HGET/HSET/HDEL/HLEN/HGETALL/SET NX EX/DEL. */
export function sahteRedis() {
  const hash = new Map();
  const kv = new Map();
  const komutlar = [];
  const istekler = [];
  const f = async (url, init) => {
    istekler.push({ url, init });
    const args = JSON.parse(init.body);
    komutlar.push(args);
    const [k, a, b, c] = args;
    let result;
    switch (k) {
      case 'HGET': result = (hash.get(a) && hash.get(a).get(b)) ?? null; break;
      case 'HSET': { if (!hash.has(a)) hash.set(a, new Map()); const yeni = !hash.get(a).has(b); hash.get(a).set(b, c); result = yeni ? 1 : 0; break; }
      case 'HDEL': result = hash.get(a) && hash.get(a).delete(b) ? 1 : 0; break;
      case 'HLEN': result = hash.get(a) ? hash.get(a).size : 0; break;
      case 'HGETALL': result = [...(hash.get(a) || new Map())].flat(); break;
      case 'SET': if (args.includes('NX') && kv.has(a)) result = null; else { kv.set(a, b); result = 'OK'; } break;
      case 'DEL': result = kv.delete(a) ? 1 : 0; break;
      default: return { ok: false, status: 400, json: async () => ({ error: `ERR unknown command ${k}` }) };
    }
    return { ok: true, status: 200, json: async () => ({ result }) };
  };
  return { f, hash, kv, komutlar, istekler };
}

/** Tarayıcının vereceği gibi bir abonelik (gerçek P-256 anahtarı + 16 bayt auth). */
export function testAboneligi(ad = 'a', host = 'fcm.googleapis.com') {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  return {
    abonelik: {
      endpoint: `https://${host}/fcm/send/${ad}-${crypto.randomBytes(8).toString('hex')}`,
      keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') },
    },
    ecdh, auth,
  };
}

/**
 * Bildirim ortamı (bildirimOrtami() ile aynı biçim), sahte servislerle.
 * @param {object} o
 * @param {object} [o.vakit]       /api/vakit cevabı (varsayılan: test verisi)
 * @param {Function} [o.pushSonuc] (abonelik) => { tamam, durum }
 */
export function sahteOrtam(o = {}) {
  const redis = sahteRedis();
  const depo = redisDepo({ UPSTASH_REDIS_REST_URL: 'https://test-redis.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'test', VERCEL_ENV: 'preview' }, redis.f);
  const kuyrukta = [];
  const gonderilen = [];
  const vakitIstekleri = [];
  return {
    aktif: true, eksik: [],
    vapid: vapidAnahtarlari(vapidSleutels().geheim),
    depo,
    kuyruk: { tanimli: true, async gonder(m) { if (o.kuyrukHata) throw new Error('qstash kapalı'); kuyrukta.push(...m); return m.length; } },
    push: { async gonder(abonelik, yuk) { gonderilen.push({ abonelik, yuk: JSON.parse(yuk) }); return (o.pushSonuc || (() => ({ tamam: true })))(abonelik); } },
    cronSecret: TEST_CRON,
    kok: TEST_KOK,
    vakitGetir: async () => { vakitIstekleri.push(1); if (o.vakit === 'hata') throw new Error('/api/vakit 503'); return o.vakit || VAKIT; },
    _: { redis, kuyrukta, gonderilen, vakitIstekleri },
  };
}

export const cronYetki = (gizli = TEST_CRON) => ({ authorization: `Bearer ${gizli}` });

/** Uygulamanın göndereceği gövde. */
export function aboneGovdesi(abonelik, ayar = {}) {
  return { abonelik, dil: 'nl', vakitler: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'], once: 15, giris: true, ...ayar };
}
