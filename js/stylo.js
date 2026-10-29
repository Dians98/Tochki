/* Stylo bille qui remplace le curseur pendant la partie. La pointe est le point actif. */
(function (racine) {
  'use strict';

  // Dessin de 200 × 200. La pointe du stylo est en (22, 112).
  const DESSIN = `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" stroke-linejoin="round" stroke-linecap="round">
  <!-- repère local : pointe en (0,0), le stylo le long de +x -->
  <g transform="translate(22 112) rotate(-55) scale(.86)">
    <!-- recharge : tube d'encre de la couleur du stylo, visible à travers le corps -->
    <rect x="8" y="-1" width="126" height="2" rx="1" fill="currentColor" fill-opacity=".9"/>

    <!-- embout conique transparent -->
    <path d="M3.5 -1.4 L24 -3.7 L24 3.7 L3.5 1.4 Z" fill="#cfd6db" fill-opacity=".55" stroke="#8f989f" stroke-width=".4"/>
    <!-- bout de la recharge et bille -->
    <path d="M1 -0.7 L5 -1.1 L5 1.1 L1 0.7 Z" fill="#aeb3b8" stroke="#80868b" stroke-width=".3"/>
    <path d="M5 -1.1 L10 -1.5 L10 1.5 L5 1.1 Z" fill="currentColor"/>
    <circle cx="0.6" cy="0" r="0.8" fill="#333"/>

    <!-- corps transparent fumé, à facettes -->
    <rect x="24" y="-3.7" width="114" height="7.4" rx=".8" fill="#c3cbd1" fill-opacity=".42" stroke="#7f8990" stroke-width=".45"/>
    <path d="M25 -2 H137" stroke="#ffffff" stroke-opacity=".75" stroke-width=".9"/>
    <path d="M25 2.2 H137" stroke="#5f686f" stroke-opacity=".35" stroke-width=".6"/>
    <path d="M25 -3.1 H137" stroke="#ffffff" stroke-opacity=".35" stroke-width=".4"/>

    <!-- bouchon arrière de couleur -->
    <path d="M137 -3.5 H149 Q151 -3.5 151 -1.5 V1.5 Q151 3.5 149 3.5 H137 Z" fill="currentColor" stroke="#000" stroke-opacity=".2" stroke-width=".4"/>
    <path d="M138 -2.2 H149" stroke="#ffffff" stroke-opacity=".3" stroke-width=".8"/>

    <!-- capuchon emboîté à l'arrière, avec son clip -->
    <path d="M124 -4.6 H166 Q171 -4.6 171 -1.8 V1.8 Q171 4.6 166 4.6 H124 Q122.5 4.6 122.5 3 V-3 Q122.5 -4.6 124 -4.6 Z"
          fill="currentColor" stroke="#000" stroke-opacity=".25" stroke-width=".45"/>
    <path d="M124 -3 H168" stroke="#ffffff" stroke-opacity=".32" stroke-width="1.1"/>
    <path d="M124 3 H168" stroke="#000" stroke-opacity=".18" stroke-width=".8"/>
    <path d="M131 -4.4 V-7.2 Q131 -8.4 132.4 -8.4 H166 Q168.5 -8.4 168.5 -6.6 V-4.4"
          fill="currentColor" stroke="#000" stroke-opacity=".3" stroke-width=".45"/>
    <path d="M133 -7.4 H165" stroke="#ffffff" stroke-opacity=".3" stroke-width=".6"/>
  </g>
</svg>`;

  function creer() {
    const el = document.createElement('div');
    el.className = 'main-stylo';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<div class="main-stylo-corps">${DESSIN}</div>`;
    document.body.appendChild(el);
    const corps = el.firstElementChild;

    return {
      deplacer(x, y) { el.style.transform = `translate3d(${x}px, ${y}px, 0)`; },
      couleur(c) { el.style.color = c; },
      montrer(visible) {
        el.classList.toggle('visible', visible);
        document.body.classList.toggle('sans-curseur', visible);
      },
      dehors(oui) { el.classList.toggle('dehors', oui); },
      attendre(oui) { el.classList.toggle('attente', oui); },
      taper() {
        corps.classList.remove('tape');
        void corps.offsetWidth;
        corps.classList.add('tape');
      },
    };
  }

  racine.Tochki = racine.Tochki || {};
  racine.Tochki.Stylo = { creer };
})(window);
