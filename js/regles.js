/* Moteur de Tochki : état de la grille, coups et captures. Aucun accès au DOM. */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique();
  else { racine.Tochki = racine.Tochki || {}; racine.Tochki.Regles = fabrique(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const BLEU = 1, ROUGE = 2;
  const LARGEUR = 17, HAUTEUR = 25;

  function adversaire(j) { return 3 - j; }

  function creer(largeur, hauteur) {
    largeur = largeur || LARGEUR;
    hauteur = hauteur || HAUTEUR;
    const n = largeur * hauteur;
    return {
      largeur, hauteur,
      proprio: new Int8Array(n), // 0 vide, 1 bleu, 2 rouge
      geolier: new Int8Array(n), // joueur qui retient ce point prisonnier (0 = point actif)
      zone: new Int8Array(n),    // joueur à qui appartient la zone capturée (0 = aucune)
      trait: BLEU,
      libres: n,                 // intersections encore jouables
      abandon: 0,                // joueur qui a abandonné
      dernier: -1,
      captures: [],
      prochainId: 1,
    };
  }

  function cloner(e, avecCaptures) {
    return {
      largeur: e.largeur, hauteur: e.hauteur,
      proprio: e.proprio.slice(), geolier: e.geolier.slice(), zone: e.zone.slice(),
      trait: e.trait, libres: e.libres, abandon: e.abandon, dernier: e.dernier,
      captures: avecCaptures ? e.captures.slice() : [],
      prochainId: e.prochainId,
    };
  }

  function index(e, x, y) { return y * e.largeur + x; }

  function estJouable(e, i) {
    return i >= 0 && i < e.proprio.length && e.proprio[i] === 0 && e.zone[i] === 0;
  }

  function estMur(e, i, j) { return e.proprio[i] === j && e.geolier[i] === 0; }

  // Tampons partagés pour les parcours, pour ne pas allouer à chaque coup.
  let marque = new Int32Array(0), pile = new Int32Array(0), tampon = 0;
  function nouveauTampon(n) {
    if (marque.length !== n) { marque = new Int32Array(n); pile = new Int32Array(n); tampon = 0; }
    return ++tampon;
  }

  // Morceaux (4-connexes) de la région de j qui contenait m, une fois m occupé.
  function morceaux(e, m, j) {
    const L = e.largeur, H = e.hauteur, P = e.proprio, G = e.geolier;
    const t = nouveauTampon(L * H);
    const libre = (d) => marque[d] !== t && !(P[d] === j && G[d] === 0);
    marque[m] = t;
    const mx = m % L, my = (m / L) | 0;
    const departs = [];
    if (mx > 0) departs.push(m - 1);
    if (mx < L - 1) departs.push(m + 1);
    if (my > 0) departs.push(m - L);
    if (my < H - 1) departs.push(m + L);

    const res = [];
    for (const v of departs) {
      if (!libre(v)) continue;
      const cases = [];
      let bord = false, sp = 0;
      marque[v] = t; pile[sp++] = v;
      while (sp > 0) {
        const c = pile[--sp];
        cases.push(c);
        const x = c % L, y = (c / L) | 0;
        if (x === 0 || y === 0 || x === L - 1 || y === H - 1) bord = true;
        if (x > 0 && libre(c - 1)) { marque[c - 1] = t; pile[sp++] = c - 1; }
        if (x < L - 1 && libre(c + 1)) { marque[c + 1] = t; pile[sp++] = c + 1; }
        if (y > 0 && libre(c - L)) { marque[c - L] = t; pile[sp++] = c - L; }
        if (y < H - 1 && libre(c + L)) { marque[c + L] = t; pile[sp++] = c + L; }
      }
      res.push({ cases, bord });
    }
    return res;
  }

  function capturer(e, cases, j) {
    const q = adversaire(j), L = e.largeur, H = e.hauteur;
    const prisonniers = [], liberes = [];
    for (const c of cases) {
      if (e.proprio[c] === q && e.geolier[c] === 0) { e.geolier[c] = j; prisonniers.push(c); }
      else if (e.proprio[c] === j && e.geolier[c] === q) { e.geolier[c] = 0; liberes.push(c); }
      if (e.proprio[c] === 0 && e.zone[c] === 0) e.libres--;
      e.zone[c] = j;
    }
    const dedans = new Set(cases), murs = new Set();
    for (const c of cases) {
      const x = c % L, y = (c / L) | 0;
      const voisins = [];
      if (x > 0) voisins.push(c - 1);
      if (x < L - 1) voisins.push(c + 1);
      if (y > 0) voisins.push(c - L);
      if (y < H - 1) voisins.push(c + L);
      for (const d of voisins) if (!dedans.has(d) && estMur(e, d, j)) murs.add(d);
    }
    const capture = { id: e.prochainId++, joueur: j, cases, murs: Array.from(murs), prisonniers, liberes };
    e.captures.push(capture);
    return capture;
  }

  // Seule une boucle fermée par ce coup capture (pas de maison) : la région de m
  // se coupe du bord, ou une région déjà fermée est coupée en deux par m.
  function jouer(e, i, j) {
    if (j === undefined) j = e.trait;
    if (e.abandon || !estJouable(e, i)) return null;
    const L = e.largeur, H = e.hauteur, q = adversaire(j);
    e.proprio[i] = j;
    e.libres--;
    e.dernier = i;

    const mx = i % L, my = (i / L) | 0;
    const surBord = mx === 0 || my === 0 || mx === L - 1 || my === H - 1;
    const morc = morceaux(e, i, j);
    const regionAuBord = surBord || morc.some((p) => p.bord);
    const fermes = regionAuBord ? morc.filter((p) => !p.bord) : (morc.length >= 2 ? morc : []);

    const captures = [];
    for (const p of fermes) {
      if (p.cases.some((c) => e.proprio[c] === q && e.geolier[c] === 0)) captures.push(capturer(e, p.cases, j));
    }
    e.trait = q;
    return { index: i, joueur: j, captures };
  }

  function scores(e) {
    const s = { 1: 0, 2: 0 };
    for (let i = 0; i < e.geolier.length; i++) if (e.geolier[i]) s[e.geolier[i]]++;
    return s;
  }

  function abandonner(e) { if (!e.abandon) e.abandon = e.trait; }

  function estFinie(e) { return e.abandon !== 0 || e.libres === 0; }

  // 0 = égalité
  function vainqueur(e) {
    if (e.abandon) return adversaire(e.abandon);
    const s = scores(e);
    return s[1] > s[2] ? 1 : s[2] > s[1] ? 2 : 0;
  }

  // Une capture reste dessinée tant que tous ses murs sont des points actifs de son joueur.
  function captureVisible(e, c) { return c.murs.every((m) => estMur(e, m, c.joueur)); }

  return {
    BLEU, ROUGE, LARGEUR, HAUTEUR,
    adversaire, creer, cloner, index, estJouable, estMur, jouer,
    scores, abandonner, estFinie, vainqueur, captureVisible,
  };
});
