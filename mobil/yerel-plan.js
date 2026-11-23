// Mağaza uygulaması: telefonun kendi saatiyle uygulayacağı plan (saf; ağ yok).
// Uygulama açıkken vakitleri hesaplar (zaman.js, TV ile aynı kurallar) ve bu listeyi telefona verir.
// Telefon (Android/iOS eklentisi) uygulama kapalıyken de sırayla uygular:
//   - durum çubuğunda sıradaki vakte geri sayım (Android),
//   - namaz vakti bildirimleri (Web Push yerine telefonun kendi zamanlaması),
//   - namaz vaktinde sessize alma ve süre bitince eski hale döndürme (Android).
import { NAMAZ, SESLER, bildirimMetni } from './bildirim-metin.js';
import { amsParcalar, VAKITLER } from './zaman.js';

const pad = (n) => String(n).padStart(2, '0');
const saatYaz = (ms) => { const p = amsParcalar(ms); return `${pad(p.h)}:${pad(p.mi)}`; };

/** Plan en fazla bu kadar gün ileri gider (/api/vakit 32 gün verir; uygulama her açılışta planı yeniler). */
export const PLAN_GUN = 30;
/** Sessize alma süresi seçenekleri (dakika) */
export const SESSIZ_DK = [15, 20, 30, 45, 60];
export const SESSIZ_DK_VARSAYILAN = 30;
/** dakikalar: her namaz için ayrı süre (kullanıcı isteği, 19-11-2026) */
export const SESSIZ_VARSAYILAN = { aan: false, dakikalar: Object.fromEntries(NAMAZ.map((k) => [k, SESSIZ_DK_VARSAYILAN])), vakitler: [...NAMAZ], mod: 'sessiz' };
/** Ezan bitene kadar beklenen süre (sn; en uzun kayıt 30 sn). Sessize alma ezan bitince başlar, yoksa ezanı keser. */
export const EZAN_SN = 35;
/** Telefonun kendi bildirim sesi çalarken sessize alınmasın (kullanıcı: "ses çalmadan titreşime geçiyor", 23-11-2026). */
export const TELEFON_SES_SN = 15;
const ezanMi = (ses) => ses !== 'telefon' && SESLER.includes(ses);
/** O namazın sesi: sesler[vakit] (her namaz ayrı, 19-11-2026); eski kayıtlarda tek ses. */
export const namazSesi = (bildirim, k) => (bildirim.sesler && bildirim.sesler[k]) || bildirim.ses || 'telefon';
/** O vakitte kaç dakika önce hatırlatılır: onceDk[vakit] (her vakit ayrı, 19-11-2026); eski kayıtlarda tek "once". */
export const onceDakikasi = (bildirim, k) => (bildirim.onceDk && bildirim.onceDk[k]) || bildirim.once || 0;
/** O namazda sessiz kalma süresi (dk): dakikalar[vakit] (her namaz ayrı, 19-11-2026); eski kayıtlarda tek süre. */
export const sessizSuresi = (sessiz, k) => (sessiz.dakikalar && sessiz.dakikalar[k]) || sessiz.dakika || SESSIZ_DK_VARSAYILAN;

/**
 * @param {object} o
 * @param {Array<{ymd: string, hicri?: string, olaylar: Array<{key: string, ms: number, saat: string}>}>} o.gunler  bugünden itibaren
 * @param {{aan: boolean, once: number, onceDk?: object, giris: boolean, vakitler: string[], onceVakitler?: string[], sesler?: object, ses?: string}} o.bildirim
 *        onceDk: { Fajr: 15, Isha: 30, … } her vakit kaç dakika önce (19-11-2026); yoksa tek "once".
 *        vakitler: vakit girince bildirilenler; onceVakitler: önceden hatırlatılanlar (yoksa vakitler).
 *        sesler: { Fajr: 'ezan-6', Dhuhr: 'telefon', … } her namaz ayrı ('telefon' veya 'ezan-1' …; vakit girince, sadece beş vakit
 *        namazda; önceden hatırlatma ve İmsak/Güneş telefonun sesiyle). Eski kayıtlarda tek "ses".
 * @param {{aan: boolean, dakikalar?: object, dakika?: number, vakitler: string[], mod: 'sessiz'|'titresim'}} o.sessiz
 *        dakikalar: { Fajr: 30, Dhuhr: 15, … } her namaz ayrı; eski kayıtlarda tek "dakika".
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
      if (bildirim.aan) {
        // aynı vaktin bildirimleri aynı etiketle birbirinin yerini alır ("15 dk kala"nın yerine "vakit girdi")
        const ortak = { tarih: g.ymd, vakit: e.key, saat: e.saat };
        const etiket = `${g.ymd}-${e.key}`;
        const dk = onceDakikasi(bildirim, e.key);
        if (dk && (bildirim.onceVakitler || bildirim.vakitler).includes(e.key)) {
          const an = e.ms - dk * 60000;
          if (an > simdi) bildirimler.push({ an, etiket, ...bildirimMetni(dil, { ...ortak, tur: `once-${dk}` }) });
        }
        if (bildirim.giris && bildirim.vakitler.includes(e.key) && e.ms > simdi) {
          const ses = namazSesi(bildirim, e.key);
          const ezan = NAMAZ.includes(e.key) && ezanMi(ses);
          bildirimler.push({ an: e.ms, etiket, ...bildirimMetni(dil, { ...ortak, tur: 'giris' }), ...(ezan ? { ses } : {}) });
        }
      }
      if (sessiz.aan && NAMAZ.includes(e.key) && sessiz.vakitler.includes(e.key)) {
        // bu vakitte ezan okunacaksa telefon ezan bitince susar (kullanıcı isteği, 08-11-2026: önce ezan, sonra sessiz);
        // telefonun kendi sesiyse de önce ses çalar (23-11-2026: aynı anda sessize alınınca ses hiç çıkmıyordu)
        const sesli = bildirim.aan && bildirim.giris && bildirim.vakitler.includes(e.key);
        const ezanli = sesli && ezanMi(namazSesi(bildirim, e.key));
        const bas = e.ms + (ezanli ? EZAN_SN : sesli ? TELEFON_SES_SN : 0) * 1000;
        const bit = e.ms + sessizSuresi(sessiz, e.key) * 60000;
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
  // sessize alındı diye bildirim veya panel yazısı yok (kullanıcı isteği, 23-11-2026)
  const mod = sessiz.mod === 'titresim' ? 'titresim' : 'sessiz';
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
    kanallar: { vakit: t.kanalVakit, sayac: t.kanalSayac, tablo: t.kanalTablo, sessiz: t.kanalSessiz },
    sessizMod: mod,
    vakitler,
    bildirimler,
    sessiz: sessiz.aan ? sessizler : [],
  };
}
