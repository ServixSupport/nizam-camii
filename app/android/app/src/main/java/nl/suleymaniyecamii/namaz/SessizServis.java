package nl.suleymaniyecamii.namaz;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

/**
 * Sessize alma başlarken ve biterken çok kısa süren ön plan hizmeti (kullanıcı isteği, 19-11-2026).
 *
 * Android 17'den beri (Samsung One UI 9) arka plandaki bir uygulama zil ayarını değiştiremez: setRingerMode sessizce
 * yok sayılır ("background audio hardening"). Uygulama ön plan hizmeti çalıştırıyorsa (SHORT_SERVICE değil) izin var.
 * Bu hizmet sadece Planlayici.calistir'i ön planda çalıştırır ve hemen kapanır. Bildirimi görünmez: Android 12+
 * ön plan hizmetinin bildirimini 10 sn bekletir (FOREGROUND_SERVICE_DEFERRED), hizmet o zamana kadar biter.
 */
public class SessizServis extends Service {

    /** Hizmeti başlatır; Android izin vermezse (ör. "Alarmlar ve hatırlatıcılar" izni yok) false. */
    static boolean baslat(Context c) {
        try {
            ContextCompat.startForegroundService(c, new Intent(c, SessizServis.class));
            return true;
        } catch (RuntimeException e) {          // ForegroundServiceStartNotAllowedException (Android 12+)
            return false;
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            ServiceCompat.startForeground(this, Planlayici.ID_SERVIS, Planlayici.servisBildirimi(this),
                Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0);
        } catch (RuntimeException e) {
            // ön plana geçemedi: yine de dene (Android 16 ve öncesinde arka planda da çalışır)
        }
        try {
            Planlayici.calistir(this);
        } finally {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
            stopSelf(startId);
        }
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
