// Uygulama için: bildirimler hazır mı, ve tarayıcının abone olurken kullanacağı açık VAPID anahtarı.
// `aktif: false` ise uygulama bildirim ayarlarını ve zilleri hiç göstermez.
import { bildirimOrtami } from '../_lib/bildirim-servis.js';

export function anahtarIsleyici(ortam = () => bildirimOrtami()) {
  return async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ hata: 'sadece GET' });
    }
    const o = ortam();
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
    return res.status(200).json({ aktif: o.aktif, publicKey: o.aktif ? o.vapid.publicKey : null, eksik: o.eksik });
  };
}

export default anahtarIsleyici();
