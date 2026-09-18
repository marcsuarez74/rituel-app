# UX v1.4 — Vague 1 « En-tête, navigation et suivi » — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bannière compacte validée (chevrons toujours visibles, titre « Semaine 37 », pill menu brute, chip Duo/Local, changeur de semaine) + icônes alignées + carte héro Suivi à anneau ProgressRing (bourgeon citron), en remplaçant ObjectifBloc + StatCards.

**Architecture:** Tout est affichage : aucune migration storage. Le libellé court de semaine vit dans `lib/dates.ts`, la progression poids migre de `ObjectifBloc` vers `lib/stats.ts` (testable sans React), deux nouveaux composants (`ProgressRing`, `SemaineSwitcher`), un composant fusionné (`SuiviHero`). Les ids de coches et le contrat .md ne bougent pas.

**Tech Stack:** React 18 + TS strict, CSS sémantique tokenisé (`--fs-*`, `--sp-*`, `--lh-*`, garde-fou `tests/css-tokens.test.ts`), vitest + Testing Library, Playwright (320/375 px, zéro débordement).

**Spec:** `docs/superpowers/specs/2026-09-18-refonte-ux-v14-design.md` (§1 bannière, §5 suivi, §6 transverse). Écart assumé : le token `--accent-surface` de la spec devient `--citron-surface`/`--citron-line` (couleurs du traitement « pot citron » réellement utilisées) — la ligne correspondante de la spec est corrigée dans la PR docs.

**Étendue :** ce plan couvre la sous-partie « en-tête + suivi » de la vague 1. Cuisine (pot citron, budget fin de flow, Mes box épinglé), Profil hub et tuto feront l'objet d'un second plan (même spec, §2, §3, §4).

---

### Task 1: Libellé court de semaine (`lib/dates.ts`)

**Files:**
- Modify: `src/lib/dates.ts` (après `formatJourMoisCourt`, ligne ~45)
- Test: `tests/lib/dates.test.ts` (nouveau)

- [ ] **Step 1: Write the failing test**

Créer `tests/lib/dates.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { libelleSemaineCourt } from '../../src/lib/dates';

describe('libelleSemaineCourt', () => {
  it('tronque l\u2019année : 2026-S37 → Semaine 37', () => {
    expect(libelleSemaineCourt('2026-S37')).toBe('Semaine 37');
  });

  it('id sans année : S12 → Semaine 12', () => {
    expect(libelleSemaineCourt('S12')).toBe('Semaine 12');
  });

  it('id non conforme : ne crash pas, affiche l\u2019id', () => {
    expect(libelleSemaineCourt('bizarr')).toBe('Semaine bizarr');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/dates.test.ts`
Expected: FAIL — `libelleSemaineCourt` n'existe pas (erreur d'import).

- [ ] **Step 3: Write minimal implementation**

Dans `src/lib/dates.ts`, après `formatJourMoisCourt` :

```ts
// '2026-S37' -> 'Semaine 37' (bannière compacte : l'année est superflue à l'écran).
export const libelleSemaineCourt = (semaine: string): string => {
  const m = semaine.match(/S(\d+)$/);
  return m ? `Semaine ${m[1]}` : `Semaine ${semaine}`;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/dates.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.ts tests/lib/dates.test.ts
git commit -m "feat: libellé court de semaine (Semaine 37)"
```

---

### Task 2: Tokens citron dans le design system

**Files:**
- Modify: `src/index.css` (bloc `:root`, lignes 43-53)

- [ ] **Step 1: Add the tokens**

Après `--accent-2: #f2dc7b; /* citron */` (ligne 50), ajouter :

```css
  --citron-surface: #fdf6d8; /* fond des items « pot citron » (rituel) */
  --citron-line: #e3c94f; /* bordure des items « pot citron » (rituel) */
```

(Rien d'autre : le garde-fou `tests/css-tokens.test.ts` ne couvre pas les couleurs, aucune mise à jour de test.)

- [ ] **Step 2: Verify nothing breaks**

Run: `npx vitest run tests/css-tokens.test.ts`
Expected: PASS (le test ne référence pas ces tokens, il vérifie fs/lh/sp).

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: tokens citron (surface + ligne) pour le rituel"
```

---

### Task 3: WeekBanner v2 — bannière compacte validée

**Files:**
- Modify: `src/components/WeekBanner.tsx` (réécriture complète, 90 lignes)
- Modify: `src/index.css` (bloc bannière 213-286 ; bloc écran Profil 1996-2028 ; suppression `.sync-dot` 2575-2607)
- Test: `tests/components.test.tsx` (remplacer le `describe('WeekBanner')` lignes 1280-1310)

- [ ] **Step 1: Write the failing tests**

Dans `tests/components.test.tsx`, remplacer **tout** le bloc `describe('WeekBanner', …)` (1280-1310) par :

```tsx
describe('WeekBanner', () => {
  const meta = { semaine: '2026-S39', menu: 'A', du: '2026-09-21', au: '2026-09-27' };

  it('titre court « Semaine 39 » + dates + pill menu brute', () => {
    render(<WeekBanner meta={meta} onSwitcher={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Semaine 39');
    expect(screen.getByText('21/09 → 27/09')).toBeInTheDocument();
    expect(screen.getByText('A')).toHaveClass('menu-pill');
  });

  it('chevrons toujours visibles, désactivés aux bornes', () => {
    render(<WeekBanner meta={meta} />);
    expect(screen.getByRole('button', { name: 'Semaine précédente' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Semaine suivante' })).toBeDisabled();
  });

  it('navigue par chevrons quand les bornes le permettent', async () => {
    const user = userEvent.setup();
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(<WeekBanner meta={meta} onPrev={onPrev} onNext={onNext} hasPrev={false} hasNext />);
    expect(screen.getByRole('button', { name: 'Semaine précédente' })).toBeDisabled();
    const next = screen.getByRole('button', { name: 'Semaine suivante' });
    expect(next).toBeEnabled();
    await user.click(next);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('tap sur le titre ouvre le changeur de semaine', async () => {
    const user = userEvent.setup();
    const onSwitcher = vi.fn();
    render(<WeekBanner meta={meta} onSwitcher={onSwitcher} />);
    await user.click(screen.getByRole('button', { name: 'Semaine 39 — changer de semaine' }));
    expect(onSwitcher).toHaveBeenCalledTimes(1);
  });

  it('chip sync : « Local » hors foyer (tap = profil), « Duo » connecté (tap = resync)', async () => {
    const user = userEvent.setup();
    const onOpenProfile = vi.fn();
    const onSyncTap = vi.fn();
    const { rerender } = render(
      <WeekBanner meta={meta} syncEtat="off" onOpenProfile={onOpenProfile} onSyncTap={onSyncTap} />,
    );
    const chip = screen.getByRole('button', { name: 'Hors foyer — ouvrir le profil pour connecter' });
    expect(chip).toHaveTextContent('Local');
    await user.click(chip);
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
    expect(onSyncTap).not.toHaveBeenCalled();

    rerender(
      <WeekBanner meta={meta} syncEtat="sync" onOpenProfile={onOpenProfile} onSyncTap={onSyncTap} />,
    );
    const duo = screen.getByRole('button', { name: 'Duo — synchronisé, appuyer pour resynchroniser' });
    expect(duo).toHaveTextContent('Duo');
    await user.click(duo);
    expect(onSyncTap).toHaveBeenCalledTimes(1);
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components.test.tsx`
Expected: FAIL — « Semaine 39 » n'existe pas (l'h1 affiche « Semaine 2026-S39 »), chevrons absents, chip inexistante.

- [ ] **Step 3: Rewrite WeekBanner.tsx**

Remplacer tout `src/components/WeekBanner.tsx` par :

```tsx
import type { WeekMeta } from '../lib/model';
import type { SyncEtat } from '../lib/sync/engine';
import { formatDayMonth, libelleSemaineCourt } from '../lib/dates';
import { Icon } from './Icon';

const ETIQUETTES: Record<Exclude<SyncEtat, 'off' | 'hors-foyer'>, string> = {
  attente: 'Duo — synchronisation en cours',
  sync: 'Duo — synchronisé, appuyer pour resynchroniser',
  erreur: 'Duo — erreur, appuyer pour réessayer',
};

// Bannière compacte validée (maquette 2026-09-18) : chevrons toujours visibles
// (grisés aux bornes), titre court tappable = changeur de semaine, dates + pill
// menu, chip « Duo/Local » et avatar. ~56 px au lieu de ~120.
export function WeekBanner({
  meta,
  onOpenProfile,
  onSwitcher,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  syncEtat,
  onSyncTap,
}: {
  meta: WeekMeta;
  onOpenProfile?: () => void;
  onSwitcher?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  syncEtat?: SyncEtat;
  onSyncTap?: () => void;
}) {
  const foyer = !!syncEtat && syncEtat !== 'off' && syncEtat !== 'hors-foyer';
  return (
    <header className="week-banner">
      <button
        type="button"
        className="banner-nav"
        aria-label="Semaine précédente"
        onClick={onPrev}
        disabled={!onPrev || !hasPrev}
      >
        <Icon name="chev-left" size={16} />
      </button>
      <div className="week-banner-main">
        <h1 className="week-title">
          <button
            type="button"
            className="week-head"
            onClick={onSwitcher}
            disabled={!onSwitcher}
            aria-label={`${libelleSemaineCourt(meta.semaine)} — changer de semaine`}
          >
            {libelleSemaineCourt(meta.semaine)}
          </button>
        </h1>
        <div className="week-dates-row">
          <span className="week-dates">
            {formatDayMonth(meta.du)} → {formatDayMonth(meta.au)}
          </span>
          <span className="menu-pill">{meta.menu}</span>
        </div>
        {meta.titre && <p className="muted week-titre-md">{meta.titre}</p>}
      </div>
      <button
        type="button"
        className="banner-nav"
        aria-label="Semaine suivante"
        onClick={onNext}
        disabled={!onNext || !hasNext}
      >
        <Icon name="chev-right" size={16} />
      </button>
      <button
        type="button"
        className={`sync-chip ${foyer ? `sync-chip-${syncEtat}` : 'sync-chip-local'}`}
        aria-label={foyer ? ETIQUETTES[syncEtat!] : 'Hors foyer — ouvrir le profil pour connecter'}
        onClick={foyer ? onSyncTap : onOpenProfile}
      >
        <span className="sync-chip-dot" aria-hidden="true" />
        {foyer ? 'Duo' : 'Local'}
      </button>
      {onOpenProfile && (
        <button type="button" className="profile-icon-btn" aria-label="Mon profil" onClick={onOpenProfile}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <circle cx="12" cy="8" r="4" fill="currentColor" />
            <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor" />
          </svg>
        </button>
      )}
    </header>
  );
}
```

- [ ] **Step 4: Rewrite the banner CSS**

Dans `src/index.css`, remplacer le bloc lignes **213-286** (`.week-banner` … `.menu-pill`) par :

```css
.week-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-12);
}

.week-banner p {
  margin: var(--sp-2) 0;
  font-size: var(--fs-sec);
}

.week-banner-main {
  flex: 1;
  min-width: 0;
}

/* Titre = bouton : tap = changeur de semaine. Zones 48 px via min-height. */
.week-head {
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  padding: var(--sp-4) 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 700;
  letter-spacing: 0.01em;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.2s;
}

.week-head:disabled {
  cursor: default;
  opacity: 1;
}

.week-title {
  margin: 0;
  font-size: var(--fs-h2);
  font-weight: 700;
  line-height: var(--lh-tight);
  min-width: 0;
}

.week-dates-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-6);
}

.week-dates {
  font-size: var(--fs-meta);
  color: var(--muted);
}

.week-titre-md {
  font-size: var(--fs-meta);
}

.menu-pill {
  flex-shrink: 0;
  padding: var(--sp-4) var(--sp-12);
  background: var(--accent);
  color: #ffffff;
  border-radius: 999px;
  font-size: var(--fs-meta);
  font-weight: 700;
  box-shadow: 0 3px 10px color-mix(in srgb, var(--accent) 35%, transparent);
}
```

- [ ] **Step 5: Update the Profil-screen banner CSS**

Dans le bloc « Écran Profil » (lignes 1996-2028) : remplacer `.week-banner { … }` (1998-2003, doublon) et `.week-banner-actions { … }` (2005-2010) par rien (suppression), garder `.profile-icon-btn` tel quel. Résultat attendu dans cette zone : le commentaire `/* ---------- Écran Profil ---------- */` suivi directement de `.profile-icon-btn`.

- [ ] **Step 6: Replace .sync-dot with .sync-chip**

Supprimer le bloc `.sync-dot` complet (lignes 2575-2607, jusqu'à `.sync-dot:active` inclus) et le remplacer par :

```css
/* ---------- Chip foyer (bannière) ---------- */

.sync-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-6);
  min-height: 48px;
  padding: var(--sp-10) var(--sp-14);
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font: 600 var(--fs-meta) Poppins, sans-serif;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.sync-chip-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--muted);
}

.sync-chip-sync,
.sync-chip-attente {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
}

.sync-chip-sync .sync-chip-dot,
.sync-chip-attente .sync-chip-dot {
  background: var(--accent);
}

.sync-chip-erreur {
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 35%, var(--border));
}

.sync-chip-erreur .sync-chip-dot {
  background: var(--danger);
}

.sync-chip:active {
  background: var(--surface-2);
}
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run tests/components.test.tsx tests/css-tokens.test.ts`
Expected: WeekBanner PASS (5), css-tokens PASS. D'autres fichiers échouent encore sur les libellés (« Semaine 2026-S37 ») — corrigés au Task 4.

- [ ] **Step 8: Commit**

```bash
git add src/components/WeekBanner.tsx src/index.css tests/components.test.tsx
git commit -m "feat: bannière compacte (chevrons visibles, titre court, chip Duo/Local)"
```

---

### Task 4: Balayage des libellés de semaine dans les tests

**Files:**
- Modify: `tests/app.test.tsx` (lignes 173, 186, 225, 252-257, 323, 360, 457, 460, 465, 477)
- Modify: `tests/sync/ui.test.tsx` (ligne 71)
- Modify: `tests/e2e/onboarding-mobile.spec.ts` (110, 114, 151, 154)
- Modify: `tests/e2e/cuisine.spec.ts` (commentaire 5 + assertions 68, 69-70, 75, 136, 190, 230)
- Modify: `tests/e2e/import-navigation.spec.ts` (41, 59, 70)
- Modify: `tests/e2e/dock.spec.ts` (32, 55)
- Modify: `tests/e2e/suivi-objectif.spec.ts` (49, 73)

- [ ] **Step 1: Replace week labels**

Le h1 affiche désormais « Semaine 37 » (pas « Semaine 2026-S37 ») et la pill affiche `meta.menu` brut (pas « Menu A »). Appliquer :

```bash
rg -l "Semaine 2026-S" tests/ | xargs perl -pi -e 's/Semaine 2026-S(\d+)/Semaine $1/g'
rg -l "'Menu A'|'Menu Z'" tests/ | xargs perl -pi -e "s/'Menu A'/'A'/g; s/'Menu Z'/'Z'/g"
```

- [ ] **Step 2: Fix the pill-locator comment in cuisine.spec.ts**

Ligne 5, le commentaire cite « Semaine 2026-S37 » — le remplacer par « Semaine 37 » (le perl du step 1 l'a déjà fait s'il matchait ; vérifier la lisibilité de la phrase).

- [ ] **Step 3: Run the whole unit suite**

Run: `npx vitest run`
Expected: PASS intégral (528+ tests) — les seules échecs restants seraient un libellé oublié, à corriger au cas par cas avec la même règle.

- [ ] **Step 4: Commit**

```bash
git add tests/
git commit -m "test: libellés de bannière courts (Semaine 37, pill brute)"
```

---

### Task 5: SemaineSwitcher (changeur de semaine)

**Files:**
- Create: `src/components/SemaineSwitcher.tsx`
- Modify: `src/App.tsx` (état + wiring, lignes 145-177)
- Modify: `src/index.css` (nouveau bloc, après la section bannière)
- Test: `tests/components.test.tsx` (nouveau describe après WeekBanner)

- [ ] **Step 1: Write the failing test**

Ajouter dans `tests/components.test.tsx` (le fichier importe déjà `parseWeeklyFile`, `mdSemaine`, `userEvent`, `vi` — vérifier l'import de `parseWeeklyFile` en tête de fichier, l'ajouter sinon) :

```tsx
describe('SemaineSwitcher', () => {
  const semaine = (id: string, du: string, au: string, menu = 'A') => {
    const raw = mdSemaine(id, du, au, menu);
    return { raw, data: parseWeeklyFile(raw).data, importedAt: '' };
  };
  const semaines = [
    semaine('2026-S37', '2026-09-07', '2026-09-13', 'A'),
    semaine('2026-S38', '2026-09-14', '2026-09-20', 'B'),
  ];

  it('liste les semaines, marque l\u2019active, sélectionne au clic', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SemaineSwitcher semaines={semaines} active="2026-S38" onSelect={onSelect} onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Choisir une semaine' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Semaine 37/ })).toBeInTheDocument();
    const active = screen.getByRole('button', { name: /Semaine 38/ });
    expect(active).toHaveClass('actif');
    await user.click(active);
    expect(onSelect).toHaveBeenCalledWith('2026-S38');
  });
});
```

Et ajouter l'import en tête de fichier : `import { SemaineSwitcher } from '../src/components/SemaineSwitcher';`

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components.test.tsx`
Expected: FAIL — module `SemaineSwitcher` introuvable.

- [ ] **Step 3: Create SemaineSwitcher.tsx**

```tsx
import type { ImportedWeek } from '../lib/model';
import { formatDayMonth, libelleSemaineCourt } from '../lib/dates';

// Changeur de semaine (bannière compacte) : bottom sheet listant les semaines
// du stock, la courante marquée. Tap sur le voile = fermer.
export function SemaineSwitcher({
  semaines,
  active,
  onSelect,
  onClose,
}: {
  semaines: ImportedWeek[];
  active: string;
  onSelect: (semaine: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="switcher-veil" onClick={onClose}>
      <div
        className="switcher-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Choisir une semaine"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="switcher-titre">Choisir une semaine</p>
        <ul className="switcher-list">
          {semaines.map((s) => {
            const id = s.data.meta.semaine;
            return (
              <li key={id}>
                <button
                  type="button"
                  className={id === active ? 'switcher-item actif' : 'switcher-item'}
                  aria-current={id === active ? 'true' : undefined}
                  onClick={() => onSelect(id)}
                >
                  <b>{libelleSemaineCourt(id)}</b>
                  <span className="switcher-dates">
                    {formatDayMonth(s.data.meta.du)} → {formatDayMonth(s.data.meta.au)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add the CSS**

Dans `src/index.css`, après la section bannière (après `.menu-pill`) :

```css
/* ---------- Changeur de semaine ---------- */

.switcher-veil {
  position: fixed;
  inset: 0;
  background: rgb(38 49 43 / 0.35);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 60;
}

.switcher-sheet {
  width: 100%;
  max-width: 420px;
  max-height: 70vh;
  overflow-y: auto;
  background: var(--surface);
  border-radius: 20px 20px 0 0;
  padding: var(--sp-16) var(--sp-16) var(--sp-24);
}

.switcher-titre {
  margin: 0 0 var(--sp-10);
  font-size: var(--fs-h3);
  font-weight: 700;
  color: var(--text);
}

.switcher-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-6);
}

.switcher-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-10);
  min-height: 48px;
  padding: var(--sp-10) var(--sp-12);
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: var(--fs-sec);
  cursor: pointer;
  text-align: left;
  transition: background 0.2s, border-color 0.2s;
}

.switcher-item .switcher-dates {
  font-size: var(--fs-meta);
  color: var(--muted);
}

.switcher-item.actif {
  border-color: var(--accent);
  background: #eef4ec;
  font-weight: 600;
}
```

- [ ] **Step 5: Wire App.tsx**

Dans `src/App.tsx` :

1. Import : `import { SemaineSwitcher } from './components/SemaineSwitcher';`
2. État : `const [switcherOuvert, setSwitcherOuvert] = useState(false);` (après `profilOuvert`)
3. Remplacer le bloc `<WeekBanner …>` (lignes 157-177) par :

```tsx
      <WeekBanner
        meta={affichee.data.meta}
        onOpenProfile={() => setProfilOuvert(true)}
        onSwitcher={() => setSwitcherOuvert(true)}
        syncEtat={syncEtat}
        onSyncTap={() => ressynchroniser()}
        onPrev={() => setSelection(semaines[Math.max(0, idxAffiche - 1)].data.meta.semaine)}
        onNext={() =>
          setSelection(semaines[Math.min(semaines.length - 1, idxAffiche + 1)].data.meta.semaine)
        }
        hasPrev={idxAffiche > 0}
        hasNext={idxAffiche < semaines.length - 1}
      />
      {switcherOuvert && (
        <SemaineSwitcher
          semaines={semaines}
          active={affichee.data.meta.semaine}
          onSelect={(id) => {
            setSelection(id);
            setSwitcherOuvert(false);
          }}
          onClose={() => setSwitcherOuvert(false)}
        />
      )}
```

4. Supprimer la ligne `const navigable = semaines.length > 1;` (ligne 146) — les chevrons sont toujours rendus, les bornes gèrent l'état.

- [ ] **Step 6: Run tests**

Run: `npx vitest run`
Expected: PASS intégral.

- [ ] **Step 7: Commit**

```bash
git add src/components/SemaineSwitcher.tsx src/App.tsx src/index.css tests/components.test.tsx
git commit -m "feat: changeur de semaine en bottom sheet"
```

---

### Task 6: Icônes alignées (« ← Retour » etc.)

**Files:**
- Modify: `src/components/ProfilScreen.tsx` (bouton `.profil-back`, ligne ~328-330)
- Modify: `src/index.css` (`.profil-back` 2030-2042)

- [ ] **Step 1: Fix the ProfilScreen back button**

Le bouton actuel rend « ← Retour » en texte brut (flèche caractère, mal alignée). Dans `ProfilScreen.tsx`, remplacer le bouton par :

```tsx
        <button type="button" className="profil-back" onClick={onBack}>
          <Icon name="chev-left" size={16} />
          Retour
        </button>
```

(`Icon` est déjà importé dans ProfilScreen — vérifier, l'ajouter sinon : `import { Icon } from './Icon';`)

- [ ] **Step 2: Fix the CSS**

Remplacer `.profil-back { … }` (2030-2042) par :

```css
.profil-back {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-6);
  min-height: 48px;
  padding: var(--sp-10) 0;
  margin-bottom: var(--sp-4);
  border: none;
  background: none;
  color: var(--text);
  font: inherit;
  font-size: var(--fs-sec);
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
```

- [ ] **Step 3: Audit the other icon+text pairs**

Vérifier (grep) que ces règles existent et sont `inline-flex` alignées — les corriger sur le même modèle si une diverge :

```bash
rg -n "obj-echeance|stat-label|profil-back" src/index.css
```

`.obj-echeance` et `.stat-label` sont réécrites au Task 9 avec le modèle flex — rien à faire ici si elles existent encore.

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run tests/components.test.tsx`
Expected: PASS (aucun test n'assert le libellé exact « ← Retour » ; si un test casse, il assert le nom accessible — mettre à jour vers « Retour »).

```bash
git add src/components/ProfilScreen.tsx src/index.css
git commit -m "fix: alignement icône/texte du bouton Retour"
```

---

### Task 7: `progressionPoids` dans `lib/stats.ts`

**Files:**
- Modify: `src/lib/stats.ts` (export à la fin)
- Test: `tests/lib/stats.test.ts` (nouveau)

- [ ] **Step 1: Write the failing test**

Créer `tests/lib/stats.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { progressionPoids } from '../../src/lib/stats';

describe('progressionPoids', () => {
  it('perte : 82,8 → 78,4 vers 74 = 50 %, 4,4 kg restants', () => {
    const r = progressionPoids('perte', 82.8, 78.4, 74);
    expect(r).toEqual({ pct: 50, kgRestant: 4.4, sens: 'restants' });
  });

  it('masse : sens inversé, kg à prendre', () => {
    const r = progressionPoids('masse', 74, 75.8, 82);
    expect(r?.pct).toBe(22.5);
    expect(r?.sens).toBe('à prendre');
  });

  it('total nul (cible = départ) : null (fallback poids simple)', () => {
    expect(progressionPoids('perte', 78, 78.4, 78)).toBeNull();
  });

  it('clamp 0-100 : déjà sous la cible = 100', () => {
    const r = progressionPoids('perte', 82.8, 73, 74);
    expect(r?.pct).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/stats.test.ts`
Expected: FAIL — `progressionPoids` n'existe pas.

- [ ] **Step 3: Implement in lib/stats.ts**

À la fin de `src/lib/stats.ts` :

```ts
// Progression perte/masse (carte héro) : départ = 1re pesée, actuel = dernière.
// Arrondi au dixième : 4,4/8,8 en flottant donnerait 49,999… % sans lui.
export function progressionPoids(
  type: 'perte' | 'masse',
  depart: number,
  actuel: number,
  cible: number,
): { pct: number; kgRestant: number; sens: string } | null {
  const total = type === 'perte' ? depart - cible : cible - depart;
  if (total <= 0) return null;
  const fait = type === 'perte' ? depart - actuel : actuel - depart;
  const pct = Math.min(100, Math.max(0, Math.round((fait / total) * 1000) / 10));
  const kgRestant = type === 'perte' ? actuel - cible : cible - actuel;
  return { pct, kgRestant, sens: type === 'perte' ? 'restants' : 'à prendre' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/stats.test.ts`
Expected: PASS (4 tests). (Vérifier `22.5` pour masse : fait 1,8 / total 8 = 22,5 ✓.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats.ts tests/lib/stats.test.ts
git commit -m "feat: progressionPoids dans lib/stats (héro suivi)"
```

---

### Task 8: Composant `ProgressRing` (anneau bourgeon)

**Files:**
- Create: `src/components/ProgressRing.tsx`
- Modify: `src/index.css` (nouveau bloc, après la section changeur de semaine)
- Test: `tests/components.test.tsx` (nouveau describe)

- [ ] **Step 1: Write the failing tests**

Dans `tests/components.test.tsx` :

```tsx
describe('ProgressRing', () => {
  it('50 % : arc à mi-course, bourgeon en bas de l\u2019anneau', () => {
    const { container } = render(
      <ProgressRing progress={0.5} ariaLabel="Progression : 50 % de l'objectif">
        <b>-4,2</b>
      </ProgressRing>,
    );
    expect(screen.getByRole('img', { name: 'Progression : 50 % de l'objectif' })).toBeInTheDocument();
    const arc = container.querySelector('.ring-arc') as SVGCircleElement;
    expect(arc.getAttribute('stroke-dasharray')).toMatch(/^150\.79/);
    const bud = container.querySelector('.ring-bud') as SVGCircleElement;
    expect(bud.getAttribute('cy')).toBe('108'); // 60 + 48 (bas de l'anneau)
    expect(screen.getByText('-4,2')).toBeInTheDocument();
  });

  it('clamp 0-1 ; boucle fermée (≥ 98,5 %) : plus de bourgeon', () => {
    const { container } = render(
      <ProgressRing progress={2} ariaLabel="Progression : 100 % de l'objectif" />,
    );
    const arc = container.querySelector('.ring-arc') as SVGCircleElement;
    expect(arc.getAttribute('stroke-dasharray')).toMatch(/^301\.59/);
    expect(container.querySelector('.ring-bud')).toBeNull();
  });
});
```

Et l'import : `import { ProgressRing } from '../src/components/ProgressRing';`

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Create ProgressRing.tsx**

```tsx
import type { ReactNode } from 'react';

// Anneau « bourgeon » (maquette validée 2026-09-18) : piste, arc basilic à
// bouts arrondis, point citron en bout d'arc — il voyage le long de l'anneau
// à chaque pesée et disparaît à la boucle fermée. SVG maison, comme WeightChart.
export function ProgressRing({
  progress,
  children,
  ariaLabel,
}: {
  progress: number;
  children?: ReactNode;
  ariaLabel: string;
}) {
  const R = 48;
  const C = 2 * Math.PI * R;
  const p = Math.min(1, Math.max(0, progress));
  // Bourgeon : position angulaire depuis le haut, sens horaire (x = cx + r·sin, y = cy - r·cos).
  const angle = p * 2 * Math.PI;
  const bx = 60 + R * Math.sin(angle);
  const by = 60 - R * Math.cos(angle);
  const ferme = p > 0.985;
  return (
    <div className="progress-ring">
      <svg viewBox="0 0 120 120" role="img" aria-label={ariaLabel}>
        <circle cx="60" cy="60" r={R} className="ring-track" />
        <circle
          cx="60"
          cy="60"
          r={R}
          className="ring-arc"
          strokeDasharray={`${p * C} ${C}`}
          transform="rotate(-90 60 60)"
        />
        {!ferme && <circle cx={bx} cy={by} r="6.5" className="ring-bud" />}
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Add the CSS**

Dans `src/index.css`, après la section changeur de semaine :

```css
/* ---------- Anneau de progression (héro suivi) ---------- */

.progress-ring {
  position: relative;
  width: 118px;
  height: 118px;
  flex-shrink: 0;
}

.progress-ring svg {
  display: block;
  width: 100%;
  height: 100%;
}

.ring-track {
  fill: none;
  stroke: var(--surface-2);
  stroke-width: 9;
}

.ring-arc {
  fill: none;
  stroke: var(--accent);
  stroke-width: 9;
  stroke-linecap: round;
  transition: stroke-dasharray 0.4s;
}

.ring-bud {
  fill: var(--accent-2);
  stroke: var(--surface);
  stroke-width: 2.5;
}

.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  text-align: center;
}

.ring-center b {
  font-size: var(--fs-h2);
  color: var(--text);
  line-height: var(--lh-tight);
}

.ring-center small {
  font-size: var(--fs-micro);
  color: var(--muted);
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/components.test.tsx tests/css-tokens.test.ts`
Expected: PASS (les px de stroke/width ne sont pas dans le périmètre du garde-fou espacement).

- [ ] **Step 6: Commit**

```bash
git add src/components/ProgressRing.tsx src/index.css tests/components.test.tsx
git commit -m "feat: ProgressRing (anneau bourgeon citron)"
```

---

### Task 9: `SuiviHero` — fusion ObjectifBloc + StatCards

**Files:**
- Create: `src/components/SuiviHero.tsx`
- Delete: `src/components/ObjectifBloc.tsx`, `src/components/StatCards.tsx`
- Modify: `src/App.tsx` (imports + JSX du tab suivi, lignes 5-6, 184-187)
- Modify: `src/index.css` (nouveau bloc `.suivi-hero*` ; les classes `.obj-*`/`.stat-cards` orphelines peuvent rester en place — nettoyage limité aux blocs `.obj-bloc`, `.obj-pills`, `.obj-prog`, `.obj-plain`, `.stat-cards`, `.stat-card` si la suppression est triviale)
- Test: `tests/components.test.tsx` (remplacer les describes `StatCards` 957-1002 et `ObjectifBloc` 1004-1095)
- Modify: `tests/e2e/suivi-objectif.spec.ts` (sélecteurs `.obj-bloc`/`.stat-card-hero` → `.suivi-hero`)

- [ ] **Step 1: Write the failing tests**

Remplacer les deux describes (957-1095) par :

```tsx
describe('SuiviHero — carte héro objectif', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.setSystemTime(new Date('2026-09-09T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('perte avec pesées : anneau, kg restants, cible, échéance', () => {
    addWeight('marc', '2026-08-12', 82.8);
    addWeight('marc', '2026-09-07', 79.1);
    addWeight('marc', '2026-09-09', 78.4);
    render(<SuiviHero profile={profileV2('marc', { poidsObjectif: 74 })} />);

    expect(
      screen.getByRole('img', { name: 'Progression : 50 % de l'objectif' }),
    ).toBeInTheDocument();
    expect(screen.getByText('4,4')).toBeInTheDocument();
    expect(screen.getByText('kg restants')).toBeInTheDocument();
    expect(screen.getByText(/Cible 74,0 kg/)).toBeInTheDocument();
    expect(screen.getByText(/Échéance :/)).toHaveTextContent('15 déc. · dans 97 jours');
  });

  it('échéance dépassée : mention « dépassée » et classe late', () => {
    render(
      <SuiviHero
        profile={profileV2('marc', { poidsObjectif: 74, objectif: { type: 'perte', echeance: '2026-06-15' } })}
      />,
    );
    expect(screen.getByText(/dépassée/)).toBeInTheDocument();
    expect(document.querySelector('.suivi-hero-echeance')).toHaveClass('late');
  });

  it('sans échéance, pas de ligne échéance', () => {
    render(
      <SuiviHero profile={profileV2('marc', { poidsObjectif: 74, objectif: { type: 'perte' } })} />,
    );
    expect(screen.queryByText(/Échéance :/)).not.toBeInTheDocument();
  });

  it('masse : kg à prendre', () => {
    addWeight('marc', '2026-08-12', 74);
    addWeight('marc', '2026-09-09', 75.8);
    render(
      <SuiviHero
        profile={profileV2('marc', { poidsObjectif: 82, objectif: { type: 'masse' } })}
      />,
    );
    expect(screen.getByText(/6,2/)).toBeInTheDocument();
    expect(screen.getByText('kg à prendre')).toBeInTheDocument();
  });

  it('maintien : pas d\u2019anneau, poids actuel à la place', () => {
    addWeight('marc', '2026-09-09', 78.4);
    render(
      <SuiviHero
        profile={profileV2('marc', { poidsObjectif: 74, objectif: { type: 'maintien' } })}
      />,
    );
    expect(screen.queryByRole('img', { name: /Progression/ })).not.toBeInTheDocument();
    expect(screen.getByText('78,4')).toBeInTheDocument();
    expect(screen.getByText(/Cible 74,0 kg/)).toBeInTheDocument();
  });

  it('sans pesée : tiret, aucun crash', () => {
    render(<SuiviHero profile={profileV2('melanie')} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('delta 7 j : bon dans le sens de l objectif, alerte à contre-sens, neutre sans cible', () => {
    addWeight('marc', '2026-09-02', 78);
    addWeight('marc', '2026-09-08', 77.4);
    const { unmount } = render(<SuiviHero profile={profileV2('marc', { poidsObjectif: 70 })} />);
    expect(screen.getByText(/-0,6 kg/)).toHaveClass('stat-delta-bon');
    unmount();

    addWeight('marc', '2026-09-02', 78);
    addWeight('marc', '2026-09-08', 78.5);
    const { unmount: unmount2 } = render(
      <SuiviHero profile={profileV2('marc', { poidsObjectif: 70 })} />,
    );
    expect(screen.getByText(/\+0,5 kg/)).toHaveClass('stat-delta-alerte');
    unmount2();

    render(<SuiviHero profile={profileV2('marc')} />);
    expect(screen.getByText(/-0,6 kg/)).toHaveClass('stat-delta-neutre');
  });

  it('chips : régime (sauf aucun) + compteur de compléments', () => {
    render(<SuiviHero profile={profileV2('marc', { complements: ['Whey', 'Zinc'], regime: 'keto' })} />);
    expect(screen.getByText('Keto')).toBeInTheDocument();
    expect(screen.getByText('2 compléments')).toBeInTheDocument();

    render(<SuiviHero profile={profileV2('melanie', { regime: 'aucun' })} />);
    expect(screen.queryByText(/Aucun/)).not.toBeInTheDocument();
    expect(screen.queryByText(/complément/)).not.toBeInTheDocument();
  });
});
```

Et l'import : `import { SuiviHero } from '../src/components/SuiviHero';` — puis supprimer les imports `StatCards`/`ObjectifBloc` (lignes 18-19).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components.test.tsx`
Expected: FAIL — module `SuiviHero` introuvable.

- [ ] **Step 3: Create SuiviHero.tsx**

```tsx
import { useState } from 'react';
import { OBJECTIF_TYPES } from '../lib/model';
import type { UserProfile } from '../lib/model';
import { formatJourMoisCourt, joursRestants } from '../lib/dates';
import { fmtKg } from '../lib/text';
import { getWeights } from '../lib/storage';
import { poidsActuel, progressionPoids, variationKg7j } from '../lib/stats';
import { ProgressRing } from './ProgressRing';
import { Icon } from './Icon';

// Carte héro du suivi (spec v1.4 §5) : ObjectifBloc + StatCards fusionnés.
// Anneau ProgressRing quand perte/masse avec cible + pesées, poids simple sinon.
export function SuiviHero({ profile }: { profile: UserProfile }) {
  // Invariant : le profil actif ne change jamais en place — un changement passe
  // par removeProfile → Onboarding, qui démonte tout le sous-arbre suivi. Côté
  // App, la clé `hero-${weightsBump}` remonte le composant à l'ajout d'une pesée.
  const [weights] = useState(() => getWeights(profile.id));

  const type = OBJECTIF_TYPES.find((t) => t.id === profile.objectif.type)!;
  const actuel = poidsActuel(weights);
  const depart = weights.length > 0 ? weights[0] : null;
  const cible = profile.poidsObjectif;

  const calc =
    (profile.objectif.type === 'perte' || profile.objectif.type === 'masse') &&
    cible != null &&
    depart &&
    actuel
      ? progressionPoids(profile.objectif.type, depart.kg, actuel.kg, cible)
      : null;

  // La variation est « bonne » si elle va dans le sens de l'objectif.
  let delta: { texte: string; classe: string } | null = null;
  if (actuel && variationKg7j(weights) != null) {
    const variation = variationKg7j(weights)!;
    const kg = fmtKg(Math.abs(variation));
    const fleche = variation < 0 ? '▼' : '▲';
    let classe = 'stat-delta-neutre';
    if (cible != null) {
      const perte = cible < actuel.kg;
      classe = (variation < 0) === perte ? 'stat-delta-bon' : 'stat-delta-alerte';
    }
    delta = { texte: `${fleche} ${variation < 0 ? '-' : '+'}${kg} kg`, classe };
  }

  const echeance = profile.objectif.echeance;
  const restants = echeance ? joursRestants(echeance) : null;

  return (
    <section className="suivi-hero" aria-label="Mon objectif">
      <div className="suivi-hero-main">
        {calc && cible != null ? (
          <ProgressRing
            progress={calc.pct / 100}
            ariaLabel={`Progression : ${calc.pct} % de l'objectif`}
          >
            <b>{fmtKg(Math.abs(calc.kgRestant))}</b>
            <small>kg {calc.sens}</small>
          </ProgressRing>
        ) : (
          <div className="suivi-hero-poids" role="img" aria-label="Poids actuel">
            <Icon name="scale" size={22} />
            <b>{actuel ? fmtKg(actuel.kg) : '—'}</b>
            <small>kg</small>
          </div>
        )}
        <div className="suivi-hero-info">
          <span className="suivi-hero-label">
            <Icon name={type.icone} size={14} /> Objectif · {type.nom}
          </span>
          {cible != null && <b className="suivi-hero-cible">Cible {fmtKg(cible)} kg</b>}
          {delta && (
            <span className={`stat-delta ${delta.classe}`}>
              {delta.texte}
              <small>vs 7 jours</small>
            </span>
          )}
          {echeance && restants != null && (
            <p className={`suivi-hero-echeance${restants < 0 ? ' late' : ''}`}>
              <Icon name="clock" size={14} /> Échéance : <b>{formatJourMoisCourt(echeance)}</b> ·{' '}
              <b>
                {restants > 0
                  ? `dans ${restants} jours`
                  : restants === 0
                    ? "aujourd'hui"
                    : 'dépassée'}
              </b>
            </p>
          )}
        </div>
      </div>
      {(profile.regime !== 'aucun' || profile.complements.length > 0) && (
        <div className="suivi-hero-chips">
          {profile.regime !== 'aucun' && <span className="cchip">{regimeNom(profile)}</span>}
          {profile.complements.length > 0 && (
            <span className="cchip">
              {profile.complements.length} complément{profile.complements.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

const REGIMES = Object.fromEntries(REGIMES_LIST.map((r) => [r.id, r.nom])) as Record<string, string>;
function regimeNom(profile: UserProfile): string {
  return REGIMES[profile.regime] ?? profile.regime;
}
```

Avec en tête `import { OBJECTIF_TYPES, REGIMES as REGIMES_LIST } from '../lib/model';` (l'alias évite le conflit avec la const locale). **Variante plus simple recommandée :** garder l'import `REGIMES` direct et utiliser `REGIMES.find((r) => r.id === profile.regime)!.nom` inline dans la chip (comme l'ancien ObjectifBloc), en supprimant la const `REGIMES` locale et la fonction `regimeNom` — c'est la forme à privilégier.

- [ ] **Step 4: Add the CSS**

Dans `src/index.css`, après la section ProgressRing :

```css
/* ---------- Suivi : carte héro ---------- */

.suivi-hero {
  background: var(--surface);
  border-radius: var(--radius);
  padding: var(--sp-16);
  box-shadow: var(--shadow);
  margin-bottom: var(--sp-16);
}

.suivi-hero-main {
  display: flex;
  align-items: center;
  gap: var(--sp-16);
}

.suivi-hero-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-6);
}

.suivi-hero-label {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-6);
  font-size: var(--fs-meta);
  color: var(--muted);
}

.suivi-hero-cible {
  font-size: var(--fs-h2);
  color: var(--text);
}

.suivi-hero-echeance {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-6);
  margin: 0;
  font-size: var(--fs-meta);
  color: var(--muted);
}

.suivi-hero-echeance.late {
  color: var(--danger);
}

.suivi-hero-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-6);
  margin-top: var(--sp-12);
}

.suivi-hero-poids {
  width: 118px;
  height: 118px;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--surface-2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  color: var(--muted);
}

.suivi-hero-poids b {
  font-size: var(--fs-h2);
  color: var(--text);
}
```

- [ ] **Step 5: Wire App.tsx and delete old components**

Dans `src/App.tsx` :
1. Supprimer les imports `StatCards` et `ObjectifBloc` (lignes 5-6), ajouter `import { SuiviHero } from './components/SuiviHero';`
2. Remplacer (lignes 186-187) :

```tsx
            <ObjectifBloc key={`obj-${weightsBump}-${syncVersion}`} profile={profile} />
            <StatCards key={weightsBump + syncVersion} profile={profile} />
```

par :

```tsx
            <SuiviHero key={`hero-${weightsBump}-${syncVersion}`} profile={profile} />
```

Puis : `git rm src/components/ObjectifBloc.tsx src/components/StatCards.tsx`

- [ ] **Step 6: Update the e2e spec**

Dans `tests/e2e/suivi-objectif.spec.ts` :
1. Ligne 52 : `.obj-bloc` → `.suivi-hero`
2. Lignes 54-57 : garder les assertions texte (`Perte de poids`, `Keto`, `Échéance :`, `restants` — tous présents dans SuiviHero)
3. Lignes 59-62 : remplacer `.stat-card-hero` par :

```ts
    await expect(page.locator('.suivi-hero')).toContainText('vs 7 jours');
    await expect(page.getByText('Kcal du jour')).toHaveCount(0);
```

4. Ligne 79 : `.obj-bloc` → `.suivi-hero`

- [ ] **Step 7: Run the whole suite**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: PASS intégral (528+).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: carte héro suivi (ProgressRing) fusionne objectif + poids"
```

---

### Task 10: Gates et e2e

- [ ] **Step 1: Full unit gates**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: tout PASS, build avec `sw.js` + `manifest.webmanifest` dans `dist/`.

- [ ] **Step 2: e2e (mobile 375 + 320)**

Run: `npm run e2e`
Expected: 48/48 PASS (les libellés ont été mis à jour au Task 4/9). Si un débordement apparaît sur la bannière à 320 : la ligne `week-dates-row` passe à la ligne suivante via `flex-wrap` — vérifier `scrollWidth <= clientWidth`.

- [ ] **Step 3: Commit final (si restes) + résumé**

Tout doit déjà être committé tâche par tâche. Vérifier : `git status` propre.

---

## Auto-revue (exécutée à l'écriture du plan)

- **Spec coverage §1** : chevrons toujours visibles (T3), titre court + tap = changeur (T1/T3/T5), gap 12 px (CSS `.week-banner` gap `--sp-12` inchangé), chip Duo/Local tappable (T3), pill Cycle = `meta.menu` brut (T3), avatar via svg inline existant conservé (T3) ✓. **§5** : anneau caps arrondis + bourgeon voyageur + boucle fermée (T8), héro fusionné avec delta/échéance/chips (T9), ligne « Départ » doublée supprimée (T9), pesées/graphe intacts (aucune modification) ✓. **§6** : icônes alignées (T6), tokens citron (T2 — écart `--accent-surface` documenté en tête), citron = rituel (T2, utilisé en vague cuisine) ✓.
- **Placeholders** : aucun « TBD » ; le seul point laissé à l'exécuteur (variante d'import `REGIMES` dans T9) est tranché par la recommandation explicite (forme inline).
- **Type consistency** : `progressionPoids` retourne `{ pct, kgRestant, sens } | null` — utilisé tel quel dans T9 ; `libelleSemaineCourt` (T1) utilisé dans T3 et T5 ; props `WeekBanner` (`onSwitcher`) cohérentes entre T3 et T5.
