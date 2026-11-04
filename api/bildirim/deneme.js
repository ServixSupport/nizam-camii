// Deneme bildirimi: kullanıcı Ayarlar'da "Deneme bildirimi gönder"e dokununca 1 dk sonra, gerçek
// bildirimlerle AYNI yoldan (QStash → /api/bildirim/gonder → Web Push) bir bildirim gelir.
// Sadece kayıtlı aboneliğin sahibi (tarayıcının auth anahtarı) isteyebilir; 5 dakikada bir.
import { bildirimOrtami } from '../_lib/bildirim-servis.js';
import { aboneId, ayniAuth, pushAdresiGecerli, DENEME_GECIKME } from '../_lib/bildirim.js';
import { govde, cevap } from '../_lib/anahtar.js';

export function denemeIsleyici(ortam = () => bildirimOrtami(), saat = () => Date.now()) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return cevap(res, 405, { hata: 'sadece POST' });
    }
    const o = ortam();
    if (!o.aktif) return cevap(res, 503, { hata: 'bildirimler henüz kurulmadı' });
    const g = govde(req);
    if (!g || !pushAdresiGecerli(g.endpoint) || typeof g.auth !== 'string') return cevap(res, 400, { hata: 'endpoint ve auth gerekli' });
    const id = aboneId(g.endpoint);
    try {
      const abone = await o.depo.aboneOku(id);
      if (!abone) return cevap(res, 404, { hata: 'abonelik yok' });
      if (!ayniAuth(abone.abonelik.keys.auth, g.auth)) return cevap(res, 403, { hata: 'bu abonelik başka bir cihazın' });
      if (!(await o.depo.isaretle(`deneme:${id}`, 5 * 60))) return cevap(res, 429, { hata: 'az önce gönderildi' });
      const an = saat() + DENEME_GECIKME;
      await o.kuyruk.gonder([{ hedef: `${o.kok}/api/bildirim/gonder`, govde: { id: `deneme_${id}_${an}`, tur: 'deneme', abone: id, an }, zaman: an, yetki: o.cronSecret }]);
      return cevap(res, 200, { tamam: true, an });
    } catch (e) {
      console.error('deneme bildirimi:', e && e.message);
      return cevap(res, 503, { hata: 'şu an gönderilemedi' });
    }
  };
}

export default denemeIsleyici();
