// Fil « Enregistré ✓ » d'une page détail (réutilisé par toutes les pages).
export function Fil({ active }: { active: boolean }) {
  return active ? (
    <p className="muted" role="status">
      Enregistré ✓
    </p>
  ) : null;
}

// Alerte de validation d'une page détail (réutilisé par toutes les pages).
export function Alerte({ texte }: { texte: string | null }) {
  return texte ? (
    <p className="error" role="alert">
      {texte}
    </p>
  ) : null;
}
