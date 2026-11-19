package nl.suleymaniyecamii.namaz;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.widget.RemoteViews;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Ana ekran widget'ları (kullanıcı isteği, 19-11-2026):
 *  - küçük (2×2): sıradaki vakit, saati, kalan süre
 *  - satır (4×1): 7 vakit yan yana, sıradaki kapsülde
 *  - orta (4×2): tarih ve hicri, sıradaki vakit ve büyük geri sayım, sonraki iki vakit
 *  - liste (3×3): tarih ve hicri, 7 vakit alt alta, kalan süre
 * Her widget'ın arka planı (beyaz / siyah / saydam) ve yazı rengi ayrı seçilir (WidgetAyar).
 * Veriler Planlayici'nin planından (uygulama hesaplar); vakit girince Planlayici.calistir widget'ları yeniler.
 * Geri sayım Chronometer: telefon kendisi sayar, uygulama açık olmasa da.
 */
public abstract class VakitWidget extends AppWidgetProvider {

    static final String DEPO = "widget";
    static final String[] TURLER = { "kucuk", "satir", "orta", "liste" };
    static final Class<?>[] SINIFLAR = { WidgetKucuk.class, WidgetSatir.class, WidgetOrta.class, WidgetListe.class };

    /** Arka plan seçenekleri */
    static final String[] ZEMINLER = { "beyaz", "siyah", "saydam" };
    /** Yazı rengi: "oto" arka plana göre (beyazda koyu, diğerlerinde beyaz), diğerleri sabit renk */
    static final String[] YAZILAR = { "oto", "beyaz", "siyah", "altin", "yesil", "kirmizi", "mavi" };
    static final int[] YAZI_RENK = { 0, 0xFFFFFFFF, 0xFF1A1A1A, 0xFFE0B04A, 0xFF2E8B4A, 0xFFD13027, 0xFF2F6FD6 };

    private static final int[] H = { R.id.h0, R.id.h1, R.id.h2, R.id.h3, R.id.h4, R.id.h5, R.id.h6 };
    private static final int[] A = { R.id.a0, R.id.a1, R.id.a2, R.id.a3, R.id.a4, R.id.a5, R.id.a6 };
    private static final int[] S = { R.id.s0, R.id.s1, R.id.s2, R.id.s3, R.id.s4, R.id.s5, R.id.s6 };

    abstract String tur();

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        JSONObject plan = Planlayici.plan(c);
        long simdi = System.currentTimeMillis() + 1000;
        for (int id : ids) m.updateAppWidget(id, ciz(c, tur(), zemin(c, id), yazi(c, id), plan, simdi, true));
    }

    @Override
    public void onEnabled(Context c) {
        // ilk widget: vakit girince yenilensin (Planlayici alarmı widget varken her vakte kurulur)
        Planlayici.calistir(c);
    }

    @Override
    public void onDeleted(Context c, int[] ids) {
        SharedPreferences.Editor e = c.getSharedPreferences(DEPO, Context.MODE_PRIVATE).edit();
        for (int id : ids) e.remove("zemin_" + id).remove("yazi_" + id);
        e.apply();
    }

    /** Bütün widget'lar (plan değişince ve her vakitte; Planlayici.calistir). */
    static void hepsiniGuncelle(Context c, JSONObject plan, long simdi) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (int i = 0; i < SINIFLAR.length; i++) {
            for (int id : m.getAppWidgetIds(new ComponentName(c, SINIFLAR[i]))) {
                m.updateAppWidget(id, ciz(c, TURLER[i], zemin(c, id), yazi(c, id), plan, simdi, true));
            }
        }
    }

    /** Ana ekranda widget var mı? Varsa her vakitte alarm kurulur (geri sayım kapalı olsa da). */
    static boolean varMi(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (Class<?> k : SINIFLAR) {
            if (m.getAppWidgetIds(new ComponentName(c, k)).length > 0) return true;
        }
        return false;
    }

    /** Widget'ın türü, sağlayıcı sınıfından. */
    static String turu(Context c, int id) {
        AppWidgetProviderInfo b = AppWidgetManager.getInstance(c).getAppWidgetInfo(id);
        if (b != null) {
            for (int i = 0; i < SINIFLAR.length; i++) {
                if (SINIFLAR[i].getName().equals(b.provider.getClassName())) return TURLER[i];
            }
        }
        return "kucuk";
    }

    static String zemin(Context c, int id) {
        return c.getSharedPreferences(DEPO, Context.MODE_PRIVATE).getString("zemin_" + id, "siyah");
    }

    static String yazi(Context c, int id) {
        return c.getSharedPreferences(DEPO, Context.MODE_PRIVATE).getString("yazi_" + id, "oto");
    }

    // ---------------- renkler ----------------
    static int yaziRengi(String zemin, String yazi) {
        for (int i = 1; i < YAZILAR.length; i++) if (YAZILAR[i].equals(yazi)) return YAZI_RENK[i];
        return "beyaz".equals(zemin) ? 0xFF14233D : 0xFFFFFFFF;
    }

    private static int soluk(int renk) {
        return (renk & 0x00FFFFFF) | 0xB3000000;
    }

    /** Sıradaki vaktin kapsülü: beyaz zeminde kırmızı, diğerlerinde altın; yazı rengiyle aynıysa başka renk. */
    static String vurgu(String zemin, String yazi) {
        boolean beyaz = "beyaz".equals(zemin);
        String v = beyaz ? "kirmizi" : "altin";
        if (v.equals(yazi)) v = beyaz ? "yesil" : "kirmizi";
        return v;
    }

    private static int vurguZemini(String v) {
        if ("altin".equals(v)) return R.drawable.widget_vurgu_altin;
        if ("yesil".equals(v)) return R.drawable.widget_vurgu_yesil;
        return R.drawable.widget_vurgu_kirmizi;
    }

    private static int vurguYazisi(String v) {
        return "altin".equals(v) ? 0xFF1A1A1A : 0xFFFFFFFF;
    }

    private static int zeminResmi(String z) {
        if ("beyaz".equals(z)) return R.drawable.widget_zemin_beyaz;
        if ("saydam".equals(z)) return R.drawable.widget_zemin_saydam;
        return R.drawable.widget_zemin_siyah;
    }

    // ---------------- çizim ----------------
    /**
     * Widget görünümü. tikla: dokununca uygulama açılır (ayar ekranındaki önizlemede yok).
     * Uygulama hiç açılmadıysa (plan yok) "uygulamayı açın".
     */
    static RemoteViews ciz(Context c, String tur, String zemin, String yazi, JSONObject plan, long simdi, boolean tikla) {
        int metin = yaziRengi(zemin, yazi), ikinci = soluk(metin);
        String vk = vurgu(zemin, yazi);
        JSONObject v = plan == null ? null : PlanMantigi.sonrakiVakit(plan, simdi);
        JSONObject gun = v == null ? null : PlanMantigi.tabloGunu(plan, v.optLong("an"));
        JSONArray liste = gun == null ? null : gun.optJSONArray("vakitler");
        RemoteViews rv;
        if (liste == null || liste.length() < 7) {
            rv = new RemoteViews(c.getPackageName(), R.layout.widget_bos);
            rv.setTextViewText(R.id.bilgi, bosMetin(plan));
            rv.setTextColor(R.id.bilgi, metin);
            rv.setInt(R.id.simge, "setColorFilter", metin);
        } else {
            long an = v.optLong("an");
            int sira = 0;
            for (int i = 0; i < liste.length(); i++) if (liste.optJSONObject(i).optLong("an") == an) sira = i;
            JSONObject x = liste.optJSONObject(sira);
            String kalan = plan.optJSONObject("kalanKisa") == null ? "" : plan.optJSONObject("kalanKisa").optString(v.optString("vakit"));
            String dil = plan.optString("dil", "nl");
            switch (tur) {
                case "satir":
                    rv = new RemoteViews(c.getPackageName(), R.layout.widget_satir);
                    vakitler(rv, liste, sira, vk, ikinci, metin);
                    break;
                case "orta":
                    rv = new RemoteViews(c.getPackageName(), R.layout.widget_orta);
                    rv.setTextViewText(R.id.tarih, tarihYazi(gun.optString("ymd"), dil));
                    rv.setTextColor(R.id.tarih, metin);
                    rv.setTextViewText(R.id.hicri, gun.optString("hicri"));
                    rv.setTextColor(R.id.hicri, ikinci);
                    rv.setTextViewText(R.id.ad, x.optString("ad") + " · " + x.optString("saat"));
                    rv.setTextColor(R.id.ad, metin);
                    rv.setTextViewText(R.id.etiket, kalan);
                    rv.setTextColor(R.id.etiket, ikinci);
                    sayac(rv, R.id.sayac, an, metin);
                    // ondan sonraki iki vakit (ertesi güne geçebilir)
                    List<JSONObject> sonra = sonrakiler(plan, an, 2);
                    for (int i = 0; i < 2; i++) {
                        JSONObject y = i < sonra.size() ? sonra.get(i) : null;
                        rv.setTextViewText(A[i], y == null ? "" : y.optString("ad"));
                        rv.setTextViewText(S[i], y == null ? "" : y.optString("saat"));
                        rv.setTextColor(A[i], ikinci);
                        rv.setTextColor(S[i], metin);
                    }
                    rv.setInt(R.id.simge, "setColorFilter", metin);
                    break;
                case "liste":
                    rv = new RemoteViews(c.getPackageName(), R.layout.widget_liste);
                    rv.setTextViewText(R.id.tarih, tarihYazi(gun.optString("ymd"), dil));
                    rv.setTextColor(R.id.tarih, metin);
                    rv.setTextViewText(R.id.hicri, gun.optString("hicri"));
                    rv.setTextColor(R.id.hicri, ikinci);
                    vakitler(rv, liste, sira, vk, metin, metin);
                    rv.setTextViewText(R.id.etiket, kalan);
                    rv.setTextColor(R.id.etiket, ikinci);
                    sayac(rv, R.id.sayac, an, metin);
                    rv.setInt(R.id.simge, "setColorFilter", metin);
                    break;
                default:
                    rv = new RemoteViews(c.getPackageName(), R.layout.widget_kucuk);
                    rv.setTextViewText(R.id.ad, x.optString("ad"));
                    rv.setTextColor(R.id.ad, metin);
                    rv.setTextViewText(R.id.saat, x.optString("saat"));
                    rv.setTextColor(R.id.saat, metin);
                    rv.setTextViewText(R.id.etiket, kalan);
                    rv.setTextColor(R.id.etiket, ikinci);
                    sayac(rv, R.id.sayac, an, metin);
                    rv.setInt(R.id.simge, "setColorFilter", metin);
                    break;
            }
        }
        rv.setInt(android.R.id.background, "setBackgroundResource", zeminResmi(zemin));
        if (tikla) rv.setOnClickPendingIntent(android.R.id.background, Planlayici.acilis(c));
        return rv;
    }

    /** 7 vakit (satır ve liste): sıradaki kapsülde. */
    private static void vakitler(RemoteViews rv, JSONArray liste, int sira, String vk, int adRengi, int saatRengi) {
        for (int i = 0; i < H.length; i++) {
            JSONObject y = liste.optJSONObject(i);
            boolean bu = i == sira;
            rv.setTextViewText(A[i], y == null ? "" : y.optString("ad"));
            rv.setTextViewText(S[i], y == null ? "" : y.optString("saat"));
            rv.setInt(H[i], "setBackgroundResource", bu ? vurguZemini(vk) : 0);
            rv.setTextColor(A[i], bu ? vurguYazisi(vk) : adRengi);
            rv.setTextColor(S[i], bu ? vurguYazisi(vk) : saatRengi);
        }
    }

    private static void sayac(RemoteViews rv, int id, long an, int renk) {
        rv.setChronometer(id, SystemClock.elapsedRealtime() + (an - System.currentTimeMillis()), null, true);
        rv.setChronometerCountDown(id, true);
        rv.setTextColor(id, renk);
    }

    /** an'dan sonraki n vakit (plan.vakitler): { ad, saat } (ad bildirim panelindeki tablodan). */
    private static List<JSONObject> sonrakiler(JSONObject plan, long an, int n) {
        List<JSONObject> out = new ArrayList<>();
        long sinir = an;
        for (int k = 0; k < n; k++) {
            JSONObject v = PlanMantigi.sonrakiVakit(plan, sinir);
            if (v == null) break;
            sinir = v.optLong("an");
            JSONObject gun = PlanMantigi.tabloGunu(plan, sinir);
            JSONArray l = gun == null ? null : gun.optJSONArray("vakitler");
            JSONObject bulunan = null;
            for (int i = 0; l != null && i < l.length(); i++) if (l.optJSONObject(i).optLong("an") == sinir) bulunan = l.optJSONObject(i);
            if (bulunan != null) out.add(bulunan);
        }
        return out;
    }

    /** "Perşembe 19 Kasım" / "Donderdag 19 november" / "Thursday 19 November" */
    static String tarihYazi(String ymd, String dil) {
        try {
            SimpleDateFormat oku = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            oku.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date d = oku.parse(ymd);
            Locale l = Locale.forLanguageTag(dil);
            SimpleDateFormat yaz = new SimpleDateFormat("EEEE d MMMM", l);
            yaz.setTimeZone(TimeZone.getTimeZone("UTC"));
            String s = yaz.format(d);
            return s.isEmpty() ? s : s.substring(0, 1).toUpperCase(l) + s.substring(1);
        } catch (ParseException | NullPointerException e) {
            return "";
        }
    }

    private static String bosMetin(JSONObject plan) {
        String dil = plan != null ? plan.optString("dil", "") : Locale.getDefault().getLanguage();
        if ("tr".equals(dil)) return "Vakitler için uygulamayı açın";
        if ("nl".equals(dil)) return "Open de app voor de gebedstijden";
        return "Open the app to load the prayer times";
    }
}
