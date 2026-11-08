// Mağaza uygulaması: telefonun kendi saatiyle uygulayacağı plan (saf; ağ yok).
// Uygulama açıkken vakitleri hesaplar (zaman.js, TV ile aynı kurallar) ve bu listeyi telefona verir.
// Telefon (Android/iOS eklentisi) uygulama kapalıyken de sırayla uygular:
//   - durum çubuğunda sıradaki vakte geri sayım (Android),
//   - namaz vakti bildirimleri (Web Push yerine telefonun kendi zamanlaması),
//   - namaz vaktinde sessize alma ve süre bitince eski hale döndürme (Android).
import { NAMAZ, bildirimMetni } from './bildirim-metin.js';
import { amsParcalar, VAKITLER } from './zaman.js';

const pad = (n) => String(n).padStart(2, '0');
const saatYaz = (ms) => { const p = amsParcalar(ms); return `${pad(p.h)}:${pad(p.mi)}`; };

/** Plan en fazla bu kadar gün ileri gider (/api/vakit 32 gün verir; uygulama her açılışta planı yeniler). */
export const PLAN_GUN = 30;
/** Sessize alma süresi seçenekleri (dakika) */
export const SESSIZ_DK = [15, 20, 30, 45, 60];
export const SESSIZ_VARSAYILAN = { aan: false, dakika: 30, vakitler: [...NAMAZ], mod: 'sessiz' };
/** Ezanın süresi (sn; res/raw/ezan_kisa 17,6 sn, ezan_uzun 2:34). Sessize alma ezan bitince başlar, yoksa ezanı keser. */
export const EZAN_SN = { 'ezan-kisa': 20, 'ezan-uzun': 160 };

/**
 * @param {object} o
 * @param {Array<{ymd: string, hicri?: string, olaylar: Array<{key: string, ms: number, saat: string}>}>} o.gunler  bugünden itibaren
 * @param {{aan: boolean, once: number, giris: boolean, vakitler: string[], ses?: 'telefon'|'ezan-kisa'|'ezan-uzun'}} o.bildirim
 *        ses: vakit girince (sadece beş vakit namazda; önceden hatırlatma ve İmsak/Güneş telefonun sesiyle)
 * @param {{aan: boolean, dakika: number, vakitler: string[], mod: 'sessiz'|'titresim'}} o.sessiz
 * @param {boolean} o.sayac   durum çubuğunda geri sayım
 * @param {'tr'|'nl'|'en'} o.dil
 * @param {object} o.t        METIN[dil]
 * @param {number} o.simdi
 */
export function yerelPlan({ gunler, bildirim, sessiz, sayac, dil, t, simdi }) {
  const vakitler = [];
  const bildirimler = [];
  const pencereler = [];
  for (const g of gunler) {
    for (const e of g.olaylar) {
      if (e.ms > simdi) vakitler.push({ an: e.ms, vakit: e.key, baslik: `${t.names[e.key]} · ${e.saat}` });
      if (bildirim.aan && bildirim.vakitler.includes(e.key)) {
        // aynı vaktin bildirimleri aynı etiketle birbirinin yerini alır ("15 dk kala"nın yerine "vakit girdi")
        const ortak = { tarih: g.ymd, vakit: e.key, saat: e.saat };
        const etiket = `${g.ymd}-${e.key}`;
        if (bildirim.once) {
          const an = e.ms - bildirim.once * 60000;
          if (an > simdi) bildirimler.push({ an, etiket, ...bildirimMetni(dil, { ...ortak, tur: `once-${bildirim.once}` }) });
        }
        if (bildirim.giris && e.ms > simdi) {
          const ezan = NAMAZ.includes(e.key) && (bildirim.ses === 'ezan-kisa' || bildirim.ses === 'ezan-uzun');
          bildirimler.push({ an: e.ms, etiket, ...bildirimMetni(dil, { ...ortak, tur: 'giris' }), ...(ezan ? { ses: bildirim.ses } : {}) });
        }
      }
      if (sessiz.aan && NAMAZ.includes(e.key) && sessiz.vakitler.includes(e.key)) {
        // bu vakitte ezan okunacaksa telefon ezan bitince susar (kullanıcı isteği, 08-11-2026: önce ezan, sonra sessiz)
        const ezanli = bildirim.aan && bildirim.giris && bildirim.vakitler.includes(e.key) && EZAN_SN[bildirim.ses];
        const bas = e.ms + (ezanli ? EZAN_SN[bildirim.ses] * 1000 : 0);
        const bit = e.ms + sessiz.dakika * 60000;
        if (bit > simdi) pencereler.push({ bas, bit });
      }
    }
  }
  vakitler.sort((a, b) => a.an - b.an);
  bildirimler.sort((a, b) => a.an - b.an);
  pencereler.sort((a, b) => a.bas - b.bas);
  // iç içe geçen sessiz pencereleri birleştir (telefon tek bir "sessiz" dönemi bilir)
  const sessizler = [];
  for (const p of pencereler) {
    const son = sessizler[sessizler.length - 1];
    if (son && p.bas <= son.bit) son.bit = Math.max(son.bit, p.bit);
    else sessizler.push({ ...p });
  }
  // sessizken bildirim çubuğunda duran not: neden sessiz ve ne zaman eski haline döner
  const mod = sessiz.mod === 'titresim' ? 'titresim' : 'sessiz';
  for (const p of sessizler) Object.assign(p, { baslik: t.sessizBaslik[mod], govde: t.sessizGovde(saatYaz(p.bit)), kisa: t.sessizKisa(saatYaz(p.bit)) });
  return {
    surum: 1,
    dil,
    sayac: !!sayac,
    sayacAlt: t.sayacAlt,
    // Android bildirim panelindeki vakit tablosu (görsel: kullanıcının örneği, 07-11-2026)
    gunler: gunler.map((g) => ({
      ymd: g.ymd,
      hicri: g.hicri || '',
      vakitler: g.olaylar.map((e) => ({ vakit: e.key, ad: (t.kisaAd && t.kisaAd[e.key]) || t.names[e.key], saat: e.saat, an: e.ms })),
    })),
    kalanKisa: Object.fromEntries(VAKITLER.map((k) => [k, t.kalanKisa(k)])),
    kanallar: { vakit: t.kanalVakit, sayac: t.kanalSayac, sessiz: t.kanalSessiz, ezanKisa: t.kanalEzanKisa, ezanUzun: t.kanalEzanUzun },
    sessizMod: mod,
    sessizBasliklar: t.sessizBaslik,                         // telefon izin yoksa sessiz yerine titreşime alır
    vakitler,
    bildirimler,
    sessiz: sessiz.aan ? sessizler : [],
  };
}
