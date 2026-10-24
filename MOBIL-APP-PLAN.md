# Mobil uygulama (telefon + tablet) ve `/admin` yönetim paneli

**Durum:** plan, henüz yapılmadı. Hazırlanma tarihi 24-10-2026; tasarım kullanıcı tarafından onaylandı ("design super").
**Faz 0:** bitti, kullanıcı onayladı, 24-10-2026'da `main`'e alındı (commit `fe4b5db`).
**Faz A:** 24-10-2026'da yapıldı, `faz-a` dalında; kullanıcı onayı bekleniyor.
- Kararlar: S5 = Arapça-Latin isimler; ilk dil herkes için Hollandaca; Vercel Preview koruması kapatılacak (deneme linkleri girişsiz).
Önce `CLAUDE.md`'yi oku. Oradaki kesin kurallar burada da geçerli. Faz faz çalış (§9).

---

## 0. Kullanıcının istediği

- **Tek link:** https://nizam-camii.vercel.app/
  - TV'de açılınca bugünkü büyük ekran gelir, hiç değişmeden.
  - Telefonda veya tablette açılınca **mobil uygulama** gelir: tam ekran, dört sekmeli (**Ana ekran, Faaliyetler, Programlar, Ayarlar**).
- **Diller:** Türkçe, Nederlands, English. Seçim Ayarlar'da yapılır.
- **İçerik:** faaliyetleri ve haftalık programları cami **`/admin`** sayfasından ekler. Cemaat sadece görür, değiştiremez.
  - Kullanıcı login ekranı istemiyor (24-10-2026). Koruma için bkz. §5.
- **Altyapı:** ayrı bir Vercel projesi veya ayrı bir veritabanı olmayacak. Her şey bu sitede ve bu depoda.
- **Sonra:** vakit girince ve X dakika önce bildirim (Faz D).
- **Tasarım:** `ontwerp/` (§3). Olabildiğince birebir uygula.

## 1. Aynı link: TV mi, mobil mi?

**Uygulama `/mobil/` klasöründe durur.** `/` adresi TV'nin `index.html`'idir. Karar tarayıcıda verilir.
- `index.html`'in `<head>`'inde, `<meta charset>`'tan hemen sonra, **ilk betik olarak** küçük bir ES5 betiği çalışır.
- Betik `try/catch` içindedir; hata olursa hiçbir şey yapmaz ve TV ekranı açılır.

### Neden sunucuda değil?

- Vercel statik `index.html`'i rewrite kurallarından önce sunar.
- Routing Middleware mümkün, ama TV için yeni bir arıza noktası olur.
- Sonra istenirse yalnızca telefonlar için eklenebilir. Ama önce Preview deploy'da UA testleri yapılmalı.

### Betiğin mantığı (sırayla)

1. **Elle seçim:** adreste `?ekran=tv` veya `?ekran=mobil` varsa bunu `ekran` çerezine yaz (1 yıl, `path=/`).
   - `?ekran=tv` → TV ekranı açılır.
   - `?ekran=mobil` → `/mobil/`'e gider.
   - Tableti duvar ekranı olarak kullananlar `/?ekran=tv` açar.
2. **Hiç yönlendirmeme durumları:**
   - Adreste `test=` veya `theme=` var (TV'yi deneyen biri).
   - Sayfa bir iframe içinde açılmış.
3. **Çerez varsa** onu uygula.
4. **TV işareti** user-agent'ta varsa → TV. İşaretler:
   - `SMART-TV`, `SmartTV`, `Tizen`, `Web0S`, `webOS`, `NetCast`, `HbbTV`, `BRAVIA`, `AFT` (Fire TV), `GoogleTV`, `Android TV`, `CrKey`, `Roku`, `Viera`, `TV Safari`, `Large Screen`.
   - Listeyi kolay genişletilebilir tut.
5. **Telefon** (`iPhone`, `iPod`, `iPad`, `Android … Mobile`, `Windows Phone`) **veya dokunmatik cihaz** → `location.replace('/mobil/')`.
   - Dokunmatik: `navigator.maxTouchPoints > 0` **ve** `matchMedia('(pointer: coarse)')`.
   - Böylece Mac gibi görünen iPad ve Android tabletler de yakalanır.
   - Dokunmatik olmayan Android TV kutuları (ör. Mi Box) TV'de kalır.
6. **Geri kalan her şey** (bilgisayar, bilinmeyen) → TV.

Uygulamanın Ayarlar sekmesinde "Bu cihazda TV ekranını aç" bağlantısı olur: `/?ekran=tv`. Geri dönmek için: `/?ekran=mobil`.

### Testler (zorunlu)

| Cihaz | Beklenen |
|---|---|
| Samsung Tizen, LG webOS, Android TV/Fire TV, Mi Box (dokunmatik değil) | TV |
| Windows/Mac tarayıcı (fare) | TV |
| iPhone, Android telefon | `/mobil/` |
| Android tablet, iPadOS (Mac UA + `maxTouchPoints=5`) | `/mobil/` |
| Telefonda `/?ekran=tv` | TV + çerez; sonra parametresiz de TV |
| `?test=…`, `?theme=…`, iframe içinde | asla yönlendirme yok |

Ek olarak: TV için mevcut davranış testleri ve ekran görüntüleri (Faz 0'da çekilen) değişmeden geçmeli.

## 2. Hedef klasör yapısı

```
index.html                TV (sadece en üste yönlendirme betiği eklenir)
api/vakit.js              değişmez
api/hutbe.js              değişmez
api/admin/veri.js         güncel içeriği GitHub'dan okur (Faz B)
api/admin/kaydet.js       içeriği doğrular ve commit eder (Faz B)
api/admin/resim.js        faaliyet resmini commit eder (Faz B)
mobil/index.html          uygulama
mobil/app.js, app.css     vanilla JS/CSS (ES modülleri olabilir)
mobil/fonts/              kendi sunduğumuz woff2 dosyaları + OFL lisansı
mobil/manifest.webmanifest, mobil/sw.js, mobil/ikon-*.png   (Faz C)
admin/index.html, admin.js, admin.css
veri/icerik.json          faaliyetler + programlar
veri/resimler/            faaliyet resimleri
ontwerp/                  tasarım (yayınlanmaz)
tests/                    Playwright, kendi package.json'ı ile (yayınlanmaz)
.vercelignore
```

- **Build adımı ve framework yok.** Site gibi uygulama da düz HTML/CSS/JS olur, telefonlar için modern JS serbest.
- Böylece kullanıcı dosyaları GitHub'a yine yükleyebilir.
- `vercel.json` sadece header'lar için gerekir:
  - `/admin` için `X-Robots-Tag: noindex`
  - `/mobil/sw.js` için `Cache-Control: no-cache`
  - `/veri/icerik.json` için `Cache-Control: no-cache`

## 3. Tasarım (`ontwerp/`)

### Dosyalar

| Dosya | Ekran |
|---|---|
| `Main.dc.html` | Telefon, Ana ekran, gündüz (tweak: Gündüz/Gece) |
| `Mobil-Gece-NL.dc.html` | Telefon, Ana ekran, gece, Hollandaca |
| `Mobil-Faaliyetler.dc.html` | Telefon, Faaliyetler |
| `Mobil-Programlar.dc.html` | Telefon, Programlar (gün seçici + zaman çizelgesi) |
| `Mobil-Ayarlar.dc.html` | Telefon, Ayarlar (TR/NL/EN bütün ekranı değiştirir) |
| `Mobil-Bildirim.dc.html` | Bildirimlerin görünüşü (Faz D) |
| `Tablet-Ana-ekran.dc.html` | Tablet yatay 1180×820: yan menü, büyük kemer, vakit ızgarası, kartlar |
| `Tablet-Programlar.dc.html` | Tablet dikey 820×1180: haftalık tablo, namaz çizgileri |

- Biçim `ontwerp/README.md`'de açıklanıyor. Inline style'lardaki değerler esastır.
- Logo: `ontwerp/logo-nizam.png`.

### Ana fikir: mihrap kemeri

- **Kemer çizimi:**
  - SVG `viewBox 0 0 300 360`.
  - Yol: `M16 348 V200 A190 190 0 0 1 150 18.4 A190 190 0 0 1 284 200 V348`, `pathLength=1000`.
- **Vakitler ve "şimdi":**
  - Her vakit kemerde bir nokta.
  - Güneş (gündüz) veya ay (Akşam'dan sonra) "şimdi"nin yerinde durur.
  - Geçilen kısım düz altın çizgi, kalanı noktalı.
  - Sıradaki vakit mercan rengi halka, şimdiki vakit turkuaz nokta.
- **Konumların hesabı:**
  - Gerçek saatlerden hesapla: İmsak ile Yatsı arasındaki oran, `getPointAtLength` ile.
  - Yatsı'dan sonra ertesi İmsak'a kadar ay görünür; ilerleme Yatsı → İmsak arasında gösterilir.
  - Tasarımdaki sabit koordinatlar sadece 24-10 örneğidir.
- **Kemerin içi:**
  - "AKŞAM'A KALAN" yazısı (TV'deki `dat` metinleri), `H:MM:SS` geri sayım.
  - Sıradaki vaktin adı ve saati, Arapça etiketi.

### Renkler

| Token | Gündüz | Gece |
|---|---|---|
| ground | `#F6F1E7` | `#0C1834` |
| ink | `#14295A` | `#F3EEE3` |
| soft | `#4E5B76` | `#A9B5CF` |
| line | `#E3D8C4` | `rgba(232,194,122,.16)` |
| gold | `#A8843A` | `#E8C27A` |
| goldLine | `rgba(168,132,58,.45)` | `rgba(232,194,122,.4)` |
| cobalt (aktif) | `#1F46A6` | `#A9C1FA` |
| turq (şimdi) | `#0B6E6A` | `#5CC9BF` |
| coral (sıradaki) | `#B5432B` | `#F08B6E` |
| sun | `#E2A43C` | `#E8C27A` |
| sky (kemer içi) | `#FBF7EF` → `#E4EEE9` | `#1A2E61` → `#0F1F45` |
| card | `#FFFDF8` | `#13234A` |

- **Grup renkleri (gündüz):** Çocuklar `#8A6420`, Gençlik `#0B6E6A`, Hanımlar `#B5432B`, Erkekler `#1F46A6`, Herkes `#14295A`.
- Gece için daha açık tonlar seç ve kontrastı WCAG AA'ya göre kontrol et.

### Fontlar ve motifler

- **Fontlar** woff2 olarak `mobil/fonts/`'tan sunulur; Google'a istek gitmez, uygulama internetsiz de çalışır. Lisans OFL.
  - Bodoni Moda: başlıklar, saatler, geri sayım (`lining-nums tabular-nums`).
  - Hanken Grotesk: metin.
  - Noto Kufi Arabic: Arapça etiketler.
- **Motifler:**
  - Sekiz köşeli yıldız: iki kare, 45° dönük. Soluk desen ve madde işareti olarak kullanılır.
  - Kemer şeklinde tarih kutuları (`border-radius: 35px 35px 10px 10px`).
  - Haftalık tabloda üst köşeleri kemerli bloklar.

### Davranış ve erişilebilirlik

- **Tema:**
  - Otomatik (varsayılan): Güneş'ten Akşam'a kadar açık, sonra koyu; TV'deki "auto" gibi.
  - Açık ve Koyu da seçilebilir. Seçim cihazda saklanır.
- **Tam ekran:**
  - `viewport-fit=cover`, `env(safe-area-inset-*)`, yükseklik `100dvh`.
  - Yüklenince `display: standalone`.
  - Sahte durum çubuğu yok.
- **Erişilebilirlik:**
  - Dokunma hedefleri en az 44×44 px. İki temada da kontrast AA.
  - `prefers-reduced-motion`'a uy.
  - Gerçek buton ve linkler; anahtarlarda `aria-pressed`; Arapçada `lang="ar" dir="rtl"`.
- **Düzen:**
  - Telefonda sekme çubuğu altta.
  - Tablette (genişlik ≥ ~768 px) yan menü solda.
  - Programlar: tablet dikeyde haftalık tablo, telefonda gün seçici.

## 4. Veriler: `veri/icerik.json`

Veri dosyası şöyle görünür (örnek):

```json
{
  "guncelleme": "2026-10-24T18:00:00+02:00",
  "faaliyetler": [
    {
      "id": "f-8k2m1q",
      "grup": "herkes",
      "baslik":   { "tr": "Aile Kahvaltısı", "nl": "Familieontbijt", "en": "" },
      "aciklama": { "tr": "…", "nl": "", "en": "" },
      "baslangic": "2026-10-31T10:00",
      "bitis": "2026-10-31T13:00",
      "tumGun": false,
      "yer": "Konferans salonu",
      "resim": "/veri/resimler/f-8k2m1q.jpg",
      "link": "",
      "oneCikan": true,
      "yayinda": true
    }
  ],
  "programlar": [
    {
      "id": "p-3n7d0a",
      "grup": "erkekler",
      "baslik":   { "tr": "Tefsir dersi", "nl": "", "en": "" },
      "aciklama": { "tr": "", "nl": "", "en": "" },
      "gunler": [1],
      "saat": { "tip": "vakit", "vakit": "Isha", "fark": 30, "sure": 60 },
      "yer": "Ana salon",
      "hoca": "",
      "gecerliBaslangic": null,
      "gecerliBitis": null,
      "aktif": true
    }
  ]
}
```

### Kurallar

- **Gruplar** (sabit liste, S4): `herkes`, `erkekler`, `hanimlar`, `genclik`, `cocuklar`. Tasarımda Faaliyetler filtresinde "Genel" yazıyor; her yerde "Herkes" kullan.
- **Metinler ve diller:**
  - Metinler düz yazıdır, asla HTML olarak gösterilmez (`textContent`).
  - En az bir dilde başlık zorunlu.
  - Gösterilecek dil sırası: ziyaretçinin dili → `tr` → dolu olan ilk dil.
- **Uzunluk sınırları:** başlık 100, açıklama 2000, yer 120, hoca 80 karakter. `link` sadece `https://`.
- **Saatler:** Amsterdam yerel saati, ofsetsiz (`YYYY-MM-DDTHH:mm`).
- **Günler:** ISO numaraları, 1 = Pazartesi.
- **`saat` alanı:**
  - `{ "tip": "sabit", "baslangic": "17:00", "bitis": "19:00" }`
  - veya `{ "tip": "vakit", "vakit": "Fajr|Dhuhr|Asr|Maghrib|Isha", "fark": dakika, "sure": dakika }`.
  - `fark` 0 ise "Öğle vaktinde (≈ 13:30)", 0'dan büyükse "Yatsı sonrası (≈ 20:39)" yazılır.
  - Vakte bağlı saat her gün `/api/vakit` verisinden hesaplanır, mevsime göre kayar.
  - Verinin olmadığı ileri haftalarda sadece "Yatsı sonrası" yazılır, saat yazılmaz.
- **Görünürlük:**
  - Geçmiş faaliyetler (`bitis`, yoksa `baslangic` + 6 saat geçmişse) uygulamada gösterilmez.
  - `yayinda: false` olanlar taslaktır.
- **Doğrulama:** aynı doğrulama dosyası (`veri/dogrula.js`, düz ES modülü) hem `api/admin/kaydet.js`'te hem de testlerde kullanılır.

## 5. Yönetim paneli: `https://nizam-camii.vercel.app/admin`

### Giriş ve koruma

- Login ekranı yok (kullanıcının isteği).
- **Koruma (S3, varsayılan): "gizli anahtarlı link".**
  - Vercel'de `ADMIN_ANAHTAR` tanımlanır: en az 32 rastgele karakter.
  - Her yönetici cihazında bir kez `https://nizam-camii.vercel.app/admin#anahtar=…` açar.
  - Anahtar tarayıcıda saklanır (localStorage) ve adres çubuğundan silinir. Sonraki girişlerde hiçbir şey sorulmaz.
  - Sunucu her kaydetmede anahtarı kontrol eder: `Authorization: Bearer …`, sabit süreli karşılaştırma.
  - Anahtarı olmayan `/admin`'i görebilir ama kaydedemez ("Bu cihaz yetkili değil").
  - Telefon kaybolursa: Vercel'de anahtar değiştirilir, yöneticiler yeni linki açar.
- **Kullanıcı yine de tamamen açık isterse:** anahtar kontrolü kaldırılır.
  - Önce riski açıkça söyle: linki bulan herkes faaliyetleri silebilir veya değiştirebilir.
  - Onayını al.

### Arayüz

- **Sayfa:**
  - Arayüz Türkçe (yöneticiler Türk). İsterse NL düğmesi eklenebilir.
  - `<meta name="robots" content="noindex">`.
- **Faaliyetler sekmesi:**
  - Liste: yaklaşanlar tarih sırasıyla, geçmişler kapalı bir bölümde.
  - Her satırda başlık, tarih, grup, yayında/taslak, öne çıkan yıldızı.
  - Düğmeler: düzenle, kopyala (tekrarlayan faaliyetler için), sil.
  - Silme onayı sayfa içinde olur, `confirm()` kullanılmaz.
- **Faaliyet formu:**
  - Başlık ve açıklama dil sekmeleriyle: TR | NL | EN.
  - Grup, tarih, başlangıç/bitiş saati veya "tüm gün", yer, resim, link, öne çıkan, yayında.
  - Sağda uygulamadaki kartın canlı önizlemesi.
- **Programlar sekmesi:**
  - Üstte `Tablet-Programlar.dc.html`'deki haftalık tablonun küçük hali; bloğa tıklayınca form açılır.
  - Form: başlık/açıklama (TR|NL|EN), grup, günler (7 anahtar), saat ("sabit saat" veya "vakte bağlı": vakit + "vaktinde" / "X dk sonra"), süre, yer, hoca (isteğe bağlı), geçerlilik tarihleri, aktif.
  - Altta yardımcı satır: "Sonraki: Salı 27 Ekim ≈ 20:39".

### Kaydetme (S2, varsayılan: veritabanı yok, veri GitHub deposunda)

- **Okuma:** `api/admin/veri.js` güncel `veri/icerik.json`'ı ve `sha`'sını GitHub API'sinden okur. Böylece yayını beklemeden son hali görülür.
- **Yazma:** `api/admin/kaydet.js` şu sırayla çalışır:
  1. Anahtarı kontrol eder.
  2. İçeriği doğrular.
  3. GitHub Contents API ile (`PUT …/contents/veri/icerik.json`, `sha` ile) commit eder.
  - Commit mesajı örneği: "admin: faaliyetler güncellendi (24.10.2026 18:05)".
- **Yayın:** Vercel commit'i görür ve kendiliğinden yayınlar (~30–60 sn).
  - Panelde şu mesaj çıkar: "Kaydedildi. Yaklaşık 1 dakika içinde uygulamada görünür."
  - Yeni yayın CDN'deki eski `veri/icerik.json`'ı geçersiz kılar.
- **Çakışma:** `sha` farklıysa "Başka biri değiştirdi, sayfayı yenileyin" gösterilir. Veri kaybolmaz.
- **Resim:**
  - Tarayıcı resmi JPEG'e çevirir: en fazla 1600 px, ~400 KB, EXIF yok (konum bilgisi gitmesin).
  - `api/admin/resim.js` resmi `veri/resimler/<id>.jpg` olarak commit eder.
  - Faaliyet silinince resmi de silinir.
- **Ortam değişkenleri:**
  - `GITHUB_TOKEN`: fine-grained token; sadece bu depo, izin "Contents: Read and write".
  - `GITHUB_REPO=ServixSupport/nizam-camii`, `GITHUB_BRANCH=main`.
- **Not:** her kayıt bir Vercel deploy'u demek. Hobby planında günde 100 deploy sınırı var; bu iş için fazlasıyla yeter.

**Alternatif (S2): Vercel Blob.** Kayıt anında görünür ve GitHub token gerekmez. Ama Vercel'de bir depo eklenir; kullanıcı
"ayrı veritabanı olmasın" dedi, bu yüzden varsayılan GitHub. Blob seçilirse CDN cache süresine dikkat
(`cacheControlMaxAge` küçük olsun).

## 6. Uygulama ekranları (davranış)

### Veri ve saat

- Vakitler `/api/vakit`'ten gelir (parametresiz). İçerik `/veri/icerik.json`'dan, `cache: 'no-cache'` ile.
- Son başarılı cevaplar cihazda saklanır, böylece uygulama internetsiz de açılır (~1 ay vakit).
- Saatler her zaman **Europe/Amsterdam** saatine göre hesaplanır (`Intl`), telefonun saat dilimine göre değil.
- Cihazın saat dilimi farklıysa küçük bir "Amsterdam saati" satırı gösterilir.
- TV ise cihaz saatini kullanıyor; TV'ye dokunma.

### Sekmeler

- **Ana ekran:**
  - Kemer, geri sayım ve 7 vakit: İmsak, Sabah, Güneş, Öğle, İkindi, Akşam, Yatsı. Sabah kuralı TV'deki gibi.
  - Geçmiş vakitler soluk, şimdiki turkuaz "ŞİMDİ", sıradaki mercan.
  - Hicri tarih TV'deki gibi gösterilir.
  - Vakitlerin yanındaki zil düğmeleri ancak Faz D'de gelir.
  - Tablet yatayda ayrıca "Bugün camide" ve "Sıradaki faaliyet" kartları.
- **Faaliyetler:**
  - Grup filtreleri, en yakın öne çıkan faaliyet büyük lacivert kartta, altında liste.
  - Detay sayfası: resim, açıklama, yer (harita linki), "Takvime ekle" (`.ics` dosyasını tarayıcı kendisi üretir), link.
  - Hiç faaliyet yoksa boş ekran mesajı.
- **Programlar:**
  - Telefonda gün seçici ve zaman çizelgesi; bugün seçili gelir.
  - Tablet dikeyde haftalık tablo: bugünün namaz vakitleri kesik çizgi, "şimdi" mercan çizgi.
  - Hafta ileri/geri gidilebilir; geçerlilik tarihlerine uyulur.
- **Ayarlar:**
  - Dil (TR/NL/EN) ve tema.
  - Bildirimler (Faz D'ye kadar gizli).
  - Cami kartı: ad, "Ookmeerweg 206, Amsterdam" ve harita linki, "Vakitler: Diyanet İşleri Başkanlığı".
  - Yükleme kartı (Faz C), "Bu cihazda TV ekranını aç".

## 7. PWA (Faz C)

- **Manifest:** `/mobil/manifest.webmanifest`.
  - `name`: "Nizam-ı Alem Süleymaniye Camii"; `short_name`: "Nizam Camii".
  - `start_url` ve `scope`: `/mobil/`; `display: standalone`; renkler token'lardan.
- **İkonlar:** 192, 512, maskable (kenar boşluklu) ve `apple-touch-icon`, hepsi logodan.
- **Service worker:** `/mobil/sw.js`, elle yazılmış ve küçük.
  - Uygulama dosyaları önce cache'ten.
  - `/api/vakit` ve `/veri/icerik.json` önce ağdan, olmazsa cache'ten.
  - TV sayfası (`/`) service worker'a hiç girmez.
  - Yeni sürümde "Yeni sürüm hazır" düğmesi gösterilir; kullanım sırasında kendiliğinden yenileme yapılmaz.
- **iPhone:** bildirimler ancak "Ana Ekrana Ekle" ile yüklendikten sonra çalışır (iOS 16.4+, AB'de de geçerli).
  - Safari'de, yüklenmemişken paylaş ikonuyla kısa bir açıklama gösterilir.
  - Android'de kendi "Yükle" düğmemiz olur (`beforeinstallprompt`).
- **Bitti sayılır:**
  - DevTools → Application → Manifest hatasız.
  - Android ve iPhone'da yüklenebiliyor.
  - İnternet kapalıyken bugünün vakitleri ve geri sayım açılıyor.
  - TV etkilenmiyor.

## 8. Bildirimler (Faz D)

### Neden sunucu lazım?

- Web'de telefon bildirimi kendi planlayamaz. Bildirimi **sunucu** Web Push ile gönderir.
- Bunun için iki şey gerekir:
  1. **Abonelikleri saklayacak küçük bir yer (S6).**
     - GitHub deposu olmaz: depo public, abonelik adresleri gizli kalmalı.
     - Seçenekler: Upstash Redis (Vercel Marketplace, ücretsiz katman, AB bölgesi seçilebilir) veya Vercel Blob. Blob seçilirse dosyaların herkese açık olmadığını doğrula.
     - Kullanıcıya bunun ayrı bir depo olduğunu açıkça söyle ve seçtir.
  2. **Her dakika çalışan bir tetikleyici.**
     - Vercel Hobby cron günde sadece bir kez çalışır.
     - Seçenekler: cron-job.org (ücretsiz, dakikalık) veya Upstash QStash. Güncel ücretsiz limitleri kontrol et.
     - Tetikleyici `POST /api/bildirim/gonder`'i `Authorization: Bearer <CRON_SECRET>` ile çağırır.

### Çalışma

- **Ayarlar (cihaz başına):** hangi vakitler, "X dakika önce" (Kapalı/5/10/15/30) ve "vakit girince" (`Mobil-Ayarlar.dc.html`).
- **İzin:** sadece düğmeye dokununca istenir, sayfa açılınca asla.
- **Abonelik:** `POST/DELETE /api/bildirim/abone` ile kaydedilir veya silinir.
  - Değiştirmek için `endpoint` + `auth` ile sahiplik kanıtlanır.
  - İsim, hesap veya IP saklanmaz.
  - 404/410 veren abonelikler hemen silinir.
- **Gönderim:** `web-push` kütüphanesi, VAPID ile.
  - Her dakika Amsterdam saatine göre o dakikada düşen bildirimler gönderilir.
  - Kayıt (abonelik + tarih + vakit + tür) tutulur; aynı bildirim iki kez gitmez.
  - TTL ~10 dk, `urgency: high`.
- **Metinler:** kullanıcının dilinde, ör. "Akşam vakti girdi · 18:34", "Akşam namazına 15 dakika".
  - Ses: sistem sesi. Özel ezan sesi sadece mağaza uygulamasında mümkün (sonra Capacitor).
- **Gizlilik:** sitede kısa bir gizlilik notu (ne saklanıyor, nasıl iptal edilir). Kullanıcı kontrol etsin.
- **Bitti sayılır:**
  - Android Chrome'da ve yüklü iPhone uygulamasında ±1 dk içinde bildirim geliyor.
  - İptal çalışıyor; çift bildirim yok.
  - Zaman penceresi ve yaz saati için birim testleri var.

## 9. Fazlar (her fazdan sonra dur, onay al)

- **Faz 0 — Hazırlık.**
  - Klasörü GitHub ile eşitle (S1). Önce sor; eski dosyaları `_eski-temmuz/` içine taşı.
  - Git'i bağla. `.vercelignore` ve `tests/` (Playwright) kur.
  - **Mevcut TV'nin temel testleri:** sahte saatle belirli anlarda ekran görüntüleri ve davranış testleri.
    - Normal vakit, namaz öncesi hazırlık sayacı, ezan anı, ayet/hadis/dua paneli, cuma hutbesi, temalar.
    - Sonraki fazlarda TV'nin değişmediği bununla kanıtlanır.
- **Faz A — Tek link + uygulama iskeleti + Ana ekran.**
  - Yönlendirme betiği (§1).
  - `/mobil/` dört sekmeyle, TR/NL/EN, tema, gerçek vakitlerle Ana ekran ve Ayarlar.
  - Faaliyetler ve Programlar boş `veri/icerik.json` ile "henüz yok" ekranı gösterir.
  - *Bitti sayılır:*
    - §1 tablosu ve Faz 0 TV testleri yeşil.
    - 390×844, 820×1180 ve 1180×820'de ekran görüntüleri (gündüz/gece, TR/NL).
    - Yatay kaydırma yok.
    - Uygulama ve TV aynı an için aynı saatleri gösteriyor.
- **Faz B — `/admin` + kaydetme + uygulamada gerçek veri.**
  - *Bitti sayılır:* ekle/değiştir/sil/taslak testleri (GitHub API mock'lanır).
  - Anahtarsız kaydetme reddediliyor. Panel ve uygulamanın ekran görüntüleri var.
- **Faz C — PWA** (§7).
- **Faz D — Bildirimler** (§8). S6 cevaplanmadan başlama.

## 10. Açık sorular (ilgili fazdan önce kullanıcıya sor)

- **S1 (Faz 0):** Bundan sonra yükleme nasıl olsun?
  - Claude Code `git push` yapar (bilgisayarda GitHub girişi gerekir; gerekirse kurulumu adım adım anlat).
  - Ya da kullanıcı eskisi gibi GitHub sitesinden dosya yükler.
  - **Cevap (24-10-2026):** Claude push yapar. Önce ayrı dal + Vercel Preview, onaydan sonra `main`.
- **S2 (Faz B):** İçerik nerede dursun?
  - GitHub deposunda JSON (veritabanı yok, kayıttan ~1 dk sonra görünür; varsayılan).
  - Ya da Vercel Blob (anında görünür).
  - **Ölçüldü (24-10-2026):** her deploy `/api/vakit`'in CDN cache'ini siler.
    - Deploy'dan önce `X-Vercel-Cache: HIT` (6 saatlik), hemen sonra `MISS`.
    - Yani GitHub seçeneğinde her kayıt = yeni deploy = yeni Diyanet isteği (limit 5).
    - Hata cevabı da 24 saat cache'lenir; TV o zaman localStorage'daki veriyle devam eder.
    - Bunu S2'yi sorarken kullanıcıya açıkça söyle.
- **S3 (Faz B):** `/admin` koruması: gizli anahtarlı link (varsayılan) mı, tamamen açık mı? Tamamen açığın riskini söyle.
- **S4:** Gruplar listesi (Herkes/Erkekler/Hanımlar/Gençlik/Çocuklar) uygun mu?
- **S5 (Faz A):** Hollandaca ve İngilizce namaz isimleri.
  - Türkçe isimler mi kalsın (İmsak, Sabah …)?
  - Çeviri mi (Ochtend, Middag … / Morning, Noon …)?
  - Yoksa Arapça-Latin mi (Fadjr, Dhoehr …)?
  - Tasarımda Arapça-Latin örnek kullanıldı. Cemaatten birine kontrol ettirsin.
  - **Cevap (24-10-2026):** Arapça-Latin. NL: Imsak, Fadjr, Zonsopgang, Dhoehr, Asr, Maghrib, Isja. EN: Imsak, Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha.
  - Ayrıca: uygulama ilk açılışta herkes için Hollandaca başlar (Ayarlar'dan değişir).
- **S6 (Faz D):** Abonelik deposu (Upstash Redis veya Vercel Blob) ve dakikalık tetikleyici (cron-job.org veya QStash).
- **Ayrıca:** depo public. Vercel Hobby private depoyla da çalışır; private yapmayı önerebilirsin. Kararı kullanıcı verir.

## 11. Testler (Faz 0 testlerine ek)

- **Mantık testleri:**
  - User-agent'a göre yönlendirme.
  - Programın saati: sabit, vakte bağlı + fark, geçerlilik tarihleri.
  - Yaz saati: 25-10-2026 ve 28-03-2027.
  - Faaliyet görünürlük penceresi, dil seçimi, `veri/dogrula.js`.
- **Playwright:**
  - §1 tablosu.
  - Uygulama ekranları üç boyutta, sahte saatle.
  - TV ve uygulama aynı an için aynı vakitleri gösteriyor (aynı mock `/api/vakit`).
  - Admin akışı (GitHub mock).
  - İnternetsiz açılış (Faz C).
- **Yerelde çalıştırma:** statik sunucu + Playwright'ta API mock'ları. `vercel dev` isteğe bağlı.

## 12. Kullanıcının yapacakları (zamanı gelince adım adım anlat)

1. **Faz B (GitHub):**
   - GitHub'da fine-grained token oluştur: sadece `nizam-camii` deposu, "Contents: Read and write", 1 yıl.
   - Token dolmadan önce yenilenmeli; kullanıcıya hatırlat.
2. **Faz B (Vercel):**
   - Vercel → Project → Settings → Environment Variables: `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`, `ADMIN_ANAHTAR`.
   - Sonra Redeploy.
   - Yöneticilere `/admin#anahtar=…` linkini güvenli bir yoldan ilet (WhatsApp grubuna açık atma).
3. **Faz D:**
   - VAPID anahtarları: kullanıcı `npx web-push generate-vapid-keys` komutunu kendisi çalıştırır ve sonucu Vercel'e girer: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:…`.
   - `CRON_SECRET` Vercel'e ve tetikleyiciye girilir.
   - Seçilen depo bağlanır.
4. **Son test:** kendi iPhone'unda ve Android'inde yükleme ve bildirim testi.
