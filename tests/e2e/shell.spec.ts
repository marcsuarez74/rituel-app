import { expect, test } from '@playwright/test';

const OVERFLOW_TOLERANCE = 1; // arrondis de sous-pixel
const ORIGIN = process.env.E2E_PREVIEW ? 'http://localhost:4173' : 'http://localhost:5173';

const ONGLETS = ["Aujourd'hui", 'Semaine', 'Courses', 'Rituel'] as const;

// Libellé d'onglet → titre h1 de l'écran (Aujourd'hui salue, Semaine dit « Menus »).
const TITRES: Record<(typeof ONGLETS)[number], string> = {
  "Aujourd'hui": 'Bonjour Marc',
  Semaine: 'Menus',
  Courses: 'Courses',
  Rituel: 'Rituel',
};

test.describe('Shell v2 — barre du bas', () => {
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
                id: 'marc',
                dateNaissance: '1985-04-12',
                taille: 178,
                objectif: { type: 'perte', echeance: '2026-12-15' },
                complements: [],
                regime: 'aucun',
              }),
            },
          ],
        },
      ],
    },
  });

  for (const largeur of [320, 375]) {
    test(`4 onglets sous le pouce, aucun débordement à ${largeur}px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 667 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      const nav = page.getByRole('navigation', { name: 'Navigation principale' });
      await expect(page.getByText(/Menus d'exemple/)).toBeVisible();

      // Barre collée en bas de l'écran, cibles ≥ 48 px.
      const boite = (await nav.boundingBox())!;
      expect(Math.round(boite.y + boite.height)).toBe(667);
      for (const nom of ONGLETS) {
        const b = (await nav.getByRole('button', { name: nom, exact: true }).boundingBox())!;
        expect(b.height, `${nom} : cible ≥ 48 px`).toBeGreaterThanOrEqual(48);
      }

      for (const nom of ONGLETS) {
        await nav.getByRole('button', { name: nom, exact: true }).click();
        await expect(page.getByRole('heading', { level: 1, name: TITRES[nom] })).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${nom} : pas de scroll horizontal`).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
      }
    });
  }

  test('navigation de semaine : vit dans Semaine, l’avatar ouvre Moi', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await nav.getByRole('button', { name: 'Semaine', exact: true }).click();
    await expect(page.getByText(/Sem\. 1 ·/)).toBeVisible();
    await page.getByRole('button', { name: 'Semaine suivante' }).click();
    await expect(page.getByText(/Sem\. 2 ·/)).toContainText('Menu B');

    await page.getByRole('button', { name: 'Moi : Marc' }).click();
    await expect(page.getByRole('button', { name: /Mes infos/ })).toBeVisible();
    await expect(nav).toHaveCount(0);
  });

  for (const largeur of [320, 375]) {
    test(`semaine → fiche recette → retour, sans débordement à ${largeur}px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 667 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      const nav = page.getByRole('navigation', { name: 'Navigation principale' });
      await nav.getByRole('button', { name: 'Semaine', exact: true }).click();
      await expect(page.getByRole('tablist', { name: 'Jours' })).toBeVisible();
      const debord = () =>
        page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(await debord()).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);

      // Premier repas AVEC fiche recette (un déjeuner « box » n'en a pas — dépend du jour).
      await page.locator('button.carte-repas-corps').first().click();
      await expect(page.getByRole('heading', { name: 'Préparation' })).toBeVisible();
      expect(await debord()).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
      await page.getByRole('button', { name: /Retour/ }).click();
      await expect(page.getByRole('tablist', { name: 'Jours' })).toBeVisible();
    });
  }

  for (const largeur of [320, 375]) {
    test(`courses : carte budget, coche, tout coché, « J'ai payé », sans débordement à ${largeur}px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 667 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await page
        .getByRole('navigation', { name: 'Navigation principale' })
        .getByRole('button', { name: 'Courses', exact: true })
        .click();
      await expect(page.getByText('Estimé')).toBeVisible();
      // « J'ai payé » n'apparaît que quand TOUT est coché (spec PR 4).
      const coches = page.locator('.rayon .ligne-cochable');
      const total = await coches.count();
      for (let i = 0; i < total; i++) await coches.nth(i).click();
      await expect(page.getByText('Tout est dans le panier !')).toBeVisible();
      await page.getByRole('button', { name: /Mode magasin/ }).click();
      await page.getByRole('button', { name: /J'ai payé/ }).click();
      await expect(page.getByLabel('Total du ticket (€)')).toBeVisible();
      const debord = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(debord).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
    });
  }

  for (const largeur of [320, 375]) {
    test(`rituel : feuille d'explication, ce qui reste en semaine, sans débordement à ${largeur}px`, async ({ page }) => {
      await page.clock.install({ time: new Date('2026-10-13T10:00:00') }); // un mardi, pas jour de rituel
      await page.setViewportSize({ width: largeur, height: 667 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await page
        .getByRole('navigation', { name: 'Navigation principale' })
        .getByRole('button', { name: 'Rituel', exact: true })
        .click();
      // Première visite : la feuille des 3 vignettes s'ouvre, « J'ai compris » la referme.
      const debord = () =>
        page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/Le rituel, c'est quoi/)).toBeVisible();
      await page.getByRole('button', { name: "J'ai compris" }).click();
      await expect(page.getByRole('dialog')).toBeHidden();
      expect(await debord()).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
      await expect(page.getByRole('heading', { name: 'Au frigo cette semaine' })).toBeVisible();
      // Relisible à tout moment via le lien.
      await page.getByRole('button', { name: /C'est quoi le rituel/ }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: "J'ai compris" }).click();
      await expect(page.getByRole('dialog')).toBeHidden();
      expect(await debord()).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
    });
  }

  for (const largeur of [320, 375]) {
    test(`assistant : Moi → 3 étapes → import refusé expliqué, à ${largeur}px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 667 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await page.getByRole('button', { name: 'Moi : Marc' }).click();
      await page.getByRole('button', { name: /Mes menus/ }).click();
      await page.getByRole('button', { name: 'Créer mes premiers menus' }).click();
      await expect(page.getByRole('heading', { name: 'Ta semaine type est-elle toujours la bonne ?' })).toBeVisible();
      await page.getByRole('button', { name: 'Oui, continuer' }).click();
      await page.getByRole('button', { name: /Copier la demande/ }).click();
      await page.getByRole('button', { name: "J'ai la réponse, continuer" }).click();
      await expect(page.getByRole('heading', { name: "Ajoute la réponse de l'IA" })).toBeVisible();
      const debord = () =>
        page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(await debord()).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);

      await page.locator('input[type="file"]').setInputFiles({
        name: 'menu-A.json',
        mimeType: 'application/json',
        buffer: Buffer.from('{"format":"rituel-cycle"'),
      });
      await expect(page.getByRole('heading', { name: 'À corriger avant de démarrer' })).toBeVisible();
      expect(await debord()).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
    });
  }

  test('report : la feuille tient à 320 px, le toast permet d’annuler', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page
      .getByRole('navigation', { name: 'Navigation principale' })
      .getByRole('button', { name: 'Semaine', exact: true })
      .click();
    await page.getByRole('button', { name: 'Pas ce soir : reporter' }).first().click();
    const feuille = page.getByRole('dialog');
    await expect(feuille).toBeVisible();
    const debord = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(debord).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
    await feuille.getByRole('button', { name: 'On ne le fera pas' }).click();
    await expect(page.getByRole('status')).toContainText('Retiré du menu');
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByRole('status')).toHaveCount(0);
  });

  for (const largeur of [320, 375]) {
    test(`semaine type : depuis Moi, jour déplié, sans débordement à ${largeur}px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 667 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await page.getByRole('button', { name: 'Moi : Marc' }).click();
      await page.getByRole('button', { name: /Ma semaine type/ }).click();
      await page.locator('summary', { hasText: 'Lundi' }).click();
      await expect(page.getByRole('radiogroup', { name: 'Journée de Marc' })).toBeVisible();
      const debord = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(debord).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
      await page.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(page.getByRole('button', { name: /Ma semaine type/ })).toBeVisible();
    });
  }

  // Spec refonte §9 : le mot « cycle » a disparu des textes visibles des écrans
  // livrés par cette refonte (les identifiants internes restent, eux).
  test('vocabulaire : le mot « cycle » n’apparaît sur aucun écran livré', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-11T10:00:00') }); // dimanche, jour du rituel
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    for (const nom of ONGLETS) {
      await nav.getByRole('button', { name: nom, exact: true }).click();
      // Première visite de l'onglet Rituel : la feuille des vignettes s'ouvre.
      if (nom === 'Rituel') await page.getByRole('button', { name: "J'ai compris" }).click();
      await expect(page.getByRole('main')).not.toContainText(/cycle/i);
    }
    await page.getByRole('button', { name: 'Moi : Marc' }).click();
    await expect(page.getByRole('button', { name: /Mes infos/ })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/cycle/i);

    // L'assistant des prochains menus (Moi › Mes menus), les 3 étapes.
    await page.getByRole('button', { name: /Mes menus/ }).click();
    await page.getByRole('button', { name: /Créer mes premiers menus/ }).click();
    await expect(page.getByRole('heading', { name: 'Ta semaine type est-elle toujours la bonne ?' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/cycle/i);
    await page.getByRole('button', { name: 'Oui, continuer' }).click();
    await page.getByRole('button', { name: /Copier la demande/ }).click();
    await page.getByRole('button', { name: "J'ai la réponse, continuer" }).click();
    await expect(page.getByRole('heading', { name: "Ajoute la réponse de l'IA" })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/cycle/i);
    await page.getByRole('button', { name: 'Retour' }).click();
    await page.getByRole('button', { name: 'Moi' }).click();
    await page.getByRole('button', { name: 'Retour' }).click(); // on ressort du hub vers le shell

    // Le mode guidé (jour du rituel simulé), première étape.
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Rituel', exact: true }).click();
    await page.getByRole('button', { name: 'Commencer' }).click();
    await expect(page.getByText(/^Étape 1 sur \d+$/)).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/cycle/i);
  });

  // Spec refonte §9 : une seule action pleine visible par écran.
  test('un seul bouton plein (.bouton-plein) visible par écran', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-11T10:00:00') }); // dimanche : le pied « Commencer » est là
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const pleins = page.locator('.bouton-plein:visible');
    const unSeul = async (ecran: string) => {
      const n = await pleins.count();
      expect(n, `${ecran} : ${n} action(s) pleine(s) visible(s)`).toBeLessThanOrEqual(1);
    };
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    for (const nom of ONGLETS) {
      await nav.getByRole('button', { name: nom, exact: true }).click();
      if (nom === 'Rituel') {
        // La feuille d'explication est une couche à part : on la referme d'abord.
        await page.getByRole('button', { name: "J'ai compris" }).click();
      }
      await unSeul(nom);
    }

    await page.getByRole('button', { name: 'Moi : Marc' }).click();
    await unSeul('Moi');
    await page.getByRole('button', { name: /Ma semaine type/ }).click();
    await unSeul('Ma semaine type');
    await page.getByRole('button', { name: 'Moi' }).click();
    await page.getByRole('button', { name: /Mes menus/ }).click();
    await unSeul('Mes menus');
    await page.getByRole('button', { name: /Créer mes premiers menus/ }).click();
    await unSeul('Assistant (étape 1)');
    await page.getByRole('button', { name: 'Oui, continuer' }).click();
    await unSeul('Assistant (étape 2)');
    await page.getByRole('button', { name: /Copier la demande/ }).click();
    await page.getByRole('button', { name: "J'ai la réponse, continuer" }).click();
    await unSeul('Assistant (étape 3)');
    await page.getByRole('button', { name: 'Retour' }).click();
    await page.getByRole('button', { name: 'Moi' }).click();
    await page.getByRole('button', { name: 'Retour' }).click(); // on ressort du hub vers le shell

    await nav.getByRole('button', { name: 'Rituel', exact: true }).click();
    await page.getByRole('button', { name: 'Commencer' }).click();
    await expect(page.getByText(/^Étape 1 sur \d+$/)).toBeVisible();
    await unSeul('Mode guidé (étape 1)');
  });
});

test.describe('Shell v2 — juste la routine (suivi coupé)', () => {
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
                id: 'jean-01ab',
                prenom: 'Jean',
                suivi: false,
                objectif: { type: 'maintien' },
                complements: [],
                regime: 'aucun',
              }),
            },
          ],
        },
      ],
    },
  });

  for (const largeur of [320, 375]) {
    test(`4 onglets sans carte Suivi, aucun débordement à ${largeur}px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 667 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      const nav = page.getByRole('navigation', { name: 'Navigation principale' });
      await expect(page.getByText(/Menus d'exemple/)).toBeVisible();
      await expect(nav.getByRole('button')).toHaveText(["Aujourd'hui", 'Semaine', 'Courses', 'Rituel']);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
    });
  }
});
