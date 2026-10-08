import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { Aujourdhui } from './components/ecrans/Aujourdhui';
import { BarreOnglets } from './components/shell/BarreOnglets';
import { ONGLETS, type Onglet } from './components/shell/onglets';
import { EnTete } from './components/shell/EnTete';
import { LigneSemaine } from './components/shell/LigneSemaine';
import { positionCycle } from './lib/cycle/calendrier';
import { semaineCoches } from './lib/cycle/etat';
import type { Jour } from './lib/cycle/types';
import type { VueRituel } from './components/ecrans/Rituel';
import { chargerCycleExemple, semaineParDefaut } from './lib/cycle/courant';
import { type CycleActif, type ReglagesFoyer, assurerMoi, foyerParDefaut, loadCycle, loadFoyer, saveFoyer } from './lib/cycle/etat';
import { todayISO } from './lib/dates';
import { estSuivi, prenomProfil } from './lib/model';
import type { UserProfile } from './lib/model';
import { loadProfile, loadProfilLegacy, removeProfile } from './lib/storage';
import { initSync, type SyncEtat } from './lib/sync/engine';

// Chargés à la demande (spec v2 §10) : seul Aujourd'hui est dans le bundle initial.
const Onboarding = lazy(() => import('./components/onboarding/Onboarding').then((m) => ({ default: m.Onboarding })));
const ProfilScreen = lazy(() => import('./components/ProfilScreen').then((m) => ({ default: m.ProfilScreen })));
const Suivi = lazy(() => import('./components/ecrans/Suivi').then((m) => ({ default: m.Suivi })));
const Menu = lazy(() => import('./components/ecrans/Menu').then((m) => ({ default: m.Menu })));
const Courses = lazy(() => import('./components/ecrans/Courses').then((m) => ({ default: m.Courses })));
const Rituel = lazy(() => import('./components/ecrans/Rituel').then((m) => ({ default: m.Rituel })));
const Guide = lazy(() => import('./components/ecrans/Guide').then((m) => ({ default: m.Guide })));
const SemaineType = lazy(() => import('./components/ecrans/SemaineType').then((m) => ({ default: m.SemaineType })));
const MonCycle = lazy(() => import('./components/ecrans/MonCycle').then((m) => ({ default: m.MonCycle })));
const Recette = lazy(() => import('./components/ecrans/Recette').then((m) => ({ default: m.Recette })));

// Onglets avec la ligne semaine.
const AVEC_SEMAINE: Onglet[] = ['menu', 'courses', 'rituel'];


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
  // Cycle d'exemple aux prénoms du foyer : rechargé si les membres changent.
  const [exemple, setExemple] = useState<{ cle: string; actif: CycleActif } | null>(null);
  const [onglet, setOnglet] = useState<Onglet>('aujourdhui');
  // Semaine consultée dans Menu / Courses / Rituel (null = celle du jour).
  const [semaineVue, setSemaineVue] = useState<number | null>(null);
  const [jourVu, setJourVu] = useState<Jour | null>(null); // jour consulté dans Menu
  const [vueRituel, setVueRituel] = useState<VueRituel>('jour');
  const [guide, setGuide] = useState<number | null>(null); // étape du mode guidé ouvert
  const [monCycle, setMonCycle] = useState(false);
  // Semaine type : 'etape' = étape « Ta semaine » juste après l'onboarding.
  const [semaineType, setSemaineType] = useState<'etape' | 'profil' | null>(null);
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

  // Mon membre du foyer existe et suit mon profil (prénom, suivi, régime) —
  // y compris dans un foyer reçu par la sync.
  useEffect(() => {
    if (!profile || !foyerStocke) return;
    const f = assurerMoi(foyerStocke, profile);
    if (f === foyerStocke) return;
    saveFoyer(f);
    setFoyerStocke(f);
  }, [profile, foyerStocke]);

  // Sans cycle importé : le cycle d'exemple (chunk séparé), en mémoire.
  const cleExemple = JSON.stringify(foyer.membres.map((m) => [m.id, m.prenom, m.type]));
  const besoinExemple = !!profile && !cycleStocke && exemple?.cle !== cleExemple;
  const membres = foyer.membres;
  useEffect(() => {
    if (!besoinExemple) return;
    let actif = true;
    void chargerCycleExemple(aujourdhui, foyer.jourCourses, membres).then(
      (c) => actif && setExemple({ cle: cleExemple, actif: c }),
    );
    return () => {
      actif = false;
    };
    // membres : couvert par cleExemple (même contenu, nouvelle référence à chaque rendu).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [besoinExemple, aujourdhui, foyer.jourCourses, cleExemple]);

  if (!profile) {
    return (
      <Suspense fallback={<Chargement />}>
        <Onboarding
          onDone={(p) => {
            setProfile(p);
            if (!loadFoyer()) setSemaineType('etape');
          }}
          prefill={loadProfilLegacy() ?? undefined}
        />
      </Suspense>
    );
  }

  const prenom = prenomProfil(profile.id, profile);
  const actif = cycleStocke ?? exemple?.actif ?? null;
  const suivi = estSuivi(profile);

  const position = actif ? positionCycle(actif, aujourdhui) : null;

  const enregistrerFoyer = (f: ReglagesFoyer) => {
    saveFoyer(f);
    setFoyerStocke(f);
  };

  if (semaineType) {
    return (
      <div className="main-content">
        <Suspense fallback={<Chargement />}>
          <SemaineType
            foyer={foyer}
            compact={semaineType === 'etape'}
            onRetour={() => setSemaineType(null)}
            onEnregistrer={(f) => {
              enregistrerFoyer(f);
              setSemaineType(null);
            }}
          />
        </Suspense>
      </div>
    );
  }

  if (monCycle) {
    return (
      <div className="main-content">
        <Suspense fallback={<Chargement />}>
          <MonCycle
            stocke={cycleStocke}
            foyer={foyer}
            profil={profile}
            aujourdhui={aujourdhui}
            onRetour={() => setMonCycle(false)}
            onCycle={(c) => {
              setCycleStocke(c);
              setSemaineVue(null);
              setJourVu(null);
            }}
            onFoyer={setFoyerStocke}
            onVoirCourses={() => {
              setMonCycle(false);
              setProfilOuvert(false);
              setOnglet('courses');
            }}
          />
        </Suspense>
      </div>
    );
  }

  if (profilOuvert) {
    return (
      <div className="main-content">
        <Suspense fallback={<Chargement />}>
          <ProfilScreen
            profile={profile}
            syncEtat={syncEtat}
            cycle={actif?.numero}
            resumeCycle={
              !cycleStocke
                ? "Cycle d'exemple · crée le tien"
                : position?.etat === 'semaine'
                  ? `Cycle ${cycleStocke.numero} · semaine ${position.index + 1} sur 4 · menu ${position.lettre}`
                  : position?.etat === 'termine'
                    ? `Cycle ${cycleStocke.numero} terminé`
                    : `Cycle ${cycleStocke.numero}`
            }
            onMonCycle={() => setMonCycle(true)}
            resumeSemaine={`${foyer.membres.length} personnes · courses ${foyer.jourCourses.slice(0, 3)}. · rituel ${foyer.jourRituel.slice(0, 3)}.`}
            onSemaineType={() => setSemaineType('profil')}
            onBack={() => setProfilOuvert(false)}
            onChangeProfile={() => {
              removeProfile();
              setProfile(null);
              setProfilOuvert(false);
            }}
            onProfileSaved={(p) => {
              setProfile(p);
              // Magasin et budget vivent dans le foyer une fois celui-ci enregistré.
              if (foyerStocke) {
                // undefined → clé omise au JSON (champ vidé dans le profil).
                enregistrerFoyer({ ...foyerStocke, magasin: p.magasin || undefined, budgetMax: p.budgetMax });
              }
            }}
          />
        </Suspense>
      </div>
    );
  }

  const semaine = semaineVue ?? (position ? semaineParDefaut(position) : 0);
  const ecran: Onglet = onglet === 'suivi' && !suivi ? 'aujourdhui' : onglet; // suivi coupé depuis Profil
  const titre = ONGLETS.find((o) => o.id === ecran)!.label;
  const ouvrirRecette = (n: number) => (id: string, coche: string) =>
    actif && setRecette({ id, coche: { semaine: semaineCoches(actif.id, n), id: coche } });

  const ecranPousse = (contenu: ReactNode) => (
    <div className="main-content">
      <Suspense fallback={<Chargement />}>{contenu}</Suspense>
    </div>
  );

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

  if (guide != null && actif) {
    return ecranPousse(
      <Guide
        actif={actif}
        semaine={semaine}
        etape={guide}
        syncVersion={syncVersion}
        onEtape={setGuide}
        onQuitter={() => setGuide(null)}
        onReserve={() => {
          setGuide(null);
          setVueRituel('reserve');
        }}
        onOuvrirRecette={(id) => setRecette({ id })}
      />,
    );
  }

  return (
    <div className="shell">
      <div className="main-content">
        <EnTete titre={titre} prenom={prenom} syncEtat={syncEtat} onProfil={() => setProfilOuvert(true)} />
        {actif && AVEC_SEMAINE.includes(ecran) && (
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
              {ecran === 'aujourdhui' && (
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
              {ecran === 'menu' && (
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
              {ecran === 'courses' && (
                <Courses actif={actif} foyer={foyer} semaine={semaine} aujourdhui={aujourdhui} syncVersion={syncVersion} />
              )}
              {ecran === 'rituel' && (
                <Rituel
                  actif={actif}
                  foyer={foyer}
                  semaine={semaine}
                  syncVersion={syncVersion}
                  vue={vueRituel}
                  onVue={setVueRituel}
                  onGuide={() => setGuide(0)}
                  onOuvrirRecette={(id) => setRecette({ id })}
                />
              )}
              {ecran === 'suivi' && <Suivi profile={profile} syncVersion={syncVersion} />}
            </Suspense>
          )}
        </main>
      </div>
      <BarreOnglets actif={ecran} suivi={suivi} onSelect={setOnglet} />
    </div>
  );
}

export default App;
