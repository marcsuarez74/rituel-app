import { useEffect, useState } from 'react';
import type { CycleActif, ReglagesFoyer } from '../../lib/cycle/etat';
import { semaineCoches } from '../../lib/cycle/etat';
import { couleurPlat } from '../../lib/cycle/couleurs';
import { formatQuantite } from '../../lib/cycle/courses';
import { trouverRecette } from '../../lib/cycle/menu';
import {
  dernierJourRituel,
  etapesGuidees,
  ID_ETAPE_RANGE,
  idCocheGeste,
  idCocheRange,
  idCocheRituel,
  platsDuDimanche,
  rangement,
} from '../../lib/cycle/rituel';
import { LETTRES } from '../../lib/cycle/types';
import { Icon } from '../Icon';
import { Legumes } from '../illustrations/Illustrations';
import { Zones } from '../rituel/Zones';
import type { MinuteursRetour } from '../useMinuteurs';
import { useCoches } from '../useCoches';

// Mode guidé (spec refonte §5.2-5.3) : plein écran, une étape à la fois,
// écran maintenu allumé (Wake Lock si dispo). Barre des minuteurs collée en
// haut du contenu, étiquettes des plats (toucher → feuille ingrédients),
// gestes à cocher (persistés), boutons minuteur. Dernière étape « On range »
// (zones de la maquette), puis écran de fin avec confettis (jamais sous
// prefers-reduced-motion). Les minuteurs continuent entre les étapes : le
// hook vit dans App et est passé en prop.

const mmss = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function Guide({
  actif,
  foyer,
  aujourdhui,
  semaine,
  etape,
  syncVersion,
  minuteurs,
  onEtape,
  onQuitter,
}: {
  actif: CycleActif;
  foyer: ReglagesFoyer;
  aujourdhui: string;
  semaine: number;
  etape: number;
  syncVersion: number;
  minuteurs: MinuteursRetour;
  onEtape: (n: number) => void;
  onQuitter: () => void;
}) {
  const lettre = LETTRES[semaine];
  const cycle = actif.cycle;
  const etapes = etapesGuidees(cycle.rituel);
  const { coches, basculer } = useCoches(semaineCoches(actif.id, semaine), syncVersion);
  const [feuille, setFeuille] = useState<string | null>(null); // id de recette
  const rappels = cycle.menus.find((m) => m.lettre === lettre)?.rappelsRituel ?? [];

  // L'écran reste allumé pendant qu'on cuisine (Wake Lock si dispo, sinon rien).
  useEffect(() => {
    let verrou: WakeLockSentinel | null = null;
    let actifEffet = true;
    navigator.wakeLock
      ?.request('screen')
      .then((v) => {
        if (actifEffet) verrou = v;
        else void v.release();
      })
      .catch(() => {});
    return () => {
      actifEffet = false;
      void verrou?.release();
    };
  }, []);

  const fini = etape >= etapes.length;
  const e = etapes[Math.min(etape, etapes.length - 1)];

  // Confettis à l'arrivée sur l'écran de fin — jamais sous reduced-motion,
  // et sans animer si WAAPI manque (happy-dom).
  useEffect(() => {
    if (!fini) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const couleurs = ['#4e9a3a', '#f2c230', '#5aaee0', '#e2553f', '#e08a1e', '#b8336a'];
    for (let k = 0; k < 36; k++) {
      const c = document.createElement('span');
      c.className = 'confetti';
      c.setAttribute('aria-hidden', 'true');
      c.style.left = `${Math.random() * 100}%`;
      c.style.background = couleurs[k % couleurs.length];
      c.style.borderRadius = k % 3 ? '2px' : '999px';
      document.body.appendChild(c);
      const anim = c.animate?.(
        [
          { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
          {
            transform: `translate(${(Math.random() - 0.5) * 90}px, 65vh) rotate(${(Math.random() - 0.5) * 720}deg)`,
            opacity: 0,
          },
        ],
        {
          duration: 1400 + Math.random() * 900,
          delay: Math.random() * 300,
          easing: 'cubic-bezier(0.25, 0.6, 0.4, 1)',
          fill: 'forwards',
        },
      );
      if (anim) anim.onfinish = () => c.remove();
    }
    return () => document.querySelectorAll('.confetti').forEach((x) => x.remove());
  }, [fini]);

  const dimanche = dernierJourRituel(new Date(`${aujourdhui}T12:00:00`), foyer.jourRituel);
  const lignes = rangement(cycle, semaine, dimanche);
  const resteARanger = lignes.filter((l) => !coches[idCocheRange(lettre, l.id)]).length;
  const prets = platsDuDimanche(cycle, semaine).reduce((s, p) => s + p.repas.length, 0);

  // La barre des minuteurs (puces) + les alertes « c'est prêt ! » vivent au
  //-dessus du contenu, sur toutes les étapes (les minuteurs continuent).
  const alertes = minuteurs.sonnes.map((m) => (
    <div key={m.id} className="alerte" role="alert">
      <span>{m.nom} : c'est prêt !</span>
      <button type="button" className="lien" onClick={() => minuteurs.oter(m.id)}>
        OK
      </button>
    </div>
  ));

  if (fini) {
    return (
      <div className="guide">
        <header className="guide-tete">
          <p className="muted">Terminé</p>
          <button type="button" className="avatar" aria-label="Quitter le mode guidé" onClick={onQuitter}>
            <Icon name="croix" size={18} />
          </button>
        </header>
        <main className="guide-fin">
          <Legumes taille={200} />
          <h1>Ta semaine est prête !</h1>
          <p>
            Il ne reste qu'à réchauffer. {prets} repas prêt{prets > 1 ? 's' : ''} pour la semaine.
          </p>
          <button type="button" className="bouton-plein" onClick={onQuitter}>
            Voir ce qu'il y a au frigo
          </button>
        </main>
      </div>
    );
  }

  const pied = (
    <div className="pied-recette">
      <button
        type="button"
        className="lien"
        disabled={etape === 0}
        onClick={() => onEtape(etape - 1)}
      >
        <Icon name="chev-left" size={16} /> Précédente
      </button>
      {e.id === ID_ETAPE_RANGE ? (
        <button
          type="button"
          className="bouton-plein"
          disabled={resteARanger > 0}
          onClick={() => onEtape(etape + 1)}
        >
          {resteARanger > 0 ? `Encore ${resteARanger} à ranger` : 'Tout est rangé'}
        </button>
      ) : (
        <button
          type="button"
          className="bouton-plein"
          onClick={() => {
            const cle = idCocheRituel(lettre, e.id);
            if (!coches[cle]) basculer(cle);
            onEtape(etape + 1);
          }}
        >
          Étape suivante
        </button>
      )}
    </div>
  );

  const recetteFeuille = feuille ? trouverRecette(cycle, feuille) : null;

  return (
    <div className="guide">
      <header className="guide-tete">
        <button type="button" className="lien" onClick={onQuitter}>
          <Icon name="chev-left" size={16} /> Retour
        </button>
        <p className="muted">
          Étape {etape + 1} sur {etapes.length}
        </p>
      </header>
      <div className="guide-progres" aria-hidden="true">
        {etapes.map((x, i) => (
          <span
            key={x.id}
            className={coches[idCocheRituel(lettre, x.id)] || i < etape ? 'fait' : i === etape ? 'courant' : undefined}
          />
        ))}
      </div>

      {e.id === ID_ETAPE_RANGE ? (
        <>
          {alertes}
          <main>
            <h1>On range</h1>
            <p className="muted">Coche chaque boîte quand elle est à sa place.</p>
            <Zones
              lignes={lignes}
              rituel={cycle.rituel}
              ranger
              coches={coches}
              onBasculer={(cle) => basculer(idCocheRange(lettre, cle))}
            />
          </main>
          {pied}
        </>
      ) : (
        <>
          {minuteurs.minuteurs.length > 0 && (
            <div className="minuteurs" aria-label="Minuteurs en cours">
              {minuteurs.minuteurs.map((m) => {
                const sonne = minuteurs.sonnes.some((x) => x.id === m.id);
                const couleur = couleurPlat(m.recette, cycle.rituel);
                return (
                  <span
                    key={m.id}
                    className={`puce-min${sonne ? ' pret' : ''}`}
                    style={{
                      ['--c' as string]: couleur.vive ?? 'var(--accent)',
                      ['--t' as string]: couleur.claire ?? 'var(--accent-clair)',
                    }}
                  >
                    <i />
                    {m.nom} {sonne ? ': prêt !' : <span className="decompte">{mmss(minuteurs.restant(m))}</span>}
                  </span>
                );
              })}
            </div>
          )}
          {alertes}
          <main>
            {etape === 0 && rappels.length > 0 && (
              <section className="variante" aria-label="Cette semaine aussi">
                <b>Cette semaine aussi</b>
                <ul>
                  {rappels.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </section>
            )}
            <div className="concernes">
              {e.plats.map((id) => {
                const recette = trouverRecette(cycle, id);
                if (!recette) return null;
                const couleur = couleurPlat(id, cycle.rituel);
                return (
                  <button
                    key={id}
                    type="button"
                    className="etiq-plat"
                    style={{
                      ['--c' as string]: couleur.vive ?? 'var(--accent)',
                      ['--t' as string]: couleur.claire ?? 'var(--accent-clair)',
                    }}
                    aria-label={`${recette.nom} : voir les ingrédients`}
                    onClick={() => setFeuille(id)}
                  >
                    <span className="pastille" />
                    {recette.nom}
                  </button>
                );
              })}
            </div>
            <h1>{e.titre}</h1>
            {e.detail && <p className="muted">{e.detail}</p>}
            <div className="gestes">
              {e.gestes.map((g, i) => {
                const cle = idCocheGeste(lettre, e.id, i);
                return (
                  <button
                    key={cle}
                    type="button"
                    className="geste"
                    aria-pressed={!!coches[cle]}
                    onClick={() => basculer(cle)}
                  >
                    <span className="case" aria-hidden="true">
                      <Icon name="check" size={20} />
                    </span>
                    <span>{g}</span>
                  </button>
                );
              })}
            </div>
            {e.minuteurs.length > 0 && (
              <div className="lance-min">
                {e.minuteurs.map((m) => {
                  const enCours = minuteurs.minuteurs.find((x) => x.nom === m.nom && x.recette === m.recette);
                  const sonne = enCours && minuteurs.sonnes.some((x) => x.id === enCours.id);
                  if (enCours && sonne) {
                    return (
                      <span key={m.nom} className="btn-min pret">
                        <Icon name="check" size={18} /> {m.nom} : prêt
                      </span>
                    );
                  }
                  if (enCours) {
                    return (
                      <span key={m.nom} className="btn-min en-cours">
                        <Icon name="clock" size={18} /> {m.nom} ·{' '}
                        <span className="decompte">{mmss(minuteurs.restant(enCours))}</span>
                      </span>
                    );
                  }
                  return (
                    <button
                      key={m.nom}
                      type="button"
                      className="btn-min"
                      onClick={() => minuteurs.lance(m.nom, m.minutes, m.recette)}
                    >
                      <Icon name="clock" size={18} /> {m.nom} · {m.minutes} min
                    </button>
                  );
                })}
              </div>
            )}
          </main>
          {pied}
        </>
      )}

      {recetteFeuille && (
        <div className="voile" onClick={() => setFeuille(null)}>
          <section
            className="feuille"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titre-ingr"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2 id="titre-ingr">Ingrédients · {recetteFeuille.nom}</h2>
            <ul className="ingr-feuille">
              {recetteFeuille.ingredients.map((i) => (
                <li key={i.nom}>
                  <b>{i.nom}</b>
                  <span>{formatQuantite(i.quantite, i.unite)}</span>
                </li>
              ))}
            </ul>
            <button type="button" className="lien" onClick={() => setFeuille(null)}>
              Fermer
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
