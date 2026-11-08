package nl.suleymaniyecamii.namaz;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Typeface;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.service.notification.StatusBarNotification;
import android.text.SpannableString;
import android.text.style.StyleSpan;
import android.widget.RemoteViews;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.drawable.IconCompat;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Planı telefonda uygular; uygulama kapalıyken alarmlarla (VakitAlici) çalışır:
 *  - bildirim panelinde vakit tablosu ve sıradaki vakte geri sayım; vakte 30 dk kala üst çubuktaki
 *    cami simgesinde kalan dakika (kullanıcı isteği, 07-11-2026),
 *  - namaz vakti bildirimleri (bir vakit için tek bildirim: "X dk kala"nın yerini "vakit girdi" alır),
 *  - namaz vaktinde sessize alma ve süre bitince eski haline döndürme.
 * Her çalıştırmada bir sonraki olay için tek bir alarm kurulur.
 */
final class Planlayici {

    private static final String DEPO = "cami";
    private static final String K_PLAN = "plan";
    private static final String K_SON = "sonIslenen";
    private static final String K_SESSIZ = "sessizDurum";
    /** Son sessize alma denemesi ve sonucu (Ayarlar'da gösterilir; kullanıcı isteği, 08-11-2026: "sessize almadı, kontrol et"). */
    private static final String K_SESSIZ_SON = "sessizSon";
    /** Panel açıkken vakit bildirimi ayrı gelmez: panel bir kez sesli uyarır ve üst satırında bu süre gösterir. */
    private static final String K_UYARI = "uyari";
    static final long UYARI_SURE = 15 * 60_000L;

    static final String KANAL_VAKIT = PlanMantigi.KANAL_VAKIT;
    static final String KANAL_SAYAC = "vakitler";
    private static final String ESKI_KANAL_SAYAC = "sayac";
    static final String KANAL_SESSIZ = "sessiz";
    private static final int ID_SAYAC = 1;
    private static final int ID_SESSIZ = 2;
    private static final int ID_BILDIRIM = 10;
    // her tür kendi grubunda: Android tabloyu ve vakit bildirimini tek bir "2 bildirim" grubunda toplamasın
    private static final String GRUP_PANEL = "nl.suleymaniyecamii.namaz.panel";
    private static final String GRUP_VAKIT = "nl.suleymaniyecamii.namaz.vakit";
    private static final String GRUP_SESSIZ = "nl.suleymaniyecamii.namaz.sessiz";

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

        // tek bildirim (kullanıcı isteği, 07-11-2026): panel açıksa vakit bildirimi panelin kendisidir
        boolean panel = panelAcik(c, plan);
        JSONObject yeniUyari = null;
        for (JSONObject b : PlanMantigi.vaktiGelenBildirimler(plan, son, simdi)) {
            if (panel) yeniUyari = b;
            else bildirimGoster(c, b.optString("etiket"), b.optString("baslik"), b.optString("govde"), b.optString("ses"));
        }
        if (yeniUyari != null) p.edit().putString(K_UYARI, yeniUyari.toString()).apply();
        sessizIsle(c, plan, son, simdi);
        sayacGoster(c, plan, simdi, yeniUyari != null);
        long alarm = PlanMantigi.sonrakiAlarm(plan, simdi);
        JSONObject u = uyari(p, simdi);
        if (u != null) {
            long bitis = u.optLong("an") + UYARI_SURE;               // uyarı yazısı panelden kalksın
            if (alarm == 0 || bitis < alarm) alarm = bitis;
        }
        alarmKur(c, alarm);
        p.edit().putLong(K_SON, Math.max(son, simdi)).apply();
    }

    // ---------------- bildirim kanalları ----------------
    static void kanallar(Context c, JSONObject plan) {
        if (Build.VERSION.SDK_INT < 26) return;
        JSONObject ad = plan == null ? null : plan.optJSONObject("kanallar");
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        NotificationChannel vakit = new NotificationChannel(KANAL_VAKIT, adi(ad, "vakit", c.getString(R.string.kanal_vakit)), NotificationManager.IMPORTANCE_HIGH);
        // normal önem (sessiz bildirimlerin simgesi üst çubukta gizlenebiliyor) ama ses ve titreşim yok
        NotificationChannel sayac = new NotificationChannel(KANAL_SAYAC, adi(ad, "sayac", c.getString(R.string.kanal_sayac)), NotificationManager.IMPORTANCE_DEFAULT);
        sayac.setShowBadge(false);
        sayac.setSound(null, null);
        sayac.enableVibration(false);
        nm.deleteNotificationChannel(ESKI_KANAL_SAYAC);
        NotificationChannel sessiz = new NotificationChannel(KANAL_SESSIZ, adi(ad, "sessiz", c.getString(R.string.kanal_sessiz)), NotificationManager.IMPORTANCE_LOW);
        sessiz.setShowBadge(false);
        // vakit girince ezan (kullanıcı isteği, 08-11-2026): her ses kendi kanalında; ses dosyası res/raw içinde.
        // Bildirim kalkınca (dokununca, kaydırınca veya panel sessizce yenilenince) ezan da durur.
        NotificationChannel ezanKisa = ezanKanali(c, PlanMantigi.KANAL_EZAN_KISA, adi(ad, "ezanKisa", c.getString(R.string.kanal_ezan_kisa)), "ezan_kisa");
        NotificationChannel ezanUzun = ezanKanali(c, PlanMantigi.KANAL_EZAN_UZUN, adi(ad, "ezanUzun", c.getString(R.string.kanal_ezan_uzun)), "ezan_uzun");
        // aynı kimlikle yeniden oluşturmak sadece adı günceller (kullanıcının seçtiği ses vb. korunur)
        nm.createNotificationChannel(vakit);
        nm.createNotificationChannel(sayac);
        nm.createNotificationChannel(sessiz);
        nm.createNotificationChannel(ezanKisa);
        nm.createNotificationChannel(ezanUzun);
    }

    private static NotificationChannel ezanKanali(Context c, String kimlik, String ad, String dosya) {
        NotificationChannel k = new NotificationChannel(kimlik, ad, NotificationManager.IMPORTANCE_HIGH);
        Uri ses = Uri.parse("android.resource://" + c.getPackageName() + "/raw/" + dosya);
        k.setSound(ses, new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build());
        k.enableVibration(true);
        return k;
    }

    private static String adi(JSONObject ad, String k, String yedek) {
        String s = ad == null ? null : ad.optString(k, null);
        return s == null || s.isEmpty() ? yedek : s;
    }

    /** Son vakit uyarısı, hâlâ gösterilecekse (UYARI_SURE içinde). */
    private static JSONObject uyari(SharedPreferences p, long simdi) {
        try {
            String s = p.getString(K_UYARI, null);
            if (s == null) return null;
            JSONObject u = new JSONObject(s);
            long an = u.optLong("an");
            return an <= simdi && simdi - an < UYARI_SURE ? u : null;
        } catch (JSONException e) {
            return null;
        }
    }

    static PendingIntent acilis(Context c) {
        Intent i = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static boolean bildirimIzni(Context c) {
        return NotificationManagerCompat.from(c).areNotificationsEnabled();
    }

    // ---------------- namaz vakti bildirimi ----------------
    /**
     * Aynı etiket (aynı vakit) birbirinin yerini alır: "15 dk kala"nın yerine "vakit girdi" (yine ses çıkar).
     * ses: "ezan-kisa" / "ezan-uzun" ise ezan kanalından (PlanMantigi.kanal), yoksa telefonun bildirim sesi.
     */
    @SuppressWarnings("MissingPermission")
    static void bildirimGoster(Context c, String etiket, String baslik, String govde, String ses) {
        if (!bildirimIzni(c)) return;
        kanallar(c, planOku(depo(c)));
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, PlanMantigi.kanal(ses))
            .setSmallIcon(R.drawable.ic_stat_cami)
            .setColor(ContextCompat.getColor(c, R.color.cami_lacivert))
            .setContentTitle(baslik)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setGroup(GRUP_VAKIT)
            .setContentIntent(acilis(c));
        if (govde != null && !govde.isEmpty()) b.setContentText(govde);
        // önceki vakitlerin bildirimleri kalkar: bildirim listesinde sadece en son vakit durur
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        for (StatusBarNotification s : nm.getActiveNotifications()) {
            if (s.getId() == ID_BILDIRIM && s.getTag() != null && !s.getTag().equals(etiket)) nm.cancel(s.getTag(), ID_BILDIRIM);
        }
        NotificationManagerCompat.from(c).notify(etiket, ID_BILDIRIM, b.build());
    }

    // ---------------- bildirim panelindeki vakit tablosu ----------------
    private static final int[] AD = { R.id.v0_ad, R.id.v1_ad, R.id.v2_ad, R.id.v3_ad, R.id.v4_ad, R.id.v5_ad, R.id.v6_ad };
    private static final int[] SAAT = { R.id.v0_saat, R.id.v1_saat, R.id.v2_saat, R.id.v3_saat, R.id.v4_saat, R.id.v5_saat, R.id.v6_saat };

    /** Panel açıksa sessiz notu ayrıca gösterilmez: tablonun üst satırında durur. */
    private static boolean panelAcik(Context c, JSONObject plan) {
        return plan.optBoolean("sayac") && bildirimIzni(c);
    }

    @SuppressWarnings("MissingPermission")
    private static void sayacGoster(Context c, JSONObject plan, long simdi, boolean uyar) {
        NotificationManagerCompat nm = NotificationManagerCompat.from(c);
        JSONObject v = panelAcik(c, plan) ? PlanMantigi.sonrakiVakit(plan, simdi) : null;
        if (v == null) {
            nm.cancel(ID_SAYAC);
            return;
        }
        long an = v.optLong("an");
        JSONObject gun = PlanMantigi.tabloGunu(plan, an);
        // vakit uyarısı (vakit girdi / X dk kala): 15 dk boyunca üst satırda; ilk gönderimde sesli
        JSONObject u = uyari(depo(c), simdi);
        String uyariYazi = u == null ? null : u.optString("baslik");
        // kapalı ve açık halde aynı düzen (üst satır, çizgi, 7 sütun: ad + saat); açık hali daha büyük yazılı
        RemoteViews kucuk = tablo(c, plan, v, gun, simdi, R.layout.bildirim_vakitler_kucuk, uyariYazi);
        RemoteViews buyuk = tablo(c, plan, v, gun, simdi, R.layout.bildirim_vakitler, uyariYazi);
        // panel açıkken ayrı vakit bildirimleri kalmasın (deneme bildirimi hariç)
        NotificationManager nmx = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        for (StatusBarNotification s : nmx.getActiveNotifications()) {
            if (s.getId() == ID_BILDIRIM && s.getTag() != null && !"deneme".equals(s.getTag())) nmx.cancel(s.getTag(), ID_BILDIRIM);
        }
        boolean sesli = uyar && u != null;
        // vakte 30 dk kala: üst çubuktaki cami simgesinin içinde kalan dakika
        int dk = PlanMantigi.simgeDakikasi(an, simdi);
        // sesli uyarı vakit bildiriminin sesiyle (ezan seçildiyse ezan); sonraki sessiz yenileme sesi durdurur
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, sesli ? PlanMantigi.kanal(u.optString("ses")) : KANAL_SAYAC)
            .setColor(ContextCompat.getColor(c, R.color.cami_yesil))
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(kucuk)
            .setCustomBigContentView(buyuk)
            // kilit ekranı, açılır bildirim ve erişilebilirlik için düz yazı da
            .setContentTitle(sesli ? u.optString("baslik") : v.optString("baslik"))
            .setContentText(sesli ? u.optString("govde") : plan.optString("sayacAlt"))
            .setShowWhen(false)
            .setOngoing(true)
            .setOnlyAlertOnce(!sesli)
            .setSilent(!sesli)
            .setPriority(sesli ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setGroup(GRUP_PANEL)
            .setSortKey("0")
            .setContentIntent(acilis(c));
        if (dk > 0) b.setSmallIcon(IconCompat.createWithBitmap(CamiSimgesi.ciz(dk)));
        else b.setSmallIcon(R.drawable.ic_stat_cami);
        nm.notify(ID_SAYAC, b.build());
    }

    /** Tablo: üst satırda hicri tarih (sessizken "Op stil tot 07:10") ve "Öğle'ye 1:23:45"; altta günün 7 vakti, sıradaki kırmızı. */
    private static RemoteViews tablo(Context c, JSONObject plan, JSONObject v, JSONObject gun, long simdi, int duzen, String uyariYazi) {
        long an = v.optLong("an");
        RemoteViews rv = new RemoteViews(c.getPackageName(), duzen);
        String sol = gun == null ? "" : gun.optString("hicri");
        JSONObject sessiz = PlanMantigi.aktifSessiz(plan, simdi);
        if (sessiz != null && depo(c).contains(K_SESSIZ)) sol = "\uD83D\uDD15 " + sessiz.optString("kisa");
        if (uyariYazi != null && !uyariYazi.isEmpty()) sol = uyariYazi;
        rv.setTextViewText(R.id.ust_sol, sol);
        JSONObject kalan = plan.optJSONObject("kalanKisa");
        rv.setTextViewText(R.id.kalan_etiket, kalan == null ? "" : kalan.optString(v.optString("vakit")));
        rv.setChronometer(R.id.kalan_sayac, SystemClock.elapsedRealtime() + (an - System.currentTimeMillis()), null, true);
        if (Build.VERSION.SDK_INT >= 24) rv.setChronometerCountDown(R.id.kalan_sayac, true);
        JSONArray liste = gun == null ? null : gun.optJSONArray("vakitler");
        int vurgu = ContextCompat.getColor(c, R.color.cami_kirmizi);
        for (int i = 0; i < SAAT.length; i++) {
            JSONObject x = liste == null ? null : liste.optJSONObject(i);
            boolean sirada = x != null && x.optLong("an") == an;
            rv.setTextViewText(SAAT[i], x == null ? "" : sirada ? kalin(x.optString("saat")) : x.optString("saat"));
            rv.setTextViewText(AD[i], x == null ? "" : sirada ? kalin(x.optString("ad")) : x.optString("ad"));
            if (sirada) {
                rv.setTextColor(SAAT[i], vurgu);
                rv.setTextColor(AD[i], vurgu);
            }
        }
        return rv;
    }

    /** Sıradaki vakit tabloda kalın (ve kırmızı). */
    private static CharSequence kalin(String s) {
        SpannableString k = new SpannableString(s);
        k.setSpan(new StyleSpan(Typeface.BOLD), 0, s.length(), 0);
        return k;
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
            sessizSonYaz(c, donem.optLong("bas"), yeni.optString("sonuc"));
            if (!yeni.has("kurulan")) return;
            try {
                yeni.put("bit", donem.optLong("bit"));
            } catch (JSONException e) { /* */ }
            p.edit().putString(K_SESSIZ, yeni.toString()).apply();
            sessizNotu(c, plan, donem, yeni.optInt("kurulan"));
        }
    }

    /**
     * Telefonu sessize (veya titreşime) alır; zaten sessizse dokunmaz.
     * Döner: { sonuc, eski?, kurulan? }; "kurulan" sadece telefonun ayarı değiştiyse vardır.
     * sonuc: sessiz | titresim | titresimIzinYok | zatenSessiz | zatenTitresim | rahatsizEtmeyin | izinYok
     */
    private static JSONObject sessizBaslat(Context c, String mod) {
        AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        JSONObject d = new JSONObject();
        int eski = am.getRingerMode();
        if (eski == AudioManager.RINGER_MODE_SILENT) return sonuc(d, "zatenSessiz");
        // kullanıcı zaten "Rahatsız Etmeyin"deyse (veya bir mod açıksa) dokunma
        if (nm.getCurrentInterruptionFilter() > NotificationManager.INTERRUPTION_FILTER_ALL) return sonuc(d, "rahatsizEtmeyin");
        int hedef = "titresim".equals(mod) ? AudioManager.RINGER_MODE_VIBRATE : AudioManager.RINGER_MODE_SILENT;
        // "Rahatsız Etmeyin" erişimi yoksa sessiz yapılamaz: titreşim
        boolean izinYok = hedef == AudioManager.RINGER_MODE_SILENT && !nm.isNotificationPolicyAccessGranted();
        if (izinYok) hedef = AudioManager.RINGER_MODE_VIBRATE;
        if (eski == hedef) return sonuc(d, "zatenTitresim");
        try {
            am.setRingerMode(hedef);
        } catch (SecurityException e) {
            if (hedef != AudioManager.RINGER_MODE_SILENT) return sonuc(d, "izinYok");
            try {
                am.setRingerMode(AudioManager.RINGER_MODE_VIBRATE);
                izinYok = true;
            } catch (SecurityException e2) {
                return sonuc(d, "izinYok");
            }
        }
        int kurulan = am.getRingerMode();
        if (kurulan == eski) return sonuc(d, "izinYok");          // telefon (üretici) değişikliği kabul etmedi
        try {
            d.put("eski", eski);
            d.put("kurulan", kurulan);
        } catch (JSONException e) { /* */ }
        return sonuc(d, kurulan == AudioManager.RINGER_MODE_SILENT ? "sessiz" : izinYok ? "titresimIzinYok" : "titresim");
    }

    private static JSONObject sonuc(JSONObject d, String s) {
        try {
            d.put("sonuc", s);
        } catch (JSONException e) { /* */ }
        return d;
    }

    private static void sessizSonYaz(Context c, long an, String sonuc) {
        JSONObject o = new JSONObject();
        try {
            o.put("an", an);
            o.put("sonuc", sonuc);
        } catch (JSONException e) { /* */ }
        depo(c).edit().putString(K_SESSIZ_SON, o.toString()).apply();
    }

    /** Son sessize alma denemesi: { an, sonuc } veya null. */
    static JSONObject sessizSon(Context c) {
        try {
            String s = depo(c).getString(K_SESSIZ_SON, null);
            return s == null ? null : new JSONObject(s);
        } catch (JSONException e) {
            return null;
        }
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
        if (panelAcik(c, plan)) {
            // panel açık: not tablonun üst satırında (tek bildirim)
            NotificationManagerCompat.from(c).cancel(ID_SESSIZ);
            return;
        }
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
            .setGroup(GRUP_SESSIZ)
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
