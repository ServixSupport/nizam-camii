# Mağaza uygulaması (Play Store, App Store)

`/mobil/` web uygulaması, telefona kurulan gerçek bir uygulama olarak (Capacitor 8). Ekranlar aynı dosyalardan gelir;
telefona özgü özellikler `mobil/yerel*.js` ve bu klasördeki eklentilerde.

| | Android | iPhone |
|---|---|---|
| Namaz vakti bildirimleri | Telefon kendisi zamanlar (sunucu yok) | Telefon kendisi zamanlar (en yakın 60 bildirim; uygulama her açılışta yeniler) |
| Geri sayım | Bildirim panelinde vakit tablosu (hicri tarih, "Öğle'ye 1:23:45", 7 vakit; sıradaki kırmızı). Vakte 30 dk kala üst çubuktaki cami simgesinin içinde kalan dakika | Kilit ekranı / ana ekran widget'ı (iPhone'da durum çubuğuna uygulama simge koyamaz) |
| Tek bildirim | Panel açıksa vakit bildirimi ayrı gelmez: panel bir kez sesli uyarır, üst satırında 15 dk "Öğle vakti girdi" yazar | Ayrı bildirimler (aynı vakit gruplanır) |
| Namaz vaktinde sessize alma | Var (sessiz veya titreşim; süre bitince eski hale döner) | Yok: Apple uygulamaların telefonu sessize almasına izin vermez |
| Sistem çubukları | Temaya göre (açık/koyu) | Saat ve simgeler temaya göre |
| Vakit girince ses | Telefonun sesi, kısa ezan veya uzun ezan (Ayarlar → Bildirimler; 1.1 sürümünden beri) | Telefonun sesi (iPhone'da bildirim sesi en fazla 30 sn; şimdilik seçenek yok) |

## Ezan sesleri (Android, `android/app/src/main/res/raw/`)

- `ezan_uzun.ogg`: Wikimedia Commons, [Beautiful adhan.ogg](https://commons.wikimedia.org/wiki/File:Beautiful_adhan.ogg), yükleyen Adam-synagda, lisans **CC0** (serbest; isim yazmak gerekmez). Değiştirilmeden, 2:34.
- `ezan_kisa.ogg`: aynı kaydın ilk 17,6 saniyesi (ilk "Allahu ekber, Allahu ekber"), sonda 1 sn ses azalır (ffmpeg).
- Her ses kendi bildirim kanalında (`vakit_ezan_kisa`, `vakit_ezan_uzun`; `Planlayici.kanallar`). Android'de kanalın sesi sonradan değişmez; dosyayı aynı adla değiştirmek yeterli.
- Ezan sadece beş vakit namazda, vakit girince çalar. Önceden hatırlatma, İmsak ve Güneş telefonun sesiyle.
- Durdurmak: bildirim ekranını aşağı çekmek (Android bunu kendisi yapar), bildirime dokunmak veya kaydırmak. Bildirim panelinde uygulama açılınca panel sessizce yenilenir, ezan yine durur.
- Emülatörde denendi (08-11-2026): deneme bildirimi kısa ve uzun ezanla çaldı; panelden vakit uyarısı (uygulama arka planda) uzun ezanla çaldı, 35 sn sonra hâlâ çalıyordu; bildirim ekranını aşağı çekince ve uygulamayı açınca durdu.
- Caminin kendi müezzininin kaydı gelirse aynı adlarla (`ezan_kisa.ogg`, `ezan_uzun.ogg`) değiştirin.

## Klasörler

- `android/`: Android projesi. Kendi kodumuz `app/src/main/java/nl/suleymaniyecamii/namaz/`:
  - `CamiPlugin` (köprü)
  - `Planlayici` (alarm, bildirim paneli, sessiz)
  - `CamiSimgesi` (üst çubukta içinde dakika yazan cami simgesi)
  - `res/layout/bildirim_vakitler*.xml` (paneldeki tablo: kapalı hali saatler, açık hali adlar + saatler)
  - `PlanMantigi` (saf mantık, birim testli)
  - `VakitAlici` ve `AcilisAlici` (alarm, telefon yeniden açılınca)
- `ios/`: Xcode projesi.
  - `App/App/CamiPlugin.swift`, `ViewController.swift`
  - `App/SayacWidget/`: kilit ekranı widget'ı
  - App Group: `group.nl.suleymaniyecamii.namaz`
- `araclar/www.mjs`: `../mobil` klasörünü uygulamanın içine kopyalar (`www/`, git'e girmez).
- `magaza/`: mağaza görselleri.
  - Android: emülatörden.
  - iOS: `tests/magaza/gorseller.spec.js`.
  - Tanıtım görseli: `tests/araclar/magaza-afis.mjs`.
- `MAGAZA.md`: mağaza metinleri ve formlardaki cevaplar.
- `cikti/` (git'e girmez): yerelde derlenen `.aab` (Play) ve deneme `.apk`.

Uygulama kimliği: `nl.suleymaniyecamii.namaz`. Bu kimlik yayından sonra değişmez.

## Önemli

- **Web'de yapılan değişiklik uygulamaya kendiliğinden geçmez.** `mobil/` dosyaları uygulamanın içinde taşınır.
  - Vakitler ve faaliyetler internetten gelir; onlar hep güncel.
  - Ekran veya metin değişikliği için yeni sürüm derlenip mağazaya yüklenir.
- **Vakitler** yine sadece `https://nizam-camii.vercel.app/api/vakit` (parametresiz) adresinden alınır (CLAUDE.md kural 2).
- **Play yükleme anahtarı depoda değil:** `C:\Users\Altun\Documents\Suleymaniye-uygulama-anahtari\` (şifre `BENI-OKU.txt` içinde).
  - Gradle anahtarı `C:\Users\Altun\.gradle\gradle.properties` dosyasından okur (`CAMI_ANAHTAR_*`).
  - Klasörün yedeği alınmalı.
- Her mağaza yüklemesinde sürüm numarası artar:
  - Android: `android/app/build.gradle` → `versionCode` (+1) ve `versionName`.
  - iOS: TestFlight iş akışı çalıştırma numarasını kullanır.

## Derleme (Windows, bu bilgisayar)

Araçlar `C:\Users\Altun\android\` altında: `jdk-21`, `sdk` (emülatör dahil), `node24`.

```bash
cd app
export PATH="/c/Users/Altun/android/node24:$PATH" JAVA_HOME="C:\\Users\\Altun\\android\\jdk-21"
node araclar/www.mjs && npx cap sync android
cd android && ./gradlew.bat testDebugUnitTest assembleDebug   # deneme APK
./gradlew.bat bundleRelease                                    # Play Store için imzalı .aab
```

- Emülatörler: `cami` (Android 16) ve `cami161` (Android 16.1).
  - Başlatma: `sdk/emulator/emulator.exe -avd cami161`.
  - Ortam değişkeni: `ANDROID_AVD_HOME=C:\Users\Altun\android\avd`.
- Simgeler ve açılış ekranı: `cd tests && node araclar/app-simgeler.mjs`.

## GitHub Actions

- `.github/workflows/app.yml`: her değişiklikte Android APK'sı ve iOS simülatör derlemesi yapılır, ekran görüntüsü alınır.
  - Sonuçlar: Actions → çalıştırma → Artifacts.
- `.github/workflows/app-ios-testflight.yml`: elle başlatılır; App Store Connect'e yükler.
  - Gereken Secrets dosyanın başında yazılı.
  - Apple hesabı olmadan denenemedi.

## Testler

- Uygulama tarafı: `tests/mobil/yerel.spec.js` (sahte telefon eklentisiyle) ve `tests/mantik/yerel-plan.spec.js`.
- Android: `PlanMantigiTest` (JUnit).
- Emülatörde elle denendi (06/07-11-2026):
  - Bildirim panelindeki tablo; 12:05'te simgede 24, her dakika bir azaldı; 12:28'de 1.
  - Vakit girince tek bildirim (panel sesli uyardı, "Maghrib is begonnen · 17:09"), tablo sıradaki vakte geçti.
  - 06:25'te "15 dk kala" bildirimi, 06:40'ta vakit bildirimi.
  - 06:40'ta telefon sessize alındı, 07:10'da zil ve "Rahatsız Etmeyin" eski haline döndü.
  - Açık ve koyu temada sistem çubukları.
- iPhone: sadece simülatörde açılış ve derleme denendi. Bildirim ve widget gerçek bir iPhone'da (TestFlight) denenmeli.
