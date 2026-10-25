// İçeriği kaydeder: 1) anahtar  2) doğrulama (veri/dogrula.js)  3) etag ile yazma  4) artık kullanılmayan resimleri silme.
import { gercekDepo, CakismaHatasi } from '../_lib/depo.js';
import { yetkiliMi, anahtarTanimli, govde, cevap } from '../_lib/anahtar.js';
import { dogrula, resimler } from '../../veri/dogrula.js';

export function kaydetIsleyici(depo, saat = () => Date.now()) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return cevap(res, 405, { hata: 'sadece POST' });
    if (!anahtarTanimli()) return cevap(res, 503, { hata: 'Sunucuda ADMIN_ANAHTAR tanımlı değil.' });
    if (!yetkiliMi(req)) return cevap(res, 401, { hata: 'Bu cihaz yetkili değil.' });

    const g = govde(req);
    if (!g || typeof g !== 'object') return cevap(res, 400, { hata: 'Geçersiz istek.' });
    const sonuc = dogrula(g.icerik, { resimIzinli: (u) => depo.resimIzinli(u) });
    if (!sonuc.gecerli) return cevap(res, 400, { hata: 'İçerikte hata var.', hatalar: sonuc.hatalar });

    try {
      const eski = await depo.oku();
      const yeni = { ...sonuc.icerik, guncelleme: new Date(saat()).toISOString() };
      const { etag } = await depo.yaz(yeni, typeof g.etag === 'string' && g.etag ? g.etag : null);

      // artık hiçbir faaliyette geçmeyen resimleri sil (silme ücretsiz; hata kaydı engellemez)
      const kalan = resimler(yeni);
      const silinecek = [...resimler(eski && eski.icerik)].filter((u) => !kalan.has(u) && depo.resimIzinli(u));
      try { await depo.sil(silinecek); } catch (e) { console.error('resim silinemedi:', e && e.message); }

      return cevap(res, 200, { etag, guncelleme: yeni.guncelleme, icerik: yeni });
    } catch (e) {
      if (e instanceof CakismaHatasi) return cevap(res, 409, { hata: 'Başka biri bu arada değiştirdi. Sayfayı yenileyin; değişikliğiniz kaydedilmedi.' });
      console.error('kaydedilemedi:', e && e.message);
      return cevap(res, 503, { hata: 'Kaydedilemedi. Birazdan tekrar deneyin.' });
    }
  };
}

export default kaydetIsleyici(gercekDepo);
