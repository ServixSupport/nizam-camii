# Testler

Playwright testleri. Bu klasörün kendi `package.json`'ı var; kökteki `package.json`'a dokunulmaz (onu Vercel yükler).
Bu klasör Vercel'e yüklenmez (`.vercelignore`).

## Çalıştırma

```bash
cd tests
npm install                     # ilk seferde
npx playwright install chromium # ilk seferde
npm test                        # bütün testler
npm run test:tv                 # sadece TV
npm run rapor                   # son çalıştırmanın HTML raporu
```

İlk çalıştırmada TV'nin Google fontları (Inter, Amiri) indirilip `tests/.cache/fonts/`'a konur. Sonra internet gerekmez.

## TV testleri (`tv/`) — Faz 0

- `davranis.spec.js`: vakitler, Sabah = Güneş − 60, hazırlık sayacı, ezan anı, ayet/hadis/dua paneli, cuma hutbesi,
  temalar, ayarlar penceresi, Aladhan yedeği, internetsiz açılış, yaz saati, gün değişimi.
- `goruntu.spec.js`: referans ekran görüntüleri, `tv/__goruntuler__/` altında (1920×1080, 1366×768, 960×540).
- **TV değişmemeli.** Bu testler kırmızıysa önce neyin TV'yi değiştirdiğini bul. Referansları güncelleme
  (`npm run goruntu-guncelle`) sadece kullanıcı bir TV değişikliğini açıkça onayladıysa.
- Referans görüntüler bu Windows bilgisayarda çekildi; başka işletim sisteminde pikseller biraz farklı çıkabilir.

## Faz A testleri

- `yonlendirme/`: tek link — TV'ler (Tizen, webOS, Android TV, Fire TV, Mi Box …) ve bilgisayarlar TV'de kalır;
  telefon, Android tablet ve iPad `/mobil/`'e gider. `?ekran=`, çerez, `?test=`/`?theme=`, iframe, betik hatası.
- `mantik/`: `mobil/zaman.js` (Amsterdam saati, yaz saati 25-10-2026 ve 28-03-2027, vakit kuralları, kemer). Tarayıcısız.
- `mobil/davranis.spec.js`: uygulama (390×844). TV ile aynı an aynı vakitler, başka saat dilimi, dil/tema, sekmeler.
- `mobil/goruntu.spec.js`: referans görüntüler 390×844, 820×1180, 1180×820; yatay kaydırma kontrolü.

## Nasıl çalışıyor

- `sunucu.mjs` depo kökünü sunar; `/api/*` sunulmaz, testler mock'lar (`yardimci/tv.js`).
- Saat sahte: sayfa açılmadan Playwright clock kurulur ve durdurulur; zaman sadece `ileri()` / `saatGit()` ile akar.
- Saat dilimi `Europe/Amsterdam`. Test günü Çarşamba 28-10-2026; cuma testleri 30-10-2026.
- `fixtures/vakit.json`: 24-10-2026'da canlı `/api/vakit`'ten bir kez alınan veri (23.10–23.11.2026), şehir kimliği çıkarıldı.
- `fixtures/hutbe.json`: açıkça test metni; diyanet.nl'den değil.
