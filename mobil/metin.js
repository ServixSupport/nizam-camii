// Uygulamanın metinleri: TR / NL / EN.
// Tasarımdaki (ontwerp/Mobil-Ayarlar.dc.html) metinler esas alındı.
// Namaz isimleri (S5, 24-10-2026): NL ve EN için Arapça-Latin. Yazımı cemaatten biri kontrol etsin.

export const DILLER = [['tr', 'Türkçe'], ['nl', 'Nederlands'], ['en', 'English']];
export const VARSAYILAN_DIL = 'nl';     // kullanıcının kararı (24-10-2026): herkes Hollandaca başlar

/** Vakitlerin Arapça adları (tasarımdan). */
export const ARAPCA = {
  Imsak: 'الإمساك', Fajr: 'الفجر', Sunrise: 'الشروق', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء',
};

export const METIN = {
  tr: {
    locale: 'tr-TR',
    camiAlt: 'Camii · Amsterdam',
    camiTam: 'Nizam-ı Alem Süleymaniye Camii',
    logoAlt: 'Nizam-ı Alem Süleymaniye Camii logosu',
    menu: 'Ana menü', tabHome: 'Ana ekran', tabEvents: 'Faaliyetler', tabPrograms: 'Programlar', tabSettings: 'Ayarlar',
    vakitler: 'Bugünün namaz vakitleri',
    siradakiVakit: 'Sıradaki vakit',
    simdi: 'ŞİMDİ',
    names: { Imsak: 'İmsak', Fajr: 'Sabah', Sunrise: 'Güneş', Dhuhr: 'Öğle', Asr: 'İkindi', Maghrib: 'Akşam', Isha: 'Yatsı' },
    // TV'deki "dat" metinleri: "AKŞAM'A KALAN"
    kalan: (k) => ({ Imsak: "İmsak'a", Fajr: "Sabah'a", Sunrise: "Güneş'e", Dhuhr: "Öğle'ye", Asr: "İkindi'ye", Maghrib: "Akşam'a", Isha: "Yatsı'ya" })[k].toLocaleUpperCase('tr') + ' KALAN',
    amsterdamSaati: (s) => `Saatler Amsterdam saatine göre · şu an ${s}`,
    yukleniyor: 'Vakitler yükleniyor…',
    hata: 'Vakitler alınamadı. İnternet bağlantısını kontrol edin; birazdan tekrar denenecek.',
    bugunCamide: 'BUGÜN CAMİDE', bugunBos: 'Bugün için program yok.',
    siradakiFaaliyet: 'SIRADAKİ FAALİYET', faaliyetBos: 'Henüz yaklaşan faaliyet yok.',
    // Faaliyetler
    evTitle: 'Faaliyetler', evSub: 'Camimizde yaklaşan etkinlikler',
    evEmpty: 'Henüz yaklaşan faaliyet yok.', evEmptySub: 'Cami yeni bir faaliyet eklediğinde burada görünür.',
    // Programlar
    prTitle: 'Programlar', prSub: 'Her hafta düzenli dersler ve sohbetler',
    prEmpty: 'Henüz program eklenmedi.', prEmptySub: 'Haftalık dersler ve sohbetler eklendiğinde burada görünür.',
    // Ayarlar
    title: 'Ayarlar', lang: 'DİL', look: 'GÖRÜNÜM', theme: 'Tema',
    auto: 'Otomatik', light: 'Açık', dark: 'Koyu', autoHint: 'Güneş doğunca açık, Akşam vaktinde koyu tema.',
    mosque: 'CAMİ', source: 'Vakitler: Diyanet İşleri Başkanlığı', harita: 'Haritada aç',
    tvTitle: 'Bu cihazda TV ekranını aç', tvText: 'Duvardaki tablet veya ekran için. Uygulamaya dönmek için: nizam-camii.vercel.app/?ekran=mobil',
  },
  nl: {
    locale: 'nl-NL',
    camiAlt: 'Moskee · Amsterdam',
    camiTam: 'Nizam-ı Alem Süleymaniye Moskee',
    logoAlt: 'Logo Nizam-ı Alem Süleymaniye Moskee',
    menu: 'Hoofdmenu', tabHome: 'Home', tabEvents: 'Activiteiten', tabPrograms: 'Programma’s', tabSettings: 'Instellingen',
    vakitler: 'Gebedstijden van vandaag',
    siradakiVakit: 'Volgend gebed',
    simdi: 'NU',
    names: { Imsak: 'Imsak', Fajr: 'Fadjr', Sunrise: 'Zonsopgang', Dhuhr: 'Dhoehr', Asr: 'Asr', Maghrib: 'Maghrib', Isha: 'Isja' },
    kalan: (k) => 'NOG TOT ' + METIN.nl.names[k].toUpperCase(),
    amsterdamSaati: (s) => `Tijden in Amsterdamse tijd · nu ${s}`,
    yukleniyor: 'Gebedstijden laden…',
    hata: 'Gebedstijden konden niet worden geladen. Controleer je internetverbinding; we proberen het zo opnieuw.',
    bugunCamide: 'VANDAAG IN DE MOSKEE', bugunBos: 'Vandaag geen programma.',
    siradakiFaaliyet: 'VOLGENDE ACTIVITEIT', faaliyetBos: 'Nog geen komende activiteiten.',
    evTitle: 'Activiteiten', evSub: 'Komende activiteiten in onze moskee',
    evEmpty: 'Nog geen komende activiteiten.', evEmptySub: 'Zodra de moskee een activiteit toevoegt, zie je die hier.',
    prTitle: 'Programma’s', prSub: 'Wekelijkse lessen en bijeenkomsten',
    prEmpty: 'Nog geen programma’s.', prEmptySub: 'Wekelijkse lessen en bijeenkomsten verschijnen hier zodra ze zijn toegevoegd.',
    title: 'Instellingen', lang: 'TAAL', look: 'WEERGAVE', theme: 'Thema',
    auto: 'Automatisch', light: 'Licht', dark: 'Donker', autoHint: 'Licht vanaf zonsopgang, donker vanaf maghrib.',
    mosque: 'MOSKEE', source: 'Gebedstijden: Diyanet', harita: 'Openen in kaart',
    tvTitle: 'Tv-scherm openen op dit apparaat', tvText: 'Voor een tablet of scherm aan de muur. Terug naar de app: nizam-camii.vercel.app/?ekran=mobil',
  },
  en: {
    locale: 'en-GB',
    camiAlt: 'Mosque · Amsterdam',
    camiTam: 'Nizam-ı Alem Süleymaniye Mosque',
    logoAlt: 'Nizam-ı Alem Süleymaniye Mosque logo',
    menu: 'Main menu', tabHome: 'Home', tabEvents: 'Activities', tabPrograms: 'Programs', tabSettings: 'Settings',
    vakitler: 'Today’s prayer times',
    siradakiVakit: 'Next prayer',
    simdi: 'NOW',
    names: { Imsak: 'Imsak', Fajr: 'Fajr', Sunrise: 'Sunrise', Dhuhr: 'Dhuhr', Asr: 'Asr', Maghrib: 'Maghrib', Isha: 'Isha' },
    kalan: (k) => 'TIME UNTIL ' + METIN.en.names[k].toUpperCase(),
    amsterdamSaati: (s) => `Times are in Amsterdam time · now ${s}`,
    yukleniyor: 'Loading prayer times…',
    hata: 'Prayer times could not be loaded. Check your internet connection; we will try again shortly.',
    bugunCamide: 'TODAY AT THE MOSQUE', bugunBos: 'No programs today.',
    siradakiFaaliyet: 'NEXT ACTIVITY', faaliyetBos: 'No upcoming activities yet.',
    evTitle: 'Activities', evSub: 'Upcoming activities at our mosque',
    evEmpty: 'No upcoming activities yet.', evEmptySub: 'New activities from the mosque will appear here.',
    prTitle: 'Programs', prSub: 'Weekly lessons and gatherings',
    prEmpty: 'No programs yet.', prEmptySub: 'Weekly lessons and gatherings will appear here once they are added.',
    title: 'Settings', lang: 'LANGUAGE', look: 'APPEARANCE', theme: 'Theme',
    auto: 'Automatic', light: 'Light', dark: 'Dark', autoHint: 'Light from sunrise, dark from maghrib.',
    mosque: 'MOSQUE', source: 'Prayer times: Diyanet', harita: 'Open in maps',
    tvTitle: 'Open the TV screen on this device', tvText: 'For a tablet or screen on the wall. Back to the app: nizam-camii.vercel.app/?ekran=mobil',
  },
};
