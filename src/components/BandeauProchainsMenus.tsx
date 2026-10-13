// Bandeau option B (spec refonte §6) : k créneaux de la semaine type modifiés
// depuis le lancement des menus en cours. Sans détail dans l'onglet Semaine ;
// « Ma semaine type » ajoute les badges jour par jour.
export function BandeauProchainsMenus({ k, onOuvrir }: { k: number; onOuvrir: () => void }) {
  if (k === 0) return null;
  return (
    <div className="bandeau-prochains" role="status">
      <span>
        {k} changement{k > 1 ? 's' : ''} pour tes prochains menus
      </span>
      <button type="button" className="lien" onClick={onOuvrir}>
        Prépare tes prochains menus
      </button>
    </div>
  );
}
