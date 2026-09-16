import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { ProfilScreen } from './components/ProfilScreen';
import { ProfileView } from './components/ProfileView';
import { StatCards } from './components/StatCards';
import { ObjectifBloc } from './components/ObjectifBloc';
import { TabBar } from './components/TabBar';
import type { TabId } from './components/TabBar';
import { Onboarding } from './components/onboarding/Onboarding';
import { WeekBanner } from './components/WeekBanner';
import { CuisineView } from './components/cuisine/CuisineView';
import { PRENOMS } from './lib/model';
import type { ImportedWeek, UserProfile } from './lib/model';
import { parseWeeklyFile } from './lib/parse';
import { loadProfile, loadProfilLegacy, loadWeeks, removeProfile } from './lib/storage';
import { initSync, type SyncEtat } from './lib/sync/engine';
import { indexSemaineCourante, semainesTriees } from './lib/weeks';
import { todayISO } from './lib/dates';
import sampleRaw from './assets/semaine-exemple.md?raw';

// Fallback en mémoire : tant qu'aucune semaine n'a été importée, on affiche
// la semaine d'exemple (les semaines réelles arrivent par l'import du cycle).
const semaineExemple = (): ImportedWeek => {
  const { data } = parseWeeklyFile(sampleRaw);
  return { raw: sampleRaw, data, importedAt: '' };
};

const semainesInitiales = (): ImportedWeek[] => {
  const stockees = semainesTriees(Object.values(loadWeeks()));
  return stockees.length ? stockees : [semaineExemple()];
};

function App() {
  // La lecture legacy précède loadProfile (strict) : loadProfile retire la clé v1
  // comme « corrompue », alors qu'elle est seulement ancienne — à migrer, pas à jeter.
  const [profile, setProfile] = useState<UserProfile | null>(() =>
    loadProfilLegacy() ? null : loadProfile(),
  );
  const [semaines, setSemaines] = useState<ImportedWeek[]>(semainesInitiales);
  // Navigation en session : null = auto (semaine du jour) ; sinon l'id de la
  // semaine consultée via les chevrons. Rien n'est persisté.
  const [selection, setSelection] = useState<string | null>(null);
  const [profilOuvert, setProfilOuvert] = useState(false);
  // StatCards et ObjectifBloc lisent le storage au montage : onWeightsChanged (pesée
  // ajoutée) incrémente weightsBump pour les remonter et relire les pesées.
  const [weightsBump, setWeightsBump] = useState(0);
  const [tab, setTab] = useState<TabId>('cuisine');
  // Sync optionnelle : état (consommé par la brique UI sync) et version de
  // re-rendu — onRemote bump la version quand un pull a écrit dans le storage,
  // les composants coches/pesées/dépenses relisent alors leur source.
  const [, setSyncEtat] = useState<SyncEtat>('off');
  const [syncVersion, setSyncVersion] = useState(0);

  // Sync optionnelle : no-op complet sans env Supabase (état 'off'). Effet
  // posé avant les early returns — règle des hooks. Idempotent côté engine.
  useEffect(() => {
    initSync({
      onEtat: setSyncEtat,
      onRemote: () => {
        setSemaines(semainesInitiales());
        setSyncVersion((v) => v + 1);
      },
    });
  }, []);

  // Swipe Cuisine ↔ Suivi (pointer events). Chaque pointerdown repart d'un état
  // propre : un geste exclu (contrôle interactif, second doigt, reduced-motion)
  // ou annulé (scroll vertical → pointercancel) ne laisse aucun ref obsolète
  // qu'un pointerup ultérieur transformerait en bascule fantôme.
  const swipeX = useRef<number | null>(null);
  const swipeY = useRef<number | null>(null);
  const purgeSwipe = () => {
    swipeX.current = null;
    swipeY.current = null;
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    purgeSwipe();
    if (!e.isPrimary) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = e.target as HTMLElement;
    if (t.closest('button, input, textarea, select, label, a, .micro-batch')) return;
    swipeX.current = e.clientX;
    swipeY.current = e.clientY;
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const x0 = swipeX.current;
    const y0 = swipeY.current;
    swipeX.current = null;
    swipeY.current = null;
    if (x0 == null || y0 == null) return;
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    if (Math.abs(dx) < 80 || Math.abs(dy) > 60) return;
    setTab(dx < 0 ? 'suivi' : 'cuisine');
  };

  if (!profile) {
    return <Onboarding onDone={setProfile} prefill={loadProfilLegacy() ?? undefined} />;
  }

  if (profilOuvert) {
    return (
      <div className="main-content">
        <ProfilScreen
          profile={profile}
          onBack={() => setProfilOuvert(false)}
          onChangeProfile={() => {
            removeProfile();
            setProfile(null);
            setProfilOuvert(false);
          }}
          onProfileSaved={setProfile}
          onImported={() => {
            setSemaines(semainesInitiales());
            setSelection(null);
            setProfilOuvert(false);
          }}
        />
      </div>
    );
  }

  const idx = indexSemaineCourante(semaines, todayISO());
  const navigable = semaines.length > 1;
  const selectionIdx =
    selection != null
      ? Math.max(0, semaines.findIndex((w) => w.data.meta.semaine === selection))
      : idx;
  const idxAffiche = Math.min(Math.max(selectionIdx, 0), semaines.length - 1);
  const affichee = semaines[idxAffiche];
  if (!affichee) return null;

  return (
    <div className="main-content">
      <WeekBanner
        meta={affichee.data.meta}
        onOpenProfile={() => setProfilOuvert(true)}
        onPrev={
          navigable
            ? () => setSelection(semaines[Math.max(0, idxAffiche - 1)].data.meta.semaine)
            : undefined
        }
        onNext={
          navigable
            ? () =>
                setSelection(
                  semaines[Math.min(semaines.length - 1, idxAffiche + 1)].data.meta.semaine,
                )
            : undefined
        }
        hasPrev={navigable && idxAffiche > 0}
        hasNext={navigable && idxAffiche < semaines.length - 1}
      />
      <TabBar active={tab} onSelect={setTab} />
      <main onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={purgeSwipe}>
        {tab === 'cuisine' && (
          <CuisineView data={affichee.data} profile={profile} syncVersion={syncVersion} />
        )}
        {tab === 'suivi' && (
          <>
            <p className="greeting">Salut {PRENOMS[profile.id]} 👋</p>
            <ObjectifBloc key={`obj-${weightsBump}-${syncVersion}`} profile={profile} />
            <StatCards key={weightsBump + syncVersion} profile={profile} />
            <ProfileView
              profile={profile}
              data={affichee.data.profiles[profile.id]}
              semaine={affichee.data.meta.semaine}
              syncVersion={syncVersion}
              onWeightsChanged={() => setWeightsBump((b) => b + 1)}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
