// Mağaza uygulaması ayarları (06-11-2026): durum çubuğunda geri sayım (Android), namaz vaktinde sessize alma
// (Android; iPhone buna izin vermez), kilit ekranı widget'ı (iPhone, sadece açıklama).
// Tarayıcıda (web uygulaması) bu bölümler hiç görünmez; app.js bu modülü sadece mağaza uygulamasında kurar.
import { NAMAZ } from './bildirim-metin.js';
import { SESSIZ_DK, SESSIZ_VARSAYILAN } from './yerel-plan.js';

const DEPO_SAYAC = 'nzm.sayac';            // 'acik' | 'kapali' (ilk açılışta açık)
const DEPO_SORULDU = 'nzm.sayacSoruldu';   // bildirim izni ilk açılışta bir kez sorulur
const DEPO_SESSIZ = 'nzm.sessiz';

const TIK = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

const oku = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const yaz = (k, v) => { try { localStorage.setItem(k, v); } catch { /* dolu veya kapalı */ } };

function sessizOku() {
  try {
    const v = JSON.parse(oku(DEPO_SESSIZ) || 'null');
    if (!v || typeof v !== 'object') return { ...SESSIZ_VARSAYILAN };
    return {
      aan: v.aan === true,
      dakika: SESSIZ_DK.includes(v.dakika) ? v.dakika : SESSIZ_VARSAYILAN.dakika,
      vakitler: NAMAZ.filter((k) => Array.isArray(v.vakitler) && v.vakitler.includes(k)),
      mod: v.mod === 'titresim' ? 'titresim' : 'sessiz',
    };
  } catch { return { ...SESSIZ_VARSAYILAN }; }
}

/**
 * @param {object} o
 * @param {Function} o.L             geçerli dilin metinleri
 * @param {object} o.cami            telefon eklentisi (yerel.js)
 * @param {'android'|'ios'} o.platform
 * @param {Function} o.planDegisti   plan telefona yeniden gönderilsin
 * @param {Function} o.bildirimAcik  namaz vakti bildirimleri açık mı
 */
export function yerelAyarlar({ L, cami, platform, planDegisti, bildirimAcik }) {
  const android = platform === 'android';
  let sayac = android && oku(DEPO_SAYAC) !== 'kapali';
  let sessiz = sessizOku();
  // telefona sorulana kadar iyimser: ilk çizimde gereksiz uyarı çıkmasın
  let izin = { bildirim: 'prompt', tamAlarm: true, sessiz: true };
  let sayacMesaj = '';
  let kuruldu = false;

  const sayacEtkin = () => sayac && izin.bildirim === 'granted';
  const sessizYaz = (parca) => { sessiz = { ...sessiz, ...parca }; yaz(DEPO_SESSIZ, JSON.stringify(sessiz)); ciz(); planDegisti(); };

  async function izinYenile() {
    try { izin = { ...izin, ...(await cami.izinDurumu()) }; } catch { /* eski uygulama sürümü */ }
    ciz();
  }

  async function bildirimIzni() {
    try { izin = { ...izin, ...(await cami.bildirimIzniIste()) }; } catch { /* */ }
    return izin.bildirim === 'granted';
  }

  async function hazirla() {
    await izinYenile();
    // ilk açılış: geri sayım açık ve izin hiç sorulmadı → bir kez sor (Android 13+ sistem penceresi)
    if (android && sayac && izin.bildirim !== 'granted' && !oku(DEPO_SORULDU)) {
      yaz(DEPO_SORULDU, '1');
      await bildirimIzni();
    }
    ciz();
    planDegisti();
  }

  async function sayacDegistir() {
    if (sayacEtkin()) {
      sayac = false;
    } else {
      if (!(await bildirimIzni())) { sayacMesaj = 'notifDenied'; ciz(); return; }
      sayac = true;
    }
    sayacMesaj = '';
    yaz(DEPO_SAYAC, sayac ? 'acik' : 'kapali');
    ciz();
    planDegisti();
  }

  // ---------------- çizim ----------------
  const $ = (s) => document.querySelector(s);

  function secenekler(kap, liste, tik) {
    kap.replaceChildren(...liste.map((deger) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.deger = String(deger);
      b.addEventListener('click', () => tik(deger));
      return b;
    }));
  }

  function kur() {
    if (kuruldu) return;
    kuruldu = true;
    $('#sayac-anahtar').addEventListener('click', sayacDegistir);
    $('#sessiz-anahtar').addEventListener('click', () => sessizYaz({ aan: !sessiz.aan }));
    $('#sessiz-izin').addEventListener('click', () => cami.sessizIzniAc().catch(() => {}));
    $('#tam-alarm-dugme').addEventListener('click', () => cami.tamAlarmIzniAc().catch(() => {}));
    secenekler($('#sessiz-sure'), SESSIZ_DK, (n) => sessizYaz({ dakika: n }));
    secenekler($('#sessiz-mod'), ['sessiz', 'titresim'], (m) => sessizYaz({ mod: m }));
    secenekler($('#sessiz-vakitler'), NAMAZ, (k) => sessizYaz({
      vakitler: sessiz.vakitler.includes(k) ? sessiz.vakitler.filter((x) => x !== k) : NAMAZ.filter((x) => x === k || sessiz.vakitler.includes(x)),
    }));
  }

  function ciz() {
    const t = L();
    $('#widget-ayar').hidden = platform !== 'ios';
    const gizlilik = $('#gizlilik-link');
    gizlilik.hidden = false;
    gizlilik.href = `https://nizam-camii.vercel.app/gizlilik/#${({ tr: 'tr', nl: 'nl', en: 'en' })[document.documentElement.lang] || 'nl'}`;
    $('#sayac-ayar').hidden = !android;
    $('#sessiz-ayar').hidden = !android;
    if (!android) { $('#tam-alarm').hidden = true; return; }
    kur();

    const s = $('#sayac-anahtar');
    s.setAttribute('aria-checked', String(sayacEtkin()));
    const sm = $('#sayac-mesaj');
    sm.hidden = !sayacMesaj;
    sm.textContent = sayacMesaj ? t[sayacMesaj] : '';

    $('#sessiz-anahtar').setAttribute('aria-checked', String(sessiz.aan));
    $('#sessiz-secenekler').classList.toggle('soluk', !sessiz.aan);
    const izinGerek = sessiz.aan && sessiz.mod === 'sessiz' && !izin.sessiz;
    $('#sessiz-mesaj').hidden = !izinGerek;
    $('#sessiz-mesaj').textContent = izinGerek ? t.sessizIzin : '';
    $('#sessiz-izin-satir').hidden = !izinGerek;
    for (const b of $('#sessiz-sure').children) {
      b.textContent = `${b.dataset.deger} ${t.notifMin}`;
      b.setAttribute('aria-pressed', String(+b.dataset.deger === sessiz.dakika));
    }
    for (const b of $('#sessiz-mod').children) {
      b.textContent = t.sessizModAd[b.dataset.deger];
      b.setAttribute('aria-pressed', String(b.dataset.deger === sessiz.mod));
    }
    for (const b of $('#sessiz-vakitler').children) {
      const on = sessiz.vakitler.includes(b.dataset.deger);
      b.innerHTML = on ? TIK : '';
      b.append(t.names[b.dataset.deger]);
      b.setAttribute('aria-pressed', String(on));
    }
    // tam zamanında olsun: Android 12+ "Alarmlar ve hatırlatıcılar" izni (yoksa birkaç dakika gecikebilir)
    $('#tam-alarm').hidden = izin.tamAlarm || !(sayacEtkin() || sessiz.aan || bildirimAcik());
  }

  return {
    hazirla, ciz, izinYenile,
    /** plana giden ayarlar */
    ayar: () => ({ sayac: sayacEtkin(), sessiz: { ...sessiz } }),
  };
}
