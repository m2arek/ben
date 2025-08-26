// === Champs à afficher (ordre demandé) ===
const FIELDS = [
  "facturean",
  "consokwh",
  "rationuit",
  "consoankwhdiurne",
  "consoankwhnocturne",
  "prodan",
  "prodconsomme",
  "prodrevendue",
  "valprodconsomme",
  "valprodrevendue",
  "totalecoan",
  "ecomoisan1",
  "ecomoismoy20ans",
  "tarifdans20ans",
  "facturedans10ans",
  "totalfacs20anssanspv",
  "economies20ans",
  "revente20ans",
  "totalfacs20ansavecpv",
  "ecomoisan1avecbatt",
  "valprodan1avecbatt",
  "economies20ansavecbatt",
  "ecomoismoy20ansavecbatt",
];

// === Helpers ===
const nf = (v, max=2) => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: max }).format(v);
};
const zint = (x) => { // Excel INT: arrondi vers le bas (positifs)
  const n = Number(x);
  return Math.floor(isFinite(n) ? n : 0);
};
const asNum = (v, fallback=0) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
};
const row = (k, v) => `<tr><td>${k}</td><td class="value">${nf(v)}</td></tr>`;
const setStatus = (msg, ok=true) => {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className = ok ? "ok" : "err";
};
const showError = (msg) => {
  document.getElementById("error").style.display = "block";
  document.getElementById("error").textContent = msg;
  setStatus("Échec du chargement.", false);
};

// === Moteur de calcul (copie des formules Excel) ===
function computeFromInputs(input) {
  // Entrées utilisateur attendues (comme dans ton Excel)
  const productible = asNum(input.productible);
  const facture     = asNum(input.facture);
  const tarif       = asNum(input.tarin || input.tarif); // ton fichier a "tarif" (pas "prixkwhjour")
  const ratiojour   = asNum(input.ratiojour);
  const tarifrevente= asNum(input.tarifrevente);
  const puissance   = asNum(input.puissance);
  const hausselec   = asNum(input.hausselec);       // présent mais non utilisé directement dans ces lignes
  const periodeans  = asNum(input.periodeans, 20);
  const hausselecgraph = asNum(input.hausselecgraph, hausselec || 0.05);

  // ---- Formules Excel telles qu'en feuille ----
  const facturean = zint(facture * 12);

  const consokwh = zint(facturean / tarif);

  const rationuit = 1 - ratiojour;

  const consoankwhdiurne = zint(consokwh * ratiojour);

  const consoankwhnocturne = consokwh - consoankwhdiurne;

  const prodan = puissance * productible;

  const prodconsomme = (prodan > consoankwhdiurne) ? consoankwhdiurne : prodan;

  const prodrevendue = (prodan > consoankwhdiurne) ? (prodan - prodconsomme) : 0;

  const valprodconsomme = zint(prodconsomme * tarif);

  const valprodrevendue = zint(prodrevendue * tarifrevente);

  const totalecoan = valprodconsomme + valprodrevendue;

  const ecomoisan1 = zint(totalecoan / 12);

  const tarifdans20ans = Math.round((tarif * Math.pow(1 + hausselecgraph, periodeans)) * 1000) / 1000;

  const facturedans10ans = zint(facturean * Math.pow(1 + hausselecgraph, 10));

  const ratio = 1 + hausselecgraph;
  const geo = (Math.pow(ratio, periodeans) - 1) / (ratio - 1);

  const totalfacs20anssanspv = zint(facturean * geo);

  const economies20ans = zint( (valprodconsomme * geo) + (valprodrevendue * periodeans) );

  const revente20ans = valprodrevendue * periodeans;

  const totalfacs20ansavecpv = totalfacs20anssanspv - economies20ans;

  // Batterie (selon tes lignes 31..33)
  const valprodan1avecbatt = zint(prodan * tarif);

  const ecomoisan1avecbatt = zint(valprodan1avecbatt / 12);

  const economies20ansavecbatt = zint( valprodan1avecbatt * geo );

  const ecomoismoy20ans = zint(economies20ans / periodeans / 12);

  const ecomoismoy20ansavecbatt = zint(economies20ansavecbatt / 240); // 20 ans * 12 mois

  return {
    facturean,
    consokwh,
    rationuit,
    consoankwhdiurne,
    consoankwhnocturne,
    prodan,
    prodconsomme,
    prodrevendue,
    valprodconsomme,
    valprodrevendue,
    totalecoan,
    ecomoisan1,
    ecomoismoy20ans,
    tarifdans20ans,
    facturedans10ans,
    totalfacs20anssanspv,
    economies20ans,
    revente20ans,
    totalfacs20ansavecpv,
    ecomoisan1avecbatt,
    valprodan1avecbatt,
    economies20ansavecbatt,
    ecomoismoy20ansavecbatt,
  };
}

// === Chargement + rendu ===
fetch("./donnees.json", { cache: "no-cache" })
  .then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status} — ${r.statusText}`);
    return r.json();
  })
  .then(raw => {
    const out = computeFromInputs(raw);
    const tbody = document.querySelector("#results tbody");
    tbody.innerHTML = FIELDS.map(k => row(k, out[k])).join("");
    setStatus("Données calculées d'après les formules Excel.");
  })
  .catch(e => {
    showError("Erreur lors du chargement de donnees.json : " + (e?.message || e) +
      "\nVérifie que index.html, app.js et donnees.json sont au même niveau dans le dépôt GitHub Pages.");
  });
