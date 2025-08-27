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

// === Unités par champ ===
const UNITS = {
  facturean: "€",
  consokwh: "kWh/an",
  rationuit: "", // part 0–1
  consoankwhdiurne: "kWh/an",
  consoankwhnocturne: "kWh/an",
  prodan: "kWh/an",
  prodconsomme: "kWh/an",
  prodrevendue: "kWh/an",
  valprodconsomme: "€",
  valprodrevendue: "€",
  totalecoan: "€",
  ecomoisan1: "€/mois",
  ecomoismoy20ans: "€/mois",
  tarifdans20ans: "€/kWh",
  facturedans10ans: "€",
  totalfacs20anssanspv: "€",
  economies20ans: "€",
  revente20ans: "€",
  totalfacs20ansavecpv: "€",
  ecomoisan1avecbatt: "€/mois",
  valprodan1avecbatt: "€",
  economies20ansavecbatt: "€",
  ecomoismoy20ansavecbatt: "€/mois",
};

// === Helpers ===
const nf = (v, max = 2) => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: max }).format(v);
};
const zint = (x) => { // Excel INT (pour positifs)
  const n = Number(x);
  return Math.floor(isFinite(n) ? n : 0);
};
const asNum = (v, fallback = 0) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
};

// >>> Variante A : Clé | Unité | Valeur <<<
const row = (k, v) => `
  <tr>
    <td>${k}</td>
    <td class="value">${nf(v)}</td>
    <td>${UNITS[k] || ""}</td>
  </tr>
`;


const setStatus = (msg, ok = true) => {
  const el = document.getElementById("status");
  if (el) {
    el.textContent = msg;
    el.className = ok ? "ok" : "err";
  }
};
const showError = (msg) => {
  const e = document.getElementById("error");
  if (e) {
    e.style.display = "block";
    e.textContent = msg;
  }
  setStatus("Échec du chargement.", false);
};

// === Moteur de calcul (formules Excel alignées) ===
function computeFromInputs(input) {
  // Entrées attendues dans donnees.json :
  // - facture (€/mois), tarif (€/kWh), ratiojour (0..1)
  // - productible (kWh/kWc/an), puissance (kWc)
  // - tarifrevente (€/kWh), hausselecgraph (0..1), periodeans (années)
  const productible     = asNum(input.productible);
  const facture         = asNum(input.facture);
  const tarif           = asNum(input.tarif ?? input.tarin);
  const ratiojour       = asNum(input.ratiojour); // ex. 0.67
  const tarifrevente    = asNum(input.tarifrevente);
  const puissance       = asNum(input.puissance);
  const periodeans      = asNum(input.periodeans, 20);
  const hausselecgraph  = asNum(input.hausselecgraph, asNum(input.hausselec, 0.05));

  // Formules Excel-like
  const facturean = zint(facture * 12);

  const consokwh = zint(tarif ? (facturean / tarif) : 0);

  const rationuit = 1 - ratiojour;

  const consoankwhdiurne   = zint(consokwh * ratiojour);
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

  const economies20ans = zint((valprodconsomme * geo) + (valprodrevendue * periodeans));

  const revente20ans = valprodrevendue * periodeans;

  const totalfacs20ansavecpv = totalfacs20anssanspv - economies20ans;

  // Batterie
  const valprodan1avecbatt = zint(prodan * tarif);
  const ecomoisan1avecbatt = zint(valprodan1avecbatt / 12);
  const economies20ansavecbatt = zint(valprodan1avecbatt * geo);

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
fetch("donnees.json", { cache: "no-cache" })
  .then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status} — ${r.statusText}`);
    return r.json();
  })
  .then(raw => {
    const out = computeFromInputs(raw);
    const tbody = document.querySelector("#results tbody");
    tbody.innerHTML = FIELDS.map(k => row(k, out[k])).join("");
    setStatus("Données calculées d'après les formules Excel (OK).");
  })
  .catch(e => {
    showError("Problème avec donnees.json : " + (e?.message || e));
  });

