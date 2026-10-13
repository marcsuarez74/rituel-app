import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Guide } from '../src/components/ecrans/Guide';
import { MonCycle } from '../src/components/ecrans/MonCycle';
import { SemaineType } from '../src/components/ecrans/SemaineType';
import { Rituel } from '../src/components/ecrans/Rituel';
import { useMinuteurs } from '../src/components/useMinuteurs';
import { Courses } from '../src/components/ecrans/Courses';
import { Recette } from '../src/components/ecrans/Recette';
import { type CycleActif, type Membre, type ReglagesFoyer, foyerParDefaut, loadCycle, loadFoyer } from '../src/lib/cycle/etat';
import { garderProfilFoyer, getChecks, getDepenses, loadExplique, saveExplique, setCheck } from '../src/lib/storage';
import { importerCycle } from '../src/lib/cycle/valider';
import { enFichiers, foyerDuo, quatreFichiers } from './lib/cycle/fabrique';

const MEMBRES: Membre[] = [
  { id: 'alex', prenom: 'Alex', type: 'adulte', suivi: true },
  { id: 'sam', prenom: 'Sam', type: 'adulte', suivi: true, regime: 'keto' },
];

const cycle = () => {
  const fs = quatreFichiers();
  fs[0].rituel!.etapes[0].recette = 'diner-a-lundi';
  return importerCycle(enFichiers(fs)).cycle!;
};

const fiche = (moi = 'alex') => (
  <Recette cycle={cycle()} recetteId="diner-a-lundi" membres={MEMBRES} moi={moi} syncVersion={0} onRetour={() => {}} />
);

describe('Recette', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('macros et portion du membre actif, bascule vers la version d’un autre membre', async () => {
    const user = userEvent.setup();
    render(fiche());
    expect(screen.getByRole('heading', { level: 1, name: 'Recette diner-a-lundi' })).toBeInTheDocument();
    expect(screen.getByText('600')).toBeInTheDocument(); // kcal d'Alex
    expect(screen.queryByText('Version de Sam')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Sam' }));
    expect(screen.getByRole('heading', { name: 'Par portion · Sam' })).toBeInTheDocument();
    expect(screen.getByText('450')).toBeInTheDocument();
    expect(screen.getByText('Version de Sam')).toBeInTheDocument();
    expect(screen.getByText('Sans féculent')).toBeInTheDocument();
  });

  it('ingrédients pour le foyer cochables, quantités formatées, placard signalé ; lien au rituel', async () => {
    const user = userEvent.setup();
    render(fiche());
    const oeufs = screen.getByRole('button', { name: /×6 Œufs/ });
    expect(screen.getByText(/· placard/)).toBeInTheDocument();
    await user.click(oeufs);
    expect(oeufs).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: /Ingrédients · pour le foyer 1\/2/ })).toBeInTheDocument();
    expect(screen.getByText('Lié au rituel')).toBeInTheDocument();
    expect(screen.getByText('0-20 min · Muffins')).toBeInTheDocument();
  });

  it('étape avec minuteur : décompte, puis « Terminé »', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(fiche());
    await user.click(screen.getByRole('button', { name: /Minuteur 10 min/ }));
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(screen.getByRole('button', { name: /08:59 · Arrêter/ })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(9 * 60_000);
    });
    expect(screen.getByRole('button', { name: /Terminé/ })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('interrupteur « Garder l’écran allumé » : verrou d’écran demandé puis relâché', async () => {
    const user = userEvent.setup();
    const release = vi.fn().mockResolvedValue(undefined);
    let surRelache = () => {};
    const request = vi.fn().mockResolvedValue({
      release,
      addEventListener: (_: string, f: () => void) => {
        surRelache = f;
      },
    });
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    render(fiche());
    const inter = screen.getByRole('switch', { name: /Garder l'écran allumé/ });
    expect(inter).not.toBeChecked();
    await user.click(inter);
    expect(request).toHaveBeenCalledWith('screen');
    expect(inter).toBeChecked();
    await user.click(inter);
    expect(release).toHaveBeenCalled();
    expect(inter).not.toBeChecked();
    await user.click(inter);
    act(() => surRelache()); // app en arrière-plan : le navigateur relâche le verrou
    expect(inter).not.toBeChecked();
    Reflect.deleteProperty(navigator, 'wakeLock');
  });

  it('sans repas d’origine : pas de « C’est fait »', () => {
    render(fiche());
    expect(screen.queryByRole('button', { name: "C'est fait" })).not.toBeInTheDocument();
  });
});

describe('Courses', () => {
  const foyer = (budgetMax?: number): ReglagesFoyer => ({ ...foyerParDefaut(null), ...(budgetMax ? { budgetMax } : {}) });
  const actif = (): CycleActif => ({ id: 'c1', numero: 1, debut: '2026-10-03', pauses: [], cycle: cycle() });
  const ecran = (budgetMax?: number) => (
    <Courses actif={actif()} foyer={foyer(budgetMax)} semaine={0} aujourdhui="2026-10-03" syncVersion={0} />
  );

  beforeEach(() => {
    localStorage.clear();
  });

  it("pas de ligne « extras keto » sans membre keto ni article keto", () => {
    const sansKeto = (): CycleActif => {
      const c = actif();
      for (const r of c.cycle.recettes) for (const i of r.ingredients) if (i.rayon === 'keto') i.rayon = 'epicerie';
      for (const f of c.cycle.fixes) if (f.rayon === 'keto') f.rayon = 'epicerie';
      return c;
    };
    const f = foyer();
    render(<Courses actif={sansKeto()} foyer={{ ...f, membres: f.membres.map((m) => ({ ...m, regime: undefined })) }} semaine={0} aujourdhui="2026-10-03" syncVersion={0} />);
    expect(screen.queryByText(/extras keto/)).not.toBeInTheDocument();
    expect(screen.getByText(/éléments fixes/)).toBeInTheDocument();
  });

  it("ligne « extras keto » affichée dès qu'un membre est keto", () => {
    const f = foyer();
    render(<Courses actif={actif()} foyer={{ ...f, membres: [...f.membres, { id: 'k', prenom: 'K', type: 'adulte', suivi: false, regime: 'keto' }] }} semaine={0} aujourdhui="2026-10-03" syncVersion={0} />);
    expect(screen.getByText(/extras keto/)).toBeInTheDocument();
  });

  it('carte Estimé / Payé / Max, détail keto + fixes, alerte au-dessus du plafond', () => {
    const { unmount } = render(ecran(30));
    expect(screen.getByText('Estimé').nextSibling).toHaveTextContent('≈ 20 €'); // 7 dîners (le rituel reprend celui de lundi) + fixes
    expect(screen.getByText('Max').nextSibling).toHaveTextContent('30 €');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    unmount();
    render(ecran(15));
    expect(screen.getByText('Estimé').parentElement).toHaveClass('alerte');
    expect(screen.getByRole('status')).toHaveTextContent('≈ 5 € au-dessus de ton plafond.');
  });

  it('rayons dans l’ordre, badge rituel, coche persistée, placard à part', async () => {
    const user = userEvent.setup();
    render(ecran());
    const titres = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titres).toEqual(['Protéines', 'Laitiers', 'Épicerie']);
    const oeufs = screen.getByRole('button', { name: /Œufs/ });
    expect(oeufs).toHaveTextContent('rituel');
    await user.click(oeufs);
    expect(getChecks('cycle:c1:0')).toEqual({ 'courses:A:proteines:oeuf': true });
    expect(screen.getByText(/Dans le chariot/)).toHaveTextContent('1 / 3');
    expect(screen.getByText(/À vérifier au placard · 1/)).toBeInTheDocument();
  });

  it('mode magasin : masque le coché ; « J’ai payé… » enregistre la dépense de la semaine', async () => {
    const user = userEvent.setup();
    render(ecran());
    await user.click(screen.getByRole('button', { name: /Œufs/ }));
    await user.click(screen.getByRole('button', { name: /Mode magasin/ }));
    expect(screen.queryByRole('button', { name: /Œufs/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Protéines' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /J'ai payé/ }));
    await user.type(screen.getByLabelText('Total du ticket (€)'), '54,30');
    fireEvent.submit(document.querySelector('.ticket')!);
    expect(getDepenses()).toEqual([{ date: '2026-10-03', magasin: 'Courses', total: 54.3 }]);
    expect(screen.getByText('Payé').nextSibling).toHaveTextContent('54,30');
  });
});

describe('Rituel (écran v2 : vignettes, grille, plats, pied)', () => {
  const DIMANCHE = '2026-10-11'; // dimanche, jour du rituel par défaut
  const actifRituel = (): CycleActif => {
    const fs = quatreFichiers();
    fs[0].rituel!.etapes.push({ id: 'rituel-sauce', creneau: '20-40 min', label: 'Sauce', detail: 'Mijoter.', enParallele: 'Les muffins cuisent.' });
    fs[0].menus[0].reserve = [{ pour: 'jeudi', plat: '½ sauce tomate', conservation: 'Congélateur' }];
    fs[0].menus[0].rappelsRituel = ['Colin : congélateur → frigo'];
    // Mardi soir vient d'une boîte du rituel : grille « préparée dimanche » + reste au frigo.
    fs[0].menus[0].jours[1].repas[0].boite = { produitePar: 'rituel-muffins', frigoJours: 2 };
    return { id: 'c1', numero: 1, debut: '2026-10-03', pauses: [], cycle: importerCycle(enFichiers(fs)).cycle! };
  };
  const RituelEtat = ({
    aujourdhui = DIMANCHE,
    onGuide = () => {},
    onRecette = () => {},
  }: {
    aujourdhui?: string;
    onGuide?: (n: number) => void;
    onRecette?: (id: string) => void;
  }) => (
    <Rituel
      actif={actifRituel()}
      foyer={foyerParDefaut(null)}
      semaine={0}
      syncVersion={0}
      aujourdhui={aujourdhui}
      onGuide={onGuide}
      onOuvrirRecette={onRecette}
    />
  );

  beforeEach(() => {
    localStorage.clear();
  });

  it("première visite : la feuille d'explication en 3 vignettes, « J'ai compris » la referme pour toujours", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<RituelEtat />);
    const feuille = screen.getByRole('dialog');
    expect(within(feuille).getByRole('heading', { name: /Le rituel, c.est quoi/ })).toBeInTheDocument();
    expect(within(feuille).getByText(/Tu cuisines environ 50 min/)).toBeInTheDocument();
    expect(within(feuille).getByText(/Au frigo, au congélateur et dans les box/)).toBeInTheDocument();
    expect(within(feuille).getByText(/plus qu.à réchauffer/)).toBeInTheDocument();
    await user.click(within(feuille).getByRole('button', { name: "J'ai compris" }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(loadExplique()).toBe(true);
    unmount();
    render(<RituelEtat />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Ce dimanche, tu prépares')).toBeInTheDocument();
  });

  it('relisible via « C\'est quoi le rituel ? »', async () => {
    const user = userEvent.setup();
    saveExplique(true);
    render(<RituelEtat />);
    await user.click(screen.getByRole('button', { name: /C.est quoi le rituel/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "J'ai compris" }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('jour du rituel : résumé chiffré, grille libellée, légende et plats à cuisiner', async () => {
    const user = userEvent.setup();
    saveExplique(true);
    const onRecette = vi.fn();
    render(<RituelEtat onRecette={onRecette} />);
    expect(screen.getByText('Ce dimanche, tu prépares')).toBeInTheDocument();
    expect(screen.getByText(/1 plat en 50 min environ, pour 1 repas de la semaine/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Mardi soir : Recette diner-a-mardi, préparée dimanche' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Lundi soir : Recette diner-a-lundi, fait le jour même' })).toBeInTheDocument();
    expect(screen.getByText('Cuisiné dimanche')).toBeInTheDocument();
    expect(screen.getByText('Fait le jour même')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'À cuisiner dimanche' })).toBeInTheDocument();
    const carte = screen.getByRole('button', { name: /Recette muffins/ });
    expect(carte).toHaveTextContent('Pour mardi soir');
    await user.click(carte);
    expect(onRecette).toHaveBeenCalledWith('muffins');
    expect(screen.getByRole('button', { name: /C.est quoi le rituel/ })).toBeInTheDocument();
  });

  it('pas encore commencé : le pied propose « Commencer » qui ouvre le mode guidé à l\'étape 1', async () => {
    saveExplique(true);
    const user = userEvent.setup();
    const onGuide = vi.fn();
    render(<RituelEtat onGuide={onGuide} />);
    await user.click(screen.getByRole('button', { name: 'Commencer' }));
    expect(onGuide).toHaveBeenCalledWith(0);
  });

  it('déjà commencé : le pied propose « Reprendre, étape 2 »', async () => {
    saveExplique(true);
    setCheck('cycle:c1:0', 'rituel:A:rituel-muffins', true);
    render(<RituelEtat />);
    expect(screen.getByRole('button', { name: 'Reprendre, étape 2' })).toBeInTheDocument();
  });

  it('en semaine : « Au frigo cette semaine » d\'abord, puis l\'aperçu du prochain dimanche', () => {
    saveExplique(true);
    render(<RituelEtat aujourdhui="2026-10-13" />);
    const frigo = screen.getByRole('heading', { name: 'Au frigo cette semaine' });
    const apercu = screen.getByText('Ce dimanche, tu prépares');
    expect(frigo.compareDocumentPosition(apercu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Tout ce que tu as préparé dimanche. Ça se vide au fil des repas.')).toBeInTheDocument();
    expect(screen.getByText('Recette diner-a-mardi')).toBeInTheDocument();
    expect(screen.getByText('À manger avant mardi 13 octobre')).toBeInTheDocument();
  });
});

describe('mode guidé v2 (barre minuteurs, gestes, On range, fin)', () => {
  const DIMANCHE = '2026-10-11';
  const actifGuide = (): CycleActif => {
    const fs = quatreFichiers();
    fs[0].rituel!.etapes[0].sousEtapes = ['Battre les œufs', 'Remplir les moules'];
    fs[0].rituel!.etapes[0].minuteurs = [{ nom: 'Four', minutes: 18, recette: 'muffins' }];
    fs[0].rituel!.etapes.push({ id: 'rituel-sauce', creneau: '20-40 min', label: 'Sauce', detail: 'Mijoter.', enParallele: 'Les muffins cuisent.' });
    fs[0].menus[0].reserve = [{ pour: 'jeudi', plat: '½ sauce tomate', conservation: 'Congélateur' }];
    fs[0].menus[0].rappelsRituel = ['Colin : congélateur → frigo'];
    fs[0].menus[0].jours[1].repas[0].boite = { produitePar: 'rituel-muffins', frigoJours: 2 };
    return { id: 'c1', numero: 1, debut: '2026-10-03', pauses: [], cycle: importerCycle(enFichiers(fs)).cycle! };
  };
  const GuideEtat = ({ aujourdhui = DIMANCHE, onQuitter = () => {} }: { aujourdhui?: string; onQuitter?: () => void }) => {
    const [etape, setEtape] = useState(0);
    const minuteurs = useMinuteurs();
    return (
      <Guide
        actif={actifGuide()}
        foyer={foyerParDefaut(null)}
        aujourdhui={aujourdhui}
        semaine={0}
        etape={etape}
        syncVersion={0}
        minuteurs={minuteurs}
        onEtape={setEtape}
        onQuitter={onQuitter}
      />
    );
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it("étape 1 : plats concernés → feuille ingrédients intégrée, gestes persistés, rappels", async () => {
    const user = userEvent.setup();
    render(<GuideEtat />);
    expect(screen.getByText(/Étape 1 sur 3/)).toBeInTheDocument();
    expect(screen.getByText('Colin : congélateur → frigo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Recette muffins : voir les ingrédients/ }));
    const feuille = screen.getByRole('dialog');
    expect(within(feuille).getByText('Œufs')).toBeInTheDocument();
    expect(within(feuille).getByText('×6')).toBeInTheDocument();
    await user.click(within(feuille).getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Battre les œufs' }));
    expect(getChecks('cycle:c1:0')['geste:A:rituel-muffins:0']).toBe(true);
  });

  it("bouton minuteur : lance, la barre décompte, alerte à l'échéance, OK la retire", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-10-11T10:00:00'));
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<GuideEtat />);
      await user.click(screen.getByRole('button', { name: /Four · 18 min/ }));
      expect(screen.getAllByText('18:00')).toHaveLength(2); // puce de la barre + bouton de l'étape
      act(() => {
        vi.advanceTimersByTime(18 * 60_000 + 1_000);
      });
      expect(screen.getByText(/Four : prêt !/)).toBeInTheDocument();
      const alerte = screen.getByRole('alert');
      expect(alerte).toHaveTextContent("Four : c'est prêt !");
      await user.click(within(alerte).getByRole('button', { name: 'OK' }));
      expect(screen.queryByRole('alert')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("« Étape suivante » coche l'étape, « Précédente » revient sans décocher", async () => {
    const user = userEvent.setup();
    render(<GuideEtat />);
    await user.click(screen.getByRole('button', { name: 'Étape suivante' }));
    expect(getChecks('cycle:c1:0')['rituel:A:rituel-muffins']).toBe(true);
    expect(screen.getByText(/Étape 2 sur 3/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Précédente/ }));
    expect(screen.getByText(/Étape 1 sur 3/)).toBeInTheDocument();
    expect(getChecks('cycle:c1:0')['rituel:A:rituel-muffins']).toBe(true);
  });

  it("On range : zones, « Encore 2 à ranger » désactivé, coches range:, puis « Tout est rangé »", async () => {
    const user = userEvent.setup();
    render(<GuideEtat />);
    await user.click(screen.getByRole('button', { name: 'Étape suivante' }));
    await user.click(screen.getByRole('button', { name: 'Étape suivante' }));
    expect(screen.getByRole('heading', { name: 'On range' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Encore 2 à ranger' })).toBeDisabled();
    expect(screen.getByText('Recette diner-a-mardi')).toBeInTheDocument();
    expect(screen.getByText('Sors-le la veille')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Recette diner-a-mardi/ }));
    await user.click(screen.getByRole('button', { name: /½ sauce tomate/ }));
    const coches = getChecks('cycle:c1:0');
    expect(coches['range:A:mardi-diner-famille']).toBe(true);
    expect(coches['range:A:sauce-tomate']).toBe(true);
    expect(screen.getByRole('button', { name: 'Tout est rangé' })).toBeEnabled();
  });

  it("fin : « Ta semaine est prête ! », récap chiffré, confettis, « Voir ce qu'il y a au frigo »", async () => {
    const user = userEvent.setup();
    const onQuitter = vi.fn();
    render(<GuideEtat onQuitter={onQuitter} />);
    await user.click(screen.getByRole('button', { name: 'Étape suivante' }));
    await user.click(screen.getByRole('button', { name: 'Étape suivante' }));
    await user.click(screen.getByRole('button', { name: /Recette diner-a-mardi/ }));
    await user.click(screen.getByRole('button', { name: /½ sauce tomate/ }));
    await user.click(screen.getByRole('button', { name: 'Tout est rangé' }));
    expect(screen.getByRole('heading', { name: 'Ta semaine est prête !' })).toBeInTheDocument();
    expect(screen.getByText(/1 repas prêt/)).toBeInTheDocument();
    expect(document.querySelectorAll('.confetti').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /Voir ce qu.il y a au frigo/ }));
    expect(onQuitter).toHaveBeenCalledOnce();
  });

  it('prefers-reduced-motion : pas de confettis', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    render(<GuideEtat />);
    await user.click(screen.getByRole('button', { name: 'Étape suivante' }));
    await user.click(screen.getByRole('button', { name: 'Étape suivante' }));
    await user.click(screen.getByRole('button', { name: /Recette diner-a-mardi/ }));
    await user.click(screen.getByRole('button', { name: /½ sauce tomate/ }));
    await user.click(screen.getByRole('button', { name: 'Tout est rangé' }));
    expect(screen.getByRole('heading', { name: 'Ta semaine est prête !' })).toBeInTheDocument();
    expect(document.querySelectorAll('.confetti')).toHaveLength(0);
  });
});

describe('Mon cycle', () => {
  const profilMarc = { id: 'marc' as const, objectif: { type: 'perte' as const }, complements: [], regime: 'aucun' as const };
  const foyerTest = (): ReglagesFoyer => ({
    ...foyerParDefaut(null),
    membres: [
      { id: 'alex', prenom: 'Alex', type: 'adulte', suivi: true },
      { id: 'sam', prenom: 'Sam', type: 'adulte', suivi: true, regime: 'keto' },
      { id: 'lou', prenom: 'Lou', type: 'enfant', suivi: false },
      { id: 'noa', prenom: 'Noa', type: 'enfant', suivi: false },
    ],
  });
  const Ecran = ({ stocke: initial = null as CycleActif | null }) => {
    const [stocke, setStocke] = useState(initial);
    return (
      <MonCycle
        stocke={stocke}
        foyer={foyerTest()}
        profil={profilMarc}
        aujourdhui="2026-10-07"
        onRetour={() => {}}
        onCycle={setStocke}
        onFoyer={() => {}}
        onVoirCourses={() => {}}
      />
    );
  };
  const deposer = (fichiers: object[]) =>
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: fichiers.map((f, i) => new File([JSON.stringify(f)], `menu-${'ABCD'[i]}.json`, { type: 'application/json' })) },
    });

  beforeEach(() => {
    localStorage.clear();
  });

  it('sans cycle : génération en 3 étapes, import des 4 fichiers, aperçu, démarrage', async () => {
    const user = userEvent.setup();
    render(<Ecran />);
    await user.click(screen.getByRole('button', { name: 'Créer mes premiers menus' }));
    expect(screen.getByRole('link', { name: 'Ouvrir Claude' })).toHaveAttribute('href', 'https://claude.ai/new');

    deposer(quatreFichiers());
    expect(await screen.findByRole('heading', { name: 'Aperçu des 4 semaines' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'À corriger avant de démarrer' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Début des menus/)).toHaveValue('2026-10-10'); // prochain samedi

    await user.click(screen.getByRole('button', { name: 'Démarrer les menus' }));
    expect(screen.getByRole('heading', { name: 'Menus n° 1 prêts' })).toBeInTheDocument();
    expect(loadCycle()).toMatchObject({ numero: 1, debut: '2026-10-10', pauses: [] });
  });

  it('import : aperçu rassurant, sans liste exhaustive ; notes de l’IA dédoublonnées dans un repli', async () => {
    const user = userEvent.setup();
    render(<Ecran />);
    await user.click(screen.getByRole('button', { name: 'Créer mes premiers menus' }));
    const fs = quatreFichiers();
    fs.forEach((f) => {
      f.remarques = ['Estimation à 118 € par semaine.', 'Menu varié.'];
      f.recettes[0].ingredients.push({ nom: 'Z', quantite: 25, unite: 'cl', rayon: 'fruits-legumes', prixEstime: 1 } as never);
    });
    deposer(fs);
    expect(await screen.findByRole('heading', { name: 'Tes menus sont prêts' })).toBeInTheDocument();
    expect(screen.queryByText('À savoir')).not.toBeInTheDocument();
    expect(screen.queryByText(/corrigé en/)).not.toBeInTheDocument();
    const resume = screen.getByText(/Notes de ton IA \(2\)/);
    expect(resume.closest('details')).not.toHaveAttribute('open');
    await user.click(resume);
    expect(screen.getAllByText('Menu varié.')).toHaveLength(1);
    expect(screen.getByText(/rangés? automatiquement/)).toBeInTheDocument();
  });

  it('import : début dans le passé accepté, le jour des courses suit', async () => {
    const user = userEvent.setup();
    render(<Ecran />);
    await user.click(screen.getByRole('button', { name: 'Créer mes premiers menus' }));
    deposer(quatreFichiers());
    // fireEvent.change : la saisie clavier d'un <input type="date"> n'est pas fiable sous happy-dom.
    fireEvent.change(await screen.findByLabelText(/Début des menus/), { target: { value: '2026-10-04' } }); // dimanche passé
    expect(screen.getByText('Le jour des courses passe au dimanche.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Démarrer les menus' }));
    expect(loadCycle()?.debut).toBe('2026-10-04');
    expect(loadFoyer()?.jourCourses).toBe('dimanche');
  });

  it('cycle en cours : changer la date de début (coches gardées), ou annuler', async () => {
    const user = userEvent.setup();
    const c: CycleActif = { id: 'c1', numero: 2, debut: '2026-09-26', pauses: [], cycle: cycle() };
    render(<Ecran stocke={c} />);
    await user.click(screen.getByRole('button', { name: 'Changer la date de début' }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByLabelText(/Début des menus/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Changer la date de début' }));
    const champ = screen.getByLabelText(/Début des menus/);
    expect(champ).toHaveValue('2026-09-26');
    fireEvent.change(champ, { target: { value: '2026-09-23' } }); // un mercredi
    expect(screen.getByText('Le jour des courses passe au mercredi.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(loadCycle()).toMatchObject({ id: 'c1', debut: '2026-09-23' });
    expect(loadFoyer()?.jourCourses).toBe('mercredi');
    expect(screen.getByRole('heading', { name: 'Semaine 3 sur 4' })).toBeInTheDocument();
  });

  it('le prompt copié détaille aussi les autres membres suivis (profil reçu par la sync)', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    garderProfilFoyer({ id: 'sam', prenom: 'Sam', objectif: { type: 'masse' }, complements: [], regime: 'keto', taille: 170 });
    render(<Ecran />);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await user.click(screen.getByRole('button', { name: 'Créer mes premiers menus' }));
    await user.click(screen.getByRole('button', { name: /Copier le prompt/ }));
    expect(writeText.mock.calls[0][0]).toContain('- sam (Sam) · adulte · suivi · régime keto · objectif : prendre de la masse · 170 cm');
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('fichiers incomplets : erreurs bloquantes, message à recoller pour Claude', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    render(<Ecran />);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await user.click(screen.getByRole('button', { name: 'Créer mes premiers menus' }));
    deposer(quatreFichiers().slice(0, 3));
    expect(await screen.findByRole('heading', { name: 'À corriger avant de démarrer' })).toBeInTheDocument();
    expect(screen.getByText('Menu D manquant.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Démarrer les menus' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Copier pour Claude/ }));
    expect(writeText.mock.calls[0][0]).toContain('- Menu D manquant.');
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('cycle en cours : semaines A-D, verrou, pause après la semaine en cours', async () => {
    const user = userEvent.setup();
    const c: CycleActif = { id: 'c1', numero: 2, debut: '2026-09-26', pauses: [], cycle: cycle() };
    render(<Ecran stocke={c} />);
    expect(screen.getByRole('heading', { name: 'Semaine 2 sur 4' })).toBeInTheDocument();
    expect(screen.getByText(/Prochains menus le 24 oct./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Créer/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Faire une pause après cette semaine' }));
    expect(loadCycle()?.pauses).toEqual([1]);
    expect(screen.getByText(/Prochains menus le 31 oct./)).toBeInTheDocument();
  });

  it('menus terminés : relancer les mêmes menus au prochain jour des courses', async () => {
    const user = userEvent.setup();
    const c: CycleActif = { id: 'c1', numero: 2, debut: '2026-09-05', pauses: [], cycle: cycle() };
    render(<Ecran stocke={c} />);
    expect(screen.getByText('Menus n° 2 terminés')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Relancer les menus' }));
    expect(screen.getByRole('heading', { name: 'Menus n° 3 prêts' })).toBeInTheDocument();
    expect(loadCycle()).toMatchObject({ numero: 3, debut: '2026-10-10', relanceDe: 'c1' });
  });
});

describe('Semaine type', () => {
  it('un adulte sans téléphone (doublon) se retire ; un membre avec téléphone jamais', async () => {
    const user = userEvent.setup();
    const onEnregistrer = vi.fn();
    const f = foyerDuo();
    f.membres[0] = { ...f.membres[0], telephone: true };
    render(<SemaineType foyer={f} onEnregistrer={onEnregistrer} onRetour={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Retirer Marc' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retirer Mélanie' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect((onEnregistrer.mock.calls[0][0] as ReglagesFoyer).membres.map((m) => m.id)).toEqual(['marc']);
  });

  it('foyer, rythme, jour par jour, exceptions → enregistrés ensemble', async () => {
    const user = userEvent.setup();
    const onEnregistrer = vi.fn();
    render(<SemaineType foyer={foyerDuo()} onEnregistrer={onEnregistrer} onRetour={() => {}} />);

    await user.selectOptions(screen.getByLabelText(/Jour des courses/), 'vendredi');
    await user.type(screen.getByLabelText("Prénom d'un enfant"), 'Maëlle');
    await user.click(screen.getAllByRole('button', { name: 'Ajouter' })[0]);
    expect(screen.getByText('Maëlle')).toBeInTheDocument();

    const titreLundi = screen.getByText('Lundi', { selector: 'summary b' });
    const lundi = titreLundi.closest('details')!;
    await user.click(titreLundi);
    await user.click(within(within(lundi).getByRole('radiogroup', { name: 'Déjeuner de Marc' })).getByRole('radio', { name: 'box' }));
    await user.click(within(within(lundi).getByRole('radiogroup', { name: 'Dîner' })).getByRole('radio', { name: 'rapide' }));
    await user.click(within(lundi).getByLabelText('Mélanie dîne plus tard'));
    expect(within(lundi).getByText('dîner rapide · 1 box · 1 plus tard')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Quand'), '1er et 3e vendredis');
    await user.type(screen.getByLabelText('Ce qui change'), 'resto à deux');
    await user.click(screen.getAllByRole('button', { name: 'Ajouter' })[1]);

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    const f = onEnregistrer.mock.calls[0][0] as ReglagesFoyer;
    expect(f.jourCourses).toBe('vendredi');
    expect(f.membres.map((m) => m.id)).toEqual(['marc', 'melanie', 'maelle']);
    expect(f.semaine.lundi).toMatchObject({ dejeuner: { marc: 'box', maelle: 'dehors' }, diner: 'rapide', plusTard: ['melanie'] });
    expect(f.exceptions).toEqual([{ regle: '1er et 3e vendredis', effet: 'resto à deux', actif: true }]);
  });

  it('étape « Ta semaine » : compacte, Passer garde les valeurs par défaut', async () => {
    const user = userEvent.setup();
    const onEnregistrer = vi.fn();
    render(<SemaineType foyer={foyerParDefaut(null)} compact onEnregistrer={onEnregistrer} onRetour={() => {}} />);
    expect(screen.queryByText('Jour par jour')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    expect(onEnregistrer).toHaveBeenCalledWith(foyerParDefaut(null));
  });
});
