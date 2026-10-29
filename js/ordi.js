/* Joueur ordinateur : Facile, Moyen, Difficile. */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique(require('./regles.js'));
  else { racine.Tochki = racine.Tochki || {}; racine.Tochki.Ordi = fabrique(racine.Tochki.Regles); }
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';

  const maintenant = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const BUDGET_MS = 900;

  // Intersections jouables proches des points déjà posés.
  function candidats(e, rayon) {
    const L = e.largeur, H = e.hauteur, n = L * H;
    const vu = new Uint8Array(n);
    const res = [];
    let grilleVide = true;
    const ajouterAutour = (x, y, r) => {
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= L) continue;
          const c = yy * L + xx;
          if (!vu[c] && R.estJouable(e, c)) { vu[c] = 1; res.push(c); }
        }
      }
    };
    for (let i = 0; i < n; i++) {
      if (!e.proprio[i]) continue;
      grilleVide = false;
      ajouterAutour(i % L, (i / L) | 0, rayon);
    }
    if (grilleVide) ajouterAutour(L >> 1, H >> 1, 2);
    if (!res.length) for (let i = 0; i < n; i++) if (R.estJouable(e, i)) res.push(i);
    return res;
  }

  // 1 = case atteignable depuis le bord sans traverser les murs de j.
  function acces(e, j) {
    const L = e.largeur, H = e.hauteur, n = L * H;
    const acc = new Uint8Array(n);
    const pile = [];
    const pousser = (c) => { if (!acc[c] && !R.estMur(e, c, j)) { acc[c] = 1; pile.push(c); } };
    for (let x = 0; x < L; x++) { pousser(x); pousser((H - 1) * L + x); }
    for (let y = 0; y < H; y++) { pousser(y * L); pousser(y * L + L - 1); }
    while (pile.length) {
      const c = pile.pop();
      const x = c % L, y = (c / L) | 0;
      if (x > 0) pousser(c - 1);
      if (x < L - 1) pousser(c + 1);
      if (y > 0) pousser(c - L);
      if (y < H - 1) pousser(c + L);
    }
    return acc;
  }

  // Intérêt positionnel d'un coup de j en i (sans le jouer).
  function heuristique(e, i, j, accAdverse) {
    const L = e.largeur, H = e.hauteur, q = R.adversaire(j);
    const x = i % L, y = (i / L) | 0;
    let s = 0, amis = 0, ennemis = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= L || yy >= H) continue;
        const c = yy * L + xx;
        if (R.estMur(e, c, j)) { amis++; s += dx && dy ? 1.2 : 0.7; }
        else if (R.estMur(e, c, q)) { ennemis++; s += 1.0; }
      }
    }
    if (amis && ennemis) s += 1.5;
    if (amis > 3) s -= (amis - 3) * 1.2;
    if (accAdverse && !accAdverse[i]) s -= 4; // dans une boucle adverse : dangereux
    if (x === 0 || y === 0 || x === L - 1 || y === H - 1) s -= 0.8;
    s -= 0.03 * (Math.abs(x - (L - 1) / 2) + Math.abs(y - (H - 1) / 2));
    return s;
  }

  // Joue i pour j sur une copie. Le gain = variation de l'écart de score.
  function simuler(e, i, j) {
    const copie = R.cloner(e, false);
    const r = R.jouer(copie, i, j);
    let gain = 0;
    if (r) for (const c of r.captures) gain += c.prisonniers.length + c.liberes.length;
    return { etat: copie, gain };
  }

  function meilleurGain(e, cases, j) {
    let meilleur = -1, gain = 0;
    for (const c of cases) {
      const g = simuler(e, c, j).gain;
      if (g > gain) { gain = g; meilleur = c; }
    }
    return { index: meilleur, gain };
  }

  function choisirFacile(e, j, alea) {
    const cand = candidats(e, 2);
    if (alea() < 0.5) {
      const m = meilleurGain(e, cand, j);
      if (m.gain > 0) return m.index;
    }
    const acc = acces(e, R.adversaire(j));
    let meilleur = cand[0], note = -Infinity;
    for (const c of cand) {
      const v = heuristique(e, c, j, acc) * 0.5 + alea() * 4;
      if (v > note) { note = v; meilleur = c; }
    }
    return meilleur;
  }

  function choisirMoyen(e, j, alea) {
    const q = R.adversaire(j);
    const cand = candidats(e, 2);
    const acc = acces(e, q);
    const pour = meilleurGain(e, cand, j);
    if (pour.gain > 0) return pour.index;
    const contre = meilleurGain(e, cand, q);
    if (contre.gain > 0) return contre.index; // occuper la case qui fermerait sa boucle
    let meilleur = cand[0], note = -Infinity;
    for (const c of cand) {
      const v = heuristique(e, c, j, acc) + alea() * 0.6;
      if (v > note) { note = v; meilleur = c; }
    }
    return meilleur;
  }

  // Menace : meilleur gain immédiat de j autour des cases données.
  function menace(e, centres, j) {
    const L = e.largeur, H = e.hauteur;
    const vu = new Set();
    let meilleur = 0;
    for (const centre of centres) {
      if (centre < 0) continue;
      const x = centre % L, y = (centre / L) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= L || yy >= H) continue;
          const c = yy * L + xx;
          if (vu.has(c) || !R.estJouable(e, c)) continue;
          vu.add(c);
          const g = simuler(e, c, j).gain;
          if (g > meilleur) meilleur = g;
        }
      }
    }
    return meilleur;
  }

  // Évaluation du point de vue de j, j ayant la main.
  function evaluer(e, j, derniers) {
    const q = R.adversaire(j);
    const s = R.scores(e);
    let v = 10 * (s[j] - s[q]);
    const accJ = acces(e, j), accQ = acces(e, q);
    for (let i = 0; i < e.proprio.length; i++) {
      if (e.geolier[i] || !e.proprio[i]) continue;
      if (e.proprio[i] === q && !accJ[i]) v += 2.5; // point adverse dans une de mes boucles
      else if (e.proprio[i] === j && !accQ[i]) v -= 2.5;
    }
    v += 7 * menace(e, derniers, j);
    v -= 4 * menace(e, derniers, q);
    return v;
  }

  function choisirDifficile(e, j, alea) {
    const t0 = maintenant();
    const q = R.adversaire(j);
    const cand = candidats(e, 2);
    if (cand.length === 1) return cand[0];

    const accQ = acces(e, q);
    const coups = cand.map((c) => {
      const sim = simuler(e, c, j);
      const bloque = simuler(e, c, q).gain;
      return { c, sim, cle: 10 * sim.gain + 6 * bloque + heuristique(e, c, j, accQ) + alea() * 0.3 };
    }).sort((a, b) => b.cle - a.cle);
    const retenus = coups.filter((m, k) => k < 20 || m.sim.gain > 0);

    let meilleur = retenus[0].c, meilleureValeur = -Infinity;
    for (const m of retenus) {
      if (maintenant() - t0 > BUDGET_MS && meilleureValeur > -Infinity) break;
      const s1 = m.sim.etat;
      let pire;
      if (R.estFinie(s1)) {
        pire = evaluer(s1, j, [m.c]);
      } else {
        const accJ = acces(s1, j);
        const reponses = candidats(s1, 2).map((r) => {
          const sim = simuler(s1, r, q);
          return { r, sim, cle: 10 * sim.gain + heuristique(s1, r, q, accJ) };
        }).sort((a, b) => b.cle - a.cle).filter((r, k) => k < 14 || r.sim.gain > 0);
        pire = Infinity;
        for (const r of reponses) {
          const v = evaluer(r.sim.etat, j, [m.c, r.r]);
          if (v < pire) pire = v;
          if (pire <= meilleureValeur) break; // coupure alpha-bêta
          if (maintenant() - t0 > BUDGET_MS * 1.05) break;
        }
        if (pire === Infinity) pire = evaluer(s1, j, [m.c]);
      }
      if (pire > meilleureValeur) { meilleureValeur = pire; meilleur = m.c; }
    }
    return meilleur;
  }

  function choisir(e, niveau, j, alea) {
    if (j === undefined) j = e.trait;
    alea = alea || Math.random;
    if (niveau === 'facile') return choisirFacile(e, j, alea);
    if (niveau === 'difficile') return choisirDifficile(e, j, alea);
    return choisirMoyen(e, j, alea);
  }

  return { choisir, candidats };
});
