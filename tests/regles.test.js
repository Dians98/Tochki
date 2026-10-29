// Tests du moteur : node tests/regles.test.js
'use strict';
const R = require('../js/regles.js');
const C = require('../js/contour.js');
const O = require('../js/ordi.js');

let echecs = 0;
function test(nom, fn) {
  try { fn(); console.log('  ok  ' + nom); }
  catch (err) { echecs++; console.log('  ÉCHEC  ' + nom + '\n        ' + err.message); }
}
function egal(a, b, msg) { if (a !== b) throw new Error((msg || '') + ` attendu ${b}, obtenu ${a}`); }

const B = R.BLEU, Ro = R.ROUGE;
// Joue une liste de [x, y, joueur] et renvoie le résultat du dernier coup.
function suite(e, coups) {
  let r = null;
  for (const [x, y, j] of coups) {
    r = R.jouer(e, R.index(e, x, y), j);
    if (!r) throw new Error(`coup refusé en ${x},${y}`);
  }
  return r;
}
const anneauCarre = (cx, cy, j) => {
  const c = [];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
    if (Math.max(Math.abs(dx), Math.abs(dy)) === 2) c.push([cx + dx, cy + dy, j]);
  return c;
};

test('capture en losange', () => {
  const e = R.creer(9, 9);
  const r = suite(e, [[4, 4, Ro], [3, 4, B], [4, 3, B], [5, 4, B], [4, 5, B]]);
  egal(r.captures.length, 1, 'captures');
  egal(R.scores(e)[B], 1, 'score bleu');
  egal(e.zone[R.index(e, 4, 4)], B, 'zone');
});

test('le bord ne ferme pas une boucle', () => {
  const e = R.creer(9, 9);
  const r = suite(e, [[0, 4, Ro], [0, 3, B], [1, 4, B], [0, 5, B]]);
  egal(r.captures.length, 0);
  egal(R.scores(e)[B], 0);
});

test('boucle vide sans effet, point rouge posé dedans non capturé', () => {
  const e = R.creer(9, 9);
  let r = suite(e, [[3, 4, B], [4, 3, B], [5, 4, B], [4, 5, B]]);
  egal(r.captures.length, 0, 'boucle vide');
  r = suite(e, [[4, 4, Ro]]);
  egal(r.captures.length, 0, 'intrus');
  egal(e.geolier[R.index(e, 4, 4)], 0, 'rouge reste actif');
});

test('point bleu posé dans l’anneau sans le couper : rien', () => {
  const e = R.creer(11, 11);
  suite(e, anneauCarre(5, 5, B));
  suite(e, [[4, 4, Ro]]);
  const r = suite(e, [[6, 6, B]]);
  egal(r.captures.length, 0);
  egal(R.scores(e)[B], 0);
});

test('coupure de l’anneau : les deux côtés sont capturés', () => {
  const e = R.creer(11, 11);
  suite(e, anneauCarre(5, 5, B));
  suite(e, [[4, 4, Ro], [6, 4, Ro]]);
  egal(suite(e, [[5, 4, B]]).captures.length, 0, '1er point de la coupure');
  egal(suite(e, [[5, 5, B]]).captures.length, 0, '2e point de la coupure');
  const r = suite(e, [[5, 6, B]]);
  egal(r.captures.length, 2, 'deux côtés');
  egal(R.scores(e)[B], 2, 'score');
});

test('recapture avec libération', () => {
  const e = R.creer(11, 11);
  suite(e, [[5, 5, Ro], [4, 5, B], [5, 4, B], [6, 5, B], [5, 6, B]]);
  egal(R.scores(e)[B], 1, 'bleu capture d’abord');
  const r = suite(e, [[3, 5, Ro], [4, 4, Ro], [5, 3, Ro], [6, 4, Ro], [7, 5, Ro], [6, 6, Ro], [5, 7, Ro], [4, 6, Ro]]);
  egal(r.captures.length, 1, 'recapture');
  const s = R.scores(e);
  egal(s[Ro], 4, 'rouge retient les 4 bleus');
  egal(s[B], 0, 'le rouge prisonnier est libéré');
  egal(e.zone[R.index(e, 5, 5)], Ro, 'la zone passe au rouge');
  egal(R.captureVisible(e, e.captures[0]), false, 'ancien contour bleu effacé');
});

test('zone capturée et hors grille injouables', () => {
  const e = R.creer(11, 11);
  suite(e, anneauCarre(5, 5, B));
  suite(e, [[5, 5, Ro]]);
  egal(R.estJouable(e, R.index(e, 4, 4)), true, 'avant capture');
  // la boucle est déjà fermée : il faut la couper pour capturer
  egal(suite(e, [[4, 5, B]]).captures.length, 0, 'pas encore coupée');
  const r = suite(e, [[5, 4, B]]); // isole le coin (4,4) : la région est coupée en deux
  egal(r.captures.length, 1, 'capture du morceau qui contient le rouge');
  egal(R.estJouable(e, R.index(e, 6, 6)), false, 'zone capturée');
  egal(R.estJouable(e, R.index(e, 4, 4)), true, 'morceau vide : reste jouable');
  egal(R.estJouable(e, -1), false, 'hors grille');
  egal(R.estJouable(e, e.proprio.length), false, 'hors grille fin');
});

test('fin quand la grille est pleine', () => {
  const e = R.creer(2, 2);
  suite(e, [[0, 0, B], [1, 0, Ro], [0, 1, B]]);
  egal(R.estFinie(e), false);
  suite(e, [[1, 1, Ro]]);
  egal(R.estFinie(e), true);
});

test('abandonner : celui qui a le trait perd', () => {
  const e = R.creer(9, 9);
  suite(e, [[4, 4, Ro], [3, 4, B], [4, 3, B], [5, 4, B], [4, 5, B]]);
  e.trait = B;
  R.abandonner(e);
  egal(R.estFinie(e), true);
  egal(R.vainqueur(e), Ro, 'bleu menait mais abandonne');
});

test('contour du losange : une boucle de 4 sommets', () => {
  const e = R.creer(9, 9);
  suite(e, [[4, 4, Ro], [3, 4, B], [4, 3, B], [5, 4, B], [4, 5, B]]);
  const c = e.captures[0];
  const f = C.forme(e.largeur, e.hauteur, c.cases, c.murs);
  egal(f.boucles.length, 1);
  egal(f.boucles[0].length, 4);
  egal(f.surfaces.length, 4, 'quatre triangles');
});

test('ordinateur Moyen saisit une capture offerte', () => {
  const e = R.creer(17, 25);
  suite(e, [[8, 12, Ro], [7, 12, B], [8, 11, B], [9, 12, B]]);
  e.trait = B;
  egal(O.choisir(e, 'moyen', B), R.index(e, 8, 13));
});

test('ordinateur : coups valides à chaque niveau et Difficile ≤ 1 s', () => {
  for (const niveau of ['facile', 'moyen', 'difficile']) {
    const e = R.creer();
    let pire = 0;
    for (let k = 0; k < 40 && !R.estFinie(e); k++) {
      const t = Date.now();
      const i = O.choisir(e, niveau, e.trait);
      pire = Math.max(pire, Date.now() - t);
      if (!R.jouer(e, i)) throw new Error(`${niveau} : coup invalide ${i}`);
    }
    if (niveau === 'difficile' && pire > 1100) throw new Error(`trop lent : ${pire} ms`);
    console.log(`        ${niveau} : coup le plus long ${pire} ms`);
  }
});

console.log(echecs ? `\n${echecs} échec(s)` : '\nTous les tests passent.');
process.exit(echecs ? 1 : 0);
