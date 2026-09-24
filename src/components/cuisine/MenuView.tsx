import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { BaseCuisine, MenuDay, Recette, ReserveLigne } from '../../lib/model';
import { reserveId, soirsSansDiner } from '../../lib/batch';
import {
  CLE_DEJEUNERS,
  cleInitiale,
  construireOnglets,
  construirePaires,
  debloquePar,
  faitsParRecette,
  paireFaite,
  pairePrete,
} from '../../lib/menu';
import type { OngletDiner, PaireDejeuners } from '../../lib/menu';
import { getChecks, setCheck } from '../../lib/storage';
import { capitalize } from '../../lib/text';
import { Icon } from '../Icon';

// Menu v3 : 1 onglet par recette/dîner + 🍱 Mes box (file dynamique, pill
// épinglée à gauche — spec v14 §4.1). Aucun jour affiché — l'ordre du fichier
// est l'ordre conseillé (batch/frigo d'abord, frais ensuite). Logique dans
// src/lib/menu.ts.
export function MenuView({
  menu,
  recettes = [],
  bases = [],
  reserve,
  semaine,
  syncVersion = 0,
}: {
  menu: MenuDay[];
  recettes?: Recette[];
  bases?: BaseCuisine[];
  reserve?: ReserveLigne[];
  semaine: string;
  syncVersion?: number;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>(() => getChecks(semaine));
  const onglets = construireOnglets(menu, recettes);
  const paires = construirePaires(menu, recettes);
  const faits = faitsParRecette(menu);
  const jokers = soirsSansDiner(menu, reserve ?? []);

  // Pattern render-phase reset — cf. Checklist.tsx : un changement remote
  // (syncVersion) ou de semaine relit le storage. L'onglet actif voyage par
  // clé (cleCoche / « dejeuners »), pas par index : un pull remote (même
  // semaine) garde la recette consultée ; un changement de semaine replie sur
  // la sélection par défaut (jour du jour → premier non fait → Déjeuners).
  const [synced, setSynced] = useState({ semaine, version: syncVersion });
  const [actif, setActif] = useState<string>(() => cleInitiale(onglets, menu, checks));
  if (synced.semaine !== semaine || synced.version !== syncVersion) {
    const memeSemaine = synced.semaine === semaine;
    setSynced({ semaine, version: syncVersion });
    const fresh = getChecks(semaine);
    setChecks(fresh);
    const encoreLa =
      memeSemaine && (actif === CLE_DEJEUNERS || onglets.some((o) => o.cleCoche === actif));
    setActif(encoreLa ? actif : cleInitiale(onglets, menu, fresh));
  }

  // Index dérivé de la clé : rendu cohérent même si la clé n'existe plus
  // (le reset render-phase ci-dessus la recalcule au prochain cycle).
  const idxActif =
    actif === CLE_DEJEUNERS
      ? onglets.length
      : Math.max(0, onglets.findIndex((o) => o.cleCoche === actif));

  if (onglets.length === 0 && paires.length === 0) {
    return <p className="muted">Aucun menu pour cette semaine.</p>;
  }

  const basculerDiner = (onglet: OngletDiner) => {
    const next = !checks[onglet.cleCoche];
    setCheck(semaine, onglet.cleCoche, next);
    setChecks((prev) => ({ ...prev, [onglet.cleCoche]: next }));
  };

  // Une action par paire : coche toutes les clés déjeuner présentes ce jour-là.
  const basculerPaire = (paire: PaireDejeuners) => {
    const cible = !paireFaite(paire, checks);
    const next = { ...checks };
    for (const id of paire.ids) {
      setCheck(semaine, id, cible);
      next[id] = cible;
    }
    setChecks(next);
  };

  // Joker réserve : cocher = réserve consommée (même id que la section Réserve
  // de Mon Rituel — les deux vues restent synchronisées).
  const basculerJoker = (id: string) => {
    const next = !checks[id];
    setCheck(semaine, id, next);
    setChecks((prev) => ({ ...prev, [id]: next }));
  };

  const dFaites = onglets.filter((o) => checks[o.cleCoche]).length;
  const bFaites = paires.filter((p) => paireFaite(p, checks)).length;
  const pct = (n: number, total: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '0%');

  // Navigation clavier du pattern ARIA tabs — activation suit le focus.
  const onKeyDownTablist = (event: KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const base = Math.max(0, tabs.findIndex((b) => b === document.activeElement));
    const t =
      event.key === 'ArrowRight' ? (base + 1) % tabs.length :
      event.key === 'ArrowLeft' ? (base - 1 + tabs.length) % tabs.length :
      event.key === 'Home' ? 0 :
      event.key === 'End' ? tabs.length - 1 : -1;
    const cible = tabs[t];
    if (!cible) return;
    event.preventDefault();
    setActif(cible.id === 'rtab-dejeuners' ? CLE_DEJEUNERS : cible.id.replace(/^rtab-/, ''));
    cible.focus();
  };

  return (
    <div className="menu-recettes">
      <div className="menu-head">
        <p className="menu-progress">
          Dîners {dFaites}/{onglets.length}{' '}
          <span className="bar">
            <i style={{ width: pct(dFaites, onglets.length) }} />
          </span>
          <span>
            · Boxes {bFaites}/{paires.length}{' '}
            <span className="bar">
              <i style={{ width: pct(bFaites, paires.length) }} />
            </span>
          </span>
        </p>
      </div>
      {jokers.length > 0 && (
        <div className="menu-joker" role="group" aria-label="Réserve à sortir">
          {jokers.map((j) => {
            const id = reserveId(j.ligne);
            const sorti = !!checks[id];
            return (
              <div className={sorti ? 'joker-ligne fait' : 'joker-ligne'} key={id}>
                <span className="joker-corps">
                  <span className="joker-titre">Soir sans dîner prévu · {capitalize(j.jour)}</span>
                  <span className="joker-suggestion">
                    Sors la réserve : <b>{j.ligne.plat}</b> ({j.ligne.conservation})
                  </span>
                </span>
                <button
                  type="button"
                  className={sorti ? 'joker-cta fait' : 'joker-cta'}
                  aria-pressed={sorti}
                  onClick={() => basculerJoker(id)}
                >
                  {sorti ? 'Soirée gérée ✓' : 'Sortie ✓'}
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div
        className="rtabs"
        role="tablist"
        aria-label="Recettes du menu"
        onKeyDown={onKeyDownTablist}
      >
        <button
          type="button"
          role="tab"
          id="rtab-dejeuners"
          aria-selected={idxActif === onglets.length}
          aria-controls="rpanel-actif"
          className={`rtab rtab-epingle${idxActif === onglets.length ? ' active' : ''}`}
          onClick={() => setActif(CLE_DEJEUNERS)}
        >
          <span className="rn">🍱 Mes box</span>
        </button>
        <span className="rtabs-sep" aria-hidden="true" />
        <div className="rtabs-jours">
          {onglets.map((o, i) => (
            <button
              key={o.cleCoche}
              type="button"
              role="tab"
              id={`rtab-${o.cleCoche}`}
              aria-selected={i === idxActif}
              aria-controls="rpanel-actif"
              aria-label={`${o.label}${checks[o.cleCoche] ? ' (fait)' : ''}`}
              className={`rtab${i === idxActif ? ' active' : ''}${checks[o.cleCoche] ? ' fait' : ''}`}
              onClick={() => setActif(o.cleCoche)}
            >
              {checks[o.cleCoche] && (
                <span className="tick" aria-hidden="true">
                  <Icon name="check" size={12} strokeWidth={3} />
                </span>
              )}
              <span className="rn">{o.label}</span>
            </button>
          ))}
        </div>
      </div>
      {idxActif === onglets.length ? (
        <div role="tabpanel" id="rpanel-actif" aria-labelledby="rtab-dejeuners">
          <FileDejeuners paires={paires} checks={checks} faits={faits} onBasculer={basculerPaire} />
        </div>
      ) : onglets[idxActif] ? (
        <div
          role="tabpanel"
          id="rpanel-actif"
          aria-labelledby={`rtab-${onglets[idxActif].cleCoche}`}
        >
          <OngletRecette
            onglet={onglets[idxActif]}
            bases={bases}
            fait={!!checks[onglets[idxActif].cleCoche]}
            onBasculer={() => basculerDiner(onglets[idxActif])}
          />
        </div>
      ) : null}
    </div>
  );
}

function OngletRecette({
  onglet,
  bases,
  fait,
  onBasculer,
}: {
  onglet: OngletDiner;
  bases?: BaseCuisine[];
  fait: boolean;
  onBasculer: () => void;
}) {
  const r = onglet.recette;
  return (
    <article className={fait ? 'onglet-recette fait' : 'onglet-recette'} aria-label={onglet.label}>
      {r && (
        <div className="onglet-meta">
          <div className="meta-row">
            {r.temps && (
              <span className="meta-pill">
                <Icon name="clock" size={12} /> {r.temps.split('·')[0]?.trim()}
              </span>
            )}
            {r.kcal != null && (
              <span className="meta-pill">
                <Icon name="flame" size={12} /> {r.kcal} kcal
              </span>
            )}
            {r.score != null && (
              <span className="meta-pill">
                Score {r.score}/10
                <span className="score-bar">
                  {Array.from({ length: 10 }, (_, i) => (
                    <span key={i} className={i < r.score! ? 'score-seg on' : 'score-seg'} />
                  ))}
                </span>
              </span>
            )}
          </div>
          {r.fraicheur && (
            <p className="fraicheur">
              <Icon name="box" size={12} /> {r.fraicheur}
            </p>
          )}
        </div>
      )}
      {(onglet.diner || onglet.mel) && (
        <div className="qui">
          <p className="qui-titre">Qui mange quoi</p>
          {onglet.diner && (
            <p>
              <span className={`mtag ${onglet.diner.tagClass}`}>{onglet.diner.tag}</span>{' '}
              {onglet.diner.texte}
            </p>
          )}
          {onglet.mel && (
            <p>
              <span className={`mtag ${onglet.mel.tagClass}`}>{onglet.mel.tag}</span>{' '}
              {onglet.mel.texte}
            </p>
          )}
        </div>
      )}
      {r?.portions && (r.portions.marc || r.portions.melanie) && (
        <div className="portions">
          <p className="portions-titre">Portions — par personne</p>
          {r.portions.marc && (
            <p>
              <span className="mtag tag-marc">Marc</span> {r.portions.marc}
            </p>
          )}
          {r.portions.melanie && (
            <p>
              <span className="mtag tag-mel">Mél</span> {r.portions.melanie}
            </p>
          )}
        </div>
      )}
      {r && (r.pour || (r.etapes && r.etapes.length > 0)) && (
        <div className="onglet-prepa">
          <h4>Préparation</h4>
          {r.pour && <p className="recette-pour">{r.pour}</p>}
          {r.bases && r.bases.length > 0 && <BasesChips refs={r.bases} bases={bases} />}
          {r.etapes && r.etapes.length > 0 && (
            <ol className="recette-etapes">
              {r.etapes.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ol>
          )}
        </div>
      )}
      {onglet.batch && (
        <div className="onglet-batch">
          <h4>Batch associé</h4>
          <div className="bat">
            <span className="mtag tag-bat">Batch</span>
            <span>{onglet.batch.texte}</span>
          </div>
        </div>
      )}
      <button
        type="button"
        className={fait ? 'cta done' : 'cta'}
        aria-pressed={fait}
        onClick={onBasculer}
      >
        {fait ? (
          <>Dîner fait ✓ — annuler</>
        ) : (
          <>
            <Icon name="check" size={15} strokeWidth={2.5} /> C'est fait — dîner fini
          </>
        )}
      </button>
    </article>
  );
}

function BasesChips({ refs, bases }: { refs: string[]; bases?: BaseCuisine[] }) {
  const [ouverte, setOuverte] = useState<string | null>(null);
  const liste = refs.map((ref) => trouverBase(ref, bases)).filter((b): b is BaseCuisine => !!b);
  const affichees =
    liste.length > 0 ? liste : [{ id: 'cuisson-du-jour', nom: 'Cuisson du jour', texte: '' }];
  return (
    <div className="recette-bases">
      {affichees.map((b) => (
        <button
          type="button"
          key={b.id}
          className={ouverte === b.id ? 'recette-bchip on' : 'recette-bchip'}
          aria-expanded={ouverte === b.id}
          onClick={() => setOuverte(ouverte === b.id ? null : b.id)}
        >
          🧂 {b.nom}
        </button>
      ))}
      {ouverte &&
        affichees
          .filter((b) => b.id === ouverte && b.texte)
          .map((b) => (
            <p className="recette-bdesc" key={b.id}>
              🧂 {b.nom} : {b.texte}
            </p>
          ))}
    </div>
  );
}

function FileDejeuners({
  paires,
  checks,
  faits,
  onBasculer,
}: {
  paires: PaireDejeuners[];
  checks: Record<string, boolean>;
  faits: Record<string, string[]>;
  onBasculer: (paire: PaireDejeuners) => void;
}) {
  if (paires.length === 0) {
    return <p className="muted">Aucun déjeuner dans cette semaine.</p>;
  }
  const pretes = paires.filter((p) => !paireFaite(p, checks) && pairePrete(p, checks, faits));
  const aVenir = paires.filter((p) => !paireFaite(p, checks) && !pairePrete(p, checks, faits));
  const mangees = paires.filter((p) => paireFaite(p, checks));
  return (
    <div className="file-dejeuners">
      {pretes.length > 0 && (
        <>
          <p className="fhead">Prêtes à emporter</p>
          {pretes.map((p) => (
            <div className="box-pair" key={p.jour}>
              {p.lignes.map((l) => (
                <p key={l.id}>
                  <span className={`mtag ${l.tagClass}`}>{l.tag}</span> {l.texte}
                </p>
              ))}
              <button type="button" className="mini-cta" onClick={() => onBasculer(p)}>
                <Icon name="check" size={13} strokeWidth={2.5} /> Boxes faites
              </button>
            </div>
          ))}
        </>
      )}
      {aVenir.length > 0 && (
        <>
          <p className="fhead">À venir</p>
          {aVenir.map((p) => {
            const manque = debloquePar(p, checks, faits);
            return (
              <div className="box-pair locked" key={p.jour}>
                {p.lignes.map((l) => (
                  <p key={l.id}>
                    <span className={`mtag ${l.tagClass}`}>{l.tag}</span> {l.texte}
                  </p>
                ))}
                {manque && (
                  <p className="lock-note">
                    <Icon name="lock" size={11} /> débloquée quand <b>&nbsp;{manque}&nbsp;</b> est
                    fait
                  </p>
                )}
              </div>
            );
          })}
        </>
      )}
      {mangees.length > 0 && (
        <>
          <p className="fhead">Mangées</p>
          {mangees.map((p) => (
            <div className="box-pair mangees" key={p.jour}>
              {p.lignes.map((l) => (
                <p key={l.id}>
                  <span className={`mtag ${l.tagClass}`}>{l.tag}</span> {l.texte}
                </p>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function trouverBase(ref: string, bases: BaseCuisine[] | undefined): BaseCuisine | undefined {
  if (!bases) return undefined;
  const cible = ref.toLowerCase();
  // égalité exacte d'abord, puis préfixe borné (`b4` ne doit pas matcher `b40-…`)
  return bases.find((b) => b.id === cible) ?? bases.find((b) => b.id.startsWith(`${cible}-`));
}
