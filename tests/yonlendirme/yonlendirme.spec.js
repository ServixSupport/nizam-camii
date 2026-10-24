// Tek link: aynı adres TV'de TV ekranını, telefonda/tablette uygulamayı açar (MOBIL-APP-PLAN.md §1).
// Kural: bir TV ASLA mobil sürüme gitmemeli. Şüphede TV.
import { test, expect, devices } from '@playwright/test';
import { mockla } from '../yardimci/tv.js';

const UA = {
  tizen: 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36',
  webos: 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36 WebAppManager',
  androidTv: 'Mozilla/5.0 (Linux; Android 10; BRAVIA 4K VH2 Build/QTG3.200305.006.S292) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Safari/537.36',
  fireTv: 'Mozilla/5.0 (Linux; Android 9; AFTKA Build/PS7633.3445N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/108.0.5359.160 Safari/537.36',
  miBox: 'Mozilla/5.0 (Linux; Android 9; MIBOX4 Build/PI) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
  philips: 'Mozilla/5.0 (Linux; NETTV/4.6.0.2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0 Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  iphone: devices['iPhone 13'].userAgent,
  androidTel: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

/** Cihazı kur, adresi aç, sonunda hangi sayfada kalındığını döndür: 'tv' | 'mobil' */
async function ac(browser, { ua, dokunmatik = false, adres = '/', hazirlik }) {
  const context = await browser.newContext({ userAgent: ua, hasTouch: dokunmatik, isMobile: dokunmatik, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  if (hazirlik) await hazirlik(page);
  await mockla(page);
  await page.goto(adres, { waitUntil: 'commit' });
  await page.waitForLoadState('load');
  await page.waitForTimeout(300);                      // yönlendirme olacaksa tamamlansın
  const yol = new URL(page.url()).pathname;
  return { page, context, yer: yol.startsWith('/mobil') ? 'mobil' : (yol === '/' ? 'tv' : yol) };
}

const TABLO = [
  ['Samsung Tizen TV', { ua: UA.tizen }, 'tv'],
  ['Samsung Tizen TV (dokunmatik bildirse bile)', { ua: UA.tizen, dokunmatik: true }, 'tv'],
  ['LG webOS TV', { ua: UA.webos }, 'tv'],
  ['Android TV (Sony BRAVIA)', { ua: UA.androidTv }, 'tv'],
  ['Android TV (dokunmatik bildirse bile)', { ua: UA.androidTv, dokunmatik: true }, 'tv'],
  ['Fire TV', { ua: UA.fireTv }, 'tv'],
  ['Fire TV (dokunmatik bildirse bile)', { ua: UA.fireTv, dokunmatik: true }, 'tv'],
  ['Mi Box (dokunmatik değil)', { ua: UA.miBox }, 'tv'],
  ['Philips NetTV', { ua: UA.philips }, 'tv'],
  ['Windows tarayıcı (fare)', { ua: UA.windows }, 'tv'],
  ['Mac tarayıcı (fare)', { ua: UA.mac }, 'tv'],
  ['iPhone', { ua: UA.iphone, dokunmatik: true }, 'mobil'],
  ['Android telefon', { ua: UA.androidTel, dokunmatik: true }, 'mobil'],
  ['Android telefon (dokunma bilgisi olmasa da)', { ua: UA.androidTel }, 'mobil'],
  ['Android tablet', { ua: UA.androidTablet, dokunmatik: true }, 'mobil'],
  ['iPadOS (Mac gibi görünür, dokunmatik)', { ua: UA.mac, dokunmatik: true }, 'mobil'],
];

test.describe('cihaza göre', () => {
  for (const [ad, cihaz, beklenen] of TABLO) {
    test(`${ad} → ${beklenen === 'tv' ? 'TV' : '/mobil/'}`, async ({ browser }) => {
      const { yer, context } = await ac(browser, cihaz);
      expect(yer).toBe(beklenen);
      await context.close();
    });
  }

  test('dokunmatik dizüstü (fare asıl işaretçi) → TV', async ({ browser }) => {
    const { yer, context } = await ac(browser, {
      ua: UA.windows,
      hazirlik: (p) => p.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => 10 });
        const asil = window.matchMedia.bind(window);
        window.matchMedia = (q) => (q === '(pointer: coarse)' ? { matches: false, media: q } : asil(q));
      }),
    });
    expect(yer).toBe('tv');
    await context.close();
  });
});

test.describe('elle seçim (?ekran=) ve çerez', () => {
  test('telefonda /?ekran=tv → TV + çerez; sonra parametresiz de TV', async ({ browser }) => {
    const { page, context, yer } = await ac(browser, { ua: UA.iphone, dokunmatik: true, adres: '/?ekran=tv' });
    expect(yer).toBe('tv');
    const cerez = (await context.cookies()).find((c) => c.name === 'ekran');
    expect(cerez.value).toBe('tv');
    expect(cerez.path).toBe('/');
    expect(cerez.expires * 1000 - Date.now()).toBeGreaterThan(360 * 864e5);     // ~1 yıl
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForTimeout(300);
    expect(new URL(page.url()).pathname).toBe('/');
    await context.close();
  });

  test('/?ekran=mobil → /mobil/ + çerez; bilgisayarda da sonra hep /mobil/', async ({ browser }) => {
    const { page, context, yer } = await ac(browser, { ua: UA.windows, adres: '/?ekran=mobil' });
    expect(yer).toBe('mobil');
    expect((await context.cookies()).find((c) => c.name === 'ekran').value).toBe('mobil');
    await page.goto('/', { waitUntil: 'commit' });
    await expect(page).toHaveURL(/\/mobil\/$/);
    await context.close();
  });

  test('uygulamadaki "TV ekranını aç" linki /?ekran=tv\'ye gider ve TV\'de kalır', async ({ browser }) => {
    const { page, context } = await ac(browser, { ua: UA.androidTablet, dokunmatik: true });
    await page.goto('/mobil/#ayarlar');
    await expect(page.locator('a.tv-link')).toHaveAttribute('href', '/?ekran=tv');
    await page.locator('a.tv-link').click();
    await page.waitForLoadState('load');
    await page.waitForTimeout(300);
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(page.locator('#stage')).toBeVisible();
    await context.close();
  });
});

test.describe('asla yönlendirme yok', () => {
  for (const adres of ['/?test=ayet', '/?test=hazirlik', '/?theme=dark', '/?theme=green&x=1']) {
    test(`telefonda ${adres} → TV`, async ({ browser }) => {
      const { yer, context } = await ac(browser, { ua: UA.iphone, dokunmatik: true, adres });
      expect(yer).toBe('tv');
      await context.close();
    });
  }

  test('iframe içinde → TV', async ({ browser }) => {
    const context = await browser.newContext({ userAgent: UA.iphone, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await mockla(page);
    await page.route('**/cerceve.html', (r) => r.fulfill({ contentType: 'text/html', body: '<iframe src="/" width="960" height="540"></iframe>' }));
    await page.goto('/cerceve.html');
    const cerceve = page.frames().find((f) => f !== page.mainFrame());
    await cerceve.waitForLoadState('load');
    await page.waitForTimeout(300);
    expect(new URL(cerceve.url()).pathname).toBe('/');
    expect(new URL(page.url()).pathname).toBe('/cerceve.html');
    await context.close();
  });

  test('betik hata verirse (çerez okunamıyor) → TV', async ({ browser }) => {
    const { yer, context } = await ac(browser, {
      ua: UA.iphone, dokunmatik: true,
      hazirlik: (p) => p.addInitScript(() => {
        Object.defineProperty(Document.prototype, 'cookie', { get() { throw new Error('test'); }, set() { throw new Error('test'); } });
      }),
    });
    expect(yer).toBe('tv');
    await context.close();
  });
});
