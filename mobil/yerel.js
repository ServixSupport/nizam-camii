// Mağaza uygulaması (Play Store, App Store; app/ klasörü, Capacitor) ile köprü.
// Tarayıcıda (web uygulaması) hiçbir şey yapmaz: yerelMi === false.
const C = typeof window !== 'undefined' ? window.Capacitor : undefined;

export const yerelMi = !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
/** 'android' | 'ios' | 'web' */
export const platform = yerelMi ? C.getPlatform() : 'web';

/** Mağaza uygulaması sayfaları telefondan açar; API'ye tam adresle gider (aynı adres: CDN cache anahtarı aynı). */
export const SUNUCU = 'https://nizam-camii.vercel.app';
export const apiAdresi = (yol) => (yerelMi ? SUNUCU + yol : yol);

/**
 * Telefon eklentisi: app/android/…/CamiPlugin.java ve app/ios/App/App/CamiPlugin.swift.
 * planKur({ plan }), izinDurumu(), bildirimIzniIste(), deneme({ baslik, govde }), cubuklar({ koyu, zemin }),
 * sessizIzniAc(), tamAlarmIzniAc() (son ikisi sadece Android).
 */
export const cami = yerelMi ? C.registerPlugin('Cami') : null;
