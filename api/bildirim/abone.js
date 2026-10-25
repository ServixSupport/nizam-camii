// Bildirim aboneliği: POST = kaydet/güncelle, DELETE = sil.
// Saklanan: push adresi + tarayıcının anahtarları + seçimler (dil, vakitler, kaç dk önce, giriş).
// İsim, hesap, IP saklanmaz. Değiştirmek/silmek için tarayıcının gizli `auth` anahtarı gerekir.
import { bildirimOrtami, planYap } from '../_lib/bildirim-servis.js';
import { aboneDogrula, aboneId, ayniAuth, pushAdresiGecerli, onayYuku, SINIR_ABONE } from '../_lib/bildirim.js';
import { govde, cevap } from '../_lib/anahtar.js';

export function aboneIsleyici(ortam = () => bildirimOrtami(), saat = () => Date.now()) {
  return async function handler(req, res) {
    if (req.method !== 'POST' && req.method !== 'DELETE') {
      res.setHeader('Allow', 'POST, DELETE');
      return cevap(res, 405, { hata: 'sadece POST veya DELETE' });
    }
    const o = ortam();
    if (!o.aktif) return cevap(res, 503, { hata: 'bildirimler henüz kurulmadı' });
    const g = govde(req);
    try {
      if (req.method === 'DELETE') {
        if (!g || !pushAdresiGecerli(g.endpoint) || typeof g.auth !== 'string') return cevap(res, 400, { hata: 'endpoint ve auth gerekli' });
        const id = aboneId(g.endpoint);
        const eski = await o.depo.aboneOku(id);
        if (!eski) return cevap(res, 200, { tamam: true });
        if (!ayniAuth(eski.abonelik.keys.auth, g.auth)) return cevap(res, 403, { hata: 'bu abonelik başka bir cihazın' });
        await o.depo.aboneSil(id);
        return cevap(res, 200, { tamam: true });
      }
      const d = aboneDogrula(g);
      if (!d.gecerli) return cevap(res, 400, { hata: d.hata });
      const id = aboneId(d.abone.abonelik.endpoint);
      const eski = await o.depo.aboneOku(id);
      if (eski && !ayniAuth(eski.abonelik.keys.auth, d.abone.abonelik.keys.auth)) return cevap(res, 403, { hata: 'bu abonelik başka bir cihazın' });
      if (!eski && (await o.depo.aboneSayisi()) >= SINIR_ABONE) return cevap(res, 503, { hata: 'abone sınırı doldu' });
      await o.depo.aboneYaz(id, { ...d.abone, guncelleme: new Date(saat()).toISOString() });
      // ilk kayıtta hemen bir onay bildirimi (sonucu beklenir ama kaydı etkilemez)
      if (!eski) await o.push.gonder(d.abone.abonelik, onayYuku(d.abone.dil)).catch(() => {});
      // Bugün ve yarın henüz zamanlanmadıysa şimdi zamanla (günlük cron'u beklemeden).
      let plan;
      try { plan = await planYap(o, saat()); } catch (e) { console.error('bildirim planı:', e && e.message); plan = null; }
      return cevap(res, 200, { tamam: true, planlanan: plan ? plan.planlanan : 0, ...(plan ? {} : { planHatasi: true }) });
    } catch (e) {
      console.error('abonelik:', e && e.message);
      return cevap(res, 503, { hata: 'şu an kaydedilemedi' });
    }
  };
}

export default aboneIsleyici();
