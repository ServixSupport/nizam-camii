package nl.suleymaniyecamii.namaz;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // uygulamanın kendi eklentisi (mobil/yerel.js: registerPlugin('Cami'))
        registerPlugin(CamiPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
