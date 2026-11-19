// Mağaza uygulaması ayarları (06-11-2026): durum çubuğunda geri sayım (Android), namaz vaktinde sessize alma
// (Android; iPhone buna izin vermez), kilit ekranı widget'ı (iPhone, sadece açıklama).
// Tarayıcıda (web uygulaması) bu bölümler hiç görünmez; app.js bu modülü sadece mağaza uygulamasında kurar.
import { NAMAZ } from './bildirim-metin.js';
import { SESSIZ_DK, SESSIZ_VARSAYILAN, SESSIZ_DK_VARSAYILAN } from './yerel-plan.js';

const DEPO_SAYAC = 'nzm.sayac';            // 'acik' | 'kapali' (ilk açılışta açık)
const DEPO_SORULDU = 'nzm.sayacSoruldu';   // bildirim izni ilk açılışta bir kez sorulur
const DEPO_SESSIZ = 'nzm.sessiz';

const TIK = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

const oku = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const yaz = (k, v) => { try { localStorage.setItem(k, v); } catch { /* dolu veya kapalı */ } };

function sessizOku() {
  try {
    const v = JSON.parse(oku(DEPO_SESSIZ) || 'null');
    if (!v || typeof v !== 'object') return { ...SESSIZ_VARSAYILAN, dakikalar: { ...SESSIZ_VARSAYILAN.dakikalar } };
    // her namaz için ayrı süre (kullanıcı isteği, 19-11-2026); eski kayıtlarda tek "dakika" hepsine geçer
    const eski = SESSIZ_DK.includes(v.dakika) ? v.dakika : SESSIZ_DK_VARSAYILAN;
    const kayitli = v.dakikalar && typeof v.dakikalar === 'object' ? v.dakikalar : {};
    return {
      aan: v.aan === true,
      dakikalar: Object.fromEntries(NAMAZ.map((k) => [k, SESSIZ_DK.includes(kayitli[k]) ? kayitli[k] : eski])),
      vakitler: NAMAZ.filter((k) => Array.isArray(v.vakitler) && v.vakitler.includes(k)),
      mod: v.mod === 'titresim' ? 'titresim' : 'sessiz',
    };
  } catch { return { ...SESSIZ_VARSAYILAN, dakikalar: { ...SESSIZ_VARSAYILAN.dakikalar } }; }
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
    secenekler($('#sessiz-mod'), ['sessiz', 'titresim'], (m) => sessizYaz({ mod: m }));
    // her namaz kendi satırında: açık/kapalı (dokununca) ve ne kadar süre (açılır seçim)
    $('#sessiz-vakitler').replaceChildren(...NAMAZ.map((k) => {
      const satir = document.createElement('div');
      satir.className = 'b-namaz'; satir.dataset.deger = k;
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.deger = k;
      b.addEventListener('click', () => sessizYaz({
        vakitler: sessiz.vakitler.includes(k) ? sessiz.vakitler.filter((x) => x !== k) : NAMAZ.filter((x) => x === k || sessiz.vakitler.includes(x)),
      }));
      const sec = document.createElement('select');
      sec.append(...SESSIZ_DK.map((n) => Object.assign(document.createElement('option'), { value: String(n) })));
      sec.addEventListener('change', () => sessizYaz({ dakikalar: { ...sessiz.dakikalar, [k]: +sec.value } }));
      const kap = document.createElement('span');
      kap.className = 'b-sec';
      kap.append(sec);
      satir.append(b, kap);
      return satir;
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
    // "Rahatsız Etmeyin" erişimi: sessiz için şart; titreşim için de bazı telefonlar (Samsung) ister
    // (16-11-2026: Samsung'da izin yokken titreşime alınamadı)
    const titresim = sessiz.mod === 'titresim';
    const izinGerek = sessiz.aan && !izin.sessiz;
    // son deneme ve sonucu (telefonda ne oldu: sessiz, titreşim, zaten sessiz, "Rahatsız Etmeyin" açıktı …)
    const son = izin.sessizSon;
    const sonAnahtar = son && son.sonuc === 'izinYok' && titresim ? 'izinYokTitresim' : son && son.sonuc;
    const sonYazi = sessiz.aan && son && son.an && t.sessizSonuc[sonAnahtar]
      ? t.sessizSon(new Intl.DateTimeFormat(document.documentElement.lang || 'nl', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(son.an), t.sessizSonuc[sonAnahtar])
      : '';
    $('#sessiz-son').hidden = !sonYazi;
    $('#sessiz-son').textContent = sonYazi;
    $('#sessiz-mesaj').hidden = !izinGerek;
    $('#sessiz-mesaj').textContent = izinGerek ? (titresim ? t.sessizIzinTitresim : t.sessizIzin) : '';
    $('#sessiz-izin-satir').hidden = !izinGerek;
    for (const b of $('#sessiz-mod').children) {
      b.textContent = t.sessizModAd[b.dataset.deger];
      b.setAttribute('aria-pressed', String(b.dataset.deger === sessiz.mod));
    }
    for (const satir of $('#sessiz-vakitler').children) {
      const k = satir.dataset.deger, on = sessiz.vakitler.includes(k);
      const b = satir.querySelector('button');
      b.innerHTML = on ? TIK : '';
      b.append(t.names[k]);
      b.setAttribute('aria-pressed', String(on));
      const sec = satir.querySelector('select');
      for (const o of sec.options) o.textContent = `${o.value} ${t.notifMin}`;
      sec.value = String(sessiz.dakikalar[k]);
      sec.disabled = !on;
      sec.setAttribute('aria-label', t.sessizSureAd(t.names[k]));
      satir.classList.toggle('kapali', !on);
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
