import { useState } from 'react';
import { MAGASINS_PRESETS, magasinsDe, normaliseComplement } from '../lib/model';
import { Icon } from './Icon';

const meme = (a: string, b: string) => normaliseComplement(a) === normaliseComplement(b);

// Ajoute `nom` à la liste (trim, 40 car., sans doublon casse/accents).
export const avecMagasin = (liste: string[], nom: string): string[] =>
  magasinsDe({ magasins: [...liste, nom] });

// Choix de PLUSIEURS magasins : puces (présets + ajouts libres) et saisie libre.
// Le premier de la liste est le magasin principal (prix estimés chez lui).
// `saisie` / `onSaisie` : le texte en attente est remonté pour que le parent
// l'ajoute à l'enregistrement (rien n'est perdu si on oublie « Ajouter »).
export function ChampMagasins({
  valeur,
  onChange,
  idPrefix,
  saisie,
  onSaisie,
}: {
  valeur: string[];
  onChange: (v: string[]) => void;
  idPrefix: string;
  saisie: string;
  onSaisie: (v: string) => void;
}) {
  const [doublon, setDoublon] = useState(false);
  const bascule = (nom: string) => {
    setDoublon(false);
    onChange(valeur.some((v) => meme(v, nom)) ? valeur.filter((v) => !meme(v, nom)) : avecMagasin(valeur, nom));
  };
  const ajouter = () => {
    const t = saisie.trim();
    if (!t) return;
    if (valeur.some((v) => meme(v, t))) {
      setDoublon(true);
      return;
    }
    setDoublon(false);
    onChange(avecMagasin(valeur, t));
    onSaisie('');
  };
  const libres = valeur.filter((v) => !MAGASINS_PRESETS.some((p) => meme(p, v)));
  return (
    <div className="onboarding-field" role="group" aria-labelledby={`${idPrefix}-titre`}>
      <p className="onb-label" id={`${idPrefix}-titre`}>
        Magasins habituels
      </p>
      <div className="chips">
        {MAGASINS_PRESETS.map((m) => {
          const on = valeur.some((v) => meme(v, m));
          return (
            <button key={m} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => bascule(m)}>
              {m}
            </button>
          );
        })}
        {libres.map((m) => (
          <button key={m} type="button" className="chip on" aria-pressed="true" onClick={() => bascule(m)}>
            {m}
          </button>
        ))}
      </div>
      <div className="addrow">
        <input
          id={`${idPrefix}-ajout`}
          value={saisie}
          maxLength={40}
          placeholder="Un autre magasin…"
          aria-label="Nom d'un autre magasin"
          onChange={(e) => {
            setDoublon(false);
            onSaisie(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              ajouter();
            }
          }}
        />
        <button type="button" aria-label="Ajouter ce magasin" onClick={ajouter}>
          <Icon name="plus" size={14} /> Ajouter
        </button>
      </div>
      {doublon && (
        <p className="error" role="alert">
          Ce magasin est déjà sélectionné.
        </p>
      )}
      <p className="onb-hint">
        {valeur.length > 1
          ? `Principal : ${valeur[0]} — l'IA estime les prix chez lui et indique la répartition si besoin.`
          : 'Plusieurs possibles ; le premier choisi sert de magasin principal.'}
      </p>
    </div>
  );
}
