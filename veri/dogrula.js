// İçerik (faaliyetler + programlar) doğrulama ve temizleme. Düz ES modülü:
// api/admin/kaydet.js, /admin paneli ve testler aynı dosyayı kullanır (MOBIL-APP-PLAN.md §4).
// Mesajlar Türkçe: panelde yöneticiye gösterilir.

export const GRUPLAR = ['herkes', 'erkekler', 'hanimlar', 'genclik', 'cocuklar'];
export const DILLER = ['tr', 'nl', 'en'];
export const VAKTE_BAGLI = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
export const SINIR = { baslik: 100, aciklama: 2000, yer: 120, hoca: 80, link: 500, faaliyet: 300, program: 150 };

const TARIH = /^\d{4}-\d{2}-\d{2}$/;
const TARIH_SAAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const SAAT = /^\d{2}:\d{2}$/;
const KONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;     // satır sonu ve sekme kalır

const temizMetin = (v) => (typeof v === 'string' ? v.replace(KONTROL, '').replace(/\r\n?/g, '\n').trim() : '');

function gecerliTarih(s) {
  if (!TARIH.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d && y >= 2020 && y <= 2100;
}
function gecerliSaat(s) {
  if (!SAAT.test(s)) return false;
  const [h, m] = s.split(':').map(Number);
  return h <= 23 && m <= 59;
}
const gecerliTarihSaat = (s) => TARIH_SAAT.test(s) && gecerliTarih(s.slice(0, 10)) && gecerliSaat(s.slice(11));

function httpsAdres(s) {
  try { const u = new URL(s); return u.protocol === 'https:' && !!u.hostname; } catch { return false; }
}

/**
 * @param {unknown} girdi  panelden gelen içerik
 * @param {object} [o]
 * @param {(url: string) => boolean} [o.resimIzinli]  resim adresi bu depoya mı ait?
 * @returns {{ gecerli: boolean, hatalar: {yol: string, mesaj: string}[], icerik: object }}
 */
export function dogrula(girdi, o = {}) {
  const hatalar = [];
  const hata = (yol, mesaj) => hatalar.push({ yol, mesaj });
  const resimIzinli = o.resimIzinli || ((u) => /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(u));
  const g = girdi && typeof girdi === 'object' ? girdi : {};

  const metinler = (v, yol, sinir, zorunlu) => {
    const out = {};
    for (const d of DILLER) {
      out[d] = temizMetin(v && v[d]);
      if (out[d].length > sinir) hata(`${yol}.${d}`, `En fazla ${sinir} karakter olabilir (${d.toUpperCase()}).`);
    }
    if (zorunlu && !DILLER.some((d) => out[d])) hata(yol, 'En az bir dilde başlık yazın.');
    return out;
  };
  const kisa = (v, yol, sinir) => {
    const s = temizMetin(v).replace(/\s*\n\s*/g, ' ');
    if (s.length > sinir) hata(yol, `En fazla ${sinir} karakter olabilir.`);
    return s;
  };
  const grup = (v, yol) => {
    if (!GRUPLAR.includes(v)) { hata(yol, 'Geçerli bir grup seçin.'); return 'herkes'; }
    return v;
  };

  // ---------- faaliyetler ----------
  const faaliyetler = [];
  const fIdler = new Set();
  const fGirdi = Array.isArray(g.faaliyetler) ? g.faaliyetler : [];
  if (!Array.isArray(g.faaliyetler) && g.faaliyetler !== undefined) hata('faaliyetler', 'Liste olmalı.');
  if (fGirdi.length > SINIR.faaliyet) hata('faaliyetler', `En fazla ${SINIR.faaliyet} faaliyet olabilir.`);
  fGirdi.slice(0, SINIR.faaliyet).forEach((f, i) => {
    const yol = `faaliyetler[${i}]`;
    f = f && typeof f === 'object' ? f : {};
    const id = String(f.id || '');
    if (!/^f-[a-z0-9]{4,12}$/.test(id)) hata(`${yol}.id`, 'Geçersiz kimlik.');
    else if (fIdler.has(id)) hata(`${yol}.id`, 'Bu kimlik iki kez kullanılmış.');
    fIdler.add(id);

    const tumGun = f.tumGun === true;
    const baslangic = String(f.baslangic || '');
    if (!gecerliTarihSaat(baslangic)) hata(`${yol}.baslangic`, 'Geçerli bir tarih ve saat girin.');
    let bitis = f.bitis ? String(f.bitis) : null;
    if (bitis !== null) {
      if (!gecerliTarihSaat(bitis)) hata(`${yol}.bitis`, 'Bitiş tarihi/saati geçersiz.');
      else if (gecerliTarihSaat(baslangic) && bitis < baslangic) hata(`${yol}.bitis`, 'Bitiş, başlangıçtan önce olamaz.');
    }
    const resim = temizMetin(f.resim);
    if (resim && !(httpsAdres(resim) && resimIzinli(resim))) hata(`${yol}.resim`, 'Resim bu panelden yüklenmelidir.');
    const link = temizMetin(f.link);
    if (link && !httpsAdres(link)) hata(`${yol}.link`, 'Link https:// ile başlamalı.');
    if (link.length > SINIR.link) hata(`${yol}.link`, `Link en fazla ${SINIR.link} karakter olabilir.`);

    faaliyetler.push({
      id,
      grup: grup(f.grup, `${yol}.grup`),
      baslik: metinler(f.baslik, `${yol}.baslik`, SINIR.baslik, true),
      aciklama: metinler(f.aciklama, `${yol}.aciklama`, SINIR.aciklama, false),
      baslangic: tumGun && gecerliTarihSaat(baslangic) ? baslangic.slice(0, 10) + 'T00:00' : baslangic,
      bitis: tumGun && bitis && gecerliTarihSaat(bitis) ? bitis.slice(0, 10) + 'T00:00' : bitis,
      tumGun,
      yer: kisa(f.yer, `${yol}.yer`, SINIR.yer),
      resim,
      link,
      oneCikan: f.oneCikan === true,
      yayinda: f.yayinda === true,
    });
  });

  // ---------- programlar ----------
  const programlar = [];
  const pIdler = new Set();
  const pGirdi = Array.isArray(g.programlar) ? g.programlar : [];
  if (!Array.isArray(g.programlar) && g.programlar !== undefined) hata('programlar', 'Liste olmalı.');
  if (pGirdi.length > SINIR.program) hata('programlar', `En fazla ${SINIR.program} program olabilir.`);
  pGirdi.slice(0, SINIR.program).forEach((p, i) => {
    const yol = `programlar[${i}]`;
    p = p && typeof p === 'object' ? p : {};
    const id = String(p.id || '');
    if (!/^p-[a-z0-9]{4,12}$/.test(id)) hata(`${yol}.id`, 'Geçersiz kimlik.');
    else if (pIdler.has(id)) hata(`${yol}.id`, 'Bu kimlik iki kez kullanılmış.');
    pIdler.add(id);

    const gunler = [...new Set(Array.isArray(p.gunler) ? p.gunler : [])].filter((x) => Number.isInteger(x)).sort((a, b) => a - b);
    if (!gunler.length || gunler.some((x) => x < 1 || x > 7)) hata(`${yol}.gunler`, 'En az bir gün seçin.');

    const s = p.saat && typeof p.saat === 'object' ? p.saat : {};
    let saat;
    if (s.tip === 'sabit') {
      saat = { tip: 'sabit', baslangic: String(s.baslangic || ''), bitis: String(s.bitis || '') };
      if (!gecerliSaat(saat.baslangic)) hata(`${yol}.saat.baslangic`, 'Başlangıç saati geçersiz.');
      if (!gecerliSaat(saat.bitis)) hata(`${yol}.saat.bitis`, 'Bitiş saati geçersiz.');
      else if (gecerliSaat(saat.baslangic) && saat.bitis <= saat.baslangic) hata(`${yol}.saat.bitis`, 'Bitiş, başlangıçtan sonra olmalı.');
    } else if (s.tip === 'vakit') {
      saat = { tip: 'vakit', vakit: s.vakit, fark: Number(s.fark), sure: Number(s.sure) };
      if (!VAKTE_BAGLI.includes(saat.vakit)) hata(`${yol}.saat.vakit`, 'Bir namaz vakti seçin.');
      if (!Number.isInteger(saat.fark) || saat.fark < 0 || saat.fark > 240) hata(`${yol}.saat.fark`, 'Vakitten sonra 0–240 dakika olabilir.');
      if (!Number.isInteger(saat.sure) || saat.sure < 10 || saat.sure > 600) hata(`${yol}.saat.sure`, 'Süre 10–600 dakika olabilir.');
    } else {
      hata(`${yol}.saat`, 'Saat türünü seçin: sabit saat veya vakte bağlı.');
      saat = { tip: 'sabit', baslangic: '', bitis: '' };
    }

    const gb = p.gecerliBaslangic ? String(p.gecerliBaslangic) : null;
    const gs = p.gecerliBitis ? String(p.gecerliBitis) : null;
    if (gb && !gecerliTarih(gb)) hata(`${yol}.gecerliBaslangic`, 'Tarih geçersiz.');
    if (gs && !gecerliTarih(gs)) hata(`${yol}.gecerliBitis`, 'Tarih geçersiz.');
    if (gb && gs && gecerliTarih(gb) && gecerliTarih(gs) && gs < gb) hata(`${yol}.gecerliBitis`, 'Bitiş tarihi başlangıçtan önce olamaz.');

    programlar.push({
      id,
      grup: grup(p.grup, `${yol}.grup`),
      baslik: metinler(p.baslik, `${yol}.baslik`, SINIR.baslik, true),
      aciklama: metinler(p.aciklama, `${yol}.aciklama`, SINIR.aciklama, false),
      gunler,
      saat,
      yer: kisa(p.yer, `${yol}.yer`, SINIR.yer),
      hoca: kisa(p.hoca, `${yol}.hoca`, SINIR.hoca),
      gecerliBaslangic: gb,
      gecerliBitis: gs,
      aktif: p.aktif !== false,
    });
  });

  return {
    gecerli: hatalar.length === 0,
    hatalar,
    icerik: { guncelleme: typeof g.guncelleme === 'string' ? g.guncelleme : null, faaliyetler, programlar },
  };
}

/** İçerikteki bütün resim adresleri (silinecek resimleri bulmak için). */
export function resimler(icerik) {
  return new Set(((icerik && icerik.faaliyetler) || []).map((f) => f.resim).filter(Boolean));
}

export const BOS_ICERIK = Object.freeze({ guncelleme: null, faaliyetler: [], programlar: [] });
