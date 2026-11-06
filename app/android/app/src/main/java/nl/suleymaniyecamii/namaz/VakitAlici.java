package nl.suleymaniyecamii.namaz;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Planlayici'nin kurduğu alarm: vakti gelen olayları uygular ve bir sonrakini kurar. */
public class VakitAlici extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        Planlayici.calistir(context);
    }
}
