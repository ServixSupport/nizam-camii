// Faaliyet ve program mantığı (saf modül; tarayıcıda ve testlerde aynen çalışır). MOBIL-APP-PLAN.md §4, §6.
import { amsZaman, amsParcalar, gunEkle } from './zaman.js';

const pad = (n) => String(n).padStart(2, '0');
const ALTI_SAAT = 6 * 3600e3;

/** Gösterilecek dil: ziyaretçinin dili → tr → dolu olan ilk dil. */
export function metinSec(obj, dil) {
  if (!obj || typeof obj !== 'object') return '';
  if (obj[dil]) return obj[dil];
  if (obj.tr) return obj.tr;
  for (const d of ['nl', 'en']) if (obj[d]) return obj[d];
  return '';
}

/** 'YYYY-MM-DDTHH:mm' (Amsterdam) → an */
export function yerelAn(s) {
  const [t, h] = s.split('T');
  const [y, m, d] = t.split('-').map(Number);
  const [hh, mm] = (h || '00:00').split(':').map(Number);
  return amsZaman(y, m, d, hh, mm);
}

export const faaliyetBaslangic = (f) => yerelAn(f.baslangic);

/** Faaliyetin bittiği an: bitiş; yoksa başlangıç + 6 saat; tüm gün ise son günün sonu. */
export function faaliyetBitis(f) {
  if (f.tumGun) {
    const son = (f.bitis || f.baslangic).slice(0, 10);
    return yerelAn(gunEkle(son, 1) + 'T00:00');
  }
  return f.bitis ? yerelAn(f.bitis) : yerelAn(f.baslangic) + ALTI_SAAT;
}

/** Uygulamada görünen faaliyetler: yayında ve bitmemiş, başlangıca göre sıralı. */
export function gorunurFaaliyetler(liste, simdi) {
  return (liste || [])
    .filter((f) => f && f.yayinda && faaliyetBitis(f) > simdi)
    .sort((a, b) => faaliyetBaslangic(a) - faaliyetBaslangic(b) || a.id.localeCompare(b.id));
}

/** Bir program o gün var mı? (aktif, haftanın günü, geçerlilik tarihleri) */
export function programGunde(p, ymd, haftaGunu) {
  if (!p || p.aktif === false || !p.gunler.includes(haftaGunu)) return false;
  if (p.gecerliBaslangic && ymd < p.gecerliBaslangic) return false;
  if (p.gecerliBitis && ymd > p.gecerliBitis) return false;
  return true;
}

const dk = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const saatYaz = (d) => `${pad(Math.floor((((d % 1440) + 1440) % 1440) / 60))}:${pad((((d % 1440) + 1440) % 1440) % 60)}`;

/**
 * Programın o günkü saati (dakika, Amsterdam duvar saati).
 * Vakte bağlıysa o günün vaktinden hesaplanır; veri yoksa bas/bit null.
 * @param {Array} olaylar  zaman.gunOlaylari(o gün) — boş olabilir
 */
export function programZamani(p, olaylar) {
  const s = p.saat;
  if (s.tip === 'sabit') return { bas: dk(s.baslangic), bit: dk(s.bitis), vakteBagli: false };
  const e = (olaylar || []).find((x) => x.key === s.vakit);
  if (!e) return { bas: null, bit: null, vakteBagli: true, vakit: s.vakit, fark: s.fark };
  const bas = dk(e.saat) + s.fark;
  return { bas, bit: bas + s.sure, vakteBagli: true, vakit: s.vakit, fark: s.fark };
}

/** Bir haftanın günleri (Pazartesi başlar): [{ ymd, hg }] */
export function haftaGunleri(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const hg = amsParcalar(amsZaman(y, m, d, 12, 0)).hg;
  const pzt = gunEkle(ymd, 1 - hg);
  return Array.from({ length: 7 }, (_, i) => ({ ymd: gunEkle(pzt, i), hg: i + 1 }));
}

/** Bir günün programları, saate göre sıralı: [{ p, zaman }] */
export function gununProgramlari(programlar, ymd, hg, olaylar) {
  return (programlar || [])
    .filter((p) => programGunde(p, ymd, hg))
    .map((p) => ({ p, zaman: programZamani(p, olaylar) }))
    .sort((a, b) => (a.zaman.bas ?? 9999) - (b.zaman.bas ?? 9999) || a.p.id.localeCompare(b.p.id));
}

// ---------------- takvim dosyası (.ics) ----------------
const icsMetin = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsUtc = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function icsKatla(satir) {                       // RFC 5545: satır en fazla 75 bayt
  const out = []; let s = satir;
  while (new TextEncoder().encode(s).length > 75) {
    let n = 74; while (new TextEncoder().encode(s.slice(0, n)).length > 74) n--;
    out.push(s.slice(0, n)); s = ' ' + s.slice(n);
  }
  out.push(s);
  return out.join('\r\n');
}

/** Bir faaliyet için takvim dosyası (tarayıcı kendisi üretir; sunucuya gitmez). */
export function icsOlustur(f, dil, simdi, adres = 'Ookmeerweg 206, Amsterdam') {
  const satirlar = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nizam Camii//Uygulama//TR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${f.id}@nizam-camii.vercel.app`, `DTSTAMP:${icsUtc(simdi)}`];
  if (f.tumGun) {
    const bas = f.baslangic.slice(0, 10);
    const son = gunEkle((f.bitis || f.baslangic).slice(0, 10), 1);
    satirlar.push(`DTSTART;VALUE=DATE:${bas.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${son.replace(/-/g, '')}`);
  } else {
    satirlar.push(`DTSTART:${icsUtc(faaliyetBaslangic(f))}`, `DTEND:${icsUtc(faaliyetBitis(f))}`);
  }
  satirlar.push(`SUMMARY:${icsMetin(metinSec(f.baslik, dil))}`);
  satirlar.push(`LOCATION:${icsMetin([f.yer, adres].filter(Boolean).join(', '))}`);
  const aciklama = metinSec(f.aciklama, dil);
  if (aciklama) satirlar.push(`DESCRIPTION:${icsMetin(aciklama)}`);
  if (f.link) satirlar.push(`URL:${f.link}`);
  satirlar.push('END:VEVENT', 'END:VCALENDAR');
  return satirlar.map(icsKatla).join('\r\n') + '\r\n';
}
