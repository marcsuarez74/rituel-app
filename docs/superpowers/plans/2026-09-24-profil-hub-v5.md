# Profil hub v5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre `ProfilScreen` (11 sections empilées, 835 lignes) en hub « canvas crème » : en-tête compte + 4 tuiles cards + actions directes, chaque tuile ouvrant une page détail dédiée + page Foyer.

**Architecture:** Dossier `src/components/profil/` (miroir de `cuisine/`) avec une page par composant ; `ProfilScreen` devient le hub mince qui pilote la navigation interne (`useState<Vue>`). Les résumés d'état des tuiles sont purs dans `src/lib/resumes.ts` (testables sans React). Aucune migration storage/sync — le code métier est déplacé, pas réécrit.

**Tech Stack:** React 18 hooks, TypeScript strict, CSS sémantique tokenisé (`src/index.css`, un seul fichier), vitest + Testing Library (happy-dom), Playwright (mobile 320/375).

**Spéc:** `docs/superpowers/specs/2026-09-24-profil-hub-v5-design.md` · **Maquette:** `docs/superpowers/mockups/v14/profil-prototype-v5.html` (variante « Tuiles »)

**État de départ:** branche `feat/profil-hub-v5` créée, spec committée (`ec2fee7`). Avant tout commit : `npm test && npm run typecheck && npm run lint && npm run build` doit passer.

---

## Fichiers

| Action | Fichier | Responsabilité |
|---|---|---|
| Create | `src/lib/resumes.ts` | Résumés purs des tuiles (duo, objectif, infos, maison, notifs) |
| Create | `tests/resumes.test.ts` | Tests miroir de `src/lib/resumes.ts` |
| Modify | `src/components/Icon.tsx` | + 5 icônes SVG (`info`, `home`, `bell`, `copy`, `refresh`) |
| Create | `src/components/profil/presente.tsx` | `Fil` + `Alerte`, présentaion partagée des pages |
| Create | `src/components/profil/ProfilInfos.tsx` | Page détail Mes infos (prénom, naissance, taille) |
| Create | `src/components/profil/ProfilObjectif.tsx` | Page détail Objectif (type, poids, échéance, régime, compléments) |
| Create | `src/components/profil/ProfilMaison.tsx` | Page détail Maison & courses |
| Create | `src/components/profil/ProfilFoyer.tsx` | Page détail Foyer (sync, déconnexion, purge) |
| Create | `src/components/profil/ProfilNotifs.tsx` | Page détail Notifications (push) |
| Modify | `src/components/ProfilScreen.tsx` | Hub mince (en-tête, tuiles, actions, navigation) |
| Modify | `src/App.tsx` | Prop `cycle` = `numeroCycle(semaine affichée)` |
| Modify | `src/index.css` | Token `--creme` + classes hub/détail |
| Modify | `tests/profil-screen.test.tsx` | Hub (tuiles/résumés/navigation) + describes réorganisés en miroir |
| Modify | `tests/e2e/onboarding-mobile.spec.ts` | Navigation tuiles avant assertions champs |
| Modify | `AGENTS.md`, `CHANGELOG.md` | Import .md gardé dans le hub, historique |

---

### Task 1: Résumés purs des tuiles (src/lib/resumes.ts)

**Files:**
- Create: `src/lib/resumes.ts`
- Test: `tests/resumes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/resumes.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '../src/lib/model';
import type { WeightEntry } from '../src/lib/storage'; // WeightEntry vit dans storage, pas model
import type { PushConfig } from '../src/lib/push/module';
import { configDefaut } from '../src/lib/push/module';
import { ageDepuis } from '../src/lib/dates';
import {
  fmtKg,
  resumeDuo,
  resumeInfos,
  resumeMaison,
  resumeNotifications,
  resumeObjectif,
} from '../src/lib/resumes';

const profileBase: UserProfile = {
  id: 'marc',
  dateNaissance: '1985-04-12',
  taille: 178,
  objectif: { type: 'perte', echeance: '2026-12-15' },
  complements: [],
  regime: 'aucun',
};

describe('resumes — fmtKg', () => {
  it('forme française (virgule, sans zéro inutile)', () => {
    expect(fmtKg(4.2)).toBe('4,2');
    expect(fmtKg(4)).toBe('4');
    expect(fmtKg(0.8)).toBe('0,8');
  });
});

describe('resumes — resumeDuo (sous-ligne en-tête)', () => {
  it('connecté : « Duo connecté » point basilic', () => {
    expect(resumeDuo('sync')).toEqual({ label: 'Duo connecté', ton: 'basilic' });
  });
  it('en cours/erreur : « Duo ⟳ » point danger', () => {
    expect(resumeDuo('attente')).toEqual({ label: 'Duo ⟳', ton: 'danger' });
    expect(resumeDuo('erreur')).toEqual({ label: 'Duo ⟳', ton: 'danger' });
  });
  it('hors foyer : « Local » point gris', () => {
    expect(resumeDuo('hors-foyer')).toEqual({ label: 'Local', ton: 'gris' });
  });
  it('off (sans env) : null — chip masquée', () => {
    expect(resumeDuo('off')).toBeNull();
  });
});

describe('resumes — resumeObjectif', () => {
  it('cible + pesée : type · restants (perte)', () => {
    const pesee: WeightEntry = { date: '2026-09-14', kg: 84 };
    expect(resumeObjectif({ ...profileBase, poidsObjectif: 79.8 }, pesee)).toBe(
      'Perte de poids · 4,2 kg restants',
    );
  });
  it('sens auto : cible au-dessus de l actuel → à prendre', () => {
    const pesee: WeightEntry = { date: '2026-09-14', kg: 84 };
    expect(resumeObjectif({ ...profileBase, poidsObjectif: 87.2 }, pesee)).toBe(
      'Perte de poids · 3,2 kg à prendre',
    );
  });
  it('sans cible : le type seul (fallback silencieux)', () => {
    const pesee: WeightEntry = { date: '2026-09-14', kg: 84 };
    expect(resumeObjectif({ ...profileBase, poidsObjectif: undefined }, pesee)).toBe(
      'Perte de poids',
    );
  });
  it('sans pesée : le type seul', () => {
    expect(resumeObjectif({ ...profileBase, poidsObjectif: 79.8 }, null)).toBe('Perte de poids');
  });
  it('maintien : le nom du type (pas de calcul)', () => {
    const pesee: WeightEntry = { date: '2026-09-14', kg: 84 };
    expect(resumeObjectif({ ...profileBase, objectif: { type: 'maintien' } }, pesee)).toBe(
      'Maintien',
    );
  });
});

describe('resumes — resumeInfos', () => {
  it('champs remplis : âge calculé + taille', () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00')); // avec heure (parse local)
    expect(ageDepuis('1985-04-12')).toBe(41);
    expect(resumeInfos(profileBase)).toBe('41 ans · 178 cm');
    vi.useRealTimers();
  });
  it('profil partiel : seuls les champs remplis', () => {
    expect(resumeInfos({ ...profileBase, dateNaissance: undefined })).toBe('178 cm');
  });
  it('rien : « — »', () => {
    expect(
      resumeInfos({ ...profileBase, dateNaissance: undefined, taille: undefined }),
    ).toBe('—');
  });
});

describe('resumes — resumeMaison', () => {
  it('seuls les champs remplis, pill format', () => {
    expect(resumeMaison({ ...profileBase, magasin: 'Carrefour City', budgetMax: 80, personnes: 2 })).toBe(
      'Carrefour City · 80 € · 2 pers.',
    );
  });
  it('rien : « — »', () => {
    expect(resumeMaison(profileBase)).toBe('—');
  });
});

describe('resumes — resumeNotifications', () => {
  it('2 événements + 1 rappel', () => {
    const config: PushConfig = {
      ...configDefaut(),
      rappels: [...configDefaut().rappels, { type: 'seance', jours: [1], heure: '08:00' }],
    };
    expect(resumeNotifications(config)).toBe('2 évts · 1 rappel');
  });
  it('2 rappels : accord pluriel', () => {
    const config: PushConfig = {
      ...configDefaut(),
      rappels: [
        { type: 'seance', jours: [1], heure: '08:00' },
        { type: 'pesee', jours: [1], heure: '08:00' },
      ],
    };
    expect(resumeNotifications(config)).toBe('0 évts · 2 rappels');
  });
  it('rien activé : « — »', () => {
    expect(resumeNotifications({ ...configDefaut(), rappels: [] })).toBe('—');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/resumes.test.ts`
Expected: FAIL — « Cannot find module '../src/lib/resumes' »

- [ ] **Step 3: Write minimal implementation**

Imports exacts (vérifiés dans le repo) : `ageDepuis` depuis `'./dates'`, `OBJECTIF_TYPES`/`UserProfile` depuis `'./model'`, `WeightEntry` depuis `'./storage'` (src/lib/storage.ts:23, **pas** model), `PushConfig` depuis `'./push/module'`, `SyncEtat` depuis `'./sync/engine'`.

```ts
// src/lib/resumes.ts
import { ageDepuis } from './dates';
import { OBJECTIF_TYPES } from './model';
import type { UserProfile } from './model';
import type { WeightEntry } from './storage';
import type { PushConfig } from './push/module';
import type { SyncEtat } from './sync/engine';

// Résumés d'état des tuiles du hub Profil (une ligne) — fonctions pures :
// l'UI (ProfilScreen) ne fait qu'afficher. KISS : pas d'abstraction.

// Nombre français « 4,2 » (virgule, sans zéro inutile) — comme le héro.
export const fmtKg = (n: number): string => n.toString().replace('.', ',');

export interface DuoEntete {
  label: string;
  ton: 'basilic' | 'danger' | 'gris';
}

// Sous-ligne de l'en-tête compte : état duo + cycle. 'off' (sans env) → null.
export const resumeDuo = (syncEtat: SyncEtat): DuoEntete | null => {
  if (syncEtat === 'sync') return { label: 'Duo connecté', ton: 'basilic' };
  if (syncEtat === 'attente' || syncEtat === 'erreur') return { label: 'Duo ⟳', ton: 'danger' };
  if (syncEtat === 'hors-foyer') return { label: 'Local', ton: 'gris' };
  return null; // 'off' : sans env — chip masquée
};

// Tuile Objectif : « Perte de poids · 4,2 kg restants » (sens auto des données :
// cible au-dessus de l'actuel = à prendre). Sans cible ni pesée : le type seul.
export const resumeObjectif = (
  profile: UserProfile,
  pesee: WeightEntry | null,
): string => {
  const nom = OBJECTIF_TYPES.find((t) => t.id === profile.objectif.type)?.nom ?? profile.objectif.type;
  const cible = profile.poidsObjectif;
  if (cible == null || !pesee) return nom;
  const restant = Math.round((pesee.kg - cible) * 10) / 10;
  return `${nom} · ${fmtKg(Math.abs(restant))} kg ${restant > 0 ? 'restants' : 'à prendre'}`;
};

// Tuile Mes infos : seuls les champs remplis (ageDepuis calcule, rien de manuel).
export const resumeInfos = (profile: UserProfile): string => {
  const champs: string[] = [];
  if (profile.dateNaissance) champs.push(`${ageDepuis(profile.dateNaissance)} ans`);
  if (profile.taille != null) champs.push(`${profile.taille} cm`);
  return champs.length > 0 ? champs.join(' · ') : '—';
};

// Tuile Maison & courses : magasin, budget, personnes — pill compacte.
export const resumeMaison = (profile: UserProfile): string => {
  const champs: string[] = [];
  if (profile.magasin) champs.push(profile.magasin);
  if (profile.budgetMax != null) champs.push(`${profile.budgetMax} €`);
  if (profile.personnes != null) champs.push(`${profile.personnes} pers.`);
  return champs.length > 0 ? champs.join(' · ') : '—';
};

// Tuile Notifications : événements activés + rappels (pluriel sur rappel).
export const resumeNotifications = (config: PushConfig): string => {
  const evts = [config.evenements.diner, config.evenements.pesee, config.evenements.courses].filter(Boolean).length;
  const rappels = config.rappels.length;
  if (evts === 0 && rappels === 0) return '—';
  return `${evts} évts · ${rappels} rappel${rappels > 1 ? 's' : ''}`;
};
```

Vérifier les imports réels avant d'écrire : `ageDepuis` est exporté de `src/dates` (ProfilScreen.tsx:5 `import { ageDepuis, todayISO } from '../lib/dates'`) ; `OBJECTIF_TYPES` de `src/model` (ProfilScreen.tsx:2) ; `configDefaut`/`PushConfig` de `src/push/module` (ProfilScreen.tsx:16) ; `SyncEtat` de `src/sync/engine` (ProfilScreen.tsx:14) ; `WeightEntry` de `src/storage` (interface `WeightEntry { date: string; kg: number }`, storage.ts:23) — **importer `WeightEntry` de `./storage`** (pas de `model`) : `import type { UserProfile } from './model'; import type { WeightEntry } from './storage';` et ajuster la signature.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/resumes.test.ts`
Expected: PASS (tous les tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/resumes.ts tests/resumes.test.ts
git commit -m "feat: résumés purs des tuiles du hub profil"
```

---

### Task 2: Icônes SVG (Icon.tsx)

**Files:**
- Modify: `src/components/Icon.tsx` (objet `ICONS`, entrées ligne 21-108)
- Test: `tests/components.test.tsx` (describe `Icon` ligne 1780)

- [ ] **Step 1: Write the failing test**

Dans `tests/components.test.tsx`, repérer le describe `Icon` (ligne 1780) et suivre le pattern existant (les tests rendent l'icône et affirment la présence d'un `svg`). Ajouter à la fin du describe :

```tsx
  it('icônes du hub : info, home, bell, copy, refresh', () => {
    for (const name of ['info', 'home', 'bell', 'copy', 'refresh'] as const) {
      const { container, unmount } = render(<Icon name={name} />);
      expect(container.querySelector('svg'), name).toBeInTheDocument();
      unmount();
    }
  });
```

(Vérifier les imports du fichier : `Icon` est déjà importé — cf. les tests existants du describe. Adapter le nom de variable si le pattern diffère.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components.test.tsx -t "icônes du hub"`
Expected: FAIL — TypeScript : `"info"` n'est pas assignable à `IconName`

- [ ] **Step 3: Write minimal implementation**

Dans `src/components/Icon.tsx`, ajouter dans `ICONS` (avant la ligne 108 `export type IconName`) :

```tsx
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8.1v.1" />
    </>
  ),
  home: <path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z" />,
  bell: <path d="M6 17h12l-1.4-2.1V10a4.6 4.6 0 10-9.2 0v4.9zM10 19.6a2 2 0 004 0" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 5H6a2 2 0 00-2 2v9" />
    </>
  ),
  refresh: <path d="M20 12a8 8 0 11-2.6-5.9M17 4v5h5" />,
```

(Si `ICONS` est écrit différemment (une entrée = un `path` simple ligne 21), le fragment `<>...</>` est déjà valide pour les entrées multi-éléments — vérifier un exemple existant comme `name`/`user` avant d'écrire.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components.test.tsx -t "icônes du hub"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Icon.tsx tests/components.test.tsx
git commit -m "feat: icônes SVG du hub profil (info, home, bell, copy, refresh)"
```

---

### Task 3: présentaion partagée + page Mes infos + hub minimum (première tranche verticale)

**Files:**
- Create: `src/components/profil/presente.tsx`
- Create: `src/components/profil/ProfilInfos.tsx`
- Modify: `src/components/ProfilScreen.tsx` (réstructuration : hub + navigation ; les autres sections restent inline, elles bougent aux Task 4-7)
- Modify: `src/index.css` (token `--creme` + classes hub)
- Test: `tests/profil-screen.test.tsx`

- [ ] **Step 1: Write the failing test**

Dans `tests/profil-screen.test.tsx`, remplacer le helper `section` (ligne 72) et ajouter les helpers hub :

```tsx
// Hub : chaque tuile est un <button> (name = titre + résumé) ; les pages
// détail vivent sous leur h2 (niveau 2).
const ouvrirPage = (titre: string) =>
  screen.getByRole('button', { name: new RegExp(titre) });
const page = (nom: string) =>
  screen.getByRole('heading', { name: nom, level: 2 }).closest('section')!;
```

Le helper `section` (ligne 72-73) reste pour les sections encore inline ; les it qui passent en page utilisent `ouvrirPage` + `page`. Ajouter le describe hub (à la fin du describe `ProfilScreen (unité)`) :

```tsx
  it('hub : tuile Mes infos avec résumé, ouvre la page, « ‹ Profil » revient', async () => {
    const user = userEvent.setup();
    render(
      <ProfilScreen profile={{ ...profileMarc, prenom: 'Marc' }} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} onImported={onImported} cycle={2} />,
    );

    // En-tête compte : initiale + prénom + duo/cycle
    expect(screen.getByText('Marc')).toBeInTheDocument();
    expect(screen.getByText(/Duo/)).not.toBeInTheDocument(); // sync off : chip masquée
    expect(screen.getByText('Cycle 2')).toBeInTheDocument();
    // Tuile Mes infos : résumé âge/taille (41 ans — session du 09/09)
    vi.setSystemTime(new Date('2026-09-09T10:00:00'));
    expect(ouvrirPage('Mes infos')).toHaveTextContent('41 ans · 178 cm');

    await user.click(ouvrirPage('Mes infos'));
    expect(screen.getByRole('heading', { name: 'Mes infos', level: 2 })).toBeInTheDocument();
    expect(screen.getByLabelText('Prénom')).toHaveValue('Marc');

    await user.click(screen.getByRole('button', { name: /Profil/ }));
    expect(screen.queryByRole('heading', { name: 'Mes infos', level: 2 })).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('hub : sous-ligne duo selon syncEtat', () => {
    const { rerender } = render(
      <ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} onImported={onImported} syncEtat="sync" cycle={2} />,
    );
    expect(screen.getByText('Duo connecté')).toBeInTheDocument();

    rerender(
      <ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} onImported={onImported} syncEtat="hors-foyer" cycle={2} />,
    );
    expect(screen.getByText('Local')).toBeInTheDocument();

    rerender(
      <ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} onImported={onImported} syncEtat="off" cycle={2} />,
    );
    expect(screen.queryByText(/Duo|Local/)).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/profil-screen.test.tsx -t "hub"`
Expected: FAIL — la prop `cycle` n'existe pas / l'en-tête compte n'existe pas

- [ ] **Step 3: Write minimal implementation**

`src/components/profil/presente.tsx` :

```tsx
import type { ReactNode } from 'react';

// Fil « Enregistré ✓ » d'une page détail (réutilisé par toutes les pages).
export const Fil = ({ active }: { active: boolean }) =>
  active ? (
    <p className="muted" role="status">
      Enregistré ✓
    </p>
  ) : null;

// Alerte de validation d'une page détail (réutilisé par toutes les pages).
export const Alerte = ({ texte }: { texte: string | null }) =>
  texte ? (
    <p className="error" role="alert">
      {texte}
    </p>
  ) : null;
```

(Retirer `ReactNode` si non utilisé.)

`src/components/profil/ProfilInfos.tsx` — déplacer les états + `enregistrerInfos` verbatim de ProfilScreen (lignes 53-55, 152-185) :

```tsx
import { useState } from 'react';
import { ageDepuis, todayISO } from '../../lib/dates';
import type { UserProfile } from '../../lib/model';
import { saveProfile } from '../../lib/storage';
import { Alerte, Fil } from './presente';

// Page détail « Mes infos » — le retour ‹ est géré par ProfilScreen.
export function ProfilInfos({
  profile,
  onProfileSaved,
}: {
  profile: UserProfile;
  onProfileSaved?: (p: UserProfile) => void;
}) {
  const [prenom, setPrenom] = useState(profile.prenom ?? '');
  const [dateNaissance, setDateNaissance] = useState(profile.dateNaissance ?? '');
  const [taille, setTaille] = useState(profile.taille != null ? String(profile.taille) : '');
  const [saved, setSaved] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Pattern render-phase reset (cf. ProfileView) : la page re-synchronise
  // la prop profile (réouverture, enregistrement aval) sans remount.
  const [synced, setSynced] = useState(profile.id);
  if (synced !== profile.id) {
    setSynced(profile.id);
    setPrenom(profile.prenom ?? '');
    setDateNaissance(profile.dateNaissance ?? '');
    setTaille(profile.taille != null ? String(profile.taille) : '');
    setSaved(false);
    setErreur(null);
  }

  const enregistrerInfos = () => {
    const cm = taille ? Number.parseInt(taille, 10) : undefined;
    if ((dateNaissance || taille) && (!dateNaissance || cm === undefined || Number.isNaN(cm))) {
      setErreur('Formulaire incomplet : remplis ta date de naissance et ta taille.');
      return;
    }
    if (dateNaissance) {
      if (dateNaissance > todayISO()) {
        setErreur('La date de naissance ne peut pas être dans le futur.');
        return;
      }
      const ans = ageDepuis(dateNaissance);
      if (ans < 10 || ans > 100) {
        setErreur('Âge calculé invalide : entre 10 et 100 ans.');
        return;
      }
    }
    if (cm != null && (cm < 120 || cm > 230)) {
      setErreur('Taille invalide : entre 120 et 230 cm.');
      return;
    }
    setErreur(null);
    // Pattern delete + re-set : un champ vidé retire la donnée — un profil
    // partiel (prénom seul) est un état valide, jamais une valeur vide écrite.
    const updated: UserProfile = { ...profile };
    delete updated.prenom;
    delete updated.dateNaissance;
    delete updated.taille;
    if (prenom.trim()) updated.prenom = prenom.trim();
    if (dateNaissance) updated.dateNaissance = dateNaissance;
    if (cm != null) updated.taille = cm;
    saveProfile(updated);
    onProfileSaved?.(updated);
    setSaved(true);
  };

  return (
    <section className="detail-page">
      <h2>Mes infos</h2>
      <div className="onboarding-field">
        <label htmlFor="pf-prenom">Prénom</label>
        <input
          id="pf-prenom"
          type="text"
          maxLength={20}
          value={prenom}
          onChange={(e) => {
            setSaved(false);
            setPrenom(e.target.value);
          }}
        />
        <p className="onb-hint">Utilisé dans les salutations et le prompt IA.</p>
      </div>
      <div className="onboarding-field">
        <label htmlFor="pf-naissance">Date de naissance</label>
        <input
          id="pf-naissance"
          type="date"
          value={dateNaissance}
          onChange={(e) => {
            setSaved(false);
            setDateNaissance(e.target.value);
          }}
        />
        <p className="onb-hint">
          {dateNaissance
            ? `${ageDepuis(dateNaissance)} ans — calculé automatiquement.`
            : 'Sélectionne ta date de naissance.'}
        </p>
      </div>
      <div className="onboarding-field">
        <label htmlFor="pf-taille">Taille (cm)</label>
        <input
          id="pf-taille"
          type="number"
          inputMode="numeric"
          value={taille}
          onChange={(e) => {
            setSaved(false);
            setTaille(e.target.value);
          }}
        />
      </div>
      <button type="button" className="btn profil-save" onClick={enregistrerInfos}>
        Enregistrer mes infos
      </button>
      <Alerte texte={erreur} />
      <Fil active={saved} />
    </section>
  );
}
```

`src/components/ProfilScreen.tsx` — hub (réstructuration complète ; les sections non encore extraites — Objectif/Compléments/Régime/Maison — restent rendues inline sous la tuile, elles bougent aux Task 4-7) :

```tsx
import { useEffect, useState } from 'react';
import { prenomProfil } from '../lib/model';
import type { ImportedWeek, UserProfile } from '../lib/model';
import { parseWeeklyFile } from '../lib/parse';
import { loadProfile, loadProfilLegacy, loadWeeks, removeProfile } from '../lib/storage';
```

Code final du hub (remplacer le `return` de ProfilScreen — les props gagnent `cycle` ; ne pas toucher aux effets posés avant les early returns — règle des hooks) :

```tsx
type Vue = 'hub' | 'objectif' | 'infos' | 'maison' | 'notifs' | 'foyer';

// Message d'état en vue connectée (texte simple — pas de symbole).
const ETAT_SYNC: Record<Exclude<SyncEtat, 'off' | 'hors-foyer'>, string> = {
  attente: 'Synchronisation : en attente.',
  sync: 'Synchronisé.',
  erreur: 'Synchronisation : erreur.',
};
```

Dans le `return` du hub, remplacer `<h1>Profil</h1>` et toutes les `<section>` par :

```tsx
  const duo = resumeDuo(syncEtat);
  const evtsActifs = [pushConfig.evenements.diner, pushConfig.evenements.pesee, pushConfig.evenements.courses].filter(Boolean).length;
  const pushRappels = pushConfig.rappels.length;

  return (
    <div className="profil-screen">
      {vue === 'hub' ? (
        <>
          <button type="button" className="profil-back" onClick={onBack}>
            <Icon name="chev-left" size={16} />
            Retour
          </button>
          <div className="profil-hub">
            <div className="hub-compte">
              <div className="hub-avatar">{(prenomProfil(profile.id, profile)[0] ?? '?').toUpperCase()}</div>
              <div>
                <div className="hub-nom">{prenomProfil(profile.id, profile)}</div>
                <div className="hub-sous">
                  {duo && <span aria-hidden="true" className={`hub-pt${duo.ton !== 'basilic' ? ` ${duo.ton}` : ''}`} />}
                  {duo && <b>{duo.label}</b>}
                  {cycle != null && (
                    <span className="hub-cycle">{duo ? `· Cycle ${cycle}` : `Cycle ${cycle}`}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="hub-tuiles">
              <button type="button" className="hub-tuile" onClick={() => setVue('objectif')}>
                <Icon name="target" size={20} />
                <b>Objectif</b>
                <span>{resumeObjectif(profile, getWeights(profile.id).at(-1) ?? null)}</span>
              </button>
              <button type="button" className="hub-tuile" onClick={() => setVue('infos')}>
                <Icon name="info" size={20} />
                <b>Mes infos</b>
                <span>{resumeInfos(profile)}</span>
              </button>
              <button type="button" className="hub-tuile" onClick={() => setVue('maison')}>
                <Icon name="home" size={20} />
                <b>Maison &amp; courses</b>
                <span>{resumeMaison(profile)}</span>
              </button>
              {pushVisible && (
                <button type="button" className="hub-tuile" onClick={() => setVue('notifs')}>
                  <Icon name="bell" size={20} />
                  <b>Notifications</b>
                  <span>{resumeNotifications(pushConfig)}</span>
                </button>
              )}
            </div>
            <div className="hub-actions">
              <button type="button" className="hub-action" onClick={changerProfil}>
                <Icon name="refresh" size={16} /> Changer de profil <span className="fleche">›</span>
              </button>
              <button type="button" className="hub-action" onClick={copierPrompt}>
                <Icon name="copy" size={16} /> Copier le prompt IA <span className="fleche">⧉</span>
              </button>
              {duo && (
                <button type="button" className="hub-action" onClick={() => setVue('foyer')}>
                  <span className="hub-pt" /> {duo.label} — voir le foyer <span className="fleche">›</span>
                </button>
              )}
              {syncEtat !== 'off' && (
                <button type="button" className="hub-action danger" onClick={deconnecterFoyer}>
                  Déconnecter le foyer <span className="fleche">›</span>
                </button>
              )}
              <div className="hub-import">
                <ImportButton onImported={onImported} label="Importer un cycle (.md)" />
              </div>
              {copie && (
                <p className="muted" role="status">
                  Prompt copié — colle-le dans le chat.
                </p>
              )}
            </div>
          </div>
          <p className="muted profil-about">
            Rituel v{__APP_VERSION__} — vos données restent sur votre téléphone.
          </p>
        </>
      ) : (
        <>
          <button type="button" className="profil-back" onClick={() => setVue('hub')}>
            <Icon name="chev-left" size={16} />
            Profil
          </button>
          {vue === 'infos' && <ProfilInfos profile={profile} onProfileSaved={onProfileSaved} />}
          {vue === 'objectif' && <ObjectifInline profile={profile} onProfileSaved={onProfileSaved} />}
          {vue === 'maison' && <MaisonInline profile={profile} onProfileSaved={onProfileSaved} />}
          {vue === 'notifs' && <PushInline />}
          {vue === 'foyer' && <FoyerInline syncEtat={syncEtat} />}
        </>
      )}
    </div>
  );
```

`ObjectifInline`/`MaisonInline`/`PushInline`/`FoyerInline` = les sections actuelles renommées (déplacement mécanique de JSX, bougent en fichiers aux Task 4-7). La prop `changerProfil` (confirm) et `copierPrompt` restent dans ProfilScreen ; `copierPrompt` trime `setCopie(false)` des onChange maison au déplacement (Task 5).

`src/index.css` — ajout (token dans `:root` ligne 43, entre `--bg` et `--surface`, classes après `.profil-back` ligne 2352) :

```css
  --creme: #f5f1e6; /* canvas du hub Profil (maquette v5) */
```

```css
/* ---------- Hub Profil (cards) ---------- */

.profil-hub {
  background: var(--creme);
  border-radius: var(--radius);
  padding: var(--sp-14);
}

.hub-compte {
  display: flex;
  align-items: center;
  gap: var(--sp-14);
  padding: var(--sp-10) var(--sp-4) var(--sp-14);
}

.hub-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  font: inherit;
  font-size: var(--fs-h3);
  font-weight: 700;
  flex-shrink: 0;
}

.hub-nom {
  font-size: var(--fs-h3);
  font-weight: 700;
  color: var(--text);
}

/* muted seul sur crème < 4,5:1 — même mix que la ligne 309 */
.hub-sous {
  display: flex;
  align-items: center;
  gap: var(--sp-6);
  margin-top: var(--sp-2);
  font-size: var(--fs-meta);
  color: color-mix(in srgb, var(--muted) 84%, var(--text));
}

.hub-pt {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}
.hub-pt.gris { background: var(--surface-2); border: 1px solid var(--border); }
.hub-pt.danger { background: var(--danger); }

.hub-tuiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-10);
}

.hub-tuile {
  background: var(--surface);
  border: none;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: var(--sp-14);
  min-height: 48px;
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: transform .12s, box-shadow .12s;
}
.hub-tuile:active {
  transform: scale(.97);
}
.hub-tuile b {
  display: block;
  margin-top: var(--sp-6);
  font-size: var(--fs-sec);
  color: var(--text);
}
.hub-tuile span {
  display: block;
  margin-top: var(--sp-2);
  font-size: var(--fs-micro);
  color: color-mix(in srgb, var(--muted) 84%, var(--text));
}

.hub-actions {
  margin-top: var(--sp-14);
  display: flex;
  flex-direction: column;
  gap: var(--sp-8);
}

.hub-action {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--sp-12) var(--sp-14);
  min-height: 48px;
  font: inherit;
  font-size: var(--fs-body);
  color: var(--text);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: background .15s;
}
.hub-action:active { background: var(--surface-2); }
.hub-action.danger { color: var(--danger); }
.hub-action .fleche { color: var(--surface-2); }

.detail-page {
  background: var(--creme);
  border-radius: var(--radius);
  padding: var(--sp-14);
  /* Anim fade latérale d'entrée de page (spec §2) — décorative. */
  animation: detail-entree .16s ease-out;
}

@keyframes detail-entree {
  from { opacity: 0; transform: translateX(var(--sp-6)); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .detail-page {
    animation: none;
  }
}
```

(Vérifier `--danger` existe — ProfilScreen utilise déjà `var(--danger)` ligne 2358 de index.css ; sinon créer avec la teinte du danger existant.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/profil-screen.test.tsx`
Expected: PASS (hub + describes adaptés). Les it qui touchent les anciennes sections inline (Date de naissance etc.) passent à `ouvrirPage('Mes infos')` — c'est ce déplacement mécanique (helper `ouvrirPage` + assertions) qu'on fait dans ce Step 4 AVANT le vert.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProfilScreen.tsx src/components/profil/presente.tsx src/components/profil/ProfilInfos.tsx src/index.css tests/profil-screen.test.tsx
git commit -m "feat: hub profil minimum — en-tête compte, tuiles, page Mes infos"
```

---

### Task 4: Page Objectif (type + poids + échéance + régime + compléments)

**Files:**
- Create: `src/components/profil/ProfilObjectif.tsx`
- Modify: `src/components/ProfilScreen.tsx` (supprimer ObjectifInline + Compléments + Régime ; brancher ProfilObjectif)
- Test: `tests/profil-screen.test.tsx` (les describe objectif/compléments/régime passent à `ouvrirPage('Objectif')`)

- [ ] **Step 1: Write the failing test**

Adapter les describe « objectif affiché et modifiable », « compléments ajoutés et retirés », « régime persisté », « refuse un poids objectif hors bornes », « complément en doublon », « objectifs existants et enregistre leurs modifications », « permet de supprimer le poids objectif » : chacun ajoute en tête du it :

```tsx
    const user = userEvent.setup();
    render(<ProfilScreen profile={profile} ... />);
    await user.click(ouvrirPage('Objectif')); // la page vit sous le h2
```

et remplace `section('Objectif')`/`section('Compléments')` par `page('Objectif')`. Exemple complet pour le régime :

```tsx
  it('sections dédiées : régime persisté', async () => {
    const user = userEvent.setup();
    render(<ProfilScreen profile={profileMarc} onBack={onBack} onChangeProfile={onChangeProfile} onProfileSaved={onProfileSaved} onImported={onImported} />);
    await user.click(ouvrirPage('Objectif'));

    await user.click(screen.getByRole('radio', { name: 'Végétarien' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer le régime' }));

    expect(loadProfile()).toMatchObject({ regime: 'vegetarien' });
  });
```

Les it de unité qui assertent `Date de naissance`/`Enregistrer mes infos` au premier lancement (lignes 93-241) passent aussi à `ouvrirPage('Mes infos')` en tête (déjà fait Task 3).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/profil-screen.test.tsx`
Expected: FAIL — « Enregistrer le régime » introuvable (la page vit sous `ouvrirPage('Objectif')`)

- [ ] **Step 3: Write minimal implementation**

`src/components/profil/ProfilObjectif.tsx` — déplacer verbatim les états + saves objectif/objectifType/poidsObjectif/complements/nouveauComplement/regime (ProfilScreen lignes 56-63, 187-208, 271-281) dans un composant :

```tsx
import { useState } from 'react';
import { OBJECTIF_TYPES, REGIMES, normaliseComplement } from '../../lib/model';
import type { ObjectifType, Regime, UserProfile } from '../../lib/model';
import { parseEuro } from '../../lib/prix';
import { saveProfile } from '../../lib/storage';
import { Alerte, Fil } from './presente';

// Page détail « Objectif » — le cap complet : type, poids, échéance,
// régime et compléments (le héro du suivi les affiche ensemble).
export function ProfilObjectif({
  profile,
  onProfileSaved,
}: {
  profile: UserProfile;
  onProfileSaved?: (p: UserProfile) => void;
}) {
  const [objectifType, setObjectifType] = useState<ObjectifType>(profile.objectif.type);
  const [echeance, setEcheance] = useState(profile.objectif.echeance ?? '');
  const [poidsObjectif, setPoidsObjectif] = useState(
    profile.poidsObjectif != null ? String(profile.poidsObjectif) : '',
  );
  const [complements, setComplements] = useState<string[]>([...profile.complements]);
  const [nouveauComplement, setNouveauComplement] = useState('');
  const [regime, setRegime] = useState<Regime>(profile.regime);
  const [saved, setSaved] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Pattern render-phase reset (cf. ProfileView)
  const [synced, setSynced] = useState(profile.id);
  if (synced !== profile.id) {
    setSynced(profile.id);
    setObjectifType(profile.objectif.type);
    setEcheance(profile.objectif.echeance ?? '');
    setPoidsObjectif(profile.poidsObjectif != null ? String(profile.poidsObjectif) : '');
    setComplements([...profile.complements]);
    setNouveauComplement('');
    setRegime(profile.regime);
    setSaved(false);
    setErreur(null);
  }

  const maj = (updated: UserProfile) => {
    saveProfile(updated);
    onProfileSaved?.(updated);
    setSaved(true);
  };

  const enregistrerObjectif = () => {
    const obj = poidsObjectif ? Number.parseFloat(poidsObjectif.replace(',', '.')) : undefined;
    if (poidsObjectif && (obj === undefined || obj < 30 || obj > 250)) {
      setErreur('Poids objectif invalide : entre 30 et 250 kg.');
      return;
    }
    setErreur(null);
    const updated: UserProfile = {
      ...profile,
      objectif: { type: objectifType, ...(echeance ? { echeance } : {}) },
    };
    delete updated.poidsObjectif;
    if (obj != null) updated.poidsObjectif = obj;
    maj(updated);
  };

  const enregistrerComplements = () => {
    setErreur(null);
    maj({ ...profile, complements: [...complements] });
  };

  const enregistrerRegime = () => maj({ ...profile, regime });

  const ajouterComplement = () => {
    const v = nouveauComplement.trim().slice(0, 40);
    if (!v) return;
    if (complements.some((c) => normaliseComplement(c) === normaliseComplement(v))) {
      setErreur('Ce complément est déjà sélectionné.');
      return;
    }
    setErreur(null);
    setComplements([...complements, v]);
    setNouveauComplement('');
  };
```

**Règle fidélité** : les callbacks ci-dessus sont des copies **caractère pour caractère** du ProfilScreen actuel (bornes, `parseEuro`, messages) avec les deux transformations : `maj('section', updated)` → `maj(updated)` et `clearErreur('section')`/`setErreur({section, texte})` → `setErreur(null)`/`setErreur(texte)`. Copier le JSX des sections objectif/compléments/régime (ProfilScreen lignes 403-525) dans le `return` du composant, en remplaçant `{alerte('objectif')}` → `<Alerte texte={erreur} />` et `{fil('objectif')}` → `<Fil active={saved} />`.

Dans ProfilScreen : supprimer les états/saves/JSX déplacés ; brancher `{vue === 'objectif' && <ProfilObjectif profile={profile} onProfileSaved={onProfileSaved} />}` ; supprimer `objectifType/echeance/poidsObjectif/complements/nouveauComplement/regime/savedSection` (et `Section`/`SectionAvecErreur`/`Erreur` si devenus inutiles).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/profil-screen.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/profil/ProfilObjectif.tsx src/components/ProfilScreen.tsx tests/profil-screen.test.tsx
git commit -m "feat: page Objectif — cap complet (type, poids, échéance, régime, compléments)"
```

---

### Task 5: Page Maison & courses

**Files:**
- Create: `src/components/profil/ProfilMaison.tsx`
- Modify: `src/components/ProfilScreen.tsx` (supprimer MaisonInline ; brancher ProfilMaison ; retirer `setCopie(false)` des onChange maison — le feedback vit au hub)
- Test: `tests/profil-screen.test.tsx` (describe « Maison & courses » : `ouvrirPage('Maison & courses')`)

- [ ] **Step 1: Write the failing test**

Adapter le describe « ProfilScreen — Maison & courses » (lignes 404-500) : chaque it ajoute `await user.click(ouvrirPage('Maison & courses'))` après le render et `section('Maison & courses')` devient `page('Maison & courses')`. Exemple complet (l'it budget invalide) :

```tsx
  it('refuse un budget max invalide (erreur rendue dans la page)', async () => {
    const user = userEvent.setup();
    render(<ProfilScreen profile={profileMarc} onBack={() => {}} onChangeProfile={() => {}} onImported={() => {}} />);
    await user.click(ouvrirPage('Maison & courses'));

    await user.type(screen.getByLabelText('Budget max courses / semaine (€)'), '0');
    await user.click(screen.getByRole('button', { name: 'Enregistrer maison & courses' }));

    expect(within(page('Maison & courses')).getByRole('alert')).toHaveTextContent(/Budget max invalide/i);
    expect(loadProfile()).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/profil-screen.test.tsx -t "Maison & courses"`
Expected: FAIL — les champs ne sont visibles qu'après `ouvrirPage`

- [ ] **Step 3: Write minimal implementation**

`src/components/profil/ProfilMaison.tsx` — déplacer verbatim les états `magasin/budgetMax/personnes/repasJour/preferences/nouvellePreference` + `enregistrerMaison` + `ajouterPreference` (ProfilScreen lignes 64-69, 210-254) + JSX (lignes 527-639) :

```tsx
import { useState } from 'react';
import { MAGASINS_PRESETS, normaliseComplement } from '../../lib/model';
import type { UserProfile } from '../../lib/model';
import { parseEuro } from '../../lib/prix';
import { saveProfile } from '../../lib/storage';
import { Alerte, Fil } from './presente';

// Page détail « Maison & courses » — magasin, budget, personnes à table,
// repas/jour, préférences des prochains cycles. Copies fidèles des bornes.
export function ProfilMaison({
  profile,
  onProfileSaved,
}: {
  profile: UserProfile;
  onProfileSaved?: (p: UserProfile) => void;
}) {
  const [magasin, setMagasin] = useState(profile.magasin ?? '');
  const [budgetMax, setBudgetMax] = useState(profile.budgetMax != null ? String(profile.budgetMax) : '');
  const [personnes, setPersonnes] = useState(profile.personnes != null ? String(profile.personnes) : '');
  const [repasJour, setRepasJour] = useState(profile.repasJour != null ? String(profile.repasJour) : '');
  const [preferences, setPreferences] = useState<string[]>([...(profile.preferences ?? [])]);
  const [nouvellePreference, setNouvellePreference] = useState('');
  const [saved, setSaved] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Pattern render-phase reset (cf. ProfileView)
  const [synced, setSynced] = useState(profile.id);
  if (synced !== profile.id) {
    setSynced(profile.id);
    setMagasin(profile.magasin ?? '');
    setBudgetMax(profile.budgetMax != null ? String(profile.budgetMax) : '');
    setPersonnes(profile.personnes != null ? String(profile.personnes) : '');
    setRepasJour(profile.repasJour != null ? String(profile.repasJour) : '');
    setPreferences([...(profile.preferences ?? [])]);
    setNouvellePreference('');
    setSaved(false);
    setErreur(null);
  }

  const enregistrerMaison = () => {
    const bud = budgetMax ? parseEuro(budgetMax) : undefined;
    if (bud !== undefined && (bud === null || bud > 10000)) {
      setErreur('Budget max invalide : entre un montant en euros (ex. 40).');
      return;
    }
    const pers = personnes ? Number.parseInt(personnes, 10) : undefined;
    if (personnes && (pers === undefined || pers < 1 || pers > 12)) {
      setErreur('Personnes à table : entre 1 et 12.');
      return;
    }
    const repas = repasJour ? Number.parseInt(repasJour, 10) : undefined;
    if (repasJour && (repas === undefined || repas < 1 || repas > 12)) {
      setErreur('Repas par jour : entre 1 et 12.');
      return;
    }
    setErreur(null);
    // Clés maison reconstruites : un champ vidé retire la donnée (pattern
    // delete + set de enregistrerObjectif) — jamais de valeur vide écrite.
    const updated: UserProfile = { ...profile };
    delete updated.magasin;
    delete updated.budgetMax;
    delete updated.preferences;
    delete updated.personnes;
    delete updated.repasJour;
    if (magasin.trim()) updated.magasin = magasin.trim();
    if (bud != null) updated.budgetMax = bud;
    if (preferences.length > 0) updated.preferences = [...preferences];
    if (pers != null) updated.personnes = pers;
    if (repas != null) updated.repasJour = repas;
    maj(updated);
  };

  const ajouterPreference = () => {
    const v = nouvellePreference.trim().slice(0, 40);
    if (!v) return;
    if (preferences.some((p) => normaliseComplement(p) === normaliseComplement(v))) {
      setErreur('Cette préférence est déjà sélectionnée.');
      return;
    }
    setErreur(null);
    setPreferences([...preferences, v]);
    setNouvellePreference('');
  };
```

Copier le JSX fidèle (datalist inclus), `{alerte('maison')}` → `<Alerte texte={erreur} />`, `{fil('maison')}` → `<Fil active={saved} />`. Dans ProfilScreen : supprimer les états/saves/JSX déplacés ; `copierPrompt` garde `setCopie(false)` retiré des onChange (le champ périmé est retiré du hub — la confirmation se réinitialise à la copie suivante ; le it « efface la confirmation dès qu un champ maison change » se supprime avec sa note, la règle produit vit au hub via `setCopie(false)` de `changerProfil`/réutilisation — cf. CHANGELOG).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/profil-screen.test.tsx`
Expected: PASS (le it « copie le prompt complet avec confirmation » et « est toujours visible » passent au hub ; le it « efface la confirmation » se supprime).

- [ ] **Step 5: Commit**

```bash
git add src/components/profil/ProfilMaison.tsx src/components/ProfilScreen.tsx tests/profil-screen.test.tsx
git commit -m "feat: page Maison & courses dédiée"
```

---

### Task 6: Page Foyer (sync, déconnexion, purge)

**Files:**
- Create: `src/components/profil/ProfilFoyer.tsx`
- Modify: `src/components/ProfilScreen.tsx` (supprimer FoyerInline + ETAT_SYNC ; brancher ProfilFoyer)
- Test: `tests/profil-screen.test.tsx` (describe sync : `ouvrirPage('voir le foyer')`)

- [ ] **Step 1: Write the failing test**

Les tests sync du bloc profil vivent dans `tests/sync/ui.test.tsx` — `describe('sync UI: bloc profil')` (lignes 116-197), rendu direct de `<ProfilScreen profile={...} syncEtat={...}>` avec `renderProfil` (déjà défini ligne 126). Le mock de `lib/sync/config` existe déjà en tête de fichier (lignes 20-24) — **ne pas en ajouter**. Le formulaire vit désormais sur la page détail : chacun des **6 its** de ce describe gagne une première ligne pour ouvrir la page :

```tsx
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /voir le foyer/ }));
```

(Exemple complet, it « attente : saisie code + bouton connecter (appel engine) » — la ligne ajoutée en tête, le reste inchangé :)

```tsx
  it('attente : saisie code + bouton connecter (appel engine)', async () => {
    const { connecterFoyer } = await import('../../src/lib/sync/engine');
    renderProfil('attente');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /voir le foyer/ }));
    await user.type(screen.getByLabelText('Code de foyer'), 'rituel-2026');
    await user.click(screen.getByRole('button', { name: 'Se connecter au foyer' }));
    expect(connecterFoyer).toHaveBeenCalledWith('rituel-2026');
  });
```

(`hors-foyer` passe aussi : `resumeDuo('hors-foyer')` = `{ label: 'Local' }` → le bouton s'appelle `Local — voir le foyer`.) Typecheck compris : `renderProfil` n'a pas besoin de changement.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/profil-screen.test.tsx -t "page Foyer"`
Expected: FAIL — pas de h2 « Foyer »

- [ ] **Step 3: Write minimal implementation**

`src/components/profil/ProfilFoyer.tsx` — déplacer verbatim ETAT_SYNC (lignes 32-36) + `connecterFoyerCode` + `supprimerFoyer` (lignes 292-323) + JSX sync (lignes 663-717) :

```tsx
import { useState } from 'react';
import { connecterFoyer, deconnecterFoyer, purgerFoyer } from '../../lib/sync/engine';
import type { SyncEtat } from '../../lib/sync/engine';
import { messageConnexion } from '../../lib/sync/messages';
import { lireSessionPub } from '../../lib/sync/session';
import { Alerte } from './presente';

// Message d'état en vue connectée (texte simple — pas de symbole).
const ETAT_SYNC: Record<Exclude<SyncEtat, 'off' | 'hors-foyer'>, string> = {
  attente: 'Synchronisation : en attente.',
  sync: 'Synchronisé.',
  erreur: 'Synchronisation : erreur.',
};

// Page détail « Foyer » — connexion par code, état duo, déconnexion,
// purge (double confirmation, définitive pour tout le foyer).
export function ProfilFoyer({ syncEtat }: { syncEtat: SyncEtat }) {
  const [codeFoyer, setCodeFoyer] = useState('');
  const [syncErreur, setSyncErreur] = useState<string | null>(null);
  const [syncOccupe, setSyncOccupe] = useState(false);
  const [purgeEnCours, setPurgeEnCours] = useState(false);

  const connecterFoyerCode = async () => {
    const code = codeFoyer.trim();
    if (!code) return;
    setSyncOccupe(true);
    setSyncErreur(null);
    try {
      await connecterFoyer(code);
      setCodeFoyer('');
    } catch (e) {
      setSyncErreur(messageConnexion(e));
    } finally {
      setSyncOccupe(false);
    }
  };

  // Purge : le serveur est nettoyé avant le local (engine) — double
  // confirmation car l'action est définitive pour tout le foyer. La garde
  // purgeEnCours verrouille pendant la flush en vol (double-tap).
  const supprimerFoyer = () => {
    if (purgeEnCours) return;
    if (
      !window.confirm(
        'Supprimer les données du foyer ? Semaines, pesées et dépenses partagées seront effacées chez Supabase et sur tous les téléphones du foyer.',
      )
    )
      return;
    if (!window.confirm('Dernière confirmation : cette action est définitive.')) return;
    setPurgeEnCours(true);
    purgerFoyer()
      .catch(() => setSyncErreur('Suppression impossible : réessaie plus tard.'))
      .finally(() => setPurgeEnCours(false));
  };

  return (
    <section className="detail-page">
      <h2>Foyer</h2>
      {lireSessionPub() ? (
        <>
          {syncEtat !== 'hors-foyer' && <p className="muted">{ETAT_SYNC[syncEtat]}</p>}
          <button type="button" className="profil-ghost" onClick={deconnecterFoyer}>Déconnecter le foyer</button>
          <button type="button" className="sync-danger" onClick={supprimerFoyer} disabled={purgeEnCours}>
            {purgeEnCours ? 'Suppression…' : 'Supprimer les données du foyer'}
          </button>
        </>
      ) : (
        <>
          <div className="onboarding-field">
            <label htmlFor="sync-code">Code de foyer</label>
            <input id="sync-code" type="password" value={codeFoyer} onChange={(e) => { setSyncErreur(null); setCodeFoyer(e.target.value); }} />
          </div>
          <button type="button" className="profil-ghost" onClick={connecterFoyerCode} disabled={syncOccupe}>
            {syncOccupe ? 'Connexion…' : 'Se connecter au foyer'}
          </button>
        </>
      )}
      <Alerte texte={syncErreur} />
      <p className="onb-hint">Données synchronisées chez Supabase — région UE, accès limité au foyer.</p>
    </section>
  );
}
```

Imports exacts : `deconnecterFoyer`/`connecterFoyer`/`purgerFoyer`/`lireSessionPub` de `../../lib/sync/engine` (ré-export ligne 540 `lireSessionPub`), `messageConnexion` de `../../lib/sync/messages`. Dans ProfilScreen : supprimer les états `codeFoyer/syncErreur/syncOccupe/purgeEnCours` + saves + ETAT_SYNC + `lireSessionPub` import ; brancher `{vue === 'foyer' && <ProfilFoyer syncEtat={syncEtat} />}`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/profil-screen.test.tsx tests/sync`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/profil/ProfilFoyer.tsx src/components/ProfilScreen.tsx tests/profil-screen.test.tsx
git commit -m "feat: page Foyer — connexion, déconnexion, purge"
```

---

### Task 7: Page Notifications (push) + tuile silencieuse

**Files:**
- Create: `src/components/profil/ProfilNotifs.tsx`
- Modify: `src/components/ProfilScreen.tsx` (supprimer PushInline + push-bloc ; brancher ProfilNotifs)
- Test: `tests/sync/ui.test.tsx` (describe « profil: bloc Notifications », 10 its adaptés via la tuile)

- [ ] **Step 1: Write the failing test**

Les tests push vivent dans `tests/sync/ui.test.tsx` — `describe('profil: bloc Notifications')` (lignes 327-445), rendu direct de `<ProfilScreen>` via `renderProfil` (défini ligne 337). Les mocks `push/config` + `push/module` existent déjà (lignes 306-325) — **ne pas en ajouter**. Deux adaptations :

1. Les **9 its** interactifs/cachés gagnent la navigation tuile → page après `renderProfil()` (toggle « Activer les notifications », événements, rappels… restent inchangés) :

```tsx
    await user.click(screen.getByRole('button', { name: /Notifications/ })); // tuile → page
```

2. L'it « caché sans push actif » (lignes 353-357, `pushActifMock.mockReturnValue(false)`) gagne l'assertion **tuile silencieuse** :

```tsx
    expect(screen.queryByRole('button', { name: /Notifications/ })).not.toBeInTheDocument();
```

(L'assert heading existante reste : le h2 vit au level 2 désormais — l'it « visible avec push actif » passe son assert heading à `level: 2`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sync/ui.test.tsx -t "bloc Notifications"`
Expected: FAIL — les its interactifs ne trouvent pas le contenu (il est caché derrière la tuile, non cliquée) ; l'assert tuile silencieuse est une **garde** (elle passe dès le câblage Task 3, `pushActifMock` false → tuile jamais rendue).

- [ ] **Step 3: Write minimal implementation**

`src/components/profil/ProfilNotifs.tsx` — déplacer verbatim le JSX push-bloc (ProfilScreen lignes 719-821) + `pushVisible` :

```tsx
import { pushActif } from '../../lib/push/config';
import type { PushConfig } from '../../lib/push/module';
import { souscrireEtEnregistrer, desabonner, majConfig } from '../../lib/push/module';
import type { RappelPush } from '../../lib/push/module';
```

Le composant reçoit `{ pushConfig, onChange, pushOn, pushErreur, pushBasculer }` et pilote les callbacks. Dans ProfilScreen : garder `pushOn/pushConfig/pushErreur/pushBasculer` au hub (les résumés + sous-ligne en ont besoin), brancher `{vue === 'notifs' && pushVisible && <ProfilNotifs ... />}`, supprimer le JSX déplacé. La tuile (Task 3) est déjà conditionnée à `pushVisible`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/sync/ui.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/profil/ProfilNotifs.tsx src/components/ProfilScreen.tsx tests/sync/ui.test.tsx
git commit -m "feat: page Notifications dédiée + tuile silencieuse sans SW"
```

---

### Task 8: Prop cycle dans App + test « Cycle 2 »

**Files:**
- Modify: `src/App.tsx:123-144` (brancher `cycle` sur ProfilScreen)
- Test: `tests/app.test.tsx` (describe multi-semaines)

- [ ] **Step 1: Write the failing test**

```tsx
  it('le Profil affiche le cycle de la semaine consultée', async () => {
    vi.setSystemTime(new Date('2026-09-15T10:00:00')); // mardi, dans S38
    const user = userEvent.setup();
    const raw38 = fixtureSemaine('2026-S38', '2026-09-14', '2026-09-20', 'B', 'Chili con carne');
    upsertWeek(raw38, parseWeeklyFile(raw38).data);
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Semaine suivante' })); // S39 = Cycle 3
    await user.click(screen.getByRole('button', { name: 'Mon profil' }));

    expect(screen.getByText('Cycle 3')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app.test.tsx -t "cycle de la semaine consultée"`
Expected: FAIL — « Cycle 3 » n'est pas dans le Profil (la prop cycle n'existe pas)

- [ ] **Step 3: Write minimal implementation**

Dans `src/App.tsx` (bloc `profilOuvert`, ligne ~126) :

```tsx
        <ProfilScreen
          profile={profile}
          syncEtat={syncEtat}
          cycle={numeroCycle(affichee.data.meta.semaine)}
```

et ajouter `numeroCycle` à l'import existant (ligne 21 `import { todayISO } from './lib/dates';` → `import { numeroCycle, todayISO } from './lib/dates';`).

**Réordonnement** (lignes actuelles : `!profile` 125-127 → `profilOuvert` 129-151 → calcul 153-160) : déplacer le calcul `idx`/`trouve`/`idxAffiche`/`affichee` + garde `if (!affichee) return null;` (lignes 153-160) **entre** le retour onboarding et le bloc `profilOuvert` — jamais avant le retour `!profile` (semaines vides à l'onboarding : le garde `!affichee` masquerait l'onboarding). Le bloc `profilOuvert` accède alors à `affichee` défini :

```tsx
  if (!profile) {
    return <Onboarding onDone={setProfile} prefill={loadProfilLegacy() ?? undefined} />;
  }

  const idx = indexSemaineCourante(semaines, todayISO());
  // Sélection obsolète (semaine retirée du stockage, ex. purge du foyer) :
  // repli sur la semaine du jour, jamais sur la 1re semaine stockée.
  const trouve =
    selection != null ? semaines.findIndex((w) => w.data.meta.semaine === selection) : -1;
  const idxAffiche = Math.min(Math.max(trouve >= 0 ? trouve : idx, 0), semaines.length - 1);
  const affichee = semaines[idxAffiche];
  if (!affichee) return null;

  if (profilOuvert) {
    return (
      <div className="main-content">
        <ProfilScreen
          profile={profile}
          syncEtat={syncEtat}
          cycle={numeroCycle(affichee.data.meta.semaine)}
          …
        />
      </div>
    );
  }

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/app.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx tests/app.test.tsx
git commit -m "feat: le Profil affiche le cycle de la semaine consultée (prop cycle)"
```

---

### Task 9: e2e adapté + portes unitaires + e2e complet

**Files:**
- Modify: `tests/e2e/onboarding-mobile.spec.ts:231-259+` (navigation tuiles)

- [ ] **Step 1: e2e — adapter les parcours Profil**

Dans `tests/e2e/onboarding-mobile.spec.ts`, les tests « profil : sections v2 sans débordement horizontal » et « profil : les champs maison & courses suivent le style guideline » ajoutent le clic tuile après l'ouverture :

```ts
    await page.getByRole('button', { name: 'Mon profil' }).click();
    await page.getByRole('button', { name: /Maison & courses/ }).click(); // tuile → page détail
```

Parcourir tous les `.click()` qui s'attendent à des champs profil et insérer l'insertion tuile correspondante (« Maison & courses », « Mes infos », « Objectif », « Notifications »). Exécuter `npx playwright test tests/e2e/onboarding-mobile.spec.ts` — zéro débordement horizontal (320/375) et styles guideline maintenus.

- [ ] **Step 2: Portes unitaires**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: vert (631+ tests, tsc, eslint, dist/)

- [ ] **Step 3: e2e complet**

Run: `npm run e2e`
Expected: `52+ passed (10s)` — zéro débordement horizontal sur 320/375

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/onboarding-mobile.spec.ts
git commit -m "test: e2e — parcours profil adapté aux tuiles du hub"
```

---

### Task 10: Docs, portes finales et Pull Request

**Files:**
- Modify: `AGENTS.md` (structure + import .md gardé)
- Modify: `CHANGELOG.md` (Ajouté/Modifié/Corrigé)

- [ ] **Step 1: AGENTS.md**

Dans la section « Structure », ajouter à la ligne des composants : `src/components/cuisine/` pour l'onglet Cuisine ; `onboarding/` pour le premier lancement — ajouter **`profil/` pour l'écran Profil (hub cards)** :

```
src/components/   # composants UI ; cuisine/ pour l'onglet Cuisine ; onboarding/ pour le premier lancement ; profil/ pour l'écran Profil (hub cards)
```

Dans le paragraphe « Le projet », remplacer « L'import .md est retiré de l'UI pour l'instant — il reviendra avec une convention template. » par « L'import .md reste branché dans le hub Profil (action « Importer un cycle (.md) ») — il sera redressé avec la future convention « template ». »

Dans « Storage », ajouter la clé (déjà présente) — vérifier `sportapp:selection` documentée (PR #30, rien à faire).

Dans « Le contrat .md (ne pas casser) » — rien à changer (aucun changement du contrat).

- [ ] **Step 2: CHANGELOG.md — sous [Non publié]**

```markdown
### Ajouté

- Profil hub v5 : `ProfilScreen` devient une vue générale courte sur canvas crème — en-tête compte (initiale + prénom + chip « ● Duo connecté / Local · Cycle N »), 4 tuiles cards (Objectif, Mes infos, Maison & courses, Notifications) avec résumé d'état sous le titre, actions directes (changer de profil, copier le prompt IA, foyer, import du cycle). Chaque tuile ouvre une page détail dédiée (retour ‹ Profil) — la page Objectif regroupe le cap complet (type, poids objectif, échéance, régime, compléments), les formulaires respirent, plus de scroll interminable. Le raccourci « Déconnecter le foyer » disparaît du hub (dans la page Foyer, un seul câblage). Tuile Notifications silencieuse sans support SW.
```

- [ ] **Step 3: Portes finales**

Run: `npm test && npm run typecheck && npm run lint && npm run build && npm run e2e`
Expected: tout vert

- [ ] **Step 4: Pull Request**

```bash
git push -u origin feat/profil-hub-v5
gh pr create --title "feat: profil hub v5 (cards)" --body "Spéc : docs/superpowers/specs/2026-09-24-profil-hub-v5-design.md. ProfilScreen (11 sections, 835 lignes) devient un hub canvas crème : en-tête compte + 4 tuiles cards + actions + page Foyer ; résumés purs dans src/lib/resumes.ts. Aucune migration storage/sync."
```

CI PR (`.github/workflows/ci.yml`) verte → merge (merge-commit, comme #27-#30).
