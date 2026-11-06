package nl.suleymaniyecamii.namaz;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.List;
import org.json.JSONObject;
import org.junit.Test;

public class PlanMantigiTest {

    private static final long DK = 60_000L;
    private static final long T = 1_800_000_000_000L;   // herhangi bir an

    private static JSONObject plan(boolean sayac) throws Exception {
        return new JSONObject(
            "{\"sayac\":" + sayac + "," +
            "\"vakitler\":[{\"an\":" + (T + 30 * DK) + ",\"vakit\":\"Maghrib\",\"baslik\":\"Maghrib · 17:27\"}," +
            "{\"an\":" + (T + 120 * DK) + ",\"vakit\":\"Isha\",\"baslik\":\"Isha · 18:57\"}]," +
            "\"bildirimler\":[{\"an\":" + (T + 15 * DK) + ",\"etiket\":\"m\",\"baslik\":\"15 dk kala\"}," +
            "{\"an\":" + (T + 30 * DK) + ",\"etiket\":\"m\",\"baslik\":\"girdi\"}]," +
            "\"sessiz\":[{\"bas\":" + (T + 30 * DK) + ",\"bit\":" + (T + 60 * DK) + "}]}"
        );
    }

    @Test
    public void vaktiGelenBildirim_sadeceAraliktakiler_ayniEtikettenSonuncusu() throws Exception {
        JSONObject p = plan(true);
        assertEquals(0, PlanMantigi.vaktiGelenBildirimler(p, T, T + 10 * DK).size());
        List<JSONObject> l = PlanMantigi.vaktiGelenBildirimler(p, T, T + 15 * DK);
        assertEquals(1, l.size());
        assertEquals("15 dk kala", l.get(0).getString("baslik"));
        // ikisi birden gecikmişse sadece "girdi"
        l = PlanMantigi.vaktiGelenBildirimler(p, T, T + 31 * DK);
        assertEquals(1, l.size());
        assertEquals("girdi", l.get(0).getString("baslik"));
        // 10 dakikadan geç: gösterilmez
        assertEquals(0, PlanMantigi.vaktiGelenBildirimler(p, T + 16 * DK, T + 41 * DK).size());
        // önceden işlenmiş olan tekrar gösterilmez
        assertEquals(0, PlanMantigi.vaktiGelenBildirimler(p, T + 30 * DK, T + 31 * DK).size());
    }

    @Test
    public void sonrakiVakit_veAlarm() throws Exception {
        JSONObject p = plan(true);
        assertEquals("Maghrib", PlanMantigi.sonrakiVakit(p, T).getString("vakit"));
        assertEquals("Isha", PlanMantigi.sonrakiVakit(p, T + 30 * DK).getString("vakit"));
        assertNull(PlanMantigi.sonrakiVakit(p, T + 200 * DK));
        assertEquals(T + 15 * DK, PlanMantigi.sonrakiAlarm(p, T));
        assertEquals(T + 30 * DK, PlanMantigi.sonrakiAlarm(p, T + 15 * DK));
        assertEquals(T + 60 * DK, PlanMantigi.sonrakiAlarm(p, T + 30 * DK));         // sessiz bitişi
        assertEquals(T + 120 * DK, PlanMantigi.sonrakiAlarm(p, T + 60 * DK));        // sayaç: Yatsı
        assertEquals(0, PlanMantigi.sonrakiAlarm(plan(false), T + 60 * DK));         // sayaç kapalı: alarm yok
    }

    @Test
    public void sessiz_sadeceBaslangicGecilinceBaslar() throws Exception {
        JSONObject p = plan(false);
        assertNull(PlanMantigi.aktifSessiz(p, T + 29 * DK));
        JSONObject d = PlanMantigi.aktifSessiz(p, T + 30 * DK);
        assertTrue(PlanMantigi.yeniBasladi(d, T + 29 * DK, T + 30 * DK));
        // dönemin ortasında açıldı (son = şimdi): birden susmaz
        assertFalse(PlanMantigi.yeniBasladi(PlanMantigi.aktifSessiz(p, T + 40 * DK), T + 40 * DK, T + 41 * DK));
        assertNull(PlanMantigi.aktifSessiz(p, T + 60 * DK));
    }
}
