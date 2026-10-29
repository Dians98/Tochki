/* Dessin de la page de cahier en SVG (unités : millimètres). */
(function (racine) {
  'use strict';
  const R = racine.Tochki.Regles, C = racine.Tochki.Contour;
  const NS = 'http://www.w3.org/2000/svg';

  const PAGE_L = 170, PAGE_H = 220;
  const MARGE = 28;           // trait rouge de la marge
  const X0 = 36, Y0 = 14;     // première intersection jouable
  const PAS = 8;              // grand carreau Seyès
  const ENCRE = { 1: '#1f3a9e', 2: '#bf2a2f' };

  const mmX = (x) => X0 + x * PAS;
  const mmY = (y) => Y0 + y * PAS;
  const arrondi = (v) => Math.round(v * 100) / 100;

  function el(nom, attrs, parent) {
    const n = document.createElementNS(NS, nom);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  // Générateur pseudo-aléatoire à graine : le même contour se redessine à l'identique.
  function graine(s) {
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const unite = (dx, dy) => { const l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };

  // Catmull-Rom vers Bézier ; les points marqués « coin » restent anguleux.
  function lisser(pts) {
    let d = `M${arrondi(pts[0].x)} ${arrondi(pts[0].y)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = p1.coin ? p1 : { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
      const c2 = p2.coin ? p2 : { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
      d += ` C${arrondi(c1.x)} ${arrondi(c1.y)} ${arrondi(c2.x)} ${arrondi(c2.y)} ${arrondi(p2.x)} ${arrondi(p2.y)}`;
    }
    return d;
  }

  // Trait à main levée autour d'une boucle : ondulations, coins qui dépassent, départ et arrivée décalés.
  function traitMain(boucle, alea) {
    const n = boucle.length;
    const bruit = (a) => (alea() * 2 - 1) * a;
    const P = boucle.map(([x, y]) => ({ x: mmX(x), y: mmY(y) }));
    const coin = P.map((p, k) => {
      const a = P[(k - 1 + n) % n], b = P[(k + 1) % n];
      const u = unite(p.x - a.x, p.y - a.y), v = unite(b.x - p.x, b.y - p.y);
      return u[0] * v[0] + u[1] * v[1] < 0.95;
    });

    const pts = [];
    const entree = unite(P[0].x - P[n - 1].x, P[0].y - P[n - 1].y);
    const recul = 0.6 + alea() * 0.6;
    pts.push({ x: P[0].x - entree[0] * recul + bruit(0.25), y: P[0].y - entree[1] * recul + bruit(0.25) });

    for (let k = 0; k <= n; k++) {
      const p = P[k % n], q = P[(k + 1) % n];
      if (k === n) {
        const d = unite(q.x - p.x, q.y - p.y), depasse = 0.6 + alea() * 0.7;
        pts.push({ x: p.x + bruit(0.2), y: p.y + bruit(0.2) });
        pts.push({ x: p.x + d[0] * depasse + bruit(0.3), y: p.y + d[1] * depasse + bruit(0.3) });
        break;
      }
      const estCoin = k > 0 && coin[k];
      if (estCoin && alea() < 0.55) {
        const prec = P[k - 1], d = unite(p.x - prec.x, p.y - prec.y), o = 0.5 + alea() * 0.6;
        pts.push({ x: p.x + d[0] * o + bruit(0.15), y: p.y + d[1] * o + bruit(0.15), coin: true });
      }
      pts.push({ x: p.x + bruit(0.3), y: p.y + bruit(0.3), coin: estCoin });
      const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
      const etapes = l > 9 ? 2 : 1;
      for (let s = 1; s <= etapes; s++) {
        const t = s / (etapes + 1) + bruit(0.06), o = bruit(0.45);
        pts.push({ x: p.x + dx * t + nx * o, y: p.y + dy * t + ny * o });
      }
    }
    return lisser(pts);
  }

  function creer(svg, largeur, hauteur) {
    svg.setAttribute('viewBox', `0 0 ${PAGE_L} ${PAGE_H}`);
    svg.innerHTML = '';
    const yBas = mmY(hauteur - 1), xDroite = mmX(largeur - 1);

    const reglure = el('g', { class: 'reglure' }, svg);
    for (let y = Y0; y <= yBas + 0.01; y += 2) {
      const principale = Math.round(y - Y0) % PAS === 0;
      el('line', { x1: 0, x2: PAGE_L, y1: y, y2: y, class: principale ? 'ligne-carreau' : 'ligne-fine' }, reglure);
    }
    for (let x = X0; x <= xDroite + 0.01; x += PAS) {
      el('line', { x1: x, x2: x, y1: Y0, y2: yBas, class: 'ligne-carreau' }, reglure);
    }
    el('line', { x1: MARGE, x2: MARGE, y1: 0, y2: PAGE_H, class: 'ligne-marge' }, reglure);

    const entete = el('g', { class: 'entete' }, svg);
    const titre = el('text', { x: X0, y: 9.5 }, entete);
    const date = el('text', { x: xDroite, y: 9.5, 'text-anchor': 'end' }, entete);
    const jour = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    date.textContent = 'Le ' + jour;

    const zones = el('g', { class: 'zones' }, svg);
    const points = el('g', { class: 'points' }, svg);
    const marques = el('g', { class: 'marques' }, svg);
    const fantome = el('circle', { r: 1.05, class: 'fantome', visibility: 'hidden' }, svg);
    const dernier = el('circle', { r: 2.1, class: 'dernier', visibility: 'hidden' }, marques);

    let cercles = new Map();   // index -> cercle
    let traces = new Map();    // id capture -> { g, capture }
    let numero = 1;

    function vider(num) {
      numero = num;
      zones.innerHTML = '';
      points.innerHTML = '';
      cercles = new Map();
      traces = new Map();
      dernier.setAttribute('visibility', 'hidden');
      fantome.setAttribute('visibility', 'hidden');
      titre.textContent = `Partie n° ${num}`;
    }

    function centre(i) { return { x: mmX(i % largeur), y: mmY((i / largeur) | 0) }; }

    function poserPoint(i, j) {
      const c = centre(i);
      const cercle = el('circle', { cx: c.x, cy: c.y, r: 1.05, fill: ENCRE[j], class: 'point pose' }, points);
      cercles.set(i, cercle);
      dernier.setAttribute('cx', c.x);
      dernier.setAttribute('cy', c.y);
      dernier.setAttribute('stroke', ENCRE[j]);
      dernier.setAttribute('visibility', 'visible');
    }

    function majPoints(etat) {
      for (const [i, cercle] of cercles) cercle.classList.toggle('prisonnier', etat.geolier[i] !== 0);
    }

    function dessinerCapture(capture) {
      const f = C.forme(largeur, hauteur, capture.cases, capture.murs);
      const encre = ENCRE[capture.joueur];
      const g = el('g', { class: 'capture' }, zones);

      const d = f.surfaces.map((s) => 'M' + s.map(([x, y]) => `${mmX(x)} ${mmY(y)}`).join(' L') + 'Z').join(' ');
      const teinte = el('path', { d, fill: encre, class: 'teinte' }, g);

      const alea = graine(capture.id * 9973 + numero * 131);
      const traits = [];
      for (const boucle of f.boucles) {
        if (boucle.length < 3) continue;
        traits.push(el('path', { d: traitMain(boucle, alea), stroke: encre, class: 'trait trait-appuye' }, g));
        traits.push(el('path', { d: traitMain(boucle, alea), stroke: encre, class: 'trait trait-leger' }, g));
      }

      // Tracé progressif du contour, puis la teinte apparaît.
      let duree = 0;
      traits.forEach((p, k) => {
        const l = p.getTotalLength();
        const ms = Math.min(1600, Math.max(500, l * 9));
        duree = Math.max(duree, ms);
        p.style.strokeDasharray = `${l} ${l}`;
        p.style.strokeDashoffset = l;
        p.getBoundingClientRect();
        p.style.transition = `stroke-dashoffset ${ms}ms cubic-bezier(.45,.1,.35,1) ${k % 2 ? 90 : 0}ms`;
        p.style.strokeDashoffset = 0;
      });
      setTimeout(() => teinte.classList.add('visible'), Math.round(duree * 0.6));
      traces.set(capture.id, { g, capture });
      return duree;
    }

    function majCaptures(etat) {
      for (const [id, t] of traces) {
        if (R.captureVisible(etat, t.capture)) continue;
        t.g.classList.add('efface');
        setTimeout(() => t.g.remove(), 700);
        traces.delete(id);
      }
    }

    function montrerFantome(i, j) {
      if (i < 0) { fantome.setAttribute('visibility', 'hidden'); return; }
      const c = centre(i);
      fantome.setAttribute('cx', c.x);
      fantome.setAttribute('cy', c.y);
      fantome.setAttribute('fill', ENCRE[j]);
      fantome.setAttribute('visibility', 'visible');
    }

    // Intersection la plus proche du pointeur, ou -1.
    function indexSous(evt) {
      const ctm = svg.getScreenCTM();
      if (!ctm) return -1;
      const p = new DOMPoint(evt.clientX, evt.clientY).matrixTransform(ctm.inverse());
      const gx = Math.round((p.x - X0) / PAS), gy = Math.round((p.y - Y0) / PAS);
      if (gx < 0 || gy < 0 || gx >= largeur || gy >= hauteur) return -1;
      if (Math.hypot(p.x - mmX(gx), p.y - mmY(gy)) > 3.4) return -1;
      return gy * largeur + gx;
    }

    return { vider, poserPoint, majPoints, dessinerCapture, majCaptures, montrerFantome, indexSous };
  }

  // Cadre griffonné autour du résultat (même trait que les contours).
  function cadreMain(svg, l, h, encre, s) {
    svg.setAttribute('viewBox', `0 0 ${l} ${h}`);
    svg.innerHTML = '';
    const alea = graine(s);
    const m = 1.5, boucle = [[m, m], [l - m, m], [l - m, h - m], [m, h - m]];
    const bruit = (a) => (alea() * 2 - 1) * a;
    const pts = [];
    boucle.concat([boucle[0], [boucle[1][0] * 0.12 + m, m]]).forEach(([x, y], k, tout) => {
      pts.push({ x: x + bruit(0.6), y: y + bruit(0.6), coin: k > 0 && k < tout.length - 1 });
      const suiv = tout[k + 1];
      if (suiv) pts.push({ x: (x + suiv[0]) / 2 + bruit(0.8), y: (y + suiv[1]) / 2 + bruit(0.8) });
    });
    el('path', { d: lisser(pts), stroke: encre, class: 'trait trait-appuye' }, svg);
  }

  racine.Tochki = racine.Tochki || {};
  racine.Tochki.Rendu = { creer, cadreMain, ENCRE };
})(window);
