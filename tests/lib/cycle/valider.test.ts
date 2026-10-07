import { describe, expect, it } from 'vitest';
import exempleRaw from '../../../src/assets/cycle-exemple.json?raw';
import { importerCycle } from '../../../src/lib/cycle/valider';
import { enFichiers, fichier, FOYER, quatreFichiers, recette } from './fabrique';

const importer = (fs = quatreFichiers(), ctx = {}) => importerCycle(enFichiers(fs), ctx);

describe('importerCycle — fusion', () => {
  it('fusionne 4 fichiers valides : menus A → D quel que soit l’ordre, rituel et fixes conservés', () => {
    const fs = quatreFichiers().reverse();
    const r = importer(fs);
    expect(r.erreurs).toEqual([]);
    expect(r.cycle?.menus.map((m) => m.lettre)).toEqual(['A', 'B', 'C', 'D']);
    expect(r.cycle?.rituel.etapes[0].id).toBe('rituel-muffins');
    expect(r.cycle?.fixes).toHaveLength(2);
  });

  it('accepte un fichier unique qui contient les 4 menus', () => {
    const [a, ...autres] = quatreFichiers();
    const unique = {
      ...a,
      menus: [a, ...autres].flatMap((f) => f.menus),
      recettes: [a, ...autres].flatMap((f) => f.recettes),
    };
    expect(importer([unique]).erreurs).toEqual([]);
  });

  it('déduplique une recette identique présente dans plusieurs fichiers', () => {
    const fs = quatreFichiers();
    fs[1].recettes.push(fs[0].recettes[0]);
    const r = importer(fs);
    expect(r.erreurs).toEqual([]);
    expect(r.cycle?.recettes.filter((x) => x.id === 'muffins')).toHaveLength(1);
  });

  it('refuse deux recettes de même id au contenu différent', () => {
    const fs = quatreFichiers();
    fs[1].recettes.push(recette('muffins', { nom: 'Autre chose' }));
    expect(importer(fs).erreurs).toContainEqual(expect.stringMatching(/« muffins ».*différent/));
  });

  it('garde les remarques de Claude', () => {
    const fs = quatreFichiers();
    fs[0].remarques = ['Budget réaliste ≈ 118 €'];
    expect(importer(fs).alertes).toContain('Budget réaliste ≈ 118 €');
  });
});

describe('importerCycle — erreurs bloquantes', () => {
  it('signale un JSON illisible avec le nom du fichier', () => {
    const r = importerCycle([{ nom: 'menu-A.json', contenu: '{ pas du json' }]);
    expect(r.cycle).toBeNull();
    expect(r.erreurs[0]).toMatch(/menu-A\.json.*JSON illisible/);
  });

  it('refuse un format ou une version inconnus', () => {
    const fs = quatreFichiers();
    (fs[0] as unknown as { version: number }).version = 1;
    expect(importer(fs).erreurs).toContainEqual(expect.stringMatching(/menu-A\.json.*version/));
  });

  it('signale un champ invalide avec son chemin', () => {
    const fs = quatreFichiers();
    (fs[1].recettes[0].ingredients[0] as unknown as { unite: string }).unite = 'kilo';
    expect(importer(fs).erreurs).toContainEqual(
      expect.stringMatching(/menu-B\.json · recettes\[0\]\.ingredients\[0\]\.unite/),
    );
  });

  it('exige les 4 menus, une seule fois chacun', () => {
    expect(importer(quatreFichiers().slice(0, 3)).erreurs).toContain('Menu D manquant.');
    const fs = quatreFichiers();
    fs.push(fichier('B'));
    expect(importer(fs).erreurs).toContain('Menu B présent plusieurs fois.');
  });

  it('exige 7 jours distincts par menu', () => {
    const fs = quatreFichiers();
    fs[2].menus[0].jours.pop();
    expect(importer(fs).erreurs).toContainEqual(expect.stringMatching(/Menu C.*dimanche/));
  });

  it('exige un rituel, et un seul', () => {
    const sans = quatreFichiers();
    delete sans[0].rituel;
    expect(importer(sans).erreurs).toContain('Rituel du dimanche absent.');
    const deux = quatreFichiers();
    deux[1].rituel = { ...deux[0].rituel!, dureeMin: 99 };
    expect(importer(deux).erreurs).toContain('Plusieurs rituels différents : il en faut un seul pour le cycle.');
  });

  it('détecte les références cassées (recette, boîte, étape du rituel)', () => {
    const fs = quatreFichiers();
    fs[0].menus[0].jours[0].repas[0].recette = 'inconnue';
    fs[1].menus[0].jours[0].repas.push({
      id: 'lundi-dejeuner-alex',
      moment: 'dejeuner',
      pour: ['alex'],
      texte: 'Box',
      boite: { produitePar: 'jeudi', frigoJours: 1 },
    });
    fs[0].rituel!.etapes[0].recette = 'absente';
    const e = importer(fs).erreurs;
    expect(e).toContainEqual(expect.stringMatching(/Menu A.*lundi.*« inconnue »/));
    expect(e).toContainEqual(expect.stringMatching(/Menu B.*boîte.*« jeudi »/));
    expect(e).toContainEqual(expect.stringMatching(/Rituel.*« absente »/));
  });

  it('avec un foyer : refuse un membre inconnu', () => {
    const fs = quatreFichiers();
    fs[0].recettes[1].portions.marc = '1 assiette';
    expect(importer(fs, { membres: FOYER }).erreurs).toContainEqual(expect.stringMatching(/membre inconnu « marc »/));
  });

  it('avec un foyer : exige la version d’un membre au régime spécifique sur un dîner famille', () => {
    const fs = quatreFichiers();
    delete fs[3].recettes[0].variantes;
    expect(importer(fs, { membres: FOYER }).erreurs).toContainEqual(
      expect.stringMatching(/Menu D.*lundi.*version de « sam »/),
    );
  });

  it('avec un foyer : exige les macros d’un membre suivi sur ce qu’il mange', () => {
    const fs = quatreFichiers();
    delete fs[2].recettes[0].macros.alex;
    expect(importer(fs, { membres: FOYER }).erreurs).toContainEqual(expect.stringMatching(/macros de « alex »/));
  });
});

describe('importerCycle — alertes', () => {
  it('budget : signale une semaine estimée au-dessus du plafond', () => {
    // 7 dîners × 1,50 € + muffins 1,50 € + skyr 4 € + whey 20/4 = 21 €
    expect(importer(quatreFichiers(), { budgetMax: 20 }).alertes).toContainEqual(
      expect.stringMatching(/Menu A : courses estimées à 21 €.*plafond de 20 €/),
    );
    expect(importer(quatreFichiers(), { budgetMax: 21 }).alertes).toEqual([]);
  });

  it('keto : signale une journée au-dessus du seuil de glucides', () => {
    const fs = quatreFichiers();
    fs[1].recettes[2].macros.sam.glucides = 40;
    expect(importer(fs, { membres: FOYER }).alertes).toContainEqual(
      expect.stringMatching(/Menu B, mercredi : ≈ 40 g de glucides pour sam/),
    );
  });

  it('variété : signale un menu avec moins de 5 dîners propres', () => {
    const fs = quatreFichiers();
    fs[3].menus[0].jours.forEach((j, i) => {
      if (i < 3) j.repas[0].recette = `diner-a-${j.jour}`;
    });
    fs[3].recettes.push(...fs[0].recettes.filter((r) => r.id.startsWith('diner-a-')).slice(0, 3));
    expect(importer(fs).alertes).toContain('Menu D : seulement 4 dîners propres (au moins 5 attendus).');
  });

  it('signale une recette reprise du cycle précédent', () => {
    expect(importer(quatreFichiers(), { recettesPrecedentes: ['diner-c-mardi'] }).alertes).toContainEqual(
      expect.stringMatching(/« Recette diner-c-mardi » était déjà au cycle précédent/),
    );
  });
});

describe('cycle d’exemple (src/assets/cycle-exemple.json)', () => {
  it('est valide pour le foyer anonymisé et sans alerte au plafond de 125 €', () => {
    const r = importerCycle([{ nom: 'cycle-exemple.json', contenu: exempleRaw }], {
      membres: FOYER,
      budgetMax: 125,
    });
    expect(r.erreurs).toEqual([]);
    expect(r.alertes).toEqual([]);
    expect(r.cycle?.menus).toHaveLength(4);
  });
});
