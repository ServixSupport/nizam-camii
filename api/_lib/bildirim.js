// Faz D: bildirim mantığı (saf: ağ yok). Sunucu fonksiyonları ve testler kullanır.
// Vakitler uygulamayla aynı kurallarla hesaplanır (mobil/zaman.js: Sabah = Güneş − 60, Amsterdam saati).
import crypto from 'node:crypto';
import { VAKITLER, diyanetGunu, gunOlaylari } from '../../mobil/zaman.js';
import { METIN, DILLER } from '../../mobil/metin.js';

/** "Vakitten önce hatırlat" seçenekleri (dakika); 0 = kapalı. */
export const ONCE = [5, 10, 15, 30];
/** Tasarımdaki başlangıç ayarı (ontwerp/Mobil-Ayarlar.dc.html). */
export const VARSAYILAN = { once: 15, giris: true, vakitler: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] };
/** Kötüye kullanıma karşı üst sınır (Upstash ücretsiz katmanı içinde kalmak için). */
export const SINIR_ABONE = 5000;
/** Gönderim penceresi: vaktinden en fazla 2 dk önce, 10 dk sonra (geç kalan bildirim gönderilmez). */
export const PENCERE = { once: 2 * 60 * 1000, sonra: 10 * 60 * 1000 };

const NAMAZ = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

// Tarayıcıların push servisleri. Başka adrese istek atılmaz (sunucu, keyfi adreslere POST yapmasın).
const PUSH_HOSTLARI = ['fcm.googleapis.com', 'android.googleapis.com', 'updates.push.services.mozilla.com',
  'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];

export function pushAdresiGecerli(s) {
  if (typeof s !== 'string' || s.length > 1024) return false;
  let u;
  try { u = new URL(s); } catch { return false; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
  const h = u.hostname.toLowerCase();
  return PUSH_HOSTLARI.some((d) => h === d || h.endsWith('.' + d));
}

const B64 = /^[A-Za-z0-9_-]+={0,2}$/;

/** Uygulamadan gelen abonelik + ayarlar. İsim, hesap, IP yok; sadece push adresi ve seçimler. */
export function aboneDogrula(g) {
  const hata = (m) => ({ gecerli: false, hata: m });
  if (!g || typeof g !== 'object') return hata('gövde yok');
  const a = g.abonelik;
  if (!a || typeof a !== 'object' || !pushAdresiGecerli(a.endpoint)) return hata('abonelik adresi geçersiz');
  const k = a.keys || {};
  if (typeof k.p256dh !== 'string' || !B64.test(k.p256dh) || k.p256dh.length < 80 || k.p256dh.length > 100) return hata('p256dh geçersiz');
  if (typeof k.auth !== 'string' || !B64.test(k.auth) || k.auth.length < 16 || k.auth.length > 32) return hata('auth geçersiz');
  if (!DILLER.some(([d]) => d === g.dil)) return hata('dil geçersiz');
  if (!Array.isArray(g.vakitler) || g.vakitler.length > VAKITLER.length || !g.vakitler.every((v) => VAKITLER.includes(v))) return hata('vakitler geçersiz');
  if (![0, ...ONCE].includes(g.once)) return hata('önce süresi geçersiz');
  if (typeof g.giris !== 'boolean') return hata('giriş ayarı geçersiz');
  return {
    gecerli: true,
    abone: {
      abonelik: { endpoint: a.endpoint, keys: { p256dh: k.p256dh, auth: k.auth } },
      dil: g.dil,
      vakitler: VAKITLER.filter((v) => g.vakitler.includes(v)),
      once: g.once,
      giris: g.giris,
    },
  };
}

/** Kayıt anahtarı: push adresinin özeti (adresin kendisi anahtar olarak görünmesin). */
export const aboneId = (endpoint) => crypto.createHash('sha256').update(String(endpoint)).digest('hex').slice(0, 32);

/** Sahiplik: aynı push adresini değiştirmek/silmek için tarayıcının gizli `auth` anahtarı gerekir. */
export function ayniAuth(a, b) {
  const h = (s) => crypto.createHash('sha256').update(String(s)).digest();
  return typeof a === 'string' && typeof b === 'string' && crypto.timingSafeEqual(h(a), h(b));
}

/**
 * Bir günün bildirim anları: her vakit için "giriş" ve 5/10/15/30 dk "önce".
 * @param {object} gun  /api/vakit'in bir günü ({ date, imsak, gunes, … })
 * @param {string} ymd  'YYYY-MM-DD' (Amsterdam)
 */
export function gunAnlari(gun, ymd) {
  if (!gun) return [];
  const out = [];
  for (const e of gunOlaylari(diyanetGunu(gun), ymd)) {
    out.push({ id: `${ymd}_${e.key}_giris`, tarih: ymd, vakit: e.key, tur: 'giris', an: e.ms, saat: e.saat });
    for (const n of ONCE) {
      out.push({ id: `${ymd}_${e.key}_once-${n}`, tarih: ymd, vakit: e.key, tur: `once-${n}`, an: e.ms - n * 60000, saat: e.saat });
    }
  }
  return out;
}

const TURLER = ['giris', ...ONCE.map((n) => `once-${n}`)];

/** Kuyruktan gelen an mesajı bizim ürettiğimiz biçimde mi? */
export function anGecerli(a) {
  return !!a && typeof a === 'object'
    && /^\d{4}-\d{2}-\d{2}$/.test(a.tarih) && VAKITLER.includes(a.vakit) && TURLER.includes(a.tur)
    && Number.isFinite(a.an) && /^\d{2}:\d{2}$/.test(a.saat) && a.id === `${a.tarih}_${a.vakit}_${a.tur}`;
}

/** Bu abone bu anda bildirim istiyor mu? */
export function istiyorMu(abone, an) {
  if (!abone || !Array.isArray(abone.vakitler) || !abone.vakitler.includes(an.vakit)) return false;
  return an.tur === 'giris' ? abone.giris === true : abone.once === Number(an.tur.slice(5));
}

// Türkçe bulunma eki, saatin okunuşuna göre: 18:34’te (otuz dört), 20:09’da (dokuz), 12:00’de (on iki).
const BIRLER = ['', 'de', 'de', 'te', 'te', 'te', 'da', 'de', 'de', 'da'];   // bir … dokuz
const ONLAR = ['', 'da', 'de', 'da', 'ta', 'de'];                          // on, yirmi, otuz, kırk, elli
const ekSayi = (n) => (n === 0 ? 'da' : n % 10 ? BIRLER[n % 10] : ONLAR[n / 10]);
export function saatEki(saat) {
  const [h, m] = saat.split(':').map(Number);
  return `${saat}’${m ? ekSayi(m) : ekSayi(h)}`;
}

/**
 * Bildirim metni, abonenin dilinde (tasarım: ontwerp/Mobil-Bildirim.dc.html).
 * Dini metin değil; yine de yayından önce hocaya/cami yönetimine gösterilmeli.
 */
export function bildirimMetni(dil, an) {
  const ad = METIN[dil].names[an.vakit];
  const n = an.tur === 'giris' ? 0 : Number(an.tur.slice(5));
  const namaz = NAMAZ.includes(an.vakit);
  const gunes = an.vakit === 'Sunrise';
  const s = an.saat;
  if (dil === 'tr') {
    if (!n) {
      return { baslik: gunes ? `Güneş doğdu · ${s}` : `${ad} vakti girdi · ${s}`,
        govde: namaz ? 'Camiye geliyorsanız telefonunuzu sessize almayı unutmayın.' : '' };
    }
    return { baslik: gunes ? `Güneşin doğmasına ${n} dakika` : namaz ? `${ad} namazına ${n} dakika` : `${ad} vaktine ${n} dakika`,
      govde: gunes ? `Güneş ${saatEki(s)} doğuyor.` : `${ad} vakti ${saatEki(s)} giriyor.` };
  }
  if (dil === 'nl') {
    if (!n) {
      return { baslik: gunes ? `Zonsopgang · ${s}` : `${ad} is begonnen · ${s}`,
        govde: namaz ? 'Kom je naar de moskee? Vergeet niet je telefoon op stil te zetten.' : '' };
    }
    return { baslik: `Nog ${n} minuten tot ${gunes ? 'zonsopgang' : ad}`,
      govde: gunes ? `De zon komt op om ${s}.` : `${ad} begint om ${s}.` };
  }
  if (!n) {
    return { baslik: gunes ? `Sunrise · ${s}` : `${ad} has begun · ${s}`,
      govde: namaz ? 'Coming to the mosque? Remember to silence your phone.' : '' };
  }
  return { baslik: `${n} minutes until ${gunes ? 'sunrise' : ad}`,
    govde: gunes ? `The sun rises at ${s}.` : `${ad} begins at ${s}.` };
}

/** Telefona giden içerik (service worker gösterir). Aynı vaktin bildirimleri aynı etiketle birbirinin yerini alır. */
export function bildirimYuku(abone, an) {
  const { baslik, govde } = bildirimMetni(abone.dil, an);
  return JSON.stringify({ baslik, govde, etiket: `${an.tarih}-${an.vakit}`, dil: abone.dil, adres: '/mobil/' });
}

/** Bildirimler ilk açıldığında hemen giden onay: zincir (anahtar → push servisi → telefon) çalışıyor mu, kullanıcı hemen görür. */
const ONAY = {
  tr: { baslik: 'Bildirimler açık', govde: 'Seçtiğiniz namaz vakitlerinde bildirim alacaksınız.' },
  nl: { baslik: 'Meldingen staan aan', govde: 'Je krijgt een melding bij de gebedstijden die je hebt gekozen.' },
  en: { baslik: 'Notifications are on', govde: 'You will get a notification for the prayer times you chose.' },
};
export function onayYuku(dil) {
  const m = ONAY[dil] || ONAY.nl;
  return JSON.stringify({ ...m, etiket: 'bildirim-acik', dil, adres: '/mobil/' });
}
