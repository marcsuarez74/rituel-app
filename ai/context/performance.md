# Performance — Rituel

## Principes Généraux

- App PWA de la taille d'un paiement mobile : **le budget est petit, la marge est grande** — ne pas optimiser prématurément, mais ne rien régresser
- Optimiser la performance **perçue** (interactions < 100 ms, transitions fluides)
- Le contenu critique (cycle en cours) est **local** : zéro réseau ; seul le cycle d'exemple et les écrans secondaires sont des chunks chargés à la demande
- Chaque nouvelle dépendance = du JS à télécharger et analyser sur un vieux téléphone, en 4G de cuisine → poids fort dans la balance

---

## Budgets

| Métrique | Cible | Vérification |
|---|---|---|
| Bundle JS (gzip) | < 60 Ko | `npm run build` (taille affichée) |
| Précaché service worker | < 300 Ko | entrées `dist/sw.js` (actuellement ~11 fichiers, ~260 Ko) |
| Lighthouse Performance (mobile) | > 95 | audit DevTools sur `npm run preview` |
| LCP | < 1,5 s | l'app shell est du HTML+CSS quasi statique |
| Interaction (toggle coche) | < 100 ms | écriture localStorage synchrone, ok |

---

## React — Règles

### Rendu

- Composants minces et présentatifs : un re-render est bon marché par construction
- **Pas de `memo`/`useCallback`/`useMemo` spéculatif** — n'ajouter que sur mesure d'un vrai problème (profiler React DevTools)
- Pas de calcul dans le rendu qui pourrait être dérivé une fois : `useMemo` autorisé uniquement pour des dérivations non triviales (ex. groupement des courses)
- Listes : `key` **stable** = l'id du domaine (`item.id`), jamais l'index. C'est aussi la clé de persistance

### État

- `useState` local + props, **pas de store global** (YAGNI)
- Resynchronisation sur changement de prop : pattern render-phase reset (`syncedSemaine`), pas de `useEffect` inutile (rendu supplémentaire + flash de contenu périmé)
- localStorage est synchrone : lire au mount est OK pour cette taille de données ; ne pas introduire de couche async

---

## Vite & Bundle

- **Zéro dépendance runtime** hors React + js-yaml — toute nouvelle lib doit se justifier face à ce budget
- Code-splitting par écran (`React.lazy` + `Suspense`) : seul Aujourd'hui est dans le bundle initial ; Menu, Courses, Rituel, Suivi, Recette, mode guidé, Mon cycle, Semaine type, Profil, Onboarding et le cycle d'exemple sont des chunks précachés par le SW
- Images : miniatures de rayons **160×120 JPEG optimisées** (~5-10 Ko chacune, ~55 Ko au total, `src/assets/rayons/`) — servies en **CacheFirst runtime caching**, jamais dans le précache. Optimiser toute nouvelle image (`sips -Z 160 -s format jpeg -s formatOptions 60`)
- Pas de polyfill : cibles navigateurs modernes (Vite default), `esnext` OK

---

## PWA / Réseau

- Le précache service worker (`globPatterns` dans `vite.config.ts`) doit rester **petit et complet** : toute l'app + assets statiques — **sans les jpg** (exclus des glob patterns). Vérifier après chaque build que `dist/sw.js` liste l'essentiel (index, JS, CSS, manifest, icônes, ~11 entrées)
- Les miniatures de rayons passent par le **runtime caching** (`workbox.runtimeCaching` : jpg/jpeg/webp → CacheFirst, cacheName `images`, maxEntries 30, 30 jours) : hors-ligne OK après la première vue, sans gonfler le précache
- Données utilisateur en localStorage → l'app fonctionne 100 % hors ligne après la première visite ; ne jamais introduire d'appel réseau pour le contenu
- `registerSW({ immediate: true })` (autoUpdate) : la mise à jour s'applique au rechargement suivant — ne pas passer en `prompt` sans besoin UX réel

---

## CSS

- Un seul fichier `src/index.css` (~1 200 lignes) : pas de CSS-in-JS, pas de lib utilitaire (Tailwind), pas de `<style>` dans les composants
- Variables CSS sur `:root` = tokens ; les composants ne codent **jamais** une couleur/rayon en dur (seules tolérances : texte blanc `#ffffff` sur fonds basilic, texte encre `#26312b` sur fonds citron — valeurs figées par le design system)
- Transitions limitées aux propriétés bon marché (`background-color`, `color`, `transform`) + kill-switch `prefers-reduced-motion`
- Carrousel micro-batch : `overflow-x: auto` natif (scrollbar masquée), zéro JS — ne pas le remplacer par un carrousel JS

---

## Checklist Avant Déploiement

- [ ] `npm run build` passe et affiche un bundle dans le budget
- [ ] `dist/sw.js` précache tout le nécessaire (~11 entrées, **sans les jpg**) + `runtimeCaching` images intact
- [ ] Pas de nouvelle dépendance runtime sans discussion
- [ ] Pas de `memo`/`useCallback` ajoutés « au cas où »
- [ ] Pas d'appel réseau introduit (offline-first intact)
- [ ] Lighthouse mobile > 95 (audit sur `npm run preview`)
- [ ] Coches/pesées toujours fonctionnelles en mode avion (test DevTools offline)

---

## Anti-patterns à Éviter

```tsx
// ❌ Dériver dans le rendu sans memoïser un calcul coûteux (et non trivial)
{items.filter(i => i.rayon === 'proteines').sort(...).map(...)}

// ❌ index comme key
{items.map((it, i) => <Row key={i} />)}

// ❌ Effet de sync à la place du pattern render-phase reset
useEffect(() => { setChecks(getChecks(semaine)) }, [semaine]) // rendu + flash périmé

// ❌ Charger une lib pour un truc de 15 lignes (chart, date, state)
npm i recharts   // WeightChart SVG maison = ~110 lignes, zéro dépendance

// ❌ Fetch du contenu au démarrage
fetch('/cycle.json') // le contenu vit en localStorage, pas sur le réseau
```
