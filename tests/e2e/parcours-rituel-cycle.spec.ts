import { expect, test } from '@playwright/test';
import {
  allerA,
  attendrePolices,
  fichiersCycle,
  lireStockage,
  stateAvec,
  verifierPasDeDebordement,
} from './fixtures';

test.describe('Parcours rituel guidé et import de cycle', () => {
  test.use({ storageState: stateAvec() });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await attendrePolices(page);
    await expect(page.getByText(/Menus d'exemple/)).toBeVisible();
  });

  test('Rituel › mode guidé : le minuteur démarre et décompte', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-11T10:00:00') }); // dimanche, jour du rituel
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await attendrePolices(page);
    await expect(page.getByText(/Menus d'exemple/)).toBeVisible();
    await allerA(page, 'Rituel');

    // Première visite : la feuille des 3 vignettes, puis le pied « Commencer ».
    await page.getByRole('button', { name: "J'ai compris" }).click();
    await verifierPasDeDebordement(page, 'Rituel (jour du rituel)');
    await page.getByRole('button', { name: 'Commencer' }).click();
    await expect(page.getByText(/^Étape 1 sur \d+$/)).toBeVisible();
    await verifierPasDeDebordement(page, 'Mode guidé');
    await expect(page.getByRole('main')).not.toContainText(/cycle/i);

    // Le minuteur de l'étape 1 : lancer → puce qui décompte dans la barre collée.
    await page.getByRole('button', { name: /Préchauffage du four · 5 min/ }).click();
    const puce = page.locator('.puce-min');
    await expect(puce).toContainText('Préchauffage du four');
    await expect(puce).toContainText(/\d{2}:\d{2}/);
    const avant = await puce.innerText();
    await page.clock.runFor(3000);
    const apres = await puce.innerText();
    expect(apres, 'le décompte avance').not.toBe(avant);
    await verifierPasDeDebordement(page, 'Mode guidé (minuteur lancé)');

    // À l'échéance : puce « prêt ! » + alerte avec OK.
    await page.clock.runFor(5 * 60_000);
    const alerte = page.getByRole('alert');
    await expect(alerte).toContainText("Préchauffage du four : c'est prêt !");
    await alerte.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('Assistant : import avec alias et remarques → aperçu apaisé, notes repliées', async ({ page }) => {
    await page.getByRole('button', { name: 'Moi : Marc' }).click();
    await page.getByRole('button', { name: /Mes menus/ }).click();
    await page.getByRole('button', { name: /Créer mes premiers menus/ }).click();
    await expect(page.getByRole('heading', { name: 'Ta semaine type est-elle toujours la bonne ?' })).toBeVisible();
    await page.getByRole('button', { name: 'Oui, continuer' }).click();
    await page.getByRole('button', { name: /Copier la demande/ }).click();
    await page.getByRole('button', { name: "J'ai la réponse, continuer" }).click();

    const fichiers = fichiersCycle('Cycle apaisé').map((f: { name: string; mimeType: string; buffer: Buffer }) => {
      const c = JSON.parse(f.buffer.toString());
      c.remarques = ['Estimation à 118 € par semaine.', `Menu ${f.name} : choix varié.`, 'Estimation à 118 € par semaine'];
      for (const r of c.recettes ?? []) for (const i of r.ingredients ?? []) if (i.rayon === 'legumes') i.rayon = 'fruits-legumes';
      return { ...f, buffer: Buffer.from(JSON.stringify(c)) };
    });
    await page.locator('input[type="file"]').setInputFiles(fichiers);

    await expect(page.getByText("C'est bon : 4 semaines de menus.")).toBeVisible();
    await expect(page.getByText('À savoir')).toHaveCount(0);
    await expect(page.getByText(/corrigé en/)).toHaveCount(0);
    const repli = page.locator('details.notes-ia');
    await expect(repli.locator('summary')).toHaveText(/Notes de ton IA \(5\)/);
    await expect(page.getByText('choix varié', { exact: false }).first()).toBeHidden();

    for (const largeur of [320, 375]) {
      await page.setViewportSize({ width: largeur, height: 800 });
      await verifierPasDeDebordement(page, `Aperçu import (${largeur})`);
    }
    await repli.locator('summary').click();
    await expect(page.getByText('Estimation à 118 € par semaine.')).toHaveCount(1);
    await expect(page.getByText(/rangés? automatiquement/)).toBeVisible();
    for (const largeur of [320, 375]) {
      await page.setViewportSize({ width: largeur, height: 800 });
      await verifierPasDeDebordement(page, `Aperçu import déplié (${largeur})`);
    }
  });

  test('Assistant : importer 4 fichiers valides puis lancer mes menus', async ({ page }) => {
    await page.getByRole('button', { name: 'Moi : Marc' }).click();
    await page.getByRole('button', { name: /Mes menus/ }).click();
    await page.getByRole('button', { name: /Créer mes premiers menus/ }).click();
    await page.getByRole('button', { name: 'Oui, continuer' }).click();
    await page.getByRole('button', { name: /Copier la demande/ }).click();
    await page.getByRole('button', { name: "J'ai la réponse, continuer" }).click();
    await verifierPasDeDebordement(page, 'Assistant (import)');

    await page.locator('input[type="file"]').setInputFiles(fichiersCycle('Cycle importé e2e'));

    await expect(page.getByText(/Aperçu des 4 semaines/)).toBeVisible();
    await expect(page.getByText(/À corriger avant de démarrer/)).toHaveCount(0);
    await verifierPasDeDebordement(page, 'Assistant (aperçu)');

    const lancer = page.getByRole('button', { name: 'Lancer mes menus' });
    await expect(lancer).toBeEnabled();
    await lancer.click();

    await expect(page.getByRole('heading', { name: 'Tes menus sont prêts' })).toBeVisible();
    await verifierPasDeDebordement(page, 'Assistant (fin)');

    const cycle = (await lireStockage(page, 'sportapp:cycle')) as { cycle: { titre: string; menus: unknown[] } };
    expect(cycle.cycle.titre).toBe('Cycle importé e2e');
    expect(cycle.cycle.menus).toHaveLength(4);

    // Le nouveau cycle remplace l'exemple après rechargement.
    await page.reload();
    await attendrePolices(page);
    await expect(page.getByText(/Menus d'exemple/)).toHaveCount(0);
    await allerA(page, 'Semaine');
    await verifierPasDeDebordement(page, 'Menu (cycle importé)');
  });
});
