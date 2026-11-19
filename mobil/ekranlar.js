// Faaliyetler, faaliyet detayı, Programlar ve tabletteki ana ekran kartları (Faz B).
// Tasarım: ontwerp/Mobil-Faaliyetler, Tablet-Ana-ekran. Programlar 19-11-2026'dan beri Faaliyetler gibi liste (kullanıcı isteği).
// Kullanıcı metinleri her zaman metin düğümü olarak eklenir (asla HTML olarak değil).
import { amsGun, amsParcalar } from './zaman.js';
import {
  metinSec, gorunurFaaliyetler, faaliyetBaslangic, faaliyetBitis, gununProgramlari, haftaGunleri, icsOlustur, saatYaz,
  programGunde, programZamani,
} from './icerik.js';

const SVGNS = 'http://www.w3.org/2000/svg';
export const GRUP_SIRA = ['herkes', 'erkekler', 'hanimlar', 'genclik', 'cocuklar'];

/** Güvenli DOM üretici: metinler textContent ile girer. */
export function h(etiket, ozellik = {}, ...cocuklar) {
  const svg = etiket.startsWith('svg:');
  const e = svg ? document.createElementNS(SVGNS, etiket.slice(4)) : document.createElement(etiket);
  for (const [k, v] of Object.entries(ozellik || {})) {
    if (v == null || v === false) continue;
    if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) e.style.setProperty(sk, sv); } else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'metin') e.textContent = v;
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of cocuklar.flat(Infinity)) {
    if (c == null || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}
const ikon = (yol, sinif = '') => {
  const s = h('svg:svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: sinif });
  for (const d of yol) s.append(h('svg:path', { d }));
  return s;
};
const IKON = {
  takvim: ['M3.5 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z', 'M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5'],
  paylas: ['M12 15V3M7.5 7.5L12 3l4.5 4.5', 'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7'],
  ok: ['M9 6l6 6-6 6'], geri: ['M15 5l-7 7 7 7'],
  konum: ['M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z', 'M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
  disLink: ['M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  saat: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7.5V12l3 2'],
};
const yildiz = (sinif = 'yildiz') => h('svg:svg', { viewBox: '0 0 16 16', class: sinif, 'aria-hidden': 'true' },
  h('svg:g', { fill: 'currentColor' }, h('svg:rect', { x: 3, y: 3, width: 10, height: 10 }), h('svg:rect', { x: 3, y: 3, width: 10, height: 10, transform: 'rotate(45 8 8)' })));

export const HARITA = 'https://www.google.com/maps/search/?api=1&query=Ookmeerweg+206+Amsterdam';

/** Kabı boşaltıp doldurur; null/false atlanır (replaceChildren null'u "null" yazısına çevirir). */
function doldur(kap, ...cocuklar) {
  kap.replaceChildren(...cocuklar.flat(Infinity).filter((c) => c != null && c !== false));
}

// ---------------- tarih biçimleri ----------------
function tarihParca(ymd, locale) {
  const [y, m, d] = ymd.split('-').map(Number);
  const p = {};
  for (const x of new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .formatToParts(new Date(Date.UTC(y, m - 1, d, 12)))) p[x.type] = x.value;
  const kisa = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'short' }).format(new Date(Date.UTC(y, m - 1, d, 12)));
  const gunKisa = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short' }).format(new Date(Date.UTC(y, m - 1, d, 12)));
  return { gun: d, ay: p.month, ayKisa: kisa.replace('.', '').toLocaleUpperCase(locale), yil: p.year, haftaGunu: p.weekday, gunKisa: gunKisa.replace('.', '') };
}
const ilkHarfBuyuk = (s, locale) => (s ? s.charAt(0).toLocaleUpperCase(locale) + s.slice(1) : s);
const amsSaat = (ms) => { const p = amsParcalar(ms); return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`; };

/** "10:00 – 12:30" / "Tüm gün" / iki gün sürerse "31 okt 10:00 – 1 nov 13:00" */
function faaliyetSaati(f, L) {
  if (f.tumGun) return L.tumGun;
  const bas = faaliyetBaslangic(f);
  if (!f.bitis) return amsSaat(bas);
  const bit = faaliyetBitis(f);
  if (amsGun(bit) === amsGun(bas)) return `${amsSaat(bas)} – ${amsSaat(bit)}`;
  const t1 = tarihParca(amsGun(bas), L.locale), t2 = tarihParca(amsGun(bit), L.locale);
  return `${t1.gun} ${t1.ay} ${amsSaat(bas)} – ${t2.gun} ${t2.ay} ${amsSaat(bit)}`;
}

/** Program saati metni: "17:00 – 19:00", "Yatsı sonrası (≈ 19:32)", veri yoksa "Yatsı sonrası" */
export function programSaatMetni(p, z, L) {
  if (!z.vakteBagli) return `${saatYaz(z.bas)} – ${saatYaz(z.bit)}`;
  const ad = L.vakitAdi[z.vakit];
  const etiket = z.fark > 0 ? L.sonrasi(ad) : L.vakitte(ad);
  return z.bas == null ? etiket : `${etiket} (≈ ${saatYaz(z.bas)})`;
}

// ---------------- ekranlar ----------------
/**
 * @param {object} c  app.js'ten bağlam:
 *   L(), dil(), icerik(), simdi(), tablet(), olaylar(ymd), olaylarYaklasik(ymd), bildir(metin)
 */
export function ekranlar(c) {
  const durum = { fGrup: 'tumu', pGrup: 'tumu' };

  const grupStil = (g) => ({ '--g': `var(--g-${g})`, '--gt': `var(--gt-${g})` });
  const grupEtiketi = (g) => h('span', { class: 'grup-etiket', style: grupStil(g) }, yildiz('elmas'), c.L().gruplar[g]);

  /** Grup süzgeci: tek açılır seçim düğmesi (telefonda telefonun kendi listesi açılır). */
  function grupSecici(secili, sec, kimlik) {
    const L = c.L();
    const aktif = secili !== 'tumu';
    return h('div', { class: 'suz' + (aktif ? ' aktif' : ''), style: aktif ? grupStil(secili) : null },
      h('svg:svg', { class: 'suz-ikon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
        h('svg:path', { d: 'M4 6h16M7 12h10M10 18h4' })),
      h('select', { id: kimlik, 'aria-label': L.suz, onchange: (e) => sec(e.target.value) },
        ['tumu', ...GRUP_SIRA].map((g) => h('option', { value: g, selected: g === secili, metin: g === 'tumu' ? L.tumGruplar : L.gruplar[g] }))),
      ikon(['M6 9l6 6 6-6'], 'suz-ok'));
  }

  function takvimeEkle(f) {
    const ics = icsOlustur(f, c.dil(), c.simdi());
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = h('a', { href: url, download: `${f.id}.ics` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function paylas(f) {
    const L = c.L();
    const url = `${location.origin}/mobil/#faaliyet/${f.id}`;
    const baslik = metinSec(f.baslik, c.dil());
    try {
      if (navigator.share) { await navigator.share({ title: baslik, url }); return; }
      await navigator.clipboard.writeText(url);
      c.bildir(L.linkKopyalandi);
    } catch { /* kullanıcı vazgeçti */ }
  }

  // ---------- Faaliyetler ----------
  function faaliyetleriCiz(ilk = false) {
    document.getElementById('f-icerik').classList.toggle('ilk', ilk);
    const L = c.L(), dil = c.dil();
    const tumu = gorunurFaaliyetler(c.icerik().faaliyetler, c.simdi());
    const kap = document.getElementById('f-icerik');
    const ciplerKap = document.getElementById('f-cipler');
    ciplerKap.hidden = tumu.length === 0;
    doldur(ciplerKap, grupSecici(durum.fGrup, (g) => { durum.fGrup = g; faaliyetleriCiz(); }, 'f-grup'));

    if (!tumu.length) {
      doldur(kap, bosKart(L.evEmpty, L.evEmptySub));
      return;
    }
    const liste = tumu.filter((f) => durum.fGrup === 'tumu' || f.grup === durum.fGrup);
    const one = liste.find((f) => f.oneCikan);
    const kalan = liste.filter((f) => f !== one);
    const parca = [];
    if (one) parca.push(oneCikanKart(one, one === liste[0] ? L.siradakiFaaliyet : L.oneCikan));
    let ay = '';
    const ul = h('ul', { class: 'f-liste' });
    kalan.forEach((f, i) => {
      const ymd = amsGun(faaliyetBaslangic(f));
      const t = tarihParca(ymd, L.locale);
      const ayAdi = `${t.ay} ${t.yil}`.toLocaleUpperCase(L.locale);
      if (ayAdi !== ay) {
        ay = ayAdi;
        ul.append(h('li', { class: 'ay-baslik', 'aria-hidden': 'true' }, h('span', { metin: ayAdi }), h('span', { class: 'cizgi' })));
      }
      ul.append(h('li', { class: 'f-oge', style: { 'animation-delay': `${(0.06 * (i + 1)).toFixed(2)}s` } },
        h('a', { href: `#faaliyet/${f.id}`, style: grupStil(f.grup) },
          h('span', { class: 'tarih-kemer kucuk', 'aria-hidden': 'true' },
            h('svg:svg', { viewBox: '0 0 48 60' }, h('svg:path', { d: 'M1.5 58.5 V28 A32 32 0 0 1 24 1.5 A32 32 0 0 1 46.5 28 V58.5 Z' })),
            h('span', { class: 'tk-gun', metin: t.gun }), h('span', { class: 'tk-ay', metin: t.ayKisa })),
          h('span', { class: 'f-metin' },
            h('span', { class: 'f-baslik', metin: metinSec(f.baslik, dil) }),
            h('span', { class: 'f-meta', metin: [`${ilkHarfBuyuk(t.haftaGunu, L.locale)} ${faaliyetSaati(f, L)}`, f.yer].filter(Boolean).join(' · ') }),
            grupEtiketi(f.grup)),
          ikon(IKON.ok, 'ok'))));
    });
    if (kalan.length) parca.push(ul);
    if (!liste.length) parca.push(h('p', { class: 'bos-satir', metin: L.kategoriBos }));
    doldur(kap, ...parca);
  }

  function oneCikanKart(f, etiket) {
    const L = c.L(), dil = c.dil();
    const t = tarihParca(amsGun(faaliyetBaslangic(f)), L.locale);
    const resim = f.resim && f.resim.startsWith('https://') ? f.resim : '';
    const dugmeler = h('div', { class: 'oc-dugmeler' },
      h('button', { type: 'button', class: 'dugme altin', onclick: () => takvimeEkle(f) }, ikon(IKON.takvim), L.takvimeEkle),
      h('button', { type: 'button', class: 'dugme cerceve kare', 'aria-label': L.paylas, onclick: () => paylas(f) }, ikon(IKON.paylas)));
    return h('article', { class: 'one-cikan' + (resim ? ' met-resim' : '') },
      h('svg:svg', { class: 'oc-desen', viewBox: '0 0 48 48', 'aria-hidden': 'true' },
        h('svg:g', { fill: 'none', stroke: '#E8C27A', 'stroke-width': 0.6 },
          h('svg:rect', { x: 14, y: 14, width: 20, height: 20 }), h('svg:rect', { x: 14, y: 14, width: 20, height: 20, transform: 'rotate(45 24 24)' }),
          h('svg:circle', { cx: 24, cy: 24, r: 6 }))),
      h('a', { class: 'tarih-kemer buyuk', href: `#faaliyet/${f.id}`, 'aria-hidden': 'true', tabindex: '-1' },
        h('svg:svg', { viewBox: '0 0 76 96' }, h('svg:path', { d: 'M2 94 V44 A50 50 0 0 1 38 2 A50 50 0 0 1 74 44 V94 Z' })),
        h('span', { class: 'tk-gun', metin: t.gun }), h('span', { class: 'tk-ay', metin: t.ay.toLocaleUpperCase(L.locale) }),
        h('span', { class: 'tk-hg', metin: ilkHarfBuyuk(t.haftaGunu, L.locale) })),
      h('div', { class: 'oc-metin' },
        h('span', { class: 'oc-etiket', metin: etiket }),
        h('h2', {}, h('a', { href: `#faaliyet/${f.id}`, metin: metinSec(f.baslik, dil) })),
        h('span', { class: 'oc-meta', metin: [faaliyetSaati(f, L), f.yer].filter(Boolean).join(' · ') }),
        resim ? null : dugmeler),
      // öne çıkan + resim (kullanıcı isteği, 19-11-2026): tarih | ad ve saat | küçük resim sağda; düğmeler altta
      resim ? h('a', { class: 'oc-resim', href: `#faaliyet/${f.id}`, tabindex: '-1', 'aria-hidden': 'true' },
        h('img', { src: resim, alt: '', loading: 'lazy', decoding: 'async' })) : null,
      resim ? dugmeler : null);
  }

  function bosKart(baslik, alt) {
    return h('div', { class: 'bos' },
      h('svg:svg', { viewBox: '0 0 48 48', 'aria-hidden': 'true' }, h('svg:g', { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6 },
        h('svg:rect', { x: 14, y: 14, width: 20, height: 20 }), h('svg:rect', { x: 14, y: 14, width: 20, height: 20, transform: 'rotate(45 24 24)' }))),
      h('p', { class: 'bos-baslik', metin: baslik }), h('p', { class: 'bos-alt', metin: alt }));
  }

  // ---------- Faaliyet detayı ----------
  function detayCiz(id) {
    const L = c.L(), dil = c.dil();
    const f = gorunurFaaliyetler(c.icerik().faaliyetler, c.simdi()).find((x) => x.id === id);
    const kap = document.getElementById('d-icerik');
    if (!f) { doldur(kap, bosKart(L.bulunamadi, '')); return; }
    const t = tarihParca(amsGun(faaliyetBaslangic(f)), L.locale);
    const aciklama = metinSec(f.aciklama, dil);
    doldur(kap,
      f.resim && f.resim.startsWith('https://') ? h('img', { class: 'd-resim', src: f.resim, alt: '', loading: 'lazy', decoding: 'async' }) : null,
      grupEtiketi(f.grup),
      h('h1', { class: 'd-baslik', metin: metinSec(f.baslik, dil) }),
      h('ul', { class: 'd-bilgi' },
        h('li', {}, ikon(IKON.saat), h('span', { metin: `${ilkHarfBuyuk(t.haftaGunu, L.locale)} ${t.gun} ${t.ay} ${t.yil} · ${faaliyetSaati(f, L)}` })),
        h('li', {}, ikon(IKON.konum), h('a', { href: HARITA, target: '_blank', rel: 'noopener', metin: [f.yer, 'Ookmeerweg 206, Amsterdam'].filter(Boolean).join(' · ') }))),
      aciklama ? h('p', { class: 'd-aciklama', metin: aciklama }) : null,
      h('div', { class: 'd-dugmeler' },
        h('button', { type: 'button', class: 'dugme dolu', onclick: () => takvimeEkle(f) }, ikon(IKON.takvim), L.takvimeEkle),
        h('button', { type: 'button', class: 'dugme cerceve', onclick: () => paylas(f) }, ikon(IKON.paylas), L.paylas),
        f.link ? h('a', { class: 'dugme cerceve', href: f.link, target: '_blank', rel: 'noopener noreferrer' }, ikon(IKON.disLink), L.dahaFazla) : null));
  }

  // ---------- Programlar: Faaliyetler gibi alt alta liste, gün seçmeden (kullanıcı isteği, 19-11-2026) ----------
  // Telefonda ve tablette aynı. Her program bir kez, sıradaki oturumuna göre sıralı; kemerde o günün tarihi,
  // altında hangi günler ve saat ("Her Pazartesi · Yatsı sonrası (≈ 19:35)"), yer, hoca, açıklama ve grup.
  function programlariCiz(ilk = false) {
    const kap = document.getElementById('p-icerik');
    kap.classList.toggle('ilk', ilk);
    const L = c.L(), dil = c.dil();
    const programlar = c.icerik().programlar || [];
    if (!programlar.length) { doldur(kap, bosKart(L.prEmpty, L.prEmptySub)); return; }
    const simdi = c.simdi();
    const liste = programlar
      .filter((p) => durum.pGrup === 'tumu' || p.grup === durum.pGrup)
      .map((p) => ({ p, s: sonrakiOturum(p, simdi) }))
      .sort((a, b) => (a.s ? 0 : 1) - (b.s ? 0 : 1)
        || (a.s && b.s ? a.s.ymd.localeCompare(b.s.ymd) || (a.s.zaman.bas ?? 9999) - (b.s.zaman.bas ?? 9999) : 0)
        || metinSec(a.p.baslik, dil).localeCompare(metinSec(b.p.baslik, dil), L.locale));
    const ul = h('ul', { class: 'f-liste' }, liste.map(({ p, s }, i) => {
      const t = s ? tarihParca(s.ymd, L.locale) : null;
      const yerHoca = [p.yer, p.hoca && `${L.hoca}: ${p.hoca}`].filter(Boolean).join(' · ');
      const aciklama = metinSec(p.aciklama, dil);
      return h('li', { class: 'f-oge p-oge', style: { 'animation-delay': `${(0.06 * i).toFixed(2)}s` } },
        h('div', { class: 'p-kart', style: grupStil(p.grup) },
          h('span', { class: 'tarih-kemer kucuk', 'aria-hidden': 'true' },
            h('svg:svg', { viewBox: '0 0 48 60' }, h('svg:path', { d: 'M1.5 58.5 V28 A32 32 0 0 1 24 1.5 A32 32 0 0 1 46.5 28 V58.5 Z' })),
            h('span', { class: 'tk-gun', metin: t ? t.gun : '–' }), h('span', { class: 'tk-ay', metin: t ? t.ayKisa : '' })),
          h('span', { class: 'f-metin' },
            h('span', { class: 'f-baslik', metin: metinSec(p.baslik, dil) }),
            h('span', { class: 'f-meta', metin: `${gunlerYazisi(p.gunler, L)} · ${programSaatMetni(p, s ? s.zaman : programZamani(p, []), L)}` }),
            t ? h('span', { class: 'gizli', metin: L.sonrakiOturum(`${ilkHarfBuyuk(t.haftaGunu, L.locale)} ${t.gun} ${t.ay}`) }) : null,
            yerHoca ? h('span', { class: 'f-meta', metin: yerHoca }) : null,
            aciklama ? h('span', { class: 'p-aciklama', metin: aciklama }) : null,
            grupEtiketi(p.grup))));
    }));
    doldur(kap,
      h('div', { class: 'suz-kap' }, grupSecici(durum.pGrup, (g) => { durum.pGrup = g; programlariCiz(); }, 'p-grup')),
      liste.length ? ul : h('p', { class: 'bos-satir', metin: L.programGrupBos }));
  }

  /** Programın sıradaki oturumu (bugünkü bittiyse sonraki): { ymd, zaman }; bir yıl içinde yoksa null. */
  function sonrakiOturum(p, simdi) {
    const bugun = amsGun(simdi);
    const s0 = amsParcalar(simdi);
    const simdiDk = s0.h * 60 + s0.mi;
    for (let i = 0; i < 371; i++) {
      const ymd = gunEkleYmd(bugun, i);
      if (!programGunde(p, ymd, ((s0.hg - 1 + i) % 7) + 1)) continue;
      const zaman = programZamani(p, c.olaylarYaklasik(ymd));
      if (i === 0 && zaman.bit != null && zaman.bit <= simdiDk) continue;
      return { ymd, zaman };
    }
    return null;
  }

  /** Programın günleri: "Her Pazartesi", "Pzt – Per", "Cmt, Paz", "Pzt – Çar, Cum", "Her gün" */
  function gunlerYazisi(gunler, L) {
    const g = [...new Set(gunler || [])].filter((x) => x >= 1 && x <= 7).sort((a, b) => a - b);
    if (g.length === 7) return L.herGun;
    const hafta = haftaGunleri(amsGun(c.simdi()));                 // Pazartesi … Pazar
    const gun = (n) => tarihParca(hafta[n - 1].ymd, L.locale);
    if (g.length === 1) return L.herHafta(gun(g[0]).haftaGunu);
    const kisa = (n) => ilkHarfBuyuk(gun(n).gunKisa, L.locale);
    const parca = [];
    for (let i = 0; i < g.length;) {
      let j = i;
      while (j + 1 < g.length && g[j + 1] === g[j] + 1) j++;
      if (j - i >= 2) parca.push(`${kisa(g[i])} – ${kisa(g[j])}`);
      else for (let k = i; k <= j; k++) parca.push(kisa(g[k]));
      i = j + 1;
    }
    return parca.join(', ');
  }

  // ---------- Ana ekran (tablet) kartları ----------
  function kartlariCiz() {
    const L = c.L(), dil = c.dil();
    const simdi = c.simdi();
    const bugun = amsGun(simdi);
    const hg = amsParcalar(simdi).hg;
    const bugunkuler = gununProgramlari(c.icerik().programlar || [], bugun, hg, c.olaylar(bugun)).slice(0, 3);
    doldur(document.getElementById('k-bugun'), ...(bugunkuler.length
      ? bugunkuler.map(({ p, zaman }) => h('span', { class: 'kb-satir' },
        h('span', { class: 'kb-saat', metin: zaman.bas == null ? '–' : saatYaz(zaman.bas) }),
        h('span', { class: 'kb-metin' }, h('span', { class: 'kb-baslik', metin: metinSec(p.baslik, dil) }), p.yer ? h('span', { class: 'kb-yer', metin: p.yer }) : null)))
      : [h('span', { class: 'kart-bos', metin: L.bugunBos })]));

    const f = gorunurFaaliyetler(c.icerik().faaliyetler, simdi)[0];
    const kart = document.getElementById('k-faaliyet');
    kart.setAttribute('href', f ? `#faaliyet/${f.id}` : '#faaliyetler');
    if (!f) { doldur(document.getElementById('k-faaliyet-ic'), h('span', { class: 'kart-bos', metin: L.faaliyetBos })); return; }
    const t = tarihParca(amsGun(faaliyetBaslangic(f)), L.locale);
    doldur(document.getElementById('k-faaliyet-ic'),
      h('span', { class: 'kf-baslik', metin: metinSec(f.baslik, dil) }),
      h('span', { class: 'kf-meta', metin: `${ilkHarfBuyuk(t.haftaGunu, L.locale)} ${t.gun} ${t.ay} · ${faaliyetSaati(f, L)}` }),
      f.yer ? h('span', { class: 'kf-meta', metin: f.yer }) : null);
  }

  return { faaliyetleriCiz, detayCiz, programlariCiz, kartlariCiz };
}

function gunEkleYmd(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}
