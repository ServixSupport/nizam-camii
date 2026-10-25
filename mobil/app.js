// Nizam Camii — mobil uygulama (Faz A: Ana ekran, Ayarlar; Faaliyetler/Programlar boş ekran).
// Vakitler SADECE /api/vakit'ten (parametresiz). Diyanet'e tarayıcıdan gidilmez (CLAUDE.md kural 2).
// Metinler her zaman textContent ile yazılır.
import {
  VAKITLER, amsParcalar, amsGun, gunEkle, diyanetAnahtari, diyanetGunu, aladhanGunu, aladhanAdresi,
  gunOlaylari, anDurumu, geriSayim, hicriYazi, AMS,
} from './zaman.js';
import { METIN, DILLER, VARSAYILAN_DIL, ARAPCA } from './metin.js';
import { ekranlar } from './ekranlar.js';

// TV'nin anahtarları (vakitler, nizam-tema, nizam-sayac) kullanılmaz; hepsi "nzm." ile başlar.
const DEPO = { dil: 'nzm.dil', tema: 'nzm.tema', vakit: 'nzm.vakit', aladhan: 'nzm.aladhan', icerik: 'nzm.icerik' };
const SEKMELER = ['ana', 'faaliyetler', 'programlar', 'ayarlar'];
const BOS_ICERIK = { guncelleme: null, faaliyetler: [], programlar: [] };
const ICERIK_ARALIK = 2 * 60 * 1000;      // içerik en fazla 2 dakikada bir istenir (CDN de 2 dk tutar)
const SVGNS = 'http://www.w3.org/2000/svg';

const $ = (s, k = document) => k.querySelector(s);
const $$ = (s, k = document) => [...k.querySelectorAll(s)];
const oku = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const yaz = (k, v) => { try { localStorage.setItem(k, v); } catch { /* dolu veya kapalı */ } };
const jsonOku = (k) => { try { return JSON.parse(oku(k) || 'null'); } catch { return null; } };
const pad = (n) => String(n).padStart(2, '0');

// ---------------- durum ----------------
const durum = {
  dil: (() => { const d = oku(DEPO.dil); return METIN[d] ? d : VARSAYILAN_DIL; })(),
  tema: (() => { const t = oku(DEPO.tema); return ['oto', 'gunduz', 'gece'].includes(t) ? t : 'oto'; })(),
  diyanet: new Map(),      // 'GG.AA.YYYY' → gün
  aladhan: new Map(),      // 'YYYY-MM-DD' → gün
  veriVar: false,
  hata: false,
  sonGetirme: 0,
  gun: null,               // ekrandaki Amsterdam günü
  olay: { dun: [], bugun: [], yarin: [] },
  icerik: BOS_ICERIK,
  icerikAlindi: 0,
};
const L = () => METIN[durum.dil];

// ---------------- veri ----------------
function diyanetYukle(days) {
  durum.diyanet = new Map(days.filter((x) => x && x.date).map((x) => [x.date, x]));
}
function gunVerisi(ymd) {
  const x = durum.diyanet.get(diyanetAnahtari(ymd));
  if (x) return diyanetGunu(x);
  const a = durum.aladhan.get(ymd);
  return a ? aladhanGunu(a) : null;
}

(function depodanYukle() {
  const v = jsonOku(DEPO.vakit);
  if (v && Array.isArray(v.days)) diyanetYukle(v.days);
  const ic = jsonOku(DEPO.icerik);
  if (ic && ic.icerik && Array.isArray(ic.icerik.faaliyetler)) { durum.icerik = ic.icerik; durum.icerikAlindi = ic.alindi || 0; }
  const a = jsonOku(DEPO.aladhan);
  if (a && typeof a === 'object') for (const [k, d] of Object.entries(a)) durum.aladhan.set(k, d);
})();

async function vakitGetir() {
  try {
    const r = await fetch('/api/vakit', { cache: 'no-store' });     // parametresiz: CDN cache anahtarı aynı kalsın
    const j = await r.json();
    if (j && j.available && Array.isArray(j.days) && j.days.length) {
      diyanetYukle(j.days);
      yaz(DEPO.vakit, JSON.stringify({ alindi: Date.now(), days: j.days }));
      return true;
    }
  } catch { /* internet yok: kayıtlı veriyle devam */ }
  return false;
}

// Aladhan yedeği: sadece Diyanet verisi olmayan gün için (TV ile aynı)
async function eksikleriTamamla(gunler) {
  const eksik = gunler.filter((g) => !durum.diyanet.has(diyanetAnahtari(g)) && !durum.aladhan.has(g));
  await Promise.all(eksik.map(async (g) => {
    try {
      const r = await fetch(aladhanAdresi(g));
      if (!r.ok) return;
      const j = await r.json();
      if (j && j.data && j.data.timings) durum.aladhan.set(g, j.data);
    } catch { /* sessiz */ }
  }));
  if (eksik.length) {
    const sakla = {};                                   // sadece yakın günler saklanır
    for (const [k, d] of durum.aladhan) if (k >= gunEkle(durum.gun || amsGun(Date.now()), -2)) sakla[k] = d;
    yaz(DEPO.aladhan, JSON.stringify(sakla));
  }
}

async function icerikGetir(zorla) {
  if (!zorla && Date.now() - durum.icerikAlindi < ICERIK_ARALIK) return;
  try {
    const r = await fetch('/api/icerik', { cache: 'no-cache' });
    if (!r.ok) return;
    const j = await r.json();
    if (!j || !Array.isArray(j.faaliyetler) || !Array.isArray(j.programlar)) return;
    durum.icerik = j; durum.icerikAlindi = Date.now();
    yaz(DEPO.icerik, JSON.stringify({ alindi: durum.icerikAlindi, icerik: j }));
    ekranlariCiz();
  } catch { /* internet yok: kayıtlı içerikle devam */ }
}

// Programlar için vakitler: o günün verisi; tabloda veri olmayan günde en yakın günün vakitleri (yaklaşık)
const olaylar = (ymd) => gunOlaylari(gunVerisi(ymd), ymd);
function olaylarYaklasik(ymd) {
  const tam = olaylar(ymd);
  if (tam.length) return tam;
  let en = null, fark = Infinity;
  for (const k of durum.diyanet.keys()) {
    const [g, a, y] = k.split('.');
    const f = Math.abs(Date.UTC(+y, +a - 1, +g) - Date.UTC(...ymd.split('-').map((x, i) => (i === 1 ? +x - 1 : +x))));
    if (f < fark) { fark = f; en = k; }
  }
  return en ? gunOlaylari(diyanetGunu(durum.diyanet.get(en)), ymd) : [];
}

let _bildirimZamani = 0;
function bildir(metin) {
  let el = $('.bildirim');
  if (!el) { el = document.createElement('div'); el.className = 'bildirim'; el.setAttribute('role', 'status'); document.body.append(el); }
  el.textContent = metin; el.classList.add('acik');
  clearTimeout(_bildirimZamani);
  _bildirimZamani = setTimeout(() => el.classList.remove('acik'), 2500);
}

const ekran = ekranlar({
  L, dil: () => durum.dil, icerik: () => durum.icerik, simdi: () => Date.now(),
  tablet: () => tabletMi.matches, olaylar, olaylarYaklasik, bildir,
});

function ekranlariCiz(ilk = false) {
  const { sekme, id } = aktifSekme();
  if (tabletMi.matches) ekran.kartlariCiz();
  if (sekme === 'faaliyetler') ekran.faaliyetleriCiz(ilk);
  if (sekme === 'faaliyet') ekran.detayCiz(id);
  if (sekme === 'programlar') ekran.programlariCiz(ilk);
}

let _yenileniyor = null;
function yenile() {
  if (_yenileniyor) return _yenileniyor;
  _yenileniyor = (async () => {
    await vakitGetir();
    const bugun = amsGun(Date.now());
    await eksikleriTamamla([bugun, gunEkle(bugun, 1)]);
    durum.sonGetirme = Date.now();
    olaylariKur(true);
    ciz();
    ekranlariCiz();
  })().finally(() => { _yenileniyor = null; });
  return _yenileniyor;
}

function olaylariKur(zorla) {
  const bugun = amsGun(Date.now());
  if (!zorla && bugun === durum.gun) return;
  durum.gun = bugun;
  durum.olay = {
    dun: gunOlaylari(gunVerisi(gunEkle(bugun, -1)), gunEkle(bugun, -1)),
    bugun: gunOlaylari(gunVerisi(bugun), bugun),
    yarin: gunOlaylari(gunVerisi(gunEkle(bugun, 1)), gunEkle(bugun, 1)),
  };
  durum.veriVar = durum.olay.bugun.length === VAKITLER.length;
  _tarihImza = '';
}

// ---------------- dil ----------------
function metinleriYaz() {
  const t = L();
  document.documentElement.lang = durum.dil;
  for (const el of $$('[data-t]')) el.textContent = t[el.dataset.t];
  for (const el of $$('[data-t-aria]')) el.setAttribute('aria-label', t[el.dataset.tAria]);
  for (const el of $$('[data-t-alt]')) el.setAttribute('alt', t[el.dataset.tAlt]);

  const dil = $('#dil-secim');
  dil.replaceChildren(...DILLER.map(([k, ad]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = ad; b.lang = k;
    b.setAttribute('aria-pressed', String(k === durum.dil));
    b.addEventListener('click', () => dilSec(k));
    return b;
  }));
  const tema = $('#tema-secim');
  tema.replaceChildren(...[['oto', t.auto], ['gunduz', t.light], ['gece', t.dark]].map(([k, ad]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = ad;
    b.setAttribute('aria-pressed', String(k === durum.tema));
    b.addEventListener('click', () => temaSec(k));
    return b;
  }));
  _tarihImza = ''; _satirImza = '';
}

function dilSec(k) {
  if (!METIN[k]) return;
  durum.dil = k; yaz(DEPO.dil, k);
  metinleriYaz(); ciz(); ekranlariCiz();
}
function temaSec(k) {
  durum.tema = k; yaz(DEPO.tema, k);
  metinleriYaz(); ciz();
  $('#tema-secim [aria-pressed="true"]')?.focus();
}
function temaUygula(gunduz) {
  const t = durum.tema === 'oto' ? (gunduz ? 'gunduz' : 'gece') : durum.tema;
  if (document.documentElement.dataset.tema !== t) {
    document.documentElement.dataset.tema = t;
    $('meta[name="theme-color"]').setAttribute('content', t === 'gece' ? '#0C1834' : '#F6F1E7');
  }
}

// ---------------- sekmeler ----------------
function aktifSekme() {
  const ad = decodeURIComponent(location.hash.replace('#', ''));
  const m = ad.match(/^faaliyet\/(f-[a-z0-9]{4,12})$/);
  if (m) return { sekme: 'faaliyet', id: m[1], menu: 'faaliyetler' };
  const sekme = SEKMELER.includes(ad) ? ad : 'ana';
  return { sekme, id: null, menu: sekme };
}
function sekmeGoster() {
  const { sekme, menu } = aktifSekme();
  for (const s of $$('main > .sekme')) s.hidden = s.dataset.sekme !== sekme;
  for (const a of $$('.menu-oge')) {
    if (a.dataset.sekme === menu) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  ekranlariCiz(true);
  window.scrollTo(0, 0);
}

// ---------------- kemer (SVG) ----------------
const YOL = 'M16 348 V200 A190 190 0 0 1 150 18.4 A190 190 0 0 1 284 200 V348';
const IC_YOL = 'M26 348 V202 A180 180 0 0 1 150 28.9 A180 180 0 0 1 274 202 V348';
const OLCU = {
  telefon: { ic: 1, nokta: 2, ilerleme: 3, sus: 1.2, r: 5, rs: 2, halka: 9, halkaS: 2.5, halkaIc: 3.5,
    hale: 20, gunes: 11, gunesS: 2.5, ayHale: 17, ay: 10, ayKes: 8.5, ayDx: 4.5, ayDy: -3.5 },
  tablet: { ic: 0.8, nokta: 1.6, ilerleme: 2.4, sus: 1, r: 4, rs: 1.6, halka: 7.5, halkaS: 2, halkaIc: 3,
    hale: 17, gunes: 9, gunesS: 2, ayHale: 14.5, ay: 8.5, ayKes: 7.2, ayDx: 3.8, ayDy: -3 },
};
const YILDIZLAR = [[88, 96, 1.4, 'nz-tw'], [212, 84, 1.2, 'nz-tw2'], [62, 168, 1, 'nz-tw'], [240, 190, 1.3, 'nz-tw2'], [128, 120, 0.9, 'nz-tw'], [186, 138, 1, 'nz-tw2']];

const svgEl = (ad, attr = {}, ebeveyn) => {
  const e = document.createElementNS(SVGNS, ad);
  for (const [k, v] of Object.entries(attr)) e.setAttribute(k, v);
  if (ebeveyn) ebeveyn.appendChild(e);
  return e;
};
const tabletMi = matchMedia('(min-width: 768px)');
const K = {};      // kemer elemanları

function kemerKur() {
  const o = tabletMi.matches ? OLCU.tablet : OLCU.telefon;
  const svg = $('.kemer-svg');
  svg.replaceChildren();
  const defs = svgEl('defs', {}, svg);
  const g = svgEl('linearGradient', { id: 'nzGok', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  svgEl('stop', { offset: 0, class: 'k-gok1' }, g);
  svgEl('stop', { offset: 1, class: 'k-gok2' }, g);
  svgEl('path', { d: YOL + ' Z', class: 'k-govde' }, svg);
  const yildiz = svgEl('g', { class: 'k-yildizlar' }, svg);
  for (const [cx, cy, r, c] of YILDIZLAR) svgEl('circle', { cx, cy, r, class: c }, yildiz);
  svgEl('path', { d: IC_YOL, class: 'k-ic', 'stroke-width': o.ic }, svg);
  K.yol = svgEl('path', { d: YOL, pathLength: 1000, class: 'k-noktali', 'stroke-width': o.nokta }, svg);
  K.ilerleme = svgEl('path', { d: YOL, pathLength: 1000, class: 'k-ilerleme', 'stroke-width': o.ilerleme, 'stroke-dasharray': '0 1000' }, svg);
  const sus = svgEl('g', { transform: 'translate(150 70)', class: 'k-sus', 'stroke-width': o.sus }, svg);
  svgEl('rect', { x: -9, y: -9, width: 18, height: 18 }, sus);
  svgEl('rect', { x: -9, y: -9, width: 18, height: 18, transform: 'rotate(45)' }, sus);
  K.noktalar = svgEl('g', {}, svg);
  K.gok = svgEl('g', {}, svg);
  K.o = o;
  K.uzunluk = K.yol.getTotalLength();
  _kemerImza = '';
}
tabletMi.addEventListener('change', () => { kemerKur(); ciz(); ekranlariCiz(); });

function nokta(oran) {
  const p = K.yol.getPointAtLength(Math.min(1, Math.max(0, oran)) * K.uzunluk);
  return { x: +p.x.toFixed(1), y: +p.y.toFixed(1) };
}

let _kemerImza = '';
function kemerCiz(kemer) {
  const o = K.o;
  K.ilerleme.setAttribute('stroke-dasharray', kemer ? `${(kemer.oran * 1000).toFixed(1)} 1000` : '0 1000');
  // noktalar ve gök cismi sadece durum değişince yeniden kurulur; konum her saniye güncellenir
  const imza = kemer ? kemer.mod + kemer.gok + kemer.noktalar.map((n) => n.key + n.durum + n.oran.toFixed(4)).join() : '';
  if (imza !== _kemerImza) {
    _kemerImza = imza;
    K.noktalar.replaceChildren();
    K.gok.replaceChildren();
    if (!kemer) return;
    for (const n of kemer.noktalar) {
      const { x, y } = nokta(n.oran);
      if (n.durum === 'siradaki') {
        svgEl('circle', { cx: x, cy: y, r: o.halka, class: 'k-halka', 'stroke-width': o.halkaS, 'data-key': n.key, 'data-durum': n.durum }, K.noktalar);
        svgEl('circle', { cx: x, cy: y, r: o.halkaIc, class: 'k-halka-ic' }, K.noktalar);
      } else {
        svgEl('circle', { cx: x, cy: y, r: o.r, class: n.durum === 'gecti' ? 'k-gecti' : 'k-gelecek', 'stroke-width': o.rs, 'data-key': n.key, 'data-durum': n.durum }, K.noktalar);
      }
    }
    if (kemer.gok === 'gunes') {
      K.hale = svgEl('circle', { r: o.hale, class: 'k-hale nz-halo' }, K.gok);
      K.cisim = svgEl('circle', { r: o.gunes, class: 'k-gunes', 'stroke-width': o.gunesS, 'data-gok': 'gunes' }, K.gok);
      K.kes = null;
    } else {
      K.hale = svgEl('circle', { r: o.ayHale, class: 'k-ay-hale' }, K.gok);
      K.cisim = svgEl('circle', { r: o.ay, class: 'k-ay', 'data-gok': 'ay' }, K.gok);
      K.kes = svgEl('circle', { r: o.ayKes, class: 'k-ay-kes' }, K.gok);
    }
  }
  if (!kemer) return;
  const { x, y } = nokta(kemer.oran);
  for (const e of [K.hale, K.cisim]) { e.setAttribute('cx', x); e.setAttribute('cy', y); }
  if (K.kes) {
    K.kes.setAttribute('cx', (x + o.ayDx).toFixed(1));
    K.kes.setAttribute('cy', (y + o.ayDy).toFixed(1));
    // hilalin iç rengi, gökyüzü geçişinin o yüksekliğindeki rengi olsun
    K.kes.style.fill = `color-mix(in srgb, var(--sky2) ${Math.round((y / 360) * 100)}%, var(--sky1))`;
  }
}

// ---------------- vakit listesi ----------------
const YILDIZ_IKON = '<svg viewBox="0 0 16 16"><g fill="currentColor"><rect x="3" y="3" width="10" height="10"/><rect x="3" y="3" width="10" height="10" transform="rotate(45 8 8)"/></g></svg>';
let _satirImza = '';
function satirlariCiz(satirlar) {
  const ul = $('.vakitler');
  if (ul.children.length !== VAKITLER.length) {
    ul.replaceChildren(...VAKITLER.map((key, i) => {
      const li = document.createElement('li');
      li.className = 'vakit'; li.dataset.key = key; li.style.animationDelay = `${(0.05 * i).toFixed(2)}s`;
      li.innerHTML = '<span class="v-ikon" aria-hidden="true"></span>'
        + '<span class="v-metin"><span class="v-ad"></span><span class="v-simdi" hidden></span><span class="v-ar" lang="ar" dir="rtl"></span></span>'
        + '<span class="v-saat"></span>';
      return li;
    }));
    ul.classList.add('ilk');
    setTimeout(() => ul.classList.remove('ilk'), 1200);
  }
  const imza = durum.dil + satirlar.map((s) => s.key + s.saat + s.durum + s.simdi).join();
  if (imza === _satirImza) return;
  _satirImza = imza;
  const t = L();
  for (const li of ul.children) {
    const s = satirlar.find((x) => x.key === li.dataset.key);
    li.hidden = !s;
    if (!s) continue;
    li.className = `vakit ${s.durum}${s.simdi ? ' simdi' : ''}`;
    $('.v-ad', li).textContent = t.names[s.key];
    $('.v-ar', li).textContent = ARAPCA[s.key];
    $('.v-saat', li).textContent = s.saat;
    const sm = $('.v-simdi', li);
    sm.hidden = !s.simdi; sm.textContent = t.simdi;
    const ikon = $('.v-ikon', li);
    if (s.durum === 'siradaki') ikon.innerHTML = YILDIZ_IKON;
    else if (s.simdi) ikon.innerHTML = '<span class="v-nokta"></span>';
    else ikon.replaceChildren();
    ikon.style.color = 'var(--coral)';
  }
}

// ---------------- tarih satırı ----------------
let _tarihImza = '';
function tarihCiz(simdi) {
  const imza = durum.dil + durum.gun;
  if (imza === _tarihImza) return;
  _tarihImza = imza;
  const t = L();
  const p = {};
  for (const x of new Intl.DateTimeFormat(t.locale, { timeZone: AMS, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(new Date(simdi))) p[x.type] = x.value;
  $('.miladi').textContent = `${p.weekday} · ${p.day} ${p.month} ${p.year}`.toLocaleUpperCase(t.locale);
  const g = gunVerisi(durum.gun);
  $('.hicri').textContent = g ? hicriYazi(g.hicri) : ' ';
}

const cihazAmsterdam = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone === AMS; } catch { return true; } })();

// ---------------- her saniye ----------------
function ciz() {
  const simdi = Date.now();
  olaylariKur(false);
  tarihCiz(simdi);

  const notEl = $('.ams-not');
  if (!cihazAmsterdam) {
    const p = amsParcalar(simdi);
    notEl.hidden = false;
    notEl.textContent = L().amsterdamSaati(`${pad(p.h)}:${pad(p.mi)}`);
  }

  const t = L();
  const mesaj = $('.durum-mesaj');
  if (!durum.veriVar) {
    temaUygula(amsParcalar(simdi).h >= 7 && amsParcalar(simdi).h < 18);
    $('.kalan-etiket').textContent = ' ';
    $('.sayac').textContent = '–:––:––';
    $('.sira-ad').textContent = ' '; $('.sira-saat').textContent = ''; $('.sira-ar').textContent = '';
    $('.vakitler').replaceChildren(); _satirImza = '';
    kemerCiz(null);
    mesaj.hidden = false;
    mesaj.textContent = durum.hata ? t.hata : t.yukleniyor;
    return;
  }
  mesaj.hidden = true;

  const d = anDurumu(simdi, durum.olay.bugun, durum.olay.yarin, durum.olay.dun);
  temaUygula(d.gunduz);
  satirlariCiz(d.satirlar);
  kemerCiz(d.kemer);
  if (d.siradaki) {
    $('.kalan-etiket').textContent = t.kalan(d.siradaki.key);
    $('.sayac').textContent = geriSayim(d.kalan);
    $('.sira-ad').textContent = t.names[d.siradaki.key];
    $('.sira-saat').textContent = d.siradaki.saat;
    $('.sira-ar').textContent = ARAPCA[d.siradaki.key];
  }
}

let _dakika = -1;
function tik() {
  const onceki = durum.gun;
  ciz();
  const dk = Math.floor(Date.now() / 60000);
  if (dk !== _dakika) { if (_dakika >= 0) ekranlariCiz(); _dakika = dk; }
  if (onceki && durum.gun !== onceki) yenile();             // gün değişti
  setTimeout(tik, 1000 - (Date.now() % 1000) + 5);           // saniye başında
}

// ---------------- başlat ----------------
metinleriYaz();
kemerKur();
sekmeGoster();
window.addEventListener('hashchange', sekmeGoster);
tik();
yenile().then(() => {
  if (!durum.veriVar) { durum.hata = true; ciz(); }
});
icerikGetir(true);

setInterval(() => { if (document.visibilityState === 'visible') yenile(); }, 60 * 60 * 1000);   // saatte bir (TV gibi)
setInterval(() => { if (!durum.veriVar) yenile().then(() => { durum.hata = !durum.veriVar; ciz(); }); }, 30 * 1000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { ciz(); icerikGetir(); if (Date.now() - durum.sonGetirme > 30 * 60 * 1000) yenile(); }
});
window.addEventListener('online', () => { yenile(); icerikGetir(true); });
setInterval(() => { if (document.visibilityState === 'visible') icerikGetir(); }, 10 * 60 * 1000);
