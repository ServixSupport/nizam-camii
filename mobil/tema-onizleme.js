// Ayarlar'da tema seçimi: tam ekran canlı önizleme (kullanıcı isteği, 09-11-2026).
// Her tema, uygulamanın kendisi olarak iframe'de açılır (?onizleme=liste|klasik; yerel.js): saat ve sayaç işler, gerçekte nasılsa öyle görünür.
// Parmakla sağa sola kaydırılır. "Bu temayı seç" kaydeder; kapatınca hiçbir şey değişmez.
const STILLER = ['liste', 'klasik'];

/**
 * @param {object} o
 * @param {Function} o.L        geçerli dilin metinleri
 * @param {Function} o.mevcut   seçili tema: 'liste' | 'klasik'
 * @param {Function} o.sec      temayı kaydeder ve uygular
 * @param {object} [o.telefon]  Android mağaza uygulamasında eklenti (geri tuşu önizlemeyi kapatsın)
 */
export function temaOnizleme({ L, mevcut, sec, telefon = null }) {
  const $ = (s) => document.querySelector(s);
  const pencere = $('#tema-on');
  const serit = $('#to-serit');
  let sira = 0;

  const ad = (k) => (k === 'liste' ? L().stilListe : L().stilKlasik);

  function ciz() {
    const t = L();
    const k = STILLER[sira];
    const secili = k === mevcut();
    $('#to-ad').textContent = ad(k);
    $('#to-onceki').disabled = sira === 0;
    $('#to-sonraki').disabled = sira === STILLER.length - 1;
    $('#to-sec').textContent = secili ? t.temaSecili : t.temaSecDugme;
    $('#to-sec').disabled = secili;
  }

  function git(i, yumusak) {
    const azalt = matchMedia('(prefers-reduced-motion: reduce)').matches;
    serit.scrollTo({ left: i * serit.clientWidth, behavior: yumusak && !azalt ? 'smooth' : 'auto' });
  }

  function ac() {
    serit.replaceChildren(...STILLER.map((k) => {
      const slayt = document.createElement('div');
      slayt.className = 'to-slayt';
      const f = document.createElement('iframe');
      f.src = `${location.pathname}?onizleme=${k}`;
      f.title = ad(k);
      f.tabIndex = -1;
      f.setAttribute('inert', '');
      slayt.append(f);
      return slayt;
    }));
    sira = STILLER.indexOf(mevcut());
    pencere.showModal();
    git(sira, false);
    ciz();
    if (telefon) telefon.geriYakala({ acik: true }).catch(() => {});
  }

  serit.addEventListener('scroll', () => {
    const i = Math.min(STILLER.length - 1, Math.max(0, Math.round(serit.scrollLeft / (serit.clientWidth || 1))));
    if (i !== sira) { sira = i; ciz(); }
  }, { passive: true });

  $('#to-onceki').addEventListener('click', () => git(sira - 1, true));
  $('#to-sonraki').addEventListener('click', () => git(sira + 1, true));
  $('#to-kapat').addEventListener('click', () => pencere.close());
  $('#to-sec').addEventListener('click', () => { sec(STILLER[sira]); pencere.close(); });

  // kapanış (düğme, Esc, telefonun geri tuşu): iframe'ler kaldırılır, saatleri boşuna işlemesin
  pencere.addEventListener('close', () => {
    serit.replaceChildren();
    if (telefon) telefon.geriYakala({ acik: false }).catch(() => {});
  });
  document.addEventListener('camiGeri', () => { if (pencere.open) pencere.close(); });
  window.addEventListener('resize', () => { if (pencere.open) git(sira, false); });   // döndürünce aynı temada kalsın

  return { ac };
}
