// Gerçek Vercel Blob yerine bellekte çalışan depo + Vercel fonksiyonlarını çağırmak için sahte req/res.
import { CakismaHatasi } from '../../api/_lib/depo.js';

export const TEST_ANAHTAR = 'test-anahtari-0123456789abcdef0123456789abcdef';
export const RESIM_KOK = 'https://test0store.public.blob.vercel-storage.com/development/resimler/';

export function sahteDepo(baslangic = null) {
  let kayit = baslangic ? { icerik: structuredClone(baslangic), etag: '"e1"' } : null;
  let sayac = 1;
  const yuklenen = new Map();
  const silinen = [];
  return {
    async oku() { return kayit && { icerik: structuredClone(kayit.icerik), etag: kayit.etag }; },
    async yaz(icerik, etag) {
      if (kayit ? etag !== kayit.etag : !!etag) throw new CakismaHatasi();
      kayit = { icerik: structuredClone(icerik), etag: `"e${++sayac}"` };
      return { etag: kayit.etag };
    },
    async resimYukle(veri) {
      const url = `${RESIM_KOK}faaliyet-${(++sayac).toString(36)}x.jpg`;
      yuklenen.set(url, veri);
      return url;
    },
    async sil(adresler) { silinen.push(...adresler); for (const u of adresler) yuklenen.delete(u); },
    resimIzinli: (u) => typeof u === 'string' && u.startsWith(RESIM_KOK),
    durum: () => ({ kayit, yuklenen, silinen }),
    /** testte "başka biri değiştirdi" durumunu taklit eder */
    disaridanDegistir() { if (kayit) kayit = { ...kayit, etag: `"e${++sayac}"` }; },
  };
}

/** Vercel Node fonksiyonunu sahte istekle çağırır. */
export async function cagir(handler, { method = 'GET', headers = {}, body } = {}) {
  const res = {
    durum: 200, basliklar: {}, govde: undefined,
    status(s) { this.durum = s; return this; },
    json(v) { this.govde = JSON.parse(JSON.stringify(v)); return this; },
    setHeader(k, v) { this.basliklar[k.toLowerCase()] = v; },
  };
  await handler({ method, headers, body }, res);
  return res;
}

export const yetki = (anahtar = TEST_ANAHTAR) => ({ authorization: `Bearer ${anahtar}` });

/** Testlerde kullanılan örnek içerik (metinler açıkça test metni). */
export function ornekIcerik() {
  return {
    guncelleme: null,
    faaliyetler: [
      { id: 'f-kahvalti', grup: 'herkes', baslik: { tr: 'Aile Kahvaltısı', nl: 'Familieontbijt', en: '' },
        aciklama: { tr: 'Test açıklaması.', nl: '', en: '' }, baslangic: '2026-10-31T10:00', bitis: '2026-10-31T13:00',
        tumGun: false, yer: 'Konferans salonu', resim: '', link: '', oneCikan: true, yayinda: true },
      { id: 'f-gencler', grup: 'genclik', baslik: { tr: 'Gençlik Buluşması', nl: 'Jongerenavond', en: 'Youth evening' },
        aciklama: { tr: '', nl: '', en: '' }, baslangic: '2026-11-07T19:30', bitis: null,
        tumGun: false, yer: 'Gençlik odası', resim: '', link: '', oneCikan: false, yayinda: true },
      { id: 'f-taslak', grup: 'hanimlar', baslik: { tr: 'Taslak faaliyet', nl: '', en: '' },
        aciklama: { tr: '', nl: '', en: '' }, baslangic: '2026-11-21T14:00', bitis: null,
        tumGun: false, yer: '', resim: '', link: '', oneCikan: false, yayinda: false },
      { id: 'f-gecmis', grup: 'herkes', baslik: { tr: 'Geçmiş faaliyet', nl: '', en: '' },
        aciklama: { tr: '', nl: '', en: '' }, baslangic: '2026-10-20T10:00', bitis: null,
        tumGun: false, yer: '', resim: '', link: '', oneCikan: false, yayinda: true },
    ],
    programlar: [
      { id: 'p-tefsir', grup: 'erkekler', baslik: { tr: 'Tefsir dersi', nl: 'Tafsirles', en: '' }, aciklama: { tr: '', nl: '', en: '' },
        gunler: [1, 4], saat: { tip: 'vakit', vakit: 'Isha', fark: 30, sure: 60 }, yer: 'Ana salon', hoca: '',
        gecerliBaslangic: null, gecerliBitis: null, aktif: true },
      { id: 'p-kurs', grup: 'cocuklar', baslik: { tr: 'Kur’an kursu', nl: 'Koranles', en: 'Quran class' }, aciklama: { tr: '', nl: '', en: '' },
        gunler: [1, 2, 3, 4], saat: { tip: 'sabit', baslangic: '17:00', bitis: '19:00' }, yer: 'Sınıflar · 7–14 yaş', hoca: '',
        gecerliBaslangic: null, gecerliBitis: null, aktif: true },
      { id: 'p-cuma', grup: 'herkes', baslik: { tr: 'Cuma namazı ve hutbe', nl: 'Vrijdaggebed', en: 'Friday prayer' }, aciklama: { tr: '', nl: '', en: '' },
        gunler: [5], saat: { tip: 'vakit', vakit: 'Dhuhr', fark: 0, sure: 60 }, yer: 'Ana salon', hoca: '',
        gecerliBaslangic: null, gecerliBitis: null, aktif: true },
      { id: 'p-hanim', grup: 'hanimlar', baslik: { tr: 'Hanımlar sohbeti', nl: '', en: '' }, aciklama: { tr: '', nl: '', en: '' },
        gunler: [6], saat: { tip: 'sabit', baslangic: '14:00', bitis: '15:30' }, yer: 'Kadınlar bölümü', hoca: '',
        gecerliBaslangic: '2026-11-01', gecerliBitis: null, aktif: true },
      { id: 'p-pasif', grup: 'genclik', baslik: { tr: 'Pasif program', nl: '', en: '' }, aciklama: { tr: '', nl: '', en: '' },
        gunler: [3], saat: { tip: 'sabit', baslangic: '19:30', bitis: '21:00' }, yer: '', hoca: '',
        gecerliBaslangic: null, gecerliBitis: null, aktif: false },
    ],
  };
}
