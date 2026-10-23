// Mein Pokédex – deutsche Pokémon-Karten sammeln
// Daten: TCGdex (deutsch), Namen & Typen: data/pokemon-namen.js, data/pokemon-typen.js

const ANZAHL_POKEMON = POKEMON_NAMEN.length; // 1025
const SPEICHER_HAKEN = 'natdex:haken';       // gespeicherte Häkchen (nie umbenennen!)
const SPEICHER_DATEN = 'natdex:daten-v2';    // Cache der Kartendaten
const DATEN_MAX_ALTER_TAGE = 7;
const AKTUELL_MONATE = 24;
const API = 'https://api.tcgdex.net/v2/graphql';
const SPEICHER_ANSICHT = 'natdex:ansicht';   // Einstellungen „Ansicht“
const SPEICHER_SESSION = 'natdex:session';   // laufende Booster-Session
const SPEICHER_PREISE = 'natdex:preise';     // Cache der Kartenwerte
const PREIS_MAX_ALTER_TAGE = 3;
const WERTVOLL_AB = 10;                      // ab so vielen Euro wird der Preis golden

const REGIONEN = [
  ['Kanto', 1, 151], ['Johto', 152, 251], ['Hoenn', 252, 386], ['Sinnoh', 387, 493],
  ['Einall', 494, 649], ['Kalos', 650, 721], ['Alola', 722, 809], ['Galar', 810, 905],
  ['Paldea', 906, 1025],
];

const TYP_DE = {
  normal: 'Normal', fire: 'Feuer', water: 'Wasser', electric: 'Elektro', grass: 'Pflanze',
  ice: 'Eis', fighting: 'Kampf', poison: 'Gift', ground: 'Boden', flying: 'Flug',
  psychic: 'Psycho', bug: 'Käfer', rock: 'Gestein', ghost: 'Geist', dragon: 'Drache',
  dark: 'Unlicht', steel: 'Stahl', fairy: 'Fee',
};

// Ziehchance-Gewichte nach Seltenheit (deutsche TCGdex-Bezeichnungen)
const GEWICHTE = {
  'Häufig': 1, 'Ungewöhnlich': 1,
  'Selten': 0.5, 'Holografisch Selten': 0.5, 'Selten, Holografisch': 0.5,
  'Doppelselten': 0.25, 'Ultra Selten': 0.25, 'Holografisch Selten V': 0.25,
  'Holografisch Selten VMAX': 0.25, 'Holografisch Selten VSTAR': 0.25,
  'Selten, Holografisch LV.X': 0.25, 'selten, Primus': 0.25, 'LEGENDE': 0.25,
  'ASS-KLASSE': 0.25, 'Selten, Strahlend': 0.25, 'Schwarz-Weiß Selten': 0.25,
  'Selten, Illustration': 0.05, 'Selten, besondere Illustration': 0.05,
  'Versteckt Selten': 0.05, 'Hyperselten': 0.05, 'Shiny rare': 0.05,
  'Shiny rare V': 0.05, 'Shiny rare VMAX': 0.05, 'ultraselten, Schillernd': 0.05,
  'Atemberaubend': 0.05, 'Mega Hyper Selten': 0.05, 'Mega Attack Rare': 0.05,
  'Vollkunsttrainer': 0.05, 'Pikachu Rare': 0.05, 'RGB Rare': 0.05, 'Futuristic Rare': 0.05,
  'Promo': 0, 'Keine': 0,
};
const gewicht = (seltenheit) => (seltenheit in GEWICHTE ? GEWICHTE[seltenheit] : 0.25);
const gewichtKlasse = (w) => (w >= 1 ? 'w1' : w >= 0.5 ? 'w2' : w >= 0.25 ? 'w3' : w > 0 ? 'w4' : '');

// Sets, die nicht aus Boostern kommen
const KEINE_BOOSTER = new Set([
  'basep', 'dpp', 'hgssp', 'bwp', 'xyp', 'smp', 'swshp', 'svp', 'mep',
  'sve', 'mee', 'xya',
]);
// Subsets, die in den Boostern eines Haupt-Sets stecken
const TEIL_VON = {
  exu: 'ex10', sma: 'sm115', 'swsh4.5sv': 'swsh4.5', cel25cc: 'cel25',
  swsh9tg: 'swsh9', swsh10tg: 'swsh10', swsh11tg: 'swsh11', swsh12tg: 'swsh12',
  'swsh12.5gg': 'swsh12.5', '30th-c': '30th',
};

// ---------- Trophäen ----------
// bild = Pokémon, dessen Artwork die Medaille ziert
const bereich = (von, bis) => Array.from({ length: bis - von + 1 }, (_, i) => von + i);
const MEDAILLEN_TYP_BILD = {
  normal: 143, fire: 6, water: 9, electric: 25, grass: 3, ice: 471, fighting: 68, poison: 89,
  ground: 50, flying: 18, psychic: 65, bug: 123, rock: 95, ghost: 94, dragon: 149, dark: 197,
  steel: 376, fairy: 700,
};
const REGION_BILD = [150, 250, 384, 493, 643, 716, 791, 888, 1007];
const TROPHAEEN = [
  ...[[1, 25, 'Erster Fang'], [10, 16, 'Anfänger'], [50, 133, 'Sammler'], [100, 130, 'Fortgeschritten'],
    [250, 149, 'Profi'], [500, 249, 'Experte'], [750, 384, 'Champion'], [1025, 151, 'Pokémon-Meister']]
    .map(([ziel, bild, titel]) => ({
      id: 'anzahl-' + ziel, gruppe: 'Meilensteine', titel, text: `${ziel} Pokémon gefangen`,
      bild, ziel, stand: () => haken.size,
    })),
  ...REGIONEN.map(([region, von, bis], i) => ({
    id: 'region-' + i, gruppe: 'Regionen', titel: `${region}-Orden`, text: `Alle ${bis - von + 1} Pokémon aus ${region}`,
    bild: REGION_BILD[i], liste: bereich(von, bis),
  })),
  ...[
    ['starter', 'Starter-Trio', 'Alle Starter-Pokémon von Kanto bis Paldea', 658,
      [1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501, 650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912]],
    ['evoli', 'Evoli-Familie', 'Evoli und alle Entwicklungen', 133, [133, 134, 135, 136, 196, 197, 470, 471, 700]],
    ['pseudo', 'Pseudo-Legenden', 'Alle Pseudo-Legendären', 445, [149, 248, 373, 376, 445, 635, 706, 784, 887, 998]],
    ['legendaer', 'Legenden', 'Alle legendären Pokémon', 150, POKEMON_GRUPPEN.legendaer],
    ['mysterioes', 'Mysteriös', 'Alle mysteriösen Pokémon', 151, POKEMON_GRUPPEN.mysterioes],
    ['ultra', 'Ultrabestien', 'Alle Ultrabestien', 794, [793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806]],
    ['paradox', 'Paradox-Zeit', 'Alle Paradox-Pokémon', 984, [...bereich(984, 995), 1005, 1006, 1009, 1010, 1020, 1021, 1022, 1023]],
  ].map(([id, titel, text, bild, liste]) => ({ id, gruppe: 'Besondere Gruppen', titel, text, bild, liste })),
  ...Object.keys(MEDAILLEN_TYP_BILD).map((typ) => ({
    id: 'typ-' + typ, gruppe: 'Typen', titel: `${TYP_DE[typ]}-Meister`, text: `Alle Pokémon vom Typ ${TYP_DE[typ]}`,
    bild: MEDAILLEN_TYP_BILD[typ], typ,
    liste: bereich(1, ANZAHL_POKEMON).filter((d) => POKEMON_TYPEN[d - 1].includes(typ)),
  })),
];
for (const t of TROPHAEEN) {
  if (t.liste) { t.ziel = t.liste.length; t.stand = () => t.liste.filter((d) => haken.has(d)).length; }
}
const freigeschaltet = () => new Set(TROPHAEEN.filter((t) => t.stand() >= t.ziel).map((t) => t.id));

// ---------- Zustand ----------
let daten = null;          // { geladen, sets: {id: {...}}, karten: [...] }
let kartenProDex = [];     // Index = dexId → Liste von Karten
let haken = new Set();     // gefangene dexIds
let offenesSet = null;     // aufgeklapptes Set im Ranking
let statusFilter = 'alle';
let detailDex = null;      // gerade geöffnetes Pokémon
let infoOffen = false;     // Pokémon-Infos in der Detailansicht aufgeklappt?
let pokemonInfo = null;    // data/pokemon-info.json, wird beim ersten Öffnen geladen
let pokemonInfoLaedt = null;
let rankingTimer = null;
let ansicht = { kachel: 'mittel', fehlend: 'silhouette', sortierung: 'nummer', preise: 'an' };
let gruppen = [];          // aktuelle Abschnitte im Pokédex: { titel, liste }
let booster = null;        // laufende Session: { setId, start, startHaken, startTrophaeen, reihenfolge }
let preise = {};           // Karten-ID → [Euro oder null, Zeitpunkt]
let kartenNachId = new Map(); // Karten-ID („set-nummer“) → Karte
let galerie = new Map();   // Karten-ID → Zeitpunkt, an dem sie in die Galerie kam
let galerieSort = 'neu';
const SPEICHER_GALERIE = 'natdex:galerie';  // Karten-Galerie (nie umbenennen!)

// ---------- Speichern ----------
function ladeHaken() {
  try {
    const roh = JSON.parse(localStorage.getItem(SPEICHER_HAKEN) || 'null');
    if (roh && Array.isArray(roh.haken)) haken = new Set(roh.haken.filter(Number.isInteger));
  } catch (e) { console.warn('Häkchen konnten nicht geladen werden', e); }
}
function speichereHaken() {
  try {
    localStorage.setItem(SPEICHER_HAKEN, JSON.stringify({
      version: 1, geaendert: new Date().toISOString(), haken: [...haken].sort((a, b) => a - b),
    }));
  } catch (e) { alert('Speichern fehlgeschlagen – bitte ein Backup exportieren!'); }
}

// ---------- Kartendaten von TCGdex ----------
async function holeDatenVonApi() {
  const query = `query {
    sets @locale(lang: "de") { id name releaseDate logo serie { id name } }
    cards @locale(lang: "de") { id localId name rarity category dexId image set { id name } }
  }`;
  const antwort = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!antwort.ok) throw new Error('TCGdex antwortet mit ' + antwort.status);
  const json = await antwort.json();
  if (!json.data || !json.data.cards) throw new Error('Unerwartete Antwort von TCGdex');

  const sets = {};
  for (const s of json.data.sets) {
    if (s.serie.id === 'tcgp') continue; // TCG Pocket = digital
    sets[s.id] = {
      name: s.name, datum: s.releaseDate || '', serie: s.serie.id, serieName: s.serie.name || '', logo: s.logo || '',
      booster: !KEINE_BOOSTER.has(s.id) && !TEIL_VON[s.id],
    };
  }
  const karten = [];
  for (const k of json.data.cards) {
    if (!k.dexId || !k.dexId.length) continue;
    const setId = k.set.id;
    if (!sets[setId]) {
      // Set ohne deutschen Eintrag (z. B. POP, McDonald's) – Karte trotzdem zeigen
      if (/^[AB]\d|^P-A/.test(setId)) continue; // Pocket-Reste
      sets[setId] = { name: k.set.name, datum: '', serie: '', serieName: 'Promo', logo: '', booster: false, fremd: true };
    }
    // kompakt: [setId, nummer, name, seltenheit, dexIds, hatDeutschesBild]
    karten.push([setId, k.localId, k.name, k.rarity || 'Keine', k.dexId, k.image ? 1 : 0]);
  }
  return { geladen: Date.now(), sets, karten };
}

function ladeDatenAusCache() {
  try {
    const roh = localStorage.getItem(SPEICHER_DATEN);
    return roh ? JSON.parse(roh) : null;
  } catch (e) { return null; }
}
function speichereDatenImCache(d) {
  try { localStorage.setItem(SPEICHER_DATEN, JSON.stringify(d)); }
  catch (e) { console.warn('Kartendaten-Cache zu groß, wird nicht gespeichert', e); }
}

function baueIndex() {
  kartenNachId = new Map(daten.karten.map((k) => [`${k[0]}-${k[1]}`, k]));
  kartenProDex = Array.from({ length: ANZAHL_POKEMON + 1 }, () => []);
  for (const k of daten.karten) {
    for (const dex of k[4]) if (dex >= 1 && dex <= ANZAHL_POKEMON) kartenProDex[dex].push(k);
  }
  // neueste Sets zuerst – die bekommt man am ehesten noch
  const datum = (k) => daten.sets[k[0]].datum || '0000';
  for (const liste of kartenProDex) liste.sort((a, b) => datum(b).localeCompare(datum(a)));
}

async function ladeDaten(erzwingen = false) {
  const hinweis = document.getElementById('lade-hinweis');
  try { localStorage.removeItem('natdex:daten-v1'); } catch (e) {} // alter Cache
  const cache = ladeDatenAusCache();
  const frisch = cache && Date.now() - cache.geladen < DATEN_MAX_ALTER_TAGE * 864e5;
  if (cache && !erzwingen) {
    daten = cache; baueIndex(); datenGeladen();
    hinweis.hidden = true;
    if (frisch) return;
  }
  try {
    const neu = await holeDatenVonApi();
    daten = neu; speichereDatenImCache(neu); baueIndex(); datenGeladen();
    hinweis.hidden = true;
  } catch (e) {
    console.error(e);
    if (!daten) {
      hinweis.textContent = 'Kartendaten konnten nicht geladen werden (' + e.message + '). Prüfe deine Internetverbindung und lade die Seite neu.';
      hinweis.classList.add('fehler');
    }
  }
  zeichneDatenStatus();
}

function datenGeladen() {
  if (aktiveAnsicht() === 'ranking') zeichneRanking();
  if (detailDex) zeichneDetail(detailDex);
  zeichneDatenStatus();
}

// ---------- Hilfen ----------
const nr = (dex) => '#' + String(dex).padStart(4, '0');
const name = (dex) => POKEMON_NAMEN[dex - 1];
const typen = (dex) => POKEMON_TYPEN[dex - 1] || ['normal'];
const ARTWORK = (dex) => `raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dex}.png`;

function el(tag, klasse, text) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text != null) e.textContent = text;
  return e;
}
// Artwork über einen Bild-Proxy verkleinert (~10 KB statt ~130 KB), Original als Ersatz
function artwork(dex, breite) {
  const img = el('img');
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.src = `https://wsrv.nl/?url=${ARTWORK(dex)}&w=${breite}&output=webp`;
  img.onerror = () => { img.onerror = null; img.src = 'https://' + ARTWORK(dex); };
  return img;
}
function ball() {
  const box = el('span', 'ball-box');
  box.innerHTML = '<svg class="ball" aria-hidden="true"><use href="#ball"/></svg>';
  return box;
}
// Booster-Name; heißt das Set wie seine Serie (z. B. „Mega-Entwicklung“), ist es das Grundset
const setName = (set) => (set.serieName && set.name === set.serieName ? `${set.name} (Grundset)` : set.name);

function bildUrl(k, sprache = 'de', groesse = 'low') {
  const set = daten.sets[k[0]];
  if (!set.serie) return '';
  return `https://assets.tcgdex.net/${sprache}/${set.serie}/${k[0]}/${k[1]}/${groesse}.webp`;
}

// Eine Pokémon-Kachel: Antippen öffnet Details, der Pokéball fängt
function kachel(dex, breite = 200, zusatz = null) {
  const k = el('div', `kachel t-${typen(dex)[0]}` + (haken.has(dex) ? ' an' : ''));
  k.dataset.dex = dex;
  const oeffnen = el('button', 'kachel-oeffnen');
  oeffnen.type = 'button';
  oeffnen.setAttribute('aria-label', `${name(dex)} anzeigen`);
  oeffnen.append(artwork(dex, breite), el('span', 'kachel-nr', nr(dex)), el('span', 'kachel-name', name(dex)));
  if (zusatz) oeffnen.append(zusatz);
  const fang = el('button', 'kachel-fang');
  fang.type = 'button';
  fang.dataset.fang = dex;
  fang.setAttribute('aria-pressed', haken.has(dex));
  fang.setAttribute('aria-label', `${name(dex)} gefangen`);
  fang.append(ball());
  k.append(oeffnen, fang);
  return k;
}

// leise = ohne Fang-Meldung (z. B. beim Rückgängigmachen)
function umschalten(dex, leise = false) {
  const jetztAn = !haken.has(dex);
  const vorher = freigeschaltet();
  if (jetztAn) haken.add(dex); else haken.delete(dex);
  speichereHaken();
  document.querySelectorAll(`[data-dex="${dex}"]`).forEach((k) => k.classList.toggle('an', jetztAn));
  document.querySelectorAll(`[data-fang="${dex}"]`).forEach((b) => {
    b.setAttribute('aria-pressed', jetztAn);
    if (jetztAn) {
      b.classList.remove('fang-animation');
      void b.offsetWidth; // Animation neu starten
      b.classList.add('fang-animation');
    }
  });
  zeichneFortschritt();
  if (booster) merkeInSession(dex, jetztAn);
  if (jetztAn && !leise) zeigeFangMeldung(dex);
  if (jetztAn) {
    for (const t of TROPHAEEN) {
      if (vorher.has(t.id) || t.stand() < t.ziel) continue;
      // Region komplett oder ganzer Dex: große Feier statt kleiner Meldung
      if (t.gruppe === 'Regionen' || t.id === 'anzahl-1025') feiern(t);
      else zeigeTrophaeenMeldung(t);
    }
  }
  if (aktiveAnsicht() === 'trophaeen') zeichneTrophaeen();
  if (statusFilter !== 'alle') filtern();
  if (detailDex === dex) zeichneDetail(dex);
  // Ranking neu berechnen – aber nicht, solange eine Set-Liste offen ist,
  // sonst springt die Liste beim Abhaken weg. Beim Zuklappen wird neu sortiert.
  if (aktiveAnsicht() === 'ranking' && !offenesSet) {
    clearTimeout(rankingTimer);
    rankingTimer = setTimeout(zeichneRanking, 700);
  }
}

// ---------- Fortschritt ----------
function zeichneFortschritt() {
  const n = haken.size;
  document.getElementById('fortschritt-text').innerHTML = `<b>${n}</b> / ${ANZAHL_POKEMON}`;
  document.getElementById('fortschritt-balken').style.width = (n / ANZAHL_POKEMON) * 100 + '%';

  // Startbereich mit Fortschrittsring
  const prozent = (n / ANZAHL_POKEMON) * 100;
  document.getElementById('held-ring').style.setProperty('--p', prozent);
  document.getElementById('held-prozent').textContent =
    (prozent > 0 && prozent < 1 ? '<1' : Math.floor(prozent)) + ' %';
  document.getElementById('held-zahl').textContent = n;
  const fehlen = ANZAHL_POKEMON - n;
  document.getElementById('held-fehlen').textContent = fehlen
    ? `Noch ${fehlen} Pokémon bis zum vollständigen National Dex.`
    : 'Du hast den National Dex vollständig!';
  document.getElementById('held-trophaeen').textContent = `${freigeschaltet().size} / ${TROPHAEEN.length}`;

  gruppen.forEach(({ liste }, i) => {
    const gefangen = liste.filter((d) => haken.has(d)).length;
    const gesamt = liste.length;
    const sektion = document.getElementById('gruppe-' + i);
    if (sektion) {
      sektion.classList.toggle('komplett', gefangen === gesamt);
      sektion.querySelector('.region-zahl').textContent = `${gefangen} / ${gesamt}`;
      sektion.querySelector('.region-balken i').style.width = (gefangen / gesamt) * 100 + '%';
    }
    const chip = document.querySelector(`#regionen [data-gruppe="${i}"] span`);
    if (chip) chip.textContent = `${gefangen}/${gesamt}`;
  });
}

// ---------- Pokédex-Gitter ----------
function berechneGruppen() {
  const alle = bereich(1, ANZAHL_POKEMON);
  if (ansicht.sortierung === 'typ') {
    return Object.keys(TYP_DE).map((typ) => ({ titel: TYP_DE[typ], liste: alle.filter((d) => typen(d)[0] === typ) }));
  }
  if (ansicht.sortierung === 'name') {
    const buchstaben = new Map();
    for (const d of alle.sort((a, b) => name(a).localeCompare(name(b), 'de'))) {
      const b = name(d).normalize('NFD')[0].toLocaleUpperCase('de'); // Ä → A
      if (!buchstaben.has(b)) buchstaben.set(b, []);
      buchstaben.get(b).push(d);
    }
    return [...buchstaben].map(([titel, liste]) => ({ titel, liste }));
  }
  return REGIONEN.map(([region, von, bis]) => ({ titel: region, liste: bereich(von, bis) }));
}

function zeichneDex() {
  gruppen = berechneGruppen();
  const gitter = document.getElementById('dex-gitter');
  const chips = document.getElementById('regionen');
  const frag = document.createDocumentFragment();
  const chipFrag = document.createDocumentFragment();
  gruppen.forEach(({ titel, liste }, i) => {
    const sektion = el('section', 'region');
    sektion.id = 'gruppe-' + i;
    const kopf = el('div', 'region-kopf');
    const balken = el('span', 'region-balken');
    balken.append(el('i'));
    kopf.append(el('h2', null, titel), el('span', 'region-zahl'), balken);
    const g = el('div', 'gitter');
    for (const dex of liste) g.append(kachel(dex));
    sektion.append(kopf, g);
    frag.append(sektion);

    const chip = el('button', null, titel);
    chip.type = 'button';
    chip.dataset.gruppe = i;
    chip.append(el('span'));
    chipFrag.append(chip);
  });
  gitter.replaceChildren(frag);
  chips.replaceChildren(chipFrag);
  chips.setAttribute('aria-label', ansicht.sortierung === 'nummer' ? 'Zu Region springen' : 'Zu Abschnitt springen');
}

function filtern() {
  const suche = document.getElementById('suche').value.trim().toLowerCase().replace(/^#0*/, '');
  let sichtbarGesamt = 0;
  document.querySelectorAll('#dex-gitter .region').forEach((sektion) => {
    let sichtbarHier = 0;
    for (const k of sektion.querySelectorAll('.kachel')) {
      const dex = +k.dataset.dex;
      let sichtbar = true;
      if (statusFilter === 'fehlend') sichtbar = !haken.has(dex);
      if (statusFilter === 'gesammelt') sichtbar = haken.has(dex);
      if (sichtbar && suche) {
        sichtbar = /^\d+$/.test(suche) ? String(dex).startsWith(suche) : name(dex).toLowerCase().includes(suche);
      }
      k.hidden = !sichtbar;
      if (sichtbar) sichtbarHier++;
    }
    sektion.hidden = !sichtbarHier;
    sichtbarGesamt += sichtbarHier;
  });
  document.getElementById('leer-hinweis').hidden = sichtbarGesamt > 0;
}

// ---------- Detailansicht ----------
function oeffneDetail(dex) {
  const warOffen = detailDex !== null;
  detailDex = dex;
  zeichneDetail(dex);
  document.getElementById('detail').hidden = false;
  document.body.style.overflow = 'hidden';
  // Zurück-Taste am Handy schließt die Details
  if (!warOffen) history.pushState({ detail: dex }, '');
}
function schliesseDetail(ueberHistory = false) {
  if (detailDex === null) return;
  detailDex = null;
  document.getElementById('detail').hidden = true;
  document.body.style.overflow = '';
  if (!ueberHistory && history.state && history.state.detail) history.back();
}

function zeichneDetail(dex) {
  const box = document.getElementById('detail-inhalt');
  const [typ1, typ2] = typen(dex);
  const gefangen = haken.has(dex);

  const kopf = el('header', `detail-kopf t-${typ1}`);
  const typBox = el('div', 'typen');
  [typ1, typ2].filter(Boolean).forEach((t) => typBox.append(el('span', 'typ', TYP_DE[t] || t)));
  const titel = el('h2', null, name(dex));
  titel.id = 'detail-name';
  const bild = artwork(dex, 400);
  bild.loading = 'eager';
  const infoHinweis = el('span', 'info-hinweis');
  infoHinweis.innerHTML = `${infoOffen ? 'Infos ausblenden' : 'Infos anzeigen'} <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
  kopf.append(el('span', 'nr', nr(dex)), bild, titel, typBox, infoHinweis);
  // ein Tipp auf den Kopf klappt die Pokémon-Infos auf
  kopf.dataset.infoUmschalten = '';
  kopf.setAttribute('role', 'button');
  kopf.tabIndex = 0;
  kopf.setAttribute('aria-expanded', infoOffen);
  kopf.setAttribute('aria-controls', 'pokemon-info');
  kopf.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); umschalteInfo(); }
  });
  const infoBox = el('section', 'pokemon-info');
  infoBox.id = 'pokemon-info';
  infoBox.hidden = !infoOffen;
  if (infoOffen) zeichneInfo(dex, infoBox);

  const fang = el('button', 'detail-fang' + (gefangen ? ' an' : ''));
  fang.type = 'button';
  fang.dataset.fang = dex;
  fang.setAttribute('aria-pressed', gefangen);
  fang.append(ball(), document.createTextNode(gefangen ? 'Gefangen' : 'Als gefangen markieren'));

  const abschnitt = el('section', 'detail-abschnitt');
  if (!daten) {
    abschnitt.append(el('p', null, 'Kartendaten werden noch geladen …'));
  } else {
    const karten = kartenProDex[dex];
    abschnitt.append(
      el('h3', null, karten.length === 1 ? '1 deutsche Karte' : `${karten.length} deutsche Karten`),
      el('p', null, karten.length ? 'Neueste Sets zuerst. Tippe auf eine Karte, um sie groß zu sehen.' : 'In TCGdex ist keine deutsche Karte dieses Pokémon eingetragen.'),
    );
    const gitter = el('div', 'karten-gitter');
    for (const k of karten) gitter.append(kartenElement(k));
    abschnitt.append(gitter);
    if (ansicht.preise === 'an' && karten.length) {
      abschnitt.append(el('p', 'preis-hinweis', 'Kartenwerte: Cardmarket-Trendpreis über TCGdex, meist alle Sprachen zusammen.'));
    }
  }
  box.replaceChildren(kopf, infoBox, fang, abschnitt);
  beobachtePreise(box);
}

// ---------- Pokémon-Infos (Größe, Gewicht, Basiswerte, Fähigkeiten, Entwicklung) ----------
const WERTE_NAMEN = ['KP', 'Angriff', 'Verteidigung', 'Sp.-Angriff', 'Sp.-Verteidigung', 'Initiative'];

function ladePokemonInfo() {
  if (pokemonInfo) return Promise.resolve(pokemonInfo);
  if (!pokemonInfoLaedt) {
    pokemonInfoLaedt = fetch('data/pokemon-info.json')
      .then((a) => { if (!a.ok) throw new Error(a.status); return a.json(); })
      .then((d) => { pokemonInfo = d; return d; })
      .catch((e) => { pokemonInfoLaedt = null; throw e; });
  }
  return pokemonInfoLaedt;
}

function umschalteInfo() {
  if (detailDex === null) return;
  infoOffen = !infoOffen;
  const box = document.getElementById('pokemon-info');
  const kopf = document.querySelector('.detail-kopf');
  box.hidden = !infoOffen;
  kopf.setAttribute('aria-expanded', infoOffen);
  kopf.querySelector('.info-hinweis').firstChild.textContent = infoOffen ? 'Infos ausblenden ' : 'Infos anzeigen ';
  if (infoOffen && !box.dataset.fertig) zeichneInfo(detailDex, box);
}

// Wechsel zu einer anderen Entwicklungsstufe mit Animation:
// das kleine Bild fliegt nach oben ins große Kopfbild und leuchtet dabei weiß auf (wie in den Spielen)
function wechsleZuEntwicklung(dex, knopf) {
  if (dex === detailDex) return;
  const blatt = document.querySelector('.detail-blatt');
  const wechsel = () => { oeffneDetail(dex); blatt.scrollTop = 0; };
  const ohneBewegung = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!document.startViewTransition || ohneBewegung) {
    wechsel();
    if (ohneBewegung) return;
    // einfache Variante für Browser ohne View Transitions
    const inhalt = document.getElementById('detail-inhalt');
    inhalt.classList.remove('evo-wechsel');
    void inhalt.offsetWidth;
    inhalt.classList.add('evo-wechsel');
    return;
  }
  // Namen müssen in jedem Zustand eindeutig sein: vorher trägt ihn das kleine Bild, danach das Kopfbild
  const kleinesBild = knopf.querySelector('img');
  if (kleinesBild) kleinesBild.style.viewTransitionName = 'pokemon-bild';
  const uebergang = document.startViewTransition(() => {
    wechsel();
    const kopfBild = document.querySelector('.detail-kopf img');
    if (kopfBild) kopfBild.style.viewTransitionName = 'pokemon-bild';
  });
  uebergang.finished.finally(() => {
    const kopfBild = document.querySelector('.detail-kopf img');
    if (kopfBild) kopfBild.style.viewTransitionName = '';
  });
}

const zahl = (n, stellen = 1) => n.toLocaleString('de-DE', { maximumFractionDigits: stellen });

async function zeichneInfo(dex, box) {
  box.replaceChildren(el('p', 'info-laedt', 'Infos werden geladen …'));
  let alle;
  try { alle = await ladePokemonInfo(); } catch (e) {
    box.replaceChildren(el('p', 'info-laedt', 'Die Infos konnten nicht geladen werden. Prüfe deine Internetverbindung und tippe erneut auf den Kopf.'));
    return;
  }
  if (detailDex !== dex) return;
  const [kategorie, groesse, gewicht_, werte, faehigkeiten, text, weiblich, fangrate, eiGruppen, kette, , textEnglisch] = alle[dex - 1];
  const teile = [];

  // Kategorie und Pokédex-Eintrag
  const eintrag = el('div', 'info-eintrag');
  if (kategorie) eintrag.append(el('span', 'info-kategorie', kategorie));
  if (text) eintrag.append(el('p', 'info-text', text));
  if (textEnglisch && text) eintrag.append(el('small', 'info-hinweis-klein', 'Für dieses Pokémon gibt es noch keinen deutschen Pokédex-Eintrag – hier der englische.'));
  teile.push(eintrag);

  // Steckbrief
  const region = REGIONEN.findIndex(([, von, bis]) => dex >= von && dex <= bis);
  const geschlecht = el('span');
  if (weiblich < 0) geschlecht.textContent = 'geschlechtslos';
  else geschlecht.append(
    el('span', 'info-m', `♂ ${zahl((8 - weiblich) / 8 * 100)} %`),
    document.createTextNode('  '),
    el('span', 'info-w', `♀ ${zahl(weiblich / 8 * 100)} %`),
  );
  const fakten = el('dl', 'info-fakten');
  [
    ['Größe', `${zahl(groesse / 10)} m`],
    ['Gewicht', `${zahl(gewicht_ / 10)} kg`],
    ['Geschlecht', geschlecht],
    ['Fangrate', `${fangrate} von 255`],
    ['Ei-Gruppen', eiGruppen.join(', ') || '–'],
    ['Herkunft', `${REGIONEN[region][0]}, Generation ${region + 1}`],
  ].forEach(([titel, wert]) => {
    const d = el('div');
    const dd = el('dd');
    if (typeof wert === 'string') dd.textContent = wert; else dd.append(wert);
    d.append(el('dt', null, titel), dd);
    fakten.append(d);
  });
  teile.push(fakten);

  // Fähigkeiten
  if (faehigkeiten.length) {
    const f = el('div', 'info-block');
    f.append(el('h4', null, 'Fähigkeiten'));
    const chips = el('div', 'info-chips');
    faehigkeiten.forEach(([name_, versteckt]) => {
      const c = el('span', 'info-chip' + (versteckt ? ' versteckt' : ''), name_);
      if (versteckt) c.append(el('small', null, 'versteckt'));
      chips.append(c);
    });
    f.append(chips);
    teile.push(f);
  }

  // Basiswerte
  const w = el('div', 'info-block');
  const summe = werte.reduce((a, b) => a + b, 0);
  const kopfZeile = el('h4', null, 'Basiswerte');
  kopfZeile.append(el('span', 'info-summe', `Gesamt ${summe}`));
  w.append(kopfZeile);
  const tabelle = el('div', 'info-werte');
  werte.forEach((wert, i) => {
    const zeile = el('div', 'info-wert');
    const balken = el('span', 'info-balken');
    const fuellung = el('i');
    fuellung.style.width = Math.min(100, (wert / 180) * 100) + '%';
    fuellung.className = wert < 60 ? 'niedrig' : wert < 90 ? 'mittel' : wert < 120 ? 'hoch' : 'sehr-hoch';
    balken.append(fuellung);
    zeile.append(el('span', 'info-wert-name', WERTE_NAMEN[i]), el('b', null, wert), balken);
    tabelle.append(zeile);
  });
  w.append(tabelle);
  teile.push(w);

  // Entwicklungsreihe: alle Pokémon derselben Reihe, nach Stufe geordnet
  const reihe = [];
  alle.forEach((d, i) => { if (d[9] === kette) reihe.push(i + 1); });
  if (reihe.length > 1) {
    const stufe = (d) => { let n = 0; let v = alle[d - 1][10]; while (v && n < 5) { n++; v = alle[v - 1][10]; } return n; };
    const stufen = [];
    reihe.forEach((d) => { const st = stufe(d); (stufen[st] = stufen[st] || []).push(d); });
    const evo = el('div', 'info-block');
    evo.append(el('h4', null, 'Entwicklung'));
    const leiste = el('div', 'info-evo');
    stufen.filter(Boolean).forEach((gruppe, i) => {
      if (i) leiste.append(el('span', 'info-evo-pfeil', '›'));
      const spalte = el('div', 'info-evo-stufe' + (gruppe.length > 3 ? ' viele' : ''));
      gruppe.forEach((d) => {
        const b = el('button', `info-evo-pokemon t-${typen(d)[0]}` + (haken.has(d) ? ' an' : '') + (d === dex ? ' aktuell' : ''));
        b.type = 'button';
        b.dataset.evo = d;
        b.setAttribute('aria-label', `${name(d)} anzeigen`);
        b.append(artwork(d, 120), el('span', null, name(d)));
        spalte.append(b);
      });
      leiste.append(spalte);
    });
    evo.append(leiste, el('small', 'info-hinweis-klein', 'Farbig = schon gefangen. Antippen zeigt das Pokémon.'));
    teile.push(evo);
  }

  teile.push(el('p', 'info-fussnote', 'Das Wesen (z. B. „Robust“) hat im Spiel jedes Pokémon einzeln – deshalb gibt es dafür keinen festen Wert pro Art. Daten: PokeAPI.'));
  box.replaceChildren(...teile);
  box.dataset.fertig = '1';
}

function kartenElement(k) {
  const set = daten.sets[k[0]];
  const karte = el('div', 'karte');
  const url = k[5] ? bildUrl(k) : bildUrl(k, 'en');
  if (url) {
    const knopf = el('button', 'karte-bild');
    knopf.type = 'button';
    knopf.dataset.gross = url.replace('/low.webp', '/high.webp');
    knopf.setAttribute('aria-label', `${k[2]} aus ${setName(set)} groß anzeigen`);
    const img = el('img');
    img.loading = 'lazy'; img.alt = ''; img.src = url;
    img.onerror = () => {
      knopf.replaceWith(el('div', 'karte-bild karte-leer', 'Kein Bild vorhanden'));
      karte.querySelector('.karte-en')?.remove();
    };
    knopf.append(img);
    karte.append(knopf);
  } else {
    karte.append(el('div', 'karte-bild karte-leer', 'Kein Bild vorhanden'));
  }
  // Bild und Galerie-Stern in einen Rahmen legen
  const rahmen = el('div', 'karte-rahmen');
  rahmen.append(karte.firstChild, galerieKnopf(`${k[0]}-${k[1]}`));
  karte.prepend(rahmen);
  karte.append(
    el('span', 'karte-serie', set.serieName),
    el('span', 'karte-set', setName(set) + (set.datum ? ` (${set.datum.slice(0, 4)})` : '')),
    el('span', 'karte-meta', `${k[2]}, Nr. ${decodeURIComponent(k[1])}`),
    el('span', 'selt ' + gewichtKlasse(set.booster || TEIL_VON[k[0]] ? gewicht(k[3]) : 0), k[3]),
  );
  if (!k[5] && url) karte.append(el('span', 'karte-en', 'Bild: englische Version'));
  if (ansicht.preise === 'an') {
    const preis = el('span', 'karte-preis');
    preis.dataset.karte = `${k[0]}-${k[1]}`;
    preis.hidden = true;
    karte.append(preis);
  }
  return karte;
}

// ---------- Kartenwerte (Cardmarket über TCGdex) ----------
// TCGdex liefert Preise nur pro Karte – daher erst laden, wenn die Karte sichtbar ist.
function ladePreisCache() {
  try { preise = JSON.parse(localStorage.getItem(SPEICHER_PREISE) || '{}'); } catch (e) { preise = {}; }
}
let preisSpeicherTimer = null;
function speicherePreiseSpaeter() {
  clearTimeout(preisSpeicherTimer);
  preisSpeicherTimer = setTimeout(() => {
    try { localStorage.setItem(SPEICHER_PREISE, JSON.stringify(preise)); } catch (e) { preise = {}; }
  }, 1000);
}

const preisWarteschlange = [];
let preisLaeuft = 0;
function holePreis(kartenId) {
  const cache = preise[kartenId];
  if (cache && Date.now() - cache[1] < PREIS_MAX_ALTER_TAGE * 864e5) return Promise.resolve(cache[0]);
  return new Promise((fertig) => {
    preisWarteschlange.push({ kartenId, fertig });
    naechsterPreis();
  });
}
function naechsterPreis() {
  if (preisLaeuft >= 4 || !preisWarteschlange.length) return; // höchstens 4 Abrufe gleichzeitig
  const { kartenId, fertig } = preisWarteschlange.shift();
  preisLaeuft++;
  fetch(`https://api.tcgdex.net/v2/de/cards/${kartenId}`)
    .then((a) => (a.ok ? a.json() : null))
    .then((karte) => {
      const cm = karte && karte.pricing && karte.pricing.cardmarket;
      const wert = cm ? (cm.trend || cm.avg || cm['trend-holo'] || cm['avg-holo'] || null) : null;
      preise[kartenId] = [wert, Date.now()];
      speicherePreiseSpaeter();
      fertig(wert);
    })
    .catch(() => fertig(null))
    .finally(() => { preisLaeuft--; naechsterPreis(); });
}

let preisBeobachter = null;
function beobachtePreise(box) {
  if (preisBeobachter) preisBeobachter.disconnect();
  const felder = box.querySelectorAll('.karte-preis');
  if (!felder.length) return;
  preisBeobachter = new IntersectionObserver((eintraege) => {
    for (const e of eintraege) {
      if (!e.isIntersecting) continue;
      preisBeobachter.unobserve(e.target);
      const feld = e.target;
      holePreis(feld.dataset.karte).then((wert) => {
        if (!wert) return;
        feld.textContent = wert.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
        feld.title = 'Cardmarket-Trendpreis';
        feld.classList.toggle('wertvoll', wert >= WERTVOLL_AB);
        feld.hidden = false;
      });
    }
  }, { rootMargin: '200px' });
  felder.forEach((f) => preisBeobachter.observe(f));
}

// ---------- Set-Ranking ----------
function nurAktuell() {
  try { return localStorage.getItem('natdex:nur-aktuell') !== '0'; } catch (e) { return true; }
}

function berechneRanking() {
  const grenze = new Date();
  grenze.setMonth(grenze.getMonth() - AKTUELL_MONATE);
  const grenzeText = nurAktuell() ? grenze.toISOString().slice(0, 10) : '';

  const proSet = {}; // setId → Map(dex → {w, seltenheit})
  for (const k of daten.karten) {
    const setId = TEIL_VON[k[0]] || k[0];
    const set = daten.sets[setId];
    if (!set || !set.booster || set.datum < grenzeText) continue;
    const w = gewicht(k[3]);
    if (w <= 0) continue;
    for (const dex of k[4]) {
      if (haken.has(dex) || dex > ANZAHL_POKEMON) continue;
      const m = proSet[setId] || (proSet[setId] = new Map());
      const bisher = m.get(dex);
      if (!bisher || w > bisher.w) m.set(dex, { w, seltenheit: k[3] });
    }
  }
  return Object.entries(proSet).map(([setId, m]) => {
    let punkte = 0, voll = 0;
    for (const v of m.values()) { punkte += v.w; if (v.w >= 1) voll++; }
    const fehlend = [...m.entries()].sort((a, b) => b[1].w - a[1].w || a[0] - b[0]);
    return { setId, punkte, anzahl: m.size, voll, fehlend };
  }).sort((a, b) => b.punkte - a.punkte || b.anzahl - a.anzahl);
}

const punkteText = (p) => p.toFixed(1).replace('.', ',');

// Set-Logo; fehlt es (z. B. Dunkelnacht), wird der Name als Schriftzug gezeigt
function setLogo(set, klasse) {
  const ersatz = el('span', klasse + ' logo-ersatz', set.name);
  if (!set.logo) return ersatz;
  const logo = el('img', klasse);
  logo.alt = setName(set);
  logo.loading = 'lazy';
  logo.src = set.logo + '.webp';
  logo.onerror = () => logo.replaceWith(ersatz);
  return logo;
}

function fehlendDetails(r) {
  const box = el('div', 'rang-details');
  const kopf = el('div', 'rang-details-kopf');
  const start = el('button', 'knopf', 'Dieses Set öffnen');
  start.type = 'button';
  start.dataset.boosterStart = r.setId;
  kopf.append(el('p', null, 'Tippe auf den Pokéball, sobald du eins davon gezogen hast.'), start);
  box.append(kopf);
  const g = el('div', 'gitter');
  for (const [dex, info] of r.fehlend) {
    g.append(kachel(dex, 160, el('span', 'selt ' + gewichtKlasse(info.w), info.seltenheit)));
  }
  box.append(g);
  return box;
}

function zeichneRanking() {
  const ziel = document.getElementById('ranking');
  document.querySelectorAll('#set-filter button').forEach((b) =>
    b.classList.toggle('aktiv', (b.dataset.aktuell === '1') === nurAktuell()));
  if (!daten) { ziel.replaceChildren(el('p', 'hinweis', 'Kartendaten werden noch geladen …')); return; }
  const ranking = berechneRanking();
  if (!ranking.length) { ziel.replaceChildren(el('p', 'hinweis', 'In diesen Sets fehlt dir kein Pokémon mehr.')); return; }

  // Platz 1 groß
  const [erster, ...rest] = ranking;
  const set1 = daten.sets[erster.setId];
  const sieger = el('article', 'sieger');
  sieger.dataset.set = erster.setId;
  const zahlen = el('div', 'sieger-zahlen');
  [[erster.anzahl, 'fehlen dir'], [erster.voll, 'davon häufig'], [punkteText(erster.punkte), 'Punkte']]
    .forEach(([zahl, text]) => { const d = el('div'); d.append(el('b', null, zahl), el('span', null, text)); zahlen.append(d); });
  const reihe = el('div', 'mini-reihe');
  erster.fehlend.slice(0, 12).forEach(([dex]) => { const img = artwork(dex, 88); img.title = name(dex); reihe.append(img); });
  if (erster.anzahl > 12) reihe.append(el('span', 'mehr', `+${erster.anzahl - 12}`));
  const mehrKnopf = el('button', 'knopf knopf-glas', offenesSet === erster.setId ? 'Liste ausblenden' : 'Alle fehlenden zeigen');
  mehrKnopf.type = 'button';
  mehrKnopf.dataset.toggleSet = erster.setId;
  const boosterKnopf = el('button', 'knopf', 'Booster öffnen');
  boosterKnopf.type = 'button';
  boosterKnopf.dataset.boosterStart = erster.setId;
  const knopfZeile = el('div', 'knopf-zeile');
  knopfZeile.append(boosterKnopf, mehrKnopf);
  sieger.append(
    el('p', 'sieger-titel', 'Lohnt sich gerade am meisten'),
    setLogo(set1, 'sieger-logo'),
    el('span', 'serie-name', set1.serieName),
    el('h3', null, `${setName(set1)} (${set1.datum.slice(0, 4)})`),
    zahlen, reihe, knopfZeile,
  );
  if (offenesSet === erster.setId) sieger.append(fehlendDetails(erster));

  // Rest als Liste
  const liste = el('ol', 'rang-liste');
  liste.start = 2;
  rest.forEach((r, i) => {
    const set = daten.sets[r.setId];
    const li = el('li', 'rang');
    const zeile = el('button', 'rang-zeile');
    zeile.type = 'button';
    zeile.dataset.toggleSet = r.setId;
    zeile.setAttribute('aria-expanded', offenesSet === r.setId);
    const nameBox = el('div', 'rang-name');
    nameBox.append(el('span', 'serie-name', set.serieName), el('b', null, setName(set)),
      el('small', null, `${r.anzahl} fehlen dir, ${r.voll} davon häufig`));
    nameBox.title = `Erschienen ${set.datum.slice(0, 4)}`;
    const punkte = el('div', 'rang-punkte');
    punkte.append(el('b', null, punkteText(r.punkte)), el('small', null, 'Punkte'));
    const balken = el('span', 'rang-balken');
    const fuellung = el('i');
    fuellung.style.width = (r.punkte / erster.punkte) * 100 + '%';
    balken.append(fuellung);
    zeile.append(el('span', 'rang-platz', i + 2), setLogo(set, 'rang-logo'), nameBox, punkte, el('span'), el('span'), balken);
    li.append(zeile);
    if (offenesSet === r.setId) li.append(fehlendDetails(r));
    liste.append(li);
  });
  ziel.replaceChildren(sieger, liste);
}

// ---------- Trophäen-Ansicht ----------
function medaille(t) {
  const m = el('div', 'medaille' + (t.typ ? ` t-${t.typ}` : ''));
  m.dataset.gruppe = t.gruppe;
  m.append(artwork(t.bild, 160));
  return m;
}

function zeichneTrophaeen() {
  const ziel = document.getElementById('trophaeen');
  const offen = freigeschaltet();
  document.getElementById('trophaeen-stand').textContent = `${offen.size} von ${TROPHAEEN.length} freigeschaltet`;
  const frag = document.createDocumentFragment();
  for (const gruppe of ['Meilensteine', 'Regionen', 'Besondere Gruppen', 'Typen']) {
    const sektion = el('section', 'trophaeen-gruppe');
    sektion.append(el('h3', null, gruppe));
    const g = el('div', 'trophaeen-gitter');
    for (const t of TROPHAEEN.filter((x) => x.gruppe === gruppe)) {
      const stand = Math.min(t.stand(), t.ziel);
      const erreicht = offen.has(t.id);
      const karte = el('article', 'trophaee' + (erreicht ? ' erreicht' : ''));
      const balken = el('span', 'trophaee-balken');
      const fuellung = el('i');
      fuellung.style.width = (stand / t.ziel) * 100 + '%';
      balken.append(fuellung);
      karte.append(medaille(t), el('b', null, t.titel), el('small', null, t.text),
        balken, el('span', 'trophaee-stand', erreicht ? 'Geschafft' : `${stand} / ${t.ziel}`));
      g.append(karte);
    }
    sektion.append(g);
    frag.append(sektion);
  }
  ziel.replaceChildren(frag);
}

function zeigeTrophaeenMeldung(t) {
  const box = document.getElementById('meldungen');
  const m = el('div', 'meldung-trophaee');
  m.setAttribute('role', 'status');
  const text = el('div');
  text.append(el('small', null, 'Trophäe freigeschaltet'), el('b', null, t.titel));
  m.append(medaille(t), text);
  box.append(m);
  setTimeout(() => m.classList.add('weg'), 3200);
  setTimeout(() => m.remove(), 3700);
}

// „Glurak gefangen!“ mit Rückgängig-Knopf für Fehltipper
let fangTimer = null;
function zeigeFangMeldung(dex) {
  const box = document.getElementById('meldungen');
  box.querySelectorAll('.fang-meldung').forEach((m) => m.remove()); // immer nur eine
  clearTimeout(fangTimer);
  const m = el('div', `fang-meldung t-${typen(dex)[0]}`);
  m.setAttribute('role', 'status');
  const bild = artwork(dex, 120);
  bild.loading = 'eager';
  const text = el('div', 'fang-text');
  text.append(el('b', null, `${name(dex)} gefangen!`), el('small', null, `Jetzt ${haken.size} von ${ANZAHL_POKEMON}`));
  const zurueck = el('button', 'fang-zurueck', 'Rückgängig');
  zurueck.type = 'button';
  zurueck.addEventListener('click', () => {
    if (haken.has(dex)) umschalten(dex, true);
    m.remove();
  });
  m.append(bild, text, zurueck);
  box.append(m);
  fangTimer = setTimeout(() => {
    m.classList.add('weg');
    setTimeout(() => m.remove(), 400);
  }, 4500);
}

function zeigeKurzmeldung(text) {
  const box = document.getElementById('meldungen');
  box.querySelectorAll('.meldung-kurz').forEach((m) => m.remove());
  const m = el('div', 'meldung-trophaee meldung-kurz', text);
  m.setAttribute('role', 'status');
  box.append(m);
  setTimeout(() => m.classList.add('weg'), 1400);
  setTimeout(() => m.remove(), 1900);
}

// ---------- Booster-Modus ----------
function boosterSets() {
  return Object.entries(daten.sets)
    .filter(([, s]) => s.booster)
    .sort((a, b) => b[1].datum.localeCompare(a[1].datum));
}

// Alle Pokémon eines Sets (inkl. Subsets) mit der am leichtesten ziehbaren Karte
function pokemonImSet(setId) {
  const m = new Map();
  for (const k of daten.karten) {
    if ((TEIL_VON[k[0]] || k[0]) !== setId) continue;
    const w = gewicht(k[3]);
    for (const dex of k[4]) {
      if (dex > ANZAHL_POKEMON) continue;
      const bisher = m.get(dex);
      if (!bisher || w > bisher.w) m.set(dex, { w, seltenheit: k[3] });
    }
  }
  return m;
}

function speichereSession() {
  try {
    if (booster) localStorage.setItem(SPEICHER_SESSION, JSON.stringify(booster));
    else localStorage.removeItem(SPEICHER_SESSION);
  } catch (e) {}
}

function oeffneBooster(setId) {
  if (!daten) { zeigeKurzmeldung('Kartendaten werden noch geladen …'); return; }
  if (!setId) {
    // ohne Vorgabe: zuletzt geöffnetes Set, sonst Platz 1 im Ranking
    let zuletzt = null;
    try { zuletzt = localStorage.getItem('natdex:letztes-set'); } catch (e) {}
    setId = (booster && booster.setId) || (zuletzt && daten.sets[zuletzt] ? zuletzt : null) ||
      (berechneRanking()[0] || {}).setId || boosterSets()[0][0];
  }
  if (!booster) {
    booster = {
      setId, start: Date.now(), reihenfolge: [],
      startHaken: [...haken], startTrophaeen: [...freigeschaltet()],
    };
  }
  booster.setId = setId;
  speichereSession();
  try { localStorage.setItem('natdex:letztes-set', setId); } catch (e) {}

  document.getElementById('booster-suche').value = '';
  zeichneBooster();
  const fenster = document.getElementById('booster');
  if (fenster.hidden) {
    fenster.hidden = false;
    document.body.style.overflow = 'hidden';
    history.pushState({ booster: 1 }, '');
  }
  fenster.scrollTop = 0;
}

function zeichneBooster() {
  const set = daten.sets[booster.setId];
  // Set-Bühne
  document.getElementById('booster-titel').textContent = setName(set);
  document.getElementById('booster-logo').replaceChildren(setLogo(set, 'booster-logo-bild'));
  document.getElementById('booster-serie').textContent =
    [set.serieName, set.datum ? `erschienen ${set.datum.slice(0, 4)}` : ''].filter(Boolean).join(', ');

  // Pokémon in zwei Abschnitten; fehlende zuerst, darin die leicht ziehbaren vorne.
  // Wer während der Session gefangen wird, bleibt an seinem Platz (nichts springt).
  const eintraege = [...pokemonImSet(booster.setId)].sort((a, b) => b[1].w - a[1].w || a[0] - b[0]);
  const abschnitt = (titel, liste, klasse) => {
    const sektion = el('section', 'booster-abschnitt ' + klasse);
    const kopf = el('h3', null, titel);
    kopf.append(el('span', 'booster-abschnitt-zahl', liste.length));
    const g = el('div', 'gitter');
    liste.forEach(([dex, info]) => g.append(kachel(dex, 160, el('span', 'selt ' + gewichtKlasse(info.w), info.seltenheit))));
    sektion.append(kopf, g);
    sektion.hidden = !liste.length;
    return sektion;
  };
  document.getElementById('booster-gitter').replaceChildren(
    abschnitt('Fehlen dir noch', eintraege.filter(([d]) => !haken.has(d)), 'abschnitt-fehlend'),
    abschnitt('Schon gefangen', eintraege.filter(([d]) => haken.has(d)), 'abschnitt-gefangen'),
  );
  aktualisiereBoosterStand();
  zeichneChase(booster.setId);
}

function aktualisiereBoosterStand() {
  if (!booster) return;
  const imSet = [...document.querySelectorAll('#booster-gitter .kachel')];
  const gefangen = imSet.filter((k) => haken.has(+k.dataset.dex)).length;
  const neu = booster.reihenfolge.length;
  const chip = document.getElementById('booster-session');
  const vorher = +chip.dataset.anzahl || 0;
  chip.dataset.anzahl = neu;
  chip.textContent = neu ? `+${neu} neu` : '0 neu';
  chip.classList.toggle('aktiv', neu > 0);
  if (neu > vorher) { chip.classList.remove('hupf'); void chip.offsetWidth; chip.classList.add('hupf'); }
  document.getElementById('booster-balken').style.width = imSet.length ? (gefangen / imSet.length) * 100 + '%' : '0';
  document.getElementById('booster-fehlen').textContent = imSet.length
    ? (gefangen === imSet.length ? `Alle ${imSet.length} Pokémon aus diesem Set gefangen!` : `${gefangen} von ${imSet.length} Pokémon aus diesem Set gefangen`)
    : 'In diesem Set sind keine Pokémon-Karten eingetragen.';
}

// ---------- Chase-Karten: die wertvollsten Karten eines Sets ----------
// Vorauswahl nach Seltenheit, dann nach Cardmarket-Preis sortiert (Preise werden nachgeladen)
const CHASE_RANG = {
  'Mega Hyper Selten': 9, 'Hyperselten': 8, 'Selten, besondere Illustration': 8, 'Versteckt Selten': 7,
  'Mega Attack Rare': 6, 'ultraselten, Schillernd': 6, 'Shiny rare VMAX': 5, 'Shiny rare V': 5, 'Shiny rare': 5,
  'Selten, Illustration': 4, 'Atemberaubend': 4, 'Vollkunsttrainer': 4, 'Pikachu Rare': 4,
  'Holografisch Selten VMAX': 3, 'Holografisch Selten VSTAR': 3, 'Ultra Selten': 3, 'Selten, Strahlend': 3,
  'Holografisch Selten V': 2, 'Doppelselten': 2, 'Selten, Holografisch LV.X': 2, 'LEGENDE': 2, 'selten, Primus': 2,
  'Holografisch Selten': 1, 'Selten, Holografisch': 1,
};
const CHASE_ANZAHL = 10;
const CHASE_KANDIDATEN = 24;

function chaseKandidaten(setId) {
  const karten = daten.karten.filter((k) => (TEIL_VON[k[0]] || k[0]) === setId);
  const rang = (k) => CHASE_RANG[k[3]] || 0;
  const nummer = (k) => parseInt(decodeURIComponent(k[1]), 10) || 0;
  karten.sort((a, b) => rang(b) - rang(a) || gewicht(a[3]) - gewicht(b[3]) || nummer(b) - nummer(a));
  // ohne besondere Seltenheiten (alte Sets): die seltenste vorhandene Stufe nehmen
  const besondere = karten.filter((k) => rang(k) > 0);
  return (besondere.length ? besondere : karten.filter((k) => gewicht(k[3]) === gewicht(karten[0][3])))
    .slice(0, CHASE_KANDIDATEN);
}

function chaseKarte(k, wert) {
  const url = k[5] ? bildUrl(k) : bildUrl(k, 'en');
  const fig = el('figure', 'chase-karte');
  const bild = el('button', 'karte-bild');
  bild.type = 'button';
  bild.dataset.gross = url.replace('/low.webp', '/high.webp');
  bild.setAttribute('aria-label', `${k[2]} groß anzeigen`);
  const img = el('img');
  img.alt = ''; img.loading = 'lazy'; img.src = url;
  img.onerror = () => bild.replaceWith(el('div', 'karte-bild karte-leer', 'Kein Bild'));
  bild.append(img);
  if (k[4].some((d) => haken.has(d))) bild.append(el('span', 'chase-im-dex', 'Im Dex'));
  const unten = el('figcaption');
  unten.append(el('b', null, k[2]), el('span', 'selt w4', k[3]));
  if (wert) {
    const preis = el('span', 'karte-preis' + (wert >= WERTVOLL_AB ? ' wertvoll' : ''),
      wert.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }));
    preis.title = 'Cardmarket-Trendpreis';
    unten.append(preis);
  }
  const rahmen = el('div', 'karte-rahmen');
  rahmen.append(bild, galerieKnopf(`${k[0]}-${k[1]}`));
  fig.append(rahmen, unten);
  return fig;
}

let chaseZaehler = 0; // verhindert, dass ein alter Abruf ein neues Set überschreibt
async function zeichneChase(setId) {
  const reihe = document.getElementById('chase-reihe');
  const kandidaten = chaseKandidaten(setId);
  const lauf = ++chaseZaehler;
  if (!kandidaten.length) { reihe.replaceChildren(el('p', 'chase-leer', 'Für dieses Set sind keine Karten eingetragen.')); return; }
  // sofort nach Seltenheit zeigen, dann nach Preis neu sortieren
  reihe.replaceChildren(...kandidaten.slice(0, CHASE_ANZAHL).map((k) => chaseKarte(k, null)));
  reihe.scrollLeft = 0;
  reihe.classList.add('laedt');
  const werte = await Promise.all(kandidaten.map((k) => holePreis(`${k[0]}-${k[1]}`)));
  if (lauf !== chaseZaehler) return;
  reihe.classList.remove('laedt');
  const mitWert = kandidaten.map((k, i) => [k, werte[i]]);
  if (mitWert.some(([, w]) => w)) mitWert.sort((a, b) => (b[1] || 0) - (a[1] || 0));
  reihe.replaceChildren(...mitWert.slice(0, CHASE_ANZAHL).map(([k, w]) => chaseKarte(k, w)));
}

function merkeInSession(dex, jetztAn) {
  const r = booster.reihenfolge;
  if (jetztAn && !booster.startHaken.includes(dex) && !r.includes(dex)) r.push(dex);
  if (!jetztAn && r.includes(dex)) r.splice(r.indexOf(dex), 1);
  speichereSession();
  aktualisiereBoosterStand();
}

function filtereBooster() {
  const suche = document.getElementById('booster-suche').value.trim().toLowerCase().replace(/^#0*/, '');
  for (const sektion of document.querySelectorAll('#booster-gitter .booster-abschnitt')) {
    let sichtbar = 0;
    for (const k of sektion.querySelectorAll('.kachel')) {
      const dex = +k.dataset.dex;
      k.hidden = !!suche && !(/^\d+$/.test(suche) ? String(dex).startsWith(suche) : name(dex).toLowerCase().includes(suche));
      if (!k.hidden) sichtbar++;
    }
    sektion.hidden = !sichtbar;
  }
}

function beendeBooster(ueberHistory = false) {
  if (!booster) return;
  const session = booster;
  booster = null;
  speichereSession();
  document.getElementById('booster').hidden = true;
  document.body.style.overflow = '';
  if (!ueberHistory && history.state && history.state.booster) history.back();
  zeigeRueckblick(session);
  if (aktiveAnsicht() === 'ranking') zeichneRanking();
}

// ---------- Eigene Set-Auswahl ----------
function oeffneSetAuswahl() {
  // welche Pokémon stecken in welchem Set – in einem Durchlauf
  const dexProSet = new Map();
  for (const k of daten.karten) {
    const id = TEIL_VON[k[0]] || k[0];
    if (!daten.sets[id] || !daten.sets[id].booster) continue;
    if (!dexProSet.has(id)) dexProSet.set(id, new Set());
    k[4].forEach((d) => { if (d <= ANZAHL_POKEMON) dexProSet.get(id).add(d); });
  }
  const gruppenNachSerie = new Map();
  for (const [id, set] of boosterSets()) {
    const serie = set.serieName || 'Sonstige';
    if (!gruppenNachSerie.has(serie)) gruppenNachSerie.set(serie, []);
    gruppenNachSerie.get(serie).push([id, set]);
  }
  const frag = document.createDocumentFragment();
  for (const [serie, sets] of gruppenNachSerie) {
    const gruppe = el('section', 'set-gruppe');
    gruppe.append(el('h3', null, serie));
    for (const [id, set] of sets) {
      const dex = dexProSet.get(id) || new Set();
      const fehlen = [...dex].filter((d) => !haken.has(d)).length;
      const zeile = el('button', 'set-zeile' + (booster && booster.setId === id ? ' aktiv' : ''));
      zeile.type = 'button';
      zeile.dataset.setWaehlen = id;
      zeile.dataset.suche = `${setName(set)} ${serie}`.toLowerCase();
      const text = el('span', 'set-zeile-text');
      text.append(el('b', null, setName(set)), el('small', null, set.datum ? set.datum.slice(0, 4) : ''));
      const status = el('span', 'set-zeile-fehlen' + (fehlen ? '' : ' komplett'),
        !dex.size ? '–' : fehlen ? `${fehlen} fehlen` : 'komplett');
      zeile.append(setLogo(set, 'set-zeile-logo'), text, status);
      gruppe.append(zeile);
    }
    frag.append(gruppe);
  }
  document.getElementById('set-auswahl-liste').replaceChildren(frag);
  const suche = document.getElementById('set-auswahl-suche');
  suche.value = '';
  document.getElementById('set-auswahl').hidden = false;
  if (matchMedia('(pointer: fine)').matches) suche.focus(); // am Handy keine Tastatur aufklappen
  document.querySelector('#set-auswahl-liste .set-zeile.aktiv')?.scrollIntoView({ block: 'center' });
}

function filtereSetAuswahl() {
  const suche = document.getElementById('set-auswahl-suche').value.trim().toLowerCase();
  document.querySelectorAll('#set-auswahl-liste .set-gruppe').forEach((gruppe) => {
    let sichtbar = 0;
    gruppe.querySelectorAll('.set-zeile').forEach((z) => {
      z.hidden = !!suche && !z.dataset.suche.includes(suche);
      if (!z.hidden) sichtbar++;
    });
    gruppe.hidden = !sichtbar;
  });
}

function waehleSet(setId) {
  document.getElementById('set-auswahl').hidden = true;
  if (!booster) return;
  booster.setId = setId;
  speichereSession();
  try { localStorage.setItem('natdex:letztes-set', setId); } catch (e) {}
  document.getElementById('booster-suche').value = '';
  zeichneBooster();
  document.getElementById('booster').scrollTop = 0;
}

// ---------- Karten-Galerie ----------
function ladeGalerie() {
  try { galerie = new Map(JSON.parse(localStorage.getItem(SPEICHER_GALERIE) || '[]')); } catch (e) { galerie = new Map(); }
}
function speichereGalerie() {
  try { localStorage.setItem(SPEICHER_GALERIE, JSON.stringify([...galerie])); }
  catch (e) { alert('Galerie konnte nicht gespeichert werden – bitte ein Backup exportieren!'); }
}

const STERN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>';
function galerieKnopf(kartenId) {
  const drin = galerie.has(kartenId);
  const b = el('button', 'galerie-knopf' + (drin ? ' an' : ''));
  b.type = 'button';
  b.dataset.galerie = kartenId;
  b.setAttribute('aria-pressed', drin);
  b.setAttribute('aria-label', drin ? 'Aus der Galerie entfernen' : 'Zur Galerie hinzufügen');
  b.title = drin ? 'In deiner Galerie' : 'Zur Galerie hinzufügen';
  b.innerHTML = STERN_SVG;
  return b;
}

function umschaltenGalerie(kartenId) {
  const k = kartenNachId.get(kartenId);
  if (!k) return;
  const neu = !galerie.has(kartenId);
  if (neu) {
    galerie.set(kartenId, Date.now());
    if (booster) {
      booster.karten = booster.karten || [];
      if (!booster.karten.includes(kartenId)) booster.karten.push(kartenId);
      speichereSession();
    }
    // wer die Karte hat, hat auch das Pokémon
    const fehlend = k[4].filter((d) => d <= ANZAHL_POKEMON && !haken.has(d));
    fehlend.forEach((d, i) => umschalten(d, i > 0));
    if (!fehlend.length) zeigeKurzmeldung(`${k[2]} liegt jetzt in deiner Galerie`);
  } else {
    galerie.delete(kartenId);
    if (booster && booster.karten) booster.karten = booster.karten.filter((id) => id !== kartenId);
    zeigeKurzmeldung('Aus der Galerie entfernt');
  }
  speichereGalerie();
  document.querySelectorAll(`[data-galerie="${CSS.escape(kartenId)}"]`).forEach((b) => {
    b.classList.toggle('an', neu);
    b.setAttribute('aria-pressed', neu);
    if (b.classList.contains('galerie-knopf')) b.title = neu ? 'In deiner Galerie' : 'Zur Galerie hinzufügen';
  });
  if (aktiveAnsicht() === 'galerie') zeichneGalerie();
}

// Booster-Modus: alle seltenen Karten des Sets zum Antippen
function oeffneKartenAuswahl() {
  if (!booster) return;
  const nummer = (k) => parseInt(decodeURIComponent(k[1]), 10) || 0;
  const karten = daten.karten
    .filter((k) => (TEIL_VON[k[0]] || k[0]) === booster.setId && gewicht(k[3]) < 1)
    .sort((a, b) => (CHASE_RANG[b[3]] || 0) - (CHASE_RANG[a[3]] || 0) || gewicht(a[3]) - gewicht(b[3]) || nummer(a) - nummer(b));
  const liste = document.getElementById('karten-auswahl-liste');
  if (!karten.length) {
    liste.replaceChildren(el('p', 'chase-leer', 'Für dieses Set sind keine seltenen Pokémon-Karten eingetragen.'));
  } else {
    liste.replaceChildren(...karten.map((k) => {
      const id = `${k[0]}-${k[1]}`;
      const eintrag = el('button', 'auswahl-eintrag' + (galerie.has(id) ? ' an' : ''));
      eintrag.type = 'button';
      eintrag.dataset.galerie = id;
      eintrag.setAttribute('aria-pressed', galerie.has(id));
      const img = el('img');
      img.alt = ''; img.loading = 'lazy'; img.src = k[5] ? bildUrl(k) : bildUrl(k, 'en');
      img.onerror = () => img.replaceWith(el('span', 'auswahl-ohne-bild', k[2]));
      const haken_ = el('span', 'auswahl-haken');
      haken_.innerHTML = STERN_SVG;
      eintrag.append(img, haken_, el('b', null, k[2]), el('span', 'selt ' + gewichtKlasse(gewicht(k[3])), k[3]));
      return eintrag;
    }));
  }
  document.getElementById('karten-auswahl').hidden = false;
  liste.scrollTop = 0;
}

// Galerie-Ansicht
let galerieLauf = 0;
async function zeichneGalerie() {
  const ziel = document.getElementById('galerie');
  const stand = document.getElementById('galerie-stand');
  const lauf = ++galerieLauf;
  if (!daten) { ziel.replaceChildren(el('p', 'hinweis', 'Kartendaten werden noch geladen …')); return; }
  const eintraege = [...galerie].map(([id, zeit]) => ({ id, zeit, k: kartenNachId.get(id) })).filter((e) => e.k);
  if (!eintraege.length) {
    stand.textContent = 'Deine besonderen Karten an einem Ort.';
    const leer = el('div', 'galerie-leer');
    leer.innerHTML = STERN_SVG;
    leer.append(
      el('h3', null, 'Noch keine Karten in deiner Galerie'),
      el('p', null, 'Tippe bei einer Karte auf den Stern – in der Detailansicht eines Pokémon, bei den Chase-Karten oder im Booster-Modus unter „Seltene Karte gezogen?“.'),
    );
    ziel.replaceChildren(leer);
    return;
  }
  const werte = new Map();
  const zeichne = () => {
    const sortiert = [...eintraege];
    if (galerieSort === 'neu') sortiert.sort((a, b) => b.zeit - a.zeit);
    if (galerieSort === 'selten') sortiert.sort((a, b) => (CHASE_RANG[b.k[3]] || 0) - (CHASE_RANG[a.k[3]] || 0) || gewicht(a.k[3]) - gewicht(b.k[3]));
    if (galerieSort === 'wert') sortiert.sort((a, b) => (werte.get(b.id) || 0) - (werte.get(a.id) || 0));
    ziel.replaceChildren(...sortiert.map(({ id, zeit, k }) => {
      const set = daten.sets[k[0]];
      const url = k[5] ? bildUrl(k) : bildUrl(k, 'en');
      const fig = el('figure', 'galerie-karte');
      const rahmen = el('div', 'karte-rahmen');
      const bild = el('button', 'karte-bild');
      bild.type = 'button';
      bild.dataset.gross = url.replace('/low.webp', '/high.webp');
      bild.setAttribute('aria-label', `${k[2]} groß anzeigen`);
      const img = el('img');
      img.alt = ''; img.loading = 'lazy'; img.src = url;
      img.onerror = () => bild.replaceWith(el('div', 'karte-bild karte-leer', 'Kein Bild'));
      bild.append(img);
      rahmen.append(bild, galerieKnopf(id));
      const unten = el('figcaption');
      unten.append(el('b', null, k[2]), el('span', 'galerie-set', setName(set) + (set.datum ? ` (${set.datum.slice(0, 4)})` : '')));
      const zeile = el('div', 'galerie-zeile');
      zeile.append(el('span', 'selt ' + gewichtKlasse(gewicht(k[3])), k[3]));
      const w = werte.get(id);
      if (w) zeile.append(el('span', 'karte-preis' + (w >= WERTVOLL_AB ? ' wertvoll' : ''), w.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })));
      unten.append(zeile, el('small', 'galerie-datum', `Seit ${new Date(zeit).toLocaleDateString('de-DE')}`));
      fig.append(rahmen, unten);
      return fig;
    }));
  };
  stand.textContent = eintraege.length === 1 ? '1 Karte' : `${eintraege.length} Karten`;
  zeichne();
  // Preise nachladen, dann Gesamtwert zeigen (und ggf. nach Wert sortieren)
  const geladen = await Promise.all(eintraege.map((e) => holePreis(e.id)));
  if (lauf !== galerieLauf) return;
  eintraege.forEach((e, i) => werte.set(e.id, geladen[i]));
  const summe = geladen.reduce((a, b) => a + (b || 0), 0);
  stand.textContent = `${eintraege.length === 1 ? '1 Karte' : `${eintraege.length} Karten`}` +
    (summe ? `, zusammen etwa ${summe.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} wert` : '');
  zeichne();
}

// ---------- Session-Rückblick ----------
let letzteSession = null;
function zeigeRueckblick(s) {
  letzteSession = s;
  const box = document.getElementById('rueckblick-inhalt');
  const neu = s.reihenfolge;
  const set = daten.sets[s.setId];
  const minuten = Math.max(1, Math.round((Date.now() - s.start) / 60000));
  const offen = freigeschaltet();
  const trophaeen = TROPHAEEN.filter((t) => offen.has(t.id) && !s.startTrophaeen.includes(t.id));

  const kopf = el('header', 'rueckblick-kopf');
  kopf.append(
    el('span', 'rueckblick-set', `${setName(set)}, ${minuten} Min.`),
    el('h2', null, neu.length === 1 ? '1 neues Pokémon' : neu.length ? `${neu.length} neue Pokémon` : 'Diesmal kein neues Pokémon'),
    el('p', null, neu.length
      ? `Dein Dex ist von ${s.startHaken.length} auf ${haken.size} gewachsen.`
      : 'Das nächste Booster bringt bestimmt wieder etwas. Schau ins Ranking, welches Set sich gerade lohnt.'),
  );
  const teile = [kopf];
  if (neu.length) {
    const g = el('div', 'rueckblick-gitter');
    neu.forEach((dex) => {
      const f = el('figure', `rueckblick-pokemon t-${typen(dex)[0]}`);
      f.append(artwork(dex, 160), el('figcaption', null, name(dex)));
      g.append(f);
    });
    teile.push(g);
  }
  if (s.karten && s.karten.length) {
    const box = el('div', 'rueckblick-trophaeen');
    box.append(el('h3', null, s.karten.length === 1 ? 'Neu in deiner Galerie' : `${s.karten.length} neue Karten in deiner Galerie`));
    const reihe = el('div', 'rueckblick-karten');
    s.karten.map((id) => kartenNachId.get(id)).filter(Boolean).forEach((k) => {
      const img = el('img');
      img.alt = k[2]; img.loading = 'lazy'; img.src = k[5] ? bildUrl(k) : bildUrl(k, 'en');
      reihe.append(img);
    });
    box.append(reihe);
    teile.push(box);
  }
  if (trophaeen.length) {
    const t = el('div', 'rueckblick-trophaeen');
    t.append(el('h3', null, trophaeen.length === 1 ? 'Neue Trophäe' : `${trophaeen.length} neue Trophäen`));
    const reihe = el('div', 'rueckblick-medaillen');
    trophaeen.forEach((tr) => { const m = el('div', 'rueckblick-medaille erreicht'); m.append(medaille(tr), el('span', null, tr.titel)); reihe.append(m); });
    t.append(reihe);
    teile.push(t);
  }
  const knoepfe = el('div', 'knopf-zeile rueckblick-knoepfe');
  const weiter = el('button', 'knopf knopf-zwei', 'Weiter öffnen');
  weiter.type = 'button';
  weiter.dataset.boosterWeiter = s.setId;
  const zu = el('button', 'knopf', 'Schließen');
  zu.type = 'button';
  zu.dataset.rueckblickZu = '';
  knoepfe.append(zu, weiter);
  teile.push(knoepfe);
  box.replaceChildren(...teile);
  document.getElementById('rueckblick').hidden = false;
  if (neu.length >= 5) konfetti(); // bei einer guten Ausbeute ein bisschen feiern
}

// ---------- Feier beim Region-Abschluss ----------
function feiern(t) {
  const box = document.getElementById('feier-inhalt');
  const ganzerDex = t.id === 'anzahl-1025';
  const titel = el('h2', null, ganzerDex ? 'National Dex komplett!' : `${t.titel.replace('-Orden', '')} komplett!`);
  titel.id = 'feier-titel';
  const zu = el('button', 'knopf', 'Weiter sammeln');
  zu.type = 'button';
  zu.dataset.feierZu = '';
  const m = el('div', 'feier-medaille erreicht');
  m.append(medaille(t));
  box.replaceChildren(
    m,
    el('span', 'feier-orden', ganzerDex ? 'Pokémon-Meister' : `Du hast den ${t.titel} verdient`),
    titel,
    el('p', null, ganzerDex ? 'Alle 1025 Pokémon gefangen. Unglaublich!' : `${t.text} gefangen.`),
    zu,
  );
  document.getElementById('feier').hidden = false;
  konfetti();
}

// Konfetti mit ein paar Pokébällen – läuft 3,5 Sekunden auf einer eigenen Zeichenfläche
function konfetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.getElementById('konfetti');
  const ctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const b = innerWidth, h = innerHeight;
  c.width = b * dpr; c.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const farben = ['#E3350D', '#FFCB05', '#FFFFFF', '#3B6FE0', '#7AC74C', '#F95587'];
  const teile = Array.from({ length: 170 }, () => ({
    x: b / 2 + (Math.random() - 0.5) * b * 0.3, y: h * 0.42,
    vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 5,
    groesse: Math.random() * 7 + 5, dreh: Math.random() * 6, vd: (Math.random() - 0.5) * 0.3,
    farbe: farben[Math.floor(Math.random() * farben.length)],
    form: Math.random() < 0.14 ? 'ball' : Math.random() < 0.35 ? 'kreis' : 'streifen',
  }));
  const dauer = 3500;
  const start = performance.now();
  c.hidden = false;
  function bild(jetzt) {
    const alter = jetzt - start;
    ctx.clearRect(0, 0, b, h);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, alter - dauer * 0.6) / (dauer * 0.4));
    for (const p of teile) {
      p.vy += 0.38; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.dreh += p.vd;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.dreh);
      if (p.form === 'ball') {
        const r = p.groesse * 0.9;
        ctx.fillStyle = '#E3350D'; ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.fill();
        ctx.strokeStyle = '#121A2E'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
      } else {
        ctx.fillStyle = p.farbe;
        if (p.form === 'kreis') { ctx.beginPath(); ctx.arc(0, 0, p.groesse / 2.4, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-p.groesse / 2, -p.groesse / 5, p.groesse, p.groesse / 2.5);
      }
      ctx.restore();
    }
    if (alter < dauer) requestAnimationFrame(bild);
    else { ctx.clearRect(0, 0, b, h); c.hidden = true; }
  }
  requestAnimationFrame(bild);
}

// ---------- Einstellungen „Ansicht“ ----------
function ladeAnsicht() {
  try { Object.assign(ansicht, JSON.parse(localStorage.getItem(SPEICHER_ANSICHT) || '{}')); } catch (e) {}
  wendeAnsichtAn();
}
function wendeAnsichtAn() {
  const wurzel = document.documentElement;
  wurzel.dataset.kachel = ansicht.kachel;
  wurzel.dataset.fehlend = ansicht.fehlend;
  const thema = document.getElementById('thema-knopf').dataset.thema;
  document.querySelectorAll('[data-einstellung]').forEach((seg) => {
    const wert = seg.dataset.einstellung === 'thema' ? thema : ansicht[seg.dataset.einstellung];
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('aktiv', b.dataset.wert === wert));
  });
}
function aendereEinstellung(schluessel, wert) {
  if (schluessel === 'thema') { setzeThema(wert); wendeAnsichtAn(); return; }
  ansicht[schluessel] = wert;
  try { localStorage.setItem(SPEICHER_ANSICHT, JSON.stringify(ansicht)); } catch (e) {}
  wendeAnsichtAn();
  if (schluessel === 'sortierung') { zeichneDex(); zeichneFortschritt(); filtern(); }
}

// ---------- Sync zwischen Geräten (Link / QR-Code) ----------
// Die Liste steckt als Bitfolge im Teil hinter „#“ – der wird nie an einen Server geschickt.
function syncCode(menge) {
  const bytes = new Uint8Array(Math.ceil(ANZAHL_POKEMON / 8));
  for (const d of menge) bytes[(d - 1) >> 3] |= 1 << ((d - 1) & 7);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function liesSyncCode(code) {
  const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  const menge = new Set();
  for (let i = 0; i < bin.length; i++) {
    const b = bin.charCodeAt(i);
    for (let bit = 0; bit < 8; bit++) {
      const d = i * 8 + bit + 1;
      if (b & (1 << bit) && d <= ANZAHL_POKEMON) menge.add(d);
    }
  }
  return menge;
}
const ONLINE_ADRESSE = 'https://hurgagged.github.io/Pokedex/';
const istLokal = () => ['localhost', '127.0.0.1', ''].includes(location.hostname) || location.protocol === 'file:';
// Auf dem PC (lokal) zeigt der Link auf die Online-Seite – so kommen die Häkchen von hier dorthin
const syncLink = () => `${istLokal() ? ONLINE_ADRESSE : location.origin + location.pathname}#sync=1.${syncCode(haken)}`;
const syncMeldung = (text) => { document.getElementById('sync-meldung').textContent = text; };

async function teileSyncLink() {
  const link = syncLink();
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title: 'Mein Pokédex', text: `Meine Pokédex-Liste (${haken.size} Pokémon)`, url: link });
      return;
    } catch (e) { if (e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(link);
    syncMeldung(`Link kopiert (${haken.size} Pokémon). Schick ihn dir selbst, z. B. per Mail oder Messenger, und öffne ihn auf dem anderen Gerät.`);
  } catch (e) {
    prompt('Diesen Link auf dem anderen Gerät öffnen:', link);
  }
}

function zeigeSyncQr() {
  const box = document.getElementById('sync-qr');
  if (!box.hidden) { box.hidden = true; document.getElementById('sync-qr-knopf').textContent = 'QR-Code zeigen'; return; }
  if (typeof qrcode !== 'function') { syncMeldung('Der QR-Code braucht beim ersten Mal Internet. Versuch es gleich noch einmal.'); return; }
  const qr = qrcode(0, 'L');
  qr.addData(syncLink());
  qr.make();
  box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
  box.append(el('p', null, `Mit der Handy-Kamera scannen. Enthält ${haken.size} Pokémon.`));
  box.hidden = false;
  document.getElementById('sync-qr-knopf').textContent = 'QR-Code ausblenden';
}

// Wurde die Seite über einen Sync-Link geöffnet?
function pruefeSyncLink() {
  const treffer = location.hash.match(/^#sync=1\.([A-Za-z0-9_-]+)$/);
  if (!treffer) return;
  let neu;
  try { neu = liesSyncCode(treffer[1]); } catch (e) { return; }
  history.replaceState(null, '', location.pathname + location.search); // Code aus der Adresse entfernen
  const zusammen = new Set([...haken, ...neu]);
  const titel = el('h2', null, 'Liste übernehmen?');
  titel.id = 'sync-titel';
  const zahlen = el('div', 'sync-zahlen');
  [[neu.size, 'im Link'], [haken.size, 'auf diesem Gerät'], [zusammen.size, 'zusammen']].forEach(([z, t]) => {
    const d = el('div'); d.append(el('b', null, z), el('span', null, t)); zahlen.append(d);
  });
  const knoepfe = el('div', 'knopf-zeile sync-knoepfe');
  const mk = (text, klasse, aktion) => { const b = el('button', klasse, text); b.type = 'button'; b.addEventListener('click', aktion); return b; };
  const fertig = (text) => {
    speichereHaken();
    document.querySelectorAll('[data-dex]').forEach((k) => k.classList.toggle('an', haken.has(+k.dataset.dex)));
    zeichneFortschritt(); filtern();
    document.getElementById('sync-dialog').hidden = true;
    zeigeKurzmeldung(text);
  };
  knoepfe.append(
    mk('Zusammenführen', 'knopf', () => { neu.forEach((d) => haken.add(d)); fertig(`Zusammengeführt: ${haken.size} Pokémon`); }),
    mk('Ersetzen', 'knopf knopf-zwei', () => { haken = new Set(neu); fertig(`Ersetzt: ${haken.size} Pokémon`); }),
    mk('Abbrechen', 'knopf knopf-zwei', () => { document.getElementById('sync-dialog').hidden = true; }),
  );
  document.getElementById('sync-inhalt').replaceChildren(
    titel,
    el('p', null, 'Dieser Link enthält eine Pokédex-Liste von einem anderen Gerät. „Zusammenführen“ behält alle Häkchen von beiden Geräten.'),
    zahlen, knoepfe,
  );
  document.getElementById('sync-dialog').hidden = false;
}

// ---------- App & Offline ----------
let installHinweis = null;
function starteAppFunktionen() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Offline-Modus nicht verfügbar', e));
  }
  const hinweis = document.getElementById('offline-hinweis');
  const setzeOnline = (melden) => {
    hinweis.hidden = navigator.onLine;
    if (melden) zeigeKurzmeldung(navigator.onLine ? 'Wieder online' : 'Offline – Häkchen werden trotzdem gespeichert');
  };
  setzeOnline(false);
  window.addEventListener('online', () => setzeOnline(true));
  window.addEventListener('offline', () => setzeOnline(true));

  // Installieren: Android/Chrome bietet einen eigenen Dialog an, iPhone braucht die Anleitung
  const alsApp = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (alsApp) {
    document.getElementById('installieren-text').textContent = 'Der Pokédex läuft bereits als App auf diesem Gerät.';
    document.getElementById('installieren-anleitung').hidden = true;
  }
  const knopf = document.getElementById('installieren-knopf');
  if (alsApp) knopf.hidden = true;
  // Gerät erkennen, um die passende Anleitung hervorzuheben
  const ua = navigator.userAgent;
  const geraet = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    ? 'ios' : /Android/.test(ua) ? 'android' : '';
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Dialog aufheben, bis du auf den Knopf tippst
    installHinweis = e;
  });
  window.addEventListener('appinstalled', () => {
    knopf.hidden = true;
    document.getElementById('installieren-text').textContent = 'Installiert! Du findest den Pokédex jetzt auf deinem Startbildschirm.';
    document.getElementById('installieren-anleitung').hidden = true;
  });
  knopf.addEventListener('click', async () => {
    if (installHinweis) {
      // Android/Chrome: echten Installations-Dialog zeigen
      installHinweis.prompt();
      await installHinweis.userChoice;
      installHinweis = null;
      return;
    }
    // kein Dialog verfügbar (iPhone, oder Chrome bietet ihn gerade nicht an): Anleitung zeigen
    const anleitung = document.getElementById('installieren-anleitung');
    anleitung.querySelectorAll('[data-geraet]').forEach((s) => {
      s.classList.toggle('hervorgehoben', s.dataset.geraet === geraet);
      s.hidden = !!geraet && s.dataset.geraet !== geraet;
    });
    anleitung.scrollIntoView({ behavior: 'smooth', block: 'center' });
    zeigeKurzmeldung(geraet === 'ios'
      ? 'Auf dem iPhone geht das über das Teilen-Symbol – siehe Anleitung'
      : 'Dein Browser bietet keinen direkten Dialog an – siehe Anleitung');
  });
  document.getElementById('sync-teilen').addEventListener('click', teileSyncLink);
  document.getElementById('sync-qr-knopf').addEventListener('click', zeigeSyncQr);
}

// ---------- Hell / Dunkel ----------
const THEMEN = ['auto', 'light', 'dark'];
const THEMA_TEXT = { auto: 'automatisch wie das Gerät', light: 'hell', dark: 'dunkel' };
function setzeThema(thema) {
  if (thema === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = thema;
  const knopf = document.getElementById('thema-knopf');
  knopf.dataset.thema = thema;
  knopf.setAttribute('aria-label', 'Darstellung: ' + THEMA_TEXT[thema]);
  knopf.title = 'Darstellung: ' + THEMA_TEXT[thema];
  const dunkel = thema === 'dark' || (thema === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]').content = dunkel ? '#9E2408' : '#E3350D';
  try { localStorage.setItem('natdex:thema', thema); } catch (e) {}
  document.querySelectorAll('[data-einstellung="thema"] button').forEach((b) => b.classList.toggle('aktiv', b.dataset.wert === thema));
}

// ---------- 3D-Neigung der Kacheln (nur mit Maus) ----------
function starte3D() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let aktiv = null;
  document.addEventListener('pointermove', (e) => {
    const k = e.target.closest('.kachel');
    if (aktiv && aktiv !== k) { aktiv.style.removeProperty('--dx'); aktiv.style.removeProperty('--dy'); }
    aktiv = k;
    if (!k) return;
    const r = k.getBoundingClientRect();
    k.style.setProperty('--dx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    k.style.setProperty('--dy', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  });
}

// ---------- Backup ----------
function exportieren() {
  const inhalt = JSON.stringify({
    app: 'natdex', version: 2, exportiert: new Date().toISOString(),
    haken: [...haken].sort((a, b) => a - b),
    galerie: [...galerie],
  }, null, 1);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([inhalt], { type: 'application/json' }));
  a.download = `pokedex-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  meldung(`Backup mit ${haken.size} Pokémon und ${galerie.size} ${galerie.size === 1 ? "Galerie-Karte" : "Galerie-Karten"} exportiert.`);
  try { localStorage.setItem(SPEICHER_LETZTES_BACKUP, String(Date.now())); } catch (e) {}
  zeichneHinweise();
}

// ---------- Hinweise oben im Pokédex: Backup-Erinnerung, Tipp zum Schnellfang ----------
const SPEICHER_LETZTES_BACKUP = 'natdex:letztes-backup';
const SPEICHER_ERSTER_START = 'natdex:erster-start';
const SPEICHER_BACKUP_SPAETER = 'natdex:backup-spaeter';
const SPEICHER_TIPP_BALL = 'natdex:tipp-ball';
const BACKUP_ERINNERN_TAGE = 28;
const BACKUP_SPAETER_TAGE = 3;

const lies = (schluessel) => { try { return localStorage.getItem(schluessel); } catch (e) { return null; } };
const schreib = (schluessel, wert) => { try { localStorage.setItem(schluessel, wert); } catch (e) {} };
const tageSeit = (zeit) => Math.floor((Date.now() - zeit) / 864e5);

function brauchtBackupErinnerung() {
  if (!haken.size) return false;
  const letztes = +lies(SPEICHER_LETZTES_BACKUP) || 0;
  const start = +lies(SPEICHER_ERSTER_START) || Date.now();
  if (tageSeit(letztes || start) < BACKUP_ERINNERN_TAGE) return false;
  if (Date.now() < (+lies(SPEICHER_BACKUP_SPAETER) || 0)) return false;
  // nur erinnern, wenn sich seit dem letzten Backup etwas geändert hat
  let geaendert = 0;
  try { geaendert = Date.parse(JSON.parse(lies(SPEICHER_HAKEN)).geaendert) || 0; } catch (e) {}
  return !letztes || geaendert > letztes;
}

function hinweisKarte(klasse, titel, text, knoepfe) {
  const karte = el('div', 'hinweis-karte ' + klasse);
  karte.setAttribute('role', 'status');
  const textBox = el('div', 'hinweis-text');
  textBox.append(el('b', null, titel), el('span', null, text));
  const knopfBox = el('div', 'hinweis-knoepfe');
  knoepfe.forEach(([beschriftung, stil, aktion]) => {
    const b = el('button', 'knopf ' + stil, beschriftung);
    b.type = 'button';
    b.addEventListener('click', aktion);
    knopfBox.append(b);
  });
  karte.append(textBox, knopfBox);
  return karte;
}

function zeichneHinweise() {
  const box = document.getElementById('hinweis-karten');
  const karten = [];
  if (brauchtBackupErinnerung()) {
    const letztes = +lies(SPEICHER_LETZTES_BACKUP) || 0;
    karten.push(hinweisKarte('hinweis-backup', 'Zeit für ein Backup',
      letztes
        ? `Dein letztes Backup ist ${tageSeit(letztes)} Tage her, seitdem hast du weiter abgehakt. Sichere die Datei z. B. in deiner Cloud oder per Mail an dich.`
        : `Du hast noch kein Backup deiner ${haken.size} Pokémon gemacht. Wenn der Browser seine Daten löscht, wären sie sonst weg.`,
      [
        ['Backup speichern', '', exportieren],
        [`In ${BACKUP_SPAETER_TAGE} Tagen erinnern`, 'knopf-zwei', () => {
          schreib(SPEICHER_BACKUP_SPAETER, String(Date.now() + BACKUP_SPAETER_TAGE * 864e5));
          zeichneHinweise();
        }],
      ]));
  }
  if (!lies(SPEICHER_TIPP_BALL)) {
    karten.push(hinweisKarte('hinweis-tipp', 'Tipp: Schnell fangen',
      'Tippe auf den kleinen Pokéball oben rechts in einer Kachel – dann ist das Pokémon sofort gefangen. Auf das Bild tippen zeigt alle Karten.',
      [['Verstanden', 'knopf-zwei', () => { schreib(SPEICHER_TIPP_BALL, '1'); zeichneHinweise(); }]]));
  }
  box.replaceChildren(...karten);

  const stand = document.getElementById('backup-stand');
  const letztes = +lies(SPEICHER_LETZTES_BACKUP) || 0;
  stand.textContent = letztes
    ? `Letztes Backup: ${new Date(letztes).toLocaleDateString('de-DE')} (vor ${tageSeit(letztes)} Tagen)`
    : 'Auf diesem Gerät wurde noch kein Backup gemacht.';
}

async function importieren(datei) {
  try {
    const json = JSON.parse(await datei.text());
    const liste = Array.isArray(json) ? json : json.haken;
    if (!Array.isArray(liste)) throw new Error('Keine Liste gefangener Pokémon gefunden');
    const neu = liste.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= ANZAHL_POKEMON);
    const neueGalerie = Array.isArray(json.galerie) ? json.galerie.filter((e) => Array.isArray(e) && typeof e[0] === 'string') : [];
    const ersetzen = confirm(
      `Das Backup enthält ${neu.length} Pokémon und ${neueGalerie.length} Galerie-Karten.\n\nOK = aktuelle Daten ERSETZEN\nAbbrechen = mit aktuellen Daten ZUSAMMENFÜHREN`);
    if (ersetzen) haken = new Set(neu); else neu.forEach((n) => haken.add(n));
    if (ersetzen && neueGalerie.length) galerie = new Map(neueGalerie);
    else neueGalerie.forEach(([id, zeit]) => { if (!galerie.has(id)) galerie.set(id, zeit); });
    speichereHaken();
    speichereGalerie();
    document.querySelectorAll('[data-dex]').forEach((k) => k.classList.toggle('an', haken.has(+k.dataset.dex)));
    zeichneFortschritt(); filtern();
    meldung(`Backup importiert: ${haken.size} Pokémon gefangen, ${galerie.size} ${galerie.size === 1 ? "Karte" : "Karten"} in der Galerie.`);
  } catch (e) {
    meldung('Import fehlgeschlagen: ' + e.message);
  }
}
const meldung = (text) => { document.getElementById('backup-meldung').textContent = text; };

function zeichneDatenStatus() {
  const p = document.getElementById('daten-status');
  if (!daten) { p.textContent = 'Noch keine Kartendaten geladen.'; return; }
  const sets = Object.values(daten.sets).filter((s) => s.booster).length;
  p.textContent = `${daten.karten.length.toLocaleString('de-DE')} deutsche Pokémon-Karten aus ${sets} Booster-Sets, ` +
    `Stand ${new Date(daten.geladen).toLocaleString('de-DE')}. Die Daten werden alle ${DATEN_MAX_ALTER_TAGE} Tage automatisch aktualisiert.`;
}

// ---------- Ansichten ----------
const aktiveAnsicht = () => document.querySelector('.unten-nav .aktiv').dataset.ansicht;
function zeigeAnsicht(nameAnsicht) {
  document.querySelectorAll('.unten-nav button').forEach((b) => b.classList.toggle('aktiv', b.dataset.ansicht === nameAnsicht));
  document.querySelectorAll('.ansicht').forEach((s) => s.classList.toggle('aktiv', s.id === 'ansicht-' + nameAnsicht));
  if (nameAnsicht === 'ranking') zeichneRanking();
  if (nameAnsicht === 'backup') zeichneDatenStatus();
  if (nameAnsicht === 'trophaeen') zeichneTrophaeen();
  if (nameAnsicht === 'galerie') zeichneGalerie();
  window.scrollTo(0, 0);
}

// ---------- Start ----------
function start() {
  let thema = 'auto';
  try { thema = localStorage.getItem('natdex:thema') || 'auto'; } catch (e) {}
  setzeThema(THEMEN.includes(thema) ? thema : 'auto');
  document.getElementById('thema-knopf').addEventListener('click', (e) => {
    const jetzt = e.currentTarget.dataset.thema;
    const neu = THEMEN[(THEMEN.indexOf(jetzt) + 1) % THEMEN.length];
    setzeThema(neu);
    zeigeKurzmeldung('Darstellung: ' + THEMA_TEXT[neu]);
  });
  starte3D();
  ladeHaken();
  ladeAnsicht();
  ladePreisCache();
  ladeGalerie();
  zeichneDex();
  zeichneFortschritt();
  starteAppFunktionen();
  pruefeSyncLink();
  if (!lies(SPEICHER_ERSTER_START)) schreib(SPEICHER_ERSTER_START, String(Date.now()));
  zeichneHinweise();

  document.addEventListener('click', (e) => {
    const stern = e.target.closest('[data-galerie]');
    if (stern) { umschaltenGalerie(stern.dataset.galerie); return; }
    if (e.target.closest('[data-set-auswahl]')) { oeffneSetAuswahl(); return; }
    const setWahl = e.target.closest('[data-set-waehlen]');
    if (setWahl) { waehleSet(setWahl.dataset.setWaehlen); return; }
    if (e.target.closest('[data-seltene-karten]')) { oeffneKartenAuswahl(); return; }
    const zu = e.target.closest('[data-auswahl-zu]');
    if (zu) { zu.closest('.schicht').hidden = true; return; }
    const fang = e.target.closest('[data-fang]');
    if (fang) { umschalten(+fang.dataset.fang); return; }
    const karte = e.target.closest('.karte-bild[data-gross]');
    if (karte) {
      document.getElementById('bild-gross').src = karte.dataset.gross;
      document.getElementById('bild-overlay').hidden = false;
      return;
    }
    const oeffnen = e.target.closest('.kachel-oeffnen');
    // Absicherung: Klick im Bereich des Pokéballs fängt immer – auch wenn der 3D-Effekt
    // das Bild räumlich davorschiebt und es den Klick abbekommt
    if (oeffnen) {
      const ballFeld = oeffnen.parentElement.querySelector('.kachel-fang').getBoundingClientRect();
      if (e.clientX >= ballFeld.left && e.clientX <= ballFeld.right && e.clientY >= ballFeld.top && e.clientY <= ballFeld.bottom) {
        umschalten(+oeffnen.parentElement.dataset.dex);
        return;
      }
    }
    // im Booster-Modus fängt ein Tipp auf die Kachel direkt – das geht schneller
    if (oeffnen && oeffnen.closest('#booster')) { umschalten(+oeffnen.parentElement.dataset.dex); return; }
    if (oeffnen) { oeffneDetail(+oeffnen.parentElement.dataset.dex); return; }
    const boosterStart = e.target.closest('[data-booster-start]');
    if (boosterStart) { oeffneBooster(boosterStart.dataset.boosterStart || null); return; }
    if (e.target.closest('[data-booster-ende]')) { beendeBooster(); return; }
    const weiter = e.target.closest('[data-booster-weiter]');
    if (weiter) { document.getElementById('rueckblick').hidden = true; oeffneBooster(weiter.dataset.boosterWeiter); return; }
    if (e.target.closest('[data-rueckblick-zu]')) { document.getElementById('rueckblick').hidden = true; return; }
    if (e.target.closest('[data-feier-zu]')) { document.getElementById('feier').hidden = true; return; }
    const einstellung = e.target.closest('[data-einstellung] button');
    if (einstellung) { aendereEinstellung(einstellung.parentElement.dataset.einstellung, einstellung.dataset.wert); return; }
    if (e.target.closest('[data-schliessen]')) { schliesseDetail(); return; }
    if (e.target.closest('[data-info-umschalten]')) { umschalteInfo(); return; }
    const evo = e.target.closest('[data-evo]');
    if (evo) { wechsleZuEntwicklung(+evo.dataset.evo, evo); return; }
    const setKnopf = e.target.closest('[data-toggle-set]');
    if (setKnopf) {
      offenesSet = offenesSet === setKnopf.dataset.toggleSet ? null : setKnopf.dataset.toggleSet;
      zeichneRanking();
      return;
    }
    const sprung = e.target.closest('[data-ansicht-sprung]');
    if (sprung) { zeigeAnsicht(sprung.dataset.ansichtSprung); return; }
    const abschnitt = e.target.closest('#regionen [data-gruppe]');
    if (abschnitt) {
      document.getElementById('gruppe-' + abschnitt.dataset.gruppe).scrollIntoView({ behavior: 'smooth' });
    }
  });
  document.getElementById('bild-overlay').addEventListener('click', (e) => { e.currentTarget.hidden = true; });
  window.addEventListener('popstate', () => {
    // Zurück-Taste: erst Details schließen, dann den Booster-Modus beenden
    if (detailDex !== null) schliesseDetail(true);
    else if (booster && !document.getElementById('booster').hidden) beendeBooster(true);
  });
  document.getElementById('set-auswahl-suche').addEventListener('input', filtereSetAuswahl);
  document.getElementById('galerie-sortierung').addEventListener('click', (e) => {
    const knopf = e.target.closest('button');
    if (!knopf) return;
    galerieSort = knopf.dataset.sort;
    document.querySelectorAll('#galerie-sortierung button').forEach((b) => b.classList.toggle('aktiv', b === knopf));
    zeichneGalerie();
  });
  document.getElementById('booster-suche').addEventListener('input', filtereBooster);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const overlay = document.getElementById('bild-overlay');
    if (!overlay.hidden) { overlay.hidden = true; return; }
    for (const id of ['set-auswahl', 'karten-auswahl', 'feier', 'rueckblick']) {
      if (!document.getElementById(id).hidden) { document.getElementById(id).hidden = true; return; }
    }
    if (detailDex !== null) schliesseDetail();
    else if (booster && !document.getElementById('booster').hidden) beendeBooster();
  });

  document.getElementById('suche').addEventListener('input', filtern);
  document.getElementById('status-filter').addEventListener('click', (e) => {
    const knopf = e.target.closest('button');
    if (!knopf) return;
    statusFilter = knopf.dataset.filter;
    document.querySelectorAll('#status-filter button').forEach((b) => b.classList.toggle('aktiv', b === knopf));
    filtern();
  });
  document.getElementById('set-filter').addEventListener('click', (e) => {
    const knopf = e.target.closest('button');
    if (!knopf) return;
    try { localStorage.setItem('natdex:nur-aktuell', knopf.dataset.aktuell); } catch (err) {}
    zeichneRanking();
  });
  document.querySelectorAll('.unten-nav button').forEach((b) => b.addEventListener('click', () => zeigeAnsicht(b.dataset.ansicht)));

  document.getElementById('export-knopf').addEventListener('click', exportieren);
  document.getElementById('import-datei').addEventListener('change', (e) => {
    if (e.target.files[0]) importieren(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('aktualisieren-knopf').addEventListener('click', () => {
    document.getElementById('daten-status').textContent = 'Lade …';
    ladeDaten(true);
  });

  ladeDaten().then(() => {
    try {
      const gespeichert = JSON.parse(localStorage.getItem(SPEICHER_SESSION) || 'null');
      if (gespeichert && daten && daten.sets[gespeichert.setId]) { booster = gespeichert; oeffneBooster(gespeichert.setId); }
    } catch (e) {}
  });
}

start();
