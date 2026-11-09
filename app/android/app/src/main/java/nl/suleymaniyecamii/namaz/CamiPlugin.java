package nl.suleymaniyecamii.namaz;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.Window;
import androidx.activity.OnBackPressedCallback;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Uygulama (mobil/yerel.js) ile telefon arasındaki köprü.
 * Asıl iş Planlayici'de: uygulama kapalıyken de alarmlarla çalışır.
 */
@CapacitorPlugin(
    name = "Cami",
    permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "bildirim") }
)
public class CamiPlugin extends Plugin {

    private Boolean koyu = null;
    private int zemin = Color.parseColor("#F6F1E7");
    private MediaPlayer dinleme;
    private PluginCall dinlemeCagri;

    /** Tam ekran tema önizlemesi açıkken geri tuşu uygulamadan çıkmasın, önizlemeyi kapatsın (mobil/tema-onizleme.js). */
    private final OnBackPressedCallback geri = new OnBackPressedCallback(false) {
        @Override
        public void handleOnBackPressed() {
            getBridge().triggerDocumentJSEvent("camiGeri");
        }
    };

    @Override
    public void load() {
        Planlayici.calistir(getContext());
        getActivity().getOnBackPressedDispatcher().addCallback(getActivity(), geri);
    }

    /** Uygulamanın hesapladığı plan (mobil/yerel-plan.js). Eskisinin yerine geçer. */
    @PluginMethod
    public void planKur(PluginCall call) {
        JSObject plan = call.getObject("plan");
        if (plan == null) {
            call.reject("plan yok");
            return;
        }
        Planlayici.planKaydet(getContext(), plan.toString());
        call.resolve();
    }

    @PluginMethod
    public void izinDurumu(PluginCall call) {
        call.resolve(izinler());
    }

    @PluginMethod
    public void bildirimIzniIste(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("bildirim") != PermissionState.GRANTED) {
            requestPermissionForAlias("bildirim", call, "bildirimIzniSonucu");
            return;
        }
        call.resolve(izinler());
    }

    @PermissionCallback
    private void bildirimIzniSonucu(PluginCall call) {
        Planlayici.calistir(getContext());
        call.resolve(izinler());
    }

    /** Ayarlar'daki "Deneme bildirimi": hemen, namaz vakti bildirimleriyle aynı kanaldan (seçilen sesle: ezan dinlenebilir). */
    @PluginMethod
    public void deneme(PluginCall call) {
        Planlayici.bildirimGoster(getContext(), "deneme", call.getString("baslik", ""), call.getString("govde", ""), call.getString("ses", ""));
        call.resolve();
    }

    /**
     * Ayarlar'daki ▶: sesi seçmeden önce dinlemek. Ses bitince veya durdurulunca cevap verir.
     * Medya sesiyle çalar: telefon sessizdeyken de duyulur, ses tuşları çalışır.
     */
    @PluginMethod
    public synchronized void sesDinle(PluginCall call) {
        dinlemeBitir();
        String ses = call.getString("ses", "telefon");
        Uri adres = "telefon".equals(ses) ? Settings.System.DEFAULT_NOTIFICATION_URI : Planlayici.ezanAdresi(getContext(), ses);
        if (adres == null) {
            call.reject("ses yok");
            return;
        }
        MediaPlayer mp = new MediaPlayer();
        try {
            mp.setAudioAttributes(
                new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build()
            );
            mp.setDataSource(getContext(), adres);
        } catch (Exception e) {
            mp.release();
            call.reject("ses açılamadı");
            return;
        }
        mp.setOnPreparedListener(MediaPlayer::start);
        mp.setOnCompletionListener(this::dinlemeSonu);
        mp.setOnErrorListener((m, a, b) -> {
            dinlemeSonu(m);
            return true;
        });
        dinleme = mp;
        dinlemeCagri = call;
        mp.prepareAsync();
    }

    @PluginMethod
    public synchronized void sesDurdur(PluginCall call) {
        dinlemeBitir();
        call.resolve();
    }

    private synchronized void dinlemeSonu(MediaPlayer m) {
        if (m == dinleme) dinlemeBitir();
    }

    private synchronized void dinlemeBitir() {
        if (dinleme != null) {
            try {
                dinleme.stop();
            } catch (IllegalStateException e) {
                // henüz başlamamıştı
            }
            dinleme.release();
            dinleme = null;
        }
        if (dinlemeCagri != null) {
            dinlemeCagri.resolve();
            dinlemeCagri = null;
        }
    }

    /** Tema önizlemesi açılınca { acik: true }, kapanınca { acik: false }. */
    @PluginMethod
    public void geriYakala(PluginCall call) {
        boolean acik = call.getBoolean("acik", false);
        getActivity().runOnUiThread(() -> {
            geri.setEnabled(acik);
            call.resolve();
        });
    }

    /** Üst ve alt sistem çubuğu uygulamanın temasına göre (açık temada koyu simgeler, koyu temada açık). */
    @PluginMethod
    public void cubuklar(PluginCall call) {
        koyu = call.getBoolean("koyu", false);
        try {
            zemin = Color.parseColor(call.getString("zemin", ""));
        } catch (IllegalArgumentException e) {
            zemin = Color.parseColor(koyu ? "#0C1834" : "#F6F1E7");
        }
        getActivity().runOnUiThread(() -> {
            cubuklariUygula();
            call.resolve();
        });
    }

    /** "Rahatsız Etmeyin" erişimi: telefonu sessize alabilmek için (kullanıcı telefonun ayarlarında verir). */
    @PluginMethod
    public void sessizIzniAc(PluginCall call) {
        ac(new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS));
        call.resolve();
    }

    /** "Alarmlar ve hatırlatıcılar" (Android 12+): her şey tam zamanında olsun. */
    @PluginMethod
    public void tamAlarmIzniAc(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 31) {
            ac(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getContext().getPackageName())));
        }
        call.resolve();
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        // telefonun ayarlarından dönünce (izinler) ve uzun aradan sonra: geri sayım ve alarm güncel olsun
        Planlayici.calistir(getContext());
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        dinlemeBitir();                 // uygulamadan çıkınca dinleme susar
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        super.handleOnConfigurationChanged(newConfig);
        // SystemBars (Capacitor) döndürmede kendi stilini geri koyar; bizimki sonra gelir
        cubuklariUygula();
    }

    private void ac(Intent i) {
        try {
            getActivity().startActivity(i);
        } catch (Exception e) {
            // bazı telefonlarda bu sayfa yok: uygulamanın kendi ayar sayfası
            getActivity().startActivity(
                new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()))
            );
        }
    }

    private JSObject izinler() {
        Context c = getContext();
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        JSObject r = new JSObject();
        String bildirim;
        if (NotificationManagerCompat.from(c).areNotificationsEnabled()) {
            bildirim = "granted";
        } else if (Build.VERSION.SDK_INT >= 33 && getPermissionState("bildirim") != PermissionState.DENIED) {
            bildirim = "prompt";
        } else {
            bildirim = "denied";
        }
        r.put("bildirim", bildirim);
        r.put("tamAlarm", Planlayici.tamAlarmVar(c));
        r.put("sessiz", nm.isNotificationPolicyAccessGranted());
        // son sessize alma denemesi (Ayarlar'da "Son: 06:41 · telefon sessize alındı")
        org.json.JSONObject son = Planlayici.sessizSon(c);
        if (son != null) {
            JSObject s = new JSObject();
            s.put("an", son.optLong("an"));
            s.put("sonuc", son.optString("sonuc"));
            r.put("sessizSon", s);
        }
        return r;
    }

    @SuppressWarnings("deprecation")
    private void cubuklariUygula() {
        if (koyu == null || getActivity() == null) return;
        Window w = getActivity().getWindow();
        WindowInsetsControllerCompat ic = WindowCompat.getInsetsController(w, w.getDecorView());
        ic.setAppearanceLightStatusBars(!koyu);
        ic.setAppearanceLightNavigationBars(!koyu);
        w.getDecorView().setBackgroundColor(zemin);
        if (Build.VERSION.SDK_INT >= 29) {
            // 3 düğmeli gezinmede sistem yarı saydam perde koymasın: çubuk tam uygulamanın renginde
            w.setNavigationBarContrastEnforced(false);
            w.setStatusBarContrastEnforced(false);
        }
        if (Build.VERSION.SDK_INT < 35) {
            w.setNavigationBarColor(zemin);
            w.setStatusBarColor(zemin);
        }
    }
}
