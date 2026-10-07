import { Suspense, lazy, useEffect, useState } from 'react';
import { Aujourdhui } from './components/ecrans/Aujourdhui';
import { BarreOnglets } from './components/shell/BarreOnglets';
import { ONGLETS, type Onglet } from './components/shell/onglets';
import { EnTete } from './components/shell/EnTete';
import { LigneSemaine } from './components/shell/LigneSemaine';
import { positionCycle } from './lib/cycle/calendrier';
import { semaineCoches } from './lib/cycle/etat';
import type { Jour } from './lib/cycle/types';
import { chargerCycleExemple, semaineParDefaut } from './lib/cycle/courant';
import { type CycleActif, foyerParDefaut, loadCycle, loadFoyer } from './lib/cycle/etat';
import { todayISO } from './lib/dates';
import { prenomProfil } from './lib/model';
import type { UserProfile } from './lib/model';
import { loadProfile, loadProfilLegacy, removeProfile } from './lib/storage';
import { initSync, type SyncEtat } from './lib/sync/engine';

// Chargés à la demande (spec v2 §10) : seul Aujourd'hui est dans le bundle initial.
const Onboarding = lazy(() => import('./components/onboarding/Onboarding').then((m) => ({ default: m.Onboarding })));
const ProfilScreen = lazy(() => import('./components/ProfilScreen').then((m) => ({ default: m.ProfilScreen })));
const Suivi = lazy(() => import('./components/ecrans/Suivi').then((m) => ({ default: m.Suivi })));
const Menu = lazy(() => import('./components/ecrans/Menu').then((m) => ({ default: m.Menu })));
const Recette = lazy(() => import('./components/ecrans/Recette').then((m) => ({ default: m.Recette })));

// Onglets avec la ligne semaine.
const AVEC_SEMAINE: Onglet[] = ['menu', 'courses', 'rituel'];

const AVENIR: Partial<Record<Onglet, string>> = {
  courses: 'La liste de courses calculée arrive bientôt.',
  rituel: 'Le rituel et son mode guidé arrivent bientôt.',
};

const Chargement = () => (
  <p className="muted chargement" role="status">
    Chargement…
  </p>
);

function App() {
  // La lecture legacy précède loadProfile (strict) : loadProfile retire la clé v1
  // comme « corrompue », alors qu'elle est seulement ancienne — à migrer, pas à jeter.
  const [profile, setProfile] = useState<UserProfile | null>(() =>
    loadProfilLegacy() ? null : loadProfile(),
  );
  const [cycleStocke, setCycleStocke] = useState<CycleActif | null>(loadCycle);
  const [foyerStocke, setFoyerStocke] = useState(loadFoyer);
  const [exemple, setExemple] = useState<CycleActif | null>(null);
  const [onglet, setOnglet] = useState<Onglet>('aujourdhui');
  // Semaine consultée dans Menu / Courses / Rituel (null = celle du jour).
  const [semaineVue, setSemaineVue] = useState<number | null>(null);
  const [jourVu, setJourVu] = useState<Jour | null>(null); // jour consulté dans Menu
  const [profilOuvert, setProfilOuvert] = useState(false);
  // Fiche recette poussée ; `coche` = le repas d'où on vient (« C'est fait »).
  const [recette, setRecette] = useState<{ id: string; coche?: { semaine: string; id: string } } | null>(null);
  // Sync optionnelle : état (point sur l'avatar) et version de re-rendu —
  // onRemote relit le storage quand un pull y a écrit.
  const [syncEtat, setSyncEtat] = useState<SyncEtat>('off');
  const [syncVersion, setSyncVersion] = useState(0);

  const aujourdhui = todayISO();
  const foyer = foyerStocke ?? foyerParDefaut(profile);

  // Effets posés avant les early returns — règle des hooks.
  useEffect(() => {
    initSync({
      onEtat: setSyncEtat,
      onRemote: () => {
        setCycleStocke(loadCycle());
        setFoyerStocke(loadFoyer());
        setSyncVersion((v) => v + 1);
      },
    });
  }, []);

  // Sans cycle importé : le cycle d'exemple (chunk séparé), en mémoire.
  const besoinExemple = !cycleStocke && !exemple;
  useEffect(() => {
    if (!besoinExemple) return;
    let actif = true;
    void chargerCycleExemple(aujourdhui, foyer.jourCourses).then((c) => actif && setExemple(c));
    return () => {
      actif = false;
    };
  }, [besoinExemple, aujourdhui, foyer.jourCourses]);

  if (!profile) {
    return (
      <Suspense fallback={<Chargement />}>
        <Onboarding onDone={setProfile} prefill={loadProfilLegacy() ?? undefined} />
      </Suspense>
    );
  }

  const prenom = prenomProfil(profile.id, profile);
  const actif = cycleStocke ?? exemple;

  if (profilOuvert) {
    return (
      <div className="main-content">
        <Suspense fallback={<Chargement />}>
          <ProfilScreen
            profile={profile}
            syncEtat={syncEtat}
            cycle={actif?.numero}
            onBack={() => setProfilOuvert(false)}
            onChangeProfile={() => {
              removeProfile();
              setProfile(null);
              setProfilOuvert(false);
            }}
            onProfileSaved={setProfile}
          />
        </Suspense>
      </div>
    );
  }

  const position = actif ? positionCycle(actif, aujourdhui) : null;
  const semaine = semaineVue ?? (position ? semaineParDefaut(position) : 0);
  const titre = ONGLETS.find((o) => o.id === onglet)!.label;
  const ouvrirRecette = (n: number) => (id: string, coche: string) =>
    actif && setRecette({ id, coche: { semaine: semaineCoches(actif.id, n), id: coche } });

  if (recette && actif) {
    return (
      <div className="main-content">
        <Suspense fallback={<Chargement />}>
          <Recette
            cycle={actif.cycle}
            recetteId={recette.id}
            membres={foyer.membres}
            moi={profile.id}
            coche={recette.coche}
            syncVersion={syncVersion}
            onRetour={() => setRecette(null)}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="main-content">
        <EnTete titre={titre} prenom={prenom} syncEtat={syncEtat} onProfil={() => setProfilOuvert(true)} />
        {actif && AVEC_SEMAINE.includes(onglet) && (
          <LigneSemaine
            cal={actif}
            index={semaine}
            onChange={(n) => {
              setSemaineVue(n);
              setJourVu(null);
            }}
          />
        )}
        <main>
          {!actif || !position ? (
            <Chargement />
          ) : (
            <Suspense fallback={<Chargement />}>
              {onglet === 'aujourdhui' && (
                <Aujourdhui
                  actif={actif}
                  foyer={foyer}
                  moi={profile.id}
                  prenom={prenom}
                  aujourdhui={aujourdhui}
                  position={position}
                  exemple={!cycleStocke}
                  syncVersion={syncVersion}
                  onOuvrirRecette={ouvrirRecette(position.etat === 'semaine' ? position.index : 0)}
                  onAller={setOnglet}
                />
              )}
              {onglet === 'menu' && (
                <Menu
                  actif={actif}
                  foyer={foyer}
                  semaine={semaine}
                  moi={profile.id}
                  aujourdhui={aujourdhui}
                  syncVersion={syncVersion}
                  jourVu={jourVu}
                  onJour={setJourVu}
                  onOuvrirRecette={ouvrirRecette(semaine)}
                />
              )}
              {onglet === 'suivi' && <Suivi profile={profile} syncVersion={syncVersion} />}
              {AVENIR[onglet] && <p className="muted">{AVENIR[onglet]}</p>}
            </Suspense>
          )}
        </main>
      </div>
      <BarreOnglets actif={onglet} onSelect={setOnglet} />
    </div>
  );
}

export default App;
