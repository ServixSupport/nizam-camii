// Vercel serverless functie: haalt de nieuwste Nederlandse vrijdagpreek-samenvatting
// van diyanet.nl, extraheert de tekst, filtert het Arabische deel eruit en geeft JSON terug.
//
// Regels:
// - Alleen teruggeven als er een samenvatting is voor de meest recente vrijdag.
// - Als er niets (recents) is: { available: false }.
//
// De frontend bepaalt zelf WANNEER de preek getoond wordt (10 min na Öğle, ~10 min lang).

const OVERVIEW_URL = "https://diyanet.nl/cuma-hutbeleri/";

// hoeveel dagen oud mag de nieuwste samenvatting maximaal zijn om nog "deze week" te zijn
const MAX_AGE_DAYS = 8;

export default async function handler(req, res) {
  // CORS zodat het scherm (zelfde of andere origin) het mag ophalen
  res.setHeader("Access-Control-Allow-Origin", "*");
  // cache 1 uur op de edge, want de pagina verandert maar 1x per week
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");

  try {
    // 1) overzichtspagina ophalen
    const pageRes = await fetch(OVERVIEW_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NizamCamiiScreen/1.0)" },
    });
    if (!pageRes.ok) throw new Error("overzichtspagina niet bereikbaar");
    const html = await pageRes.text();

    // 2) alle "Nederlands (samenvatting)" links met hun datum eruit halen
    //    patroon in de pagina: <a href="...pdf">DD-MM-JJJJ Nederlands (samenvatting)</a>
    const entries = [];
    const linkRe = /<a[^>]+href="([^"]+\.pdf)"[^>]*>\s*(\d{2})[.\-](\d{2})[.\-](\d{4})[^<]*Nederlands\s*\(samenvatting\)/gi;
    let m;
    while ((m = linkRe.exec(html)) !== null) {
      const [, url, dd, mm, yyyy] = m;
      const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      entries.push({ url, date, label: `${dd}.${mm}.${yyyy}` });
    }

    if (entries.length === 0) {
      return res.status(200).json({ available: false, reason: "geen samenvatting-links gevonden" });
    }

    // 3) nieuwste datum kiezen
    entries.sort((a, b) => b.date - a.date);
    const latest = entries[0];

    // 4) check: is deze samenvatting recent genoeg (deze week)?
    const ageDays = (Date.now() - latest.date.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > MAX_AGE_DAYS) {
      return res.status(200).json({ available: false, reason: "geen recente samenvatting", latest: latest.label });
    }

    // 5) PDF ophalen en tekst extraheren
    const pdfText = await extractPdfText(latest.url);
    if (!pdfText) {
      return res.status(200).json({ available: false, reason: "pdf-tekst niet leesbaar", latest: latest.label });
    }

    // 6) Nederlandse tekst opschonen + structureren
    const parsed = parseHutbe(pdfText, latest.label);
    if (!parsed.paragraphs.length) {
      return res.status(200).json({ available: false, reason: "geen nederlandse tekst", latest: latest.label });
    }

    return res.status(200).json({ available: true, ...parsed });
  } catch (err) {
    return res.status(200).json({ available: false, reason: "fout: " + err.message });
  }
}

// ---- PDF tekst-extractie via pdfjs-dist (legacy build werkt serverless) ----
async function extractPdfText(url) {
  const pdfRes = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; NizamCamiiScreen/1.0)" },
  });
  if (!pdfRes.ok) return null;
  const buf = new Uint8Array(await pdfRes.arrayBuffer());

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // In een serverless omgeving is er geen aparte worker-module beschikbaar.
  // Forceer pdf.js om alles in de hoofd-thread te doen (geen losse worker laden).
  const doc = await pdfjs.getDocument({
    data: buf,
    useSystemFonts: true,
    disableWorker: true,
    isEvalSupported: false,
  }).promise;

  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // groepeer per regel op basis van y-positie
    const lines = {};
    for (const item of content.items) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5]);
      (lines[y] = lines[y] || []).push(item.str);
    }
    const ys = Object.keys(lines).map(Number).sort((a, b) => b - a);
    for (const y of ys) text += lines[y].join(" ") + "\n";
    text += "\n";
  }
  return text;
}

// ---- Nederlandse tekst isoleren en in paragrafen opdelen ----
function isDutchLine(line) {
  const letters = (line.match(/[a-zA-ZàáâäèéêëìíîïòóôöùúûüçñğışÀ-ÿ]/g) || []).length;
  const arabic = (line.match(/[\u0600-\u06FF]/g) || []).length;
  return letters > arabic && letters >= 3;
}

function parseHutbe(raw, dateLabel) {
  const allLines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  // titel: eerste blok HOOFDLETTER-regels dat Nederlands is (na de Arabische opening)
  let title = "";
  const titleParts = [];
  let bodyStartIdx = 0;
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    if (/^Beste\b/i.test(line)) { bodyStartIdx = i; break; }
    // hoofdletter-titelregels (minstens deels), Nederlands, niet de "DATUM"/"Vrijdagpreek" header
    if (
      isDutchLine(line) &&
      !/vrijdagpreek|samenvatting|datum/i.test(line) &&
      line === line.toUpperCase() &&
      line.length > 5
    ) {
      titleParts.push(line);
    }
  }
  title = titleParts.join(" ").replace(/\s+/g, " ").trim();
  // nette hoofdletter/kleine-letter titel (Title Case light): laat zoals het is maar trim
  if (!title) title = "Vrijdagpreek";

  // body: vanaf "Beste..." tot we bij bron/footer komen
  const paragraphs = [];
  let buffer = [];
  const flush = (type) => {
    const text = buffer.join(" ").replace(/\s+/g, " ").trim();
    if (text) paragraphs.push({ type: type || "p", text });
    buffer = [];
  };

  for (let i = bodyStartIdx; i < allLines.length; i++) {
    let line = allLines[i];

    // stop bij footer/bron
    if (/Islamitisch[e]?\s+Stichting\s+Nederland/i.test(line)) { flush(); break; }
    // sla voetnoot-regels en losse cijfers over
    if (/^\d+$/.test(line)) continue;
    if (/^(İnşirâh|Ahmed b\.|Tirmizî|Buhârî|Müslim|Müsned)/i.test(line)) continue;
    // sla niet-Nederlandse (Arabische) regels over
    if (!isDutchLine(line)) continue;

    // aanhef = nieuwe lead-paragraaf
    if (/^Beste\b/i.test(line)) {
      flush();
      paragraphs.push({ type: "lead", text: line });
      continue;
    }

    buffer.push(line);

    // einde paragraaf als regel eindigt op . ? ! en de volgende een nieuwe gedachte is
    // (eenvoudige heuristiek: bij dubbele leestekens of duidelijke zinseinden splitsen we niet te fijn)
  }
  flush();

  // citaten herkennen: paragrafen die met een aanhalingsteken beginnen → quote
  for (const p of paragraphs) {
    if (p.type === "p" && /^[“"']/.test(p.text)) p.type = "quote";
  }

  return { date: dateLabel, title, paragraphs };
}
