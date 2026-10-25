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
    tvTitle: 'Bu cihazda TV ekranını aç', tvText: (adres) => `Duvardaki tablet veya ekran için. Uygulamaya dönmek için: ${adres}/?ekran=mobil`,
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
    names: { Imsak: 'Imsak', Fajr: 'Fadjr', Sunrise: 'Zonsopgang', Dhuhr: 'Dhoehr', Asr: 'Asr', Maghrib: 'Maghrib', Isha: 'Isha' },
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
    tvTitle: 'Tv-scherm openen op dit apparaat', tvText: (adres) => `Voor een tablet of scherm aan de muur. Terug naar de app: ${adres}/?ekran=mobil`,
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
    tvTitle: 'Open the TV screen on this device', tvText: (adres) => `For a tablet or screen on the wall. Back to the app: ${adres}/?ekran=mobil`,
  },
};

// ---------------- Faz B: faaliyetler, programlar, gruplar ----------------
const EK = {
  tr: {
    gruplar: { herkes: 'Herkes', erkekler: 'Erkekler', hanimlar: 'Hanımlar', genclik: 'Gençlik', cocuklar: 'Çocuklar' },
    tumu: 'Tümü', tumGruplar: 'Tüm gruplar', suz: 'Gruba göre süz',
    oneCikan: 'ÖNE ÇIKAN', tumGun: 'Tüm gün',
    takvimeEkle: 'Takvime ekle', paylas: 'Paylaş', linkKopyalandi: 'Link kopyalandı', dahaFazla: 'Daha fazla bilgi',
    kategoriBos: 'Bu grupta yaklaşan faaliyet yok.', geri: 'Faaliyetler', bulunamadi: 'Bu faaliyet artık yok.',
    prSubTablet: 'Haftalık ders ve sohbet takvimi',
    gunSec: 'Gün seç', bugun: 'bugün', programSay: (n) => `${n} program`, gunBos: 'Bu gün program yok.',
    buHafta: 'Bu hafta', oncekiHafta: 'Önceki hafta', sonrakiHafta: 'Sonraki hafta', namazVakitleri: 'Namaz vakitleri',
    tablo: 'Haftalık program tablosu', secili: 'Seçili program', hoca: 'Hoca',
    vakitAdi: { Fajr: 'Sabah', Dhuhr: 'Öğle', Asr: 'İkindi', Maghrib: 'Akşam', Isha: 'Yatsı' },
    vakitte: (v) => `${v} vaktinde`, sonrasi: (v) => `${v} sonrası`, sonrasiKisa: 'sonrası', vaktindeKisa: 'vaktinde',
  },
  nl: {
    gruplar: { herkes: 'Iedereen', erkekler: 'Mannen', hanimlar: 'Vrouwen', genclik: 'Jongeren', cocuklar: 'Kinderen' },
    tumu: 'Alles', tumGruplar: 'Alle groepen', suz: 'Filter op groep',
    oneCikan: 'UITGELICHT', tumGun: 'Hele dag',
    takvimeEkle: 'Zet in agenda', paylas: 'Delen', linkKopyalandi: 'Link gekopieerd', dahaFazla: 'Meer informatie',
    kategoriBos: 'Geen komende activiteiten in deze groep.', geri: 'Activiteiten', bulunamadi: 'Deze activiteit bestaat niet meer.',
    prSubTablet: 'Wekelijks rooster van lessen en bijeenkomsten',
    gunSec: 'Kies een dag', bugun: 'vandaag', programSay: (n) => `${n} ${n === 1 ? 'programma' : 'programma’s'}`, gunBos: 'Geen programma op deze dag.',
    buHafta: 'Deze week', oncekiHafta: 'Vorige week', sonrakiHafta: 'Volgende week', namazVakitleri: 'Gebedstijden',
    tablo: 'Weekrooster', secili: 'Gekozen programma', hoca: 'Docent',
    vakitAdi: { Fajr: 'Fadjr', Dhuhr: 'Dhoehr', Asr: 'Asr', Maghrib: 'Maghrib', Isha: 'Isha' },
    vakitte: (v) => `Bij ${v}`, sonrasi: (v) => `Na ${v}`, sonrasiKisa: 'na', vaktindeKisa: 'bij',
  },
  en: {
    gruplar: { herkes: 'Everyone', erkekler: 'Men', hanimlar: 'Women', genclik: 'Youth', cocuklar: 'Children' },
    tumu: 'All', tumGruplar: 'All groups', suz: 'Filter by group',
    oneCikan: 'FEATURED', tumGun: 'All day',
    takvimeEkle: 'Add to calendar', paylas: 'Share', linkKopyalandi: 'Link copied', dahaFazla: 'More information',
    kategoriBos: 'No upcoming activities in this group.', geri: 'Activities', bulunamadi: 'This activity no longer exists.',
    prSubTablet: 'Weekly schedule of lessons and gatherings',
    gunSec: 'Choose a day', bugun: 'today', programSay: (n) => `${n} ${n === 1 ? 'program' : 'programs'}`, gunBos: 'No programs on this day.',
    buHafta: 'This week', oncekiHafta: 'Previous week', sonrakiHafta: 'Next week', namazVakitleri: 'Prayer times',
    tablo: 'Weekly schedule', secili: 'Selected program', hoca: 'Teacher',
    vakitAdi: { Fajr: 'Fajr', Dhuhr: 'Dhuhr', Asr: 'Asr', Maghrib: 'Maghrib', Isha: 'Isha' },
    vakitte: (v) => `At ${v}`, sonrasi: (v) => `After ${v}`, sonrasiKisa: 'after', vaktindeKisa: 'at',
  },
};
for (const d of Object.keys(EK)) Object.assign(METIN[d], EK[d]);

// ---------------- Faz C: yükleme ve yeni sürüm ----------------
const PWA = {
  tr: {
    appAd: 'SÜLEYMANİYE CAMİİ',
    installTitle: 'Uygulamayı ana ekrana ekleyin', installBtn: 'Yükle',
    installText: 'Ana ekrandan tam ekran açılır ve internet olmadan da çalışır.',
    installIos: 'Ana ekrandan tam ekran açılır ve internet olmadan da çalışır. Safari’de Paylaş simgesine dokunup “Ana Ekrana Ekle”yi seçin.',
    newVersion: 'Yeni sürüm hazır', refresh: 'Yenile',
  },
  nl: {
    appAd: 'SÜLEYMANİYE MOSKEE',
    installTitle: 'Zet de app op je beginscherm', installBtn: 'Installeren',
    installText: 'Vanaf je beginscherm opent de app schermvullend en werkt hij ook zonder internet.',
    installIos: 'Vanaf je beginscherm opent de app schermvullend en werkt hij ook zonder internet. Tik in Safari op Deel en kies “Zet op beginscherm”.',
    newVersion: 'Nieuwe versie klaar', refresh: 'Vernieuwen',
  },
  en: {
    appAd: 'SÜLEYMANİYE MOSQUE',
    installTitle: 'Add the app to your home screen', installBtn: 'Install',
    installText: 'From your home screen the app opens full screen and also works offline.',
    installIos: 'From your home screen the app opens full screen and also works offline. In Safari, tap Share and choose “Add to Home Screen”.',
    newVersion: 'New version ready', refresh: 'Refresh',
  },
};
for (const d of Object.keys(PWA)) Object.assign(METIN[d], PWA[d]);

// ---------------- Faz D: bildirimler (tasarım: ontwerp/Mobil-Ayarlar.dc.html) ----------------
const BILDIRIM = {
  tr: {
    notif: 'BİLDİRİMLER', notifMaster: 'Namaz vakti bildirimleri', notifBefore: 'Vakitten önce hatırlat',
    notifOff: 'Kapalı', notifMin: 'dk', notifAtTime: 'Vakit girince bildir', notifWhich: 'Hangi vakitler',
    notifPrivacy: 'Bildirim için sadece bu cihazın bildirim adresini ve buradaki seçimlerinizi saklarız. İsim, hesap veya IP adresi saklanmaz. Bildirimleri kapatınca adres silinir.',
    notifIos: 'iPhone’da bildirimler yalnızca uygulama ana ekrandayken çalışır. Safari’de Paylaş’a dokunup “Ana Ekrana Ekle”yi seçin, sonra uygulamayı ana ekrandan açın.',
    notifUnsupported: 'Bu tarayıcı bildirimleri desteklemiyor.',
    notifDenied: 'Bildirimlere izin verilmedi. Telefonun ayarlarından bu uygulamaya bildirim izni verebilirsiniz.',
    notifError: 'Bildirim ayarı kaydedilemedi. İnternet bağlantısını kontrol edip tekrar deneyin.',
    notifOnToast: 'Bildirimler açık', notifOffToast: 'Bildirimler kapalı',
    zilAcik: (ad) => `${ad} bildirimi açık`, zilKapali: (ad) => `${ad} bildirimi kapalı`,
  },
  nl: {
    notif: 'MELDINGEN', notifMaster: 'Meldingen voor gebedstijden', notifBefore: 'Herinner me vooraf',
    notifOff: 'Uit', notifMin: 'min', notifAtTime: 'Melding bij begin gebedstijd', notifWhich: 'Voor welke gebeden',
    notifPrivacy: 'Voor meldingen bewaren we alleen het meldingsadres van dit toestel en je keuzes hierboven. Geen naam, account of IP-adres. Zet je meldingen uit, dan wissen we het adres.',
    notifIos: 'Op de iPhone werken meldingen alleen als de app op het beginscherm staat. Tik in Safari op Deel, kies “Zet op beginscherm” en open de app daarna vanaf je beginscherm.',
    notifUnsupported: 'Deze browser ondersteunt geen meldingen.',
    notifDenied: 'Meldingen zijn niet toegestaan. Je kunt ze aanzetten in de instellingen van je telefoon.',
    notifError: 'De meldingsinstelling kon niet worden bewaard. Controleer je internetverbinding en probeer het opnieuw.',
    notifOnToast: 'Meldingen staan aan', notifOffToast: 'Meldingen staan uit',
    zilAcik: (ad) => `Melding voor ${ad} aan`, zilKapali: (ad) => `Melding voor ${ad} uit`,
  },
  en: {
    notif: 'NOTIFICATIONS', notifMaster: 'Prayer time notifications', notifBefore: 'Remind me before',
    notifOff: 'Off', notifMin: 'min', notifAtTime: 'Notify when the prayer time begins', notifWhich: 'Which prayers',
    notifPrivacy: 'For notifications we only store this device’s notification address and your choices above. No name, account or IP address. Turn notifications off and the address is deleted.',
    notifIos: 'On iPhone, notifications only work when the app is on your home screen. In Safari, tap Share, choose “Add to Home Screen”, then open the app from your home screen.',
    notifUnsupported: 'This browser does not support notifications.',
    notifDenied: 'Notifications are not allowed. You can turn them on in your phone’s settings.',
    notifError: 'The notification setting could not be saved. Check your internet connection and try again.',
    notifOnToast: 'Notifications on', notifOffToast: 'Notifications off',
    zilAcik: (ad) => `${ad} notification on`, zilKapali: (ad) => `${ad} notification off`,
  },
};
for (const d of Object.keys(BILDIRIM)) Object.assign(METIN[d], BILDIRIM[d]);
