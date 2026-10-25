// QStash bu adresi her vakit anında çağırır (Authorization: Bearer <CRON_SECRET>, QStash iletir).
// O anı isteyen abonelere Web Push gönderir. Aynı an iki kez gönderilmez (Redis işareti);
// geç gelen çağrı (10 dk'dan fazla) gönderilmez. 404/410 veren abonelikler hemen silinir.
import { bildirimOrtami, bearerEsit, sirayla } from '../_lib/bildirim-servis.js';
import { anGecerli, istiyorMu, bildirimYuku, PENCERE } from '../_lib/bildirim.js';
import { govde, cevap } from '../_lib/anahtar.js';

export function gonderIsleyici(ortam = () => bildirimOrtami(), saat = () => Date.now()) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return cevap(res, 405, { hata: 'sadece POST' });
    }
    const o = ortam();
    if (!bearerEsit(req, o.cronSecret)) return cevap(res, 401, { hata: 'yetki yok' });
    if (!o.aktif) return cevap(res, 503, { hata: 'bildirimler henüz kurulmadı' });
    const an = govde(req);
    if (!anGecerli(an)) return cevap(res, 400, { hata: 'geçersiz an' });
    const simdi = saat();
    // 200: QStash tekrar denemesin
    if (simdi < an.an - PENCERE.once || simdi > an.an + PENCERE.sonra) return cevap(res, 200, { atlandi: 'zaman' });
    const isaret = `gonderildi:${an.id}`;
    try {
      if (!(await o.depo.isaretle(isaret, 3 * 24 * 60 * 60))) return cevap(res, 200, { atlandi: 'tekrar' });
    } catch (e) {
      console.error('bildirim gönderimi:', e && e.message);
      return cevap(res, 500, { hata: 'gönderilemedi' });
    }
    try {
      let aboneler;
      try {
        aboneler = (await o.depo.aboneler()).filter((x) => istiyorMu(x, an));
      } catch (e) {
        await o.depo.isaretSil(isaret).catch(() => {});   // hiçbir şey gönderilmedi: QStash tekrar denesin
        throw e;
      }
      const sonuc = { gonderilen: 0, silinen: 0, hata: 0 };
      await sirayla(aboneler, 10, async (x) => {
        const r = await o.push.gonder(x.abonelik, bildirimYuku(x, an));
        if (r.tamam) sonuc.gonderilen++;
        else if (r.durum === 404 || r.durum === 410) { sonuc.silinen++; await o.depo.aboneSil(x.id).catch(() => {}); }
        else sonuc.hata++;
      });
      return cevap(res, 200, sonuc);
    } catch (e) {
      console.error('bildirim gönderimi:', e && e.message);
      return cevap(res, 500, { hata: 'gönderilemedi' });
    }
  };
}

export default gonderIsleyici();
