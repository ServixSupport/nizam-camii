package nl.suleymaniyecamii.namaz;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Planlayici'nin kurduğu alarm: vakti gelen olayları uygular ve bir sonrakini kurar.
 * Sessize alma başlıyor veya bitiyorsa kısa bir ön plan hizmetiyle (SessizServis; Android 17).
 */
public class VakitAlici extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        Planlayici.alarmGeldi(context);
    }
}
