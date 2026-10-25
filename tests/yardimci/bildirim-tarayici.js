// Faz D, tarayıcı testleri: /api/bildirim/* GERÇEK fonksiyonlara gider (sahte Upstash/QStash ile).
// Tarayıcının push servisi (FCM) testte yok: Notification ve PushManager taklit edilir.
import { anahtarIsleyici } from '../../api/bildirim/anahtar.js';
import { aboneIsleyici } from '../../api/bildirim/abone.js';
import { cagir } from './sahte-depo.js';
import { sahteOrtam, testAboneligi } from './sahte-bildirim.js';

/**
 * @param {import('@playwright/test').Page} page
 * @param {object} o
 * @param {string} o.zaman                 sunucunun "şimdi"si
 * @param {boolean} [o.aktif=true]         sunucu kurulmuş mu
 * @param {'default'|'granted'|'denied'} [o.izin='default']  başlangıçtaki izin
 * @param {'granted'|'denied'} [o.izinCevabi='granted']      izin penceresinde verilen cevap
 * @param {boolean} [o.destek=true]        tarayıcı Web Push destekliyor mu (false: iPhone Safari, ana ekranda değil)
 * @param {boolean} [o.onceden=false]     bu cihaz daha önce abone olmuş (izin verilmiş, abonelik var)
 */
export async function bildirimKur(page, o) {
  const T = new Date(o.zaman).getTime();
  const ortam = { ...sahteOrtam(), ...(o.aktif === false ? { aktif: false, eksik: ['VAPID_PRIVATE_KEY'] } : {}) };
  const istekler = [];
  const isle = async (route, handler) => {
    const req = route.request();
    const body = req.postData() ? JSON.parse(req.postData()) : undefined;
    istekler.push({ method: req.method(), yol: new URL(req.url()).pathname, body });
    const r = await cagir(handler, { method: req.method(), headers: req.headers(), body });
    return route.fulfill({ status: r.durum, contentType: 'application/json; charset=utf-8', body: JSON.stringify(r.govde) });
  };
  await page.route((u) => u.pathname === '/api/bildirim/anahtar', (r) => isle(r, anahtarIsleyici(() => ortam)));
  await page.route((u) => u.pathname === '/api/bildirim/abone', (r) => isle(r, aboneIsleyici(() => ortam, () => T)));

  const { abonelik } = testAboneligi('tarayici');
  await page.addInitScript(({ izin, izinCevabi, destek, keys, endpoint, onceden }) => {
    window.__test = { izinSorulan: 0, aboneOlunan: 0, aboneliktenCikilan: 0 };
    if (onceden && !sessionStorage.getItem('__onceden')) {
      sessionStorage.setItem('__onceden', '1');
      sessionStorage.setItem('__izin', 'granted');
      sessionStorage.setItem('__abonelik', JSON.stringify({ endpoint, anahtar: onceden }));
    }
    if (!destek) {
      delete window.Notification;
      delete window.PushManager;
      return;
    }
    let perm = sessionStorage.getItem('__izin') || izin;
    class SahteNotification {
      static get permission() { return perm; }
      static async requestPermission() {
        window.__test.izinSorulan++;
        perm = izinCevabi;
        sessionStorage.setItem('__izin', perm);
        return perm;
      }
    }
    Object.defineProperty(window, 'Notification', { value: SahteNotification, configurable: true, writable: true });
    window.PushManager = window.PushManager || function PushManager() {};
    const kayitli = () => { try { return JSON.parse(sessionStorage.getItem('__abonelik') || 'null'); } catch { return null; } };
    const nesne = (v) => v && {
      endpoint: v.endpoint,
      options: { applicationServerKey: Uint8Array.from(atob(v.anahtar), (c) => c.charCodeAt(0)).buffer },
      toJSON: () => ({ endpoint: v.endpoint, expirationTime: null, keys }),
      unsubscribe: async () => { window.__test.aboneliktenCikilan++; sessionStorage.removeItem('__abonelik'); return true; },
    };
    const pushManager = {
      getSubscription: async () => nesne(kayitli()),
      subscribe: async (opt) => {
        if (perm !== 'granted') throw new DOMException('izin yok', 'NotAllowedError');
        window.__test.aboneOlunan++;
        const anahtar = btoa(String.fromCharCode(...new Uint8Array(opt.applicationServerKey)));
        sessionStorage.setItem('__abonelik', JSON.stringify({ endpoint, anahtar }));
        return nesne(kayitli());
      },
    };
    Object.defineProperty(ServiceWorkerContainer.prototype, 'ready', { get: () => Promise.resolve({ pushManager }), configurable: true });
  }, { izin: o.izin || 'default', izinCevabi: o.izinCevabi || 'granted', destek: o.destek !== false, keys: abonelik.keys, endpoint: abonelik.endpoint,
    onceden: o.onceden ? Buffer.from(ortam.vapid.publicKey, 'base64url').toString('base64') : '' });

  const kayitlar = () => {
    const h = ortam._.redis.hash.get('nzm:preview:aboneler');
    return h ? [...h.values()].map((v) => JSON.parse(v)) : [];
  };
  return { ortam, istekler, kayitlar, abonelik };
}
