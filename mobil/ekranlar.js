// Faaliyetler, faaliyet detayı, Programlar ve tabletteki ana ekran kartları (Faz B).
// Tasarım: ontwerp/Mobil-Faaliyetler, Mobil-Programlar, Tablet-Programlar, Tablet-Ana-ekran.
// Kullanıcı metinleri her zaman metin düğümü olarak eklenir (asla HTML olarak değil).
import { amsGun, amsParcalar } from './zaman.js';
import {
  metinSec, gorunurFaaliyetler, faaliyetBaslangic, faaliyetBitis, gununProgramlari, haftaGunleri, icsOlustur, saatYaz,
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
  const durum = { fGrup: 'tumu', pGrup: 'tumu', pGun: null, pHafta: 0, pSecili: null };

  const grupStil = (g) => ({ '--g': `var(--g-${g})`, '--gt': `var(--gt-${g})` });
  const grupEtiketi = (g) => h('span', { class: 'grup-etiket', style: grupStil(g) }, yildiz('elmas'), c.L().gruplar[g]);

  function cipler(kap, secili, sec, renkli) {
    const L = c.L();
    doldur(kap, ...['tumu', ...GRUP_SIRA].map((g) => h('button', {
      type: 'button', class: 'cip' + (renkli ? ' renkli' : ''), 'aria-pressed': String(secili === g), style: g === 'tumu' ? null : grupStil(g),
      onclick: () => sec(g),
    }, renkli ? yildiz('elmas') : null, g === 'tumu' ? L.tumu : L.gruplar[g])));
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
    cipler(ciplerKap, durum.fGrup, (g) => { durum.fGrup = g; faaliyetleriCiz(); }, false);

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
        h('div', { class: 'oc-dugmeler' },
          h('button', { type: 'button', class: 'dugme altin', onclick: () => takvimeEkle(f) }, ikon(IKON.takvim), L.takvimeEkle),
          h('button', { type: 'button', class: 'dugme cerceve kare', 'aria-label': L.paylas, onclick: () => paylas(f) }, ikon(IKON.paylas)))),
      // öne çıkan + resim: tarih | metin | resim (dar ekranda resim alta, kesilmeden)
      resim ? h('a', { class: 'oc-resim', href: `#faaliyet/${f.id}`, tabindex: '-1', 'aria-hidden': 'true' },
        h('img', { src: resim, alt: '', loading: 'lazy', decoding: 'async' })) : null);
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

  // ---------- Programlar ----------
  function programlariCiz(ilk = false) {
    document.getElementById('p-icerik').classList.toggle('ilk', ilk);
    const L = c.L();
    const programlar = c.icerik().programlar || [];
    const kap = document.getElementById('p-icerik');
    const nav = document.getElementById('hafta-nav');
    if (!programlar.length) { doldur(nav); doldur(kap, bosKart(L.prEmpty, L.prEmptySub)); return; }
    if (c.tablet()) haftaTablosu(kap, nav, programlar); else gunListesi(kap, nav, programlar);
  }

  function gunListesi(kap, nav, programlar) {
    const L = c.L(), dil = c.dil();
    doldur(nav);
    const bugun = amsGun(c.simdi());
    const gunler = haftaGunleri(bugun);
    if (!durum.pGun || !gunler.some((g) => g.ymd === durum.pGun)) durum.pGun = bugun;
    const secili = gunler.find((g) => g.ymd === durum.pGun);
    const ogeler = gununProgramlari(programlar, secili.ymd, secili.hg, c.olaylar(secili.ymd));
    const tp = tarihParca(secili.ymd, L.locale);
    doldur(kap,
      h('div', { class: 'gun-secici', role: 'group', 'aria-label': L.gunSec }, gunler.map((g) => {
        const t = tarihParca(g.ymd, L.locale);
        return h('button', {
          type: 'button', 'aria-pressed': String(g.ymd === secili.ymd), class: g.ymd === bugun ? 'bugun' : null,
          'aria-label': `${ilkHarfBuyuk(t.haftaGunu, L.locale)} ${t.gun} ${t.ay}${g.ymd === bugun ? ` (${L.bugun})` : ''}`,
          onclick: () => { durum.pGun = g.ymd; programlariCiz(); },
        }, h('span', { metin: ilkHarfBuyuk(t.gunKisa, L.locale) }), h('i', { 'aria-hidden': 'true' }));
      })),
      h('div', { class: 'gun-baslik' },
        h('h2', { metin: ilkHarfBuyuk(tp.haftaGunu, L.locale) + (secili.ymd === bugun ? ` · ${L.bugun}` : '') }),
        h('span', { metin: L.programSay(ogeler.length) })),
      ogeler.length
        ? h('ol', { class: 'zaman-cizelgesi' }, ogeler.map(({ p, zaman }, i) => {
          const [ust, alt] = zaman.vakteBagli
            ? [zaman.bas == null ? L.vakitAdi[zaman.vakit] : `≈ ${saatYaz(zaman.bas)}`,
              zaman.bas == null ? (zaman.fark > 0 ? L.sonrasiKisa : L.vaktindeKisa) : (zaman.fark > 0 ? L.sonrasi(L.vakitAdi[zaman.vakit]) : L.vakitte(L.vakitAdi[zaman.vakit]))]
            : [saatYaz(zaman.bas), saatYaz(zaman.bit)];
          return h('li', { style: { ...grupStil(p.grup), 'animation-delay': `${(0.06 * i).toFixed(2)}s` } },
            h('div', { class: 'zc-saat' }, h('span', { class: 'zc-bas', metin: ust }), h('span', { class: 'zc-bit', metin: alt })),
            h('div', { class: 'zc-cizgi', 'aria-hidden': 'true' }, yildiz('elmas')),
            h('div', { class: 'zc-kart' },
              h('span', { class: 'zc-baslik', metin: metinSec(p.baslik, dil) }),
              [p.yer, p.hoca && `${L.hoca}: ${p.hoca}`].filter(Boolean).length
                ? h('span', { class: 'zc-yer', metin: [p.yer, p.hoca && `${L.hoca}: ${p.hoca}`].filter(Boolean).join(' · ') }) : null,
              metinSec(p.aciklama, dil) ? h('span', { class: 'zc-aciklama', metin: metinSec(p.aciklama, dil) }) : null,
              h('span', { class: 'zc-grup', metin: L.gruplar[p.grup] })));
        }))
        : h('p', { class: 'bos-satir', metin: L.gunBos }));
  }

  function haftaTablosu(kap, nav, programlar) {
    const L = c.L(), dil = c.dil();
    const simdi = c.simdi();
    const bugun = amsGun(simdi);
    const gunler = haftaGunleri(gunEkleYmd(bugun, durum.pHafta * 7));
    const ilk = tarihParca(gunler[0].ymd, L.locale), son = tarihParca(gunler[6].ymd, L.locale);
    const aralik = ilk.ay === son.ay ? `${ilk.gun} – ${son.gun} ${son.ay}` : `${ilk.gun} ${ilk.ay} – ${son.gun} ${son.ay}`;
    doldur(nav,
      durum.pHafta !== 0 ? h('button', { type: 'button', class: 'hafta-bugun', onclick: () => { durum.pHafta = 0; programlariCiz(); }, metin: L.buHafta }) : null,
      h('button', { type: 'button', class: 'yuvarlak', 'aria-label': L.oncekiHafta, disabled: durum.pHafta <= -8, onclick: () => { durum.pHafta--; programlariCiz(); } }, ikon(IKON.geri)),
      h('span', { class: 'hafta-aralik', 'aria-live': 'polite', metin: aralik }),
      h('button', { type: 'button', class: 'yuvarlak', 'aria-label': L.sonrakiHafta, disabled: durum.pHafta >= 8, onclick: () => { durum.pHafta++; programlariCiz(); } }, ikon(IKON.ok)));

    // blok verileri
    const bloklar = [];
    for (const [i, g] of gunler.entries()) {
      for (const { p, zaman } of gununProgramlari(programlar, g.ymd, g.hg, c.olaylarYaklasik(g.ymd))) {
        if (zaman.bas == null) continue;
        bloklar.push({ p, z: zaman, gun: i, ymd: g.ymd, kimlik: `${p.id}@${g.ymd}` });
      }
    }
    const H = 58;
    const BAS = Math.min(9, ...bloklar.map((b) => Math.floor(b.z.bas / 60)));
    const BIT = Math.max(22, ...bloklar.map((b) => Math.ceil(b.z.bit / 60)));
    const ust = (dk) => Math.round((dk / 60 - BAS) * H);

    const ortaGun = gunler.some((g) => g.ymd === bugun) ? bugun : gunler[3].ymd;
    const vakitler = c.olaylarYaklasik(ortaGun).filter((e) => ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].includes(e.key))
      .map((e) => ({ ad: L.vakitAdi[e.key], dk: +e.saat.slice(0, 2) * 60 + +e.saat.slice(3) }))
      .filter((v) => v.dk >= BAS * 60 && v.dk <= BIT * 60);

    if (!durum.pSecili || !bloklar.some((b) => b.kimlik === durum.pSecili)) {
      const p0 = amsParcalar(simdi);
      const simdiDk = p0.h * 60 + p0.mi;
      const sonraki = bloklar.filter((b) => b.ymd > bugun || (b.ymd === bugun && b.z.bit > simdiDk))
        .sort((a, b) => a.ymd.localeCompare(b.ymd) || a.z.bas - b.z.bas)[0];
      durum.pSecili = (sonraki || bloklar[0] || {}).kimlik || null;
    }
    const bugunSutun = gunler.findIndex((g) => g.ymd === bugun);

    const govde = h('div', { class: 'ht-govde', style: { height: `${(BIT - BAS) * H}px` } });
    for (let s = BAS; s <= BIT; s++) {
      const yakin = vakitler.some((v) => Math.abs(v.dk / 60 - s) < 0.25);
      govde.append(h('span', { class: 'ht-saat-cizgi', style: { top: `${(s - BAS) * H}px` } }));
      govde.append(h('span', { class: 'ht-saat', 'aria-hidden': 'true', style: { top: `${s === BAS ? 4 : (s === BIT ? (s - BAS) * H - 16 : (s - BAS) * H - 7)}px`, opacity: yakin ? 0 : 1 }, metin: `${String(s).padStart(2, '0')}:00` }));
    }
    const alan = h('div', { class: 'ht-alan' });
    for (let i = 1; i < 7; i++) alan.append(h('span', { class: 'ht-sutun', style: { left: `${(i * 100 / 7).toFixed(4)}%` } }));
    if (bugunSutun >= 0) alan.append(h('span', { class: 'ht-bugun', style: { left: `${(bugunSutun * 100 / 7).toFixed(4)}%` } }));
    for (const v of vakitler) alan.append(h('span', { class: 'ht-vakit', style: { top: `${ust(v.dk)}px` } }));
    bloklar.forEach((b, i) => {
      const secili = b.kimlik === durum.pSecili;
      const uyar = durum.pGrup === 'tumu' || b.p.grup === durum.pGrup;
      const t = tarihParca(b.ymd, L.locale);
      alan.append(h('button', {
        type: 'button', class: 'ht-blok' + (secili ? ' secili' : ''), 'aria-pressed': String(secili),
        'aria-label': `${ilkHarfBuyuk(t.haftaGunu, L.locale)}, ${programSaatMetni(b.p, b.z, L)}, ${metinSec(b.p.baslik, dil)}, ${L.gruplar[b.p.grup]}`,
        style: { ...grupStil(b.p.grup), left: `${(b.gun * 100 / 7).toFixed(4)}%`, top: `${ust(b.z.bas) + 2}px`, height: `${Math.max(30, ust(b.z.bit) - ust(b.z.bas) - 3)}px`, opacity: uyar ? 1 : 0.22, 'animation-delay': `${(0.03 * i).toFixed(2)}s` },
        onclick: () => { durum.pSecili = b.kimlik; programlariCiz(); },
      },
      h('span', { class: 'htb-saat', metin: b.z.vakteBagli ? (b.z.fark > 0 ? L.sonrasi(L.vakitAdi[b.z.vakit]) : L.vakitte(L.vakitAdi[b.z.vakit])) : saatYaz(b.z.bas) }),
      h('span', { class: 'htb-baslik', metin: metinSec(b.p.baslik, dil) })));
    });
    if (bugunSutun >= 0) {
      const p = amsParcalar(simdi);
      const dk = p.h * 60 + p.mi;
      if (dk >= BAS * 60 && dk <= BIT * 60) {
        alan.append(h('span', { class: 'ht-simdi', 'aria-hidden': 'true', style: { left: `${(bugunSutun * 100 / 7).toFixed(4)}%`, top: `${ust(dk)}px` } }));
        alan.append(h('span', { class: 'ht-simdi-nokta', 'aria-hidden': 'true', style: { left: `calc(${(bugunSutun * 100 / 7).toFixed(4)}% - 4px)`, top: `${ust(dk) - 3}px` } }));
      }
    }
    govde.append(alan);
    for (const v of vakitler) govde.append(h('span', { class: 'ht-vakit-ad', style: { top: `${ust(v.dk) - 7}px` }, metin: v.ad }));

    const secili = bloklar.find((b) => b.kimlik === durum.pSecili);
    const ciplerKap = h('div', { class: 'cipler sar', role: 'group', 'aria-label': L.suz });
    cipler(ciplerKap, durum.pGrup, (g) => { durum.pGrup = g; programlariCiz(); }, true);

    doldur(kap,
      h('div', { class: 'ht-ust' }, ciplerKap,
        h('span', { class: 'ht-lejant' }, h('span', { class: 'kesik', 'aria-hidden': 'true' }), L.namazVakitleri)),
      h('section', { class: 'hafta-tablosu', 'aria-label': L.tablo },
        h('div', { class: 'ht-gunler' }, h('span', { class: 'ht-bosluk' }), gunler.map((g) => {
          const t = tarihParca(g.ymd, L.locale);
          return h('span', { class: 'ht-gun' }, h('span', { class: 'ht-gun-ic' + (g.ymd === bugun ? ' bugun' : '') },
            h('span', { class: 'htg-kisa', metin: ilkHarfBuyuk(t.gunKisa, L.locale) }), h('span', { class: 'htg-no', metin: t.gun })));
        })),
        govde),
      secili ? seciliKart(secili) : null);
  }

  function seciliKart(b) {
    const L = c.L(), dil = c.dil();
    const t = tarihParca(b.ymd, L.locale);
    return h('section', { class: 'secili-kart', 'aria-label': L.secili, 'aria-live': 'polite' },
      h('div', { class: 'sk-tarih' },
        h('span', { class: 'sk-gun', metin: ilkHarfBuyuk(t.gunKisa, L.locale).toLocaleUpperCase(L.locale) }),
        h('span', { class: 'sk-no', metin: t.gun }), h('span', { class: 'sk-ay', metin: t.ayKisa })),
      h('div', { class: 'sk-metin' },
        h('span', { class: 'sk-grup', style: grupStil(b.p.grup) }, yildiz('elmas'), L.gruplar[b.p.grup]),
        h('span', { class: 'sk-baslik', metin: metinSec(b.p.baslik, dil) }),
        h('span', { class: 'sk-meta', metin: [ilkHarfBuyuk(t.haftaGunu, L.locale), programSaatMetni(b.p, b.z, L), b.p.yer, b.p.hoca && `${L.hoca}: ${b.p.hoca}`].filter(Boolean).join(' · ') }),
        metinSec(b.p.aciklama, dil) ? h('span', { class: 'sk-aciklama', metin: metinSec(b.p.aciklama, dil) }) : null));
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
