package nl.suleymaniyecamii.namaz;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.os.Build;
import android.service.notification.StatusBarNotification;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Planı telefonda uygular; uygulama kapalıyken alarmlarla (VakitAlici) çalışır:
 *  - durum çubuğunda sıradaki vakte geri sayım (Android 16+: üst çubukta canlı sayaç),
 *  - namaz vakti bildirimleri,
 *  - namaz vaktinde sessize alma ve süre bitince eski haline döndürme.
 * Her çalıştırmada bir sonraki olay için tek bir alarm kurulur.
 */
final class Planlayici {

    private static final String DEPO = "cami";
    private static final String K_PLAN = "plan";
    private static final String K_SON = "sonIslenen";
    private static final String K_SESSIZ = "sessizDurum";

    static final String KANAL_VAKIT = "vakit";
    static final String KANAL_SAYAC = "sayac";
    static final String KANAL_SESSIZ = "sessiz";
    private static final int ID_SAYAC = 1;
    private static final int ID_SESSIZ = 2;
    private static final int ID_BILDIRIM = 10;

    private Planlayici() {}

    private static SharedPreferences depo(Context c) {
        return c.getSharedPreferences(DEPO, Context.MODE_PRIVATE);
    }

    static synchronized void planKaydet(Context c, String json) {
        // yeni plan: geçmişteki olaylar tekrar işlenmesin (son = şimdi)
        depo(c).edit().putString(K_PLAN, json).putLong(K_SON, System.currentTimeMillis()).commit();
        calistir(c);
    }

    private static JSONObject planOku(SharedPreferences p) {
        String s = p.getString(K_PLAN, null);
        if (s == null) return null;
        try {
            return new JSONObject(s);
        } catch (JSONException e) {
            return null;
        }
    }

    /** Vakti gelenleri uygula, geri sayımı güncelle, sonraki alarmı kur. */
    static synchronized void calistir(Context c) {
        SharedPreferences p = depo(c);
        JSONObject plan = planOku(p);
        // alarm birkaç ms erken uyanırsa vakit kaçmasın
        long simdi = System.currentTimeMillis() + 1000;
        long son = p.getLong(K_SON, simdi);
        if (plan == null) return;
        kanallar(c, plan);

        for (JSONObject b : PlanMantigi.vaktiGelenBildirimler(plan, son, simdi)) {
            bildirimGoster(c, b.optString("etiket"), b.optString("baslik"), b.optString("govde"));
        }
        sessizIsle(c, plan, son, simdi);
        sayacGoster(c, plan, simdi);
        alarmKur(c, PlanMantigi.sonrakiAlarm(plan, simdi));
        p.edit().putLong(K_SON, Math.max(son, simdi)).apply();
    }

    // ---------------- bildirim kanalları ----------------
    static void kanallar(Context c, JSONObject plan) {
        if (Build.VERSION.SDK_INT < 26) return;
        JSONObject ad = plan == null ? null : plan.optJSONObject("kanallar");
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        NotificationChannel vakit = new NotificationChannel(KANAL_VAKIT, adi(ad, "vakit", c.getString(R.string.kanal_vakit)), NotificationManager.IMPORTANCE_HIGH);
        NotificationChannel sayac = new NotificationChannel(KANAL_SAYAC, adi(ad, "sayac", c.getString(R.string.kanal_sayac)), NotificationManager.IMPORTANCE_LOW);
        sayac.setShowBadge(false);
        NotificationChannel sessiz = new NotificationChannel(KANAL_SESSIZ, adi(ad, "sessiz", c.getString(R.string.kanal_sessiz)), NotificationManager.IMPORTANCE_LOW);
        sessiz.setShowBadge(false);
        // aynı kimlikle yeniden oluşturmak sadece adı günceller (kullanıcının seçtiği ses vb. korunur)
        nm.createNotificationChannel(vakit);
        nm.createNotificationChannel(sayac);
        nm.createNotificationChannel(sessiz);
    }

    private static String adi(JSONObject ad, String k, String yedek) {
        String s = ad == null ? null : ad.optString(k, null);
        return s == null || s.isEmpty() ? yedek : s;
    }

    private static PendingIntent acilis(Context c) {
        Intent i = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static boolean bildirimIzni(Context c) {
        return NotificationManagerCompat.from(c).areNotificationsEnabled();
    }

    // ---------------- namaz vakti bildirimi ----------------
    /** Aynı etiket (aynı vakit) birbirinin yerini alır: "15 dk kala"nın yerine "vakit girdi" (yine ses çıkar). */
    @SuppressWarnings("MissingPermission")
    static void bildirimGoster(Context c, String etiket, String baslik, String govde) {
        if (!bildirimIzni(c)) return;
        kanallar(c, planOku(depo(c)));
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, KANAL_VAKIT)
            .setSmallIcon(R.drawable.ic_stat_cami)
            .setColor(ContextCompat.getColor(c, R.color.cami_lacivert))
            .setContentTitle(baslik)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(acilis(c));
        if (govde != null && !govde.isEmpty()) b.setContentText(govde);
        // önceki vakitlerin bildirimleri kalkar: bildirim listesinde sadece en son vakit durur
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        for (StatusBarNotification s : nm.getActiveNotifications()) {
            if (s.getId() == ID_BILDIRIM && s.getTag() != null && !s.getTag().equals(etiket)) nm.cancel(s.getTag(), ID_BILDIRIM);
        }
        NotificationManagerCompat.from(c).notify(etiket, ID_BILDIRIM, b.build());
    }

    // ---------------- geri sayım (durum çubuğu) ----------------
    @SuppressWarnings("MissingPermission")
    private static void sayacGoster(Context c, JSONObject plan, long simdi) {
        NotificationManagerCompat nm = NotificationManagerCompat.from(c);
        JSONObject v = plan.optBoolean("sayac") ? PlanMantigi.sonrakiVakit(plan, simdi) : null;
        if (v == null || !bildirimIzni(c)) {
            nm.cancel(ID_SAYAC);
            return;
        }
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, KANAL_SAYAC)
            .setSmallIcon(R.drawable.ic_stat_cami)
            .setColor(ContextCompat.getColor(c, R.color.cami_lacivert))
            .setContentTitle(v.optString("baslik"))
            .setContentText(plan.optString("sayacAlt"))
            .setWhen(v.optLong("an"))
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(acilis(c))
            // Android 16+: "canlı güncelleme" olarak üst çubukta sayaç (kullanıcı telefonun ayarlarından kapatabilir)
            .setRequestPromotedOngoing(true);
        nm.notify(ID_SAYAC, b.build());
    }

    // ---------------- sessize alma ----------------
    private static void sessizIsle(Context c, JSONObject plan, long son, long simdi) {
        SharedPreferences p = depo(c);
        JSONObject durum = null;
        try {
            String s = p.getString(K_SESSIZ, null);
            if (s != null) durum = new JSONObject(s);
        } catch (JSONException e) {
            durum = null;
        }
        JSONObject donem = PlanMantigi.aktifSessiz(plan, simdi);
        if (durum != null) {
            // bizim başlattığımız dönem: bitti mi veya ayar kapatıldı mı?
            if (donem == null) {
                sessizBitir(c, durum);
                p.edit().remove(K_SESSIZ).apply();
            } else if (donem.optLong("bit") != durum.optLong("bit")) {
                try {
                    durum.put("bit", donem.optLong("bit"));
                } catch (JSONException e) { /* */ }
                p.edit().putString(K_SESSIZ, durum.toString()).apply();
                sessizNotu(c, plan, donem, durum.optInt("kurulan"));
            }
            return;
        }
        if (donem != null && PlanMantigi.yeniBasladi(donem, son, simdi)) {
            JSONObject yeni = sessizBaslat(c, plan.optString("sessizMod", "sessiz"));
            if (yeni == null) return;
            try {
                yeni.put("bit", donem.optLong("bit"));
            } catch (JSONException e) { /* */ }
            p.edit().putString(K_SESSIZ, yeni.toString()).apply();
            sessizNotu(c, plan, donem, yeni.optInt("kurulan"));
        }
    }

    /** Telefonu sessize (veya titreşime) alır; zaten sessizse dokunmaz. Döner: { eski, kurulan } veya null. */
    private static JSONObject sessizBaslat(Context c, String mod) {
        AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        int eski = am.getRingerMode();
        if (eski == AudioManager.RINGER_MODE_SILENT) return null;
        // kullanıcı zaten "Rahatsız Etmeyin"deyse dokunma
        if (nm.getCurrentInterruptionFilter() > NotificationManager.INTERRUPTION_FILTER_ALL) return null;
        int hedef = "titresim".equals(mod) ? AudioManager.RINGER_MODE_VIBRATE : AudioManager.RINGER_MODE_SILENT;
        // "Rahatsız Etmeyin" erişimi yoksa sessiz yapılamaz: titreşim
        if (hedef == AudioManager.RINGER_MODE_SILENT && !nm.isNotificationPolicyAccessGranted()) hedef = AudioManager.RINGER_MODE_VIBRATE;
        if (eski == hedef) return null;
        try {
            am.setRingerMode(hedef);
        } catch (SecurityException e) {
            if (hedef != AudioManager.RINGER_MODE_SILENT) return null;
            try {
                am.setRingerMode(AudioManager.RINGER_MODE_VIBRATE);
            } catch (SecurityException e2) {
                return null;
            }
        }
        JSONObject d = new JSONObject();
        try {
            d.put("eski", eski);
            d.put("kurulan", am.getRingerMode());
        } catch (JSONException e) { /* */ }
        return d;
    }

    /** Eski haline döndürür; kullanıcı bu arada sesi kendisi değiştirdiyse dokunmaz. */
    private static void sessizBitir(Context c, JSONObject durum) {
        AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
        if (am.getRingerMode() == durum.optInt("kurulan", -1)) {
            try {
                am.setRingerMode(durum.optInt("eski", AudioManager.RINGER_MODE_NORMAL));
            } catch (SecurityException e) { /* izin geri alındı */ }
        }
        NotificationManagerCompat.from(c).cancel(ID_SESSIZ);
    }

    @SuppressWarnings("MissingPermission")
    private static void sessizNotu(Context c, JSONObject plan, JSONObject donem, int kurulan) {
        if (!bildirimIzni(c)) return;
        JSONObject basliklar = plan.optJSONObject("sessizBasliklar");
        String baslik = donem.optString("baslik");
        if (basliklar != null) {
            baslik = basliklar.optString(kurulan == AudioManager.RINGER_MODE_VIBRATE ? "titresim" : "sessiz", baslik);
        }
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, KANAL_SESSIZ)
            .setSmallIcon(R.drawable.ic_stat_sessiz)
            .setColor(ContextCompat.getColor(c, R.color.cami_lacivert))
            .setContentTitle(baslik)
            .setContentText(donem.optString("govde"))
            .setOngoing(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setContentIntent(acilis(c));
        NotificationManagerCompat.from(c).notify(ID_SESSIZ, b.build());
    }

    // ---------------- alarm ----------------
    static boolean tamAlarmVar(Context c) {
        if (Build.VERSION.SDK_INT < 31) return true;
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        return am.canScheduleExactAlarms();
    }

    private static void alarmKur(Context c, long an) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = PendingIntent.getBroadcast(
            c, 0, new Intent(c, VakitAlici.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        if (an <= 0) {
            am.cancel(pi);
            return;
        }
        if (tamAlarmVar(c)) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, an, pi);
        } else {
            // izin yoksa: telefon uykudaysa birkaç dakika gecikebilir
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, an, pi);
        }
    }
}
