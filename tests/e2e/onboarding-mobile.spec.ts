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
// cible tactile ≥ 48px, fond surface-2 (#e7eae0), rayon token 12px — pas le rendu natif.
const SURFACE_2 = 'rgb(231, 234, 224)'; // var(--surface-2) résolue

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
  expect(style.fond, `${label} : fond tokens Herbes (surface-2)`).toBe(SURFACE_2);
  expect(style.rayon, `${label} : rayon token 12px`).toBe('12px');
}

test.describe('Onboarding 5 étapes — mobile', () => {
  test('étape 2 : aucun débordement horizontal et champs dans le viewport', async ({ page }) => {
    const largeur = page.viewportSize()!.width;
    await page.goto('/');
    // document.fonts.ready fixe le layout avant les mesures (pattern dock.spec).
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('button', { name: /Mélanie/ }).click();
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
    await page.getByRole('button', { name: /Mélanie/ }).click();
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
      'Magasin habituel',
      'Budget max courses / semaine',
      'Personnes à table',
      'Repas par jour',
    ]) {
      await assertStyleGuideline(page, label);
    }
  });

  test('parcours complet : poids/date/taille → objectif → personnalisation → shell', async ({ page }) => {
    await page.goto('/');
    // document.fonts.ready fixe le layout avant les mesures (pattern dock.spec).
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('button', { name: /Mélanie/ }).click();
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
    await page.getByLabel('Magasin habituel').fill('Lidl');
    await page.getByLabel('Budget max courses / semaine').fill('40');
    await page.getByRole('button', { name: /C'est parti/ }).click();

    // Build de prod avec sync compilée : l'étape 6 optionnelle s'intercale
    // — « Plus tard » poursuit ; sans sync, le shell arrive direct.
    const plusTard = page.getByRole('button', { name: 'Plus tard' });
    await plusTard.or(page.getByText('Semaine 37')).first().waitFor();
    if (await plusTard.isVisible()) await plusTard.click();

    // Profil enregistré + semaine d'exemple auto-chargée → shell direct
    await expect(page.getByText('Semaine 37')).toBeVisible();
    const profil = await page.evaluate(() => JSON.parse(localStorage.getItem('sportapp:profile')!));
    expect(profil).toEqual({
      id: 'melanie',
      dateNaissance: '1987-03-02',
      taille: 165,
      prenom: 'Mélanie',
      objectif: { type: 'affiner' },
      complements: ['Créatine'],
      regime: 'keto',
      magasin: 'Lidl',
      budgetMax: 40,
    });
  });

  test('parcours tout sauté : étape 1 seule obligatoire → shell sans crash', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('button', { name: /Mélanie/ }).click();
    await page.getByRole('button', { name: /Continuer/ }).click();

    // « Passer » sur les étapes infos / objectif / compléments & régime.
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Passer' }).click();
    }
    await page.getByRole('button', { name: /C'est parti/ }).click();

    // Même tolérance à l'étape 6 optionnelle que le parcours complet.
    const plusTard = page.getByRole('button', { name: 'Plus tard' });
    await plusTard.or(page.getByText('Semaine 37')).first().waitFor();
    if (await plusTard.isVisible()) await plusTard.click();

    // L'app s'affiche sans crash : salutation (onglet Mon suivi) avec le prénom
    // prérempli + semaine d'exemple dans l'onglet par défaut.
    await page.getByRole('button', { name: 'Mon suivi' }).click();
    await expect(page.getByText('Salut Mélanie 👋')).toBeVisible();
    await expect(page.getByText('Semaine 37')).toBeVisible();
    await assertPasDeDebordement(page);

    // Profil partiel enregistré : aucun champ sauté n'apparaît dans le storage.
    const profil = await page.evaluate(() => JSON.parse(localStorage.getItem('sportapp:profile')!));
    expect(profil).toEqual({
      id: 'melanie',
      prenom: 'Mélanie',
      objectif: { type: 'perte' },
      complements: [],
      regime: 'aucun',
    });
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
    await plusTard.or(page.getByText('Semaine 37')).first().waitFor();
    if (await plusTard.isVisible()) await plusTard.click();

    await expect(page.getByText('Semaine 37')).toBeVisible();
    const profil = await page.evaluate(() => JSON.parse(localStorage.getItem('sportapp:profile')!));
    expect(profil).toEqual({
      id: 'melanie',
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

  test('profil : sections v2 sans débordement horizontal', async ({ page }) => {
    await page.goto('/');
    // document.fonts.ready fixe le layout avant la mesure (pattern dock.spec).
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('button', { name: 'Mon profil' }).click();

    await expect(page.getByRole('heading', { name: 'Profil' })).toBeVisible();
    await expect(page.getByLabel('Date de naissance')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Objectif', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Compléments', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Régime', level: 3 })).toBeVisible();
    await assertPasDeDebordement(page);
  });

  test('profil : les champs maison & courses suivent le style guideline', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Mon profil' }).click();

    await expect(page.getByRole('heading', { name: 'Profil' })).toBeVisible();
    for (const label of [
      'Magasin habituel',
      'Budget max courses / semaine',
      'Personnes à table',
      'Repas par jour',
    ]) {
      await assertStyleGuideline(page, label);
    }
  });
});
