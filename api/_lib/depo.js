// Vercel Blob üzerinden içerik deposu (S2, 25-10-2026). "_" ile başlayan dosyalar fonksiyon olmaz.
// Testler bu nesnenin yerine bellekte çalışan sahte bir depo verir; gerçek Blob'a hiç dokunulmaz.
// Her ortam (production / preview / development) kendi klasörünü kullanır:
// deneme linkinde yapılan kayıt canlı içeriği değiştirmez.

export class CakismaHatasi extends Error {
  constructor() { super('içerik başka biri tarafından değiştirildi'); this.name = 'CakismaHatasi'; }
}

const ortam = () => process.env.VERCEL_ENV || 'development';
const yol = (ad) => `${ortam()}/${ad}`;
const blob = () => import('@vercel/blob');            // sadece gerçekten kullanılınca yüklenir

export const gercekDepo = {
  /** @returns {Promise<{icerik: object, etag: string} | null>} */
  async oku() {
    const { get } = await blob();
    const r = await get(yol('icerik.json'), { access: 'public', useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return null;
    const metin = await new Response(r.stream).text();
    return { icerik: JSON.parse(metin), etag: r.blob.etag };
  },

  /** etag yoksa dosya ilk kez yazılır (varsa çakışma sayılır). */
  async yaz(icerik, etag) {
    const { put, BlobPreconditionFailedError } = await blob();
    try {
      const r = await put(yol('icerik.json'), JSON.stringify(icerik), {
        access: 'public', addRandomSuffix: false, allowOverwrite: !!etag, ifMatch: etag || undefined,
        contentType: 'application/json; charset=utf-8', cacheControlMaxAge: 60,
      });
      return { etag: r.etag };
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError || /already exists|precondition/i.test(String(e && e.message))) throw new CakismaHatasi();
      throw e;
    }
  },

  async resimYukle(veri) {
    const { put } = await blob();
    const r = await put(yol('resimler/faaliyet.jpg'), veri, {
      access: 'public', addRandomSuffix: true, contentType: 'image/jpeg', cacheControlMaxAge: 31536000,
    });
    return r.url;
  },

  async sil(adresler) {
    if (!adresler.length) return;
    const { del } = await blob();
    await del(adresler);
  },

  /** Sadece bu ortamın resim klasöründeki Blob adresleri kabul edilir. */
  resimIzinli(url) {
    try {
      const u = new URL(url);
      return u.protocol === 'https:' && /\.public\.blob\.vercel-storage\.com$/i.test(u.hostname)
        && u.pathname.startsWith(`/${ortam()}/resimler/`);
    } catch { return false; }
  },
};
