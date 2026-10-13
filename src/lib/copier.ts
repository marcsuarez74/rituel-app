// Copie dans le presse-papiers avec repli (happy-dom, navigateurs anciens) :
// partagé par la demande de menus (assistant) et les messages de correction.
export const copier = async (texte: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(texte);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = texte;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
};
