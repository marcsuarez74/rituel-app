import { Icon } from '../Icon';
import { ONGLETS, type Onglet } from './onglets';

// Barre du bas (spec v2 §3) : 5 onglets sous le pouce (4 sans le suivi),
// icône + libellé toujours visibles, l'actif porte une pastille.
export function BarreOnglets({
  actif,
  suivi,
  onSelect,
}: {
  actif: Onglet;
  suivi: boolean;
  onSelect: (o: Onglet) => void;
}) {
  return (
    <nav className="barre-onglets" aria-label="Navigation principale">
      {ONGLETS.filter((o) => suivi || o.id !== 'suivi').map(({ id, label, icone }) => (
        <button
          key={id}
          type="button"
          className="onglet"
          aria-current={id === actif ? 'page' : undefined}
          onClick={() => onSelect(id)}
        >
          <span className="onglet-icone">
            <Icon name={icone} size={22} />
          </span>
          {label}
        </button>
      ))}
    </nav>
  );
}
