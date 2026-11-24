import Foundation
import Capacitor
import UserNotifications
import WidgetKit
import AVFoundation
import AudioToolbox
import EventKit
import EventKitUI
import UIKit

/// Uygulama (mobil/yerel.js) ile telefon arasındaki köprü (iPhone).
/// - Namaz vakti bildirimlerini telefon kendisi kurar. iOS en fazla 64 bekleyen bildirime izin verir:
///   en yakın 60'ı kurulur; uygulama her açılışta planı yeniler.
/// - Ezan sesi (24-11-2026, Android'deki gibi): vakit girince seçilen kayıt çalar (ezan_N.caf; derlemede
///   Android'in mp3'lerinden yapılır, ios/App/ezan-sesleri.sh). iPhone bildirim sesi 30 sn'den kısa olmalı.
/// - Widget'lar (SayacWidget): sıradaki vakit, günün vakitleri; renkleri widget'ı düzenleyerek seçilir.
/// - Faaliyetler: "Takvime ekle" takvimin "yeni etkinlik" ekranı, "Paylaş" telefonun paylaş penceresi.
/// - iPhone'da durum çubuğuna uygulama simge koyamaz ve telefonu sessize alamaz (Apple izin vermez);
///   bu ayarlar iPhone'da görünmez.
@objc(CamiPlugin)
public class CamiPlugin: CAPPlugin, CAPBridgedPlugin, NotificationHandlerProtocol, EKEventEditViewDelegate, AVAudioPlayerDelegate {
    public let identifier = "CamiPlugin"
    public let jsName = "Cami"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "planKur", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "izinDurumu", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "bildirimIzniIste", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deneme", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cubuklar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sessizIzniAc", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "tamAlarmIzniAc", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sesDinle", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sesDurdur", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takvimeEkle", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "paylas", returnType: CAPPluginReturnPromise)
    ]

    /// Uygulama ile widget'ın ortak deposu (App Group)
    static let grup = "group.nl.suleymaniyecamii.namaz"
    private let onek = "vakit-"
    private let enFazla = 60

    private var oynatici: AVAudioPlayer?
    private var dinlemeCagri: CAPPluginCall?
    private let olayDeposu = EKEventStore()

    override public func load() {
        // uygulama açıkken gelen bildirim de görünsün
        bridge?.notificationRouter.localNotificationHandler = self
    }

    private static func sayi(_ v: Any?) -> Double? {
        if let n = v as? NSNumber { return n.doubleValue }
        if let d = v as? Double { return d }
        return nil
    }

    /// "ezan-3" → paketteki "ezan_3.caf" (yoksa nil: telefonun sesi çalar)
    static func ezanDosyasi(_ ses: String?) -> String? {
        guard let ses = ses, ses.hasPrefix("ezan-") else { return nil }
        let ad = "ezan_" + ses.dropFirst(5)
        return Bundle.main.url(forResource: ad, withExtension: "caf") != nil ? ad + ".caf" : nil
    }

    @objc func planKur(_ call: CAPPluginCall) {
        guard let plan = call.getObject("plan") else {
            call.reject("plan yok")
            return
        }
        let simdi = Date().timeIntervalSince1970 * 1000
        let bildirimler: [(an: Double, etiket: String, baslik: String, govde: String, ses: String?)] = (plan["bildirimler"] as? [JSObject] ?? [])
            .compactMap { o in
                guard let an = CamiPlugin.sayi(o["an"]), an > simdi, let baslik = o["baslik"] as? String else { return nil }
                return (an, o["etiket"] as? String ?? "", baslik, o["govde"] as? String ?? "", o["ses"] as? String)
            }
            .sorted { $0.an < $1.an }
        let merkez = UNUserNotificationCenter.current()
        merkez.getPendingNotificationRequests { bekleyen in
            merkez.removePendingNotificationRequests(withIdentifiers: bekleyen.map(\.identifier).filter { $0.hasPrefix(self.onek) })
            for b in bildirimler.prefix(self.enFazla) {
                let icerik = UNMutableNotificationContent()
                icerik.title = b.baslik
                if !b.govde.isEmpty { icerik.body = b.govde }
                // vakit girince seçilen ezan (sadece beş vakit; plan sadece ezanlı bildirime "ses" koyar)
                if let dosya = CamiPlugin.ezanDosyasi(b.ses) {
                    icerik.sound = UNNotificationSound(named: UNNotificationSoundName(rawValue: dosya))
                } else {
                    icerik.sound = .default
                }
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

    /// Widget'lar: sıradaki vakitler ve günlerin 7 vakti (uygulamanın hesapladığı, ~30 gün).
    /// JSON olarak saklanır (UserDefaults sadece plist türlerini kabul eder).
    private func widgetVerisi(_ plan: JSObject) {
        guard let depo = UserDefaults(suiteName: CamiPlugin.grup) else { return }
        let vakitler: [[String: Any]] = (plan["vakitler"] as? [JSObject] ?? []).compactMap { o in
            guard let an = CamiPlugin.sayi(o["an"]), let baslik = o["baslik"] as? String else { return nil }
            return ["an": an, "baslik": baslik]
        }
        depo.set(vakitler, forKey: "vakitler")
        depo.set(plan["sayacAlt"] as? String ?? "", forKey: "alt")
        depo.set(plan["dil"] as? String ?? "nl", forKey: "dil")
        for anahtar in ["gunler", "kalanKisa"] {
            if let deger = plan[anahtar], JSONSerialization.isValidJSONObject(deger as Any),
               let veri = try? JSONSerialization.data(withJSONObject: deger as Any) {
                depo.set(veri, forKey: anahtar)
            }
        }
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

    /// Eskiden Ayarlar'daki "Deneme bildirimi" (düğme 20-11-2026'da kalktı)
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

    // MARK: ses dinleme (Ayarlar'daki ▶; ses bitince veya durdurulunca cevap verir)

    @objc func sesDinle(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.dinlemeBitir()
            let ses = call.getString("ses") ?? "telefon"
            if ses == "telefon" {
                // telefonun bildirim sesi (sessiz anahtarı açıksa duyulmaz)
                self.dinlemeCagri = call
                AudioServicesPlaySystemSoundWithCompletion(1007) {
                    DispatchQueue.main.async { if self.dinlemeCagri === call { self.dinlemeBitir() } }
                }
                return
            }
            guard let dosya = CamiPlugin.ezanDosyasi(ses),
                  let adres = Bundle.main.url(forResource: (dosya as NSString).deletingPathExtension, withExtension: "caf") else {
                call.reject("ses yok")
                return
            }
            do {
                // medya sesiyle: sessiz anahtarı açıkken de duyulur, ses tuşları çalışır
                try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
                try AVAudioSession.sharedInstance().setActive(true)
                let o = try AVAudioPlayer(contentsOf: adres)
                o.delegate = self
                self.oynatici = o
                self.dinlemeCagri = call
                o.play()
            } catch {
                call.reject("ses açılamadı")
            }
        }
    }

    @objc func sesDurdur(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.dinlemeBitir()
            call.resolve()
        }
    }

    private func dinlemeBitir() {
        if let o = oynatici {
            o.stop()
            oynatici = nil
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
        if let c = dinlemeCagri {
            dinlemeCagri = nil
            c.resolve()
        }
    }

    public func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        DispatchQueue.main.async { if player === self.oynatici { self.dinlemeBitir() } }
    }

    // MARK: faaliyetler: takvim ve paylaş

    /// Takvimin "yeni etkinlik" ekranı dolu açılır, kullanıcı kaydeder. { baslik, bas, bit (ms), tumGun, yer, aciklama }
    /// iOS 17+: izin gerekmez (ekran takvimin kendisinde çalışır). iOS 16: bir kez takvim izni sorulur.
    @objc func takvimeEkle(_ call: CAPPluginCall) {
        let ac = {
            DispatchQueue.main.async {
                guard let vc = self.bridge?.viewController else {
                    call.reject("takvimYok")
                    return
                }
                let olay = EKEvent(eventStore: self.olayDeposu)
                olay.title = call.getString("baslik") ?? ""
                olay.location = call.getString("yer")
                olay.notes = call.getString("aciklama")
                let tumGun = call.getBool("tumGun") ?? false
                if let bas = call.getDouble("bas") { olay.startDate = Date(timeIntervalSince1970: bas / 1000) }
                if var bit = call.getDouble("bit") {
                    // tüm gün: uygulama ertesi günün gece yarısını verir (Android böyle ister); iPhone son günü ister
                    if tumGun { bit -= 86_400_000 }
                    olay.endDate = Date(timeIntervalSince1970: bit / 1000)
                }
                olay.isAllDay = tumGun
                let ekran = EKEventEditViewController()
                ekran.eventStore = self.olayDeposu
                ekran.event = olay
                ekran.editViewDelegate = self
                vc.present(ekran, animated: true)
                call.resolve()
            }
        }
        if #available(iOS 17.0, *) {
            ac()
        } else {
            olayDeposu.requestAccess(to: .event) { izin, _ in
                if izin { ac() } else { call.reject("izinYok") }
            }
        }
    }

    public func eventEditViewController(_ controller: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) {
        controller.dismiss(animated: true)
    }

    /// Telefonun paylaş penceresi. { baslik, metin }
    @objc func paylas(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let vc = self.bridge?.viewController else {
                call.reject("paylasimYok")
                return
            }
            let pencere = UIActivityViewController(activityItems: [call.getString("metin") ?? ""], applicationActivities: nil)
            if let p = pencere.popoverPresentationController {   // iPad: ekranın altında, oksuz
                p.sourceView = vc.view
                p.sourceRect = CGRect(x: vc.view.bounds.midX, y: vc.view.bounds.maxY - 80, width: 1, height: 1)
                p.permittedArrowDirections = []
            }
            vc.present(pencere, animated: true)
            call.resolve()
        }
    }

    // MARK: NotificationHandlerProtocol
    public func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {
        return [.banner, .list, .sound]
    }

    public func didReceive(response: UNNotificationResponse) {}
}
