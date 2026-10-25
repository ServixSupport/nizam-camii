// Faz D: bildirimlerin dış servisleri (S6, 25-10-2026: Upstash).
//  - Upstash Redis: abonelikler (gizli; public depoya/Blob'a konmaz).
//  - Upstash QStash: her vakit anı için zamanlanmış çağrı → /api/bildirim/gonder.
//  - Web Push (VAPID): telefona gönderim. Açık anahtar gizli anahtardan hesaplanır.
// Sırlar sadece Vercel ortam değişkenlerinde: VAPID_PRIVATE_KEY, CRON_SECRET, Upstash'in kendi değişkenleri.
import crypto from 'node:crypto';
import { amsGun, gunEkle, diyanetAnahtari } from '../../mobil/zaman.js';
import { gunAnlari } from './bildirim.js';

const GUN_SN = 24 * 60 * 60;

/**
 * Marketplace değişkeni: önce tam adıyla, yoksa önekli hâli (Vercel bağlarken önek eklenebilir,
 * ör. NIZAM_KV_REST_API_URL). `cift` aynı önekle birlikte gelen ikinci değişkendir (token).
 * @param {boolean} [ciftSart=true]  çift de bulunmalı mı (QStash'te adres isteğe bağlı)
 * @returns {[string, string]} [değer, çiftin değeri]
 */
export function onekliBul(env, ad, cift, ciftSart = true) {
  if (env[ad]) return [env[ad], env[cift] || ''];
  for (const k of Object.keys(env).sort()) {
    if (k.endsWith('_' + ad) && env[k]) {
      const onek = k.slice(0, -ad.length);
      if (!ciftSart || env[onek + cift]) return [env[k], env[onek + cift] || ''];
    }
  }
  return ['', ''];
}

/** Upstash Redis (REST). Anahtarlar ortama göre ayrı: production ile önizleme karışmaz. */
export function redisDepo(env = process.env, f = (...a) => fetch(...a)) {
  let [url, token] = onekliBul(env, 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token) [url, token] = onekliBul(env, 'KV_REST_API_URL', 'KV_REST_API_TOKEN');
  url = (url || '').replace(/\/$/, '');
  const p = `nzm:${env.VERCEL_ENV || 'development'}:`;
  const ABONE = p + 'aboneler';
  async function komut(...args) {
    const r = await f(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
    let j = {};
    try { j = await r.json(); } catch { /* boş cevap */ }
    if (!r.ok || j.error) throw new Error(`redis ${args[0]}: ${j.error || r.status}`);
    return j.result;
  }
  return {
    tanimli: !!(url && token),
    async aboneOku(id) { const v = await komut('HGET', ABONE, id); return v ? JSON.parse(v) : null; },
    async aboneYaz(id, kayit) { await komut('HSET', ABONE, id, JSON.stringify(kayit)); },
    async aboneSil(id) { await komut('HDEL', ABONE, id); },
    async aboneSayisi() { return Number(await komut('HLEN', ABONE)) || 0; },
    async aboneler() {
      const l = (await komut('HGETALL', ABONE)) || [];
      const out = [];
      for (let i = 0; i + 1 < l.length; i += 2) {
        try { out.push({ id: l[i], ...JSON.parse(l[i + 1]) }); } catch { /* bozuk kayıt atlanır */ }
      }
      return out;
    },
    /** Bir kez: anahtar yoksa koyar ve true döner (SET NX EX). */
    async isaretle(ad, saniye) { return (await komut('SET', p + ad, '1', 'NX', 'EX', String(saniye))) === 'OK'; },
    async isaretSil(ad) { await komut('DEL', p + ad); },
  };
}

/** Upstash QStash: mesajları belli bir anda hedefe POST eder (Upstash-Not-Before, saniye). */
export function qstashKuyruk(env = process.env, f = (...a) => fetch(...a)) {
  const [token, adres] = onekliBul(env, 'QSTASH_TOKEN', 'QSTASH_URL', false);
  const kok = (adres || 'https://qstash.upstash.io').replace(/\/$/, '');
  return {
    tanimli: !!token,
    /** @param {Array<{hedef:string, govde:object, zaman:number, yetki:string}>} mesajlar */
    async gonder(mesajlar) {
      if (!mesajlar.length) return 0;
      const r = await f(`${kok}/v2/batch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(mesajlar.map((m) => ({
          destination: m.hedef,
          headers: {
            'Content-Type': 'application/json',
            'Upstash-Not-Before': String(Math.floor(m.zaman / 1000)),
            'Upstash-Retries': '2',
            // QStash bunu hedefe "Authorization: Bearer …" olarak iletir; /gonder bunu bekler.
            'Upstash-Forward-Authorization': `Bearer ${m.yetki}`,
          },
          body: JSON.stringify(m.govde),
        }))),
      });
      if (!r.ok) throw new Error(`qstash ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
      return mesajlar.length;
    },
  };
}

/** VAPID: gizli anahtardan (32 bayt, base64url) açık anahtar. Geçersizse null. */
export function vapidAnahtarlari(gizli) {
  try {
    const d = Buffer.from(String(gizli || '').trim(), 'base64url');
    if (d.length !== 32) return null;
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.setPrivateKey(d);
    return { publicKey: ecdh.getPublicKey().toString('base64url'), privateKey: d.toString('base64url') };
  } catch {
    return null;
  }
}

export const VAPID_KONU = 'https://nizam-camii.vercel.app';

/**
 * Web Push gönderici: web-push isteği hazırlar (şifreleme + VAPID imzası), fetch gönderir.
 * `modul`: web-push'u yükler, `f`: fetch (testte testin kendi kopyaları verilir).
 */
export function webPush(vapid, { modul = () => import('web-push'), f = (...a) => fetch(...a) } = {}) {
  return {
    async gonder(abonelik, yuk) {
      try {
        const wp = (await modul()).default;
        const d = wp.generateRequestDetails(abonelik, yuk, {
          TTL: 600, urgency: 'high',
          vapidDetails: { subject: VAPID_KONU, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
        });
        const basliklar = { ...d.headers };
        delete basliklar['Content-Length'];             // fetch gövdeden kendisi hesaplar
        const r = await f(d.endpoint, { method: d.method, headers: basliklar, body: d.body });
        return r.ok ? { tamam: true } : { tamam: false, durum: r.status };
      } catch (e) {
        return { tamam: false, durum: 0 };
      }
    },
  };
}

/** Bu ortamın herkese açık adresi: QStash buraya çağırır, vakitler buradan (/api/vakit) okunur. */
export function ortamAdresi(env = process.env) {
  if (env.VERCEL_ENV === 'production' && env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (env.VERCEL_BRANCH_URL) return `https://${env.VERCEL_BRANCH_URL}`;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return '';
}

/** Bütün parçalar. `aktif` değilse bildirim özelliği uygulamada hiç görünmez. */
export function bildirimOrtami(env = process.env) {
  const vapid = vapidAnahtarlari(env.VAPID_PRIVATE_KEY);
  const depo = redisDepo(env);
  const kuyruk = qstashKuyruk(env);
  const cronSecret = (env.CRON_SECRET || '').length >= 16 ? env.CRON_SECRET : '';
  const kok = ortamAdresi(env);
  // Sadece eksik değişkenlerin ADLARI (değerleri asla) — kurulumda neyin eksik olduğu görülsün.
  const eksik = [!vapid && 'VAPID_PRIVATE_KEY', !depo.tanimli && 'Upstash Redis', !kuyruk.tanimli && 'QSTASH_TOKEN',
    !cronSecret && 'CRON_SECRET', !kok && 'VERCEL_URL'].filter(Boolean);
  return {
    vapid, depo, kuyruk, cronSecret, kok, eksik,
    // kurulum yardımı: Upstash'e ait görünen değişkenlerin sadece ADLARI (değerleri asla)
    bulunan: eksik.length ? Object.keys(env).filter((k) => env[k] && /UPSTASH|QSTASH|KV_|REDIS/i.test(k)).sort() : [],
    aktif: eksik.length === 0,
    push: vapid ? webPush(vapid) : null,
    // Vakitler SADECE /api/vakit'ten, parametresiz (CLAUDE.md kural 2). Diyanet'e buradan gidilmez.
    vakitGetir: async () => {
      const r = await fetch(`${kok}/api/vakit`);
      if (!r.ok) throw new Error(`/api/vakit ${r.status}`);
      return r.json();
    },
  };
}

/** Authorization: Bearer <gizli> (sabit süreli karşılaştırma). */
export function bearerEsit(req, gizli) {
  if (!gizli) return false;
  const m = String((req.headers && req.headers.authorization) || '').match(/^Bearer\s+(\S+)\s*$/i);
  if (!m) return false;
  const h = (s) => crypto.createHash('sha256').update(s, 'utf8').digest();
  return crypto.timingSafeEqual(h(m[1]), h(gizli));
}

/**
 * Bugün ve yarın için bütün bildirim anlarını QStash'e zamanlar. Her gün en fazla bir kez
 * (Redis işareti); başarısız olursa işaret silinir, sonraki çağrı yeniden dener.
 * Günde 35 an (7 vakit × giriş + 4 "önce") → QStash ücretsiz sınırının (1000/gün) çok altında.
 */
export async function planYap(o, simdi) {
  const bugun = amsGun(simdi);
  let veri = null;
  let planlanan = 0;
  const gunler = [];
  for (const ymd of [bugun, gunEkle(bugun, 1)]) {
    const isaret = `plan:${ymd}`;
    if (!(await o.depo.isaretle(isaret, 3 * GUN_SN))) continue;
    try {
      veri = veri || await o.vakitGetir();
      const gun = veri && veri.available !== false && Array.isArray(veri.days)
        ? veri.days.find((x) => x && x.date === diyanetAnahtari(ymd)) : null;
      if (!gun) throw new Error(`${ymd} için vakit yok`);
      const anlar = gunAnlari(gun, ymd).filter((a) => a.an > simdi + 30 * 1000);
      await o.kuyruk.gonder(anlar.map((a) => ({ hedef: `${o.kok}/api/bildirim/gonder`, govde: a, zaman: a.an, yetki: o.cronSecret })));
      planlanan += anlar.length;
      gunler.push(ymd);
    } catch (e) {
      await o.depo.isaretSil(isaret).catch(() => {});
      throw e;
    }
  }
  return { planlanan, gunler };
}

/** Sınırlı eşzamanlılıkla iş (push servislerine aynı anda en fazla `n` istek). */
export async function sirayla(liste, n, is) {
  let i = 0;
  const isci = async () => { while (i < liste.length) { const x = liste[i++]; await is(x); } };
  await Promise.all(Array.from({ length: Math.min(n, liste.length) }, isci));
}
