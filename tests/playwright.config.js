import { defineConfig } from '@playwright/test';

const PORT = 4173;

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
    baseURL: `http://127.0.0.1:${PORT}`,
    timezoneId: 'Europe/Amsterdam',   // TV cihaz saatini kullanır; cami Amsterdam'da
    locale: 'tr-TR',
    serviceWorkers: 'block',
  },
  webServer: {
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
  ],
});
