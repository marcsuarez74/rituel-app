import { Icon } from '../Icon';
import { ONGLETS, type Onglet } from './onglets';

// Barre du bas (spec v2 §3) : 5 onglets sous le pouce, icône + libellé
// toujours visibles, l'actif porte une pastille.
export function BarreOnglets({ actif, onSelect }: { actif: Onglet; onSelect: (o: Onglet) => void }) {
  return (
    <nav className="barre-onglets" aria-label="Navigation principale">
      {ONGLETS.map(({ id, label, icone }) => (
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
