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

// DOĞRULANDI (Temmuz 2026): çalışan yol /api/PrayerTime/Monthly/{cityId}
// (Diyanet dokümanında "AwqatSalah" yazıyor ama servis "PrayerTime" yolunu kullanıyor.)
// Servis 32 GÜNLÜK kayan liste döner — bugünden itibaren, ay sonu geçişinde boşluk olmaz.
// Yol ileride değişirse aşağıdaki listedeki diğer adaylar sırayla denenir.
const MONTHLY_PATHS = [
  (id) => "/api/PrayerTime/Monthly/" + id,          // <-- çalışan yol
  (id) => "/api/AwqatSalah/Monthly/" + id,
  (id) => "/api/PrayerTimes/Monthly/" + id,
  (id) => "/api/AwqatSalah/MonthlyPrayerTimes/" + id,
];
const DAILY_PATHS = [
  (id) => "/api/PrayerTime/Daily/" + id,
  (id) => "/api/AwqatSalah/Daily/" + id,
  (id) => "/api/PrayerTimes/Daily/" + id,
];

// çalıştığı bilinen yol, liste başına ayrı (sıcak lambda içinde saklanır).
// (25-10-2026: eskiden tek değişkendi; aylık yol bir kez düşünce sonraki "aylık" istekler de günlük yolu kullanıyordu.)
const _goodPaths = new Map();

async function tryPaths(makers, id) {
  const good = _goodPaths.get(makers);
  if (good) {
    try { return { data: await api(good), path: good }; }
    catch (e) { _goodPaths.delete(makers); }            // artık çalışmıyorsa yeniden ara
  }
  let last = "";
  for (const make of makers) {
    const p = make(id);
    try {
      const data = await api(p);
      if (data) { _goodPaths.set(makers, p); return { data, path: p }; }
    } catch (e) {
      last = String(e.message || e);
      if (!/HTTP 404/.test(last)) throw e;              // 404 değilse (401/429 vb.) hemen bildir
    }
  }
  throw new Error("uygun endpoint bulunamadı — son hata: " + last);
}

// Diyanet alan adları -> bizim ekranın beklediği sade format
// NOT: Diyanet'te "fajr" = İMSAK, "sunrise" = GÜNEŞ. Sabah namazı vaktini
// ekran kendisi hesaplıyor (Güneş - 60 dk).
function sadeGunler(data) {
  const list = Array.isArray(data) ? data : [data];
  const pick = (o, ...names) => {
    for (const n of names) {
      for (const k of Object.keys(o || {})) {
        if (k.toLowerCase() === n.toLowerCase() && o[k]) return o[k];
      }
    }
    return "";
  };
  return list.map((x) => ({
    date:      pick(x, "gregorianDateShort", "miladiTarihKisa", "date"),
    hijri:     pick(x, "hijriDateShort", "hicriTarihKisa"),
    hijriLong: pick(x, "hijriDateLong", "hicriTarihUzun"),
    imsak:     pick(x, "fajr", "imsak"),
    gunes:     pick(x, "sunrise", "gunes"),
    ogle:      pick(x, "dhuhr", "ogle"),
    ikindi:    pick(x, "asr", "ikindi"),
    aksam:     pick(x, "maghrib", "aksam"),
    yatsi:     pick(x, "isha", "yatsi"),
  })).filter((d) => d.date && d.ogle);
}

const gercekDiyanet = {
  async aylik(id) { const f = await tryPaths(MONTHLY_PATHS, id); return { path: f.path, days: sadeGunler(f.data) }; },
  async gunluk(id) { const f = await tryPaths(DAILY_PATHS, id); return { path: f.path, days: sadeGunler(f.data) }; },
};

// ---- asıl mod: hafızalı (25-10-2026) ----
// Diyanet'te uç nokta başına günlük istek sınırı var (5). Her Vercel deploy'u CDN cache'ini sildiği için
// eskiden her deploy yeni bir Diyanet isteği demekti; 25-10-2026'da sınır aşıldı ve sadece 1 günlük liste geldi.
// Şimdi son iyi 32 günlük liste Blob'da saklanır:
//   - kayıt tazeyse (< 20 saat) Diyanet'e hiç gidilmez;
//   - Diyanet en fazla 4 saatte bir denenir (deploy sayısından bağımsız);
//   - Diyanet olmazsa bugünü kapsayan kayıtlı liste verilir;
//   - önizleme ve yerel ortam Diyanet'e asla gitmez (kayıt veya canlı /api/vakit).
const SAAT = 3600e3;
export const TAZE_MS = 20 * SAAT;
export const DENEME_MS = 4 * SAAT;
const iso = (dmy) => dmy.split(".").reverse().join("-");             // GG.AA.YYYY -> YYYY-AA-GG

export function vakitAnaMod({ depo, diyanet, saat = () => Date.now(), uretim, canliAdres, bugun }) {
  return async function anaMod(cityId) {
    const simdi = saat();
    const gun = bugun(simdi);                                         // 'YYYY-MM-DD' (Amsterdam)
    const ileri = (days) => (days || []).filter((d) => iso(d.date) >= gun).length;
    const yanit = (kayit, saniye) => ({
      saniye,
      govde: {
        available: true, source: "diyanet", cityId,
        path: String(kayit.path || "").replace("{id}", cityId),
        count: kayit.days.length, days: kayit.days, alindi: new Date(kayit.alindi).toISOString(),
      },
    });
    const k = (await depo.oku()) || {};

    if (!uretim) {
      if (k.aylik && ileri(k.aylik.days) >= 1) return yanit(k.aylik, 3600);
      try {
        const r = await fetch(canliAdres);
        const j = await r.json();
        if (j && j.available) return { govde: j, saniye: 3600 };
      } catch { /* aşağıda */ }
      return { govde: { available: false, reason: "önizleme: kayıtlı vakit yok" }, saniye: 300 };
    }

    if (k.aylik && ileri(k.aylik.days) >= 7 && simdi - k.aylik.alindi < TAZE_MS) return yanit(k.aylik, 6 * 3600);

    const denenebilir = !k.sonDeneme || simdi - k.sonDeneme >= DENEME_MS;
    if (denenebilir) {
      k.sonDeneme = simdi;
      try {
        const a = await diyanet.aylik(cityId);
        if (a.days.length >= 7) {
          k.aylik = { alindi: simdi, path: a.path.replace(cityId, "{id}"), days: a.days };
          await depo.yaz(k);
          return yanit(k.aylik, 6 * 3600);
        }
      } catch (e) { console.error("Diyanet aylık liste alınamadı:", e && e.message); }
    }
    if (k.aylik && ileri(k.aylik.days) >= 1) {
      if (denenebilir) await depo.yaz(k);
      return yanit(k.aylik, 3600);
    }
    if (k.gunluk && k.gunluk.days.some((d) => iso(d.date) === gun)) {
      if (denenebilir) await depo.yaz(k);
      return yanit(k.gunluk, 1800);
    }
    try {
      const g = await diyanet.gunluk(cityId);
      if (!g.days.length) throw new Error("alan adları tanınmadı — /api/vakit?tani=1 ile kontrol et");
      k.gunluk = { alindi: simdi, path: g.path.replace(cityId, "{id}"), days: g.days };
      await depo.yaz(k);
      return yanit(k.gunluk, 1800);
    } catch (e) {
      if (denenebilir) await depo.yaz(k);
      return { govde: { available: false, reason: String((e && e.message) || e) }, saniye: 600 };
    }
  };
}

const amsBugun = (ms) => {
  const p = {};
  for (const x of new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date(ms))) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
};

let _anaMod = null;
async function anaModGetir() {
  if (_anaMod) return _anaMod;
  const { gercekVakitDepo } = await import("./_lib/vakit-depo.js");
  _anaMod = vakitAnaMod({
    depo: gercekVakitDepo, diyanet: gercekDiyanet, bugun: amsBugun,
    uretim: process.env.VERCEL_ENV === "production",
    canliAdres: "https://nizam-camii.vercel.app/api/vakit",
  });
  return _anaMod;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  // vakitler sabittir: 24 saat taze, 14 gün boyunca eski veriyi servis ederken arkada tazele
  // (asıl modda süre aşağıda kayda göre ayarlanır)
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

    // ---- günün içeriği: /api/vakit?gunun=1  (âyet + hadis + dua, ham hâliyle) ----
    if (q.gunun) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ok: true, data: await api("/api/DailyContent") });
    }

    const cityId = process.env.DIYANET_CITY_ID;
    if (!cityId) throw new Error("DIYANET_CITY_ID tanımlı değil");

    // ---- teşhis modu: /api/vakit?tani=1  (hangi yol çalışıyor, tek tek dener) ----
    if (q.tani) {
      const out = [];
      for (const make of [...MONTHLY_PATHS, ...DAILY_PATHS]) {
        const p = make(cityId);
        try {
          const d = await api(p);
          out.push({ yol: p, sonuc: "OK", adet: Array.isArray(d) ? d.length : 1,
                     ornek: Array.isArray(d) ? d[0] : d });
        } catch (e) { out.push({ yol: p, sonuc: String(e.message || e) }); }
      }
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ cityId, denemeler: out });
    }

    // ---- asıl mod: aylık namaz vakitleri, hafızalı (yukarıdaki açıklama) ----
    const { govde, saniye } = await (await anaModGetir())(cityId);
    res.setHeader("Cache-Control", `s-maxage=${saniye}, stale-while-revalidate=${govde.available ? 1209600 : 600}`);
    return res.status(200).json(govde);
  } catch (err) {
    // hata olursa ekran otomatik olarak yedek kaynağa (Aladhan) düşer; hata kısa süre cache'lenir
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=600");
    return res.status(200).json({ available: false, reason: String(err.message || err) });
  }
}
