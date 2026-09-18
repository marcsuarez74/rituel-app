# UX v1.4 — Vague 2 « volet Personnalisation » — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le volet profil de la vague 2 v1.4 (scope A validé) : onboarding tout sautable (CTA « Passer », seule l'étape 1 reste obligatoire), suppression du doublon d'objectif à l'étape 4, prénom éditable (étape 1 « C'est ton prénom ? » + Mes infos) et fusion des 3 sources de libellés (PROFILS onboarding, TITLES ProfileView, PRENOMS model.ts) en une seule, utilisée par salutations, titres et prompt IA. Profil **shape v2.2** : `prenom?`, `dateNaissance?` et `taille?` deviennent optionnels (migration douce, aucun reset de données).

**Architecture:** La source unique vit dans `src/lib/model.ts` (`PROFILS_META` + `prenomProfil`). La garde de forme profil (`storage.ts`) passe en validation champ par champ : un champ présent mais illégal est lâché (jamais invalidant), un champ absent est simplement omis — un profil partiel (onboarding sauté) se charge et s'affiche sans crash. Les vues restent présentatives ; la sync (outbox `profiles`) n'a AUCUN changement : la garde partagée `estProfilValide` est étendue, et l'asymétrie de merge (remote avec `prenom` vs local sans) se résout d'elle-même dès que `loadProfile` reconstruit le champ.

**Spec:** `docs/superpowers/specs/2026-09-18-refonte-ux-v14-design.md` (§ 3.2 onboarding sautable, § 3.3 vague 2 prénoms, § 7 impact technique vague 2)

**Tech Stack:** TypeScript strict, React 18 (hooks), vitest + Testing Library (happy-dom), Playwright (WebKit, 320/375), CSS sémantique tokenisé (`src/index.css`).

---

## Fichiers

| Fichier | Action | Responsabilité |
|---|---|---|
| `src/lib/model.ts` | modify | `UserProfile` v2.2 (`prenom?`, `dateNaissance?`, `taille?`), `PROFILS_META`, `prenomProfil` ; suppression `PRENOMS` |
| `src/lib/storage.ts` | modify | garde `estProfilValide` + reconstruction `loadProfile` champ par champ ; `saveProfile` trime `prenom` |
| `src/lib/promptIa.ts` | modify | ouverture : prénom édité, âge/taille omis si absents |
| `src/components/onboarding/Onboarding.tsx` | modify | étape 1 prénom éditable, CTA « Passer » (étapes 2-4), suppression doublon objectif (étape 4), `valider()` tolérant |
| `src/components/ProfilScreen.tsx` | modify | champ Prénom dans Mes infos, infos partielles (date/taille effaçables), confirm au prénom |
| `src/components/ProfileView.tsx` | modify | titre au prénom ; suppression `TITLES` |
| `src/App.tsx` | modify | salutation au prénom |
| `src/index.css` | modify | `.onb-skip` (CTA discret), `.onboarding-card.sel` |
| `README.md` | modify | onboarding sautable + prénom |
| `AGENTS.md` | modify | shape v2.2 + description onboarding |
| `CHANGELOG.md` | modify | section `[Non publié]` |
| `tests/storage.test.ts` | modify | describe « Profil v2.2 » |
| `tests/lib/model.test.ts` | create | `PROFILS_META` / `prenomProfil` |
| `tests/lib/promptIa.test.ts` | modify | ouverture profil partiel + prénom édité |
| `tests/onboarding.test.tsx` | modify | étape 1 prénom, Passer, doublon supprimé, shapes v2.2 |
| `tests/profil-screen.test.tsx` | modify | champ Prénom, infos partielles |
| `tests/app.test.tsx` | modify | salutation au prénom édité |
| `tests/components.test.tsx` | modify | titre ProfileView au prénom |
| `tests/e2e/onboarding-mobile.spec.ts` | modify | parcours « tout sauter » |

Décisions de design fixées par ce plan :

1. **Source unique des prénoms.** `PROFILS_META: Record<ProfileKey, { nom, emoji, tagline }>` dans `model.ts` remplace les 3 copies (PROFILS d'Onboarding, TITLES de ProfileView, PRENOMS de model.ts). `prenomProfil(id, profile?)` = prénom édité (trim) sinon `PROFILS_META[id].nom`. Les taglines sont unifiées sur la casse des titres actuels (« Diet & Sport », « Keto & Sport » — léger changement de casse sur les cartes d'onboarding).
2. **v2.2 = champs optionnels, garde non bloquante.** `dateNaissance`/`taille` deviennent optionnels (onboarding sautable) ; `estProfilValide` valide champ par champ (présent + illégal → lâché à la reconstruction, jamais invalidant) ; `loadProfile` reconstruit et lâche les valeurs illégales (date vide, taille ≤ 0, prenom non-string). Les profils v2.1 existants (date + taille toujours présentes) passent sans migration.
3. **Étape 1 : prénom éditable prérempli.** Cliquer une carte la sélectionne (état `sel`), fait apparaître le champ « C'est ton prénom ? » prérempli avec le nom par défaut, et ne progresse plus automatiquement — le bouton « Continuer » avance. Le prénom saisi est stocké dès l'onboarding (`prenom` du profil, seulement si non vide). En migration, l'étape 1 est sautée comme avant (prénom éditable dans Mes infos).
4. **« Passer » sur les étapes 2-4** (discret, dans la rangée de boutons). L'étape 5 n'en a pas : tout y est optionnel, « C'est parti ! » accomplit déjà le passage. L'étape 6 garde « Plus tard ». La validation du « Continuer » de l'étape 2 reste stricte ; seul l'enregistrement final (`valider()`) devient tolérant : champs présents = validés (bornes inchangées), champs absents = omis du profil.
5. **Libellés de l'autre personne inchangés en vague 2.** Les tags/portions « Marc »/« Mél » et l'encadré keto « Mélanie » désignent la personne qui n'utilise PAS l'app — son prénom n'est pas stocké localement (un seul profil par téléphone). Généralisation reportée à la vague 3 (profils libres).
6. **Hors scope :** `supabase/functions/push-notifier/index.ts` porte une 4e copie des prénoms (Deno, isolée, ids techniques dans les payloads push) — non modifiable par l'app front, notée pour la vague 3.

---

### Task 0: Branche

- [ ] **Step 1: Créer la branche depuis main**

```bash
git checkout main && git pull && git checkout -b feat/ux-v14-vague2-profil
```

---

### Task 1: Profil v2.2 — types, garde de forme, prompt IA

**Files:**
- Modify: `src/lib/model.ts:113-127` (UserProfile), `:158` (PRENOMS gardé en Task 1, supprimé en Task 2)
- Modify: `src/lib/storage.ts:171-181` (saveProfile), `:190-211` (estProfilValide), `:213-252` (loadProfile)
- Modify: `src/lib/promptIa.ts:45-50` (ouverture)
- Test: `tests/storage.test.ts`, `tests/lib/promptIa.test.ts`

- [ ] **Step 1: Écrire les tests (rouge)**

Dans `tests/storage.test.ts`, ajouter à la fin (adapter le placement aux describes existants du profil) :

```ts
describe('Profil v2.2 — prenom et champs optionnels', () => {
  const base = {
    objectif: { type: 'perte' as const },
    complements: [],
    regime: 'aucun' as const,
  };

  it('roundtrip : prenom trimé persisté et relu', () => {
    saveProfile({ id: 'marc', prenom: '  Jean  ', dateNaissance: '1985-04-12', taille: 178, ...base });
    expect(loadProfile()?.prenom).toBe('Jean');
  });

  it('prenom non-string : champ lâché, profil valide', () => {
    localStorage.setItem(
      'sportapp:profile',
      JSON.stringify({ id: 'marc', dateNaissance: '1985-04-12', taille: 178, prenom: 42, ...base }),
    );
    expect(loadProfile()?.prenom).toBeUndefined();
    expect(loadProfile()?.id).toBe('marc');
  });

  it('profil partiel (onboarding sauté) : sans date ni taille, loadProfile OK', () => {
    localStorage.setItem(
      'sportapp:profile',
      JSON.stringify({ id: 'melanie', prenom: 'Mel', ...base }),
    );
    const p = loadProfile();
    expect(p?.prenom).toBe('Mel');
    expect(p?.dateNaissance).toBeUndefined();
    expect(p?.taille).toBeUndefined();
  });

  it('champs illégaux lâchés sans invalider : date vide, taille <= 0, prenom espaces', () => {
    localStorage.setItem(
      'sportapp:profile',
      JSON.stringify({
        id: 'marc',
        prenom: '   ',
        dateNaissance: '',
        taille: 0,
        poidsObjectif: 'x',
        ...base,
      }),
    );
    const p = loadProfile();
    expect(p?.prenom).toBeUndefined();
    expect(p?.dateNaissance).toBeUndefined();
    expect(p?.taille).toBeUndefined();
    expect(p?.poidsObjectif).toBeUndefined();
  });

  it('saveProfile trime le prenom dans le payload sync', () => {
    saveProfile({ id: 'marc', prenom: '  Jean ', dateNaissance: '1985-04-12', taille: 178, ...base });
    const brut = JSON.parse(localStorage.getItem('sportapp:profile')!);
    expect(brut.prenom).toBe('Jean');
  });
});
```

(N.B. si un test existant de garde exigeait qu'un profil SANS `dateNaissance`/`taille` soit rejeté, son intention reste vraie pour les champs présents mais illégaux — adapter l'assertion : un profil sans date/taille est désormais valide.)

Dans `tests/lib/promptIa.test.ts`, ajouter dans le describe `assemblePromptIa` :

```ts
  it('profil partiel (onboarding sauté) : ouverture sans âge ni taille', () => {
    const texte = assemblePromptIa(
      { ...profilComplet, dateNaissance: undefined, taille: undefined },
      pesee,
    );
    expect(texte).toContain(
      'Tu es un nutritionniste. Marc (82,4 kg — dernière pesée du 14/09) te demande',
    );
  });

  it('profil partiel sans pesée : le prénom seul dans l ouverture', () => {
    const texte = assemblePromptIa(
      { ...profilComplet, dateNaissance: undefined, taille: undefined },
      null,
    );
    expect(texte).toContain('Tu es un nutritionniste. Marc te demande');
  });
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/storage.test.ts tests/lib/promptIa.test.ts`
Expected: FAIL (garde actuelle rejette le profil partiel ; l'ouverture appelle `ageDepuis(undefined)`)

- [ ] **Step 3: Types — `src/lib/model.ts`**

Remplacer `UserProfile` (lignes 113-127) :

```ts
export interface UserProfile {
  id: ProfileKey;
  prenom?: string; // v2.2 — prénom édité ; défaut = PROFILS_META[id].nom
  dateNaissance?: string; // v2.2 — optionnel (onboarding sautable) ; âge calculé si présent
  taille?: number; // v2.2 — optionnel (onboarding sautable)
  poidsObjectif?: number;
  objectif: Objectif;
  complements: string[];
  regime: Regime;
  // v2.1 — Maison & courses : tout optionnel, ignoré champ par champ si illégal (storage)
  magasin?: string; // nom libre, trim (ex. « Lidl »)
  budgetMax?: number; // € / semaine (plafond)
  preferences?: string[]; // types de plats souhaités (presets + libre) — pour le prompt IA
  personnes?: number; // personnes à table (entier ≥ 1)
  repasJour?: number; // repas par jour (entier ≥ 1)
}
```

- [ ] **Step 4: Garde + reconstruction — `src/lib/storage.ts`**

4a. `estProfilValide` (lignes 192-211) — champs v2.2 optionnels :

```ts
export const estProfilValide = (v: unknown): v is UserProfile => {
  const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
  const isStr = (x: unknown): x is string => typeof x === 'string';
  const optionalNum = (x: unknown): boolean => x === undefined || isNum(x);
  const optionalStr = (x: unknown): boolean => x === undefined || isStr(x);
  const obj = isPlainObject(v) ? v.objectif : undefined;
  const complements = isPlainObject(v) ? v.complements : undefined;
  return (
    isPlainObject(v) &&
    (v.id === 'marc' || v.id === 'melanie') &&
    optionalStr(v.dateNaissance) &&
    optionalNum(v.taille) &&
    optionalNum(v.poidsObjectif) &&
    optionalStr(v.prenom) &&
    isPlainObject(obj) &&
    OBJECTIF_TYPES_VALIDES.includes(obj.type as string) &&
    (obj.echeance === undefined || isStr(obj.echeance)) &&
    Array.isArray(complements) &&
    complements.every(isStr) &&
    REGIMES_VALIDES.includes(v.regime as string)
  );
};
```

4b. `loadProfile` — reconstruction (lignes 231-251), remplacer les deux premières lignes du littéral et ajouter `prenom` :

```ts
  return {
    id: p.id,
    ...(isStr(p.prenom) && p.prenom.trim() ? { prenom: p.prenom.trim() } : {}),
    ...(isStr(p.dateNaissance) && p.dateNaissance ? { dateNaissance: p.dateNaissance } : {}),
    ...(isNum(p.taille) && p.taille > 0 ? { taille: p.taille } : {}),
    ...(optionalNum(p.poidsObjectif) && p.poidsObjectif !== undefined
      ? { poidsObjectif: p.poidsObjectif }
      : {}),
    // … reste inchangé (objectif, complements, regime, maison)
```

4c. `saveProfile` (lignes 171-181) — trim de `prenom` :

```ts
  const net: UserProfile = {
    ...profile,
    ...(profile.prenom !== undefined ? { prenom: profile.prenom.trim() } : {}),
    ...(profile.magasin !== undefined ? { magasin: profile.magasin.trim() } : {}),
    ...(profile.preferences !== undefined
      ? { preferences: normaliseChampsLibres(profile.preferences) }
      : {}),
  };
```

- [ ] **Step 5: Ouverture prompt — `src/lib/promptIa.ts`**

Remplacer `ouverture` (lignes 45-50) — chaque info n'apparaît que si présente, ordre inchangé (prénom, âge, poids, taille) :

```ts
const ouverture = (p: UserProfile, dernierPoids: WeightEntry | null): string => {
  const qui = [
    PRENOMS[p.id],
    p.dateNaissance ? `${ageDepuis(p.dateNaissance)} ans` : '',
    dernierPoids
      ? `${formatKg(dernierPoids.kg)} kg — dernière pesée du ${formatDayMonth(dernierPoids.date)}`
      : '',
    p.taille != null ? `${p.taille} cm` : '',
  ]
    .filter(Boolean)
    .join(', ');
  return `Tu es un nutritionniste. ${qui} te demande de lui réaliser une rotation de menus sur 4 semaines pour installer une routine durable. Objectif : ${objectifPhrase(p)}.`;
};
```

(Le passage à `prenomProfil` se fait en Task 2 — `PRENOMS` reste importé ici jusqu'alors.)

- [ ] **Step 6: Vérifier le vert (tous les tests existants restent verts)**

Run: `npx vitest run tests/storage.test.ts tests/lib/promptIa.test.ts tests/onboarding.test.tsx tests/lib/promptIa.test.ts && npm run typecheck`
Expected: PASS (les fixtures existantes ont toujours date + taille → comportement inchangé ; typecheck vert car Onboarding/ProfilScreen assignent des valeurs aux champs devenus optionnels sans erreur)

- [ ] **Step 7: Commit**

```bash
git add tests/storage.test.ts tests/lib/promptIa.test.ts src/lib/model.ts src/lib/storage.ts src/lib/promptIa.ts
git commit -m "feat: profil v2.2 — prenom, date et taille optionnels (storage + prompt IA)"
```

---

### Task 2: Source unique des prénoms (PROFILS_META + prenomProfil)

**Files:**
- Modify: `src/lib/model.ts:158`
- Modify: `src/App.tsx:12,188`
- Modify: `src/components/ProfilScreen.tsx:2,273`
- Modify: `src/lib/promptIa.ts:3,47-48`
- Modify: `src/components/ProfileView.tsx:11-14,66`
- Modify: `src/components/onboarding/Onboarding.tsx:20-23,65,283-296,315,322` (cartes uniquement — le prénom éditable arrive en Task 3)
- Test: `tests/lib/model.test.ts` (create), `tests/app.test.tsx`, `tests/components.test.tsx`

- [ ] **Step 1: Écrire les tests (rouge)**

Créer `tests/lib/model.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { PROFILS_META, prenomProfil } from '../../src/lib/model';
import type { UserProfile } from '../../src/lib/model';

const base: UserProfile = {
  id: 'marc',
  dateNaissance: '1985-04-12',
  taille: 178,
  objectif: { type: 'perte' },
  complements: [],
  regime: 'aucun',
};

describe('PROFILS_META / prenomProfil', () => {
  it('défaut : nom de la méta', () => {
    expect(prenomProfil('marc')).toBe('Marc');
    expect(prenomProfil('melanie')).toBe('Mélanie');
    expect(PROFILS_META.marc.tagline).toBe('Diet & Sport');
    expect(PROFILS_META.melanie.tagline).toBe('Keto & Sport');
  });

  it('prénom édité prioritaire (trim)', () => {
    expect(prenomProfil('marc', { ...base, prenom: '  Jean ' })).toBe('Jean');
    expect(prenomProfil('melanie', { ...base, id: 'melanie', prenom: 'Mel' })).toBe('Mel');
  });

  it('prénom vide ou espaces → défaut', () => {
    expect(prenomProfil('marc', { ...base, prenom: '   ' })).toBe('Marc');
    expect(prenomProfil('marc', { ...base, prenom: '' })).toBe('Marc');
  });
});
```

Dans `tests/app.test.tsx`, dupliquer le test de salutation existant avec un profil portant `prenom: 'Jean'` → `Salut Jean 👋` (s'inspirer du setup du test existant : même injection `sportapp:profile` en localStorage). Dans `tests/components.test.tsx`, dans le describe de ProfileView, ajouter : rendu avec `{ ...profilFixture, prenom: 'Jean' }` → `screen.getByText('Jean — Diet & Sport')`.

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/lib/model.test.ts tests/app.test.tsx tests/components.test.tsx`
Expected: FAIL (`PROFILS_META`/`prenomProfil` n'existent pas ; salutation/titre restent aux noms techniques)

- [ ] **Step 3: Implémentation — `src/lib/model.ts`**

Remplacer la ligne `PRENOMS` (158) par :

```ts
// Source unique des métadonnées d'affichage des profils (cartes d'onboarding,
// titres, salutations) — fusion des anciennes PROFILS/TITLES/PRENOMS.
export const PROFILS_META: Record<ProfileKey, { nom: string; emoji: string; tagline: string }> = {
  marc: { nom: 'Marc', emoji: '💪', tagline: 'Diet & Sport' },
  melanie: { nom: 'Mélanie', emoji: '🌿', tagline: 'Keto & Sport' },
};

// Prénom affiché : le prénom édité (profil v2.2) sinon le nom par défaut.
export const prenomProfil = (id: ProfileKey, p?: UserProfile): string =>
  p?.prenom?.trim() || PROFILS_META[id].nom;
```

- [ ] **Step 4: Consommateurs**

4a. `src/App.tsx` — import `prenomProfil` (remplace `PRENOMS`), ligne 188 :

```tsx
            <p className="greeting">Salut {prenomProfil(profile.id, profile)} 👋</p>
```

4b. `src/components/ProfilScreen.tsx` — import, ligne 273 :

```ts
        `Changer de profil ? ${prenomProfil(profile.id, profile)} restera sur ce téléphone avec ses données.`,
```

4c. `src/lib/promptIa.ts` — import `prenomProfil` (remplace `PRENOMS`), `ouverture` : premier élément du tableau `qui` devient `prenomProfil(p.id, p)`.

4d. `src/components/ProfileView.tsx` — supprimer `TITLES` (lignes 11-14), importer `PROFILS_META`/`prenomProfil`, ligne 66 :

```tsx
      <h2 className="profile-title">
        {prenomProfil(profile.id, profile)} — {PROFILS_META[profile.id].tagline}
      </h2>
```

4e. `src/components/onboarding/Onboarding.tsx` — supprimer la const locale `PROFILS` (lignes 20-23), importer `PROFILS_META`. Cartes (lignes 283-296) :

```tsx
            {(Object.keys(PROFILS_META) as ProfileKey[]).map((pid) => {
              const meta = PROFILS_META[pid];
              return (
                <button
                  key={pid}
                  type="button"
                  className={`onboarding-card onboarding-card-${pid}`}
                  onClick={() => choisir(pid)}
                >
                  <span className="onboarding-card-emoji" aria-hidden="true">
                    {meta.emoji}
                  </span>
                  <span className="onboarding-card-prenom">{meta.nom}</span>
                  <span className="onboarding-card-tagline">{meta.tagline}</span>
                </button>
              );
            })}
```

Et remplacer `profil?.prenom` aux lignes 315 et 322 par `id ? PROFILS_META[id].nom : ''` (le prénom édité prendra le relais en Task 3). La variable `profil` (ligne 65) devient inutile — la supprimer.

- [ ] **Step 5: Vérifier le vert (aucun import de PRENOMS restant)**

Run: `grep -rn "PRENOMS" src/ | grep -v push` puis `npx vitest run && npm run typecheck`
Expected: grep vide dans `src/` hors `supabase/` (la copie Deno de push-notifier reste, hors scope) ; tous les tests PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/lib/model.test.ts tests/app.test.tsx tests/components.test.tsx src/lib/model.ts src/App.tsx src/components/ProfilScreen.tsx src/lib/promptIa.ts src/components/ProfileView.tsx src/components/onboarding/Onboarding.tsx
git commit -m "feat: source unique des prénoms (PROFILS_META + prenomProfil)"
```

---

### Task 3: Onboarding étape 1 — « C'est ton prénom ? »

**Files:**
- Modify: `src/components/onboarding/Onboarding.tsx` (state, `choisir`, JSX étape 1, h1 étape 2, `valider`)
- Modify: `src/index.css` (section onboarding — `.onboarding-card.sel`)
- Test: `tests/onboarding.test.tsx`

- [ ] **Step 1: Mettre à jour les tests (rouge)**

Dans `tests/onboarding.test.tsx` :

1a. Mettre à jour le helper `allerEtape2` (un clic carte ne progresse plus — il faut « Continuer ») :

```ts
const allerEtape2 = async () => {
  const user = userEvent.setup();
  render(<Onboarding onDone={onDone} />);
  await user.click(screen.getByRole('button', { name: /Mélanie/ }));
  await user.click(screen.getByRole('button', { name: /Continuer/ }));
  return user;
};
```

1b. Dans le describe « étape 1 », remplacer le test « le choix du profil passe à l'étape 2 » par :

```ts
  it('choisir une carte la sélectionne, préremplit le prénom et affiche Continuer', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} />);

    await user.click(screen.getByRole('button', { name: /Mélanie/ }));
    const carte = screen.getByRole('button', { name: /Mélanie/ });
    expect(carte).toHaveClass('sel');
    expect(screen.getByLabelText('C'est ton prénom ?')).toHaveValue('Mélanie');

    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    expect(screen.getByRole('heading', { name: /Salut Mélanie/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Retour/ }));
    expect(screen.getByRole('button', { name: /Mélanie/ })).toHaveClass('sel');
  });
```

1c. Ajouter en fin de describe « étape 1 » :

```ts
  it('le prénom édité est utilisé dans la salutation puis enregistré', async () => {
    const user = await allerEtape2AvecPrenom('Mel');
    expect(screen.getByRole('heading', { name: /Salut Mel/ })).toBeInTheDocument();
    // … compléter étapes 2-5 comme dans le test exact-shape (helper) puis :
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ prenom: 'Mel' })));
  });

  it('prénom vidé : salutation et profil retombent sur le défaut', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={onDone} />);
    await user.click(screen.getByRole('button', { name: /Mélanie/ }));
    await user.clear(screen.getByLabelText('C'est ton prénom ?'));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    expect(screen.getByRole('heading', { name: /Salut Mélanie/ })).toBeInTheDocument();
  });

  it('changer de carte réinitialise le prénom au défaut de la nouvelle carte', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} />);
    await user.click(screen.getByRole('button', { name: /Mélanie/ }));
    await user.clear(screen.getByLabelText('C'est ton prénom ?'));
    await user.type(screen.getByLabelText('C'est ton prénom ?'), 'X');
    await user.click(screen.getByRole('button', { name: /Marc/ }));
    expect(screen.getByLabelText('C'est ton prénom ?')).toHaveValue('Marc');
  });
```

(Créer au besoin un helper `allerEtape2AvecPrenom(prenom)` qui suit le chemin complet jusqu'à l'étape 5 — s'inspirer de `allerEtape5`.)

1d. Les deux tests exact-shape de l'étape 5 (lignes ~292 et ~313) gagnent `prenom: 'Mélanie',` (le champ est prérempli). Le test de migration (ligne ~377) reste SANS `prenom` (étape 1 sautée).

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/onboarding.test.tsx`
Expected: FAIL (le clic carte avance directement, pas de champ prénom, `sel` absent)

- [ ] **Step 3: Implémentation — `src/components/onboarding/Onboarding.tsx`**

3a. State (après `const [id, setId] …`, ligne 36) :

```ts
  const [prenom, setPrenom] = useState('');
```

3b. `choisir` (lignes 72-75) — sélection sans progression, prénom prérempli :

```ts
  const choisir = (p: ProfileKey) => {
    setError(null);
    setId(p);
    setPrenom(PROFILS_META[p].nom);
  };
```

3c. Étape 1 (lignes 278-299) — cartes avec état `sel`, champ prénom, Continuer :

```tsx
      {step === 1 && (
        <>
          <h1>Qui est derrière l'écran ?</h1>
          <p className="onboarding-sub">Choisis ton profil, on s'occupe du reste.</p>
          <div className="onboarding-cards">
            {(Object.keys(PROFILS_META) as ProfileKey[]).map((pid) => {
              const meta = PROFILS_META[pid];
              return (
                <button
                  key={pid}
                  type="button"
                  className={`onboarding-card onboarding-card-${pid}${id === pid ? ' sel' : ''}`}
                  onClick={() => choisir(pid)}
                >
                  <span className="onboarding-card-emoji" aria-hidden="true">
                    {meta.emoji}
                  </span>
                  <span className="onboarding-card-prenom">{meta.nom}</span>
                  <span className="onboarding-card-tagline">{meta.tagline}</span>
                </button>
              );
            })}
          </div>
          {id && (
            <>
              <div className="onboarding-field">
                <label htmlFor="ob-prenom">C'est ton prénom ?</label>
                <input
                  id="ob-prenom"
                  type="text"
                  maxLength={20}
                  value={prenom}
                  onChange={(e) => {
                    setError(null);
                    setPrenom(e.target.value);
                  }}
                />
                <p className="onb-hint">Utilisé pour te saluer — modifiable plus tard dans le profil.</p>
              </div>
              <div className="onb-btnrow">
                <button type="button" className="onb-next" onClick={() => aller(2)}>
                  Continuer <Icon name="chev-right" size={14} />
                </button>
              </div>
            </>
          )}
        </>
      )}
```

3d. Salutations à l'étape 2 (lignes 315 et 322) — prénom édité sinon défaut :

```tsx
              <h1>Salut {id ? prenom.trim() || PROFILS_META[id].nom : ''} 👋</h1>
```

et pour le bloc migration : `Profil : {id ? prenom.trim() || PROFILS_META[id].nom : ''} {PROFILS_META[id]?.emoji}` (attention : `id` est non-null dans ce bloc — TS le sait via le garde `step >= 2 && id`).

3e. `valider()` — propager le prénom (le profil partiel arrive en Task 5, ne pas toucher aux infos ici) :

```ts
    const profile: UserProfile = {
      id,
      dateNaissance,
      taille: infos.cm,
      ...(prenom.trim() ? { prenom: prenom.trim() } : {}),
      ...(obj != null ? { poidsObjectif: obj } : {}),
      // … reste inchangé
```

- [ ] **Step 4: CSS — `src/index.css`**

Dans la section onboarding, après le bloc `.onboarding-card { … }`, ajouter :

```css
.onboarding-card.sel {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
}
```

- [ ] **Step 5: Vérifier le vert**

Run: `npx vitest run tests/onboarding.test.tsx && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tests/onboarding.test.tsx src/components/onboarding/Onboarding.tsx src/index.css
git commit -m "feat: onboarding — prénom éditable à l'étape 1 (« C'est ton prénom ? »)"
```

---

### Task 4: Suppression du doublon d'objectif (étape 4)

**Files:**
- Modify: `src/components/onboarding/Onboarding.tsx:547-579`
- Test: `tests/onboarding.test.tsx`

- [ ] **Step 1: Écrire les tests (rouge)**

Dans `tests/onboarding.test.tsx`, describe « étape 4 (compléments et régime) » — renommer le describe en « étape 4 (compléments, régime — sans doublon d'objectif) » et ajouter :

```ts
  it('ne propose plus le doublon d objectif (ni type ni poids objectif)', async () => {
    await allerEtape4();

    expect(screen.queryByRole('radio', { name: /Perte de poids/ })).toBeNull();
    expect(screen.queryByLabelText('Poids objectif (kg)')).toBeNull();
    expect(screen.getByRole('radio', { name: /Aucun régime/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Whey' })).toBeInTheDocument();
  });

  it('l objectif choisi à l étape 3 survit au passage à l étape 4', async () => {
    const user = await allerEtape3();
    await user.click(screen.getByRole('radio', { name: /Prise de masse/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    // L'étape 4 n'affiche plus d'objectif mais l'état est conservé pour l'enregistrement.
    soumettre();
    expect(screen.getByRole('heading', { name: /Maison & courses/ })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/onboarding.test.tsx -t "doublon"`
Expected: FAIL (le radio « Perte de poids » existe encore à l'étape 4)

- [ ] **Step 3: Implémentation**

Supprimer dans le bloc `{step === 4 && …}` (lignes 547-579) : le `<p className="onb-label">Objectif</p>`, la `<div className="rline" role="radiogroup" aria-label="Type d'objectif">…</div>` et la `<div className="onboarding-field">Poids objectif…</div>`. Ne rien changer d'autre (compléments, régime, boutons).

- [ ] **Step 4: Vérifier le vert**

Run: `npx vitest run tests/onboarding.test.tsx && npm run typecheck`
Expected: PASS (y compris « Entrée à l'étape 4 avance à l'étape 5 » — inchangé)

- [ ] **Step 5: Commit**

```bash
git add tests/onboarding.test.tsx src/components/onboarding/Onboarding.tsx
git commit -m "fix: onboarding — suppression du doublon d'objectif à l'étape 4"
```

---

### Task 5: CTA « Passer » + enregistrement tolérant (profil partiel)

**Files:**
- Modify: `src/components/onboarding/Onboarding.tsx` (btnrows étapes 2-4, `valider`)
- Modify: `src/index.css` (`.onb-skip`)
- Test: `tests/onboarding.test.tsx`

- [ ] **Step 1: Écrire les tests (rouge)**

Dans `tests/onboarding.test.tsx`, nouveau describe :

```ts
describe('Onboarding — CTA « Passer » (tout sautable sauf l étape 1)', () => {
  it('l étape 2 peut être passée : on arrive à l objectif sans rien remplir', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} />);
    await user.click(screen.getByRole('button', { name: /Mélanie/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));

    expect(screen.getByRole('heading', { name: /Ton objectif/ })).toBeInTheDocument();
  });

  it('les étapes 3 et 4 peuvent être passées', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={onDone} />);
    await user.click(screen.getByRole('button', { name: /Mélanie/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));

    expect(screen.getByRole('heading', { name: /Maison & courses/ })).toBeInTheDocument();
  });

  it('parcours tout sauté : profil minimal sans date ni taille ni poids', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={onDone} />);
    await user.click(screen.getByRole('button', { name: /Mélanie/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    soumettre();

    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith({
        id: 'melanie',
        prenom: 'Mélanie',
        objectif: { type: 'perte' },
        complements: [],
        regime: 'aucun',
      } satisfies UserProfile),
    );
    expect(getWeights('melanie')).toEqual([]);
  });

  it('champs présents = validés même en parcours sauté (poids saisi puis Passer)', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} />);
    await user.click(screen.getByRole('button', { name: /Mélanie/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    await user.type(screen.getByLabelText('Poids (kg)'), '500');
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    soumettre();

    expect(screen.getByRole('alert')).toHaveTextContent(/Poids invalide/i);
    expect(loadProfile()).toBeNull();
  });

  it('date seule : profil avec date, sans taille, sans pesée', async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={onDone} />);
    await user.click(screen.getByRole('button', { name: /Mélanie/ }));
    await user.click(screen.getByRole('button', { name: /Continuer/ }));
    saisirDate('Date de naissance', '1987-03-02');
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    soumettre();

    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({ dateNaissance: '1987-03-02' }),
      ),
    );
    expect(onDone.mock.calls[0][0]).not.toHaveProperty('taille');
    expect(getWeights('melanie')).toEqual([]);
  });
});
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/onboarding.test.tsx -t "Passer"`
Expected: FAIL (pas de bouton « Passer » ; le parcours complet échoue sur « Formulaire incomplet »)

- [ ] **Step 3: Implémentation — `src/components/onboarding/Onboarding.tsx`**

3a. Rangées de boutons des étapes 2, 3 et 4 — insérer « Passer » entre Retour et Continuer :

```tsx
                <button type="button" className="onb-skip" onClick={() => aller(step + 1)}>
                  Passer
                </button>
```

3b. `valider()` (lignes 201-237) — remplace la validation stricte des infos par une validation tolérante (présent = validé, absent = omis). `validerInfos()` reste inchangée (elle sert au « Continuer » de l'étape 2) :

```ts
  // Enregistrement final tolérant : chaque champ présent est validé (mêmes
  // bornes que les « Continuer »), chaque champ absent est simplement omis —
  // l'onboarding est tout sautable, le profil peut rester partiel.
  const valider = () => {
    const cm = taille ? Number.parseInt(taille, 10) : undefined;
    if (taille && (cm === undefined || cm < 120 || cm > 230)) {
      setError('Taille invalide : entre 120 et 230 cm.');
      return;
    }
    if (dateNaissance) {
      if (dateNaissance > todayISO()) {
        setError('La date de naissance ne peut pas être dans le futur.');
        return;
      }
      const ans = ageDepuis(dateNaissance);
      if (ans < 10 || ans > 100) {
        setError('Âge calculé invalide : entre 10 et 100 ans.');
        return;
      }
    }
    const kg = poids ? Number.parseFloat(poids.replace(',', '.')) : undefined;
    if (poids && (kg === undefined || kg < 30 || kg > 250)) {
      setError('Poids invalide : entre 30 et 250 kg.');
      return;
    }
    const obj = poidsObjectif ? Number.parseFloat(poidsObjectif.replace(',', '.')) : undefined;
    if (poidsObjectif && (obj === undefined || obj < 30 || obj > 250)) {
      setError('Poids objectif invalide : entre 30 et 250 kg.');
      return;
    }
    if (!validerMaison()) return;
    if (!id) return;
    const pers = personnes ? Number.parseInt(personnes, 10) : undefined;
    const repas = repasJour ? Number.parseInt(repasJour, 10) : undefined;
    const profile: UserProfile = {
      id,
      ...(dateNaissance ? { dateNaissance } : {}),
      ...(cm != null ? { taille: cm } : {}),
      ...(prenom.trim() ? { prenom: prenom.trim() } : {}),
      ...(obj != null ? { poidsObjectif: obj } : {}),
      objectif: { type: objectifType, ...(echeance ? { echeance } : {}) },
      complements: [...complements],
      regime,
      ...(magasin.trim() ? { magasin: magasin.trim() } : {}),
      ...(budgetMax ? { budgetMax: parseEuro(budgetMax)! } : {}),
      ...(preferences.length > 0 ? { preferences: [...preferences] } : {}),
      ...(pers != null ? { personnes: pers } : {}),
      ...(repas != null ? { repasJour: repas } : {}),
    };
    saveProfile(profile);
    if (kg != null) addWeight(id, todayISO(), kg);
    if (syncActif() && !lireSession()) {
      setProfileFinal(profile);
      aller(6);
      return;
    }
    onDone(profile);
  };
```

- [ ] **Step 4: CSS — `src/index.css`**

Dans la section onboarding, après `.onb-next { … }`, ajouter :

```css
.onb-skip {
  min-height: 44px;
  margin-left: auto;
  padding: 0 var(--sp-12);
  border: none;
  background: none;
  color: var(--muted);
  font: 600 var(--fs-sec) Poppins, sans-serif;
}
```

(Vérifier au rendu : « Passer » discret mais lisible, cible ≥ 44 px, « Continuer » conserve sa place à droite — ajuster `margin-left: auto` si `.onb-next` en a déjà un.)

- [ ] **Step 5: Vérifier le vert**

Run: `npx vitest run tests/onboarding.test.tsx && npm run typecheck`
Expected: PASS (y compris migration : elle passe par Passer aussi — le poids prérempli est conservé dans l'état et enregistré)

- [ ] **Step 6: Commit**

```bash
git add tests/onboarding.test.tsx src/components/onboarding/Onboarding.tsx src/index.css
git commit -m "feat: onboarding — CTA « Passer » et enregistrement d'un profil partiel"
```

---

### Task 6: ProfilScreen — prénom dans Mes infos + infos partielles

**Files:**
- Modify: `src/components/ProfilScreen.tsx` (state, `enregistrerInfos`, JSX Mes infos)
- Test: `tests/profil-screen.test.tsx`

- [ ] **Step 1: Écrire les tests (rouge)**

Dans `tests/profil-screen.test.tsx` (s'inspirer du setup existant : profil injecté en localStorage + rendu) :

```ts
  it('Mes infos : champ Prénom prérempli, édité puis enregistré', async () => {
    // rendu avec le profil fixture
    expect(screen.getByLabelText('Prénom')).toHaveValue('Marc');
    await user.clear(screen.getByLabelText('Prénom'));
    await user.type(screen.getByLabelText('Prénom'), 'Jean');
    await user.click(screen.getByRole('button', { name: /Enregistrer mes infos/ }));
    expect(loadProfile()?.prenom).toBe('Jean');
  });

  it('prénom vidé : le profil ne porte plus de prenom (défaut à l affichage)', async () => {
    await user.clear(screen.getByLabelText('Prénom'));
    await user.click(screen.getByRole('button', { name: /Enregistrer mes infos/ }));
    expect(loadProfile()?.prenom).toBeUndefined();
  });

  it('profil partiel (sans date ni taille) : Mes infos s affiche, le prénom s enregistre seul', async () => {
    // injecter un profil v2.2 partiel { id: 'marc', prenom: '', objectif, complements, regime }
    expect(screen.getByLabelText('Prénom')).toBeInTheDocument();
    expect(screen.getByLabelText('Date de naissance')).toHaveValue('');
    await user.type(screen.getByLabelText('Prénom'), 'Jean');
    await user.click(screen.getByRole('button', { name: /Enregistrer mes infos/ }));
    const p = loadProfile();
    expect(p?.prenom).toBe('Jean');
    expect(p?.dateNaissance).toBeUndefined();
    expect(p?.taille).toBeUndefined();
  });

  it('date et taille effacées : le profil partiel est enregistré sans erreur', async () => {
    // profil complet injecté ; vider les deux champs puis enregistrer
    await user.clear(screen.getByLabelText('Date de naissance'));
    await user.clear(screen.getByLabelText('Taille (cm)'));
    await user.click(screen.getByRole('button', { name: /Enregistrer mes infos/ }));
    expect(loadProfile()?.dateNaissance).toBeUndefined();
    expect(loadProfile()?.taille).toBeUndefined();
  });

  it('date sans taille : erreur paire (formulaire incomplet)', async () => {
    await user.clear(screen.getByLabelText('Taille (cm)'));
    await user.click(screen.getByRole('button', { name: /Enregistrer mes infos/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(/incomplet/i);
  });
```

- [ ] **Step 2: Vérifier le rouge**

Run: `npx vitest run tests/profil-screen.test.tsx`
Expected: FAIL (pas de champ Prénom ; le profil partiel fait planter `String(undefined)`/`ageDepuis(undefined)`)

- [ ] **Step 3: Implémentation — `src/components/ProfilScreen.tsx`**

3a. États (lignes 53-54) — préfill tolérant + prénom :

```ts
  const [prenom, setPrenom] = useState(profile.prenom ?? '');
  const [dateNaissance, setDateNaissance] = useState(profile.dateNaissance ?? '');
  const [taille, setTaille] = useState(profile.taille != null ? String(profile.taille) : '');
```

3b. `enregistrerInfos` (lignes 151-172) — la paire date/taille est validée ensemble si l'un des deux est rempli, sinon omise ; le prénom part avec les infos :

```ts
  const enregistrerInfos = () => {
    const cm = taille ? Number.parseInt(taille, 10) : undefined;
    if ((dateNaissance || taille) && (!dateNaissance || cm === undefined)) {
      setErreur({ section: 'infos', texte: 'Formulaire incomplet : remplis ta date de naissance et ta taille.' });
      return;
    }
    if (dateNaissance) {
      if (dateNaissance > todayISO()) {
        setErreur({ section: 'infos', texte: 'La date de naissance ne peut pas être dans le futur.' });
        return;
      }
      const ans = ageDepuis(dateNaissance);
      if (ans < 10 || ans > 100) {
        setErreur({ section: 'infos', texte: 'Âge calculé invalide : entre 10 et 100 ans.' });
        return;
      }
    }
    if (cm != null && (cm < 120 || cm > 230)) {
      setErreur({ section: 'infos', texte: 'Taille invalide : entre 120 et 230 cm.' });
      return;
    }
    clearErreur('infos');
    const updated: UserProfile = {
      ...profile,
      ...(prenom.trim() ? { prenom: prenom.trim() } : {}),
    };
    delete updated.dateNaissance;
    delete updated.taille;
    if (dateNaissance) updated.dateNaissance = dateNaissance;
    if (cm != null) updated.taille = cm;
    maj('infos', updated);
  };
```

3c. JSX Mes infos — le champ Prénom en premier (avant la date) :

```tsx
        <div className="onboarding-field">
          <label htmlFor="pf-prenom">Prénom</label>
          <input
            id="pf-prenom"
            type="text"
            maxLength={20}
            value={prenom}
            onChange={(e) => {
              setSavedSection(null);
              clearErreur('infos');
              setPrenom(e.target.value);
            }}
          />
          <p className="onb-hint">Utilisé dans les salutations et le prompt IA.</p>
        </div>
```

- [ ] **Step 4: Vérifier le vert**

Run: `npx vitest run tests/profil-screen.test.tsx && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/profil-screen.test.tsx src/components/ProfilScreen.tsx
git commit -m "feat: profil — prénom éditable dans Mes infos, infos partielles acceptées"
```

---

### Task 7: Docs, e2e, portes et Pull Request

**Files:**
- Modify: `README.md`, `AGENTS.md`, `CHANGELOG.md`
- Modify: `tests/e2e/onboarding-mobile.spec.ts`
- Test: `npm test`, `npm run e2e`, `npm run e2e:preview`

- [ ] **Step 1: `AGENTS.md`**

1a. Ligne « UX personnalisée » : mentionner l'onboarding tout sautable (seule l'étape 1 — profil/prénom — est obligatoire, CTA « Passer » sur les suivantes) et le prénom éditable à l'étape 1 puis dans Mes infos.

1b. Ligne `sportapp:profile` — passer la shape en **v2.2** :

```markdown
- `sportapp:profile` — profil actif, **shape v2.2** : `{ id: 'marc'|'melanie', prenom?, dateNaissance?, taille?, poidsObjectif?, objectif: { type: 'perte'|'affiner'|'masse'|'maintien', echeance? }, complements: string[], regime, magasin?, budgetMax?, preferences?: string[], personnes?, repasJour? }` — v2.2 : `prenom` édité (défaut = `PROFILS_META[id].nom`, source unique des prénoms) ; `dateNaissance` et `taille` optionnelles (onboarding sautable — sections silencieuses quand absentes). L'ancienne forme `{ id, age, taille }` est lue par `loadProfilLegacy()` (read-only) pour préremplir l'onboarding de migration, puis écrasée au save
```

- [ ] **Step 2: `README.md`**

Mettre à jour le paragraphe onboarding : 5 étapes dont seule la première (profil + prénom « C'est ton prénom ? ») est obligatoire, « Passer » discret sur les suivantes, doublon d'objectif supprimé de l'étape 4, prénom modifiable dans Mes infos (salutations, titre du suivi et prompt IA l'utilisent).

- [ ] **Step 3: `CHANGELOG.md`**

Dans la section `## [Non publié]` existante, ajouter une sous-section `### Modifié` :

```markdown
### Modifié

- Onboarding tout sautable : chaque étape porte un CTA discret « Passer » (seul le choix du profil reste obligatoire) et le doublon d'objectif disparaît de l'étape 4. Le prénom s'édite à l'étape 1 (« C'est ton prénom ? ») puis dans Mes infos — salutations, titre du suivi et prompt IA l'utilisent. Profil v2.2 : date de naissance et taille deviennent optionnelles (sections silencieuses quand absentes) ; aucune donnée n'est réinitialisée.
```

- [ ] **Step 4: e2e (rouge → vert)**

Dans `tests/e2e/onboarding-mobile.spec.ts` (lire d'abord le fichier pour suivre ses conventions — setup localStorage, sélecteurs) : ajouter un parcours « tout sauter » — premier lancement → carte → Continuer → Passer ×3 → « C'est parti ! » → l'app s'affiche sans crash (salutation visible, zéro débordement horizontal 320/375). Vérifier que les parcours existants restent verts (l'étape 1 exige maintenant un clic « Continuer » après la carte).

- [ ] **Step 5: Portes finales**

```bash
npm test && npm run typecheck && npm run lint && npm run build
```
Expected: tout PASS.

- [ ] **Step 6: e2e sur le build de prod (même mode que le workflow Deploy)**

```bash
npm run e2e:preview
```
Expected: PASS (zéro débordement sur 320/375, y compris le nouveau parcours sauté).

- [ ] **Step 7: Push et Pull Request**

```bash
git push -u origin feat/ux-v14-vague2-profil
gh pr create --title "feat: UX v1.4 vague 2 — volet Personnalisation (onboarding sautable, prénoms)" --body "Implémente le volet profil de la vague 2 v1.4 (spec docs/superpowers/specs/2026-09-18-refonte-ux-v14-design.md § 3.2-3.3) : onboarding tout sautable (Passer, étape 4 sans doublon d'objectif), prénom éditable (étape 1 + Mes infos), source unique des prénoms (PROFILS_META + prenomProfil), profil v2.2 (prenom/date/taille optionnels, migration douce)."
```

Attendre la CI PR (`.github/workflows/ci.yml`) verte avant le merge — ne jamais merger un état qui ne build pas.

---

## Auto-revue (exécutée à l'écriture du plan)

1. **Couverture spec (§ 3.2, § 3.3, § 7)** :
   - 3.2 tout sautable → Tasks 5 (Passer 2-4 + valider tolérant), 1 (champs optionnels) ; étape 1 obligatoire → Task 3 ; doublon étape 4 → Task 4 ; prénom à l'étape 1 → Task 3.
   - 3.3 prénoms éditables + fusion des 3 sources + libellés au prénom → Tasks 2, 3, 6 ; tags/portions de l'autre personne explicitement reportés (décision 5 — le profil de l'autre n'est pas stocké localement).
   - 7 impact storage/sync vague 2 → Task 1 (garde partagée étendue, reconstruction, saveProfile trim ; outbox et engine sans changement — l'asymétrie de merge se résout dès que loadProfile reconstruit `prenom`).
2. **Aucune donnée perdue** : les profils v2.1 (date + taille présentes) passent la nouvelle garde sans migration ; l'ancienne clé legacy n'est pas touchée ; les ids de coches et le contrat .md ne changent pas (aucun fichier parse/sample/template modifié).
3. **Cohérence des types** : `prenom?: string`, `dateNaissance?: string`, `taille?: number` (UserProfile) ; `PROFILS_META: Record<ProfileKey, { nom, emoji, tagline }>` ; `prenomProfil(id, profile?)` — mêmes noms dans les Tasks 1-6. Les exact-shapes d'onboarding passent à `satisfies UserProfile` avec les champs optionnels (Task 3 Step 1d).
4. **UX/accessibilité** : `.onb-skip` min-height 44 px + contraste du token `--muted` (déjà utilisé par les hints) ; cartes sélectionnées visibles (`.sel`) ; « Passer » reste un vrai `<button>` au clavier.
5. **PWA/offline** : aucune dépendance nouvelle, aucun changement de manifest/sw.
