// Meldingen (Faz D): geheime VAPID-sleutel maken. De gebruiker draait dit ZELF:
//   cd tests
//   node araclar/vapid.mjs
// De sleutel komt alleen op het klembord (niet op het scherm, niet in een bestand).
// Daarna in Vercel plakken als VAPID_PRIVATE_KEY (Sensitive). De openbare sleutel
// berekent de server zelf uit de geheime sleutel; die hoeft nergens ingevuld te worden.
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Nieuwe P-256 sleutel: { geheim (32 bayt), openbaar (65 bayt) } — base64url, zoals web-push verwacht. */
export function vapidSleutels() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pub = publicKey.export({ format: 'jwk' });
  const priv = privateKey.export({ format: 'jwk' });
  const b = (s) => Buffer.from(s, 'base64url');
  return {
    geheim: priv.d,
    openbaar: Buffer.concat([Buffer.from([4]), b(pub.x), b(pub.y)]).toString('base64url'),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { geheim } = vapidSleutels();
  const r = process.platform === 'win32' ? spawnSync('clip', { input: geheim })
    : spawnSync(process.platform === 'darwin' ? 'pbcopy' : 'xclip', process.platform === 'darwin' ? [] : ['-selection', 'clipboard'], { input: geheim });
  if (r.status !== 0) {
    console.error('Kon het klembord niet gebruiken. Er is niets bewaard; probeer het opnieuw.');
    process.exit(1);
  }
  console.log('Klaar. De geheime sleutel staat op het klembord.');
  console.log('Plak hem nu in Vercel: Settings > Environment Variables > Key: VAPID_PRIVATE_KEY (Sensitive aan).');
}
