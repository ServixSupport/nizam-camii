package nl.suleymaniyecamii.namaz;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Telefon yeniden açılınca, uygulama güncellenince, saat/saat dilimi değişince veya "Alarmlar ve hatırlatıcılar"
 * izni verilince: alarmlar silinmiş olabilir; plan yeniden kurulur (uygulamayı açmaya gerek yok).
 */
public class AcilisAlici extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        Planlayici.calistir(context);
    }
}
