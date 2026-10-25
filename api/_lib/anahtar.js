// /admin koruması (S3): gizli anahtarlı link. Anahtar sadece Vercel'de: ADMIN_ANAHTAR (en az 32 karakter).
import crypto from 'node:crypto';

export const anahtarTanimli = () => (process.env.ADMIN_ANAHTAR || '').length >= 32;

/** İstek doğru anahtarı taşıyor mu? (Authorization: Bearer …, sabit süreli karşılaştırma) */
export function yetkiliMi(req) {
  if (!anahtarTanimli()) return false;
  const m = String((req.headers && req.headers.authorization) || '').match(/^Bearer\s+(\S+)\s*$/i);
  if (!m) return false;
  const ozet = (s) => crypto.createHash('sha256').update(s, 'utf8').digest();
  return crypto.timingSafeEqual(ozet(m[1]), ozet(process.env.ADMIN_ANAHTAR));
}

/** Gövde: Vercel JSON'u kendisi ayrıştırır; yerel testte metin de gelebilir. */
export function govde(req) {
  const b = req.body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  try { return JSON.parse(Buffer.isBuffer(b) ? b.toString('utf8') : String(b || '')); } catch { return null; }
}

export function cevap(res, durum, veri) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(durum).json(veri);
}
