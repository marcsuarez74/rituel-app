import { expect, test } from '@playwright/test';

const OVERFLOW_TOLERANCE = 1; // arrondis de sous-pixel
// Origine du localStorage : doit matcher la baseURL (dev 5173 ou preview 4173)
const ORIGIN = process.env.E2E_PREVIEW ? 'http://localhost:4173' : 'http://localhost:5173';

async function assertPasDeDebordement(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'la page ne doit pas scroller horizontalement').toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
}

// Guideline (ui-guideline.md « Ultra visible » + design-system.md « Champs ») :
// cible tactile ≥ 48px, fond du champ standard Marché var(--surface) #fffaf0,
// rayon organique var(--r-orga-2) — pas le rendu natif. (Aligné au design system
// 2026-10-12 : l'ancien contrat attendait le token Herbes --surface-2 + 12px.)
const CHAMP_FOND = 'rgb(255, 250, 240)'; // var(--surface) résolue
const CHAMP_RAYON = '18px 26px 20px 28px'; // var(--r-orga-2) résolue

async function assertStyleGuideline(page: import('@playwright/test').Page, label: string) {
  const champ = page.getByLabel(label);
  await expect(champ).toBeVisible();
  await champ.scrollIntoViewIfNeeded();
  const box = (await champ.boundingBox())!;
  expect(box.height, `${label} : cible tactile ≥ 48px`).toBeGreaterThanOrEqual(48);
  const style = await champ.evaluate((el) => {
    const s = getComputedStyle(el);
    return { fond: s.backgroundColor, rayon: s.borderRadius };
  });
  expect(style.fond, `${label} : fond champ standard Marché (surface)`).toBe(CHAMP_FOND);
  expect(style.rayon, `${label} : rayon organique du champ standard (r-orga-2)`).toBe(CHAMP_RAYON);
}

// Après « Ta semaine » (Passer), l'onboarding enchaîne sur Mon cycle (prompt à copier) ;
// « Plus tard » en sort vers l'app (cycle d'exemple).
async function passerTaSemaineEtMonCycle(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Passer' }).click();
  await expect(page.getByRole('heading', { name: 'Mes menus', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copier le prompt' })).toBeVisible();
  await page.getByRole('button', { name: 'Plus tard' }).click();
}

// Points allumés / total + libellé accessible de l'indicateur d'étapes.
async function stepper(page: import('@playwright/test').Page) {
  const g = page.getByRole('group', { name: /Progression/ });
  return {
    actifs: await g.locator('.onboarding-dot-active').count(),
    total: await g.locator('span[aria-hidden]').count(),
    texte: (await g.textContent()) ?? '',
  };
}

test.describe('Onboarding 5 étapes — mobile', () => {
  test('étape 2 : aucun débordement horizontal et champs dans le viewport', async ({ page }) => {
    const largeur = page.viewportSize()!.width;
    await page.goto('/');
    // document.fonts.ready fixe le layout avant les mesures (pattern dock.spec).
    await page.evaluate(() => document.fonts.ready);
    await page.getByLabel("Comment tu t'appelles ?").fill('Mélanie');
    await page.getByRole('radio', { name: /Suivre mon poids/ }).click();
    await page.getByRole('button', { name: /Continuer/ }).click();

    await expect(page.getByLabel('Date de naissance')).toBeVisible();
    await assertPasDeDebordement(page);

    for (const label of ['Date de naissance', 'Taille (cm)']) {
      const champ = page.getByLabel(label);
      await expect(champ).toBeVisible();
      const box = (await champ.boundingBox())!;
      expect(box.x, `${label} commence dans le viewport`).toBeGreaterThanOrEqual(0);
      expect(
        box.x + box.width,
        `${label} tient entièrement dans le viewport`,
      ).toBeLessThanOrEqual(largeur + OVERFLOW_TOLERANCE);
    }
  });

  test('étape 5 : les champs maison & courses suivent le style guideline', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.getByLabel("Comment tu t'appelles ?").fill('Mélanie');
    await page.getByRole('radio', { name: /Suivre mon poids/ }).click();
    await page.getByRole('button', { name: /Continuer/ }).click();

    await page.getByLabel('Poids (kg)').fill('62.4');
    await page.getByLabel('Date de naissance').fill('1987-03-02');
    await page.getByLabel('Taille (cm)').fill('165');
    await page.getByRole('button', { name: /Continuer/ }).click();
    await page.getByRole('radio', { name: /Affiner/ }).click();
    await page.getByRole('button', { name: /Continuer/ }).click();
    await page.getByRole('button', { name: /Continuer/ }).click();

    await expect(page.getByRole('heading', { name: /Maison & courses/ })).toBeVisible();
    await assertPasDeDebordement(page);
    for (const label of [
      'Budget max courses / semaine',
    ]) {
      await assertStyleGuideline(page, label);
    }
  });

  test('parcours complet : poids/date/taille → objectif → personnalisation → shell', async ({ page }) => {
    await page.goto('/');
    // document.fonts.ready fixe le layout avant les mesures (pattern dock.spec).
    await page.evaluate(() => document.fonts.ready);
    await page.getByLabel("Comment tu t'appelles ?").fill('Mélanie');
    await page.getByRole('radio', { name: /Suivre mon poids/ }).click();
    await page.getByRole('button', { name: /Continuer/ }).click();

    await page.getByLabel('Poids (kg)').fill('62.4');
    await page.getByLabel('Date de naissance').fill('1987-03-02');
    await page.getByLabel('Taille (cm)').fill('165');
    await assertPasDeDebordement(page);
    await page.getByRole('button', { name: /Continuer/ }).click();

    await expect(page.getByRole('heading', { name: /Ton objectif/ })).toBeVisible();
    await page.getByRole('radio', { name: /Affiner/ }).click();
    await page.getByRole('button', { name: /Continuer/ }).click();

    await expect(page.getByRole('heading', { name: /Personnalisation/ })).toBeVisible();
    await page.getByRole('button', { name: 'Créatine' }).click();
    await page.getByRole('radio', { name: 'Keto' }).click();
    await page.getByRole('button', { name: /Continuer/ }).click();

    await expect(page.getByRole('heading', { name: /Maison & courses/ })).toBeVisible();
    await assertPasDeDebordement(page);
    // Plusieurs magasins : le premier choisi est le principal.
    await page.getByRole('button', { name: 'Lidl', exact: true }).click();
    await page.getByRole('button', { name: 'Aldi', exact: true }).click();
    await page.getByLabel("Nom d'un autre magasin").fill('Marché');
    await page.getByRole('button', { name: 'Ajouter ce magasin' }).click();
    await expect(page.getByRole('button', { name: 'Marché', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await assertPasDeDebordement(page);
    await page.getByLabel('Budget max courses / semaine').fill('40');
    await page.getByRole('button', { name: /C'est parti/ }).click();

    // Build de prod avec sync compilée : l'étape 6 optionnelle s'intercale
    // — « Plus tard » poursuit ; sans sync, le shell arrive direct.
    const plusTard = page.getByRole('button', { name: 'Plus tard' });
    const shell = page.getByRole('navigation', { name: 'Navigation principale' });
    const taSemaine = page.getByRole('heading', { name: 'Ta semaine' });
    await plusTard.or(taSemaine).first().waitFor();
    if (await plusTard.isVisible()) await plusTard.click();
    // Étape optionnelle « Ta semaine » : on la passe ; l'onboarding arrive ensuite sur Mon cycle.
    await passerTaSemaineEtMonCycle(page);

    // Profil enregistré + cycle d'exemple auto-chargé → shell direct
    await expect(shell).toBeVisible();
    const profil = await page.evaluate(() => JSON.parse(localStorage.getItem('sportapp:profile')!));
    expect(profil).toEqual({
      id: expect.stringMatching(/^melanie-[0-9a-f]{4}$/),
      dateNaissance: '1987-03-02',
      taille: 165,
      prenom: 'Mélanie',
      objectif: { type: 'affiner' },
      complements: ['Créatine'],
      regime: 'keto',
      magasin: 'Lidl',
      magasins: ['Lidl', 'Aldi', 'Marché'],
      budgetMax: 40,
    });
  });

  test('parcours tout sauté : étape 1 seule obligatoire → shell sans crash', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.getByLabel("Comment tu t'appelles ?").fill('Mélanie');
    await page.getByRole('radio', { name: /Suivre mon poids/ }).click();
    await page.getByRole('button', { name: /Continuer/ }).click();

    // « Passer » sur les étapes infos / objectif / compléments & régime.
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Passer' }).click();
    }
    await page.getByRole('button', { name: /C'est parti/ }).click();

    // Même tolérance à l'étape 6 optionnelle que le parcours complet.
    const plusTard = page.getByRole('button', { name: 'Plus tard' });
    const shell = page.getByRole('navigation', { name: 'Navigation principale' });
    const taSemaine = page.getByRole('heading', { name: 'Ta semaine' });
    await plusTard.or(taSemaine).first().waitFor();
    if (await plusTard.isVisible()) await plusTard.click();
    // Étape optionnelle « Ta semaine » : on la passe ; l'onboarding arrive ensuite sur Mon cycle.
    await passerTaSemaineEtMonCycle(page);

    // L'app s'affiche sans crash : salutation (Aujourd'hui) avec le prénom
    // prérempli + cycle d'exemple.
    await expect(shell).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bonjour Mélanie' })).toBeVisible();
    await expect(page.getByText(/Menus d'exemple/)).toBeVisible();
    await assertPasDeDebordement(page);

    // Profil partiel enregistré : aucun champ sauté n'apparaît dans le storage.
    const profil = await page.evaluate(() => JSON.parse(localStorage.getItem('sportapp:profile')!));
    expect(profil).toEqual({
      id: expect.stringMatching(/^melanie-[0-9a-f]{4}$/),
      prenom: 'Mélanie',
      objectif: { type: 'perte' },
      complements: [],
      regime: 'aucun',
    });
  });

  test('étape 1 : en famille, juste la routine — aucun débordement, 4 onglets à l’arrivée', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByText(/Marc|Mélanie/)).toHaveCount(0); // aucun profil imposé
    await page.getByLabel("Comment tu t'appelles ?").fill('Jean');
    await page.getByRole('radio', { name: 'En famille' }).click();
    await page.getByLabel(/partenaire/).fill('Thérèse');
    await page.getByLabel("Prénom d'un enfant").fill('Léo');
    await page.getByRole('button', { name: /Ajouter/ }).click();
    await assertPasDeDebordement(page);
    await page.getByRole('button', { name: /Continuer/ }).click();
    await expect(page.getByRole('heading', { name: /Personnalisation/ })).toBeVisible(); // sans suivi : étape 4
    await page.getByRole('button', { name: /Continuer/ }).click();
    await page.getByRole('button', { name: /C'est parti/ }).click();
    const plusTard = page.getByRole('button', { name: 'Plus tard' });
    const taSemaine = page.getByRole('heading', { name: 'Ta semaine' });
    await plusTard.or(taSemaine).first().waitFor();
    if (await plusTard.isVisible()) {
      await assertPasDeDebordement(page);
      await plusTard.click();
    }
    await passerTaSemaineEtMonCycle(page);
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(nav.getByRole('button')).toHaveText(["Aujourd'hui", 'Semaine', 'Courses', 'Rituel']);
    await expect(page.getByRole('heading', { name: 'Bonjour Jean' })).toBeVisible();
    await assertPasDeDebordement(page);
  });

  test('migration : profil ancien → onboarding prérempli à l étape 2', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sportapp:profile', JSON.stringify({ id: 'melanie', age: 38, taille: 165 }));
      localStorage.setItem(
        'sportapp:weights:melanie',
        JSON.stringify([{ date: '2026-09-08', kg: 62.1 }]),
      );
    });
    await page.goto('/');

    await expect(page.getByText(/Une mise à jour/)).toBeVisible();
    await expect(page.getByText(/non modifiable ici/)).toBeVisible();
    await expect(page.getByLabel('Poids (kg)')).toHaveValue('62.1');
    await expect(page.getByLabel('Date de naissance')).toHaveValue('');

    await page.getByLabel('Date de naissance').fill('1987-03-02');
    await page.getByRole('button', { name: /Continuer/ }).click();
    await page.getByRole('button', { name: /Continuer/ }).click();
    await page.getByRole('button', { name: /Continuer/ }).click();
    await page.getByRole('button', { name: /C'est parti/ }).click();

    // Même tolérance à l'étape 6 optionnelle que le parcours complet.
    const plusTard = page.getByRole('button', { name: 'Plus tard' });
    const shell = page.getByRole('navigation', { name: 'Navigation principale' });
    const taSemaine = page.getByRole('heading', { name: 'Ta semaine' });
    await plusTard.or(taSemaine).first().waitFor();
    if (await plusTard.isVisible()) await plusTard.click();
    // Étape optionnelle « Ta semaine » : on la passe ; l'onboarding arrive ensuite sur Mon cycle.
    await passerTaSemaineEtMonCycle(page);

    await expect(shell).toBeVisible();
    const profil = await page.evaluate(() => JSON.parse(localStorage.getItem('sportapp:profile')!));
    expect(profil).toEqual({
      id: 'melanie', // migration : l'id historique est gardé
      dateNaissance: '1987-03-02',
      taille: 165,
      objectif: { type: 'perte' },
      complements: [],
      regime: 'aucun',
    });
  });
});

test.describe('Écran Profil — mobile', () => {
  test.use({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: ORIGIN,
          localStorage: [
            {
              name: 'sportapp:profile',
              value: JSON.stringify({
                id: 'melanie',
                dateNaissance: '1987-03-02',
                taille: 165,
                objectif: { type: 'perte', echeance: '2026-12-15' },
                complements: ['Whey'],
                regime: 'keto',
              }),
            },
          ],
        },
      ],
    },
  });

  test('profil : pages détail sans débordement horizontal', async ({ page }) => {
    await page.goto('/');
    // document.fonts.ready fixe le layout avant la mesure (pattern dock.spec).
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('button', { name: /Moi : / }).click();

    // Hub : lignes du compte visibles.
    const tuileInfos = page.getByRole('button', { name: /Mes infos/ });
    await expect(tuileInfos).toBeVisible();
    await assertPasDeDebordement(page);

    // Tuile « Mes infos » → page détail : infos v2.
    await tuileInfos.click();
    await expect(page.getByRole('heading', { name: 'Mes infos', level: 2 })).toBeVisible();
    await expect(page.getByLabel('Date de naissance')).toBeVisible();
    await assertPasDeDebordement(page);

    // Tuile « Objectif » → page détail : cap, régime, compléments.
    await page.getByRole('button', { name: 'Moi', exact: true }).click();
    await page.getByRole('button', { name: /Objectif/ }).click();
    await expect(page.getByRole('heading', { name: 'Objectif', level: 2 })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Ton cap' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enregistrer', exact: true })).toBeVisible(); // pied collant
    await expect(page.getByRole('radiogroup', { name: 'Régime' })).toBeVisible();
    await expect(page.getByText('Whey')).toBeVisible();
    await assertPasDeDebordement(page);
  });

  test('profil : les champs courses & budget suivent le style guideline', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('button', { name: /Moi : / }).click();
    await page.getByRole('button', { name: /Magasin et budget/ }).click(); // ligne → page détail

    await expect(page.getByRole('heading', { name: 'Magasin et budget', level: 2 })).toBeVisible();
    await assertPasDeDebordement(page);
    for (const label of [
      'Budget max courses / semaine',
    ]) {
      await assertStyleGuideline(page, label);
    }
  });
});

// Stepper : « étape 2 » ne doit jamais s'afficher « 4 » (étapes sautées sans suivi),
// et la fin d'onboarding arrive sur Mon cycle avec le prompt copiable — 320 et 375.
for (const largeur of [320, 375]) {
  test(`onboarding routine seule : stepper juste, magasins multiples, arrivée sur Mon cycle, à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 700 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.getByLabel("Comment tu t'appelles ?").fill('Léa');
    expect(await stepper(page)).toMatchObject({ actifs: 1, total: 3 });
    await assertPasDeDebordement(page);
    await page.getByRole('button', { name: /Continuer/ }).click();

    await expect(page.getByRole('heading', { name: /Personnalisation/ })).toBeVisible();
    expect(await stepper(page)).toMatchObject({ actifs: 2, total: 3 });
    expect((await stepper(page)).texte).toContain('Étape 2 sur 3');
    await assertPasDeDebordement(page);
    await page.getByRole('button', { name: /Continuer/ }).click();

    await expect(page.getByRole('heading', { name: /Maison & courses/ })).toBeVisible();
    expect((await stepper(page)).texte).toContain('Étape 3 sur 3');
    await page.getByRole('button', { name: 'Carrefour', exact: true }).click();
    await page.getByRole('button', { name: 'Grand Frais', exact: true }).click();
    await expect(page.getByText(/Principal : Carrefour/)).toBeVisible();
    await assertPasDeDebordement(page);
    await page.getByRole('button', { name: /C'est parti/ }).click();

    const plusTard = page.getByRole('button', { name: 'Plus tard' });
    const taSemaine = page.getByRole('heading', { name: 'Ta semaine' });
    await plusTard.or(taSemaine).first().waitFor();
    if (!(await taSemaine.isVisible())) await plusTard.click(); // étape sync optionnelle (build de prod)
    await page.getByRole('button', { name: 'Passer' }).click();

    // Mon cycle : bouton copier visible d'emblée, 3 étapes claires, rien ne déborde.
    await expect(page.getByRole('heading', { name: 'Mes menus', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copier le prompt' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '1 · Copie le prompt' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '2 · Colle-le dans ton IA' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '3 · Importe les 4 fichiers' })).toBeVisible();
    await assertPasDeDebordement(page);

    const profil = await page.evaluate(() => JSON.parse(localStorage.getItem('sportapp:profile')!));
    expect(profil).toMatchObject({ magasin: 'Carrefour', magasins: ['Carrefour', 'Grand Frais'] });
  });
}
