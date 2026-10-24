# CLAUDE.md — Nizam Camii ekran sitesi (nizam-camii.vercel.app)

## Bu proje ne?

- Nizam-ı Alem Süleymaniye Camii'nin (Ookmeerweg 206, Amsterdam) namaz vakti TV ekranı. Canlı adres: https://nizam-camii.vercel.app/
- GitHub deposu: `ServixSupport/nizam-camii` (**public**). `main`'e yapılan her yükleme Vercel'de otomatik yayınlanır.
- Build adımı ve framework yok: statik `index.html` ve `api/` altında Node fonksiyonları var.
- **Bu proje masaüstündeki `namazvakti` platformundan tamamen ayrıdır.** Oradan kod, veritabanı veya hesap kullanma.
- Şimdiki iş: aynı linkte telefon/tablet için mobil uygulama ve `/admin` yönetim paneli.
  - Plan: `MOBIL-APP-PLAN.md`
  - Tasarım: `ontwerp/` (kullanıcı onayladı, 24-10-2026)

## Dosyalar

| Dosya | İçerik |
|---|---|
| `index.html` | TV ekranı; tek dosya (HTML/CSS/JS, logo ve Oswald fontu base64). |
| `api/vakit.js` | Diyanet Awqat Salah istemcisi. Aylık vakitleri çeker; CDN'de 1 gün cache'lenir (`s-maxage=86400`). |
| `api/hutbe.js` | Cuma hutbesi PDF'i (diyanet.nl) → metin. `unpdf` kullanır. |
| `package.json` | `"type": "module"`, tek bağımlılık `unpdf`. |

**Klasör = git deposu (24-10-2026'dan beri).** GitHub `main` ile eşitlendi.
- Temmuz'dan kalan eski dosyalar `_eski-temmuz/` içinde; git'e ve Vercel'e girmez.
- `core.autocrlf=false`: dosyalar GitHub'dakiyle bayt bayt aynı kalır (`index.html` 359.624 bayt).

**Yükleme (S1, 24-10-2026):** `git push` Claude yapar, kullanıcı GitHub sitesinden yüklemez.
- Önce ayrı bir dala push (ör. `faz-a`); Vercel o dal için Preview linki verir.
- Kullanıcı onaylayınca `main`'e alınır ve canlıya çıkar. `main`'e doğrudan push yok.
- `gh` bu bilgisayarda `ServixSupport` hesabıyla giriş yapmış durumda.

**TV'nin localStorage anahtarları:** `vakitler`, `nizam-tema`, `nizam-sayac`.
- Uygulama aynı origin'de çalışır. Bu anahtarları okumaz ve üzerine yazmaz; kendi anahtarlarına önek koyar.

## Kullanıcı hakkında

- Projenin sahibi, caminin gönüllüsü; profesyonel geliştirici değil.
- Türkçe veya Hollandaca yazar; mesajın dilinde cevap ver.
- GitHub/Vercel'de kendisinin yapması gerekenleri adım adım ve kısa anlat.
- Sonuçları ekran görüntüsüyle göster, sadece anlatma.

## Kesin kurallar

1. **TV ekranının davranışı değişmez.** `index.html`'e izinli tek ek, en üste konacak küçük yönlendirme betiği (plan §1).
   - Önce mevcut davranışın testlerini yaz (Faz 0), sonra değiştir.
   - Yönlendirme bir TV'yi **asla** mobil sürüme göndermemeli. Şüphede TV.
2. **Diyanet API'si:** limit uç nokta başına 5 istek. TV ve uygulama vakitleri yalnızca `/api/vakit` üzerinden alır.
   - Parametresiz, tam bu URL ile çağır: CDN cache anahtarı aynı kalsın.
   - Diyanet'e asla tarayıcıdan veya ek parametreyle gidilmez. `api/vakit.js` gerekmedikçe değişmez.
3. **Sırlar** sadece Vercel ortam değişkenlerinde: `DIYANET_EMAIL`, `DIYANET_PASSWORD`, `DIYANET_CITY_ID`, `ADMIN_ANAHTAR`, `GITHUB_TOKEN`, `CRON_SECRET`, `VAPID_PRIVATE_KEY`.
   - Depo public: hiçbir sır, `.env` dosyası veya kişisel veri commit edilmez.
   - Kullanıcıdan şifreyi sohbete yapıştırmasını isteme; Vercel'e kendisi girsin.
4. Masaüstündeki `Diyanet namaz vakitleri api.pdf` kişisel veri içerir. Asla bu klasöre veya depoya girmez.
5. **Dini içerik:** Arapça ayet, hadis veya dua uydurma; kendi çevirini kontrol edilmiş gibi sunma. Metinleri hocaya kontrol ettirmesini hatırlat.
6. **Vakit kuralları** (TV'de test edildi, aynen koru):
   - Sabah = Güneş − 60 dk.
   - Diyanet verisinde `imsak` hem İmsak hem Fajr'dır. Diyanet saatlerine düzeltme uygulanmaz.
   - Aladhan yedeği sadece o gün için Diyanet verisi yoksa kullanılır. Düzeltmeler (İmsak +48, Yatsı −41) sadece Aladhan'a uygulanır.
   - Hicri tarih: Diyanet'in `hijri` alanı (sıfırsız G.A.YYYY, ör. `13.5.1448`) ve `HICRI_AY` listesi.
   - Mantığı `index.html`'den birebir al.
7. `.vercelignore` ile `*.md`, `ontwerp/`, `tests/` ve eski dosyalar yayınlanmasın.
8. **Faz faz çalış** (plan §9). Her fazın sonunda dur, ekran görüntülerini göster, onay al. Büyük mimari değişiklikleri önce sor.

## Test

- **Çalıştırma:** `cd tests && npm test`. Ayrıntılar `tests/README.md`'de.
- **Playwright:**
  - Sahte saat: `Date`'i sayfa yüklenmeden ez.
  - `/api/vakit` ve `/api/hutbe` mock'lanır.
  - Normal testler için cuma olmayan bir gün seç; yoksa hutbe çıkar.
- **TV temel testleri (Faz 0):** `tests/tv/`, referans görüntüler `tests/tv/__goruntuler__/`.
  - Her fazda yeşil kalmalı. TV referanslarını sadece kullanıcı açıkça onaylarsa güncelle.
- **TV test modları korunur:** `?test=ayet|hadis|dua|hazirlik|ezan|hutbe` ve `?theme=dark|light|auto|green`.
- **Ekran boyutları:**
  - TV: 1920×1080, 1366×768, 960×540
  - Mobil: 390×844, 820×1180, 1180×820
- Test araçları kendi `package.json`'ı ile `tests/` altında durur. Kökteki `package.json`'ı şişirme; onu Vercel yükler.
