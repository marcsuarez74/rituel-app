# Conservation des plats préparés

Référence de sécurité alimentaire pour la génération des menus et les rappels (app native,
voir `superpowers/specs/2026-10-14-refonte-native-from-scratch.md`).

**Principe** : la conservation est une **règle de code**, jamais une consigne dans un prompt ni
une donnée laissée au générateur. Quel que soit le moteur qui compose les menus (catalogue ou
IA), le code vérifie chaque repas contre cette table ; un menu qui ne la respecte pas est corrigé
ou rejeté, il n'arrive jamais à l'utilisateur.

Vérifié le 2026-10-15. Toute modification de ce fichier se fait en citant la source.

## 1. Ce que dit la réglementation

Le cadre visé est celui de la restauration collective : c'est celui qui encadre les
« préparations culinaires élaborées à l'avance » (PCEA), soit exactement nos Box et nos plats
« Prêt ». La loi ne s'applique pas à une cuisine familiale ; on s'aligne volontairement dessus
parce que c'est la référence la plus stricte et la plus claire.

Arrêté du 21 décembre 2009, **annexe IV** (« Dispositions particulières applicables aux
établissements de restauration collective »), version en vigueur depuis le 9 mai 2020
(modifiée par l'arrêté du 7 mai 2020) :

| Point | Règle (citation) | Usage dans l'app |
|---|---|---|
| 1 | Refroidissement : la température à cœur ne doit pas demeurer « entre + 63° C et + 10° C pendant plus de deux heures » ; puis conservation « entre 0° C et + 3° C » | Étape du Rituel : répartir dans les Box et mettre au frigo dans les 2 h |
| 2 | Préparations consommées froides : refroidies et entreposées « dès la fin de leur élaboration » au froid | Salades et Box froides : au frigo dès qu'elles sont prêtes |
| 3 | « Ces préparations culinaires doivent être consommées le jour de leur première remise en température » | Réchauffer une seule fois ; ce qui a été réchauffé ne retourne pas au frigo |
| 4 | « Si cette préparation culinaire est conservée réfrigérée, sa date limite de consommation ne peut excéder le troisième jour après celui de sa fabrication en l'absence d'études de durée de vie » | **J+3 maximum**, J0 = jour du Rituel |

Historique : la règle J+3 existait déjà dans l'arrêté du 29 septembre 1997 (article 40), qui
remplaçait un J+5 de 1974 ; la note de service DGAL/SDSSA/N2008-8186 rappelait qu'elle ne
demande aucune étude tant qu'on ne la dépasse pas.

Décongélation et recongélation (même arrêté, annexes I et VI, et règlement CE 853/2004) :
décongélation **en enceinte réfrigérée** ; un produit décongelé **ne se recongèle pas**.

## 2. Pourquoi l'app est plus prudente que J+3 sur certains plats

Un frigo domestique tourne autour de 4 °C (souvent plus dans la porte), pas entre 0 et 3 °C
comme une chambre froide contrôlée. J+3 est donc un **plafond**, pas une cible. Pour les
aliments les plus sensibles, on retient des durées plus courtes, issues des autorités
sanitaires grand public. Dans la table, chaque durée indique sa nature :

- **R** : réglementaire (arrêté 2009, annexe IV) ;
- **P** : prudence du projet, plus stricte que la réglementation, avec sa source.

## 3. Table de conservation

J0 = jour de fabrication (le Rituel). « Frigo max » = dernier jour où le plat peut être mangé
sorti du frigo. Un plat prend la catégorie de son **ingrédient le plus sensible**.

| Catégorie | Exemples | Frigo max | Nature | Congelable | Remarques |
|---|---|---|---|---|---|
| Plat cuisiné (défaut) | viande en sauce, légumineuses, légumes cuits, gratin, curry | J+3 | R | oui | |
| Volaille cuite | poulet rôti, émincé de dinde | J+3 | R | oui | |
| Soupe, velouté | | J+3 | R | oui | Santé Canada : 2 à 3 jours ; ne pas dépasser J+3 |
| Plat aux œufs cuits | quiche, frittata, cake salé | J+3 | R | oui (sauf œufs durs) | œufs durs : non congelables (texture) |
| Riz, pâtes, céréales cuits | riz, pâtes, semoule, quinoa, boulgour | **J+2** | P | oui | *Bacillus cereus* : refroidir vite ; Afsca : 2 jours max |
| Poisson, fruits de mer cuits | saumon, cabillaud, crevettes | **J+2** | P | oui (sauf s'ils ont déjà été décongelés) | |
| Préparation crue assemblée | taboulé, salade composée, crudités assaisonnées | **J+2** | P | non | assaisonner au dernier moment si possible |
| Sauce aux œufs crus | mayonnaise maison, tiramisu | — | P | non | **exclue des Box et des plats du Rituel** |
| Plat décongelé | toute catégorie | **24 h** après décongélation au frigo | P | **non (jamais recongeler)** | décongeler au frigo, jamais à température ambiante |

Congélation : à faire **le jour du Rituel**, dès refroidissement (pas un plat déjà gardé
plusieurs jours au frigo). Au-delà de 3 mois au congélateur, la qualité baisse ; la sécurité
n'est pas en cause tant que la chaîne du froid est tenue.

## 4. Règles que le code applique

Pour chaque repas issu du Rituel, avec `jour` = son jour de consommation :

1. `jour − J0 ≤ frigoMax(catégorie)` → le plat va au frigo.
2. Sinon, si la catégorie est congelable → le plat est **congelé au Rituel** et un rappel de
   décongélation est programmé (voir §5).
3. Sinon → le menu est **invalide** : le générateur doit déplacer le repas plus tôt dans la
   semaine ou le remplacer (par un repas frais du soir, par exemple). Erreur bloquante, comme
   dans l'actuel `cycle/valider.ts`.
4. Une Box ou un plat réchauffé se mange le jour même ; jamais deux réchauffages.

Conséquence avec un Rituel le dimanche (J0) : lundi, mardi, mercredi au frigo (J+1 à J+3,
J+2 au plus pour riz, poisson et crudités) ; **jeudi et vendredi viennent du congélateur** ou
sont cuisinés le soir.

## 5. Rappels (notifications locales)

Indispensables dès qu'un plat passe par le congélateur ou approche de sa limite :

| Quand | Message (exemple) |
|---|---|
| Rituel, après la cuisson | « Mets les Box au frigo avant 16 h 30 » (2 h après la fin de cuisson) |
| Veille au soir du repas congelé | « Sors la Box de jeudi du congélateur et mets-la au frigo » |
| Matin du dernier jour au frigo | « Dernier jour pour le gratin : il est au menu ce soir » |

Les rappels sont programmés à la génération des menus et recalculés si un repas est déplacé.
Côté natif : notifications locales (`expo-notifications`), demande de permission au bon moment
(Android 13+), sans serveur.

## 6. Sources

Textes officiels :

- Arrêté du 21 décembre 2009 relatif aux règles sanitaires applicables aux activités de
  commerce de détail, d'entreposage et de transport de produits d'origine animale et denrées
  alimentaires en contenant — [texte](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000021573483),
  [annexe IV en vigueur](https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000041864953)
- Arrêté du 7 mai 2020 modifiant l'arrêté du 21 décembre 2009 —
  [Légifrance](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000041857415/)
- Note de service DGAL/SDSSA/N2008-8186 du 21 juillet 2008 (durée de vie des PCEA, J+3) —
  [ministère de l'Agriculture](https://info.agriculture.gouv.fr/boagri/instruction-N2008-8186/telechargement)
- Règlement (CE) n° 852/2004 (hygiène des denrées) et n° 853/2004 (denrées d'origine animale)

Guides de référence :

- Guide de bonnes pratiques d'hygiène (GBPH) « Restaurateur » et « Restauration collective à
  caractère social » : guides validés par l'administration, liste sur agriculture.gouv.fr.
  **Non consultés** : vendus par les Journaux officiels ; à acheter si on veut aller plus loin.

Sources grand public (durées plus prudentes) :

- Santé Canada — [Conserver les restes](https://www.canada.ca/fr/services/sante/publications/aliments-et-nutrition/infographie-les-restes.html)
- ANSES (via OMS) — mettre au frais au plus tard 2 h après la préparation
- Afsca (Belgique) — riz et pâtes cuits : 2 jours maximum au réfrigérateur
- *Bacillus cereus* — [fiche du Service de la consommation de Neuchâtel](https://www.ne.ch/autorites/DDTE/SCAV/denrees-alimentaires/Documents/9FicheBacillusCereus.pdf)

## 7. Points ouverts

- Faire relire la table par un professionnel (diététicien ou formateur HACCP) avant la sortie.
- Trouver la source primaire ANSES/Afsca des durées « P » (aujourd'hui citées via des articles
  secondaires) ou les remplacer par une source primaire équivalente.
- Ce document n'est pas un avis médical ; l'app ne se substitue pas au bon sens (odeur,
  aspect, frigo trop chaud → on jette).
