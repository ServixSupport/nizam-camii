// Günlük zamanlayıcı (vercel.json → crons; Vercel Hobby günde bir kez çalıştırır, saati ±59 dk).
// Bugün ve yarının bildirim anlarını QStash'e koyar; yarın da önceden planlandığı için saat kayması sorun olmaz.
// Vercel, cron isteğine kendiliğinden "Authorization: Bearer <CRON_SECRET>" ekler.
import { bildirimOrtami, planYap, bearerEsit } from '../_lib/bildirim-servis.js';
import { cevap } from '../_lib/anahtar.js';

export function planlaIsleyici(ortam = () => bildirimOrtami(), saat = () => Date.now()) {
  return async function handler(req, res) {
    const o = ortam();
    if (!bearerEsit(req, o.cronSecret)) return cevap(res, 401, { hata: 'yetki yok' });
    if (!o.aktif) return cevap(res, 503, { hata: 'bildirimler henüz kurulmadı', eksik: o.eksik });
    try {
      const plan = await planYap(o, saat());
      if (plan.hatalar) console.error('bildirim planı:', plan.hatalar.join('; '));
      return cevap(res, plan.hatalar ? 500 : 200, plan);   // 500: Vercel cron kaydında hata görünsün
    } catch (e) {
      console.error('bildirim planı:', e && e.message);
      return cevap(res, 500, { hata: 'planlanamadı' });
    }
  };
}

export default planlaIsleyici();
