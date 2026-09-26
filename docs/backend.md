# Backend de synchronisation (VPS + SQLite)

La sync est **optionnelle** : sans `VITE_SYNC_URL` au build, l'app reste 100 %
locale (aucune requête réseau, aucune outbox). Elle sert à un seul cas :
retrouver semaines, coches, pesées, dépenses et profils sur les 2 téléphones
du foyer.

Spec : `docs/superpowers/specs/2026-09-26-sync-vps-sqlite-design.md`.
Guide serveur (systemd, proxy, backup) : `server/README.md`.

## Posture

- Les données vivent d'abord dans le téléphone (localStorage) ; le serveur est
  un miroir — l'app doit toujours être utilisable sans lui.
- Transparence : le bloc Profil → Foyer affiche « Données synchronisées sur
  votre serveur (rituel.marco-studio.fr). »
- Aucun secret dans le front : `VITE_SYNC_URL` est une URL publique ; le
  `JWT_SECRET` ne vit que dans `/etc/rituel.env` sur le VPS.

## 1. Installer le serveur (une fois)

Voir `server/README.md` : Node ≥ 22, `/opt/rituel` (utilisateur système
`rituel`), `/opt/rituel/data/rituel.db` (WAL), systemd `rituel.service`,
reverse proxy Caddy `rituel.marco-studio.fr` (SSE géré par défaut), backup
cron quotidien + rétention 14 jours (`server/backup.sh`). Secret :
`openssl rand -hex 32` → `JWT_SECRET` dans `/etc/rituel.env`.

## 2. Brancher l'app (build)

```bash
# local
VITE_SYNC_URL="https://rituel.marco-studio.fr" npm run build

# CI Deploy : secret GitHub VITE_SYNC_URL (Settings → Secrets → Actions)
```

Les téléphones se connectent ensuite **depuis l'app** :

- **Profil → Foyer → « Créer un foyer »** : un code d'invitation permanent est
  généré (phrase « mots d'herbes + 8 hex », ex. `romarin-basilic-3f9a2c7e`) ;
  il est affiché **une fois** (« Notez ce code : il n'est pas stocké en
  clair ») puis le téléphone se connecte ;
- **l'autre téléphone** : « Se connecter au foyer » avec ce code ;
- l'onboarding propose l'étape 6 optionnelle « Synchroniser les téléphones »
  (rejoindre un foyer existant).

## 3. Vérifier

1. Téléphone A : « Créer un foyer » → pastille bannière « Synchronisé ».
2. Téléphone B : « Se connecter au foyer » → la fusion union lui apporte les
   données du foyer (et pousse les siennes).
3. Cocher un item sur A → apparaît coché sur B (~1 s, SSE).
4. Mode avion : l'app continue hors ligne (outbox locale) ; au retour du
   réseau la file est vidée.
5. Indisponibilité du VPS → point en erreur ; un appui dessus (ou le retour du
   réseau) reconnecte en ~5 s sans recharger la page.

## Comment ça marche (résumé)

- **Outbox locale** (`sportapp:sync:outbox`) : toute mutation passe par
  `storage.ts` → `empilerMutation` (no-op sans env/token). Flush différée
  ~300 ms, dédup « dernier op gagne » par clé.
- **Pull/merge** : le SSE (debounce 150 ms) déclenche un pull ; le merge
  applique le remote sauf sur les clés en attente (l'outbox locale prime).
- **Connexion** : fusion union — le local part d'abord, puis le remote est
  fusionné, puis la flush pousse l'union (rien n'est écrasé ni perdu).
- **Purge** : « Supprimer les données du foyer » vide les 5 tables du foyer
  sur le serveur **avant** le local ; le foyer et son code survivent.
- **Déconnexion** : efface session + outbox locales ; le foyer garde ses
  données côté serveur.
- **Rotation / révocation du code** : supprimer la row du foyer dans SQLite
  (`sqlite3 /opt/rituel/data/rituel.db "delete from foyers where id = '…'"` —
  cascade sur les 5 tables) rend tous les JWT inertes ; recréer ensuite le
  foyer depuis l'app et reconnecter chaque téléphone (la fusion union repart
  des données locales de chacun).

## 4. Migration depuis Supabase (re-jumelage)

Les téléphones sont la source primaire ; Supabase n'était qu'un miroir.

1. **Avant tout** : vérifier les 2 téléphones « Synchronisé » sur Supabase
   (Supabase devient la copie de secours).
2. Ajouter le secret GitHub `VITE_SYNC_URL`, merger la PR → déploiement Pages
   → les PWA se mettent à jour (autoUpdate).
3. Téléphone A : Profil → « Créer un foyer » → noter le code. Téléphone B :
   « Se connecter au foyer » avec ce code.
4. La **fusion union existante** (`pousserTout` → merge outbox-prime → flush)
   repousse l'état local complet de chaque téléphone dans SQLite.
5. L'ancienne session Supabase (`sportapp:sync:token`) devient invalide avec
   le nouveau client : jusqu'au re-jumelage, l'app affiche `erreur`/formulaire
   de connexion — l'étape 3 la remplace d'abord (`demanderSession` réécrit la
   session).
6. Projet Supabase : mis en pause puis supprimé après vérification.
