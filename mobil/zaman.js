// Uygulamanın saat ve vakit mantığı. Saf modül: DOM yok; tarayıcıda ve testlerde (Node) aynen çalışır.
// Vakit kuralları index.html'deki TV ile birebir aynıdır (CLAUDE.md kural 6):
//   - Sabah = Güneş − 60 dk.  Diyanet'te `imsak` hem İmsak hem Fajr'dır.
//   - Diyanet saatlerine düzeltme yok. Aladhan yedeğine İmsak +48, Yatsı −41.
//   - Hicri: Diyanet'in `hijri` alanı (G.A.YYYY) + HICRI_AY.
// Fark: TV cihaz saatini kullanır; uygulama her zaman Europe/Amsterdam saatini kullanır.

export const AMS = 'Europe/Amsterdam';
export const VAKITLER = ['Imsak', 'Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
export const ALADHAN_DUZELTME = { Imsak: 48, Fajr: 0, Sunrise: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: -41 };
export const ALADHAN_KONUM = { latitude: 52.36523, longitude: 4.79997, method: 13 };
export const HICRI_AY = ['', 'Muharram', 'Safar', 'Rabi\' al-Awwal', 'Rabi\' al-Thani', 'Jumada al-Awwal',
  'Jumada al-Thani', 'Rajab', 'Sha\'ban', 'Ramadan', 'Shawwal', 'Dhu al-Qa\'dah', 'Dhu al-Hijjah'];

const GUN_KISA = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n) => String(n).padStart(2, '0');

let _fmt = null;
function fmt() {
  return _fmt || (_fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: AMS, hourCycle: 'h23', weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }));
}

/** Bir anın Amsterdam'daki duvar saati: { y, m, d, h, mi, s, hg (1 = Pazartesi … 7 = Pazar) } */
export function amsParcalar(ms) {
  const p = {};
  for (const x of fmt().formatToParts(new Date(ms))) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second, hg: GUN_KISA.indexOf(p.weekday) + 1 };
}

function ofset(ms) {
  const p = amsParcalar(ms);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
}

/** Amsterdam duvar saati → an (ms). Dakika 59'u aşabilir (Date.UTC toparlar). */
export function amsZaman(y, m, d, h = 0, mi = 0) {
  const duvar = Date.UTC(y, m - 1, d, h, mi);
  let t = duvar - ofset(duvar);
  t = duvar - ofset(t);            // yaz/kış saati geçişinde ikinci tur düzeltir
  return t;
}

/** 'YYYY-MM-DD' (Amsterdam takvim günü) */
export function amsGun(ms) {
  const p = amsParcalar(ms);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function gunEkle(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 'YYYY-MM-DD' → Diyanet anahtarı 'GG.AA.YYYY' */
export const diyanetAnahtari = (ymd) => ymd.split('-').reverse().join('.');
/** 'YYYY-MM-DD' → Aladhan tarihi 'GG-AA-YYYY' */
export const aladhanTarihi = (ymd) => ymd.split('-').reverse().join('-');

export function aladhanAdresi(ymd) {
  const k = ALADHAN_KONUM;
  return `https://api.aladhan.com/v1/timings/${aladhanTarihi(ymd)}`
    + `?latitude=${k.latitude}&longitude=${k.longitude}&method=${k.method}`;
}

export function saatAyir(str) {
  const m = String(str || '').match(/(\d{1,2}):(\d{2})/);
  return m ? [+m[1], +m[2]] : null;
}

/** /api/vakit'in bir günü → ortak gün yapısı */
export function diyanetGunu(x) {
  const hp = String(x.hijri || '').split('.');
  return {
    kaynak: 'diyanet',
    vakit: { Imsak: x.imsak, Fajr: x.imsak, Sunrise: x.gunes, Dhuhr: x.ogle, Asr: x.ikindi, Maghrib: x.aksam, Isha: x.yatsi },
    hicri: { gun: (hp[0] || '').replace(/^0/, ''), ay: parseInt(hp[1], 10) || 0, yil: hp[2] || '', ayAd: '' },
  };
}

/** Aladhan cevabının `data` alanı → ortak gün yapısı */
export function aladhanGunu(data) {
  const h = (data && data.date && data.date.hijri) || {};
  return {
    kaynak: 'aladhan',
    vakit: { ...(data && data.timings) },
    hicri: { gun: String(h.day || ''), ay: +(h.month && h.month.number) || 0, yil: String(h.year || ''), ayAd: (h.month && h.month.en) || '' },
  };
}

export function hicriYazi(h) {
  if (!h) return '';
  return `${h.gun} ${HICRI_AY[h.ay] || h.ayAd} ${h.yil}`.trim();
}

const hhmm = (dk) => { const x = ((dk % 1440) + 1440) % 1440; return `${pad(Math.floor(x / 60))}:${pad(x % 60)}`; };

/**
 * Bir günün 7 vakti, sırayla: [{ key, ms, saat: 'HH:MM', ymd }]
 * Sabah = Güneş − 60; düzeltmeler sadece Aladhan'a.
 */
export function gunOlaylari(gun, ymd) {
  if (!gun) return [];
  const [y, m, d] = ymd.split('-').map(Number);
  const out = [];
  for (const key of VAKITLER) {
    const hm = saatAyir(gun.vakit[key === 'Fajr' ? 'Sunrise' : key]);
    if (!hm) continue;
    const off = gun.kaynak === 'diyanet' ? 0 : (ALADHAN_DUZELTME[key] || 0);
    const dk = hm[0] * 60 + hm[1] + off + (key === 'Fajr' ? -60 : 0);
    out.push({ key, ms: amsZaman(y, m, d, 0, dk), saat: hhmm(dk), ymd });
  }
  return out;
}

/** H:MM:SS (saat sıfırsız, tasarımdaki gibi) */
export function geriSayim(ms) {
  let s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600); s %= 3600;
  return `${h}:${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

/** Otomatik tema: Güneş − 1 sn ile Akşam − 1 sn arası gündüz (TV'deki "auto" gibi). */
export function gunduzMu(simdi, bugun) {
  const g = bugun.find((e) => e.key === 'Sunrise');
  const a = bugun.find((e) => e.key === 'Maghrib');
  if (!g || !a) { const h = amsParcalar(simdi).h; return h >= 7 && h < 18; }
  return simdi >= g.ms - 1000 && simdi < a.ms - 1000;
}

/**
 * Ekranın o anki durumu.
 * @param {number} simdi  an (ms)
 * @param {Array} bugun   gunOlaylari(bugün)
 * @param {Array} yarin   gunOlaylari(yarın)
 * @param {Array} dun     gunOlaylari(dün) — gece yarısından sonra kemer için (yoksa yaklaşık)
 */
export function anDurumu(simdi, bugun, yarin, dun = []) {
  const hepsi = [...bugun, ...yarin].sort((a, b) => a.ms - b.ms);
  const siradaki = hepsi.find((e) => e.ms > simdi) || null;

  let son = null;
  for (const e of bugun) if (e.ms <= simdi) son = e;
  const simdiki = son && son.key !== 'Sunrise' ? son.key : null;   // Güneş namaz vakti değil

  const satirlar = bugun.map((e) => ({
    ...e,
    durum: e.ms <= simdi ? 'gecti' : (siradaki && e.ms === siradaki.ms ? 'siradaki' : 'gelecek'),
    simdi: e.key === simdiki,
  }));

  const bul = (l, k) => l.find((e) => e.key === k);
  const imsak = bul(bugun, 'Imsak'), yatsi = bul(bugun, 'Isha'), aksam = bul(bugun, 'Maghrib');
  let kemer = null;
  if (imsak && yatsi && simdi >= imsak.ms && simdi < yatsi.ms) {
    const aralik = yatsi.ms - imsak.ms;
    kemer = {
      mod: 'gunduz',
      oran: (simdi - imsak.ms) / aralik,
      gok: aksam && simdi >= aksam.ms ? 'ay' : 'gunes',
      noktalar: satirlar.map((e) => ({ key: e.key, oran: (e.ms - imsak.ms) / aralik, durum: e.durum })),
    };
  } else if (imsak && yatsi) {
    // gece: Yatsı'dan sonraki İmsak'a kadar ay; ilerleme Yatsı → İmsak
    let bas, bit;
    if (simdi >= yatsi.ms) {
      bas = yatsi.ms;
      const yi = bul(yarin, 'Imsak');
      bit = yi ? yi.ms : imsak.ms + 864e5;
    } else {
      const dy = bul(dun, 'Isha');
      bas = dy ? dy.ms : yatsi.ms - 864e5;
      bit = imsak.ms;
    }
    kemer = {
      mod: 'gece',
      oran: Math.min(1, Math.max(0, (simdi - bas) / (bit - bas))),
      gok: 'ay',
      noktalar: [{ key: 'Isha', oran: 0, durum: 'gecti' }, { key: 'Imsak', oran: 1, durum: 'siradaki' }],
    };
  }

  return {
    siradaki,
    kalan: siradaki ? siradaki.ms - simdi : null,
    satirlar,
    kemer,
    gunduz: gunduzMu(simdi, bugun),
  };
}
