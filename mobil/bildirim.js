// Faz D: namaz vakti bildirimleri — cihaz başına ayar + Web Push aboneliği.
// - İzin SADECE kullanıcı dokununca istenir (sayfa açılınca asla).
// - Sunucu hazır değilse (/api/bildirim/anahtar → aktif: false) ayar bölümü ve ziller hiç görünmez.
// - Ayarlar cihazda (nzm.bildirim). Bildirimler açıksa aynısı sunucuda (/api/bildirim/abone).
// - Kapatınca abonelik sunucudan da silinir.
// - Mağaza uygulamasında (yerel) sunucu ve Web Push yok: bildirimleri telefon kendisi kurar (yerel-plan.js),
//   ayar değişince app.js planı telefona yeniden gönderir (planDegisti).
import { VAKITLER } from './zaman.js';
import { DENEME } from './bildirim-metin.js';

const DEPO = 'nzm.bildirim';
const ONCE = [0, 5, 10, 15, 30];
/** Vakit girince ses (kullanıcı isteği, 08-11-2026; sadece Android mağaza uygulaması). Ezan sadece beş vakit namazda çalar.
 *  Tarayıcı bildirimlerinde (Web Push) ses seçilemez; iPhone'da bildirim sesi en fazla 30 sn. */
export const SESLER = ['telefon', 'ezan-kisa', 'ezan-uzun'];
const VARSAYILAN = {
  aan: false, once: 15, giris: true, vakitler: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'],   // tasarımdaki başlangıç
  ses: 'telefon',
  endpoint: '', esitleme: 0, sunucu: null,
};
const GUN = 24 * 60 * 60 * 1000;

const ZIL = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';
const ZIL_KAPALI = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/><path d="M3 3l18 18"/></svg>';
const TIK = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function oku() {
  try {
    const v = JSON.parse(localStorage.getItem(DEPO) || 'null');
    if (!v || typeof v !== 'object') return { ...VARSAYILAN };
    const a = { ...VARSAYILAN, ...v };
    if (!ONCE.includes(a.once)) a.once = VARSAYILAN.once;
    a.vakitler = VAKITLER.filter((k) => Array.isArray(a.vakitler) && a.vakitler.includes(k));
    a.giris = a.giris !== false;
    if (!SESLER.includes(a.ses)) a.ses = VARSAYILAN.ses;
    return a;
  } catch { return { ...VARSAYILAN }; }
}
function sakla(a) { try { localStorage.setItem(DEPO, JSON.stringify(a)); } catch { /* dolu veya kapalı */ } }

function b64(s) {
  const r = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(r, (c) => c.charCodeAt(0));
}
function ayniAnahtar(a, b) {
  if (!a || !b || a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a);
  return x.every((v, i) => v === b[i]);
}

/**
 * @param {object} o
 * @param {Function} o.L        geçerli dilin metinleri
 * @param {Function} o.dil      'tr' | 'nl' | 'en'
 * @param {Function} o.bildir   kısa mesaj (alt çubuk)
 * @param {Function} o.kuruluMu ana ekrandan mı açıldı
 * @param {Function} o.iosMu
 * @param {object} [o.yerel]       mağaza uygulamasında telefon eklentisi (yerel.js), tarayıcıda yok
 * @param {Function} [o.planDegisti]
 * @param {boolean} [o.sesSecimi]  vakit girince ses seçimi (Android mağaza uygulaması)
 */
export function bildirimler({ L, dil, bildir, kuruluMu, iosMu, yerel = null, planDegisti = () => {}, sesSecimi = false }) {
  let ayar = oku();
  let sunucu = yerel ? { aktif: true, publicKey: null }                                                   // sunucusuz
    : ayar.sunucu && ayar.sunucu.aktif ? ayar.sunucu : { aktif: false, publicKey: null };   // internetsizken son bilinen
  let mesaj = '';
  let mesgul = false;
  let _zaman = 0;
  let kuruldu = false;

  const destek = () => (yerel ? 'tamam' : 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window ? 'tamam'
    : iosMu() && !kuruluMu() ? 'ios' : 'yok');
  const yaz = (parca) => { ayar = { ...ayar, ...parca }; sakla(ayar); };
  const ses = () => (sesSecimi ? ayar.ses : 'telefon');

  // service worker hazır değilse sonsuza kadar beklemesin (10 sn sonra hata mesajı)
  function hazirKayit() {
    return Promise.race([navigator.serviceWorker.ready,
      new Promise((_, ret) => setTimeout(() => ret(new Error('service worker hazır değil')), 10000))]);
  }

  async function abonelik(olustur) {
    const reg = await hazirKayit();
    let sub = await reg.pushManager.getSubscription();
    const anahtar = b64(sunucu.publicKey);
    // sunucunun anahtarı değiştiyse eski abonelik işe yaramaz
    if (sub && sub.options && sub.options.applicationServerKey && !ayniAnahtar(sub.options.applicationServerKey, anahtar)) {
      await sub.unsubscribe();
      sub = null;
    }
    if (!sub && olustur) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: anahtar });
    return sub;
  }

  async function kaydet(sub) {
    const r = await fetch('/api/bildirim/abone', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ abonelik: sub.toJSON(), dil: dil(), vakitler: ayar.vakitler, once: ayar.once, giris: ayar.giris }),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    yaz({ endpoint: sub.endpoint, esitleme: Date.now() });
  }

  async function esitle() {
    if (!ayar.aan) return;
    try {
      const sub = await abonelik(false);
      if (!sub) throw new Error('abonelik yok');
      await kaydet(sub);
      mesaj = '';
    } catch {
      mesaj = 'notifError';
    }
    ciz();
  }
  const esitleSonra = () => { clearTimeout(_zaman); _zaman = setTimeout(esitle, 500); };

  async function yerelAc() {
    mesgul = true;
    ciz();
    try {
      const r = await yerel.bildirimIzniIste();
      if (!r || r.bildirim !== 'granted') { mesaj = 'notifDenied'; return; }
      yaz({ aan: true });
      mesaj = '';
      planDegisti();
      bildir(L().notifOnToast);
    } catch {
      mesaj = 'notifError';
    } finally {
      mesgul = false;
      ciz();
    }
  }

  async function ac() {
    if (mesgul) return;
    if (yerel) return yerelAc();
    const d = destek();
    if (d !== 'tamam') { mesaj = d === 'ios' ? 'notifIos' : 'notifUnsupported'; ciz(); return; }
    mesgul = true;
    ciz();
    try {
      // izin penceresi dokunmanın içinde açılmalı: ilk await bu (Safari sonra açmaz)
      const izin = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (izin !== 'granted') { mesaj = 'notifDenied'; return; }
      await kaydet(await abonelik(true));
      yaz({ aan: true });
      mesaj = '';
      bildir(L().notifOnToast);
    } catch {
      mesaj = 'notifError';
    } finally {
      mesgul = false;
      ciz();
    }
  }

  async function kapat() {
    if (mesgul) return;
    if (yerel) {
      yaz({ aan: false });
      mesaj = '';
      planDegisti();
      ciz();
      bildir(L().notifOffToast);
      return;
    }
    mesgul = true;
    yaz({ aan: false, endpoint: '', esitleme: 0 });
    mesaj = '';
    ciz();
    try {
      const reg = await hazirKayit();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const j = sub.toJSON();
        await fetch('/api/bildirim/abone', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: j.endpoint, auth: j.keys && j.keys.auth }),
        }).catch(() => {});        // silinemezse: sunucu ilk gönderimde 410 alır ve kendisi siler
        await sub.unsubscribe();
      }
    } catch { /* abonelik zaten yok */ }
    mesgul = false;
    ciz();
    bildir(L().notifOffToast);
  }

  /** Deneme bildirimi: 1 dk sonra gerçek yoldan (QStash) bir bildirim. */
  let denemeMesgul = false;
  async function deneme() {
    if (denemeMesgul || !ayar.aan) return;
    denemeMesgul = true;
    ciz();
    const t = L();
    try {
      if (yerel) {
        // deneme bildirimi seçilen sesle gelir (ezanı dinlemek için de)
        await yerel.deneme({ ...(DENEME[dil()] || DENEME.nl), ses: ses() });
        bildir(t.notifTestSentYerel);
        return;
      }
      const sub = await abonelik(false);
      if (!sub) throw new Error('abonelik yok');
      const j = sub.toJSON();
      const r = await fetch('/api/bildirim/deneme', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: j.endpoint, auth: j.keys && j.keys.auth }),
      });
      if (r.status === 429) bildir(t.notifTestWait);
      else if (r.ok) bildir(t.notifTestSent);
      else throw new Error('HTTP ' + r.status);
    } catch {
      bildir(t.notifError);
    } finally {
      denemeMesgul = false;
      ciz();
    }
  }

  function ayarla(parca) {
    yaz(parca);
    ciz();
    if (ayar.aan) { if (yerel) planDegisti(); else esitleSonra(); }
  }

  /** Ana ekrandaki zil: o vaktin bildirimini aç/kapat. Bildirimler kapalıysa açar (izin penceresi). */
  function zil(key) {
    if (!sunucu.aktif || mesgul) return;
    const t = L();
    const vardi = ayar.vakitler.includes(key);
    if (ayar.aan) {
      ayarla({ vakitler: vardi ? ayar.vakitler.filter((k) => k !== key) : VAKITLER.filter((k) => k === key || ayar.vakitler.includes(k)) });
      bildir((vardi ? t.zilKapali : t.zilAcik)(t.names[key]));
      return;
    }
    yaz({ vakitler: VAKITLER.filter((k) => k === key || ayar.vakitler.includes(k)) });
    if (destek() !== 'tamam') {
      mesaj = destek() === 'ios' ? 'notifIos' : 'notifUnsupported';
      location.hash = '#ayarlar';
      ciz();
      return;
    }
    ac();
  }

  async function hazirla() {
    if (yerel) {
      // izin telefonun ayarlarından geri alındıysa: kapalı göster
      try {
        const r = await yerel.izinDurumu();
        if (ayar.aan && r && r.bildirim !== 'granted') { yaz({ aan: false }); planDegisti(); }
      } catch { /* */ }
      ciz();
      return;
    }
    try {
      const r = await fetch('/api/bildirim/anahtar');
      const j = r.ok ? await r.json() : null;
      sunucu = j && j.aktif && typeof j.publicKey === 'string' ? { aktif: true, publicKey: j.publicKey } : { aktif: false, publicKey: null };
      yaz({ sunucu });
    } catch { /* internet yok: son bilinen durumla devam */ }
    if (sunucu.aktif && ayar.aan) {
      // izin geri alındıysa veya abonelik kaybolduysa: kapalı göster
      let sub = null;
      try {
        if (destek() === 'tamam' && Notification.permission === 'granted') sub = await abonelik(false);
      } catch { sub = null; }
      if (!sub) yaz({ aan: false });
      else if (sub.endpoint !== ayar.endpoint || Date.now() - ayar.esitleme > GUN) await kaydet(sub).catch(() => {});
    }
    ciz();
  }

  // ---------------- çizim ----------------
  const $ = (s) => document.querySelector(s);

  function kur() {
    if (kuruldu) return;
    kuruldu = true;
    $('#b-ana').addEventListener('click', () => (ayar.aan ? kapat() : ac()));
    $('#b-giris').addEventListener('click', () => ayarla({ giris: !ayar.giris }));
    $('#b-deneme').addEventListener('click', deneme);
    $('#b-once').replaceChildren(...ONCE.map((n) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.once = String(n);
      b.addEventListener('click', () => ayarla({ once: n }));
      return b;
    }));
    $('#b-ses').replaceChildren(...SESLER.map((s) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.ses = s;
      b.addEventListener('click', () => ayarla({ ses: s }));
      return b;
    }));
    $('#b-vakitler').replaceChildren(...VAKITLER.map((k) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.key = k;
      b.addEventListener('click', () => ayarla({ vakitler: ayar.vakitler.includes(k) ? ayar.vakitler.filter((x) => x !== k) : VAKITLER.filter((x) => x === k || ayar.vakitler.includes(x)) }));
      return b;
    }));
  }

  function ciz() {
    const bolum = $('#bildirim-ayar');
    zilleriCiz();
    if (!bolum) return;
    bolum.hidden = !sunucu.aktif;
    if (!sunucu.aktif) return;
    kur();
    const t = L();
    const ana = $('#b-ana');
    ana.setAttribute('aria-checked', String(ayar.aan));
    ana.setAttribute('aria-busy', String(mesgul));
    $('#b-giris').setAttribute('aria-checked', String(ayar.giris));
    $('#b-secenekler').classList.toggle('soluk', !ayar.aan);
    for (const b of $('#b-once').children) {
      const n = +b.dataset.once;
      b.textContent = n ? `${n} ${t.notifMin}` : t.notifOff;
      b.setAttribute('aria-pressed', String(n === ayar.once));
    }
    $('#b-ses-satir').hidden = !sesSecimi;
    for (const b of $('#b-ses').children) {
      b.textContent = t.notifSesAd[b.dataset.ses];
      b.setAttribute('aria-pressed', String(b.dataset.ses === ayar.ses));
    }
    for (const b of $('#b-vakitler').children) {
      const on = ayar.vakitler.includes(b.dataset.key);
      b.innerHTML = on ? TIK : '';
      b.append(t.names[b.dataset.key]);
      b.setAttribute('aria-pressed', String(on));
    }
    const m = $('#b-mesaj');
    const yazi = mesgul ? t.notifBusy : mesaj ? t[mesaj] : '';
    m.hidden = !yazi;
    m.classList.toggle('bilgi', mesgul);
    m.textContent = yazi;
    $('#b-deneme-satir').hidden = !ayar.aan;
    $('#b-deneme').disabled = denemeMesgul;
  }

  function zilleriCiz() {
    const t = L();
    document.documentElement.classList.toggle('zilli', sunucu.aktif);   // dar tablet kartlarında yer açılır (app.css)
    for (const b of document.querySelectorAll('.vakitler .v-zil')) {
      const key = b.closest('li').dataset.key;
      b.hidden = !sunucu.aktif;
      if (!sunucu.aktif) continue;
      const on = ayar.aan && ayar.vakitler.includes(key);
      if (b.dataset.on !== String(on)) { b.innerHTML = on ? ZIL : ZIL_KAPALI; b.dataset.on = String(on); }
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', (on ? t.zilAcik : t.zilKapali)(t.names[key]));
    }
  }

  return {
    hazirla, ciz, zil,
    /** dil değişti: açıksa bildirimler yeni dilde gelsin */
    dilDegisti() { ciz(); if (ayar.aan) { if (yerel) planDegisti(); else esitleSonra(); } },
    /** plana giden ayarlar (mağaza uygulaması) */
    ayar: () => ({ aan: ayar.aan, once: ayar.once, giris: ayar.giris, vakitler: [...ayar.vakitler], ses: ses() }),
  };
}
