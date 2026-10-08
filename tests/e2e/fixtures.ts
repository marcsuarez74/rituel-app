import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';

// Briques communes aux specs de parcours : pas d'import de modules app, l'état
// est injecté via storageState (clés localStorage = données réelles, immuables).

export const OVERFLOW_TOLERANCE = 1; // arrondis de sous-pixel
export const ORIGIN = process.env.E2E_PREVIEW ? 'http://localhost:4173' : 'http://localhost:5173';

export const PROFIL_MARC = {
  id: 'marc',
  dateNaissance: '1985-04-12',
  taille: 178,
  objectif: { type: 'perte', echeance: '2026-12-15' },
  complements: [],
  regime: 'aucun',
};

export const stateAvec = (entrees: Record<string, unknown> = {}, profil: object = PROFIL_MARC) => ({
  cookies: [],
  origins: [
    {
      origin: ORIGIN,
      localStorage: Object.entries({ 'sportapp:profile': profil, ...entrees }).map(([name, v]) => ({
        name,
        value: JSON.stringify(v),
      })),
    },
  ],
});

export const lireStockage = (page: Page, cle: string): Promise<unknown> =>
  page.evaluate((k) => {
    const brut = window.localStorage.getItem(k);
    return brut == null ? null : JSON.parse(brut);
  }, cle);

// Toutes les entrées localStorage dont la clé commence par `prefixe`.
export const lirePrefixe = (page: Page, prefixe: string): Promise<Record<string, unknown>> =>
  page.evaluate((p) => {
    const out: Record<string, unknown> = {};
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i)!;
      if (k.startsWith(p)) out[k] = JSON.parse(window.localStorage.getItem(k)!);
    }
    return out;
  }, prefixe);

export const nav = (page: Page) => page.getByRole('navigation', { name: 'Navigation principale' });

export const allerA = async (page: Page, onglet: string) => {
  await nav(page).getByRole('button', { name: onglet, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: onglet })).toBeVisible();
};

export const attendrePolices = (page: Page) => page.evaluate(() => document.fonts.ready);

export const debordement = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// Zéro scroll horizontal à 320 et 375 sur l'écran courant (technique de shell.spec).
export const verifierPasDeDebordement = async (page: Page, ecran: string) => {
  const initiale = page.viewportSize();
  for (const largeur of [320, 375]) {
    await page.setViewportSize({ width: largeur, height: initiale?.height ?? 667 });
    expect(await debordement(page), `${ecran} : pas de scroll horizontal à ${largeur}px`).toBeLessThanOrEqual(
      OVERFLOW_TOLERANCE,
    );
  }
  if (initiale) await page.setViewportSize(initiale);
};

// Les 4 fichiers menu-A..D.json d'un cycle VALIDE pour le foyer par défaut
// (marc + melanie), dérivés de src/assets/cycle-exemple.json : un menu par
// fichier, rituel et fixes dans le A, chaque recette dans le fichier du menu
// (ou du rituel) qui la référence en premier.
export const fichiersCycle = (titre = 'Cycle importé e2e') => {
  // L'exemple est écrit pour alex/sam ; le foyer par défaut est marc/melanie.
  const brut = readFileSync(resolve(process.cwd(), 'src/assets/cycle-exemple.json'), 'utf8')
    .replaceAll('"alex"', '"marc"')
    .replaceAll('"sam"', '"melanie"');
  const sansEnfants = (_cle: string, v: unknown) =>
    Array.isArray(v) ? v.filter((x) => x !== 'lou' && x !== 'noa') : v;
  const exemple = JSON.parse(brut, sansEnfants);
  for (const r of exemple.recettes as { portions: Record<string, string> }[]) {
    for (const enfant of ['lou', 'noa']) delete r.portions[enfant];
  }
  const ids: string[] = exemple.recettes.map((r: { id: string }) => r.id);
  const refs = (o: unknown): Set<string> => {
    const trouves = new Set<string>();
    const brut = JSON.stringify(o);
    for (const id of ids) if (brut.includes(`"${id}"`)) trouves.add(id);
    return trouves;
  };
  const attribue = new Set<string>();
  return exemple.menus.map((menu: { lettre: string }, i: number) => {
    const portee = i === 0 ? { menu, rituel: exemple.rituel } : { menu };
    const mes = [...refs(portee)].filter((id) => !attribue.has(id));
    if (i === 0) {
      const dansMenus = refs(exemple.menus);
      for (const id of ids) if (!dansMenus.has(id) && !mes.includes(id)) mes.push(id);
    }
    for (const id of mes) attribue.add(id);
    const contenu = {
      format: exemple.format,
      version: exemple.version,
      titre,
      ...(i === 0 ? { rituel: exemple.rituel, fixes: exemple.fixes } : {}),
      menus: [menu],
      recettes: exemple.recettes.filter((r: { id: string }) => mes.includes(r.id)),
    };
    return { name: `menu-${menu.lettre}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(contenu)) };
  });
};
