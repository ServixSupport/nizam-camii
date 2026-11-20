// Gizlilik bildirimi, uygulamanın içinde (#gizlilik; kullanıcı isteği 20-11-2026: Ayarlar'dan web sitesine gidilmez).
// Metin gizlilik/index.html ile aynı (o sayfa sadece mağaza kayıtlarındaki bağlantı için durur). Biri değişince öbürünü de değiştir.
// Yapı: { baslik, tarih, giris, bolumler: [{ h, p?, liste?: [metin | [kalın, metin]] }] }

export const GIZLILIK = {
  nl: {
    baslik: 'Privacyverklaring',
    tarih: 'Nizam-ı Alem Süleymaniye · Ookmeerweg 206, Amsterdam · 06-11-2026',
    giris: 'Deze verklaring geldt voor de app van de Nizam-ı Alem Süleymaniye Moskee: de app in de Play Store en App Store en de webversie op nizam-camii.vercel.app/mobil.',
    bolumler: [
      { h: 'Wat we niet doen', liste: ['Geen account, naam, e-mailadres of telefoonnummer.', 'Geen advertenties, geen statistieken en geen tracking.', 'We verkopen of delen geen gegevens.'] },
      { h: 'Op je telefoon', p: 'Je instellingen (taal, weergave, meldingen, aftellen, op stil zetten) blijven op je telefoon. In de app uit de Play Store en App Store plant je telefoon de meldingen, het aftellen en het op stil zetten zelf: daarvoor gaat niets naar ons.' },
      { h: 'Gebedstijden en activiteiten', p: 'De app haalt de gebedstijden en de activiteiten van de moskee op bij onze server (Vercel). Zoals bij elke website verwerkt de server daarbij technische gegevens, zoals je IP-adres, om het antwoord te kunnen sturen. Wij gebruiken die niet om je te volgen.' },
      { h: 'Meldingen in de webversie', p: 'Zet je in de webversie (browser) meldingen aan, dan bewaren we alleen het meldingsadres van dat toestel, je taal en de gebeden die je kiest (bij onze dienstverlener Upstash). Zet je de meldingen uit, dan wissen we het adres.' },
      { h: 'Toestemmingen in de Android-app', liste: [
        ['Meldingen', 'voor de meldingen bij gebedstijden en het aftellen in de statusbalk.'],
        ['Wekkers en herinneringen', 'zodat alles precies op tijd gebeurt.'],
        ['Toegang tot “Niet storen”', 'alleen als je zelf “Telefoon op stil bij gebedstijd” aanzet. Na de gekozen tijd zet de app je telefoon terug zoals hij was.'],
        ['Starten na opnieuw opstarten', 'zodat de planning blijft werken.'],
      ] },
      { h: 'Vragen', p: 'Stel je vraag aan het bestuur van de moskee: Nizam-ı Alem Süleymaniye Moskee, Ookmeerweg 206, Amsterdam.' },
    ],
  },
  tr: {
    baslik: 'Gizlilik bildirimi',
    tarih: 'Nizam-ı Alem Süleymaniye · Ookmeerweg 206, Amsterdam · 06-11-2026',
    giris: "Bu bildirim Nizam-ı Alem Süleymaniye Camii uygulaması için geçerlidir: Play Store ve App Store'daki uygulama ve nizam-camii.vercel.app/mobil adresindeki web sürümü.",
    bolumler: [
      { h: 'Yapmadıklarımız', liste: ['Hesap, isim, e-posta veya telefon numarası istenmez.', 'Reklam, istatistik ve takip yoktur.', 'Hiçbir veri satılmaz veya paylaşılmaz.'] },
      { h: 'Telefonunuzda', p: "Ayarlarınız (dil, görünüm, bildirimler, geri sayım, sessize alma) telefonunuzda kalır. Play Store ve App Store'daki uygulamada bildirimleri, geri sayımı ve sessize almayı telefonunuz kendisi zamanlar; bunun için bize hiçbir şey gönderilmez." },
      { h: 'Namaz vakitleri ve faaliyetler', p: 'Uygulama namaz vakitlerini ve caminin faaliyetlerini sunucumuzdan (Vercel) alır. Her web sitesinde olduğu gibi sunucu, cevabı gönderebilmek için IP adresi gibi teknik bilgileri işler. Bunları sizi takip etmek için kullanmayız.' },
      { h: 'Web sürümünde bildirimler', p: "Web sürümünde (tarayıcıda) bildirimleri açarsanız sadece o cihazın bildirim adresini, dilinizi ve seçtiğiniz vakitleri saklarız (hizmet sağlayıcımız Upstash'te). Bildirimleri kapatınca adres silinir." },
      { h: 'Android uygulamasındaki izinler', liste: [
        ['Bildirimler', 'namaz vakti bildirimleri ve durum çubuğundaki geri sayım için.'],
        ['Alarmlar ve hatırlatıcılar', 'her şey tam zamanında olsun diye.'],
        ['“Rahatsız Etmeyin” erişimi', 'sadece “Namaz vaktinde telefonu sessize al”ı kendiniz açarsanız. Seçtiğiniz süre bitince telefon eski haline döner.'],
        ['Telefon yeniden açılınca başlama', 'zamanlama devam etsin diye.'],
      ] },
      { h: 'Sorular', p: 'Sorularınızı cami yönetimine iletin: Nizam-ı Alem Süleymaniye Camii, Ookmeerweg 206, Amsterdam.' },
    ],
  },
  en: {
    baslik: 'Privacy policy',
    tarih: 'Nizam-ı Alem Süleymaniye · Ookmeerweg 206, Amsterdam · 06-11-2026',
    giris: 'This policy applies to the app of the Nizam-ı Alem Süleymaniye Mosque: the app in the Play Store and App Store and the web version at nizam-camii.vercel.app/mobil.',
    bolumler: [
      { h: "What we don't do", liste: ['No account, name, email address or phone number.', 'No ads, no analytics and no tracking.', "We don't sell or share any data."] },
      { h: 'On your phone', p: 'Your settings (language, appearance, notifications, countdown, silencing) stay on your phone. In the Play Store and App Store app, your phone schedules the notifications, the countdown and the silencing itself: nothing is sent to us for this.' },
      { h: 'Prayer times and activities', p: "The app gets the prayer times and the mosque's activities from our server (Vercel). Like any website, the server processes technical data such as your IP address to send the response. We do not use it to track you." },
      { h: 'Notifications in the web version', p: "If you turn on notifications in the web version (browser), we only store that device's notification address, your language and the prayers you choose (with our provider Upstash). When you turn notifications off, the address is deleted." },
      { h: 'Permissions in the Android app', liste: [
        ['Notifications', 'for prayer time notifications and the countdown in the status bar.'],
        ['Alarms & reminders', 'so everything happens right on time.'],
        ['“Do Not Disturb” access', 'only if you turn on “Silence phone at prayer time” yourself. After the time you choose, the app puts your phone back the way it was.'],
        ['Start after reboot', 'so the schedule keeps working.'],
      ] },
      { h: 'Questions', p: 'Please ask the mosque board: Nizam-ı Alem Süleymaniye Mosque, Ookmeerweg 206, Amsterdam.' },
    ],
  },
};

/** Sayfayı seçili dilde çizer. */
export function gizlilikCiz(kok, dil) {
  const d = GIZLILIK[dil] || GIZLILIK.nl;
  const el = (ad, metin, sinif) => { const e = document.createElement(ad); if (metin != null) e.textContent = metin; if (sinif) e.className = sinif; return e; };
  kok.querySelector('h1').textContent = d.baslik;
  const govde = kok.querySelector('.gz-icerik');
  govde.replaceChildren(el('p', d.tarih, 'gz-tarih'), el('p', d.giris));
  for (const b of d.bolumler) {
    govde.append(el('h2', b.h));
    if (b.p) govde.append(el('p', b.p));
    if (b.liste) {
      const ul = el('ul');
      for (const x of b.liste) {
        const li = el('li');
        if (Array.isArray(x)) li.append(el('b', x[0]), `: ${x[1]}`); else li.textContent = x;
        ul.append(li);
      }
      govde.append(ul);
    }
  }
}
