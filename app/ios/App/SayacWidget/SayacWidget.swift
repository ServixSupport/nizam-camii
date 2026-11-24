import WidgetKit
import SwiftUI
import AppIntents

// Ana ekran ve kilit ekranı widget'ları (iPhone; Android'deki VakitWidget gibi, 24-11-2026):
//  - "Sıradaki vakit" (SayacWidget): küçük (vakit, saati, kalan süre) ve kilit ekranı (satır, yuvarlak, tek satır)
//  - "Namaz vakitleri" (VakitlerWidget): orta (tarih ve hicri, sıradaki vakit, büyük geri sayım, sonraki iki vakit)
//    ve büyük (tarih ve hicri, 7 vakit alt alta, sıradaki kapsülde, kalan süre)
// Renkler (arka plan, yazı) her widget'ta ayrı: widget'a basılı tutun → "Widget'ı düzenle" (iOS 17+).
// Vakitleri uygulama hesaplar ve ortak depoya yazar (CamiPlugin.widgetVerisi, ~30 gün); widget her vakitte
// kendiliğinden sıradakine geçer, geri sayımı telefon kendisi sayar (uygulamanın açık olması gerekmez).

// MARK: - veri

struct Vakit: Decodable {
    let vakit: String
    let ad: String
    let saat: String
    let an: Double
    var tarih: Date { Date(timeIntervalSince1970: an / 1000) }
}

struct Gun: Decodable {
    let ymd: String
    let hicri: String?
    let vakitler: [Vakit]
}

enum Depo {
    static let grup = "group.nl.suleymaniyecamii.namaz"

    static func oku() -> (gunler: [Gun], kalan: [String: String], dil: String) {
        let d = UserDefaults(suiteName: grup)
        let gunler = d?.data(forKey: "gunler").flatMap { try? JSONDecoder().decode([Gun].self, from: $0) } ?? []
        let kalan = d?.data(forKey: "kalanKisa").flatMap { try? JSONDecoder().decode([String: String].self, from: $0) } ?? [:]
        let dil = d?.string(forKey: "dil") ?? (Locale.current.language.languageCode?.identifier ?? "nl")
        return (gunler, kalan, dil)
    }
}

// MARK: - renk ayarı (widget'ı düzenle)

enum ZeminSecim: String, AppEnum {
    case oto, beyaz, siyah
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Background"
    static var caseDisplayRepresentations: [ZeminSecim: DisplayRepresentation] = [
        .oto: "Automatic", .beyaz: "White", .siyah: "Black"
    ]
}

enum YaziSecim: String, AppEnum {
    case oto, beyaz, siyah, altin, yesil, kirmizi, mavi
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Text color"
    static var caseDisplayRepresentations: [YaziSecim: DisplayRepresentation] = [
        .oto: "Automatic", .beyaz: "White", .siyah: "Black", .altin: "Gold",
        .yesil: "Green", .kirmizi: "Red", .mavi: "Blue"
    ]
}

struct RenkAyari: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Colors"
    static var description = IntentDescription("Background and text color of the widget.")

    @Parameter(title: "Background", default: .oto)
    var zemin: ZeminSecim

    @Parameter(title: "Text color", default: .oto)
    var yazi: YaziSecim
}

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}

/// Android'deki renklerle aynı (VakitWidget): sıradaki vakit beyaz zeminde kırmızı, koyuda altın kapsülde.
struct Renkler {
    let zemin: Color
    let metin: Color
    let ikinci: Color
    let vurgu: Color
    let vurguMetin: Color

    static let sabit: [YaziSecim: UInt32] = [
        .beyaz: 0xFFFFFF, .siyah: 0x1A1A1A, .altin: 0xE0B04A, .yesil: 0x2E8B4A, .kirmizi: 0xD13027, .mavi: 0x2F6FD6
    ]

    init(zemin z: ZeminSecim, yazi y: YaziSecim, koyuSistem: Bool) {
        let acik = z == .beyaz || (z == .oto && !koyuSistem)
        zemin = acik ? .white : (z == .siyah ? .black : Color(hex: 0x1C1C1E))
        metin = y == .oto ? (acik ? Color(hex: 0x14233D) : .white) : Color(hex: Renkler.sabit[y] ?? 0xFFFFFF)
        ikinci = metin.opacity(0.7)
        var v: YaziSecim = acik ? .kirmizi : .altin
        if v == y { v = acik ? .yesil : .kirmizi }
        vurgu = Color(hex: Renkler.sabit[v] ?? 0xD13027)
        vurguMetin = v == .altin ? Color(hex: 0x1A1A1A) : .white
    }
}

// MARK: - zaman çizelgesi

struct Girdi: TimelineEntry {
    let date: Date
    let gun: Gun?            // sıradaki vaktin günü
    let sira: Int            // sıradaki vaktin gündeki yeri
    let sonraki: Vakit?      // sıradaki vakit
    let sonrakiler: [Vakit]  // ondan sonraki iki vakit (ertesi güne geçebilir)
    let kalan: String        // "Öğle'ye" …
    let dil: String
    let zemin: ZeminSecim
    let yazi: YaziSecim
}

enum Cizelge {
    /// Her girdi bir önceki vakitte başlar: vakit girince widget sıradakine geçer.
    static func girdiler(_ a: RenkAyari, simdi: Date) -> [Girdi] {
        let (gunler, kalan, dil) = Depo.oku()
        let hepsi = gunler.flatMap { g in g.vakitler.map { (g, $0) } }
            .sorted { $0.1.an < $1.1.an }
        let sonra = hepsi.filter { $0.1.tarih > simdi }
        var out: [Girdi] = []
        var bas = simdi
        for (i, (gun, v)) in sonra.prefix(60).enumerated() {
            let sira = gun.vakitler.firstIndex { $0.an == v.an } ?? 0
            let iki = sonra.dropFirst(i + 1).prefix(2).map { $0.1 }
            out.append(Girdi(date: bas, gun: gun, sira: sira, sonraki: v, sonrakiler: Array(iki),
                             kalan: kalan[v.vakit] ?? "", dil: dil, zemin: a.zemin, yazi: a.yazi))
            bas = v.tarih
        }
        return out
    }

    static func bos(_ a: RenkAyari) -> Girdi {
        Girdi(date: Date(), gun: nil, sira: 0, sonraki: nil, sonrakiler: [], kalan: "", dil: Depo.oku().dil, zemin: a.zemin, yazi: a.yazi)
    }

    /// Widget galerisi ve yer tutucu için örnek gün
    static func ornek(_ a: RenkAyari) -> Girdi {
        let simdi = Date()
        let adlar = ["İmsak", "Güneş", "Sabah", "Öğle", "İkindi", "Akşam", "Yatsı"]
        let anahtar = ["Imsak", "Sunrise", "Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]
        let farklar: [Double] = [-7, -5.5, -6.5, -1, 1.25, 3.5, 5]
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        let vakitler = (0..<7).map { i -> Vakit in
            let t = simdi.addingTimeInterval(farklar[i] * 3600)
            return Vakit(vakit: anahtar[i], ad: adlar[i], saat: f.string(from: t), an: t.timeIntervalSince1970 * 1000)
        }
        let y = DateFormatter()
        y.dateFormat = "yyyy-MM-dd"
        let gun = Gun(ymd: y.string(from: simdi), hicri: "", vakitler: vakitler)
        return Girdi(date: simdi, gun: gun, sira: 4, sonraki: vakitler[4], sonrakiler: [vakitler[5], vakitler[6]],
                     kalan: "", dil: "tr", zemin: a.zemin, yazi: a.yazi)
    }
}

struct Saglayici: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> Girdi {
        Cizelge.ornek(RenkAyari())
    }

    func snapshot(for configuration: RenkAyari, in context: Context) async -> Girdi {
        Cizelge.girdiler(configuration, simdi: Date()).first ?? Cizelge.ornek(configuration)
    }

    func timeline(for configuration: RenkAyari, in context: Context) async -> Timeline<Girdi> {
        let g = Cizelge.girdiler(configuration, simdi: Date())
        return Timeline(entries: g.isEmpty ? [Cizelge.bos(configuration)] : g, policy: .atEnd)
    }
}

// MARK: - yazılar

enum Yazi {
    /// "Perşembe 19 Kasım" / "Donderdag 19 november" / "Thursday 19 November"
    static func tarih(_ ymd: String, _ dil: String) -> String {
        let oku = DateFormatter()
        oku.locale = Locale(identifier: "en_US_POSIX")
        oku.timeZone = TimeZone(identifier: "UTC")
        oku.dateFormat = "yyyy-MM-dd"
        guard let d = oku.date(from: ymd) else { return "" }
        let yaz = DateFormatter()
        yaz.locale = Locale(identifier: dil == "tr" ? "tr_TR" : dil == "en" ? "en_GB" : "nl_NL")
        yaz.timeZone = TimeZone(identifier: "UTC")
        yaz.dateFormat = "EEEE d MMMM"
        let s = yaz.string(from: d)
        return s.prefix(1).uppercased(with: yaz.locale) + s.dropFirst()
    }

    static func bos(_ dil: String) -> String {
        switch dil {
        case "tr": return "Vakitler için uygulamayı açın"
        case "en": return "Open the app to load the prayer times"
        default: return "Open de app voor de gebedstijden"
        }
    }
}

// MARK: - görünümler

struct Sayac: View {
    let hedef: Date
    let boyut: CGFloat
    let renk: Color
    var body: some View {
        Text(hedef, style: .timer)
            .font(.system(size: boyut, weight: .semibold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(renk)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
    }
}

struct BosGorunum: View {
    let g: Girdi
    let r: Renkler
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "moon.stars.fill").font(.title3)
            Text(Yazi.bos(g.dil)).font(.caption).multilineTextAlignment(.center)
        }
        .foregroundStyle(r.metin)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Kilit ekranı (sistem renkleri) ve küçük ana ekran widget'ı
struct SayacGorunum: View {
    @Environment(\.widgetFamily) var aile
    @Environment(\.colorScheme) var sema
    let g: Girdi

    var body: some View {
        let r = Renkler(zemin: g.zemin, yazi: g.yazi, koyuSistem: sema == .dark)
        switch aile {
        case .accessoryInline:
            if let v = g.sonraki {
                Text("\(v.ad) · ") + Text(v.tarih, style: .timer)
            } else {
                Text("Süleymaniye")
            }
        case .accessoryCircular:
            VStack(spacing: 0) {
                Text(g.sonraki?.ad ?? "").font(.system(size: 10, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.6)
                if let v = g.sonraki {
                    Text(v.tarih, style: .timer).font(.system(size: 12, weight: .semibold)).monospacedDigit()
                        .multilineTextAlignment(.center).minimumScaleFactor(0.6)
                }
            }
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                if let v = g.sonraki {
                    Text("\(v.ad) · \(v.saat)").font(.headline).lineLimit(1).minimumScaleFactor(0.7)
                    if !g.kalan.isEmpty { Text(g.kalan).font(.caption2).lineLimit(1) }
                    Text(v.tarih, style: .timer).font(.title3.weight(.semibold)).monospacedDigit().lineLimit(1)
                } else {
                    Text(Yazi.bos(g.dil)).font(.caption).lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        default:
            if let v = g.sonraki {
                VStack(alignment: .leading, spacing: 2) {
                    Image(systemName: "moon.stars.fill").font(.caption).foregroundStyle(r.ikinci)
                    Spacer(minLength: 0)
                    Text(v.ad).font(.headline).foregroundStyle(r.metin).lineLimit(1).minimumScaleFactor(0.7)
                    Text(v.saat).font(.system(size: 30, weight: .semibold, design: .rounded)).foregroundStyle(r.metin)
                    Spacer(minLength: 0)
                    if !g.kalan.isEmpty {
                        Text(g.kalan).font(.caption2).foregroundStyle(r.ikinci).lineLimit(1)
                    }
                    Sayac(hedef: v.tarih, boyut: 20, renk: r.metin)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            } else {
                BosGorunum(g: g, r: r)
            }
        }
    }
}

/// Orta (tarih, sıradaki vakit, geri sayım, sonraki iki vakit) ve büyük (7 vakit alt alta)
struct VakitlerGorunum: View {
    @Environment(\.widgetFamily) var aile
    @Environment(\.colorScheme) var sema
    let g: Girdi

    var body: some View {
        let r = Renkler(zemin: g.zemin, yazi: g.yazi, koyuSistem: sema == .dark)
        if let gun = g.gun, let v = g.sonraki, gun.vakitler.count >= 7 {
            if aile == .systemLarge {
                buyuk(gun, v, r)
            } else {
                orta(gun, v, r)
            }
        } else {
            BosGorunum(g: g, r: r)
        }
    }

    private func ust(_ gun: Gun, _ r: Renkler) -> some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 1) {
                Text(Yazi.tarih(gun.ymd, g.dil)).font(.subheadline.weight(.semibold)).foregroundStyle(r.metin).lineLimit(1)
                if let h = gun.hicri, !h.isEmpty {
                    Text(h).font(.caption).foregroundStyle(r.ikinci).lineLimit(1)
                }
            }
            Spacer(minLength: 4)
            Image(systemName: "moon.stars.fill").font(.caption).foregroundStyle(r.ikinci)
        }
    }

    private func orta(_ gun: Gun, _ v: Vakit, _ r: Renkler) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ust(gun, r)
            Spacer(minLength: 4)
            HStack(alignment: .bottom, spacing: 8) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("\(v.ad) · \(v.saat)").font(.headline).foregroundStyle(r.metin).lineLimit(1).minimumScaleFactor(0.7)
                    if !g.kalan.isEmpty {
                        Text(g.kalan).font(.caption).foregroundStyle(r.ikinci).lineLimit(1)
                    }
                    Sayac(hedef: v.tarih, boyut: 34, renk: r.metin)
                }
                Spacer(minLength: 4)
                VStack(alignment: .trailing, spacing: 6) {
                    ForEach(Array(g.sonrakiler.enumerated()), id: \.offset) { _, x in
                        HStack(spacing: 6) {
                            Text(x.ad).font(.caption).foregroundStyle(r.ikinci).lineLimit(1)
                            Text(x.saat).font(.subheadline.weight(.semibold)).foregroundStyle(r.metin).monospacedDigit()
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func buyuk(_ gun: Gun, _ v: Vakit, _ r: Renkler) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ust(gun, r)
            Spacer(minLength: 2)
            ForEach(Array(gun.vakitler.prefix(7).enumerated()), id: \.offset) { i, x in
                let bu = i == g.sira
                HStack {
                    Text(x.ad).font(.body.weight(bu ? .semibold : .regular)).lineLimit(1)
                    Spacer()
                    Text(x.saat).font(.body.weight(.semibold)).monospacedDigit()
                }
                .foregroundStyle(bu ? r.vurguMetin : r.metin)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Capsule().fill(bu ? r.vurgu : Color.clear))
            }
            Spacer(minLength: 2)
            HStack(alignment: .firstTextBaseline) {
                Text(g.kalan).font(.caption).foregroundStyle(r.ikinci).lineLimit(1)
                Spacer()
                Sayac(hedef: v.tarih, boyut: 26, renk: r.metin).fixedSize()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

/// Seçilen arka plan (kilit ekranında sistem kendi rengini kullanır)
struct Zemin: ViewModifier {
    @Environment(\.colorScheme) var sema
    let g: Girdi
    func body(content: Content) -> some View {
        content.containerBackground(for: .widget) {
            Renkler(zemin: g.zemin, yazi: g.yazi, koyuSistem: sema == .dark).zemin
        }
    }
}

// MARK: - widget'lar

struct SayacWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "SayacWidget", intent: RenkAyari.self, provider: Saglayici()) { g in
            SayacGorunum(g: g).modifier(Zemin(g: g))
        }
        .configurationDisplayName("Next prayer")
        .description("Time left until the next prayer.")
        .supportedFamilies([.systemSmall, .accessoryRectangular, .accessoryInline, .accessoryCircular])
    }
}

struct VakitlerWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "VakitlerWidget", intent: RenkAyari.self, provider: Saglayici()) { g in
            VakitlerGorunum(g: g).modifier(Zemin(g: g))
        }
        .configurationDisplayName("Prayer times")
        .description("Today's prayer times and the time left.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

@main
struct Widgetlar: WidgetBundle {
    var body: some Widget {
        SayacWidget()
        VakitlerWidget()
    }
}
