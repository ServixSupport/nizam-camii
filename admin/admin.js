// /admin — yönetim paneli (Faz B). Arayüz Türkçe. Kayıt: /api/admin/kaydet (anahtar + doğrulama + etag).
// Anahtar: /admin#anahtar=… bir kez açılır, bu cihazda saklanır, adres çubuğundan silinir (S3).
import { dogrula, GRUPLAR, SINIR } from '/veri/dogrula.js';
import { gunOlaylari, diyanetGunu, amsGun, amsParcalar, gunEkle } from '/mobil/zaman.js';
import { faaliyetBaslangic, faaliyetBitis, programZamani, programGunde, gununProgramlari, haftaGunleri, saatYaz } from '/mobil/icerik.js';
import { h } from '/mobil/ekranlar.js';

const ANAHTAR = 'nzm.admin.anahtar';
const DILLER = [['tr', 'TR'], ['nl', 'NL'], ['en', 'EN']];
const GRUP_AD = { herkes: 'Herkes', erkekler: 'Erkekler', hanimlar: 'Hanımlar', genclik: 'Gençlik', cocuklar: 'Çocuklar' };
const VAKIT_AD = { Fajr: 'Sabah', Dhuhr: 'Öğle', Asr: 'İkindi', Maghrib: 'Akşam', Isha: 'Yatsı' };
const GUN_KISA = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const KAYIT_MESAJI = 'Kaydedildi. Birkaç dakika içinde uygulamada görünür.';

const $ = (s) => document.querySelector(s);
const S = { icerik: null, etag: null, yetkili: false, anahtarTanimli: true, vakit: new Map(), taslak: null, tur: null, dil: 'tr', hatalar: {}, siliniyor: null, mesgul: false };

// ---------------- anahtar ----------------
(function anahtarAl() {
  const m = location.hash.match(/anahtar=([^&]+)/);
  if (!m) return;
  try { localStorage.setItem(ANAHTAR, decodeURIComponent(m[1]).trim()); } catch { /* özel mod */ }
  history.replaceState(null, '', location.pathname + '#faaliyetler');
})();
const anahtar = () => { try { return localStorage.getItem(ANAHTAR) || ''; } catch { return ''; } };
const yetkiBasligi = () => (anahtar() ? { Authorization: `Bearer ${anahtar()}` } : {});

// ---------------- yardımcılar ----------------
const doldur = (kap, ...c) => kap.replaceChildren(...c.flat(Infinity).filter((x) => x != null && x !== false));
const rastgele = (n = 6) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
const kopya = (o) => JSON.parse(JSON.stringify(o));
const ilkBaslik = (b) => (b && (b.tr || b.nl || b.en)) || '(başlıksız)';
function tarihYazi(ymd, uzun = true) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', weekday: uzun ? 'long' : undefined, day: 'numeric', month: 'long' }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}
const saatAl = (s) => (s || '').slice(11, 16);
function bildir(metin) {
  const el = $('#bildirim');
  el.textContent = metin; el.classList.add('acik');
  clearTimeout(bildir.t); bildir.t = setTimeout(() => el.classList.remove('acik'), 4000);
}
function uyar(metin, dugme) {
  const el = $('#uyari');
  if (!metin) { el.hidden = true; return; }
  doldur(el, h('span', { metin }), dugme || null);
  el.hidden = false;
}

// ---------------- sunucu ----------------
async function yukle() {
  const r = await fetch('/api/admin/veri', { headers: yetkiBasligi(), cache: 'no-store' });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) throw new Error((j && j.hata) || 'İçerik okunamadı.');
  Object.assign(S, { icerik: j.icerik, etag: j.etag, yetkili: j.yetkili, anahtarTanimli: j.anahtarTanimli, anahtarDurumu: j.anahtarDurumu });
}
async function vakitYukle() {
  try {
    const r = await fetch('/api/vakit', { cache: 'no-store' });     // parametresiz (CDN cache)
    const j = await r.json();
    if (j && j.available) S.vakit = new Map(j.days.map((d) => [d.date, d]));
  } catch { /* yardımcı satır olmadan da çalışır */ }
}
const olaylar = (ymd) => {
  const x = S.vakit.get(ymd.split('-').reverse().join('.'));
  return x ? gunOlaylari(diyanetGunu(x), ymd) : [];
};

/** Yeni içeriği kaydeder. Başarılıysa true. */
async function kaydet(yeni) {
  if (S.mesgul) return false;
  S.mesgul = true; dugmeleriKilitle(true);
  try {
    const r = await fetch('/api/admin/kaydet', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...yetkiBasligi() },
      body: JSON.stringify({ icerik: yeni, etag: S.etag }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { S.icerik = j.icerik; S.etag = j.etag; uyar(''); bildir(KAYIT_MESAJI); return true; }
    if (r.status === 409) {
      uyar(j.hata || 'Başka biri bu arada değiştirdi.', h('button', { type: 'button', class: 'dugme kucuk', onclick: () => location.reload(), metin: 'Sayfayı yenile' }));
    } else if (r.status === 401) {
      S.yetkili = false; yetkiYaz();
      uyar('Bu cihaz yetkili değil. Değişiklik kaydedilmedi. Yönetici linkini bu cihazda bir kez açın.');
    } else if (r.status === 400 && Array.isArray(j.hatalar)) {
      hatalariGoster(j.hatalar);
      uyar('Bazı alanlarda hata var. Kırmızı yazılara bakın.');
    } else {
      uyar(j.hata || 'Kaydedilemedi. İnternet bağlantısını kontrol edip tekrar deneyin.');
    }
    return false;
  } catch {
    uyar('Kaydedilemedi. İnternet bağlantısını kontrol edip tekrar deneyin.');
    return false;
  } finally {
    S.mesgul = false; dugmeleriKilitle(false);
  }
}
function dugmeleriKilitle(kilit) {
  for (const b of document.querySelectorAll('[data-kayit]')) b.disabled = kilit || !S.yetkili;
}

// ---------------- resim: tarayıcıda küçült, EXIF'i at, JPEG ----------------
async function resmiHazirla(dosya) {
  const bmp = await createImageBitmap(dosya, { imageOrientation: 'from-image' });
  const olcek = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const tuval = document.createElement('canvas');
  tuval.width = Math.round(bmp.width * olcek); tuval.height = Math.round(bmp.height * olcek);
  tuval.getContext('2d').drawImage(bmp, 0, 0, tuval.width, tuval.height);
  let blob = null;
  for (const q of [0.82, 0.72, 0.62, 0.52]) {
    blob = await new Promise((r) => tuval.toBlob(r, 'image/jpeg', q));
    if (blob && blob.size <= 420 * 1024) break;
  }
  return blob;
}
async function resimYukle(dosya) {
  const blob = await resmiHazirla(dosya);
  const b64 = await new Promise((ok, red) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1]); fr.onerror = red; fr.readAsDataURL(blob); });
  const r = await fetch('/api/admin/resim', { method: 'POST', headers: { 'Content-Type': 'application/json', ...yetkiBasligi() }, body: JSON.stringify({ veri: b64 }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.hata || 'Resim yüklenemedi.');
  return j.url;
}

// ---------------- yönlendirme ----------------
function yol() {
  const a = decodeURIComponent(location.hash.slice(1));
  let m;
  if ((m = a.match(/^(faaliyet|kopya|program)\/([fp]-[a-z0-9]{4,12})$/))) return { sayfa: 'form', islem: m[1], id: m[2] };
  if (a === 'yeni-faaliyet' || a === 'yeni-program') return { sayfa: 'form', islem: a, id: null };
  return { sayfa: a === 'programlar' ? 'programlar' : 'faaliyetler' };
}
function goster() {
  const y = yol();
  if (!S.icerik) return;
  $('#yukleniyor').hidden = true;
  for (const s of document.querySelectorAll('main > section')) s.hidden = s.dataset.sekme !== y.sayfa;
  const menu = y.sayfa === 'form' ? (S.tur === 'program' || /program/.test(y.islem) ? 'programlar' : 'faaliyetler') : y.sayfa;
  for (const a of document.querySelectorAll('.sekmeler a')) {
    if (a.dataset.sekme === menu) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  S.siliniyor = null;
  if (y.sayfa === 'faaliyetler') faaliyetListesi();
  else if (y.sayfa === 'programlar') programListesi();
  else formAc(y);
  window.scrollTo(0, 0);
}

function yetkiYaz() {
  const el = $('#yetki');
  el.className = 'yetki ' + (S.yetkili ? 'var' : 'yok');
  el.textContent = S.yetkili ? 'Bu cihaz yetkili' : 'Bu cihaz yetkili değil';
  $('#yetki-kaldir').hidden = !anahtar();
  if (S.anahtarDurumu === 'kisa') uyar('Sunucudaki ADMIN_ANAHTAR çok kısa (en az 32 karakter olmalı): şimdilik kimse kaydedemez. Vercel’de yeni ve uzun bir anahtar girin.');
  else if (!S.anahtarTanimli) uyar('Sunucuda ADMIN_ANAHTAR tanımlı değil: şimdilik kimse kaydedemez. (Vercel → Settings → Environment Variables)');
  else if (!S.yetkili) uyar('Bu cihaz yetkili değil: sayfayı görebilirsiniz ama kaydedemezsiniz. Yönetici linkini (…/admin#anahtar=…) bu cihazda bir kez açın.');
}

// ---------------- Faaliyetler listesi ----------------
function faaliyetListesi() {
  const simdi = Date.now();
  const hepsi = [...S.icerik.faaliyetler].sort((a, b) => faaliyetBaslangic(a) - faaliyetBaslangic(b));
  const gelecek = hepsi.filter((f) => faaliyetBitis(f) > simdi);
  const gecmis = hepsi.filter((f) => faaliyetBitis(f) <= simdi).reverse();
  doldur($('#s-faaliyetler'),
    h('div', { class: 'baslik-satir' }, h('h1', { metin: 'Faaliyetler' }),
      h('a', { class: 'dugme dolu', href: '#yeni-faaliyet', metin: '+ Yeni faaliyet' })),
    gelecek.length ? h('ul', { class: 'liste' }, gelecek.map(faaliyetSatiri)) : h('p', { class: 'bos', metin: 'Yaklaşan faaliyet yok. "Yeni faaliyet" ile ekleyin.' }),
    gecmis.length ? h('details', { class: 'gecmis' }, h('summary', { metin: `Geçmiş faaliyetler (${gecmis.length})` }), h('ul', { class: 'liste' }, gecmis.map(faaliyetSatiri))) : null);
  dugmeleriKilitle(false);
}
function faaliyetSatiri(f) {
  const ymd = f.baslangic.slice(0, 10);
  const [, , gun] = ymd.split('-');
  const zaman = f.tumGun ? 'Tüm gün' : saatAl(f.baslangic) + (f.bitis ? `–${saatAl(f.bitis)}` : '');
  const ay = new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', month: 'short' }).format(new Date(`${ymd}T12:00:00Z`)).toLocaleUpperCase('tr');
  return h('li', { class: 'satir', 'data-id': f.id },
    h('span', { class: 'tarih-kutu', 'aria-hidden': 'true' }, h('b', { metin: +gun }), h('span', { metin: ay })),
    h('span', { class: 'satir-metin' },
      h('span', { class: 'satir-baslik' }, ilkBaslik(f.baslik), f.oneCikan ? h('span', { class: 'yildiz', title: 'Öne çıkan', 'aria-label': 'öne çıkan', metin: ' ★' }) : null),
      h('span', { class: 'satir-meta', metin: `${tarihYazi(ymd)} · ${zaman} · ${GRUP_AD[f.grup]}` })),
    h('span', { class: `rozet ${f.yayinda ? 'yayinda' : 'taslak'}`, metin: f.yayinda ? 'Yayında' : 'Taslak' }),
    satirDugmeleri('faaliyet', f.id, ilkBaslik(f.baslik)));
}
function satirDugmeleri(tur, id, ad) {
  if (S.siliniyor === id) {
    return h('span', { class: 'satir-dugmeler onay', role: 'group', 'aria-label': 'Silme onayı' },
      h('span', { metin: 'Silinsin mi?' }),
      h('button', { type: 'button', class: 'dugme tehlike kucuk', 'data-kayit': '', onclick: () => sil(tur, id), metin: 'Evet, sil' }),
      h('button', { type: 'button', class: 'dugme kucuk', onclick: () => { S.siliniyor = null; goster(); }, metin: 'Vazgeç' }));
  }
  return h('span', { class: 'satir-dugmeler' },
    h('a', { class: 'dugme kucuk', href: `#${tur}/${id}`, 'aria-label': `${ad}: düzenle`, metin: 'Düzenle' }),
    tur === 'faaliyet' ? h('a', { class: 'dugme kucuk', href: `#kopya/${id}`, 'aria-label': `${ad}: kopyala`, metin: 'Kopyala' }) : null,
    h('button', { type: 'button', class: 'dugme kucuk', 'data-kayit': '', 'aria-label': `${ad}: sil`, onclick: () => { S.siliniyor = id; tur === 'faaliyet' ? faaliyetListesi() : programListesi(); }, metin: 'Sil' }));
}
async function sil(tur, id) {
  const yeni = kopya(S.icerik);
  if (tur === 'faaliyet') yeni.faaliyetler = yeni.faaliyetler.filter((x) => x.id !== id);
  else yeni.programlar = yeni.programlar.filter((x) => x.id !== id);
  if (await kaydet(yeni)) bildir('Silindi. ' + KAYIT_MESAJI);
  S.siliniyor = null;
  goster();
}

// ---------------- Programlar listesi + haftalık küçük tablo ----------------
function programListesi() {
  const bugun = amsGun(Date.now());
  const gunler = haftaGunleri(bugun);
  const liste = [...S.icerik.programlar].sort((a, b) => (a.gunler[0] || 9) - (b.gunler[0] || 9) || ilkBaslik(a.baslik).localeCompare(ilkBaslik(b.baslik), 'tr'));
  const tablo = h('div', { class: 'mini-tablo', role: 'group', 'aria-label': 'Bu haftanın programları' },
    gunler.map((g) => h('div', { class: 'mt-gun' + (g.ymd === bugun ? ' bugun' : '') },
      h('span', { class: 'mt-ad', metin: `${GUN_KISA[g.hg - 1]} ${+g.ymd.slice(8)}` }),
      gununProgramlari(S.icerik.programlar, g.ymd, g.hg, olaylar(g.ymd)).map(({ p, zaman }) => h('a', {
        class: 'mt-blok', href: `#program/${p.id}`, style: { '--g': `var(--g-${p.grup})`, '--gt': `var(--gt-${p.grup})` },
      }, h('span', { class: 'mt-saat', metin: zaman.bas == null ? `${VAKIT_AD[zaman.vakit]} ${zaman.fark ? 'sonrası' : 'vaktinde'}` : saatYaz(zaman.bas) }),
      h('span', { class: 'mt-baslik', metin: ilkBaslik(p.baslik) }))))));
  doldur($('#s-programlar'),
    h('div', { class: 'baslik-satir' }, h('h1', { metin: 'Programlar' }), h('a', { class: 'dugme dolu', href: '#yeni-program', metin: '+ Yeni program' })),
    S.icerik.programlar.length ? tablo : null,
    liste.length ? h('ul', { class: 'liste' }, liste.map((p) => h('li', { class: 'satir', 'data-id': p.id },
      h('span', { class: 'satir-metin' },
        h('span', { class: 'satir-baslik', metin: ilkBaslik(p.baslik) }),
        h('span', { class: 'satir-meta', metin: `${p.gunler.map((g) => GUN_KISA[g - 1]).join(', ')} · ${programSaatYazi(p)} · ${GRUP_AD[p.grup]}` })),
      h('span', { class: `rozet ${p.aktif ? 'yayinda' : 'taslak'}`, metin: p.aktif ? 'Aktif' : 'Pasif' }),
      satirDugmeleri('program', p.id, ilkBaslik(p.baslik)))))
      : h('p', { class: 'bos', metin: 'Henüz program yok. "Yeni program" ile ekleyin.' }));
  dugmeleriKilitle(false);
}
function programSaatYazi(p) {
  const s = p.saat;
  if (s.tip === 'sabit') return `${s.baslangic}–${s.bitis}`;
  return `${VAKIT_AD[s.vakit]} ${s.fark ? `+${s.fark} dk` : 'vaktinde'} (${s.sure} dk)`;
}

// ---------------- formlar ----------------
const bosMetin = () => ({ tr: '', nl: '', en: '' });
function yeniFaaliyet() {
  const yarin = gunEkle(amsGun(Date.now()), 1);
  return { id: 'f-' + rastgele(), grup: 'herkes', baslik: bosMetin(), aciklama: bosMetin(), baslangic: `${yarin}T10:00`, bitis: null,
    tumGun: false, yer: '', resim: '', link: '', oneCikan: false, yayinda: true };
}
function yeniProgram() {
  return { id: 'p-' + rastgele(), grup: 'herkes', baslik: bosMetin(), aciklama: bosMetin(), gunler: [], saat: { tip: 'sabit', baslangic: '19:00', bitis: '20:00' },
    yer: '', hoca: '', gecerliBaslangic: null, gecerliBitis: null, aktif: true };
}

function formAc(y) {
  S.hatalar = {}; S.dil = 'tr';
  if (y.islem === 'yeni-faaliyet') { S.tur = 'faaliyet'; S.taslak = yeniFaaliyet(); S.yeni = true; }
  else if (y.islem === 'yeni-program') { S.tur = 'program'; S.taslak = yeniProgram(); S.yeni = true; }
  else if (y.islem === 'program') {
    const p = S.icerik.programlar.find((x) => x.id === y.id);
    if (!p) { location.hash = '#programlar'; return; }
    S.tur = 'program'; S.taslak = kopya(p); S.yeni = false;
  } else {
    const f = S.icerik.faaliyetler.find((x) => x.id === y.id);
    if (!f) { location.hash = '#faaliyetler'; return; }
    S.tur = 'faaliyet'; S.taslak = kopya(f); S.yeni = y.islem === 'kopya';
    if (S.yeni) { S.taslak.id = 'f-' + rastgele(); S.taslak.yayinda = false; }
  }
  formCiz();
}

function alan(etiket, kimlik, kontrol, ipucu, hataAnahtari) {
  const hata = S.hatalar[hataAnahtari || kimlik];
  if (hata) { kontrol.setAttribute('aria-invalid', 'true'); kontrol.setAttribute('aria-describedby', `h-${kimlik}`); }
  return h('div', { class: 'alan' + (hata ? ' hatali' : '') },
    h('label', { for: kimlik, metin: etiket }), kontrol,
    ipucu ? h('span', { class: 'ipucu', metin: ipucu }) : null,
    hata ? h('span', { class: 'hata', id: `h-${kimlik}`, metin: hata }) : null);
}
const girdi = (ozellik, deger, degisti) => h('input', { ...ozellik, value: deger ?? '', oninput: (e) => degisti(e.target.value) });
const secim = (kimlik, secenekler, deger, degisti) => h('select', { id: kimlik, onchange: (e) => degisti(e.target.value) },
  secenekler.map(([d, ad]) => h('option', { value: d, selected: d === deger, metin: ad })));
const onay = (kimlik, etiket, deger, degisti) => h('label', { class: 'onay-kutu', for: kimlik },
  h('input', { type: 'checkbox', id: kimlik, checked: !!deger, onchange: (e) => degisti(e.target.checked) }), h('span', { metin: etiket }));

function dilSekmeleri() {
  const t = S.taslak;
  return h('div', { class: 'dil-sekmeleri', role: 'tablist', 'aria-label': 'Dil' }, DILLER.map(([d, ad]) => h('button', {
    type: 'button', role: 'tab', 'aria-selected': String(S.dil === d), id: `dil-${d}`,
    onclick: () => { S.dil = d; formCiz(); document.getElementById(`dil-${d}`).focus(); },
  }, ad, (t.baslik[d] || t.aciklama[d]) ? h('i', { 'aria-label': ' (dolu)' }) : null)));
}
function dilAlanlari() {
  const t = S.taslak, d = S.dil;
  return h('div', { class: 'dil-panel', role: 'tabpanel', 'aria-labelledby': `dil-${d}` },
    alan(`Başlık (${d.toUpperCase()})`, 'baslik', girdi({ id: 'baslik', maxlength: SINIR.baslik, lang: d }, t.baslik[d], (v) => { t.baslik[d] = v; onizle(); }),
      d === 'tr' ? 'En az bir dilde başlık zorunlu. Boş bırakılan dilde Türkçesi gösterilir.' : 'Boş bırakırsanız uygulamada Türkçesi gösterilir.', 'baslik'),
    alan(`Açıklama (${d.toUpperCase()})`, 'aciklama', h('textarea', { id: 'aciklama', rows: 5, maxlength: SINIR.aciklama, lang: d, oninput: (e) => { t.aciklama[d] = e.target.value; onizle(); } }, t.aciklama[d] || ''), 'İsteğe bağlı.', 'aciklama'));
}

function formCiz() {
  const faaliyet = S.tur === 'faaliyet';
  const baslik = faaliyet ? (S.yeni ? 'Yeni faaliyet' : 'Faaliyeti düzenle') : (S.yeni ? 'Yeni program' : 'Programı düzenle');
  const geri = faaliyet ? '#faaliyetler' : '#programlar';
  doldur($('#s-form'),
    h('a', { class: 'geri', href: geri, metin: faaliyet ? '‹ Faaliyetler' : '‹ Programlar' }),
    h('h1', { metin: baslik }),
    S.hatalar.genel ? h('p', { class: 'hata', role: 'alert', metin: S.hatalar.genel }) : null,
    h('form', { class: 'form', novalidate: true, onsubmit: (e) => { e.preventDefault(); gonder(); } },
      h('div', { class: 'form-izgara' },
        h('div', { class: 'alanlar' }, dilSekmeleri(), dilAlanlari(), faaliyet ? faaliyetAlanlari() : programAlanlari()),
        h('aside', { class: 'onizleme', 'aria-label': 'Önizleme' }, h('h2', { metin: 'Uygulamada önizleme' }), h('div', { id: 'onizleme' }))),
      h('div', { class: 'form-alt' },
        h('button', { type: 'submit', class: 'dugme dolu', 'data-kayit': '', metin: 'Kaydet' }),
        h('a', { class: 'dugme', href: geri, metin: 'Vazgeç' }),
        !S.yetkili ? h('span', { class: 'ipucu', metin: 'Bu cihaz yetkili değil: kaydedilemez.' }) : null)));
  onizle();
  dugmeleriKilitle(false);
}

function faaliyetAlanlari() {
  const t = S.taslak;
  const tarih = t.baslangic.slice(0, 10);
  const bitisTarih = t.bitis ? t.bitis.slice(0, 10) : '';
  const cokGun = !!(t.bitis && bitisTarih !== tarih);
  const yaz = () => { onizle(); };
  const tarihAyarla = (yeniTarih, saat, bitisSaat, bitisGun) => {
    const bas = `${yeniTarih}T${t.tumGun ? '00:00' : saat}`;
    t.baslangic = bas;
    if (t.tumGun) t.bitis = bitisGun && bitisGun !== yeniTarih ? `${bitisGun}T00:00` : null;
    else t.bitis = bitisSaat ? `${bitisGun || yeniTarih}T${bitisSaat}` : null;
    yaz();
  };
  const durum = () => ({ tarih: $('#f-tarih').value, saat: ($('#f-saat') || {}).value || '10:00', bitisSaat: ($('#f-bitis-saat') || {}).value || '', bitisGun: ($('#f-bitis-tarih') || {}).value || '' });
  const guncelle = () => { const d = durum(); tarihAyarla(d.tarih, d.saat, d.bitisSaat, $('#f-cok-gun') && $('#f-cok-gun').checked ? d.bitisGun : ''); };

  return [
    alan('Grup', 'f-grup', secim('f-grup', GRUPLAR.map((g) => [g, GRUP_AD[g]]), t.grup, (v) => { t.grup = v; yaz(); }), null, 'grup'),
    h('div', { class: 'alan-satir' },
      alan('Tarih', 'f-tarih', h('input', { type: 'date', id: 'f-tarih', value: tarih, required: true, onchange: guncelle }), null, 'baslangic'),
      t.tumGun ? null : alan('Başlangıç saati', 'f-saat', h('input', { type: 'time', id: 'f-saat', value: saatAl(t.baslangic), onchange: guncelle })),
      t.tumGun ? null : alan('Bitiş saati', 'f-bitis-saat', h('input', { type: 'time', id: 'f-bitis-saat', value: t.bitis ? saatAl(t.bitis) : '', onchange: guncelle }), 'İsteğe bağlı', 'bitis')),
    h('div', { class: 'alan-satir onaylar' },
      onay('f-tum-gun', 'Tüm gün', t.tumGun, (v) => { t.tumGun = v; guncelleTumGun(v); }),
      onay('f-cok-gun', 'Birden fazla gün sürer', cokGun, (v) => { if (!v) { t.bitis = t.tumGun ? null : (t.bitis ? `${t.baslangic.slice(0, 10)}T${saatAl(t.bitis)}` : null); } else { t.bitis = `${gunEkle(t.baslangic.slice(0, 10), 1)}T${t.tumGun ? '00:00' : (saatAl(t.bitis) || '18:00')}`; } formCiz(); })),
    cokGun ? alan('Bitiş tarihi', 'f-bitis-tarih', h('input', { type: 'date', id: 'f-bitis-tarih', value: bitisTarih, min: tarih, onchange: guncelle }), null, 'bitis') : null,
    alan('Yer', 'f-yer', girdi({ id: 'f-yer', maxlength: SINIR.yer, placeholder: 'ör. Konferans salonu' }, t.yer, (v) => { t.yer = v; yaz(); }), null, 'yer'),
    resimAlani(),
    alan('Link', 'f-link', girdi({ id: 'f-link', type: 'url', inputmode: 'url', maxlength: SINIR.link, placeholder: 'https://…' }, t.link, (v) => { t.link = v.trim(); yaz(); }), 'İsteğe bağlı. Sadece https:// ile başlayan adresler.', 'link'),
    h('div', { class: 'alan-satir onaylar' },
      onay('f-one', 'Öne çıkan (büyük kartta göster)', t.oneCikan, (v) => { t.oneCikan = v; yaz(); }),
      onay('f-yayinda', 'Yayında (kapalıysa taslak, uygulamada görünmez)', t.yayinda, (v) => { t.yayinda = v; yaz(); })),
  ];

  function guncelleTumGun(v) {
    const d = t.baslangic.slice(0, 10);
    t.baslangic = `${d}T${v ? '00:00' : '10:00'}`;
    t.bitis = null;
    formCiz();
  }
}

function resimAlani() {
  const t = S.taslak;
  const durumEl = h('span', { class: 'ipucu', id: 'resim-durum', metin: 'İsteğe bağlı. Resim küçültülür; konum bilgisi silinir.' });
  return h('div', { class: 'alan' + (S.hatalar.resim ? ' hatali' : '') },
    h('label', { for: 'f-resim', metin: 'Resim' }),
    t.resim ? h('div', { class: 'resim-on' }, h('img', { src: t.resim, alt: '' }),
      h('button', { type: 'button', class: 'dugme kucuk', onclick: () => { t.resim = ''; formCiz(); }, metin: 'Resmi kaldır' })) : null,
    h('input', { type: 'file', id: 'f-resim', accept: 'image/*', disabled: !S.yetkili, onchange: async (e) => {
      const dosya = e.target.files && e.target.files[0];
      if (!dosya) return;
      durumEl.textContent = 'Resim hazırlanıyor ve yükleniyor…';
      try { t.resim = await resimYukle(dosya); formCiz(); bildir('Resim yüklendi. Kaydetmeyi unutmayın.'); }
      catch (err) { durumEl.textContent = err.message || 'Resim yüklenemedi.'; }
    } }),
    durumEl,
    S.hatalar.resim ? h('span', { class: 'hata', metin: S.hatalar.resim }) : null);
}

function programAlanlari() {
  const t = S.taslak;
  const s = t.saat;
  const yaz = () => onizle();
  return [
    alan('Grup', 'p-grup', secim('p-grup', GRUPLAR.map((g) => [g, GRUP_AD[g]]), t.grup, (v) => { t.grup = v; yaz(); }), null, 'grup'),
    h('fieldset', { class: 'alan' + (S.hatalar.gunler ? ' hatali' : '') }, h('legend', { metin: 'Günler' }),
      h('div', { class: 'gun-dugmeleri' }, GUN_KISA.map((ad, i) => h('button', {
        type: 'button', 'aria-pressed': String(t.gunler.includes(i + 1)),
        onclick: () => { t.gunler = t.gunler.includes(i + 1) ? t.gunler.filter((x) => x !== i + 1) : [...t.gunler, i + 1].sort(); formCiz(); },
        metin: ad,
      }))),
      S.hatalar.gunler ? h('span', { class: 'hata', metin: S.hatalar.gunler }) : null),
    h('fieldset', { class: 'alan' }, h('legend', { metin: 'Saat' }),
      h('div', { class: 'secenek-satir' },
        radyo('p-tip', 'sabit', 'Sabit saat', s.tip === 'sabit', () => { t.saat = { tip: 'sabit', baslangic: '19:00', bitis: '20:00' }; formCiz(); }),
        radyo('p-tip', 'vakit', 'Vakte bağlı (mevsime göre kayar)', s.tip === 'vakit', () => { t.saat = { tip: 'vakit', vakit: 'Isha', fark: 0, sure: 60 }; formCiz(); }))),
    s.tip === 'sabit'
      ? h('div', { class: 'alan-satir' },
        alan('Başlangıç', 'p-bas', h('input', { type: 'time', id: 'p-bas', value: s.baslangic, onchange: (e) => { s.baslangic = e.target.value; yaz(); } }), null, 'saat.baslangic'),
        alan('Bitiş', 'p-bit', h('input', { type: 'time', id: 'p-bit', value: s.bitis, onchange: (e) => { s.bitis = e.target.value; yaz(); } }), null, 'saat.bitis'))
      : h('div', { class: 'alan-satir' },
        alan('Vakit', 'p-vakit', secim('p-vakit', Object.entries(VAKIT_AD), s.vakit, (v) => { s.vakit = v; yaz(); }), null, 'saat.vakit'),
        alan('Vakitten kaç dk sonra', 'p-fark', h('input', { type: 'number', id: 'p-fark', min: 0, max: 240, step: 5, value: s.fark, oninput: (e) => { s.fark = Number(e.target.value); yaz(); } }), '0 = vaktinde', 'saat.fark'),
        alan('Süre (dk)', 'p-sure', h('input', { type: 'number', id: 'p-sure', min: 10, max: 600, step: 5, value: s.sure, oninput: (e) => { s.sure = Number(e.target.value); yaz(); } }), null, 'saat.sure')),
    h('p', { class: 'yardim', id: 'sonraki' }),
    alan('Yer', 'p-yer', girdi({ id: 'p-yer', maxlength: SINIR.yer, placeholder: 'ör. Ana salon' }, t.yer, (v) => { t.yer = v; yaz(); }), null, 'yer'),
    alan('Hoca', 'p-hoca', girdi({ id: 'p-hoca', maxlength: SINIR.hoca }, t.hoca, (v) => { t.hoca = v; yaz(); }), 'İsteğe bağlı.', 'hoca'),
    h('div', { class: 'alan-satir' },
      alan('Geçerlilik başlangıcı', 'p-gb', h('input', { type: 'date', id: 'p-gb', value: t.gecerliBaslangic || '', onchange: (e) => { t.gecerliBaslangic = e.target.value || null; yaz(); } }), 'İsteğe bağlı', 'gecerliBaslangic'),
      alan('Geçerlilik bitişi', 'p-gs', h('input', { type: 'date', id: 'p-gs', value: t.gecerliBitis || '', onchange: (e) => { t.gecerliBitis = e.target.value || null; yaz(); } }), 'İsteğe bağlı', 'gecerliBitis')),
    h('div', { class: 'alan-satir onaylar' }, onay('p-aktif', 'Aktif (kapalıysa uygulamada görünmez)', t.aktif, (v) => { t.aktif = v; yaz(); })),
  ];
}
const radyo = (ad, deger, etiket, secili, sec) => h('label', { class: 'onay-kutu' },
  h('input', { type: 'radio', name: ad, value: deger, checked: secili, onchange: sec }), h('span', { metin: etiket }));

// ---------------- önizleme ----------------
function onizle() {
  const kap = document.getElementById('onizleme');
  if (!kap) return;
  const t = S.taslak, d = S.dil;
  const baslik = t.baslik[d] || t.baslik.tr || t.baslik.nl || t.baslik.en || '(başlık)';
  const stil = { '--g': `var(--g-${t.grup})`, '--gt': `var(--gt-${t.grup})` };
  if (S.tur === 'faaliyet') {
    const ymd = t.baslangic.slice(0, 10);
    const zaman = t.tumGun ? 'Tüm gün' : saatAl(t.baslangic) + (t.bitis ? ` – ${saatAl(t.bitis)}` : '');
    const ay = new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', month: 'short' }).format(new Date(`${ymd}T12:00:00Z`)).toLocaleUpperCase('tr');
    doldur(kap,
      t.yayinda ? null : h('p', { class: 'rozet taslak', metin: 'Taslak: uygulamada görünmez' }),
      h('div', { class: 'on-kart' + (t.oneCikan ? ' one' : ''), style: stil },
        h('span', { class: 'tarih-kutu' }, h('b', { metin: +ymd.slice(8) }), h('span', { metin: ay })),
        h('span', { class: 'satir-metin' },
          t.oneCikan ? h('span', { class: 'on-etiket', metin: 'ÖNE ÇIKAN' }) : null,
          h('span', { class: 'satir-baslik', metin: baslik }),
          h('span', { class: 'satir-meta', metin: [`${tarihYazi(ymd)} · ${zaman}`, t.yer].filter(Boolean).join(' · ') }),
          h('span', { class: 'grup-adi', metin: GRUP_AD[t.grup] }))),
      t.resim ? h('img', { class: 'on-resim', src: t.resim, alt: '' }) : null,
      (t.aciklama[d] || t.aciklama.tr) ? h('p', { class: 'on-aciklama', metin: t.aciklama[d] || t.aciklama.tr }) : null);
  } else {
    const sonraki = sonrakiProgram(t);
    const el = document.getElementById('sonraki');
    if (el) el.textContent = sonraki ? `Sonraki: ${sonraki}` : 'Önümüzdeki iki haftada bu programın günü yok.';
    doldur(kap,
      t.aktif ? null : h('p', { class: 'rozet taslak', metin: 'Pasif: uygulamada görünmez' }),
      h('div', { class: 'on-kart', style: stil },
        h('span', { class: 'satir-metin' },
          h('span', { class: 'satir-baslik', metin: baslik }),
          h('span', { class: 'satir-meta', metin: [t.gunler.map((g) => GUN_KISA[g - 1]).join(', ') || '(gün seçilmedi)', programSaatYazi(t), t.yer].filter(Boolean).join(' · ') }),
          t.hoca ? h('span', { class: 'satir-meta', metin: `Hoca: ${t.hoca}` }) : null,
          h('span', { class: 'grup-adi', metin: GRUP_AD[t.grup] }))));
  }
}
/** "Salı 27 Ekim ≈ 20:39" — önümüzdeki 14 günde ilk uygun gün */
function sonrakiProgram(p) {
  const simdi = Date.now();
  const bugun = amsGun(simdi);
  const dk = amsParcalar(simdi).h * 60 + amsParcalar(simdi).mi;
  for (let i = 0; i < 14; i++) {
    const ymd = gunEkle(bugun, i);
    const hg = amsParcalar(simdi + i * 864e5).hg;
    if (!programGunde({ ...p, aktif: true }, ymd, hg)) continue;
    const z = programZamani(p, olaylar(ymd));
    if (i === 0 && z.bas != null && z.bas < dk) continue;
    const saat = z.bas == null ? `${VAKIT_AD[z.vakit]} ${z.fark ? 'sonrası' : 'vaktinde'}` : (z.vakteBagli ? `≈ ${saatYaz(z.bas)}` : saatYaz(z.bas));
    return `${tarihYazi(ymd)} ${saat}`;
  }
  return '';
}

// ---------------- kaydet (form) ----------------
function hatalariGoster(hatalar) {
  const onek = S.tur === 'faaliyet' ? 'faaliyetler' : 'programlar';
  const liste = S.tur === 'faaliyet' ? S.icerik.faaliyetler : S.icerik.programlar;
  const sira = S.yeni ? liste.length : liste.findIndex((x) => x.id === S.taslak.id);
  S.hatalar = {};
  for (const hta of hatalar) {
    const m = hta.yol.match(/^(\w+)\[(\d+)\]\.(.+)$/);
    if (!m || m[1] !== onek || +m[2] !== sira) continue;
    const anahtarAd = m[3].replace(/\.(tr|nl|en)$/, '');
    if (!S.hatalar[anahtarAd]) S.hatalar[anahtarAd] = hta.mesaj;
  }
  if (!Object.keys(S.hatalar).length && hatalar.length) S.hatalar.genel = hatalar[0].mesaj;
  formCiz();
  const ilk = document.querySelector('[aria-invalid="true"]');
  if (ilk) ilk.focus();
}

async function gonder() {
  if (!S.yetkili) { uyar('Bu cihaz yetkili değil: kaydedilemez.'); return; }
  const yeni = kopya(S.icerik);
  const liste = S.tur === 'faaliyet' ? yeni.faaliyetler : yeni.programlar;
  const i = liste.findIndex((x) => x.id === S.taslak.id);
  if (i >= 0 && !S.yeni) liste[i] = kopya(S.taslak); else liste.push(kopya(S.taslak));
  const sonuc = dogrula(yeni, { resimIzinli: (u) => /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(u) });
  if (!sonuc.gecerli) { hatalariGoster(sonuc.hatalar); uyar('Bazı alanlarda hata var. Kırmızı yazılara bakın.'); return; }
  if (await kaydet(sonuc.icerik)) location.hash = S.tur === 'faaliyet' ? '#faaliyetler' : '#programlar';
}

// ---------------- başlat ----------------
$('#yetki-kaldir').addEventListener('click', () => {
  try { localStorage.removeItem(ANAHTAR); } catch { /* */ }
  location.reload();
});
window.addEventListener('hashchange', goster);
(async () => {
  try {
    await Promise.all([yukle(), vakitYukle()]);
    yetkiYaz();
    goster();
  } catch (e) {
    $('#yukleniyor').textContent = (e && e.message) || 'İçerik okunamadı. Sayfayı yenileyin.';
  }
})();
