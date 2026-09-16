import { expect, test } from '@playwright/test';

// Contrat de maintenance : la semaine d'exemple (S37, 2026-09-07 → 2026-09-13)
// doit couvrir la semaine courante. Quand on la rafraîchit, mettre à jour
// « Semaine 2026-S37 » et les compteurs exacts ci-dessous (même contrat que
// les tests unitaires). Hypothèses à préserver aussi : le frontmatter garde
// `menu: A` (pill assertée), le menu compte 33 lignes repas (5+5+5+4+4+5+5) —
// soit 7 dîners + 7 paires de déjeuners côté Menu v3. Les pills reprennent les
// noms courts des recettes (préfixe de ref « R# · » retiré par nomCourt, coupe
// de labelCourt) : la pill « Cuisses de poulet… » (lundi) sert d'ancrage aux
// tests fiche + coche, la note de verrouillage cite « Pâtes bolognaise ».
// Les coches menu partent d'un storageState vierge.
// Le test dépenses sème aussi une dépense datée 2026-09-09 (∈ S37) et épingle
// le total « Payé cette semaine » à 73,30 € — déplacer les deux au refresh.
// La saisie du formulaire épingle en plus la « Date » à 2026-09-10 (∈ S37) — au refresh, déplacer les trois.
const ORIGIN = process.env.E2E_PREVIEW ? 'http://localhost:4173' : 'http://localhost:5173';

// Jours en français, lundi premier (getDay() est dimanche premier → rotation).
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

const OVERFLOW_TOLERANCE = 1; // arrondis de sous-pixel

async function assertPasDeDebordement(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'la page ne doit pas scroller horizontalement').toBeLessThanOrEqual(OVERFLOW_TOLERANCE);
}

test.describe('Onglets Cuisine v2 — mobile', () => {
  // Profil seul suffit : la semaine d'exemple se charge automatiquement (fallback mémoire).
  // Profil étendu maison (magasin + budget max) + une dépense seedée le 2026-09-09
  // (dans la semaine d'exemple S37, 2026-09-07 → 2026-09-13) → la carte budget
  // affiche « Payé cette semaine : 38,20 € ».
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
                magasin: 'Lidl',
                budgetMax: 40,
              }),
            },
            {
              name: 'sportapp:depenses',
              value: JSON.stringify([{ date: '2026-09-09', magasin: 'Lidl', total: 38.2 }]),
            },
          ],
        },
      ],
    },
  });

  test('bannière : pill « Menu A » visible', async ({ page }) => {
    await page.goto(ORIGIN);
    await expect(page.getByText('Semaine 2026-S37')).toBeVisible();
    await expect(page.locator('.menu-pill')).toBeVisible();
    await expect(page.locator('.menu-pill')).toHaveText('Menu A');
  });

  test('menu v3 : onglets par recette, coche dîner persistée, file de déjeuners', async ({ page }) => {
    await page.goto(ORIGIN);
    await expect(page.getByText('Semaine 2026-S37')).toBeVisible();
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.locator('.rtab')).toHaveCount(8); // 7 dîners + 🍱 Déjeuners
    await expect(page.locator('.menu-progress')).toContainText('Dîners 0/7');
    await expect(page.locator('.menu-progress')).toContainText('Boxes 0/7');

    // Fiche recette complète dans l'onglet « Cuisses de poulet… » (lundi, R1) :
    // étapes visibles sans dépliage.
    const ongletLundi = page.getByRole('tab', { name: 'Cuisses de poulet…' });
    await ongletLundi.click();
    await expect(page.locator('.recette-etapes li').first()).toBeVisible();

    // Coche « C'est fait » → pill grisée + progression, persistée au rechargement.
    await page.getByRole('button', { name: /C'est fait/ }).click();
    await expect(ongletLundi).toHaveClass(/fait/);
    await expect(page.locator('.menu-progress')).toContainText('Dîners 1/7');
    await page.reload();
    // le rechargement remet l'app sur l'onglet Courses : rouvrir Menu avant l'assertion
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('tab', { name: 'Cuisses de poulet…' })).toHaveClass(/fait/);

    // File de déjeuners : 3 paires verrouillées — lundi (← R7), mercredi (← R2)
    // et jeudi (← R2 + R3). Mardi (← R1) est déjà prête : le dîner de lundi
    // (R1) a été coché plus haut dans ce test.
    await page.getByRole('tab', { name: '🍱 Déjeuners' }).click();
    await expect(page.locator('.box-pair.locked')).toHaveCount(3);
    // La 2e verrouillée (ordre du fichier) est celle du mercredi : elle attend
    // le dîner de mardi (R2), sa note cite « Pâtes bolognaise ».
    await expect(page.locator('.box-pair.locked').nth(1).locator('.lock-note')).toContainText(
      'Pâtes bolognaise',
    );
    // … puis se débloque quand la pill « Pâtes bolognaise » est cochée
    // (restent verrouillées : lundi ← R7, jeudi ← R3).
    await page.getByRole('tab', { name: 'Pâtes bolognaise' }).click();
    await page.getByRole('button', { name: /C'est fait/ }).click();
    await page.getByRole('tab', { name: '🍱 Déjeuners' }).click();
    await expect(page.locator('.box-pair.locked')).toHaveCount(2);
    await expect(page.locator('.menu-progress')).toContainText('Dîners 2/7');
  });

  test('courses : compteurs par rayon et encadré keto en dernier', async ({ page }) => {
    await page.goto(ORIGIN);
    await expect(page.getByText('Semaine 2026-S37')).toBeVisible();

    // 7 rayons dans la sample (6 groupes + keto), chacun avec son compteur 0/N
    await expect(page.locator('.rayon-cnt')).toHaveCount(7);
    await expect(page.locator('.rayon-cnt').first()).toHaveText('0/5');

    const dernier = page.locator('main section').last();
    await expect(dernier).toHaveClass(/keto-box/);
    await expect(dernier.locator('.keto-title')).toContainText('Les extras keto de Mélanie');
    await expect(dernier.locator('.rayon-cnt')).toHaveText('0/5');

    // Bannière rituel + budget (`- budget: ≈ 35 €` de la sample → « ≈ 35 € estimés. »)
    await expect(page.locator('.batch-banner')).toContainText('Pensées pour le rituel');
    await expect(page.locator('.batch-banner')).toContainText('≈ 35 €');

    // Mode magasin : rien n'est coché dans ce test, la liste reste donc entière —
    // on vérifie la bascule du bouton puis le retour à l'état initial.
    await page.locator('.mm').click();
    await expect(page.getByRole('button', { name: /Tout revoir/ })).toBeVisible();
    await page.locator('.mm').click();
  });

  test('carte budget + saisie d une dépense → historique', async ({ page }) => {
    await page.goto(ORIGIN);

    await expect(page.getByText('Budget courses')).toBeVisible();
    await expect(page.getByText('38,20 €')).toBeVisible();

    await page.getByRole('button', { name: /Total payé/ }).click();
    await expect(page.getByRole('heading', { name: /Mes dépenses réelles/ })).toBeVisible();
    await page.getByLabel('Total (€)').fill('35,10');
    await page.getByLabel('Date').fill('2026-09-10'); // ∈ S37 : la date du jour sortirait de [du..au] dès que la semaine d'exemple expire
    await page.getByLabel('Magasin').fill('Carrefour');
    await page.getByRole('button', { name: /Enregistrer/ }).click();
    await expect(page.getByText('Enregistré ✓')).toBeVisible();
    // Deux magasins → deux lignes, aucun upsert croisé. La date est épinglée
    // dans la semaine d'exemple : le test reste stable toute l'année.
    await expect(page.locator('.dep')).toHaveCount(2);
    await page.getByRole('button', { name: /Retour/ }).first().click();
    // De retour sur la carte, le payé additionne les deux sessions de la semaine.
    await expect(page.getByText('73,30 €')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('batch : timeline du rituel (5 étapes) et carrousel micro-batch', async ({ page }) => {
    await page.goto(ORIGIN);
    await expect(page.getByText('Semaine 2026-S37')).toBeVisible();

    await page.getByRole('button', { name: 'Batch' }).click();
    await expect(page.locator('.rituel-timeline')).toBeVisible();
    await expect(page.locator('.rituel-etape')).toHaveCount(5);
    await expect(page.locator('.rituel-creneau').first()).toBeVisible();

    // La bannière « Ce soir » dépend du jour réel d'exécution : le micro-batch
    // de la semaine d'exemple couvre lundi, mardi et samedi.
    const jour = JOURS[(new Date().getDay() + 6) % 7];
    const avecCeSoir = ['lundi', 'mardi', 'samedi'].includes(jour);
    await expect(page.locator('.batch-banner')).toHaveCount(avecCeSoir ? 1 : 0);
    if (avecCeSoir) await expect(page.locator('.batch-banner')).toContainText(new RegExp(jour, 'i'));

    await expect(page.locator('.micro-batch')).toBeVisible();
    await expect(page.locator('.micro-jour')).toHaveCount(3);
    await expect(page.locator('.micro-dots i')).toHaveCount(3);

    // Parcours guidé : le run ne coche aucune étape — au retour à l'aperçu,
    // la timeline retrouve ses 5 étapes dans leur état d'origine.
    await page.getByRole('button', { name: 'Lancer le batch' }).click();
    for (let i = 0; i < 4; i++) {
      await page.getByRole('button', { name: 'Étape terminée →' }).click();
    }
    await page.getByRole('button', { name: 'Terminer le batch ✓' }).click();
    await expect(page.getByText('Batch terminé !')).toBeVisible();
    await page.getByRole('button', { name: "Revenir à l'aperçu" }).click();
    await expect(page.locator('.rituel-timeline')).toBeVisible();
    await expect(page.locator('.rituel-etape.done')).toHaveCount(0);
  });

  for (const largeur of [320, 375]) {
    test(`zéro débordement horizontal sur les 3 sous-onglets à ${largeur}px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 700 });
      await page.goto(ORIGIN);
      await expect(page.getByText('Semaine 2026-S37')).toBeVisible();
      // document.fonts.ready fixe le layout (même pattern que dock.spec) :
      // sans lui, la mesure peut tomber pendant le swap de police (flake CI).
      await page.evaluate(() => document.fonts.ready);

      for (const onglet of ['Courses', 'Menu', 'Batch']) {
        await page.getByRole('button', { name: onglet }).click();
        await assertPasDeDebordement(page);
      }
    });
  }
});
