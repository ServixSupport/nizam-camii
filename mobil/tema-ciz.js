// Tema 2 (gök) ve Tema 4 (zümrüt) için ana ekranın çizimleri (kullanıcı isteği ve örnek resimleri, 20-11-2026).
//  - Tema 2: gökyüzü rengi içinde bulunulan vakte göre değişir (gece lacivert, Öğle mor, İkindi mavi, Akşam turuncu …);
//    güneş yayı: gündüz yayı (Güneş → Akşam) ve gece yayı (kesik çizgi), üstünde vakitlerin noktaları (ad ve saat yok),
//    güneş ya da ay şimdiki yerinde.
//  - Tema 4: "Şimdi" kartı (vakit ve saat), kalan süre halkası (zaman çizgisi kullanıcı isteğiyle kalktı, 20-11-2026).
// Saf DOM çizimi; zaman hesabı app.js'ten gelir (zaman.js, Amsterdam saati).

const SVGNS = 'http://www.w3.org/2000/svg';
const el = (ad, ozellik = {}, ebeveyn = null) => {
  const e = document.createElementNS(SVGNS, ad);
  for (const [k, v] of Object.entries(ozellik)) e.setAttribute(k, v);
  if (ebeveyn) ebeveyn.append(e);
  return e;
};
const NAMAZ = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const bul = (l, k) => (l || []).find((e) => e.key === k);

/** İçinde bulunulan vakte göre gökyüzü: gece | seher | sabah | ogle | ikindi | aksam */
export function gokFazi(simdi, bugun) {
  let son = null;
  for (const e of bugun || []) if (e.ms <= simdi) son = e.key;
  return ({ Imsak: 'seher', Fajr: 'seher', Sunrise: 'sabah', Dhuhr: 'ogle', Asr: 'ikindi', Maghrib: 'aksam', Isha: 'gece' })[son] || 'gece';
}

// ---------------- Tema 2: güneş yayı ----------------
const G = { gen: 380, yuk: 196, cx: 190, ufuk: 146, rx: 172, ry: 124, geceR: 44 };   // geniş yay (kullanıcı isteği, 20-11-2026)
const gunduzNokta = (oran) => {                     // 0: Güneş (sol uç), 1: Akşam (sağ uç)
  const a = Math.PI * (1 - Math.min(1, Math.max(0, oran)));
  return { x: G.cx + G.rx * Math.cos(a), y: G.ufuk - G.ry * Math.sin(a) };
};
const geceNokta = (oran) => {                       // 0: Akşam (sağ uç), 1: ertesi Güneş (sol uç); ufkun altında
  const a = Math.PI * Math.min(1, Math.max(0, oran));
  return { x: G.cx + G.rx * Math.cos(a), y: G.ufuk + G.geceR * Math.sin(a) };
};

/**
 * @param {SVGSVGElement} svg
 * @param {object} o  { bugun, dun, yarin, simdi, siradaki (key), adlar (t.names) }
 */
export function gokYayCiz(svg, { bugun, dun, yarin, simdi, siradaki, adlar }) {
  const gunes = bul(bugun, 'Sunrise'), aksam = bul(bugun, 'Maghrib');
  svg.replaceChildren();
  if (!gunes || !aksam) return;
  const gunBoy = aksam.ms - gunes.ms;
  // gece: dünkü Akşam → bugünkü Güneş (sabah tarafı) ve bugünkü Akşam → yarınki Güneş (akşam tarafı)
  const dunAksam = bul(dun, 'Maghrib'), yarinGunes = bul(yarin, 'Sunrise');
  const sabahGece = { bas: dunAksam ? dunAksam.ms : aksam.ms - 864e5, bit: gunes.ms };
  const aksamGece = { bas: aksam.ms, bit: yarinGunes ? yarinGunes.ms : gunes.ms + 864e5 };
  const yer = (ms) => {
    if (ms >= gunes.ms && ms <= aksam.ms) return { ...gunduzNokta((ms - gunes.ms) / gunBoy), gece: false };
    const g = ms < gunes.ms ? sabahGece : aksamGece;
    return { ...geceNokta((ms - g.bas) / (g.bit - g.bas)), gece: true };
  };

  const sol = gunduzNokta(0), sag = gunduzNokta(1);
  el('line', { class: 'gy-ufuk', x1: 4, y1: G.ufuk, x2: G.gen - 4, y2: G.ufuk }, svg);
  el('path', { class: 'gy-gece', d: `M ${sag.x} ${sag.y} A ${G.rx} ${G.geceR} 0 0 1 ${sol.x} ${sol.y}` }, svg);
  el('path', { class: 'gy-gunduz', d: `M ${sol.x} ${sol.y} A ${G.rx} ${G.ry} 0 0 1 ${sag.x} ${sag.y}` }, svg);
  // gündüz yayında geçen kısım altın
  const gunduzOran = (simdi - gunes.ms) / gunBoy;
  if (gunduzOran > 0) {
    const p = gunduzNokta(gunduzOran);
    el('path', { class: 'gy-gecen', d: `M ${sol.x} ${sol.y} A ${G.rx} ${G.ry} 0 0 1 ${p.x} ${p.y}` }, svg);
  }

  // güneş (gündüz) ya da ay (gece) şimdiki yerinde
  const p = yer(simdi);
  if (!p.gece) {
    const g = el('g', { class: 'gy-gunes', transform: `translate(${p.x} ${p.y})` }, svg);
    el('circle', { r: 20, class: 'gy-isik' }, g);
    el('circle', { r: 10 }, g);
  } else {
    const g = el('g', { class: 'gy-ay', transform: `translate(${p.x} ${p.y})` }, svg);
    el('circle', { r: 16, class: 'gy-isik' }, g);
    el('path', { d: 'M 3 -9 A 9 9 0 1 0 9 4 A 7 7 0 1 1 3 -9 Z' }, g);
  }

  // vakitlerin noktaları; yayın üstünde ad ve saat yazılmaz (kullanıcı isteği, 20-11-2026: vakitler alttaki listede)
  for (const e of bugun) {
    const p = yer(e.ms);
    const namaz = NAMAZ.includes(e.key);
    el('circle', { class: `gy-nokta${e.key === siradaki ? ' siradaki' : ''}${e.ms <= simdi ? ' gecti' : ''}`, cx: p.x, cy: p.y, r: namaz ? 4.5 : 3 }, svg);
    if (e.key === siradaki) el('circle', { class: 'gy-halka', cx: p.x, cy: p.y, r: 9 }, svg);
  }

}

// ---------------- Tema 4: şimdi kartı, kalan süre halkası ----------------
const T4_CEVRE = 2 * Math.PI * 52;
/**
 * @param {object} o { bugun, simdi, onceki (ms), sonraki (ms), siradaki (key), simdiAd, saat, kalanYazi, adlar, ikonlar }
 */
export function zumrutCiz(kok, { bugun, simdi, onceki, sonraki, siradaki, simdiAd, saat, kalanYazi, simdiEtiket, kalanEtiket }) {
  kok.querySelector('.t4-etiket').textContent = simdiEtiket;
  kok.querySelector('.t4-ad').textContent = simdiAd;
  kok.querySelector('.t4-saat').textContent = saat;
  kok.querySelector('.t4-kalan').textContent = kalanYazi;
  kok.querySelector('.t4-kalan-etiket').textContent = kalanEtiket;
  const oran = onceki && sonraki && sonraki > onceki ? Math.min(1, Math.max(0, (simdi - onceki) / (sonraki - onceki))) : 0;
  const dolu = kok.querySelector('.t4-dolu');
  dolu.setAttribute('stroke-dasharray', `${(T4_CEVRE * oran).toFixed(1)} ${T4_CEVRE.toFixed(1)}`);
}
