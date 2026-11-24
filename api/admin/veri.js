// Panel için içerik + etag. Okumak için anahtar gerekmez; "yetkili" bilgisi döner.
// Taslaklar (yayında olmayan faaliyetler) sadece anahtarla (24-11-2026, güvenlik).
import { gercekDepo } from '../_lib/depo.js';
import { yetkiliMi, anahtarTanimli, anahtarDurumu, cevap } from '../_lib/anahtar.js';
import { BOS_ICERIK } from '../../veri/dogrula.js';

export function veriIsleyici(depo) {
  return async function handler(req, res) {
    if (req.method !== 'GET') return cevap(res, 405, { hata: 'sadece GET' });
    try {
      const o = await depo.oku();
      const yetkili = yetkiliMi(req);
      const icerik = (o && o.icerik) || BOS_ICERIK;
      return cevap(res, 200, {
        icerik: yetkili ? icerik : { ...icerik, faaliyetler: (icerik.faaliyetler || []).filter((f) => f.yayinda === true) },
        etag: (o && o.etag) || null,
        yetkili,
        anahtarTanimli: anahtarTanimli(),
        anahtarDurumu: anahtarDurumu(),
      });
    } catch (e) {
      console.error('admin veri okunamadı:', e && e.message);
      return cevap(res, 503, { hata: 'İçerik okunamadı. Birazdan tekrar deneyin.' });
    }
  };
}

export default veriIsleyici(gercekDepo);
