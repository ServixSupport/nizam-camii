// Bildirim metinleri (saf; ağ yok). Sunucu (api/_lib/bildirim.js, Web Push) ve mağaza uygulaması
// (telefonun kendi zamanlaması, yerel-plan.js) aynı metni kullanır.
import { METIN } from './metin.js';

export const NAMAZ = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

/** Ayarlar'daki "Deneme bildirimi" */
export const DENEME = {
  tr: { baslik: 'Deneme bildirimi', govde: 'Bildirimler çalışıyor. Namaz vakitlerinde böyle bir bildirim alacaksınız.' },
  nl: { baslik: 'Testmelding', govde: 'Meldingen werken. Bij de gebedstijden krijg je zo’n melding.' },
  en: { baslik: 'Test notification', govde: 'Notifications work. You will get a notification like this at prayer times.' },
};

// Türkçe bulunma eki, saatin okunuşuna göre: 18:34’te (otuz dört), 20:09’da (dokuz), 12:00’de (on iki).
const BIRLER = ['', 'de', 'de', 'te', 'te', 'te', 'da', 'de', 'de', 'da'];   // bir … dokuz
const ONLAR = ['', 'da', 'de', 'da', 'ta', 'de'];                          // on, yirmi, otuz, kırk, elli
const ekSayi = (n) => (n === 0 ? 'da' : n % 10 ? BIRLER[n % 10] : ONLAR[n / 10]);
export function saatEki(saat) {
  const [h, m] = saat.split(':').map(Number);
  return `${saat}’${m ? ekSayi(m) : ekSayi(h)}`;
}

/**
 * Bildirim metni, abonenin dilinde (tasarım: ontwerp/Mobil-Bildirim.dc.html).
 * Dini metin değil; yine de yayından önce hocaya/cami yönetimine gösterilmeli.
 * Vakit girince sadece başlık (kullanıcı isteği, 06-11-2026: "telefonu sessize alın" cümlesi yok).
 */
export function bildirimMetni(dil, an) {
  const ad = METIN[dil].names[an.vakit];
  const n = an.tur === 'giris' ? 0 : Number(an.tur.slice(5));
  const namaz = NAMAZ.includes(an.vakit);
  const gunes = an.vakit === 'Sunrise';
  const s = an.saat;
  if (dil === 'tr') {
    if (!n) {
      return { baslik: gunes ? `Güneş doğdu · ${s}` : `${ad} vakti girdi · ${s}`, govde: '' };
    }
    return { baslik: gunes ? `Güneşin doğmasına ${n} dakika` : namaz ? `${ad} namazına ${n} dakika` : `${ad} vaktine ${n} dakika`,
      govde: gunes ? `Güneş ${saatEki(s)} doğuyor.` : `${ad} vakti ${saatEki(s)} giriyor.` };
  }
  if (dil === 'nl') {
    if (!n) {
      return { baslik: gunes ? `Zonsopgang · ${s}` : `${ad} is begonnen · ${s}`, govde: '' };
    }
    return { baslik: `Nog ${n} minuten tot ${gunes ? 'zonsopgang' : ad}`,
      govde: gunes ? `De zon komt op om ${s}.` : `${ad} begint om ${s}.` };
  }
  if (!n) {
    return { baslik: gunes ? `Sunrise · ${s}` : `${ad} has begun · ${s}`, govde: '' };
  }
  return { baslik: `${n} minutes until ${gunes ? 'sunrise' : ad}`,
    govde: gunes ? `The sun rises at ${s}.` : `${ad} begins at ${s}.` };
}
