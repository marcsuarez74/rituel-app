import { expect, test } from '@playwright/test';

const ORIGIN = process.env.E2E_PREVIEW ? 'http://localhost:4173' : 'http://localhost:5173';

test.describe('Nav segmented — mobile', () => {
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

  test('nav segmented visible sous la bannière, plus de dock flottant', async ({ page }) => {
    await page.goto(ORIGIN);
    await expect(page.getByText('Semaine 37')).toBeVisible();
    const nav = page.locator('.tabbar-segmented');
    await expect(nav).toBeVisible();
    await expect(page.locator('.tabbar-dock')).toHaveCount(0);
    await expect(nav.locator('.seg-tab').first()).toHaveAttribute('aria-current', 'page');
  });

  test('bascule Cuisine ↔ Mon suivi via les segments', async ({ page }) => {
    await page.goto(ORIGIN);
    await page.getByRole('button', { name: 'Mon suivi' }).click();
    await expect(page.locator('.tabbar-segmented')).toHaveAttribute('data-active', 'suivi');
    await expect(page.getByRole('heading', { name: /Marc — Diet & Sport/ })).toBeVisible();
    await page.getByRole('button', { name: 'Cuisine' }).click();
    await expect(page.locator('.tabbar-segmented')).toHaveAttribute('data-active', 'cuisine');
  });

  // Le swipe est envoyé via page.mouse : WebKit (projets mobiles) génère bien
  // les pointer events pointerdown/pointerup qui alimentent le handler de App.
  // Le point de départ est déduit de la bannière rituel (div non interactif
  // dans <main>) : la bannière semaine compacte enveloppe sur 320 px — le
  // milieu d'écran tombe sur la nav segmented, hors du handler — et la
  // bannière rituel est sous la ligne de flottaison, d'où le scroll d'abord.
  test('swipe horizontal bascule Cuisine ↔ Mon suivi', async ({ page }) => {
    await page.goto(ORIGIN);
    await expect(page.getByText('Semaine 37')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const banniere = page.locator('.batch-banner');
    await banniere.scrollIntoViewIfNeeded();
    const origine = await banniere.boundingBox();
    expect(origine).not.toBeNull();
    // Départ côté droit de la bannière : un swipe de 200 px reste à l'écran.
    const x = origine!.x + origine!.width - 30;
    const y = origine!.y + origine!.height / 2;
    // swipe vers la gauche → Mon suivi
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 200, y, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('.tabbar-segmented')).toHaveAttribute('data-active', 'suivi');
    // swipe vers la droite → Cuisine
    await page.mouse.move(x - 200, y);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('.tabbar-segmented')).toHaveAttribute('data-active', 'cuisine');
  });

  test('glisser la barre d’onglets recettes ne bascule pas d’onglet principal', async ({
    page,
  }) => {
    await page.goto(ORIGIN);
    await expect(page.getByText('Semaine 37')).toBeVisible();
    await page.locator('.cuisine-tabs').getByRole('button', { name: 'Menu' }).click();
    await page.evaluate(() => document.fonts.ready);
    const barre = page.locator('.rtabs');
    await barre.scrollIntoViewIfNeeded();
    const box = await barre.boundingBox();
    expect(box).not.toBeNull();
    // Départ dans la bande de padding bas de la barre (hors boutons) :
    // faire défiler la barre de recettes ne doit jamais changer d'onglet
    // principal — même gesture que le swipe Cuisine ↔ Mon suivi.
    const x = box!.x + 60;
    const y = box!.y + box!.height - 4;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 200, y, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('.tabbar-segmented')).toHaveAttribute('data-active', 'cuisine');
  });

  test('la pilule active recouvre exactement le segment actif', async ({ page }) => {
    await page.goto(ORIGIN);
    for (const onglet of ['Mon suivi', 'Cuisine']) {
      await page.getByRole('button', { name: onglet }).click();
      await page.waitForTimeout(500); // laisser la transition (0,32s) se terminer
      const { gauche, droite } = await page.evaluate(() => {
        const nav = document.querySelector('.tabbar-segmented')!;
        const cs = getComputedStyle(nav, '::before');
        const navRect = nav.getBoundingClientRect();
        const matrice = new DOMMatrixReadOnly(cs.transform === 'none' ? '' : cs.transform);
        const largeur = Number.parseFloat(cs.width);
        // ::before est positionné à left:4px depuis le padding edge (bordure
        // de 1px incluse via clientLeft), puis translaté
        const piluleGauche = navRect.left + nav.clientLeft + 4 + matrice.e;
        return { gauche: piluleGauche, droite: piluleGauche + largeur };
      });
      const segRect = await page
        .locator('.seg-tab-active')
        .evaluate((el) => el.getBoundingClientRect());
      expect(Math.abs(gauche - segRect.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(droite - segRect.right)).toBeLessThanOrEqual(1);
    }
  });

  for (const largeur of [320, 375]) {
    test(`zéro débordement horizontal sur les 2 onglets à ${largeur}px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 700 });
      await page.goto(ORIGIN);
      // Même pattern que le swipe : fixe le layout avant de mesurer.
      await page.evaluate(() => document.fonts.ready);
      for (const onglet of ['Cuisine', 'Mon suivi']) {
        await page.getByRole('button', { name: onglet }).click();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(1);
      }
    });
  }
});
