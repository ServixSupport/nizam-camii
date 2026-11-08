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
    public void kanal_sesSecimineGore() {
        assertEquals("vakit_ezan_1", PlanMantigi.kanal("ezan-1"));
        assertEquals("vakit_ezan_7", PlanMantigi.kanal("ezan-7"));
        assertEquals("vakit", PlanMantigi.kanal("ezan-kisa"));
        assertEquals("vakit", PlanMantigi.kanal(""));
        assertEquals("vakit", PlanMantigi.kanal(null));
        assertEquals("vakit", PlanMantigi.kanal("telefon"));
        assertEquals("vakit", PlanMantigi.kanal("bilinmeyen"));
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
        assertEquals(T + 1 * DK, PlanMantigi.sonrakiAlarm(p, T));                    // simgede 30 → 29 dk
        assertEquals(T + 16 * DK, PlanMantigi.sonrakiAlarm(p, T + 15 * DK));
        assertEquals(T + 60 * DK, PlanMantigi.sonrakiAlarm(p, T + 30 * DK));         // sessiz bitişi
        assertEquals(T + 90 * DK, PlanMantigi.sonrakiAlarm(p, T + 60 * DK));         // Yatsı'ya 30 dk kala simge
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

    @Test
    public void simge_vakte30DakikaKalaDakikaGosterir_herDakikaGuncellenir() throws Exception {
        long an = T + 120 * DK;                                         // Yatsı
        assertEquals(0, PlanMantigi.simgeDakikasi(an, an - 31 * DK));
        assertEquals(30, PlanMantigi.simgeDakikasi(an, an - 30 * DK));
        assertEquals(30, PlanMantigi.simgeDakikasi(an, an - 29 * DK - 1));
        assertEquals(1, PlanMantigi.simgeDakikasi(an, an - 1));
        assertEquals(0, PlanMantigi.simgeDakikasi(an, an));
        JSONObject p = plan(true);
        // Akşam (T+30) geçti, sıradaki Yatsı: önce pencere başlangıcı, sonra her dakika
        assertEquals(an - 30 * DK, PlanMantigi.sonrakiAlarm(p, T + 61 * DK));
        assertEquals(an - 29 * DK, PlanMantigi.sonrakiAlarm(p, an - 30 * DK));
        assertEquals(an - 9 * DK, PlanMantigi.sonrakiAlarm(p, an - 9 * DK - 30_000));
        assertEquals(an, PlanMantigi.sonrakiAlarm(p, an - 30_000));
    }

    @Test
    public void tabloGunu_vaktiIcerenGun() throws Exception {
        JSONObject p = new JSONObject("{\"gunler\":[{\"ymd\":\"a\",\"vakitler\":[{\"an\":1},{\"an\":2}]},"
            + "{\"ymd\":\"b\",\"vakitler\":[{\"an\":3}]}]}");
        assertEquals("b", PlanMantigi.tabloGunu(p, 3).getString("ymd"));
        assertEquals("a", PlanMantigi.tabloGunu(p, 2).getString("ymd"));
        assertNull(PlanMantigi.tabloGunu(p, 9));
    }
}
