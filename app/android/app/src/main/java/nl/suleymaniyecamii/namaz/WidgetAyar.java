package nl.suleymaniyecamii.namaz;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.json.JSONObject;

/**
 * Widget ayarı (kullanıcı isteği, 19-11-2026): widget eklenince açılır; sonra widget'a uzun basıp "Ayarlar"la
 * (Android 12+) tekrar açılır. Arka plan (beyaz / siyah / saydam) ve yazı rengi seçilir; önizleme widget'ın kendisi.
 * Dil uygulamanın dili (plan), yoksa telefonun dili.
 */
public class WidgetAyar extends Activity {

    private static final int ZEMIN = 0xFFF6F1E7, YAZI = 0xFF14233D, SOLUK = 0xFF5B6478, LACIVERT = 0xFF14295A, CIZGI = 0xFFDCD3C2;

    private int id = AppWidgetManager.INVALID_APPWIDGET_ID;
    private String tur, zemin, yazi, dil;
    private FrameLayout onizleme;
    private TextView renkAdi;
    private final List<TextView> zeminDugmeleri = new ArrayList<>();
    private final List<View> renkDugmeleri = new ArrayList<>();

    @Override
    protected void onCreate(Bundle kayit) {
        super.onCreate(kayit);
        Bundle e = getIntent().getExtras();
        if (e != null) id = e.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        // vazgeçilirse widget eklenmez (ana ekran uygulaması kimliği sonuçta bekler)
        setResult(RESULT_CANCELED, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id));
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }
        tur = VakitWidget.turu(this, id);
        zemin = VakitWidget.zemin(this, id);
        yazi = VakitWidget.yazi(this, id);
        JSONObject plan = Planlayici.plan(this);
        dil = plan != null ? plan.optString("dil", "") : "";
        if (!dil.equals("tr") && !dil.equals("nl") && !dil.equals("en")) {
            String l = Locale.getDefault().getLanguage();
            dil = l.equals("tr") || l.equals("nl") ? l : "en";
        }
        setContentView(arayuz());
        // krem zeminde koyu sistem simgeleri
        androidx.core.view.WindowInsetsControllerCompat c = new androidx.core.view.WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        c.setAppearanceLightStatusBars(true);
        c.setAppearanceLightNavigationBars(true);
        ciz();
    }

    // ---------------- metinler ----------------
    private String t(String k) {
        String[] m;
        switch (k) {
            case "baslik": m = new String[] { "Widget ayarları", "Widget-instellingen", "Widget settings" }; break;
            case "zemin": m = new String[] { "Arka plan", "Achtergrond", "Background" }; break;
            case "beyaz": m = new String[] { "Beyaz", "Wit", "White" }; break;
            case "siyah": m = new String[] { "Siyah", "Zwart", "Black" }; break;
            case "saydam": m = new String[] { "Saydam", "Transparant", "Transparent" }; break;
            case "yazi": m = new String[] { "Yazı rengi", "Letterkleur", "Text colour" }; break;
            case "oto": m = new String[] { "Otomatik", "Automatisch", "Automatic" }; break;
            case "altin": m = new String[] { "Altın", "Goud", "Gold" }; break;
            case "yesil": m = new String[] { "Yeşil", "Groen", "Green" }; break;
            case "kirmizi": m = new String[] { "Kırmızı", "Rood", "Red" }; break;
            case "mavi": m = new String[] { "Mavi", "Blauw", "Blue" }; break;
            case "kaydet": m = new String[] { "Kaydet", "Opslaan", "Save" }; break;
            default: return k;
        }
        return m[dil.equals("tr") ? 0 : dil.equals("nl") ? 1 : 2];
    }

    // ---------------- arayüz ----------------
    private int dp(float v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }

    private TextView yazi(String s, float sp, int renk, boolean kalin) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(renk);
        if (kalin) t.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        return t;
    }

    private GradientDrawable sekil(int dolgu, int cizgi, float kose, int kalinlik) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(dolgu);
        g.setCornerRadius(dp(kose));
        if (kalinlik > 0) g.setStroke(dp(kalinlik), cizgi);
        return g;
    }

    private View arayuz() {
        ScrollView kaydir = new ScrollView(this);
        kaydir.setFitsSystemWindows(true);
        kaydir.setBackgroundColor(ZEMIN);
        LinearLayout kok = new LinearLayout(this);
        kok.setOrientation(LinearLayout.VERTICAL);
        kok.setPadding(dp(20), dp(20), dp(20), dp(28));
        kaydir.addView(kok);

        TextView baslik = yazi(t("baslik"), 24, YAZI, true);
        kok.addView(baslik);

        // önizleme: duvar kâğıdı gibi koyu-turkuaz zemin (saydam ve beyaz da görünsün)
        onizleme = new FrameLayout(this);
        GradientDrawable duvar = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { 0xFF4F8A9A, 0xFF1D3346 });
        duvar.setCornerRadius(dp(20));
        onizleme.setBackground(duvar);
        LinearLayout.LayoutParams op = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(boyut()[1] + 48));
        op.topMargin = dp(16);
        kok.addView(onizleme, op);

        kok.addView(bolumBasligi(t("zemin")));
        LinearLayout zeminler = new LinearLayout(this);
        zeminler.setOrientation(LinearLayout.HORIZONTAL);
        for (String z : VakitWidget.ZEMINLER) {
            TextView d = yazi(t(z), 15, YAZI, true);
            d.setGravity(Gravity.CENTER);
            d.setTag(z);
            d.setMinHeight(dp(48));
            d.setOnClickListener(v -> { zemin = (String) v.getTag(); ciz(); });
            LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, dp(48), 1);
            if (!zeminDugmeleri.isEmpty()) p.leftMargin = dp(8);
            zeminler.addView(d, p);
            zeminDugmeleri.add(d);
        }
        kok.addView(zeminler);

        kok.addView(bolumBasligi(t("yazi")));
        LinearLayout renkler = new LinearLayout(this);
        renkler.setOrientation(LinearLayout.HORIZONTAL);
        renkler.setGravity(Gravity.CENTER_VERTICAL);
        for (int i = 0; i < VakitWidget.YAZILAR.length; i++) {
            String y = VakitWidget.YAZILAR[i];
            TextView d = yazi(i == 0 ? "A" : "", 15, YAZI, true);
            d.setGravity(Gravity.CENTER);
            d.setTag(y);
            d.setContentDescription(t(y));
            d.setOnClickListener(v -> { yazi = (String) v.getTag(); ciz(); });
            LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, dp(44), 1);
            p.leftMargin = dp(3);
            p.rightMargin = dp(3);
            renkler.addView(d, p);
            renkDugmeleri.add(d);
        }
        kok.addView(renkler);
        renkAdi = yazi("", 13, SOLUK, false);
        renkAdi.setPadding(0, dp(6), 0, 0);
        kok.addView(renkAdi);

        TextView kaydet = yazi(t("kaydet"), 16, Color.WHITE, true);
        kaydet.setGravity(Gravity.CENTER);
        kaydet.setBackground(sekil(LACIVERT, 0, 14, 0));
        kaydet.setOnClickListener(v -> kaydet());
        LinearLayout.LayoutParams kp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(52));
        kp.topMargin = dp(28);
        kok.addView(kaydet, kp);
        return kaydir;
    }

    private TextView bolumBasligi(String s) {
        TextView t = yazi(s, 15, YAZI, true);
        t.setPadding(0, dp(22), 0, dp(10));
        return t;
    }

    /** Önizlemedeki widget'ın boyutu (dp): ana ekrandaki gibi. */
    private int[] boyut() {
        switch (tur) {
            case "satir": return new int[] { 320, 76 };
            case "orta": return new int[] { 320, 160 };
            case "liste": return new int[] { 240, 260 };
            default: return new int[] { 160, 160 };
        }
    }

    /** Önizleme ve seçili düğmeler. */
    private void ciz() {
        onizleme.removeAllViews();
        int[] b = boyut();
        View w = VakitWidget.ciz(this, tur, zemin, yazi, Planlayici.plan(this), System.currentTimeMillis() + 1000, false)
            .apply(getApplicationContext(), onizleme);
        w.setClickable(false);
        FrameLayout.LayoutParams p = new FrameLayout.LayoutParams(dp(Math.min(b[0], 330)), dp(b[1]), Gravity.CENTER);
        onizleme.addView(w, p);

        for (TextView d : zeminDugmeleri) {
            boolean secili = d.getTag().equals(zemin);
            d.setBackground(sekil(secili ? LACIVERT : Color.WHITE, CIZGI, 12, secili ? 0 : 1));
            d.setTextColor(secili ? Color.WHITE : YAZI);
            d.setSelected(secili);
        }
        for (int i = 0; i < renkDugmeleri.size(); i++) {
            View d = renkDugmeleri.get(i);
            String y = VakitWidget.YAZILAR[i];
            boolean secili = y.equals(yazi);
            int renk = i == 0 ? Color.WHITE : VakitWidget.YAZI_RENK[i];
            GradientDrawable g = new GradientDrawable();
            g.setShape(GradientDrawable.OVAL);
            g.setColor(renk);
            g.setStroke(dp(secili ? 3 : 1), secili ? LACIVERT : CIZGI);
            d.setBackground(g);
            d.setSelected(secili);
        }
        renkAdi.setText(t(yazi));
    }

    private void kaydet() {
        getSharedPreferences(VakitWidget.DEPO, MODE_PRIVATE).edit()
            .putString("zemin_" + id, zemin)
            .putString("yazi_" + id, yazi)
            .apply();
        // widget'ı yeniler; widget varken her vakitte alarm kurulur
        if (Planlayici.plan(this) != null) Planlayici.calistir(this);
        else VakitWidget.hepsiniGuncelle(this, null, System.currentTimeMillis());
        setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id));
        finish();
    }
}
