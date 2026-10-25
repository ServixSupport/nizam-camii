// Faaliyet resmi yükler. Tarayıcı resmi önceden JPEG'e çevirir (en fazla 1600 px, EXIF yok) ve base64 gönderir.
import { gercekDepo } from '../_lib/depo.js';
import { yetkiliMi, anahtarTanimli, govde, cevap } from '../_lib/anahtar.js';

export const EN_FAZLA = 1.5 * 1024 * 1024;

export function resimIsleyici(depo) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return cevap(res, 405, { hata: 'sadece POST' });
    if (!anahtarTanimli()) return cevap(res, 503, { hata: 'Sunucuda ADMIN_ANAHTAR tanımlı değil.' });
    if (!yetkiliMi(req)) return cevap(res, 401, { hata: 'Bu cihaz yetkili değil.' });

    const g = govde(req);
    const veri = g && typeof g.veri === 'string' ? Buffer.from(g.veri, 'base64') : null;
    if (!veri || !veri.length) return cevap(res, 400, { hata: 'Resim yok.' });
    if (veri.length > EN_FAZLA) return cevap(res, 413, { hata: 'Resim çok büyük.' });
    if (!(veri[0] === 0xFF && veri[1] === 0xD8 && veri[2] === 0xFF)) return cevap(res, 415, { hata: 'Sadece JPEG kabul edilir.' });

    try {
      return cevap(res, 200, { url: await depo.resimYukle(veri) });
    } catch (e) {
      console.error('resim yüklenemedi:', e && e.message);
      return cevap(res, 503, { hata: 'Resim yüklenemedi. Birazdan tekrar deneyin.' });
    }
  };
}

export default resimIsleyici(gercekDepo);
