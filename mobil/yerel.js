// Mağaza uygulaması (Play Store, App Store; app/ klasörü, Capacitor) ile köprü.
// Tarayıcıda (web uygulaması) hiçbir şey yapmaz: yerelMi === false.
const C = typeof window !== 'undefined' ? window.Capacitor : undefined;

/**
 * Tam ekran tema önizlemesi (tema-onizleme.js): uygulamanın kendisi iframe'de, ?onizleme=liste|klasik|cini.
 * Sadece gösterir: ağa gitmez, ayar yazmaz, telefona hiçbir şey göndermez (bu yüzden yerelMi burada false).
 */
export const onizleme = (() => {
  const s = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('onizleme') : null;
  return s === 'liste' || s === 'klasik' || s === 'cini' ? s : null;
})();

export const yerelMi = !onizleme && !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
/** 'android' | 'ios' | 'web' */
export const platform = yerelMi ? C.getPlatform() : 'web';

/** Mağaza uygulaması sayfaları telefondan açar; API'ye tam adresle gider (aynı adres: CDN cache anahtarı aynı). */
export const SUNUCU = 'https://nizam-camii.vercel.app';
export const apiAdresi = (yol) => (yerelMi ? SUNUCU + yol : yol);

/**
 * Telefon eklentisi: app/android/…/CamiPlugin.java ve app/ios/App/App/CamiPlugin.swift.
 * planKur({ plan }), izinDurumu(), bildirimIzniIste(), deneme({ baslik, govde }), cubuklar({ koyu, zemin }),
 * sessizIzniAc(), tamAlarmIzniAc(), sesDinle({ ses }), sesDurdur(), geriYakala({ acik }) (son beşi sadece Android).
 * Paketleyici yok (@capacitor/core yüklenmez): telefonun köprüsü (native-bridge.js) doğrudan çağrılır.
 */
export const cami = yerelMi
  ? new Proxy({}, { get: (_, yontem) => (yontem === 'then' ? undefined : (arg) => C.nativePromise('Cami', yontem, arg || {})) })
  : null;
