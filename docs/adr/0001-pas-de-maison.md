# 0001 — Pas de maison : seule une nouvelle boucle capture

## Statut
Acceptée, 29/10/2026.

## Contexte
Dans plusieurs variantes de Tochki, une boucle vide devient une « maison » : si l'adversaire y joue, son point est capturé immédiatement. Les joueurs de ce projet jouent sans maison : fermer une boucle vide est permis, mais ne protège rien.

Il fallait alors décider quand un point adverse entré dans une boucle vide peut être pris. Deux lectures étaient possibles :

1. **Encerclé à tout moment** : après chaque coup, tout point adverse entouré est pris. Dans ce cas, l'intrus serait capturé au coup suivant de n'importe où sur la page, ce qui revient à une maison avec un coup de retard.
2. **Nouvelle fermeture** : seul le coup qui ferme une nouvelle boucle capture.

## Décision
On retient la **nouvelle fermeture**. Quand un joueur pose un point, on regarde uniquement la région (vue à travers ses murs) qui contenait ce point :
- si cette région touchait le bord, les morceaux qui n'y touchent plus sont nouvellement fermés ;
- si elle était déjà fermée, il faut que le point la coupe en au moins deux morceaux, et chacun d'eux est alors nouvellement fermé.

Un morceau nouvellement fermé qui contient un point adverse actif est capturé. Seul le joueur qui vient de jouer peut capturer.

## Conséquences
- Un point adverse dans une boucle vide reste libre. Pour le prendre, il faut tracer une nouvelle boucle autour de lui, par exemple en coupant l'anneau.
- Une coupure qui sépare deux intrus capture les deux côtés à la fois.
- Le calcul reste local (une seule région par coup), ce qui laisse à l'ordinateur le temps d'anticiper.
- Revenir à une règle de maison changerait le moteur, les tests et les heuristiques de l'ordinateur.
