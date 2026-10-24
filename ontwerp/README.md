# Uygulama tasarımı (telefon + tablet)

Kullanıcı 24-10-2026'da onayladı. `MOBIL-APP-PLAN.md`'ye aittir. Bu klasör yayınlanmaz (`.vercelignore`).

## Biçim

- **Nereden geliyor:** dosyalar claude.ai'deki Design tuvalinden alındı.
- **Yapısı:** her `*.dc.html` bir ekrandır.
  - `<x-dc>` içinde HTML ve inline style'lar var.
  - `{{…}}` betiğin doldurduğu yerlerdir.
  - `<sc-for>` liste, `<sc-if>` koşul anlamına gelir.
  - En alttaki betik (`class Component extends DCLogic`, `renderVals()`) örnek veriyi ve mantığı içerir.
- **Görüntülemek:** tuval dışında doğrudan açılamaz (`support.js` yok). Ölçü, renk, metin ve yerleşim için **kaynak** olarak kullan.
  - Görüntü gerekiyorsa kullanıcıdan tuvalden ekran görüntüsü veya dışa aktarım iste.
- **`canvas.json`:** ekranların tuvaldeki yeri ve boyutu (telefon 390×844, tablet 1180×820 ve 820×1180).
- **Logo:** dosyalardaki `/_blob/1a2a267a69fa9a1be6ef7de516c1d69d` Nizam logosudur, bu klasörde `logo-nizam.png`.

## Ekranlar

| Dosya | Ne |
|---|---|
| `Main.dc.html` | Ana ekran, telefon, gündüz. Tweak `tema` = Gündüz/Gece. |
| `Mobil-Gece-NL.dc.html` | Ana ekran, gece, Hollandaca. Buradaki namaz isimleri (Fadjr …) sadece örnek; karar S5. |
| `Mobil-Faaliyetler.dc.html` | Grup filtreleri, öne çıkan kart, liste. "Genel" yerine "Herkes". |
| `Mobil-Programlar.dc.html` | Gün seçici + günlük zaman çizelgesi. |
| `Mobil-Ayarlar.dc.html` | Dil TR/NL/EN (hepsini değiştirir), bildirimler, tema, cami kartı, yükleme kartı. |
| `Mobil-Bildirim.dc.html` | Bildirimlerin görünüşü (Faz D). |
| `Tablet-Ana-ekran.dc.html` | Tablet yatay: yan menü, geri sayımlı büyük kemer, iki sütunlu vakit ızgarası, kartlar. |
| `Tablet-Programlar.dc.html` | Tablet dikey: 09–22 haftalık tablo, grup filtresi, hafta ileri/geri, namaz çizgileri, "şimdi" çizgisi, "Hatırlat" düğmeli detay kartı. |

## Örnek veriler

- **Vakitler:** 24-10-2026 için hesaplandı, Diyanet Amsterdam'a yakın.
  - İmsak 06:28, Sabah 07:15, Güneş 08:15, Öğle 13:30, İkindi 15:59, Akşam 18:34, Yatsı 20:09.
- **Faaliyetler ve programlar:** uydurma örnekler, caminin gerçek programı değil.
- **Bağlantılar:** dosyalardaki linkler (`Tablet-Programlar.dc.html` gibi) sadece tuvalde ekranlar arasında geçiş içindir.
