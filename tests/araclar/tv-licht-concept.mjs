// Concept "wit tv-thema in app-kleuren" bekijkbaar maken: kopie van het echte tv-scherm (index.html)
// + de kleuren uit ontwerp/tv-licht-app.css → ontwerp/TV-Licht-Concept.html (dubbelklik om te openen).
// index.html zelf wordt NIET veranderd. Draaien: cd tests && node araclar/tv-licht-concept.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const lees = (p) => fs.readFileSync(path.join(KOK, p), 'utf8');
let html = lees('index.html');
const css = lees('ontwerp/tv-licht-app.css');
const vakit = lees('tests/fixtures/vakit.json').trim();

// Voorbeeld-gebedstijden (Diyanet, 23-10 t/m 23-11-2026) in plaats van /api/vakit; geen preek.
const stub = `<!-- CONCEPT: kopie van het echte tv-scherm met de kleuren uit ontwerp/tv-licht-app.css.
     Alleen om te bekijken. Indeling en lettertypen zijn ongewijzigd. Gemaakt door tests/araclar/tv-licht-concept.mjs. -->
<script>
(function () {
  if (!/[?&]theme=/.test(location.search)) history.replaceState(null, '', location.pathname + '?theme=light' + location.hash);
  var VAKIT = ${JSON.stringify(vakit)};
  var echt = window.fetch.bind(window);
  window.fetch = function (u, o) {
    var s = String((u && u.url) || u);
    if (s.indexOf('/api/vakit') >= 0) return Promise.resolve(new Response(VAKIT, { status: 200, headers: { 'Content-Type': 'application/json' } }));
    if (s.indexOf('/api/hutbe') >= 0) return Promise.resolve(new Response('{"available":false}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    return echt(u, o);
  };
})();
</script>
`;
const meta = '<meta charset="utf-8" />';
if (!html.includes(meta)) throw new Error('meta charset niet gevonden');
html = html.replace(meta, () => `${meta}\n${stub}`);
html = html.replace('</head>', () => `<style>\n${css}\n</style>\n</head>`);
fs.writeFileSync(path.join(KOK, 'ontwerp', 'TV-Licht-Concept.html'), html);
console.log('geschreven: ontwerp/TV-Licht-Concept.html');
