import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { ProfilScreen } from './components/ProfilScreen';
import { ProfileView } from './components/ProfileView';
import { SuiviHero } from './components/SuiviHero';
import { TabBar } from './components/TabBar';
import type { TabId } from './components/TabBar';
import { Onboarding } from './components/onboarding/Onboarding';
import { WeekBanner } from './components/WeekBanner';
import { SemaineSwitcher } from './components/SemaineSwitcher';
import { CuisineView } from './components/cuisine/CuisineView';
import { prenomProfil } from './lib/model';
import type { ImportedWeek, UserProfile } from './lib/model';
import { parseWeeklyFile } from './lib/parse';
import { effacerSelection, lireSelection, loadProfile, loadProfilLegacy, loadWeeks, removeProfile, sauverSelection } from './lib/storage';
import { enregistrerSurEnvoye, initSync, ressynchroniser, type SyncEtat } from './lib/sync/engine';
import { evenementsDepuisMutations } from './lib/push/evenements';
import { envoyerEvenement } from './lib/push/module';
import { pushActif } from './lib/push/config';
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
  // semaine consultée via les chevrons. Persistée (sportapp:selection) pour
  // retrouver la consultation à la relance — fallback auto si elle a disparu
  // du stockage.
  const [selection, setSelection] = useState<string | null>(() => lireSelection());
  const selectionner = (id: string): void => {
    setSelection(id);
    sauverSelection(id);
  };
  const [profilOuvert, setProfilOuvert] = useState(false);
  const [switcherOuvert, setSwitcherOuvert] = useState(false);
  // SuiviHero lit les pesées au montage : onWeightsChanged (pesée ajoutée)
  // incrémente weightsBump pour le remonter et relire les pesées.
  const [weightsBump, setWeightsBump] = useState(0);
  const [tab, setTab] = useState<TabId>('cuisine');
  // Sync optionnelle : état (point bannière + bloc profil) et version de
  // re-rendu — onRemote bump la version quand un pull a écrit dans le storage,
  // les composants coches/pesées/dépenses relisent alors leur source.
  const [syncEtat, setSyncEtat] = useState<SyncEtat>('off');
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

  // Push : après flush confirmée, détection des événements (dîner coché,
  // pesée, courses) et envoi au serveur — qui filtre les destinataires.
  // Le hook lit l'état courant via un ref miroir (posé une seule fois).
  const semainesRef = useRef(semaines);
  semainesRef.current = semaines;
  useEffect(() => {
    enregistrerSurEnvoye((mutations) => {
      if (!pushActif()) return;
      const evenements = evenementsDepuisMutations(mutations, (semaine, jour, cle) => {
        const w = semainesRef.current.find((s) => s.data.meta.semaine === semaine);
        const jourTrouve = w?.data.menu.find((d) => d.jour === jour);
        return (jourTrouve?.[cle as keyof typeof jourTrouve] as string | undefined) ?? null;
      });
      for (const e of evenements) void envoyerEvenement(e.type, e.label);
    });
    return () => enregistrerSurEnvoye(null);
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
          syncEtat={syncEtat}
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
            effacerSelection();
            setProfilOuvert(false);
          }}
        />
      </div>
    );
  }

  const idx = indexSemaineCourante(semaines, todayISO());
  // Sélection obsolète (semaine retirée du stockage, ex. purge du foyer) :
  // repli sur la semaine du jour, jamais sur la 1re semaine stockée.
  const trouve =
    selection != null ? semaines.findIndex((w) => w.data.meta.semaine === selection) : -1;
  const idxAffiche = Math.min(Math.max(trouve >= 0 ? trouve : idx, 0), semaines.length - 1);
  const affichee = semaines[idxAffiche];
  if (!affichee) return null;

  return (
    <div className="main-content">
      <WeekBanner
        meta={affichee.data.meta}
        onOpenProfile={() => setProfilOuvert(true)}
        onSwitcher={() => setSwitcherOuvert(true)}
        syncEtat={syncEtat}
        onSyncTap={() => ressynchroniser()}
        onPrev={() => selectionner(semaines[Math.max(0, idxAffiche - 1)].data.meta.semaine)}
        onNext={() =>
          selectionner(semaines[Math.min(semaines.length - 1, idxAffiche + 1)].data.meta.semaine)
        }
        hasPrev={idxAffiche > 0}
        hasNext={idxAffiche < semaines.length - 1}
      />
      {switcherOuvert && (
        <SemaineSwitcher
          semaines={semaines}
          active={affichee.data.meta.semaine}
          onSelect={(id) => {
            selectionner(id);
            setSwitcherOuvert(false);
          }}
          onClose={() => setSwitcherOuvert(false)}
        />
      )}
      <TabBar active={tab} onSelect={setTab} />
      <main onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={purgeSwipe}>
        {tab === 'cuisine' && (
          <CuisineView data={affichee.data} profile={profile} syncVersion={syncVersion} />
        )}
        {tab === 'suivi' && (
          <>
            <p className="greeting">Salut {prenomProfil(profile.id, profile)} 👋</p>
            <SuiviHero key={`hero-${weightsBump}-${syncVersion}`} profile={profile} />
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
