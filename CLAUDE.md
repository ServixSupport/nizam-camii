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
| `package.json` | `"type": "module"`; bağımlılıklar `unpdf`, `@vercel/blob`. |
| `mobil/` | Telefon/tablet uygulaması (Faz A). `zaman.js` saf vakit mantığı (Amsterdam saati), `metin.js` TR/NL/EN, `app.js`, `app.css`, `fonts/` (OFL). |
| `api/icerik.js` | Uygulama için içerik (yayındaki faaliyetler, aktif programlar); Vercel Blob'dan, CDN'de 2 dk. |
| `api/admin/` | `veri.js` (okuma + etag), `kaydet.js` (anahtar + doğrulama + etag ile yazma), `resim.js` (JPEG yükleme). |
| `api/_lib/` | Blob deposu (`depo.js`, ortam başına klasör) ve anahtar kontrolü. `_` ile başladığı için fonksiyon olmaz. |
| `admin/` | `/admin` yönetim paneli (Türkçe). |
| `mobil/sw.js`, `manifest.webmanifest`, `ikon-*.png` | PWA (Faz C). Uygulama dosyası değişince: `cd tests && node araclar/sw-surum.mjs` (yoksa telefonlar eski sürümde kalır; test yakalar). |
| `veri/dogrula.js` | İçerik doğrulama: API, panel ve testler aynı dosyayı kullanır. |
| `api/bildirim/` | Faz D bildirimleri: `anahtar.js` (hazır mı + açık VAPID anahtarı), `abone.js` (kaydet/sil), `planla.js` (günlük cron), `gonder.js` (QStash çağırır), `deneme.js` (Ayarlar'daki "Deneme bildirimi": 1 dk sonra aynı yoldan). Mantık `api/_lib/bildirim.js`, servisler `api/_lib/bildirim-servis.js`. |
| `mobil/tema-onizleme.js` | Ayarlar'da tema seçimi: tam ekran canlı önizleme (09-11-2026). Her tema uygulamanın kendisi olarak iframe'de (`?onizleme=cini\|gok\|liste\|zumrut`; `yerel.js` `onizleme`): sağa sola kaydırılır, sadece "Bu temayı seç" kaydeder. iframe ağa gitmez, ayar yazmaz, telefon eklentisine dokunmaz. Android geri tuşu önizlemeyi kapatır (`CamiPlugin.geriYakala`, `camiGeri` olayı). |
| `mobil/bildirim.js` | Uygulamada bildirim ayarları ve ana ekrandaki ziller. İzin sadece dokununca istenir. "Ses" açılır listesi (telefonun sesi, Ezan 1 … 7; 08-11-2026; satır seçer, ▶ seçmeden dinletir, 09-11-2026) sadece Android mağaza uygulamasında. Vakitten önce (`onceVakitler`) ve vakit girince (`vakitler`) ayrı vakit seçimi. |
| `mobil/yerel.js`, `yerel-plan.js`, `yerel-ayar.js` | Mağaza uygulaması köprüsü: telefona verilen plan (vakitler, bildirimler, sessiz dönemler) ve Ayarlar'daki "Durum çubuğu", "Sessize alma", "Kilit ekranı". Tarayıcıda hiçbir şey yapmaz. Bildirim metinleri `mobil/bildirim-metin.js` (sunucu da kullanır). |
| `app/` | Mağaza uygulaması (Capacitor 8; Android + iOS). Ayrıntı: `app/README.md`, mağaza metinleri: `app/MAGAZA.md`. Vercel'e yüklenmez. |
| `gizlilik/index.html` | Gizlilik sayfası (NL/TR/EN); mağazalar ister, uygulamada bağlantısı var. |
| `.github/workflows/` | `app.yml` (her değişiklikte Android APK + iOS simülatör derlemesi), `app-ios-testflight.yml` (elle; App Store Connect'e yükleme). |
| `vercel.json` | Header'lar (`/admin` noindex, `sw.js` no-cache) ve günlük cron (`/api/bildirim/planla`, Hobby: günde bir). |

**Klasör = git deposu (24-10-2026'dan beri).** GitHub `main` ile eşitlendi.
- Temmuz'dan kalan eski dosyalar `_eski-temmuz/` içinde; git'e ve Vercel'e girmez.
- `core.autocrlf=false`: dosyalar GitHub'dakiyle bayt bayt aynı kalır (`index.html` 359.624 bayt).
- Renk temaları (Yeşil, Turkuaz, Bordo) kullanıcı isteğiyle kaldırıldı (06-11-2026). Alt sistem çubuğu artık temaya göre (önceden hep lacivert).
- Uygulamada dört **sabit** tema (kullanıcı isteği, 20-11-2026): açık/koyu seçimi yok, `data-tema` hep `gunduz`, eski `nzm.tema` etkisiz. Ayarlarda ve önizlemede sırayla **Tema 1–4** (NL Thema, EN Theme):
  - Tema 1 = `cini` (fotoğraflı, varsayılan), Tema 2 = `gok` (güneş yayı), Tema 3 = `liste` (yeşil desenli), Tema 4 = `zumrut` (koyu).
  - **Dikkat:** aşağıdaki eski notlarda "Tema 1" = `liste`, "Tema 3" = `cini` diye geçer (numaralar 20-11-2026'da değişti). Gece halleri kalktı.
  - Depo: `nzm.stil` `'liste'|'gok'|'zumrut'`; `'klasik'` (eski kemer) → `gok`; yoksa veya `'cini'` → Tema 1. Testlerde `mobilAc` hâlâ `'klasik'` yazar (yani Tema 2); varsayılan için `'nzm.stil': null`.
  - Bütün temalarda üstte küçük logo, cami adı, altında küçük "Amsterdam" (`.ust-alt`), oklu tarih (`gun-gez`).
  - Yeni temalar için tablet/masaüstü tasarımı yapılmaz (kullanıcı isteği, token tasarrufu).
  - Tema 2 (`gok`, `mobil/tema-ciz.js`):
    - Gökyüzü içinde bulunulan vakte göre (`data-gok`: seher, sabah, ogle, ikindi, aksam, gece; `@property --gok1/--gok2`, yumuşak geçiş).
    - Geniş güneş yayı (gündüz yayı + kesik gece yayı): vakitlerin noktaları, güneş ya da ay. Yayda ad ve saat yok (kullanıcı isteği).
    - Yayın içinde sıradaki vakte kalan süre ve vaktin saati; kerahat ufuk çizgisinin altında (kullanıcı isteği, 20-11-2026). Altında tarih (diğer temalardaki gibi), yarı saydam vakit kartları (sıradaki altın).
  - Tema 4 (`zumrut`): "Şimdi" kartı (vakit + saat), kalan süre halkası, altında kerahat kutusu (`.t4-kerahat`; zaman çizgisi kullanıcı isteğiyle kalktı), tarih kartı, simge kutulu vakit kartları; sıradaki turkuaz çerçeveli ve "Sıradaki" rozetli (`--t4Sonraki`). Kuran hatırlatması yok.
  - Tema 3 (`liste`, 20-11-2026): ters çevrildi: bütün zemin yeşil desenli, sayaç beyaz kartta (yeşil rakam), vakitler beyaz kutularda; sıradaki koyu yeşil, şimdiki altın çizgi. Kısa telefonda (360 × 640) kart küçülür.
  - Tema 1 (`cini`, 20-11-2026): fotoğrafın üstünde kapsülde logo + ad + Amsterdam, "Vaktin çıkmasına", düz büyük sayaç (karo yok), sıradaki vakit + turuncu saat, kerahat. Fotoğraf tarihin hemen üstünde biter; fotoğraf–tarih ve tarih–liste arası eşit (6 px).
  - Tema 1 (`nzm.stil=liste`, `html[data-stil="liste"]`; eski "Liste"nin yerine): kullanıcının örnek resmine göre; logonun renkleri. Telefonda logo 34 px (08-11-2026; önce 52, sonra 40).
    - 11-11-2026'dan beri fotoğraf yok (kullanıcı isteği): üstte yeşil desenli bant (`--bant` #1F4D2B, `--desen`: kemerli temadaki yıldız deseni, altın çizgi). Bandın yüksekliği JS'ten `--bant-yuk` (yaprağın köşelerine kadar); tarayıcı çubuğu `--ustZemin` (bandın rengi). Yatay tablette solda tam boy yeşil panel.
    - Bandın üstünde: logo + ad; ortada Tema 3'teki gibi büyük harfle "VAKTİN ÇIKMASINA" (beyaz), kalan süre sade büyük sarı rakamlarla (`.sayac`; karo yok, kullanıcı isteği 11-11-2026: Tema 3'e benzemesin), kerahat koyu kapsülde (sarı). Vakit adı ve Arapça adı gösterilmez.
    - Tarih Tema 3'teki yerde: bandın altında, yaprağın üstünde, oklu (`gun-gez`; başka günlerin vakitleri). Arkasında H/AH yok.
    - Sayaç (`zaman.js` `vakitSonu`, kullanıcı isteği):
      - İmsak → Sabah namazı (listedeki Sabah satırı, Güneş − 60): "Sabah namazına".
      - Sabah namazından sonra Güneş'e kadar: "Vaktin çıkmasına".
      - Güneş → Öğle: "Öğle namazına".
      - Diğer vakitlerde vaktin bitişine "Vaktin çıkmasına"; Yatsı ertesi İmsak'ta çıkar.
      - NL/EN: "Fadjr begint over", "Gebedstijd eindigt over"; "Dhuhr begins in", "Prayer time ends in".
      - Kemerli temanın (Tema 2) sayacı değişmedi (sıradaki vakte).
    - Altta yaprak: telefonda kenardan kenara, üst köşeler yuvarlak, alt düz (zeminle ve menüyle birleşir); üstte tarih, altında İmsak ve Güneş dahil 7 vakit (büyük adlar).
    - Menü: seçili sekmenin simgesi Tema 3'teki gibi kapsülde, bandın renginde (gündüz yeşil, gece kırmızı; tablette seçili sekme o renkte; kullanıcı isteği 11-11-2026).
    - Gece hali: zemin #1F1F1F (kullanıcının verdiği renk, 11-11-2026: "çok siyah"), kart #2A2A2A, bant logonun kırmızısı (#D13027, kullanıcı isteği 11-11-2026) ve desenli, saat beyaz (kırmızıda sarı okunmaz), altın vurgu.
    - Kerahat (bütün temalarda): İkindi vaktinde ve güneş doğduktan sonra 45 dk (kullanıcı isteği 20-11-2026: o sürede sadece "Kerahat vakti"; Sabah vaktinde geri sayım yok). İkindi girince kerahate kalan süre, kerahat girince sadece "Kerahat vakti" (`zaman.js` `kerahatDurumu`, `KERAHAT_DK = 45`). Süreyi hoca onaylamalı; öğle öncesi (istiva) yok. Telefonda yazı satırları arası 12 px (08-11-2026).
  - Geçmiş vakitler hiçbir temada soluk/gri değil.
  - Tema 3 (kullanıcının örnek resmine göre, 09-11-2026; `nzm.stil=cini`, `html[data-stil="cini"]`): koyu hali lacivert, açık hali kullanıcı isteğiyle eklendi (09-11-2026; açık gri-mavi zemin, beyaz satırlar). Seçim diğer temalardaki gibi; Otomatik'te gündüz açık, akşam koyu. Fotoğraf iki halde de aynı gece çekimi, üstündeki yazılar beyaz. Üstte caminin fotoğrafı, tarih de fotoğrafın üstünde (kullanıcı isteği, 11-11-2026: zemine karışan "beyaz sis" olmasın); fotoğraf tarihin altında biter, altı koyulaşır, alt köşeleri yuvarlak; tarih sarı (#F7B04A), Hicri beyaz; yatay tablette tarih sağ sütunda (vurgu renginde); üstünde sadece logo (cami adı gizli, başlık ekran okuyucu için kalır; 11-11-2026), sıradaki namaza kalan süre (`kalan-etiket`, buzlu karolarda `sayac-karo`), kerahat (Tema 1'deki kural). Altında oklu tarih (`gun-gez`: başka günlerin vakitleri, eldeki veri kadar; sayaç hep bugünün; sekme değişince ve yeni günde bugüne döner), vakit satırları (sıradaki turuncu, şimdiki solda çizgi). Menü çubuğu temaya özel (seçili simge turuncu kapsülde; tablette seçili sekme turuncu). Telefonda yükseklikler CSS'te (`--ekran`, satır en çok 60 px, artan yer fotoğrafa).
- Öne çıkan faaliyet resimliyse (kullanıcı isteği, 19-11-2026): tarih | ad ve saat | resim sağda (telefonda 92 px, kesilmeden), düğmeler altta (CSS grid).
- Programlar sekmesi (kullanıcı isteği, 19-11-2026): Faaliyetler gibi alt alta liste, gün seçici ve tablette haftalık tablo yok.
  - Her program bir kez; sıradaki oturumuna göre sıralı (bugünkü bittiyse sonraki gün; `ekranlar.js` `sonrakiOturum`).
  - Kemerde o günün tarihi. Altında günler ("Her Pazartesi", "Pzt – Per", "Çar, Cmt"; `gunlerYazisi`), saat, yer, hoca, açıklama, grup. Detay sayfası yok.
- **Namaz vakti bildirimleri ayrı sayfada** (`#bildirimler`, kullanıcı isteği 19-11-2026; örnek: başka bir uygulamanın ayarları). Ayarlar'da sadece o sayfaya giden satır ("Açık · 5 vakit").
  - Sayfada: ana anahtar; "Vakit girince" (7 vakit, her biri anahtar + Android'de "Sesi değiştir" ve seçili ses); "Vakitten önce hatırlat" (7 vakit, anahtar + kaç dakika: 5/10/15/30, `onceDk`); deneme.
  - `giris` artık hep `true` (vakitler boşsa vakit girince bildirim yok). Eski kayıtta `giris: false` → vakitler boş, `once: 0` → önce listesi boş.
  - Sunucu (Web Push) de `onceDk`'yı saklar ve kullanır (`api/_lib/bildirim.js`); yoksa tek `once`.
  - Önceden hatırlatma hep telefonun sesiyle (ezan sadece vakit girince).
- Uygulamanın Ayarlar sayfası gruplu (kullanıcı isteği, 08-11-2026; Android ayar kılavuzu ve Muslim Pro'ya bakıldı): Dil → Tema ve görünüm → Bildirimler ve ses (ana anahtar; "Vakit girince" kartı: anahtar, ses, vakitler; "Vakitten önce" kartı: dakika, vakitler; deneme; panel; sessize alma) → Cami. Kapalı kartın ayrıntıları görünmez. Sunucuda da `onceVakitler` var (eski kayıtlarda `vakitler` geçerli).
  - Açıklama yazıları görünmez (kullanıcı isteği, 11-11-2026): ayarın adının arkasında yuvarlak "?" düğmesi (`.ipucu`, `aria-controls` → `.ipucu-not`); dokununca açıklama ayarın altında açılır, tekrar dokununca veya Esc ile kapanır. Durum yazıları (izin, "Son: …") görünür kalır.
- Uygulama ve /admin'in yazı tipleri TV'dekiyle aynı (07-11-2026): Inter (yazı), Oswald (saatler, başlıklar), Amiri (Arapça). `mobil/fonts/`, OFL; Oswald dosyaları TV'nin `index.html`'inde gömülü olanlar.

**Yükleme (S1, 24-10-2026):** `git push` Claude yapar, kullanıcı GitHub sitesinden yüklemez.
- Önce ayrı bir dala push (ör. `faz-a`); Vercel o dal için Preview linki verir.
- Kullanıcı onaylayınca `main`'e alınır ve canlıya çıkar. `main`'e doğrudan push yok.
- `gh` bu bilgisayarda `ServixSupport` hesabıyla giriş yapmış durumda.

**TV'nin localStorage anahtarları:** `vakitler`, `nizam-icerik` (krem temanın /admin kutuları için son içerik), `nizam-tema` (`dark|light|krem`, varsayılan krem; eski `green` ve `auto` = krem), `nizam-sayac`, `nizam-hutbe` (`{gecikme, sure}` dk; varsayılan 10 ve 30), `nizam-dil` (`on|off`, Türkçe ↔ Hollandaca; varsayılan açık).
- Uygulama aynı origin'de çalışır. Bu anahtarları okumaz ve üzerine yazmaz; kendi anahtarlarına önek koyar.

## Kullanıcı hakkında

- Projenin sahibi, caminin gönüllüsü; profesyonel geliştirici değil.
- Türkçe veya Hollandaca yazar; mesajın dilinde cevap ver.
- GitHub/Vercel'de kendisinin yapması gerekenleri adım adım ve kısa anlat.
- Sonuçları ekran görüntüsüyle göster, sadece anlatma.

## Kesin kurallar

1. **TV ekranının davranışı değişmez.** `index.html`'e izinli tek ek, en üste konacak küçük yönlendirme betiği (plan §1).
   - İstisna, kullanıcının açık isteğiyle (04-11-2026): yeşil tema kaldırıldı, yerine **krem tema** (uygulamanın renkleri; düzen ve yazı tipleri aynı). Ayarlara **cuma hutbesi** zamanı eklendi (Öğle + dk, süre). "Gündüz açık · Akşam koyu" (otomatik) kaldırıldı; varsayılan tema krem. Ayarlarda tema açıklamaları yok, önizleme TV'nin gerçek görüntüsü (`tests/araclar/tema-onizleme.mjs`). Namaz adları, tarih ve sayaç yazısı 5 dk'da bir değişir (sadece yazı söner/yanar): Türkçe + Latin harfli Arapça ad (eskisi gibi, FAJR …) ↔ Hollandaca (Ochtend, Middag, Namiddag, Avond, Nacht) + Arapça harfler (الفجر …). Başka TV değişikliği yine sadece kullanıcı açıkça isterse.
   - **Tema adları numaralı** (kullanıcı isteği, 07-11-2026): ayarlarda ve kullanıcıyla konuşurken **Tema 1** = koyu (`dark`), **Tema 2** = açık (`light`), **Tema 3** = krem (`krem`). Yeni tema gelirse Tema 4, Tema 5 … Koddaki adlar (`?theme=`, `nizam-tema`, sınıflar) değişmez.
   - Kullanıcı isteği (07-11-2026): **krem tema (Tema 3) = uygulamanın "Klasik" tasarımı.**
     - Solda: logo ve küçük cami adı (adres yok), küçük tarih, kemer.
     - Kemerin içi: sıradaki vakte geri sayım ve şimdiki saat.
     - Kemerin altında İmsak ve Güneş yan yana, açık temadaki düzenle (güneş simgesi, ad ve Arapça ad, saat; çerçevesiz).
     - Geçmiş vakitler soluk/gri gösterilmez: hepsi aynı renk, sadece sıradaki kırmızı (ve şimdiki vaktin noktası).
     - Sağda en üstten 5 vakit alt alta (Sabah–Yatsı). Biraz boşluktan sonra iki küçük kutu, `/api/icerik`'ten (yani /admin'den) gelir: bugünkü programlar (en fazla 2) ve sıradaki faaliyet.
     - 60 sn sayacı solda, kemerin üstünde açılır; telefon yasağı simgesi yok. Âyet paneli sağdaki alana gelir.
     - Yazı tipleri koyu/açık temalarınki (Oswald, Inter). Yeni elemanlar `.k2-*`, sadece `body.krem`'de görünür.
     - Koyu ve açık temalar değişmedi: referans görüntüleri aynı.
   - Önce mevcut davranışın testlerini yaz (Faz 0), sonra değiştir.
   - Yönlendirme bir TV'yi **asla** mobil sürüme göndermemeli. Şüphede TV.
2. **Diyanet API'si:** limit uç nokta başına 5 istek. TV ve uygulama vakitleri yalnızca `/api/vakit` üzerinden alır.
   - Parametresiz, tam bu URL ile çağır: CDN cache anahtarı aynı kalsın.
   - Diyanet'e asla tarayıcıdan veya ek parametreyle gidilmez. `api/vakit.js` gerekmedikçe değişmez.
   - 25-10-2026'dan beri asıl mod hafızalı (kullanıcı onayıyla).
     - Neden: deploy'lar sınırı aşmıştı.
     - Son iyi 32 günlük liste Blob'da (`ortak/vakit.json`). Tazeyse (< 20 saat) Diyanet'e gidilmez; Diyanet en fazla 4 saatte bir denenir.
     - Önizleme Diyanet'e hiç gitmez. Testler: `tests/sunucu/vakit.spec.js`.
3. **Sırlar** sadece Vercel ortam değişkenlerinde: `DIYANET_EMAIL`, `DIYANET_PASSWORD`, `DIYANET_CITY_ID`, `ADMIN_ANAHTAR`, `BLOB_READ_WRITE_TOKEN` (Blob store bağlanınca otomatik), `CRON_SECRET`, `VAPID_PRIVATE_KEY`, Upstash'inkiler (`KV_REST_API_*`/`UPSTASH_REDIS_REST_*`, `QSTASH_*`; Marketplace bağlanınca otomatik).
   - Abonelikler (push adresleri) sadece Upstash Redis'te; public depoya veya Blob'a konmaz.
   - Play Store yükleme anahtarı depo dışında: `C:\Users\Altun\Documents\Suleymaniye-uygulama-anahtari\` (Gradle `~/.gradle/gradle.properties` → `CAMI_ANAHTAR_*`). Apple anahtarları sadece GitHub Secrets'ta (kullanıcı kendisi girer).
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
7. `.vercelignore` ile `*.md`, `ontwerp/`, `tests/`, `app/` ve eski dosyalar yayınlanmasın.
8. **Faz faz çalış** (plan §9). Her fazın sonunda dur, ekran görüntülerini göster, onay al. Büyük mimari değişiklikleri önce sor.
9. **Mağaza uygulaması** (`app/`, 06-11-2026'dan beri):
   - `mobil/` değişince uygulama kendiliğinden güncellenmez. Yeni sürüm için `app/README.md`: `www.mjs` → `cap sync` → `versionCode`'u artır → derle → mağazaya yükle.
   - Kullanıcı isteği (07-11-2026): **her değişiklikte mağaza uygulamasını hazırlama** (www/cap sync/derleme/emülatör yok). Kullanıcı Preview linkinde (tarayıcı, PWA) test eder; mağaza sürümüne kullanıcı "şimdi" deyince geçilir.
   - Uygulama kimliği `nl.suleymaniyecamii.namaz` değişmez.
   - **Ana ekran widget'ları** (Android, kullanıcı isteği 19-11-2026; `VakitWidget` + `WidgetKucuk/Satir/Orta/Liste`, `res/layout/widget_*.xml`, `res/xml/widget_bilgi_*.xml`):
     - Küçük 2×2 (sıradaki vakit, saat, kalan süre), satır 4×1 (7 vakit, sıradaki kapsülde), orta 4×2 (tarih, hicri, büyük geri sayım, sonraki iki vakit), liste 3×3 (tarih, hicri, 7 vakit, kalan süre).
     - Her widget'ın arka planı (beyaz / siyah / saydam) ve yazı rengi (otomatik, beyaz, siyah, altın, yeşil, kırmızı, mavi) ayrı: `WidgetAyar` (önizleme widget'ın kendisi), `SharedPreferences "widget"`.
     - `configuration_optional`: Android 12+ widget hemen eklenir (siyah), renkler kalemle / uzun basıp. Pixel launcher'ın "Ekle" yolu yapılandırma ekranını açmadı (emülatörde denendi).
     - Veri planın kendisinden (`Planlayici.plan`); widget varken her vakitte alarm (`PlanMantigi.sonrakiAlarm(plan, simdi, widget)`) ve `calistir` widget'ları yeniler. Geri sayım Chronometer.
     - iPhone widget'ları henüz yok (kullanıcı ikisini de istedi; sırada).
   - **Android geri tuşu** (kullanıcı isteği 19-11-2026; `app.js` `geriGuncelle`): faaliyet detayından listeye, diğer sekmelerden ana ekrana, ana ekranda uygulama kapanır. `CamiPlugin.geriYakala` ana ekran dışında açık.
   - Uygulama simgesi (ana ekran, bildirimler, mağaza; kullanıcı isteği 19-11-2026): logodaki gül yerine minarelerin şerefesinden içeri doğru ses dalgaları (ezan minareden gelir; hoparlör ve nokta yok). `app/simge/`, `tests/araclar/app-simge-ezan.mjs` → `app-simgeler.mjs`. Temalardaki logo ve PWA simgeleri gülle kalır.
   - iPhone'da sessize alma ve durum çubuğu simgesi yok (Apple izin vermez); bu ayarlar iPhone'da gizli.
   - **Ezan sesi** (08-11-2026, sadece Android): Ayarlar'da "Ses" açılır listesi: telefonun sesi veya Ezan 1 … 7 (`bildirim-metin.js` `SESLER`, `EZAN_SAYISI`).
     - Dosyalar kullanıcının `Ezan sesleri/` klasöründen `app/android/app/src/main/res/raw/ezan_1.mp3 … ezan_7.mp3` olarak kopyalandı: 1 = Ezan, 2 = Ezan 2, 3 = Ezan 3, 4 = Beautiful Azan, 5 = Duygusal Adhane, 6 = Ezan Salah fajr, 7 = Güzel Ezan Kısa.
     - Kullanıcıya göre kayıtlar serbest lisanslı (09-11-2026): mp3'ler depoda, her derlemede var. Kaynak klasör `Ezan sesleri/` git'e girmez. Bir kayıt APK'da yoksa telefonun sesi çalar (`Planlayici.kanalIcin`).
     - Seçmeden önce dinleme (09-11-2026): `CamiPlugin.sesDinle`/`sesDurdur`. Medya sesiyle çalar (telefon sessizdeyken de duyulur, ses tuşları çalışır). Liste kapanınca, sekme değişince ve uygulama arka plana gidince susar.
     - Her kayıt kendi bildirim kanalında (`vakit_ezan_N`; `res/raw`'daki dosyalar sırayla taranır). Ezan sadece beş vakitte vakit girince; önceden hatırlatma telefonun sesiyle. Tarayıcıda (Web Push) ve iPhone'da yok. Hoca dinlemeli.
     - Aynı vakitte sessize alma da açıksa telefon ezan bitince susar (`yerel-plan.js` `EZAN_SN = 35`; en uzun kayıt 30 sn).
     - Son sessize alma denemesi ve sonucu telefonda saklanır (`Planlayici` `sessizSon`), Ayarlar'da "Son: 8 Kas 06:41 · telefon sessize alındı" (veya "zaten sessizdeydi", "Rahatsız Etmeyin açıktı" …).
     - "Rahatsız Etmeyin" erişimi Titreşim'de de istenir (16-11-2026): kullanıcının Samsung'unda izin yokken titreşime alınamadı ("izinYok"). Titreşim modunda sonuç "titreşime alınamadı" yazılır.
     - **Her namaz ayrı** (kullanıcı isteği, 19-11-2026):
       - Ses: `nzm.bildirim.sesler` `{ Fajr: 'ezan-6', … }`. Ayarlar'da "Hangi vakitler"in altında her seçili namazın kendi satırı ve açılır listesi (▶ dinleme aynı). Deneme bildirimi en son seçilen sesle (`sonSes`).
       - Sessize alma süresi: `nzm.sessiz.dakikalar` `{ Fajr: 30, … }`. Her namaz satırında açık/kapalı düğmesi ve süre seçimi (`<select>`, 15–60 dk).
       - Eski kayıtlardaki tek `ses` / `dakika` bütün namazlara geçer (`yerel-plan.js` `namazSesi`, `sessizSuresi`). Java tarafı değişmedi: plan zaten bildirim ve dönem başına.
     - **Android 17 (Samsung One UI 9): arka plandaki uygulama zil ayarını değiştiremez** ("background audio hardening"; `setRingerMode` sessizce yok sayılır). Kullanıcının Samsung'unda "izinYok" bundandı.
       - Çözüm (kullanıcı onayı, 19-11-2026): sessize alma başlarken ve biterken `SessizServis` (ön plan hizmeti, `specialUse`, birkaç ms; bildirimi ertelendiği için görünmez). `VakitAlici`/`AcilisAlici` → `Planlayici.alarmGeldi`: zil değişecekse (`PlanMantigi.sessizDegisimi`) hizmetle, değilse doğrudan. Hizmet başlatılamazsa doğrudan (Android 16 ve öncesi yine çalışır).
       - Emülatörde (Android 16.1) doğrulandı: "Background started FGS: Allowed" (exact alarm), zil sessize alındı ve eski haline döndü. Logcat `AudioHardening … level: full` = hizmet var ama "while-in-use" yok; bu sadece hedef SDK 37 uygulamaları engeller.
       - **targetSdk 37'ye geçince bu yol kapanır** (hizmetin WIU yetkisi olmalı; arka planda başlatılan hizmette yok). O zaman "Rahatsız Etmeyin" (AutomaticZenRule) ile sessize almaya geçmek gerekir.
       - Play Console'da `specialUse` beyanı gerekir: metin `app/MAGAZA.md` → İzinler.
     - **Üst çubuktaki cami simgesi** (kullanıcı isteği, 19-11-2026): sadece vakte 30 dk kala (kalan dakikayla). Diğer zamanlar panel simgesiz kanalda (`vakitler_sakin`, IMPORTANCE_MIN; bildirim ekranında altta, katlanmış). Vakit girince panel bir kez sesli uyarır, `SES_SURE` (40 sn) sonra sessizce simgesiz kanala geçer (`PlanMantigi.panelKanali`).
   - **Bildirim panelindeki tablo** (08-11-2026, kullanıcının örneğine göre): üst satır, ince çizgi, 7 eşit sütun (ad üstte, saat altta, `sans-serif-condensed`); sıradaki kırmızı ve kalın; sabit yükseklik + autoSize. Soldaki uygulama simgesi Android 12+ sistemin çerçevesi: uygulama küçültemez.
   - Uygulamada (Tema 1) şimdiki vakit "ŞİMDİ" yazısıyla değil, satırın solunda yeşil çizgiyle (yazı ekran okuyucu için kalır); adlar hiç kısalmaz.

## Test

- **Çalıştırma:** `cd tests && npm test`. Ayrıntılar `tests/README.md`'de.
- **Playwright:**
  - Sahte saat: `Date`'i sayfa yüklenmeden ez.
  - `/api/vakit` ve `/api/hutbe` mock'lanır.
  - Normal testler için cuma olmayan bir gün seç; yoksa hutbe çıkar.
- **TV temel testleri (Faz 0):** `tests/tv/`, referans görüntüler `tests/tv/__goruntuler__/`.
  - Her fazda yeşil kalmalı. TV referanslarını sadece kullanıcı açıkça onaylarsa güncelle.
- **Yayındaki adresi test etmek:** `TEST_ADRES=<Preview linki>` ile sadece **Preview** linklerine.
  - Canlı siteye (`nizam-camii.vercel.app`) toplu test koşma.
  - 25-10-2026'da ~150 test Vercel'in bot korumasını tetikledi: bu bağlantıya bir süre `403 Security Checkpoint` döndü.
  - Canlıda sadece birkaç `curl` ve tek bir tarayıcı kontrolü yap.
- **TV test modları korunur:** `?test=ayet|hadis|dua|hazirlik|ezan|hutbe`, `?theme=dark|light|krem` (`green`, `auto` → krem) ve `?dil=tr|nl` (dili sabitler; testler varsayılan `tr`, gerçek davranış için `tvAc(..., { dil: 'oto' })`).
- **Ekran boyutları:**
  - TV: 1920×1080, 1366×768, 960×540
  - Mobil: 390×844, 820×1180, 1180×820
- Test araçları kendi `package.json`'ı ile `tests/` altında durur. Kökteki `package.json`'ı şişirme; onu Vercel yükler.
- **Mağaza uygulaması:**
  - Uygulama tarafı sahte eklentiyle: `tests/mobil/yerel.spec.js`, `tests/mantik/yerel-plan.spec.js`.
  - Android mantığı JUnit ile (`app/android … PlanMantigiTest`).
  - Telefonda deneme Android emülatörüyle (`app/README.md`); iPhone sadece CI'da (simülatör) ve TestFlight'ta.
  - Mağaza görselleri: `MAGAZA=1 npx playwright test --project=magaza`.
