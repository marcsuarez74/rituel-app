# Plan — release-please (spec : 2026-10-08-release-please-design.md)

1. Ajouter `release-please-config.json` et `.release-please-manifest.json` (`2.1.0`).
2. Réécrire `.github/workflows/publier.yml` (release-please-action@v4) ; supprimer `release.yml`.
3. CHANGELOG : retirer « Non publié », adapter l'en-tête, historique intact.
4. Mettre à jour CLAUDE.md (§ Release) et AGENTS.md (workflows, Git).
5. Valider : actionlint, JSON, `npm test && npm run typecheck && npm run lint && npm run build`.
6. PR `ci/release-please` ; après fusion et activation du réglage GitHub, vérifier l'ouverture de la PR de release au prochain `feat`/`fix`.
