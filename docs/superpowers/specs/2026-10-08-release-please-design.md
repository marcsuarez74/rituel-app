# Release automatique avec release-please

**Date** : 2026-10-08

## Problème
Le bump de `package.json` et la section CHANGELOG sont faits à la main : oublis, semver subjectif.

## Décision
Adopter `googleapis/release-please-action@v4` (mode manifest, release-type `node`, paquet racine).

- Semver déduit des conventional commits : `feat` → mineur, `fix`/`perf` → correctif, `!` ou `BREAKING CHANGE:` → majeur ; `docs`/`chore`/`ci`/`test`/`refactor` ne déclenchent rien seuls.
- Release-please ouvre une PR « chore(main): release x.y.z » (bump + CHANGELOG) ; la fusionner pose le tag `v<version>` (`include-v-in-tag`, sans composant) et crée la GitHub Release elle-même : `release.yml` est supprimé.
- Sections du CHANGELOG en français : Ajouté, Corrigé, Performances ; les autres types sont masqués.
- Amorçage : `.release-please-manifest.json` = `2.1.0`, le tag `v2.1.0` existe déjà, donc pas de `bootstrap-sha` nécessaire.

## Limites
- La PR de release (ouverte par `GITHUB_TOKEN`) ne déclenche pas `ci.yml` ; elle ne touche que package.json/CHANGELOG/manifest.
- Réglage dépôt requis, à activer par le propriétaire : Settings › Actions › « Allow GitHub Actions to create and approve pull requests ».
