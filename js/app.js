/* Déroulé du jeu : couverture -> partie -> résultat. */
(function () {
  'use strict';
  const { Regles: R, Ordi: O, Rendu } = window.Tochki;
  const $ = (id) => document.getElementById(id);

  const cahier = $('cahier'), page = $('page'), form = $('reglages'), svg = $('feuille');
  const boutonAbandon = $('abandonner');
  const feuille = Rendu.creer(svg, R.LARGEUR, R.HAUTEUR);
  const stylo = window.Tochki.Stylo.creer();

  const NOM_ORDI = "L'ordinateur";
  const DUREE_OUVERTURE = 1300;
  const DUREE_PAGE = 950;
  const PAUSE_ORDI = 450;

  let config = null, etat = null, numero = 0, occupe = true, confirmation = null;

  // Couverture

  function majMode() {
    const mode = form.elements.mode.value;
    form.querySelectorAll('[data-mode]').forEach((bloc) => { bloc.hidden = bloc.dataset.mode !== mode; });
  }
  form.addEventListener('change', majMode);
  majMode();

  function lireReglages() {
    const d = new FormData(form);
    const texte = (nom, defaut) => String(d.get(nom) || '').trim() || defaut;
    if (d.get('mode') === 'deux') {
      return { ordi: 0, noms: { 1: texte('nom-bleu', 'Bleu'), 2: texte('nom-rouge', 'Rouge') } };
    }
    const humain = d.get('couleur') === 'rouge' ? R.ROUGE : R.BLEU;
    const nom = texte('nom-joueur', 'Toi');
    return {
      ordi: R.adversaire(humain),
      niveau: d.get('niveau'),
      noms: humain === R.BLEU ? { 1: nom, 2: NOM_ORDI } : { 1: NOM_ORDI, 2: nom },
    };
  }

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    config = lireReglages();
    cahier.classList.add('ouvert');
    nouvellePartie(DUREE_OUVERTURE);
  });

  // Partie

  const tourOrdi = () => !!(config && config.ordi && etat && etat.trait === config.ordi);
  const peutJouer = () => !!etat && !occupe && !R.estFinie(etat) && !tourOrdi();

  function nouvellePartie(attente) {
    numero++;
    etat = R.creer();
    feuille.vider(numero);
    $('resultat').hidden = true;
    annulerConfirmation();
    occupe = true;
    majTableau();
    setTimeout(() => { occupe = false; enchainer(); }, attente);
  }

  function enchainer() {
    majTableau();
    if (R.estFinie(etat)) finir();
    else if (tourOrdi()) jouerOrdi();
  }

  function jouerOrdi() {
    occupe = true;
    majTableau();
    const debut = performance.now();
    // Laisse le navigateur afficher « réfléchit » avant le calcul.
    setTimeout(() => {
      const i = O.choisir(etat, config.niveau, config.ordi);
      const reste = Math.max(0, PAUSE_ORDI - (performance.now() - debut));
      setTimeout(() => { occupe = false; jouerCoup(i); }, reste);
    }, 30);
  }

  function jouerCoup(i) {
    const r = R.jouer(etat, i);
    if (!r) return;
    feuille.montrerFantome(-1);
    feuille.poserPoint(i, r.joueur);
    let duree = 0;
    for (const capture of r.captures) duree = Math.max(duree, feuille.dessinerCapture(capture));
    feuille.majPoints(etat);
    feuille.majCaptures(etat);
    if (duree) {
      // On laisse le contour se dessiner avant le coup suivant.
      occupe = true;
      majTableau();
      setTimeout(() => { occupe = false; enchainer(); }, Math.min(duree, 900));
    } else {
      enchainer();
    }
  }

  // Le stylo suit le pointeur partout ; il n'est visible que pendant une partie.
  document.addEventListener('pointermove', (ev) => {
    stylo.deplacer(ev.clientX, ev.clientY);
    stylo.dehors(false);
  });
  document.documentElement.addEventListener('mouseleave', () => stylo.dehors(true));

  function majStylo() {
    const actif = !!etat && !R.estFinie(etat) && cahier.classList.contains('ouvert');
    stylo.montrer(actif);
    if (!actif) return;
    const j = config.ordi ? R.adversaire(config.ordi) : etat.trait;
    stylo.couleur(Rendu.ENCRE[j]);
    stylo.attendre(tourOrdi());
  }

  svg.addEventListener('pointermove', (ev) => {
    if (!peutJouer()) { feuille.montrerFantome(-1); return; }
    const i = feuille.indexSous(ev);
    feuille.montrerFantome(R.estJouable(etat, i) ? i : -1, etat.trait);
  });
  svg.addEventListener('pointerleave', () => feuille.montrerFantome(-1));
  svg.addEventListener('click', (ev) => {
    if (!peutJouer()) return;
    const i = feuille.indexSous(ev);
    if (R.estJouable(etat, i)) { annulerConfirmation(); stylo.taper(); jouerCoup(i); }
  });

  // Tableau des scores (revers de la couverture)

  function majTableau() {
    if (!config || !etat) return;
    const s = R.scores(etat), finie = R.estFinie(etat);
    $('num').textContent = numero;
    for (const j of [1, 2]) {
      $('nom-' + j).textContent = config.noms[j];
      $('score-' + j).textContent = s[j];
      $('ligne-' + j).classList.toggle('a-le-trait', !finie && etat.trait === j);
    }
    let texte;
    if (finie) texte = 'Partie terminée.';
    else if (tourOrdi()) texte = "L'ordinateur réfléchit…";
    else if (config.ordi) texte = 'À toi de jouer.';
    else texte = `À toi, ${config.noms[etat.trait]}.`;
    $('tour').textContent = texte;
    boutonAbandon.disabled = !peutJouer();
    page.classList.toggle('jouable', peutJouer());
    majStylo();
  }

  // Abandon en deux clics, puisqu'on ne peut pas annuler.
  boutonAbandon.addEventListener('click', () => {
    if (!peutJouer()) return;
    if (!confirmation) {
      boutonAbandon.textContent = 'Sûr ? Clique encore';
      boutonAbandon.classList.add('confirmer');
      confirmation = setTimeout(annulerConfirmation, 3000);
      return;
    }
    annulerConfirmation();
    R.abandonner(etat);
    enchainer();
  });

  function annulerConfirmation() {
    clearTimeout(confirmation);
    confirmation = null;
    boutonAbandon.textContent = 'Abandonner';
    boutonAbandon.classList.remove('confirmer');
  }

  // Fin de partie

  function finir() {
    occupe = true;
    majTableau();
    const s = R.scores(etat), v = R.vainqueur(etat);
    const nom = (j) => config.noms[j];
    let titre, detail;
    if (etat.abandon) {
      titre = config.ordi ? 'Tu abandonnes.' : `${nom(etat.abandon)} abandonne.`;
      detail = `${nom(v)} gagne la partie.`;
    } else if (v === 0) {
      titre = 'Égalité !';
      detail = `${s[1]} partout.`;
    } else {
      titre = config.ordi ? (v === config.ordi ? "L'ordinateur gagne." : 'Tu gagnes !') : `${nom(v)} gagne !`;
      detail = `${s[v]} à ${s[R.adversaire(v)]}`;
    }
    const encre = v === 0 ? 'var(--crayon)' : v === R.BLEU ? 'var(--encre-bleue)' : 'var(--encre-rouge)';
    setTimeout(() => {
      $('resultat-titre').textContent = titre;
      $('resultat-titre').style.color = encre;
      $('resultat-detail').textContent = detail;
      $('resultat').hidden = false;
      Rendu.cadreMain($('cadre-resultat'), 100, 50, encre, numero * 7919);
      $('rejouer').focus({ preventScroll: true });
    }, 700);
  }

  function tournerPage() {
    const feuilleTournee = document.createElement('div');
    feuilleTournee.className = 'feuille-tournee';
    const recto = document.createElement('div');
    const copie = svg.cloneNode(true);
    copie.removeAttribute('id');
    recto.appendChild(copie);
    const verso = document.createElement('div');
    verso.className = 'verso';
    feuilleTournee.append(recto, verso);
    cahier.appendChild(feuilleTournee);
    feuilleTournee.addEventListener('animationend', () => feuilleTournee.remove());
  }

  $('rejouer').addEventListener('click', () => {
    $('resultat').hidden = true;
    tournerPage();
    nouvellePartie(DUREE_PAGE);
  });

  $('fermer').addEventListener('click', () => {
    $('resultat').hidden = true;
    etat = null;
    occupe = true;
    cahier.classList.remove('ouvert');
    majStylo();
    setTimeout(() => feuille.vider(numero + 1), DUREE_OUVERTURE);
    form.querySelector('.ouvrir').focus({ preventScroll: true });
  });

  feuille.vider(1);
})();
