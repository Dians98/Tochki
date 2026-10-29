/* Forme d'une zone capturée : morceaux de surface et contour, en coordonnées de grille. */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique();
  else { racine.Tochki = racine.Tochki || {}; racine.Tochki.Contour = fabrique(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // S = cases capturées + murs voisins. Un carré de grille est plein si ses 4 coins sont dans S, triangle s'il en a 3,
  // avec au moins une case capturée ; les arêtes vues une seule fois forment le contour.
  function forme(largeur, hauteur, cases, murs) {
    const n = largeur * hauteur;
    const dansS = new Uint8Array(n), dansZone = new Uint8Array(n);
    let x0 = largeur, y0 = hauteur, x1 = 0, y1 = 0;
    const noter = (i) => {
      dansS[i] = 1;
      const x = i % largeur, y = (i / largeur) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    };
    for (const c of cases) { noter(c); dansZone[c] = 1; }
    for (const m of murs) noter(m);

    const surfaces = [];
    const aretes = new Map();
    const compter = (a, b) => {
      const k = a < b ? a * n + b : b * n + a;
      aretes.set(k, (aretes.get(k) || 0) + 1);
    };

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const coins = [y * largeur + x, y * largeur + x + 1, (y + 1) * largeur + x + 1, (y + 1) * largeur + x];
        const presents = coins.filter((c) => dansS[c]);
        if (presents.length < 3 || !presents.some((c) => dansZone[c])) continue;
        surfaces.push(presents);
        for (let k = 0; k < presents.length; k++) compter(presents[k], presents[(k + 1) % presents.length]);
      }
    }

    // Arêtes de bord -> boucles fermées
    const voisins = new Map();
    const lier = (a, b, k) => {
      if (!voisins.has(a)) voisins.set(a, []);
      voisins.get(a).push({ autre: b, k });
    };
    for (const [k, nb] of aretes) {
      if (nb !== 1) continue;
      const a = Math.floor(k / n), b = k % n;
      lier(a, b, k); lier(b, a, k);
    }
    const utilisee = new Set();
    const boucles = [];
    for (const [depart, liste] of voisins) {
      for (const premiere of liste) {
        if (utilisee.has(premiere.k)) continue;
        const boucle = [depart];
        utilisee.add(premiere.k);
        let courant = premiere.autre;
        while (courant !== depart) {
          boucle.push(courant);
          const suite = voisins.get(courant).find((v) => !utilisee.has(v.k));
          if (!suite) break;
          utilisee.add(suite.k);
          courant = suite.autre;
        }
        boucles.push(boucle);
      }
    }

    const pt = (i) => [i % largeur, (i / largeur) | 0];
    return {
      surfaces: surfaces.map((s) => s.map(pt)),
      boucles: boucles.map((b) => b.map(pt)),
    };
  }

  return { forme };
});
