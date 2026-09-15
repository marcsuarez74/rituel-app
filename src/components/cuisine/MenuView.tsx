import { useState } from 'react';
import type { BaseCuisine, MealKey, MenuDay, Recette } from '../../lib/model';
import { recetteParRef } from '../../lib/stats';
import { getChecks, setCheck } from '../../lib/storage';
import { Icon } from '../Icon';

const MEALS: Array<[MealKey, string, string]> = [
  ['dejeunerMarc', 'Marc', 'tag-marc'],
  ['dejeunerMelanie', 'Mél', 'tag-mel'],
  ['dinerFamille', 'Famille', 'tag-fam'],
  ['dinerMelanie', 'Mél', 'tag-mel'],
  ['batch', 'Batch', 'tag-bat'],
];

const ICONES_REPAS: Record<MealKey, 'bowl' | 'meat' | 'pot'> = {
  dejeunerMarc: 'bowl',
  dejeunerMelanie: 'bowl',
  dinerFamille: 'meat',
  dinerMelanie: 'bowl',
  batch: 'pot',
};

export interface Occurrence {
  id: string;
  jour: string;
  cle: MealKey;
  tag: string;
  tagClass: string;
  texte: string;
  recette?: Recette;
}

// Menu v2 : 1 ligne repas = 1 occurrence indépendante (aucun jour imposé).
// L'ordre est chronologique — les .md bien rédigés placent batch/frigo d'abord.
function construireOccurrences(menu: MenuDay[], recettes: Recette[]): Occurrence[] {
  const out: Occurrence[] = [];
  for (const day of menu) {
    for (const [cle, tag, tagClass] of MEALS) {
      const texte = day[cle];
      if (!texte) continue;
      const ref = day.recetteRefs?.[cle];
      out.push({
        id: `menu:${day.jour.trim().toLowerCase()}:${cle}`,
        jour: day.jour,
        cle,
        tag,
        tagClass,
        texte,
        ...(ref ? { recette: recetteParRef(ref, recettes) } : {}),
      });
    }
  }
  return out;
}

export function MenuView({
  menu,
  recettes = [],
  bases = [],
  semaine,
}: {
  menu: MenuDay[];
  recettes?: Recette[];
  bases?: BaseCuisine[];
  semaine: string;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>(() => getChecks(semaine));
  const [syncedSemaine, setSyncedSemaine] = useState(semaine);
  if (syncedSemaine !== semaine) {
    setSyncedSemaine(semaine);
    setChecks(getChecks(semaine));
  }

  const occurrences = construireOccurrences(menu, recettes);
  if (occurrences.length === 0) {
    return <p className="muted">Aucun menu pour cette semaine.</p>;
  }
  const faites = occurrences.filter((o) => checks[o.id]).length;
  const toggle = (id: string) => {
    const next = !checks[id];
    setCheck(semaine, id, next);
    setChecks((prev) => ({ ...prev, [id]: next }));
  };

  return (
    <div className="menu-reserve">
      <div className="menu-reserve-head">
        <p className="menu-reserve-note">
          Pas de jour imposé — ordre conseillé : batch/frigo d'abord, frais en dernier.
        </p>
        <p className="progress">
          <Icon name="check" size={14} /> <b>{faites}/{occurrences.length}</b> faits
          <progress value={faites} max={occurrences.length} />
        </p>
      </div>
      {occurrences.map((o) => (
        <MealCard
          key={o.id}
          occ={o}
          bases={bases}
          fait={!!checks[o.id]}
          onToggle={() => toggle(o.id)}
        />
      ))}
    </div>
  );
}

function MealCard({
  occ,
  bases,
  fait,
  onToggle,
}: {
  occ: Occurrence;
  bases?: BaseCuisine[];
  fait: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const r = occ.recette;
  const tempsCourt = r?.temps?.split('·')[0]?.trim();
  const chips = r
    ? r.bases?.length
      ? r.bases.map((b) => trouverBase(b, bases)).filter((b): b is BaseCuisine => !!b)
      : [{ id: 'cuisson-du-jour', nom: 'Cuisson du jour', texte: '' }]
    : [];
  return (
    <article
      className={fait ? 'menu-card fait' : 'menu-card'}
      aria-label={`${occ.jour} — ${occ.texte}`}
    >
      <div className="menu-card-top">
        <label className="menu-coche">
          <input
            type="checkbox"
            checked={fait}
            onChange={onToggle}
            aria-label={`${occ.jour} — ${occ.texte} — marquer comme fait`}
          />
          <span className="menu-coche-box">
            <Icon name="check" size={14} />
          </span>
        </label>
        <div className="mtile">
          <Icon name={ICONES_REPAS[occ.cle]} size={20} />
        </div>
        <div className="mt">
          <span className={`mtag ${occ.tagClass}`}>{occ.tag}</span>
          <div className="mname">{occ.texte}</div>
          {(tempsCourt || r?.kcal != null) && (
            <div className="mmeta">
              {tempsCourt && (
                <span>
                  <Icon name="clock" size={14} /> {tempsCourt}
                </span>
              )}
              {r?.kcal != null && (
                <span>
                  <Icon name="flame" size={14} /> {r.kcal} kcal
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {(chips.length > 0 || r?.fraicheur) && (
        <div className="menu-card-meta">
          {chips.length > 0 && (
            <div className="mchips">
              {chips.map((b) => (
                <span className="mchip" key={b.id}>
                  {b.nom}
                </span>
              ))}
            </div>
          )}
          {r?.fraicheur && (
            <div className="mh">
              <Icon name="box" size={14} /> {r.fraicheur}
            </div>
          )}
        </div>
      )}
      {r?.portions && (r.portions.marc || r.portions.melanie) && (
        <div className="portions-box">
          <div className="portions-title">Portions</div>
          {r.portions.marc && (
            <p>
              <span className="portion-tag">Marc</span> {r.portions.marc}
            </p>
          )}
          {r.portions.melanie && (
            <p>
              <span className="portion-tag keto">Mél</span> {r.portions.melanie}
            </p>
          )}
        </div>
      )}
      {r && (
        <button type="button" className="rtoggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span>Voir la recette</span>
          <span className={open ? 'chev up' : 'chev'}>
            <Icon name="chev" size={14} />
          </span>
        </button>
      )}
      {open && r && <RecetteDetail recette={r} bases={bases} />}
    </article>
  );
}

function RecetteDetail({ recette, bases }: { recette: Recette; bases?: BaseCuisine[] }) {
  const [baseOuverte, setBaseOuverte] = useState<string | null>(null);
  const aMacros =
    recette.kcal != null ||
    recette.proteines != null ||
    recette.glucides != null ||
    recette.lipides != null;
  return (
    <div className="recette-detail">
      {aMacros && (
        <div className="recette-nutri">
          {recette.kcal != null && (
            <span>
              <Icon name="flame" size={14} /> {recette.kcal} kcal
            </span>
          )}
          {recette.glucides != null && (
            <span>
              <Icon name="wheat" size={14} /> {recette.glucides}g C
            </span>
          )}
          {recette.proteines != null && (
            <span>
              <Icon name="meat" size={14} /> {recette.proteines}g P
            </span>
          )}
          {recette.lipides != null && (
            <span>
              <Icon name="drop" size={14} /> {recette.lipides}g F
            </span>
          )}
        </div>
      )}
      {recette.score != null && (
        <div className="recette-score">
          <div className="recette-score-head">
            <span className="stat-label">Health score :</span>
            <span className="recette-score-value">
              {recette.score}
              <small>/10</small>
            </span>
          </div>
          <div className="score-bar">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={i < recette.score! ? 'score-seg on' : 'score-seg'} />
            ))}
          </div>
        </div>
      )}
      {recette.pour && <p className="recette-pour">{recette.pour}</p>}
      {recette.bases && recette.bases.length > 0 && (
        <div className="recette-bases">
          {recette.bases.map((b) => {
            const base = trouverBase(b, bases);
            return base ? (
              <button
                type="button"
                key={base.id}
                className={baseOuverte === base.id ? 'recette-bchip on' : 'recette-bchip'}
                aria-expanded={baseOuverte === base.id}
                onClick={() => setBaseOuverte(baseOuverte === base.id ? null : base.id)}
              >
                🧂 {base.nom}
              </button>
            ) : null;
          })}
        </div>
      )}
      {baseOuverte &&
        bases
          ?.filter((b) => b.id === baseOuverte)
          .map((b) => (
            <p className="recette-bdesc" key={b.id}>
              🧂 {b.nom} : {b.texte}
            </p>
          ))}
      {recette.etapes && recette.etapes.length > 0 && (
        <ol className="recette-etapes">
          {recette.etapes.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ol>
      )}
      {recette.mel && <p className="recette-ligne recette-mel">{recette.mel}</p>}
      {recette.batch && <p className="recette-ligne recette-bat">{recette.batch}</p>}
    </div>
  );
}

function trouverBase(ref: string, bases: BaseCuisine[] | undefined): BaseCuisine | undefined {
  if (!bases) return undefined;
  const cible = ref.toLowerCase();
  // égalité exacte d'abord, puis préfixe borné (`b4` ne doit pas matcher `b40-…`)
  return bases.find((b) => b.id === cible) ?? bases.find((b) => b.id.startsWith(`${cible}-`));
}
