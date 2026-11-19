// Mağaza uygulamasının simgesi (kullanıcı isteği, 19-11-2026): logodaki gül yerine ezanı çağrıştıran ses dalgaları.
// Uygulamanın içindeki logo (temalardaki) değişmez; sadece uygulama simgesi (ana ekran, bildirimler, mağaza).
// Kaynak: mobil/ikon-512.png → app/simge/ikon-ezan-512.png ve ikon-ezan-maskable-512.png (app-simgeler.mjs bunları kullanır).
// Kullanım: cd tests && node araclar/app-simge-ezan.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CIKTI = path.join(KOK, 'app/simge');
const kaynak = 'data:image/png;base64,' + fs.readFileSync(path.join(KOK, 'mobil/ikon-512.png')).toString('base64');

const tarayici = await chromium.launch();
const sayfa = await tarayici.newPage();
await sayfa.setContent('<canvas></canvas>');
const [duz, maskable] = await sayfa.evaluate(async (src) => {
  const resim = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.drawImage(resim, 0, 0, 512, 512);

  // 1) gülü sil: iki minarenin arasında, kubbenin üstünde zemin renginden farklı her piksel zemin rengine
  const zemin = x.getImageData(4, 4, 1, 1).data;
  const KUTU = { x0: 178, x1: 334, y0: 30, y1: 312 };
  const v = x.getImageData(KUTU.x0, KUTU.y0, KUTU.x1 - KUTU.x0, KUTU.y1 - KUTU.y0);
  for (let i = 0; i < v.data.length; i += 4) {
    const fark = Math.abs(v.data[i] - zemin[0]) + Math.abs(v.data[i + 1] - zemin[1]) + Math.abs(v.data[i + 2] - zemin[2]);
    if (fark > 6) { v.data[i] = zemin[0]; v.data[i + 1] = zemin[1]; v.data[i + 2] = zemin[2]; v.data[i + 3] = 255; }
  }
  x.putImageData(v, KUTU.x0, KUTU.y0);

  // 2) ses dalgaları: ortada (kubbenin üstünde) iki yana yayılan üçer yay, logonun kırmızısı; ortada yeşil nokta
  const KIRMIZI = '#D13027', YESIL = '#1F6B35';
  const mx = 256, my = 214;
  x.lineCap = 'round';
  x.strokeStyle = KIRMIZI;
  const ac = (34 * Math.PI) / 180;
  for (const [r, w] of [[30, 14], [52, 14], [74, 14]]) {
    x.lineWidth = w;
    x.beginPath(); x.arc(mx, my, r, -ac, ac); x.stroke();                     // sağ
    x.beginPath(); x.arc(mx, my, r, Math.PI - ac, Math.PI + ac); x.stroke();   // sol
  }
  x.fillStyle = YESIL;
  x.beginPath(); x.arc(mx, my, 12, 0, Math.PI * 2); x.fill();

  // 3) maskable: aynı logo küçültülmüş (güvenli daire içinde), kenarlar zemin renginde
  const m = document.createElement('canvas');
  m.width = m.height = 512;
  const mxx = m.getContext('2d');
  mxx.fillStyle = `rgb(${zemin[0]},${zemin[1]},${zemin[2]})`;
  mxx.fillRect(0, 0, 512, 512);
  mxx.imageSmoothingQuality = 'high';
  const k = 512 * 0.735;
  mxx.drawImage(c, (512 - k) / 2, (512 - k) / 2, k, k);
  return [c.toDataURL('image/png').split(',')[1], m.toDataURL('image/png').split(',')[1]];
}, kaynak);
await tarayici.close();

fs.mkdirSync(CIKTI, { recursive: true });
fs.writeFileSync(path.join(CIKTI, 'ikon-ezan-512.png'), Buffer.from(duz, 'base64'));
fs.writeFileSync(path.join(CIKTI, 'ikon-ezan-maskable-512.png'), Buffer.from(maskable, 'base64'));
console.log('simge hazır: app/simge/ikon-ezan-512.png, ikon-ezan-maskable-512.png');
