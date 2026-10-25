// Nizam Camii — service worker (Faz C). Kapsam: /mobil/ (TV sayfası "/" buraya hiç girmez).
// - Uygulama dosyaları önce cache'ten (internetsiz açılır).
// - /api/vakit ve /api/icerik önce ağdan, olmazsa cache'ten.
// - Faz D: sunucudan gelen bildirimi gösterir; dokununca uygulama açılır.
// - Yeni sürüm kendiliğinden devreye girmez: sayfa "Yeni sürüm hazır" gösterir, kullanıcı dokununca geçilir.
// SURUM: uygulama dosyalarının özeti. Dosya değişince `cd tests && node araclar/sw-surum.mjs` ile güncellenir
// (test, unutulursa kırmızı olur).
const SURUM = 'c24f4ae53e';
const KABUK = `nzm-kabuk-${SURUM}`;
const VERI = 'nzm-veri';
const RESIM = 'nzm-resim';

const DOSYALAR = [
  '/mobil/',
  '/mobil/app.css', '/mobil/app.js', '/mobil/zaman.js', '/mobil/metin.js', '/mobil/ekranlar.js', '/mobil/icerik.js', '/mobil/bildirim.js',
  '/mobil/logo.png', '/mobil/manifest-nl.webmanifest', '/mobil/manifest-tr.webmanifest', '/mobil/manifest-en.webmanifest', '/mobil/ikon-192.png', '/mobil/ikon-512.png',
  '/mobil/fonts/hanken-grotesk-latin.woff2', '/mobil/fonts/hanken-grotesk-latin-ext.woff2',
  '/mobil/fonts/bodoni-moda-latin.woff2', '/mobil/fonts/bodoni-moda-latin-ext.woff2',
  '/mobil/fonts/bodoni-moda-italik-latin.woff2', '/mobil/fonts/bodoni-moda-italik-latin-ext.woff2',
  '/mobil/fonts/noto-kufi-arabic-arabic.woff2',
];
const VERI_YOLLARI = ['/api/vakit', '/api/icerik'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(KABUK).then((c) => c.addAll(DOSYALAR.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const ad of await caches.keys()) if (ad.startsWith('nzm-kabuk-') && ad !== KABUK) await caches.delete(ad);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'SURUM_GEC') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // vakitler ve içerik: önce ağ (parametresiz istek olduğu gibi gider), olmazsa son kayıt
  if (url.origin === location.origin && VERI_YOLLARI.includes(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(VERI);
      try {
        const r = await fetch(req);
        if (r.ok) { cache.put(url.pathname, r.clone()); return r; }
        throw new Error('HTTP ' + r.status);
      } catch {
        const eski = await cache.match(url.pathname);
        return eski || Response.error();
      }
    })());
    return;
  }

  // faaliyet resimleri (Vercel Blob): önce cache, yoksa ağ
  if (url.hostname.endsWith('.public.blob.vercel-storage.com')) {
    e.respondWith((async () => {
      const cache = await caches.open(RESIM);
      const var_ = await cache.match(req);
      if (var_) return var_;
      const r = await fetch(req);
      if (r.ok) cache.put(req, r.clone());
      return r;
    })());
    return;
  }

  // uygulama dosyaları: önce cache (sayfa adresi #… ve ?… olmadan eşleşir)
  if (url.origin === location.origin && url.pathname.startsWith('/mobil/')) {
    e.respondWith((async () => {
      const cache = await caches.open(KABUK);
      const anahtar = req.mode === 'navigate' ? '/mobil/' : url.pathname;
      return (await cache.match(anahtar)) || fetch(req);
    })());
  }
});

// ---------------- Faz D: bildirimler ----------------
// İçerik sunucuda hazırlanır (api/_lib/bildirim.js): { baslik, govde, etiket, dil, adres }.
// Aynı vaktin bildirimleri aynı etiketi taşır: "15 dk kala"nın yerini "vakit girdi" alır (yine ses çıkar).
self.addEventListener('push', (e) => {
  let v = {};
  try { v = e.data ? e.data.json() : {}; } catch { v = {}; }
  const ayar = {
    body: v.govde || '',
    icon: '/mobil/ikon-192.png',
    badge: '/mobil/rozet-96.png',
    lang: v.dil || 'nl',
    data: { adres: typeof v.adres === 'string' && v.adres.startsWith('/mobil/') ? v.adres : '/mobil/' },
  };
  if (v.etiket) { ayar.tag = String(v.etiket); ayar.renotify = true; }
  e.waitUntil(self.registration.showNotification(v.baslik || 'SÜLEYMANİYE CAMİİ', ayar));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const adres = (e.notification.data && e.notification.data.adres) || '/mobil/';
  e.waitUntil((async () => {
    const pencereler = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const acik = pencereler.find((c) => new URL(c.url).pathname.startsWith('/mobil/'));
    if (acik) return acik.focus();
    return self.clients.openWindow(adres);
  })());
});
