// Fil « Enregistré ✓ » d'une page détail (réutilisé par toutes les pages).
export const Fil = ({ active }: { active: boolean }) =>
  active ? (
    <p className="muted" role="status">
      Enregistré ✓
    </p>
  ) : null;

// Alerte de validation d'une page détail (réutilisé par toutes les pages).
export const Alerte = ({ texte }: { texte: string | null }) =>
  texte ? (
    <p className="error" role="alert">
      {texte}
    </p>
  ) : null;
