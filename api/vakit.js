// Vercel serverless: Diyanet İşleri Başkanlığı "Awqat Salah" resmî namaz vakti API'si
//
// Kullanıcı adı ve şifre ASLA bu dosyada yazmaz — Vercel > Settings > Environment Variables:
//   DIYANET_EMAIL     = Diyanet'ten gelen kullanıcı adı (e-posta)
//   DIYANET_PASSWORD  = Diyanet'ten gelen şifre
//   DIYANET_CITY_ID   = şehir id'si (aşağıdaki yardımcı modla bir kez bulunur)
//
// ÖNEMLİ: Diyanet API'sinde her endpoint için istek limiti vardır (ilk 15 gün 100,
// sonrasında 5). Bu yüzden AYLIK veriyi tek istekte çekip uzun süre cache'liyoruz.
//
// Yardımcı modlar (şehir id'sini bulmak için, sadece birkaç kez kullan):
//   /api/vakit?ulkeler=1            -> ülke listesi
//   /api/vakit?eyaletler=<ulkeId>   -> o ülkenin eyalet/bölge listesi
//   /api/vakit?sehirler=<eyaletId>  -> o bölgenin şehir listesi  (Amsterdam'ın id'si burada)

const BASE = "https://awqatsalah.diyanet.gov.tr";

// sıcak lambda içinde token'ı sakla (token ömrü ~45 dk)
let _token = null;
let _tokenAt = 0;

async function login() {
  if (_token && Date.now() - _tokenAt < 35 * 60 * 1000) return _token;

  const email = process.env.DIYANET_EMAIL;
  const password = process.env.DIYANET_PASSWORD;
  if (!email || !password) throw new Error("DIYANET_EMAIL / DIYANET_PASSWORD tanımlı değil");

  const r = await fetch(BASE + "/Auth/Login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json().catch(() => null);
  const t = j && j.data && (j.data.accessToken || j.data.token || j.data.access_token);
  if (!r.ok || !t) throw new Error("giriş başarısız (HTTP " + r.status + ")");

  _token = t;
  _tokenAt = Date.now();
  return t;
}

async function api(path) {
  let token = await login();
  let r = await fetch(BASE + path, { headers: { Authorization: "Bearer " + token } });

  if (r.status === 401) {           // token düşmüş: bir kez yenile
    _token = null;
    token = await login();
    r = await fetch(BASE + path, { headers: { Authorization: "Bearer " + token } });
  }
  if (!r.ok) throw new Error(path + " -> HTTP " + r.status);

  const j = await r.json();
  return j && j.data !== undefined ? j.data : j;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  // vakitler sabittir: 24 saat taze, 14 gün boyunca eski veriyi servis ederken arkada tazele
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=1209600");

  const q = req.query || {};

  try {
    // ---- yardımcı modlar: yer listeleri ----
    if (q.ulkeler !== undefined)
      return res.status(200).json({ ok: true, data: await api("/api/Place/Countries") });
    if (q.eyaletler)
      return res.status(200).json({ ok: true, data: await api("/api/Place/States/" + q.eyaletler) });
    if (q.sehirler)
      return res.status(200).json({ ok: true, data: await api("/api/Place/Cities/" + q.sehirler) });

    // ---- asıl mod: aylık namaz vakitleri ----
    const cityId = process.env.DIYANET_CITY_ID;
    if (!cityId) throw new Error("DIYANET_CITY_ID tanımlı değil");

    const rows = await api("/api/AwqatSalah/Monthly/" + cityId);
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) throw new Error("aylık veri boş geldi");

    // Diyanet alan adları -> bizim ekranın beklediği sade format
    // NOT: Diyanet'te "fajr" = İMSAK, "sunrise" = GÜNEŞ. Sabah namazı vaktini
    // ekran kendisi hesaplıyor (Güneş - 60 dk).
    const days = list.map((x) => ({
      date:      x.gregorianDateShort,   // "27.06.2026"
      hijri:     x.hijriDateShort,       // "11.01.1448"
      hijriLong: x.hijriDateLong,
      imsak:     x.fajr,
      gunes:     x.sunrise,
      ogle:      x.dhuhr,
      ikindi:    x.asr,
      aksam:     x.maghrib,
      yatsi:     x.isha,
    }));

    return res.status(200).json({
      available: true,
      source: "diyanet",
      cityId,
      count: days.length,
      days,
    });
  } catch (err) {
    // hata olursa ekran otomatik olarak yedek kaynağa (Aladhan) düşer
    return res.status(200).json({ available: false, reason: String(err.message || err) });
  }
}
