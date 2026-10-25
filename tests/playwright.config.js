import { defineConfig } from '@playwright/test';

const PORT = 4173;
// Yayındaki bir adresi (ör. Vercel Preview) test etmek için: TEST_ADRES=https://… npx playwright test yonlendirme
// API'ler yine mock'lanır; Diyanet'e istek gitmez.
const UZAK = process.env.TEST_ADRES || '';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  // ekran görüntüsü referansları: tests/<klasör>/__goruntuler__/<proje>/<ad>.png
  snapshotPathTemplate: '{testDir}/{testFileDir}/__goruntuler__/{projectName}/{arg}{ext}',
  expect: {
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.001 },
  },
  use: {
    baseURL: UZAK || `http://127.0.0.1:${PORT}`,
    timezoneId: 'Europe/Amsterdam',   // TV cihaz saatini kullanır; cami Amsterdam'da
    locale: 'tr-TR',
    serviceWorkers: 'block',
  },
  webServer: UZAK ? undefined : {
    command: 'node sunucu.mjs',
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: true,
    env: { PORT: String(PORT) },
  },
  projects: [
    // TV: davranış testleri ve bütün ekran görüntüleri 1920×1080'de,
    // küçük TV boyutlarında sadece ekran görüntüleri (goruntu.spec.js).
    { name: 'tv-1920', testMatch: 'tv/**/*.spec.js', use: { viewport: { width: 1920, height: 1080 } } },
    { name: 'tv-1366', testMatch: 'tv/goruntu.spec.js', use: { viewport: { width: 1366, height: 768 } } },
    { name: 'tv-960',  testMatch: 'tv/goruntu.spec.js', use: { viewport: { width: 960, height: 540 } } },

    // Mobil uygulama: davranış testleri telefonda, ekran görüntüleri üç boyutta
    { name: 'mobil-390', testMatch: 'mobil/**/*.spec.js',
      use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
    { name: 'tablet-820', testMatch: 'mobil/goruntu.spec.js',
      use: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true } },
    { name: 'tablet-1180', testMatch: 'mobil/goruntu.spec.js',
      use: { viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true } },

    // /admin paneli: bilgisayarda; ekran görüntüleri telefonda da
    { name: 'admin', testMatch: 'admin/**/*.spec.js', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'admin-telefon', testMatch: 'admin/goruntu.spec.js',
      use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },

    // Tek link: TV mi, mobil mi? (her test kendi cihazını kurar)
    { name: 'yonlendirme', testMatch: 'yonlendirme/**/*.spec.js' },
    // Saf mantık (zaman.js, icerik.js, dogrula.js) ve sunucu fonksiyonları: tarayıcısız
    { name: 'mantik', testMatch: ['mantik/**/*.spec.js', 'sunucu/**/*.spec.js'] },
  ],
});
