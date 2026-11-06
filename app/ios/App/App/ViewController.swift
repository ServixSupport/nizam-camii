import UIKit
import Capacitor

/// Uygulamanın kendi eklentisi (mobil/yerel.js: registerPlugin('Cami'))
class ViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(CamiPlugin())
    }
}
