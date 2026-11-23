// Mağaza uygulaması (Capacitor) modu: telefon eklentisi taklit edilir (window.Capacitor).
// Gerçek telefon davranışı (bildirim, durum çubuğu, sessize alma) app/ altındaki eklentide; burada uygulama tarafı.
import { test, expect } from '@playwright/test';
import { mobilAc } from '../yardimci/mobil.js';
import { tasarimIcerik } from '../fixtures/tasarim-icerik.js';

const ZAMAN = '2026-10-28T16:00:00.500+01:00';
const an = (s) => new Date(s).getTime();

/** Sahte telefon: her çağrı window.__yerel.cagrilar'a yazılır. */
async function telefon(page, { platform = 'android', izin = {}, izinCevabi = 'granted' } = {}) {
  await page.addInitScript(([platform, izin, izinCevabi]) => {
    // izinler telefonda kalır: sayfa yenilense de (sessionStorage)
    const kayitli = JSON.parse(sessionStorage.getItem('__izin') || 'null');
    const y = { cagrilar: [], izin: kayitli || { bildirim: 'prompt', tamAlarm: true, sessiz: false, ...izin } };
    window.__yerel = y;
    const cevap = {
      izinDurumu: () => ({ ...y.izin }),
      bildirimIzniIste: () => { y.izin.bildirim = izinCevabi; sessionStorage.setItem('__izin', JSON.stringify(y.izin)); return { ...y.izin }; },
      sesDinle: () => new Promise((r) => { y.dinlemeBitti = r; }),            // telefon: ses bitince cevap verir
    };
    // telefonun köprüsü (Capacitor native-bridge.js) gibi: nativePromise(eklenti, yöntem, seçenekler)
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => platform,
      nativePromise: async (ad, m, arg) => {
        y.cagrilar.push({ ad, m, arg: JSON.parse(JSON.stringify(arg)) });
        return cevap[m] ? cevap[m](arg) : {};
      },
    };
  }, [platform, izin, izinCevabi]);
}
const cagrilar = (page, m) => page.evaluate((m) => window.__yerel.cagrilar.filter((c) => c.m === m), m);
async function sonPlan(page, sart = () => true) {
  let p = null;
  await expect.poll(async () => {
    const c = (await cagrilar(page, 'planKur')).map((x) => x.arg.plan).filter(sart);
    p = c.at(-1) || null;
    return !!p;
  }).toBe(true);
  return p;
}

test('kurulum kartı yok, service worker kurulmaz; vakitler sunucunun tam adresinden', async ({ page }) => {
  await telefon(page);
  const kayit = await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#ayarlar' });
  await expect(page.locator('#s-ayarlar h1')).toBeVisible();
  await expect(page.locator('#kurulum')).toBeHidden();
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
  // Apple ve Google: uygulamanın içinde gizlilik bağlantısı
  // uygulamanın içinde ayrı sayfa; web sitesine gidilmez (kullanıcı isteği, 20-11-2026)
  await expect(page.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '#gizlilik');
  await page.getByRole('link', { name: 'Privacy' }).click();
  await expect(page.locator('#s-gizlilik h1')).toHaveText('Privacyverklaring');
  await expect(page.locator('#s-gizlilik')).toContainText('Geen advertenties, geen statistieken en geen tracking.');
  await expect(page.locator('.menu-oge[data-sekme="ayarlar"]')).toHaveAttribute('aria-current', 'page');
  await page.locator('#s-gizlilik .geri').click();
  await expect(page.locator('#s-ayarlar')).toBeVisible();
  expect(kayit.api.map((u) => u.href)).toContain('https://nizam-camii.vercel.app/api/vakit');
});

test('Android ilk açılış: geri sayım açık, bildirim izni bir kez sorulur, plan telefona gider', async ({ page }) => {
  await telefon(page);
  await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#ayarlar' });
  const p = await sonPlan(page, (x) => x.sayac);
  expect(p.vakitler[0]).toEqual({ an: an('2026-10-28T17:27:00+01:00'), vakit: 'Maghrib', baslik: 'Maghrib · 17:27' });
  expect(p.vakitler.length).toBeGreaterThan(25 * 7);                          // ~30 gün ileri
  expect(p).toMatchObject({ dil: 'nl', sayacAlt: 'Volgende gebedstijd', bildirimler: [], sessiz: [] });
  await expect(page.locator('#sayac-ayar')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Gebedstijden en aftellen' })).toHaveAttribute('aria-checked', 'true');
  expect(await cagrilar(page, 'bildirimIzniIste')).toHaveLength(1);
  await page.reload();
  await expect(page.locator('#sayac-ayar')).toBeVisible();
  await page.clock.runFor(1000);
  expect(await cagrilar(page, 'bildirimIzniIste')).toHaveLength(0);           // yeniden sorulmaz

  // kapatınca plan sayaçsız gider
  await page.getByRole('switch', { name: 'Gebedstijden en aftellen' }).click();
  await page.clock.runFor(1000);
  expect((await sonPlan(page)).sayac).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('nzm.sayac'))).toBe('kapali');
});

test('izin verilmezse geri sayım kapalı görünür ve mesaj çıkar', async ({ page }) => {
  await telefon(page, { izinCevabi: 'denied' });
  await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#ayarlar' });
  const anahtar = page.getByRole('switch', { name: 'Gebedstijden en aftellen' });
  await expect(anahtar).toHaveAttribute('aria-checked', 'false');
  await anahtar.click();
  await expect(page.locator('#sayac-mesaj')).toHaveText('Meldingen zijn niet toegestaan. Je kunt ze aanzetten in de instellingen van je telefoon.');
});

test('bildirimler telefonda kurulur (sunucu ve Web Push yok)', async ({ page }) => {
  await telefon(page, { izin: { bildirim: 'granted' } });
  await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#ayarlar' });
  await expect(page.locator('#bildirim-ayar')).toBeVisible();
  await page.locator('#b-git').click();                                           // ayrı sayfa (19-11-2026)
  await page.getByRole('switch', { name: 'Meldingen voor gebedstijden' }).click();
  await expect(page.getByRole('switch', { name: 'Meldingen voor gebedstijden' })).toHaveAttribute('aria-checked', 'true');
  await page.clock.runFor(1000);
  const p = await sonPlan(page, (x) => x.bildirimler.length > 0);
  expect(p.bildirimler.filter((b) => b.etiket === '2026-10-28-Maghrib')).toEqual([
    { an: an('2026-10-28T17:12:00+01:00'), etiket: '2026-10-28-Maghrib', baslik: 'Nog 15 minuten tot Maghrib', govde: 'Maghrib begint om 17:27.' },
    { an: an('2026-10-28T17:27:00+01:00'), etiket: '2026-10-28-Maghrib', baslik: 'Maghrib is begonnen · 17:27', govde: '' },
  ]);
  expect(p.bildirimler.some((b) => b.etiket.endsWith('-Imsak') || b.etiket.endsWith('-Sunrise'))).toBe(false);

  await expect(page.getByRole('button', { name: 'Testmelding sturen' })).toHaveCount(0);     // deneme bildirimi kalktı (kullanıcı isteği, 20-11-2026)

  // her vakit ayrı dakika (19-11-2026): Akşam 30 dk önce
  await page.locator('#b-once-liste').getByRole('combobox', { name: 'Maghrib: Herinner me vooraf' }).selectOption('30');
  await page.clock.runFor(1000);
  const p30 = await sonPlan(page, (x) => x.bildirimler.some((b) => b.baslik === 'Nog 30 minuten tot Maghrib'));
  expect(p30.bildirimler.find((b) => b.etiket === '2026-10-28-Isha' && b.baslik.startsWith('Nog '))).toMatchObject({ baslik: 'Nog 15 minuten tot Isha' });

  // dil değişince bildirimler yeni dilde
  await page.evaluate(() => { location.hash = '#ayarlar'; });
  await page.getByRole('button', { name: 'Türkçe' }).click();
  await page.clock.runFor(1000);
  const tr = await sonPlan(page, (x) => x.dil === 'tr');
  expect(tr.bildirimler.find((b) => b.etiket === '2026-10-28-Maghrib').baslik).toBe('Akşam namazına 30 dakika');
  expect(tr.vakitler[0].baslik).toBe('Akşam · 17:27');
});

const SES_DEPO = JSON.stringify({ aan: true, once: 15, giris: true, vakitler: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] });

test('vakit girince ses (Android): her namaz kendi satırında (19-11-2026); "Geluid wijzigen" listesi, telefon sesi ve Ezan 1 … 7; plan ve deneme seçilen sesle', async ({ page }) => {
  await telefon(page, { izin: { bildirim: 'granted' } });
  await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#bildirimler', depo: { 'nzm.bildirim': SES_DEPO } });
  const satir = (k) => page.locator(`#b-giris-liste .b-vsatir[data-key="${k}"]`);
  const aksam = page.locator('#b-ses-Maghrib'), sabah = page.locator('#b-ses-Fajr');
  const liste = page.locator('#b-ses-liste-Maghrib');
  await expect(satir('Maghrib').locator('.b-vsatir-alt')).toHaveText('Standaard telefoonmelding');   // varsayılan
  await expect(aksam).toHaveText('Geluid wijzigen');
  await expect(aksam).toHaveAttribute('aria-expanded', 'false');
  await expect(satir('Imsak').locator('.b-sesdegis')).toHaveCount(0);           // İmsak ve Güneş telefonun sesiyle
  await expect(liste).toBeHidden();
  await expect(page.locator('#b-giris-ad .ipucu')).toBeVisible();
  await expect(page.locator('#ip-ses')).toContainText('Je kiest per gebed een eigen geluid');

  await aksam.click();
  await expect(aksam).toHaveAttribute('aria-expanded', 'true');
  await expect(liste.locator('.b-ses-sec')).toHaveText(['Standaard telefoonmelding', 'Ezan 1', 'Ezan 2', 'Ezan 3', 'Ezan 4', 'Ezan 5', 'Ezan 6', 'Ezan 7']);
  await expect(liste.getByRole('button', { name: 'Standaard telefoonmelding', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await liste.getByRole('button', { name: 'Ezan 5', exact: true }).click();
  await expect(liste).toBeHidden();                                           // seçince kapanır
  await expect(satir('Maghrib').locator('.b-vsatir-alt')).toHaveText('Ezan 5');
  await expect(satir('Fajr').locator('.b-vsatir-alt')).toHaveText('Standaard telefoonmelding');   // diğer namazlar değişmez

  await sabah.click();
  await page.locator('#b-ses-liste-Fajr').getByRole('button', { name: 'Ezan 6', exact: true }).click();
  await expect(satir('Fajr').locator('.b-vsatir-alt')).toHaveText('Ezan 6');
  await page.clock.runFor(1000);
  const p = await sonPlan(page, (x) => x.bildirimler.some((b) => b.ses === 'ezan-6'));
  expect(p.bildirimler.find((b) => b.etiket === '2026-10-28-Maghrib' && b.ses)).toMatchObject({ an: an('2026-10-28T17:27:00+01:00'), ses: 'ezan-5' });
  expect(p.bildirimler.find((b) => b.etiket === '2026-10-29-Fajr' && b.ses)).toMatchObject({ ses: 'ezan-6' });
  expect(p.bildirimler.filter((b) => /-(Dhuhr|Asr|Isha)$/.test(b.etiket)).some((b) => 'ses' in b)).toBe(false);
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('nzm.bildirim'))).sesler)
    .toEqual({ Fajr: 'ezan-6', Dhuhr: 'telefon', Asr: 'telefon', Maghrib: 'ezan-5', Isha: 'telefon' });

  // vakit girince bildirilmeyen namazın ses düğmesi görünmez
  await page.locator('#b-giris-liste').getByRole('switch', { name: 'Melding bij begin gebedstijd: Isha' }).click();
  await expect(page.locator('#b-ses-Isha')).toBeHidden();
  await expect(aksam).toBeVisible();

  await page.reload();
  await expect(satir('Maghrib').locator('.b-vsatir-alt')).toHaveText('Ezan 5');
  await expect(satir('Fajr').locator('.b-vsatir-alt')).toHaveText('Ezan 6');
  await page.evaluate(() => { location.hash = '#ayarlar'; });
  await page.getByRole('button', { name: 'Türkçe' }).click();
  await page.locator('#b-git').click();
  await expect(page.locator('#b-giris-liste .b-vsatir-ad').first()).toHaveText('İmsak');
  await expect(aksam).toHaveText('Sesi değiştir');
  await aksam.click();
  await expect(liste.locator('.b-ses-sec').first()).toHaveText('Telefonun varsayılan sesi');
});

test('ses listesi: seçmeden önce dinlenir (▶); dinlemek seçimi değiştirmez; bitince, kapanınca ve sekme değişince susar', async ({ page }) => {
  await telefon(page, { izin: { bildirim: 'granted' } });
  await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#bildirimler', depo: { 'nzm.bildirim': SES_DEPO } });
  const sec = page.locator('#b-ses-Maghrib');
  const secili = page.locator('#b-giris-liste .b-vsatir[data-key="Maghrib"] .b-vsatir-alt');
  await sec.click();
  const dinle = (ad) => page.getByRole('button', { name: `Luister naar ${ad}`, exact: true });
  const durdur = (ad) => page.getByRole('button', { name: `${ad} stoppen`, exact: true });

  await dinle('Ezan 3').click();
  expect((await cagrilar(page, 'sesDinle')).at(-1).arg).toEqual({ ses: 'ezan-3' });
  await expect(durdur('Ezan 3')).toBeVisible();
  await expect(secili).toHaveText('Standaard telefoonmelding');               // dinlemek seçmek değil
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('nzm.bildirim'))).sesler).toBeUndefined();

  // başka kayda geçince öncekinin düğmesi geri gelir; ses bitince ▶ geri gelir
  await dinle('Ezan 1').click();
  await expect(durdur('Ezan 3')).toHaveCount(0);
  await expect(durdur('Ezan 1')).toBeVisible();
  await page.evaluate(() => window.__yerel.dinlemeBitti());
  await expect(dinle('Ezan 1')).toBeVisible();
  expect(await cagrilar(page, 'sesDurdur')).toHaveLength(0);

  // telefonun kendi sesi de dinlenir; ■ durdurur
  await dinle('Standaard telefoonmelding').click();
  expect((await cagrilar(page, 'sesDinle')).at(-1).arg).toEqual({ ses: 'telefon' });
  await durdur('Standaard telefoonmelding').click();
  await expect.poll(async () => (await cagrilar(page, 'sesDurdur')).length).toBe(1);
  await expect(dinle('Standaard telefoonmelding')).toBeVisible();

  // liste kapanınca susar
  await dinle('Ezan 7').click();
  await sec.click();
  await expect.poll(async () => (await cagrilar(page, 'sesDurdur')).length).toBe(2);

  // satır seçince susar
  await sec.click();
  await dinle('Ezan 4').click();
  await page.getByRole('button', { name: 'Ezan 4', exact: true }).click();
  await expect.poll(async () => (await cagrilar(page, 'sesDurdur')).length).toBe(3);
  await expect(secili).toHaveText('Ezan 4');

  // başka namazın listesi açılınca öncekisi kapanır ve susar
  await sec.click();
  await dinle('Ezan 5').click();
  await page.locator('#b-ses-Isha').click();
  await expect.poll(async () => (await cagrilar(page, 'sesDurdur')).length).toBe(4);
  await expect(page.locator('#b-ses-liste-Maghrib')).toBeHidden();
  await expect(page.locator('#b-ses-liste-Isha')).toBeVisible();

  // sekme değişince susar
  await dinle('Ezan 2').click();
  await page.evaluate(() => { location.hash = '#ana'; });
  await expect.poll(async () => (await cagrilar(page, 'sesDurdur')).length).toBe(5);
});

test('eski ses ayarı (kısa/uzun ezan) telefonun sesine döner', async ({ page }) => {
  await telefon(page, { izin: { bildirim: 'granted' } });
  await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#bildirimler', depo: { 'nzm.bildirim': JSON.stringify({ aan: true, once: 15, giris: true, vakitler: ['Maghrib'], ses: 'ezan-uzun' }) } });
  await expect(page.locator('#b-giris-liste .b-vsatir[data-key="Maghrib"] .b-vsatir-alt')).toHaveText('Standaard telefoonmelding');
});

test('eski kayıttaki tek ses (her namaz ayrı olmadan önce) bütün namazlara geçer', async ({ page }) => {
  await telefon(page, { izin: { bildirim: 'granted' } });
  await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#bildirimler', depo: { 'nzm.bildirim': JSON.stringify({ aan: true, once: 15, giris: true, vakitler: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'], ses: 'ezan-3' }) } });
  await expect(page.locator('#b-giris-liste .b-vsatir:not(.kapali) .b-vsatir-alt')).toHaveText(['Ezan 3', 'Ezan 3', 'Ezan 3', 'Ezan 3', 'Ezan 3']);
  await page.clock.runFor(1000);
  const p = await sonPlan(page, (x) => x.bildirimler.length > 0);
  expect(p.bildirimler.find((b) => b.etiket === '2026-10-28-Maghrib' && b.ses).ses).toBe('ezan-3');
});

test('tema önizlemesi: iframe telefona bir şey göndermez, ağa gitmez, ayar yazmaz; Android geri tuşu önizlemeyi kapatır', async ({ page }) => {
  await telefon(page, { izin: { bildirim: 'granted' } });
  const kayit = await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#ayarlar', depo: { 'nzm.bildirim': SES_DEPO } });
  await sonPlan(page);
  const istek = kayit.api.length;
  const depo = () => page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  const once = await depo();

  await page.getByRole('button', { name: /^Ontwerp/ }).click();
  expect((await cagrilar(page, 'geriYakala')).at(-1).arg).toEqual({ acik: true });
  const t1 = page.frameLocator('#to-serit iframe >> nth=0');
  await expect(t1.locator('.vakitler li:not([hidden])')).toHaveCount(7);
  await expect(t1.locator('.v-zil').first()).toBeVisible();                     // ziller uygulamadaki gibi
  await page.clock.runFor(2000);

  for (const f of page.frames().filter((x) => x.url().includes('onizleme='))) {
    expect(await f.evaluate(() => window.__yerel.cagrilar)).toEqual([]);
  }
  expect(kayit.api.length).toBe(istek);
  expect(await depo()).toBe(once);

  await page.evaluate(() => document.dispatchEvent(new Event('camiGeri')));     // CamiPlugin: geri tuşu
  await expect(page.locator('#tema-on')).toBeHidden();
  await expect(page).toHaveURL(/#ayarlar$/);                                      // sadece önizleme kapandı
  // Ayarlar'da kalındı: geri tuşu yine uygulamada (ana ekrana döner; 19-11-2026)
  await expect.poll(async () => (await cagrilar(page, 'geriYakala')).at(-1).arg.acik).toBe(true);
});

test('Android geri tuşu (19-11-2026): faaliyet detayından listeye, sekmelerden ana ekrana, ana ekranda uygulama kapanır', async ({ page }) => {
  await telefon(page, { izin: { bildirim: 'granted' } });
  await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#faaliyet/f-kahvalti' });
  const geri = () => page.evaluate(() => document.dispatchEvent(new Event('camiGeri')));
  const son = async () => (await cagrilar(page, 'geriYakala')).at(-1).arg.acik;
  await expect.poll(son).toBe(true);
  await geri();
  await expect(page).toHaveURL(/#faaliyetler$/);
  await geri();
  await expect(page).toHaveURL(/#ana$/);
  await expect.poll(son).toBe(false);                                             // ana ekranda telefonun kendisi: uygulama kapanır
  for (const s of ['#programlar', '#ayarlar']) {
    await page.evaluate((h) => { location.hash = h; }, s);
    await expect.poll(son).toBe(true);
    await geri();
    await expect(page).toHaveURL(/#ana$/);
  }
});

test('izin telefondan geri alındıysa bildirimler kapalı görünür', async ({ page }) => {
  await telefon(page, { izin: { bildirim: 'denied' } });
  await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#bildirimler', depo: { 'nzm.bildirim': JSON.stringify({ aan: true, once: 15, giris: true, vakitler: ['Maghrib'] }) } });
  await expect(page.getByRole('switch', { name: 'Meldingen voor gebedstijden' })).toHaveAttribute('aria-checked', 'false');
  await page.evaluate(() => { location.hash = '#ayarlar'; });
  await expect(page.locator('#b-git-alt')).toHaveText('Uit');
});

test('sessize alma: ayar, "Niet storen" izni, süre, nasıl ve hangi namazlar', async ({ page }) => {
  await telefon(page, { izin: { bildirim: 'granted', sessiz: false } });
  await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#ayarlar' });
  // Ayarlar'da sadece sayfaya giden satır (kullanıcı isteği, 20-11-2026); sayfa bildirimler sayfası gibi
  await expect(page.locator('#sessiz-git-alt')).toHaveText('Uit');
  await page.locator('#sessiz-git').click();
  await expect(page).toHaveURL(/#sessiz$/);
  await expect(page.locator('#s-sessiz h1')).toHaveText('Telefoon op stil bij gebedstijd');
  await expect(page.locator('.menu-oge[data-sekme="ayarlar"]')).toHaveAttribute('aria-current', 'page');
  const bolum = page.locator('#sessiz-kart');
  const anahtar = page.getByRole('switch', { name: 'Telefoon op stil bij gebedstijd' });
  await expect(anahtar).toHaveAttribute('aria-checked', 'false');
  await expect(bolum.locator('#sessiz-mod button')).toHaveText(['Stil', 'Trillen']);
  await expect(bolum.locator('#sessiz-vakitler button')).toHaveText(['Fadjr', 'Dhoehr', 'Asr', 'Maghrib', 'Isha']);
  // her namazın kendi süresi (kullanıcı isteği, 19-11-2026); hepsi 30 dk başlar
  const sure = (ad) => bolum.getByRole('combobox', { name: `${ad}: hoe lang` });
  await expect(sure('Maghrib').locator('option')).toHaveText(['15 min', '20 min', '30 min', '45 min', '60 min']);
  for (const ad of ['Fadjr', 'Dhoehr', 'Asr', 'Maghrib', 'Isha']) await expect(sure(ad)).toHaveValue('30');

  await anahtar.click();
  await expect(page.locator('#sessiz-mesaj')).toHaveText('Geef de app toegang tot “Niet storen”, zodat hij je telefoon op stil kan zetten.');
  await page.getByRole('button', { name: 'Toestaan' }).click();
  expect(await cagrilar(page, 'sessizIzniAc')).toHaveLength(1);
  await page.clock.runFor(1000);
  let p = await sonPlan(page, (x) => x.sessiz.length > 0);
  expect(p.sessizMod).toBe('sessiz');
  // sessize alındı diye bildirim yok (kullanıcı isteği, 23-11-2026): dönemde sadece başlangıç ve bitiş
  expect(p.sessiz[0]).toEqual({ bas: an('2026-10-28T17:27:00+01:00'), bit: an('2026-10-28T17:57:00+01:00') });

  // titreşim: bazı telefonlar (Samsung) burada da izin ister (16-11-2026); 45 dk; Sabah hariç
  await bolum.getByRole('button', { name: 'Trillen' }).click();
  await expect(page.locator('#sessiz-mesaj')).toHaveText('Sommige telefoons (zoals Samsung) vragen ook voor trillen toegang tot “Niet storen”. Geef de app die toegang.');
  await expect(page.getByRole('button', { name: 'Toestaan' })).toBeVisible();
  await sure('Maghrib').selectOption('45');
  await sure('Dhoehr').selectOption('15');
  await bolum.getByRole('button', { name: 'Fadjr' }).click();
  await expect(sure('Fadjr')).toBeDisabled();                                 // kapalı namazın süresi seçilmez
  await page.clock.runFor(1000);
  p = await sonPlan(page, (x) => x.sessizMod === 'titresim' && x.sessiz[0] && x.sessiz[0].bit - x.sessiz[0].bas === 45 * 60000);
  const ogle = p.vakitler.find((v) => v.vakit === 'Dhuhr').an;
  expect(p.sessiz.find((s) => s.bas === ogle).bit - ogle).toBe(15 * 60000);
  const sabahlar = p.vakitler.filter((v) => v.vakit === 'Fajr').map((v) => v.an);
  expect(p.sessiz.some((s) => sabahlar.includes(s.bas))).toBe(false);
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('nzm.sessiz'))))
    .toEqual({ aan: true, dakikalar: { Fajr: 30, Dhuhr: 15, Asr: 30, Maghrib: 45, Isha: 30 }, vakitler: ['Dhuhr', 'Asr', 'Maghrib', 'Isha'], mod: 'titresim' });
  // eski kayıt (tek süre) bütün namazlara geçer
  await page.evaluate(() => localStorage.setItem('nzm.sessiz', JSON.stringify({ aan: true, dakika: 20, vakitler: ['Maghrib'], mod: 'sessiz' })));
  await page.reload();
  for (const ad of ['Fadjr', 'Dhoehr', 'Asr', 'Maghrib', 'Isha']) await expect(sure(ad)).toHaveValue('20');

  // telefonun ayarlarından izin verip dönünce uyarı kalkar
  await bolum.getByRole('button', { name: 'Stil', exact: true }).click();
  await expect(page.locator('#sessiz-mesaj')).toHaveText('Geef de app toegang tot “Niet storen”, zodat hij je telefoon op stil kan zetten.');
  await page.evaluate(() => { window.__yerel.izin.sessiz = true; document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('#sessiz-mesaj')).toBeHidden();
  await bolum.getByRole('button', { name: 'Trillen' }).click();
  await expect(page.locator('#sessiz-mesaj')).toBeHidden();
  await page.locator('#s-sessiz .geri').click();
  await expect(page.locator('#sessiz-git-alt')).toHaveText('Aan · 1 gebedstijd');
});

test('sessize alma: titreşimde izin yoksa sonuç "titreşime alınamadı" (Samsung, 16-11-2026)', async ({ page }) => {
  const titresimAcik = JSON.stringify({ aan: true, dakika: 30, vakitler: ['Dhuhr'], mod: 'titresim' });
  await telefon(page, { izin: { bildirim: 'granted', sessiz: false, sessizSon: { an: new Date('2026-11-16T12:30:00+01:00').getTime(), sonuc: 'izinYok' } } });
  await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#sessiz', depo: { 'nzm.sessiz': titresimAcik, 'nzm.dil': 'tr' } });
  await expect(page.locator('#sessiz-son')).toHaveText('Son: 16 Kas 12:30 · izin olmadığı için titreşime alınamadı');
  await expect(page.locator('#sessiz-mesaj')).toHaveText('Bazı telefonlar (ör. Samsung) titreşim için de “Rahatsız Etmeyin” erişimi ister. Uygulamaya bu erişimi verin.');
  await page.getByRole('button', { name: 'İzin ver' }).click();
  expect(await cagrilar(page, 'sessizIzniAc')).toHaveLength(1);
});

test('sessize alma: son deneme ve sonucu görünür (telefonda ne oldu; kullanıcı isteği, 08-11-2026)', async ({ page }) => {
  const sessizAcik = JSON.stringify({ aan: true, dakika: 30, vakitler: ['Fajr'], mod: 'sessiz' });
  await telefon(page, { izin: { bildirim: 'granted', sessiz: true, sessizSon: { an: new Date('2026-10-28T06:21:00+01:00').getTime(), sonuc: 'rahatsizEtmeyin' } } });
  await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#sessiz', depo: { 'nzm.sessiz': sessizAcik, 'nzm.dil': 'tr' } });
  await expect(page.locator('#sessiz-son')).toHaveText('Son: 28 Eki 06:21 · “Rahatsız Etmeyin” açıktı, dokunulmadı');
  await page.evaluate(() => { window.__yerel.izin.sessizSon.sonuc = 'sessiz'; document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('#sessiz-son')).toHaveText('Son: 28 Eki 06:21 · telefon sessize alındı');
  // ayar kapalıyken gösterilmez
  await page.getByRole('switch', { name: 'Namaz vaktinde telefonu sessize al' }).click();
  await expect(page.locator('#sessiz-son')).toBeHidden();
});

test('"Alarmlar ve hatırlatıcılar" izni yoksa uyarı ve ayar düğmesi', async ({ page }) => {
  await telefon(page, { izin: { bildirim: 'granted', tamAlarm: false } });
  await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#ayarlar' });
  await expect(page.locator('#tam-alarm')).toContainText('Zet “Wekkers en herinneringen” aan');
  await page.getByRole('button', { name: 'Instellingen openen' }).click();
  expect(await cagrilar(page, 'tamAlarmIzniAc')).toHaveLength(1);
});

test('tema: sistem çubukları temaya göre (Tema 2 ve 4 koyu zeminli: açık simgeler; Tema 1 ve 3: koyu simgeler; 20-11-2026)', async ({ page }) => {
  await telefon(page, { izin: { bildirim: 'granted' } });
  await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#ayarlar', depo: { 'nzm.stil': 'gok' } });
  await expect.poll(async () => (await cagrilar(page, 'cubuklar')).at(-1)?.arg?.koyu).toBe(true);
  for (const [stil, koyu] of [['zumrut', true], ['cini', false], ['liste', false]]) {
    await page.evaluate((s) => localStorage.setItem('nzm.stil', s), stil);
    await page.reload();
    await expect.poll(async () => (await cagrilar(page, 'cubuklar')).at(-1)?.arg?.koyu, stil).toBe(koyu);
  }
});

test('iPhone: sessize alma ve durum çubuğu yok (Apple izin vermez), kilit ekranı widget açıklaması var; izin kendiliğinden sorulmaz', async ({ page }) => {
  await telefon(page, { platform: 'ios' });
  await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#ayarlar' });
  await expect(page.locator('#widget-ayar')).toBeVisible();
  await expect(page.locator('#widget-ayar')).toContainText('Aftel-widget');
  await expect(page.locator('#sessiz-ayar')).toBeHidden();
  await expect(page.locator('#sayac-ayar')).toBeHidden();
  await expect(page.locator('#tam-alarm')).toBeHidden();
  await expect(page.locator('#b-giris-liste .b-sesdegis')).toHaveCount(0);      // ezan sesi şimdilik sadece Android'de
  const p = await sonPlan(page);
  expect(p.sayac).toBe(false);
  expect(p.vakitler.length).toBeGreaterThan(0);                               // kilit ekranı widget'ı için
  expect(await cagrilar(page, 'bildirimIzniIste')).toHaveLength(0);
});

test('tarayıcıda (web uygulaması) yeni bölümler hiç görünmez ve telefon eklentisi çağrılmaz', async ({ page }) => {
  await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#ayarlar' });
  for (const id of ['#sayac-ayar', '#sessiz-ayar', '#widget-ayar', '#tam-alarm', '#gizlilik-link']) await expect(page.locator(id)).toBeHidden();
  await expect(page.locator('#b-giris-liste .b-sesdegis')).toHaveCount(0);
});

// Android WebView dosya indirmez ve navigator.share yok: takvim ve paylaş telefonun kendi pencereleriyle (kullanıcı isteği, 20-11-2026)
test('faaliyet: "Takvime ekle" takvim uygulamasını dolu açar, "Paylaş" telefonun paylaş penceresini açar', async ({ page }) => {
  await telefon(page, { izin: { bildirim: 'granted' } });
  await mobilAc(page, { zaman: ZAMAN, adres: '/mobil/#faaliyetler', icerik: tasarimIcerik(), depo: { 'nzm.dil': 'nl' } });
  const kart = page.locator('.one-cikan');
  await kart.getByRole('button', { name: 'Zet in agenda' }).click();
  expect((await cagrilar(page, 'takvimeEkle'))[0].arg).toEqual({
    baslik: 'Familieontbijt', bas: new Date('2026-10-31T10:00:00+01:00').getTime(), bit: new Date('2026-10-31T12:30:00+01:00').getTime(),
    tumGun: false, yer: 'Konferans salonu, Ookmeerweg 206, Amsterdam', aciklama: expect.any(String),
  });
  await kart.getByRole('button', { name: 'Delen' }).click();
  const p = (await cagrilar(page, 'paylas'))[0].arg;
  expect(p.baslik).toBe('Familieontbijt');
  expect(p.metin).toMatch(/^Familieontbijt\nZaterdag 31 oktober · 10:00 – 12:30 · Konferans salonu\nhttps:\/\/nizam-camii\.vercel\.app\/mobil\/#faaliyet\/f-kahvalti$/);
  await expect(page.getByText('Link gekopieerd')).toHaveCount(0);             // panoya kopyalanmaz
});
