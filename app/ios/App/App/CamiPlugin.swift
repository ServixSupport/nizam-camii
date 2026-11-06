import Foundation
import Capacitor
import UserNotifications
import WidgetKit

/// Uygulama (mobil/yerel.js) ile telefon arasındaki köprü (iPhone).
/// - Namaz vakti bildirimlerini telefon kendisi kurar. iOS en fazla 64 bekleyen bildirime izin verir:
///   en yakın 60'ı kurulur; uygulama her açılışta planı yeniler.
/// - Geri sayım kilit ekranı / ana ekran widget'ında (SayacWidget). iPhone'da durum çubuğuna uygulama
///   simge koyamaz ve telefonu sessize alamaz (Apple izin vermez); bu ayarlar iPhone'da görünmez.
@objc(CamiPlugin)
public class CamiPlugin: CAPPlugin, CAPBridgedPlugin, NotificationHandlerProtocol {
    public let identifier = "CamiPlugin"
    public let jsName = "Cami"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "planKur", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "izinDurumu", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "bildirimIzniIste", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deneme", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cubuklar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sessizIzniAc", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "tamAlarmIzniAc", returnType: CAPPluginReturnPromise)
    ]

    /// Uygulama ile widget'ın ortak deposu (App Group)
    static let grup = "group.nl.suleymaniyecamii.namaz"
    private let onek = "vakit-"
    private let enFazla = 60

    override public func load() {
        // uygulama açıkken gelen bildirim de görünsün
        bridge?.notificationRouter.localNotificationHandler = self
    }

    private static func sayi(_ v: Any?) -> Double? {
        if let n = v as? NSNumber { return n.doubleValue }
        if let d = v as? Double { return d }
        return nil
    }

    @objc func planKur(_ call: CAPPluginCall) {
        guard let plan = call.getObject("plan") else {
            call.reject("plan yok")
            return
        }
        let simdi = Date().timeIntervalSince1970 * 1000
        let bildirimler: [(an: Double, etiket: String, baslik: String, govde: String)] = (plan["bildirimler"] as? [JSObject] ?? [])
            .compactMap { o in
                guard let an = CamiPlugin.sayi(o["an"]), an > simdi, let baslik = o["baslik"] as? String else { return nil }
                return (an, o["etiket"] as? String ?? "", baslik, o["govde"] as? String ?? "")
            }
            .sorted { $0.an < $1.an }
        let merkez = UNUserNotificationCenter.current()
        merkez.getPendingNotificationRequests { bekleyen in
            merkez.removePendingNotificationRequests(withIdentifiers: bekleyen.map(\.identifier).filter { $0.hasPrefix(self.onek) })
            for b in bildirimler.prefix(self.enFazla) {
                let icerik = UNMutableNotificationContent()
                icerik.title = b.baslik
                if !b.govde.isEmpty { icerik.body = b.govde }
                icerik.sound = .default
                icerik.threadIdentifier = b.etiket
                let tarih = Date(timeIntervalSince1970: b.an / 1000)
                let tetik = UNCalendarNotificationTrigger(
                    dateMatching: Calendar.current.dateComponents(in: TimeZone.current, from: tarih), repeats: false)
                merkez.add(UNNotificationRequest(identifier: "\(self.onek)\(Int64(b.an))-\(b.etiket)", content: icerik, trigger: tetik))
            }
        }
        widgetVerisi(plan)
        call.resolve()
    }

    /// Kilit ekranı widget'ı: sıradaki vakitler (uygulamanın hesapladığı, ~30 gün)
    private func widgetVerisi(_ plan: JSObject) {
        guard let depo = UserDefaults(suiteName: CamiPlugin.grup) else { return }
        let vakitler: [[String: Any]] = (plan["vakitler"] as? [JSObject] ?? []).compactMap { o in
            guard let an = CamiPlugin.sayi(o["an"]), let baslik = o["baslik"] as? String else { return nil }
            return ["an": an, "baslik": baslik]
        }
        depo.set(vakitler, forKey: "vakitler")
        depo.set(plan["sayacAlt"] as? String ?? "", forKey: "alt")
        WidgetCenter.shared.reloadAllTimelines()
    }

    @objc func izinDurumu(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { s in
            let bildirim: String
            switch s.authorizationStatus {
            case .authorized, .provisional, .ephemeral: bildirim = "granted"
            case .denied: bildirim = "denied"
            default: bildirim = "prompt"
            }
            call.resolve(["bildirim": bildirim, "tamAlarm": true, "sessiz": false])
        }
    }

    @objc func bildirimIzniIste(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in
            self.izinDurumu(call)
        }
    }

    /// Ayarlar'daki "Deneme bildirimi"
    @objc func deneme(_ call: CAPPluginCall) {
        let icerik = UNMutableNotificationContent()
        icerik.title = call.getString("baslik") ?? ""
        icerik.body = call.getString("govde") ?? ""
        icerik.sound = .default
        let istek = UNNotificationRequest(identifier: "deneme", content: icerik,
                                          trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false))
        UNUserNotificationCenter.current().add(istek) { _ in call.resolve() }
    }

    /// Üstteki saat ve simgeler temaya göre: açık temada koyu, koyu temada açık
    @objc func cubuklar(_ call: CAPPluginCall) {
        let koyu = call.getBool("koyu") ?? false
        bridge?.statusBarStyle = koyu ? .lightContent : .darkContent
        call.resolve()
    }

    // iPhone'da yok (Apple izin vermez); uygulama bu ayarları iPhone'da göstermez
    @objc func sessizIzniAc(_ call: CAPPluginCall) { call.resolve() }
    @objc func tamAlarmIzniAc(_ call: CAPPluginCall) { call.resolve() }

    // MARK: NotificationHandlerProtocol
    public func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {
        return [.banner, .list, .sound]
    }

    public func didReceive(response: UNNotificationResponse) {}
}
