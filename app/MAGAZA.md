# Mağaza metinleri ve formlar

Google Play Console ve App Store Connect'e kopyalanacak metinler. Görseller: `app/magaza/`.

## Genel bilgiler

| Alan | Değer |
|---|---|
| Uygulama kimliği | `nl.suleymaniyecamii.namaz` |
| Gizlilik politikası | https://nizam-camii.vercel.app/gizlilik/ |
| Destek / web sitesi | https://nizam-camii.vercel.app/mobil/ |
| Kategori | Yaşam tarzı (Lifestyle) |
| Fiyat | Ücretsiz, reklamsız, uygulama içi satın alma yok |
| Yaş | Herkes / 4+ (şiddet, kumar, kullanıcı içeriği yok) |
| Dil | Varsayılan Hollandaca; ayrıca Türkçe ve İngilizce |

## Google Play: mağaza sayfası

### Hollandaca (varsayılan)

- **Ad (en fazla 30):** Süleymaniye Moskee
- **Kısa açıklama (en fazla 80):** Gebedstijden, aftellen en meldingen van de Süleymaniye Moskee in Amsterdam.
- **Uzun açıklama:**

```
De officiële app van de Nizam-ı Alem Süleymaniye Moskee, Ookmeerweg 206 in Amsterdam.

• Gebedstijden van vandaag en morgen (Diyanet), in Amsterdamse tijd
• Aftellen tot het volgende gebed, ook bovenin je telefoon in de statusbalk
• Melding vooraf (5, 10, 15 of 30 minuten) en bij het begin van de gebedstijd
• Zet je telefoon automatisch op stil bij gebedstijd; na de gekozen tijd staat hij weer zoals hij was
• Activiteiten en wekelijkse lessen van de moskee
• Licht en donker thema, in het Nederlands, Turks en Engels

Geen account, geen advertenties, geen tracking. Je instellingen blijven op je telefoon.
```

### Türkçe

- **Ad:** Süleymaniye Camii
- **Kısa açıklama:** Amsterdam Süleymaniye Camii: namaz vakitleri, geri sayım ve bildirimler.
- **Uzun açıklama:**

```
Nizam-ı Alem Süleymaniye Camii'nin (Ookmeerweg 206, Amsterdam) resmî uygulaması.

• Bugünün ve yarının namaz vakitleri (Diyanet), Amsterdam saatiyle
• Sıradaki vakte geri sayım, telefonun üst çubuğunda da
• Vakitten önce (5, 10, 15 veya 30 dakika) ve vakit girince bildirim
• Namaz vaktinde telefonu otomatik sessize alma; seçtiğiniz süre bitince telefon eski haline döner
• Caminin faaliyetleri ve haftalık dersleri
• Açık ve koyu tema; Türkçe, Hollandaca ve İngilizce

Hesap yok, reklam yok, takip yok. Ayarlarınız telefonunuzda kalır.
```

### İngilizce

- **Ad:** Süleymaniye Mosque
- **Kısa açıklama:** Prayer times, countdown and notifications from the Süleymaniye Mosque Amsterdam.
- **Uzun açıklama:**

```
The official app of the Nizam-ı Alem Süleymaniye Mosque, Ookmeerweg 206, Amsterdam.

• Today's and tomorrow's prayer times (Diyanet), in Amsterdam time
• Countdown to the next prayer, also at the top of your phone in the status bar
• Notification before (5, 10, 15 or 30 minutes) and when the prayer time begins
• Automatically silence your phone at prayer time; afterwards it goes back to how it was
• The mosque's activities and weekly lessons
• Light and dark theme, in Dutch, Turkish and English

No account, no ads, no tracking. Your settings stay on your phone.
```

### Görseller (`app/magaza/android`)

- Simge 512×512: `simge-512.png`
- Tanıtım görseli 1024×500: `tanitim-1024x500.png`
- Telefon ekran görüntüleri (1080×1920):
  - `01-ana.png`
  - `02-ana-gece.png`
  - `03-durum-cubugu.png`
  - `04-ayarlar.png`

## Google Play: formlar

### Veri güvenliği (Data safety)

- **Veri toplanıyor mu?** Hayır.
  - Uygulama hiçbir kişisel veriyi toplamaz veya saklamaz.
  - Ayarlar telefonda kalır.
  - Vakitler herkese açık bir adresten okunur.
- **Veri paylaşılıyor mu?** Hayır.
- **Aktarım şifreli mi?** Evet (HTTPS).

### Diğer formlar

- **Reklam:** İçermez.
- **Uygulama erişimi:** Bütün özellikler girişsiz kullanılır.
- **Hedef kitle:** 13 yaş ve üstü. 13 altı seçilirse Google'ın aile programı kuralları devreye girer.
- **İçerik derecelendirmesi:** Anketteki bütün sorulara "Hayır" ("Referans / haber / eğitim" değil, "Diğer" uygulama türü).

### Haber/sağlık/finans beyanları

Hiçbiri. Hükümet uygulaması değildir.

### İzinler

Hepsi "normal" izindir; Play'de ayrıca beyan gerekmez:
- Bildirim.
- `SCHEDULE_EXACT_ALARM`: kullanıcı kendisi açar. Kısıtlı olan `USE_EXACT_ALARM` kullanılmadı.
- "Rahatsız Etmeyin" erişimi.
- Telefon yeniden açılınca başlama.

## App Store Connect

### Adlar ve kısa metinler

| | Hollandaca | Türkçe | İngilizce |
|---|---|---|---|
| Ad (en fazla 30) | Süleymaniye Moskee | Süleymaniye Camii | Süleymaniye Mosque |
| Alt başlık (en fazla 30) | Gebedstijden Amsterdam | Amsterdam namaz vakitleri | Prayer times Amsterdam |

### Anahtar kelimeler (en fazla 100)

- **Hollandaca:** `gebedstijden,namaz,moskee,amsterdam,diyanet,ezan,islam,salah,gebed,vakit,cami`
- **Türkçe:** `namaz,vakit,cami,ezan,amsterdam,diyanet,hollanda,islam,imsakiye,ramazan`
- **İngilizce:** `prayer,times,mosque,amsterdam,salah,diyanet,islam,adhan,muslim,namaz`

### Diğer alanlar

- **Açıklama:** Play'deki uzun açıklamayla aynı. iPhone'da üç şey farklıdır; ilgili satırları bunlarla değiştirin:
  - Geri sayım kilit ekranı widget'ındadır. "üst çubukta" yazan satır yerine: "Aftel-widget op je vergrendelscherm" / "Kilit ekranında geri sayım widget'ı" / "Countdown widget on your Lock Screen".
  - Sessize alma satırını iPhone'da silin: Apple buna izin vermez.
- **App Privacy:** "Data Not Collected" (Veri toplanmıyor).
- **Şifreleme:** Sadece standart HTTPS. `Info.plist`'te `ITSAppUsesNonExemptEncryption = NO`.
- **Görseller (`app/magaza/ios/nl` ve `tr`):**
  - iPhone 6,9" (1320×2868): `iphone-01-ana`, `iphone-02-ana-gece`, `iphone-03-ayarlar`
  - iPad 13" (2064×2752): `ipad-…`
- **İnceleme notu (App Review):**

```
No login required. The app shows the prayer times of our mosque in Amsterdam, local notifications at prayer
times (scheduled on the device) and a Lock Screen / Home Screen countdown widget ("Süleymaniye").
Prayer times come from our own server (https://nizam-camii.vercel.app/api/vakit).
```

Kontrol: Metinler din adamının değil, uygulamanın tanıtımıdır. Yine de yayından önce cami yönetimine gösterilmeli.
