// /api/vakit'in hafızası: son iyi Diyanet listesi Vercel Blob'da (25-10-2026).
// Tek kayıt, bütün ortamlar ortak okur ('ortak/vakit.json'); sadece production yazar.
// Asla hata fırlatmaz: Blob çalışmazsa /api/vakit eskisi gibi doğrudan Diyanet'e gider.
// Kayıtta şehir kimliği tutulmaz (yol '{id}' ile saklanır).
const YOL = 'ortak/vakit.json';

export const gercekVakitDepo = {
  async oku() {
    try {
      const { get } = await import('@vercel/blob');
      const r = await get(YOL, { access: 'public', useCache: false });
      if (!r || r.statusCode !== 200 || !r.stream) return null;
      return JSON.parse(await new Response(r.stream).text());
    } catch (e) {
      console.error('vakit kaydı okunamadı:', e && e.message);
      return null;
    }
  },
  async yaz(kayit) {
    try {
      const { put } = await import('@vercel/blob');
      await put(YOL, JSON.stringify(kayit), {
        access: 'public', addRandomSuffix: false, allowOverwrite: true,
        contentType: 'application/json; charset=utf-8', cacheControlMaxAge: 60,
      });
    } catch (e) {
      console.error('vakit kaydı yazılamadı:', e && e.message);
    }
  },
};
