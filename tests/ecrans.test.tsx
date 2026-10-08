import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Guide } from '../src/components/ecrans/Guide';
import { MonCycle } from '../src/components/ecrans/MonCycle';
import { SemaineType } from '../src/components/ecrans/SemaineType';
import { Rituel, type VueRituel } from '../src/components/ecrans/Rituel';
import { Courses } from '../src/components/ecrans/Courses';
import { Recette } from '../src/components/ecrans/Recette';
import { type CycleActif, type Membre, type ReglagesFoyer, foyerParDefaut, loadCycle, loadFoyer } from '../src/lib/cycle/etat';
import { garderProfilFoyer, getChecks, getDepenses } from '../src/lib/storage';
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

describe('Rituel', () => {
  const actifRituel = (): CycleActif => {
    const fs = quatreFichiers();
    fs[0].rituel!.etapes.push({ id: 'rituel-sauce', creneau: '20-40 min', label: 'Sauce', detail: 'Mijoter.', enParallele: 'Les muffins cuisent.' });
    fs[0].menus[0].reserve = [{ pour: 'jeudi', plat: '½ sauce tomate', conservation: 'Congélateur' }];
    fs[0].menus[0].rappelsRituel = ['Colin : congélateur → frigo'];
    return { id: 'c1', numero: 1, debut: '2026-10-03', pauses: [], cycle: importerCycle(enFichiers(fs)).cycle! };
  };
  const RituelEtat = ({ onGuide = () => {} }: { onGuide?: () => void }) => {
    const [vue, setVue] = useState<VueRituel>('jour');
    return (
      <Rituel actif={actifRituel()} foyer={foyerParDefaut(null)} semaine={0} syncVersion={0} vue={vue} onVue={setVue} onGuide={onGuide} onOuvrirRecette={() => {}} />
    );
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('jour du rituel : résumé, rappels de la semaine, avant de commencer, déroulé dépliable et cochable', async () => {
    const user = userEvent.setup();
    const onGuide = vi.fn();
    render(<RituelEtat onGuide={onGuide} />);
    expect(screen.getByRole('tab', { name: 'Dimanche', selected: true })).toBeInTheDocument();
    expect(screen.getByText('Dimanche · 50 min · 2 étapes')).toBeInTheDocument();
    expect(screen.getByText('Cette semaine aussi')).toBeInTheDocument(); // replié

    await user.click(screen.getByRole('button', { name: /Sauce$/ }));
    expect(screen.getByText('Mijoter.')).toBeInTheDocument();
    expect(screen.getByText('Les muffins cuisent.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sauce : marquer comme fait' }));
    expect(getChecks('cycle:c1:0')).toEqual({ 'rituel:A:rituel-sauce': true });

    await user.click(screen.getByRole('button', { name: /Lancer le mode guidé/ }));
    expect(onGuide).toHaveBeenCalledOnce();
  });

  it('en semaine (micro-batch) et réserve « au frigo » → « mangé »', async () => {
    const user = userEvent.setup();
    render(<RituelEtat />);
    await user.click(screen.getByRole('tab', { name: 'En semaine' }));
    expect(screen.getByText('Doubler le plat')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Réserve' }));
    const sauce = screen.getByRole('button', { name: /½ sauce tomate/ });
    expect(sauce).toHaveTextContent('Jeudi');
    expect(sauce).toHaveTextContent('Au frigo');
    await user.click(sauce);
    expect(sauce).toHaveTextContent('Mangé');
    expect(getChecks('cycle:c1:0')).toEqual({ 'reserve:A:sauce-tomate': true });
  });

  it('mode guidé : une étape par écran, « Suivant » coche, écran de fin', async () => {
    const user = userEvent.setup();
    const GuideEtat = () => {
      const [etape, setEtape] = useState(0);
      return (
        <Guide actif={actifRituel()} semaine={0} etape={etape} syncVersion={0} onEtape={setEtape} onQuitter={() => {}} onReserve={() => {}} onOuvrirRecette={() => {}} />
      );
    };
    render(<GuideEtat />);
    expect(screen.getByText('Étape 1 sur 2')).toBeInTheDocument();
    expect(screen.getByText('Colin : congélateur → frigo')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Muffins' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Précédent' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Sauce' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Terminer' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Rituel terminé !' })).toBeInTheDocument();
    expect(screen.getByText('Fini.')).toBeInTheDocument();
    expect(getChecks('cycle:c1:0')).toEqual({ 'rituel:A:rituel-muffins': true, 'rituel:A:rituel-sauce': true });
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
    await user.click(screen.getByRole('button', { name: 'Créer mon premier cycle' }));
    expect(screen.getByRole('link', { name: 'Ouvrir Claude' })).toHaveAttribute('href', 'https://claude.ai/new');

    deposer(quatreFichiers());
    expect(await screen.findByRole('heading', { name: 'Aperçu des 4 semaines' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'À corriger avant de démarrer' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Début du cycle/)).toHaveValue('2026-10-10'); // prochain samedi

    await user.click(screen.getByRole('button', { name: 'Démarrer le cycle' }));
    expect(screen.getByRole('heading', { name: 'Cycle 1 prêt' })).toBeInTheDocument();
    expect(loadCycle()).toMatchObject({ numero: 1, debut: '2026-10-10', pauses: [] });
  });

  it('import : début dans le passé accepté, le jour des courses suit', async () => {
    const user = userEvent.setup();
    render(<Ecran />);
    await user.click(screen.getByRole('button', { name: 'Créer mon premier cycle' }));
    deposer(quatreFichiers());
    // fireEvent.change : la saisie clavier d'un <input type="date"> n'est pas fiable sous happy-dom.
    fireEvent.change(await screen.findByLabelText(/Début du cycle/), { target: { value: '2026-10-04' } }); // dimanche passé
    expect(screen.getByText('Le jour des courses passe au dimanche.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Démarrer le cycle' }));
    expect(loadCycle()?.debut).toBe('2026-10-04');
    expect(loadFoyer()?.jourCourses).toBe('dimanche');
  });

  it('cycle en cours : changer la date de début (coches gardées), ou annuler', async () => {
    const user = userEvent.setup();
    const c: CycleActif = { id: 'c1', numero: 2, debut: '2026-09-26', pauses: [], cycle: cycle() };
    render(<Ecran stocke={c} />);
    await user.click(screen.getByRole('button', { name: 'Changer la date de début' }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByLabelText(/Début du cycle/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Changer la date de début' }));
    const champ = screen.getByLabelText(/Début du cycle/);
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
    await user.click(screen.getByRole('button', { name: 'Créer mon premier cycle' }));
    await user.click(screen.getByRole('button', { name: /Copier le prompt/ }));
    expect(writeText.mock.calls[0][0]).toContain('- sam (Sam) · adulte · suivi · régime keto · objectif : prendre de la masse · 170 cm');
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('fichiers incomplets : erreurs bloquantes, message à recoller pour Claude', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    render(<Ecran />);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await user.click(screen.getByRole('button', { name: 'Créer mon premier cycle' }));
    deposer(quatreFichiers().slice(0, 3));
    expect(await screen.findByRole('heading', { name: 'À corriger avant de démarrer' })).toBeInTheDocument();
    expect(screen.getByText('Menu D manquant.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Démarrer le cycle' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Copier pour Claude/ }));
    expect(writeText.mock.calls[0][0]).toContain('- Menu D manquant.');
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('cycle en cours : semaines A-D, verrou, pause après la semaine en cours', async () => {
    const user = userEvent.setup();
    const c: CycleActif = { id: 'c1', numero: 2, debut: '2026-09-26', pauses: [], cycle: cycle() };
    render(<Ecran stocke={c} />);
    expect(screen.getByRole('heading', { name: 'Semaine 2 sur 4' })).toBeInTheDocument();
    expect(screen.getByText(/Prochain cycle le 24 oct\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Créer/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Faire une pause après cette semaine' }));
    expect(loadCycle()?.pauses).toEqual([1]);
    expect(screen.getByText(/Prochain cycle le 31 oct\./)).toBeInTheDocument();
  });

  it('cycle terminé : relancer le même cycle au prochain jour des courses', async () => {
    const user = userEvent.setup();
    const c: CycleActif = { id: 'c1', numero: 2, debut: '2026-09-05', pauses: [], cycle: cycle() };
    render(<Ecran stocke={c} />);
    expect(screen.getByText('Cycle 2 terminé')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Relancer le cycle' }));
    expect(screen.getByRole('heading', { name: 'Cycle 3 prêt' })).toBeInTheDocument();
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
