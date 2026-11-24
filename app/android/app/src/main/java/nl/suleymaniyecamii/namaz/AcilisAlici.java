package nl.suleymaniyecamii.namaz;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Telefon yeniden açılınca, uygulama güncellenince, saat/saat dilimi değişince veya "Alarmlar ve hatırlatıcılar"
 * izni verilince: alarmlar silinmiş olabilir; plan yeniden kurulur (uygulamayı açmaya gerek yok).
 */
public class AcilisAlici extends BroadcastReceiver {

    /** Manifest'teki olaylar (hepsi sistemin korumalı yayınları); başka uygulamanın gönderdiği her şey yok sayılır. */
    private static final java.util.Set<String> OLAYLAR = new java.util.HashSet<>(java.util.Arrays.asList(
        Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED, Intent.ACTION_TIME_CHANGED,
        Intent.ACTION_TIMEZONE_CHANGED, "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED"));

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !OLAYLAR.contains(intent.getAction())) return;
        Planlayici.alarmGeldi(context);
    }
}
