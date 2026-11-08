package nl.suleymaniyecamii.namaz;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Planın saf mantığı (Android'e bağlı değil; app/src/test'te denenir).
 * Plan biçimi: mobil/yerel-plan.js → { sayac, vakitler[{an, vakit, baslik}], bildirimler[{an, etiket, baslik, govde, ses?}],
 * sessiz[{bas, bit, baslik, govde}], sessizMod, sayacAlt, kanallar }. Zamanlar epoch ms.
 */
final class PlanMantigi {

    /** Bundan geç kalan bildirim gösterilmez (sunucudaki gibi: telefon kapalıydı, saatler sonra açıldı vb.). */
    static final long GEC_SINIR = 10 * 60_000L;
    /** Vakte bu kadar kala üst çubuktaki cami simgesinde kalan dakika görünür (kullanıcı isteği, 07-11-2026). */
    static final long SIMGE_PENCERE = 30 * 60_000L;

    /** Vakit bildirimi kanalı; her ezan kaydı kendi kanalında (Android'de kanalın sesi sonradan değişmez). */
    static final String KANAL_VAKIT = "vakit";

    private PlanMantigi() {}

    /**
     * Bildirimin "ses" alanına göre kanal (kullanıcı isteği, 08-11-2026): "ezan-3" → "vakit_ezan_3" (res/raw/ezan_3);
     * yoksa veya bilinmiyorsa telefonun bildirim sesi.
     */
    static String kanal(String ses) {
        return ses != null && ses.matches("ezan-[1-9][0-9]?") ? "vakit_ezan_" + ses.substring(5) : KANAL_VAKIT;
    }

    /**
     * (son, simdi] aralığında vakti gelen bildirimler. Aynı etiketten (aynı vakit) sadece en sonuncusu:
     * "15 dk kala" ile "vakit girdi" birlikte gecikmişse sadece "vakit girdi".
     */
    static List<JSONObject> vaktiGelenBildirimler(JSONObject plan, long son, long simdi) {
        Map<String, JSONObject> secilen = new LinkedHashMap<>();
        JSONArray b = plan.optJSONArray("bildirimler");
        if (b == null) return new ArrayList<>();
        for (int i = 0; i < b.length(); i++) {
            JSONObject o = b.optJSONObject(i);
            if (o == null) continue;
            long an = o.optLong("an");
            if (an > son && an <= simdi && simdi - an <= GEC_SINIR) {
                String etiket = o.optString("etiket", "");
                secilen.remove(etiket);
                secilen.put(etiket, o);
            }
        }
        return new ArrayList<>(secilen.values());
    }

    /** Geri sayımın gösterdiği vakit: şimdiden sonraki ilk vakit (yoksa null). */
    static JSONObject sonrakiVakit(JSONObject plan, long simdi) {
        JSONArray v = plan.optJSONArray("vakitler");
        if (v == null) return null;
        JSONObject en = null;
        for (int i = 0; i < v.length(); i++) {
            JSONObject o = v.optJSONObject(i);
            if (o == null) continue;
            long an = o.optLong("an");
            if (an > simdi && (en == null || an < en.optLong("an"))) en = o;
        }
        return en;
    }

    /** Simgede gösterilecek dakika (1–30); vakte 30 dakikadan fazla varsa 0 (düz cami simgesi). */
    static int simgeDakikasi(long an, long simdi) {
        long kalan = an - simdi;
        if (kalan <= 0 || kalan > SIMGE_PENCERE) return 0;
        return (int) ((kalan + 59_999) / 60_000);
    }

    /** Bildirim panelindeki tablo: bu vakti içeren gün (plan.gunler), yoksa null. */
    static JSONObject tabloGunu(JSONObject plan, long an) {
        JSONArray g = plan.optJSONArray("gunler");
        if (g == null) return null;
        for (int i = 0; i < g.length(); i++) {
            JSONObject gun = g.optJSONObject(i);
            JSONArray v = gun == null ? null : gun.optJSONArray("vakitler");
            if (v == null) continue;
            for (int j = 0; j < v.length(); j++) {
                JSONObject x = v.optJSONObject(j);
                if (x != null && x.optLong("an") == an) return gun;
            }
        }
        return null;
    }

    /** Şu an içinde bulunulan sessiz dönem (yoksa null). */
    static JSONObject aktifSessiz(JSONObject plan, long simdi) {
        JSONArray s = plan.optJSONArray("sessiz");
        if (s == null) return null;
        for (int i = 0; i < s.length(); i++) {
            JSONObject o = s.optJSONObject(i);
            if (o != null && o.optLong("bas") <= simdi && simdi < o.optLong("bit")) return o;
        }
        return null;
    }

    /**
     * Sessiz dönem bu çalıştırmada mı başladı? Sadece başlangıç anı geçilince sessize alınır:
     * kullanıcı dönemin ortasında ayarı açarsa veya uygulamayı açarsa telefon birden susmaz.
     */
    static boolean yeniBasladi(JSONObject donem, long son, long simdi) {
        long bas = donem.optLong("bas");
        return bas > son && bas <= simdi;
    }

    /** Bir sonraki alarm: bildirim, sessiz başlangıç/bitiş, geri sayımın sıradaki vakti (açıksa). Yoksa 0. */
    static long sonrakiAlarm(JSONObject plan, long simdi) {
        long en = Long.MAX_VALUE;
        JSONArray b = plan.optJSONArray("bildirimler");
        if (b != null) for (int i = 0; i < b.length(); i++) {
            long an = b.optJSONObject(i) == null ? 0 : b.optJSONObject(i).optLong("an");
            if (an > simdi) en = Math.min(en, an);
        }
        JSONArray s = plan.optJSONArray("sessiz");
        if (s != null) for (int i = 0; i < s.length(); i++) {
            JSONObject o = s.optJSONObject(i);
            if (o == null) continue;
            if (o.optLong("bas") > simdi) en = Math.min(en, o.optLong("bas"));
            if (o.optLong("bit") > simdi) en = Math.min(en, o.optLong("bit"));
        }
        if (plan.optBoolean("sayac")) {
            JSONObject v = sonrakiVakit(plan, simdi);
            if (v != null) {
                long an = v.optLong("an");
                en = Math.min(en, an);
                // simgedeki dakika: pencere başlangıcı ve pencerede her dakika değişimi
                int dk = simgeDakikasi(an, simdi);
                long degisim = dk > 0 ? an - (long) (dk - 1) * 60_000 : an - SIMGE_PENCERE;
                if (degisim > simdi) en = Math.min(en, degisim);
            }
        }
        return en == Long.MAX_VALUE ? 0 : en;
    }
}
