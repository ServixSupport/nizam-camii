// Uygulama için içerik: yayındaki ve bitmemiş faaliyetler, aktif programlar. Herkese açık, CDN'de 2 dk cache.
// (Hobby Blob limitleri: okuma her istekte değil, en fazla 2 dakikada bir Blob'a gider.)
import { gercekDepo } from './_lib/depo.js';
import { BOS_ICERIK } from '../veri/dogrula.js';
import { faaliyetBitis } from '../mobil/icerik.js';
import { amsGun } from '../mobil/zaman.js';

export function icerikIsleyici(depo, saat = () => Date.now()) {
  return async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ hata: 'sadece GET' });
    }
    try {
      const o = await depo.oku();
      const ic = (o && o.icerik) || BOS_ICERIK;
      const simdi = saat();
      const bugun = amsGun(simdi);
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=120, stale-while-revalidate=86400');
      return res.status(200).json({
        guncelleme: ic.guncelleme || null,
        faaliyetler: (ic.faaliyetler || []).filter((f) => f.yayinda && faaliyetBitis(f) > simdi),
        programlar: (ic.programlar || []).filter((p) => p.aktif !== false && (!p.gecerliBitis || p.gecerliBitis >= bugun)),
      });
    } catch (e) {
      console.error('icerik okunamadı:', e && e.message);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({ hata: 'içerik şu an okunamadı' });
    }
  };
}

export default icerikIsleyici(gercekDepo);
