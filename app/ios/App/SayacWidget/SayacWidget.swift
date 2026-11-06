import WidgetKit
import SwiftUI

/// Kilit ekranı ve ana ekran widget'ı: sıradaki vakte geri sayım.
/// Vakitleri uygulama hesaplar ve ortak depoya yazar (CamiPlugin.widgetVerisi, ~30 gün);
/// widget her vakitte kendiliğinden bir sonrakine geçer (uygulamanın açık olması gerekmez).
struct Girdi: TimelineEntry {
    let date: Date
    let baslik: String
    let hedef: Date?
    let alt: String
}

struct Saglayici: TimelineProvider {
    static let grup = "group.nl.suleymaniyecamii.namaz"

    func placeholder(in context: Context) -> Girdi {
        Girdi(date: Date(), baslik: "Süleymaniye", hedef: Date().addingTimeInterval(3600), alt: "")
    }

    func getSnapshot(in context: Context, completion: @escaping (Girdi) -> Void) {
        completion(girdiler().first ?? placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Girdi>) -> Void) {
        let g = girdiler()
        let bos = Girdi(date: Date(), baslik: "Süleymaniye", hedef: nil, alt: "")
        completion(Timeline(entries: g.isEmpty ? [bos] : g, policy: .atEnd))
    }

    private func girdiler() -> [Girdi] {
        let depo = UserDefaults(suiteName: Saglayici.grup)
        let alt = depo?.string(forKey: "alt") ?? ""
        let ham = depo?.array(forKey: "vakitler") as? [[String: Any]] ?? []
        let simdi = Date()
        let vakitler: [(Date, String)] = ham.compactMap { o in
            guard let an = (o["an"] as? NSNumber)?.doubleValue, let b = o["baslik"] as? String else { return nil }
            return (Date(timeIntervalSince1970: an / 1000), b)
        }
        .filter { $0.0 > simdi }
        .sorted { $0.0 < $1.0 }
        // her girdi bir önceki vakitte başlar: vakit gelince widget sıradakine geçer
        var out: [Girdi] = []
        var bas = simdi
        for (an, baslik) in vakitler.prefix(60) {
            out.append(Girdi(date: bas, baslik: baslik, hedef: an, alt: alt))
            bas = an
        }
        return out
    }
}

struct SayacGorunum: View {
    @Environment(\.widgetFamily) var aile
    let g: Girdi

    var body: some View {
        switch aile {
        case .accessoryInline:
            if let h = g.hedef {
                Text("\(g.baslik) · ") + Text(h, style: .timer)
            } else {
                Text(g.baslik)
            }
        case .accessoryCircular:
            VStack(spacing: 0) {
                Image(systemName: "moon.stars.fill").font(.caption2)
                if let h = g.hedef {
                    Text(h, style: .timer).font(.system(size: 12, weight: .semibold)).monospacedDigit()
                        .multilineTextAlignment(.center).minimumScaleFactor(0.6)
                }
            }
        default:
            VStack(alignment: .leading, spacing: 2) {
                Text(g.baslik).font(.headline).lineLimit(1).minimumScaleFactor(0.7)
                if let h = g.hedef {
                    Text(h, style: .timer).font(.title2.weight(.semibold)).monospacedDigit().lineLimit(1)
                }
                if !g.alt.isEmpty {
                    Text(g.alt).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

@main
struct SayacWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "SayacWidget", provider: Saglayici()) { g in
            if #available(iOSApplicationExtension 17.0, *) {
                SayacGorunum(g: g).containerBackground(.fill.tertiary, for: .widget)
            } else {
                SayacGorunum(g: g).padding()
            }
        }
        .configurationDisplayName("Süleymaniye")
        .description("Geri sayım · Aftellen · Countdown")
        .supportedFamilies([.systemSmall, .accessoryRectangular, .accessoryInline, .accessoryCircular])
    }
}
