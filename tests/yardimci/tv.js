// TV ekranı (index.html) testleri için ortak yardımcılar.
// - Sahte saat: Playwright clock, sayfa yüklenmeden kurulur ve durdurulur.
// - /api/vakit, /api/hutbe ve Aladhan mock'lanır; başka dış istek engellenir.
// - Google Fonts (Inter, Amiri) ilk çalıştırmada indirilip tests/.cache/fonts/'a konur,
//   sonra oradan sunulur: ekran görüntüleri internetten bağımsız ve hep aynı olur.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';

const BURASI = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(BURASI, '..', 'fixtures');
const FONT_CACHE = path.join(BURASI, '..', '.cache', 'fonts');

/** 24-10-2026'da canlı /api/vakit'ten bir kez alınan veri (23.10–23.11.2026). */
export const VAKIT = JSON.parse(fs.readFileSync(path.join(FIX, 'vakit.json'), 'utf8'));
/** Sahte hutbe (metin uydurma değil, açıkça test metni). */
export const HUTBE = JSON.parse(fs.readFileSync(path.join(FIX, 'hutbe.json'), 'utf8'));

/** Aladhan yedeği için sabit sahte cevap (düzeltmeler TV'de uygulanır: İmsak +48, Yatsı −41). */
export const ALADHAN_VAKIT = {
  Imsak: '05:00', Fajr: '05:10', Sunrise: '08:00', Dhuhr: '12:30',
  Asr: '14:20', Maghrib: '16:40', Isha: '18:30',
};
export function aladhanCevap() {
  return {
    code: 200, status: 'OK',
    data: {
      timings: { ...ALADHAN_VAKIT },
      date: { hijri: { day: '10', month: { number: 6, en: 'Jumādá al-ākhirah' }, year: '1448' } },
    },
  };
}

/** Sayfa saati, istenen andan bu kadar önce başlar; sayfa bu sürede kendini oturtur. */
const PAY_MS = 2000;

async function fontServis(route) {
  const url = route.request().url();
  const ad = crypto.createHash('sha1').update(url).digest('hex');
  const dosya = path.join(FONT_CACHE, ad);
  const turDosya = dosya + '.tur';
  if (fs.existsSync(dosya) && fs.existsSync(turDosya)) {
    return route.fulfill({
      status: 200, body: fs.readFileSync(dosya),
      headers: { 'content-type': fs.readFileSync(turDosya, 'utf8'), 'access-control-allow-origin': '*' },
    });
  }
  try {
    const cevap = await route.fetch();
    const govde = await cevap.body();
    if (cevap.ok()) {
      fs.mkdirSync(FONT_CACHE, { recursive: true });
      const gecici = `${dosya}.${process.pid}.tmp`;
      fs.writeFileSync(gecici, govde);
      fs.renameSync(gecici, dosya);
      fs.writeFileSync(turDosya, cevap.headers()['content-type'] || 'application/octet-stream');
    }
    return route.fulfill({ response: cevap, body: govde });
  } catch {
    return route.abort();
  }
}

const json = (route, veri) => route.fulfill({
  status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(veri),
});

/**
 * Mock'ları kurar. Dönen nesne testte yapılan istekleri toplar.
 * @param {object} o
 * @param {object|'hata'} [o.vakit]   /api/vakit cevabı ('hata' = ağ hatası)
 * @param {object|'hata'} [o.hutbe]   /api/hutbe cevabı
 * @param {Function|'hata'} [o.aladhan] (tarih 'GG-AA-YYYY') => cevap
 */
export async function mockla(page, o = {}) {
  const kayit = { api: [], dis: [], engellenen: [] };
  const vakit = o.vakit === undefined ? VAKIT : o.vakit;
  const hutbe = o.hutbe === undefined ? { available: false, reason: 'test' } : o.hutbe;
  const aladhan = o.aladhan === undefined ? aladhanCevap : o.aladhan;

  // önce genel dış istek yakalayıcı (sonra eklenen route'lar önceliklidir)
  const yerel = new Set(['127.0.0.1', 'localhost']);
  if (process.env.TEST_ADRES) yerel.add(new URL(process.env.TEST_ADRES).hostname);
  await page.route((u) => !yerel.has(u.hostname) && /^https?:$/.test(u.protocol), async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') return fontServis(route);
    // faaliyet resimleri (Vercel Blob): testte hep aynı dikey afiş
    if (u.hostname.endsWith('.public.blob.vercel-storage.com')) {
      return route.fulfill({ status: 200, contentType: 'image/jpeg', body: fs.readFileSync(path.join(FIX, 'poster-dikey.jpg')) });
    }
    kayit.dis.push(u.href);
    if (u.hostname === 'api.aladhan.com' && aladhan !== 'hata') {
      const m = u.pathname.match(/\/v1\/timings\/(\d{2}-\d{2}-\d{4})/);
      return json(route, aladhan(m ? m[1] : ''));
    }
    kayit.engellenen.push(u.href);
    return route.abort();
  });
  await page.route((u) => u.pathname === '/api/vakit' || u.pathname.startsWith('/api/vakit/'), (route) => {
    kayit.api.push(new URL(route.request().url()));
    return vakit === 'hata' ? route.abort() : json(route, vakit);
  });
  await page.route((u) => u.pathname === '/api/hutbe' || u.pathname.startsWith('/api/hutbe/'), (route) => {
    kayit.api.push(new URL(route.request().url()));
    return hutbe === 'hata' ? route.abort() : json(route, hutbe);
  });
  // /api/icerik: gerçek fonksiyon (api/icerik.js) + sahte depo; o.icerikSaati = fonksiyonun "şimdi"si
  await page.route((u) => u.pathname === '/api/icerik', async (route) => {
    kayit.api.push(new URL(route.request().url()));
    if (o.icerik === 'hata') return route.abort();
    const { icerikIsleyici } = await import('../../api/icerik.js');
    const { sahteDepo, cagir } = await import('./sahte-depo.js');
    const r = await cagir(icerikIsleyici(sahteDepo(o.icerik || null), () => o.icerikSaati || Date.now()));
    return route.fulfill({ status: r.durum, contentType: 'application/json; charset=utf-8', headers: { 'cache-control': r.basliklar['cache-control'] }, body: JSON.stringify(r.govde) });
  });
  return kayit;
}

/**
 * TV'yi verilen anda açar. Saat durdurulmuş olarak döner: zaman ancak ileri()/saatGit() ile akar.
 * @param {import('@playwright/test').Page} page
 * @param {object} o
 * @param {string} o.zaman  ISO, ofsetli: '2026-10-28T10:00:00.500+01:00'
 * @param {string} [o.adres='/']
 * @param {Record<string,string>} [o.depo]  sayfa açılmadan localStorage'a yazılır (sadece ilk yükleme)
 * @param {boolean} [o.bekle=true]  vakitlerin yüklenmesini bekle
 */
export async function tvAc(page, o) {
  const T = new Date(o.zaman).getTime();
  if (Number.isNaN(T)) throw new Error('geçersiz zaman: ' + o.zaman);

  // ayet/hadis/dua seçimi Math.random kullanır: sabit tohumla her seferinde aynı sonuç
  await page.addInitScript(() => {
    let a = 20261024;
    Math.random = function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  if (o.depo) {
    await page.addInitScript((depo) => {
      if (sessionStorage.getItem('__test_depo')) return;
      for (const [k, v] of Object.entries(depo)) localStorage.setItem(k, v);
      sessionStorage.setItem('__test_depo', '1');
    }, o.depo);
  }
  const kayit = await mockla(page, o);

  await page.clock.install({ time: T - PAY_MS - 1000 });
  await page.clock.pauseAt(T - PAY_MS);           // sayfa açılmadan durdur: zamanlayıcılar hep aynı sırada
  await page.goto(o.adres || '/');
  if (o.bekle !== false) await expect(page.locator('#loading')).toBeHidden();
  await page.evaluate(() => document.fonts.ready);
  await page.clock.runFor(PAY_MS);                // tam istenen ana kadar akıt
  return kayit;
}

/** Saati ms kadar ilerlet (aradaki bütün zamanlayıcılar çalışır). */
export async function ileri(page, ms) {
  await page.clock.runFor(ms);
}

/** Saati ileri bir ana atlat (aradaki zamanlayıcılar sadece bir kez çalışır), son 1 sn'yi normal akıt. */
export async function saatGit(page, zaman) {
  const T = new Date(zaman).getTime();
  await page.clock.pauseAt(T - 1000);
  await page.clock.runFor(1000);
}

/** Ekranda yazan vakitler: { Imsak, Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha } */
export async function vakitleriOku(page) {
  return page.evaluate(() => {
    const o = {};
    for (const el of document.querySelectorAll('[data-time]')) {
      const k = el.getAttribute('data-time');
      if (!(k in o)) o[k] = el.textContent.trim();
    }
    return o;
  });
}
