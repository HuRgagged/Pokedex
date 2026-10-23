// Service Worker: macht die Seite offline nutzbar
// - Seite selbst (HTML, CSS, JS, Daten): zuerst aus dem Netz holen, ohne Netz aus dem Speicher
// - Bilder, Schriften, QR-Bibliothek: einmal geladen, danach aus dem Speicher
// Kartendaten und Häkchen speichert die App selbst im Browser (localStorage).

const SEITE = 'natdex-seite-v1';
const DATEIEN = 'natdex-dateien-v1';
const MAX_DATEIEN = 2500; // so viele Bilder höchstens aufheben

const GRUNDGERUEST = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'data/pokemon-namen.js', 'data/pokemon-typen.js', 'data/pokemon-gruppen.js',
  'icons/icon-192.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
];
const FREMDE_DATEIEN = ['wsrv.nl', 'assets.tcgdex.net', 'raw.githubusercontent.com',
  'fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SEITE).then((c) => c.addAll(GRUNDGERUEST)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n.startsWith('natdex-') && n !== SEITE && n !== DATEIEN).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const anfrage = e.request;
  if (anfrage.method !== 'GET') return; // z. B. Kartendaten-Abfrage (POST) – darum kümmert sich die App
  const url = new URL(anfrage.url);

  if (url.origin === self.location.origin) {
    e.respondWith(netzZuerst(anfrage));
  } else if (FREMDE_DATEIEN.includes(url.hostname)) {
    e.respondWith(speicherZuerst(anfrage));
  }
  // alles andere (z. B. Kartenpreise von api.tcgdex.net) geht normal ins Netz
});

async function netzZuerst(anfrage) {
  const speicher = await caches.open(SEITE);
  try {
    const antwort = await fetch(anfrage);
    if (antwort.ok) speicher.put(anfrage, antwort.clone());
    return antwort;
  } catch (fehler) {
    const gespeichert = await speicher.match(anfrage, { ignoreSearch: true });
    if (gespeichert) return gespeichert;
    if (anfrage.mode === 'navigate') return speicher.match('index.html');
    throw fehler;
  }
}

let seitAufraeumen = 0;
async function speicherZuerst(anfrage) {
  const speicher = await caches.open(DATEIEN);
  const gespeichert = await speicher.match(anfrage.url);
  if (gespeichert) return gespeichert;
  // als CORS-Anfrage holen: so lässt sich das Bild platzsparend speichern
  let antwort;
  try {
    antwort = await fetch(anfrage.url, { mode: 'cors', credentials: 'omit' });
  } catch (fehler) {
    return fetch(anfrage); // Notlösung: normal laden, dann eben ohne Speichern
  }
  if (antwort.ok) {
    await speicher.put(anfrage.url, antwort.clone());
    if (++seitAufraeumen >= 50) { seitAufraeumen = 0; raeumeAuf(speicher); }
  }
  return antwort;
}

async function raeumeAuf(speicher) {
  const eintraege = await speicher.keys();
  const zuViel = eintraege.length - MAX_DATEIEN;
  for (let i = 0; i < zuViel; i++) await speicher.delete(eintraege[i]); // älteste zuerst
}
