import { load } from 'js-yaml';
import type {
  BaseCuisine,
  ChecklistItem,
  CourseItem,
  MealKey,
  MenuDay,
  MicroBatchJour,
  ProfileData,
  Recette,
  ReserveLigne,
  RituelEtape,
  WeekMeta,
  WeeklyData,
} from './model';

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const MENU_KEYS: Record<string, MealKey> = {
  'dejeuner-marc': 'dejeunerMarc',
  'dejeuner-melanie': 'dejeunerMelanie',
  'diner-famille': 'dinerFamille',
  'diner-melanie': 'dinerMelanie',
  batch: 'batch',
};

export interface ParseResult {
  data: WeeklyData;
  warnings: string[];
}

function preview(line: string): string {
  const t = line.trim();
  return t.length > 40 ? `${t.slice(0, 39)}…` : t;
}

function duplicateIdWarning(id: string, section: string): string {
  return `Id dupliqué « ${id} » (${section}) — les éléments partagent leur état de coche.`;
}

function registerId(id: string, section: string, seen: Set<string>, warnings: string[]): void {
  if (seen.has(id)) warnings.push(duplicateIdWarning(id, section));
  seen.add(id);
}

// Ref recette en fin de ligne : « → slug ». Une ref n'est retenue que si le slug
// correspond à une recette du fichier (égalité, ou préfixe « slug- ») — sinon le
// « → … » reste dans le texte (prose légitime : « → boîte lundi Marc »).
const REF_SHAPE = /\s*→\s*(\S+)\s*$/;

function refConnue(ref: string, recettes: Recette[]): boolean {
  const cible = ref.toLowerCase();
  return recettes.some((r) => r.id === cible || r.id.startsWith(`${cible}-`));
}

function extraireRef(texte: string, recettes: Recette[]): { texte: string; ref?: string } {
  const m = texte.match(REF_SHAPE);
  if (!m || !refConnue(m[1], recettes)) return { texte };
  const net = texte.slice(0, m.index).trimEnd();
  // Entrée dégénérée (« → R7 » seul) : pas de label vide — on garde le texte d'origine.
  if (!net) return { texte };
  return { texte: net, ref: m[1] };
}

export function parseWeeklyFile(raw: string): ParseResult {
  const content = raw.replace(/^\uFEFF/, '');
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) throw new Error('Frontmatter introuvable : le fichier doit commencer par --- (semaine, menu, du, au).');
  // YAML : un « # » précédé d'une espace dans une valeur non quotée démarre un commentaire — js-yaml tronque alors la valeur.
  const metaDoc = load(m[1]) as Record<string, string | undefined>;
  if (
    !metaDoc.semaine ||
    !metaDoc.menu ||
    !metaDoc.du ||
    !metaDoc.au ||
    typeof metaDoc.semaine !== 'string' ||
    typeof metaDoc.menu !== 'string' ||
    typeof metaDoc.du !== 'string' ||
    typeof metaDoc.au !== 'string'
  )
    throw new Error('Frontmatter incomplet : semaine, menu, du, au sont requis.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metaDoc.du) || !/^\d{4}-\d{2}-\d{2}$/.test(metaDoc.au))
    throw new Error('Frontmatter incomplet : du et au doivent être au format AAAA-MM-JJ.');
  const meta: WeekMeta = {
    semaine: metaDoc.semaine,
    menu: metaDoc.menu,
    du: metaDoc.du,
    au: metaDoc.au,
    ...(typeof metaDoc.titre === 'string' ? { titre: metaDoc.titre } : {}),
  };

  const warnings: string[] = [];
  const seen = new Set<string>();
  const sections = splitH2(content, warnings);
  const coursesParse = parseCourses(sections.get('courses') ?? '', 'courses', warnings, seen);
  const courses = coursesParse.items;
  const menu = parseMenu(sections.get('menu') ?? '', 'menu', warnings);
  // Recettes et bases AVANT le batch : les refs « → slug » des tâches, étapes
  // et micro-batch sont validées contre les recettes du fichier.
  const recettes = parseRecettes(sections.get('recettes') ?? '', warnings, seen);
  const bases = parseBases(sections.get('bases') ?? '', warnings, seen);
  const lignes = lignesBatch(sections.get('batch') ?? '', warnings);
  const batch = parseBatch(lignes, warnings, seen, recettes);
  const rituelParse = parseRituel(lignes, 'batch', warnings, seen, recettes);
  const rituel = rituelParse.etapes;
  const microBatch = parseMicroBatch(lignes, warnings, recettes);
  const reserve = parseReserve(lignes, warnings, seen);
  const profiles = {
    marc: parseProfile(sections.get('marc') ?? '', 'marc', warnings, seen),
    melanie: parseProfile(sections.get('melanie') ?? '', 'melanie', warnings, seen),
  };
  for (const s of ['courses', 'menu', 'batch', 'marc', 'melanie'])
    if (!sections.has(s)) warnings.push(`Section ## « ${s} » absente ou vide.`);
  return {
    data: {
      meta,
      courses,
      ...(coursesParse.budget ? { budget: coursesParse.budget } : {}),
      menu,
      batch,
      profiles,
      ...(recettes.length ? { recettes } : {}),
      ...(bases.length ? { bases } : {}),
      ...(rituel.length ? { rituel } : {}),
      ...(rituelParse.production ? { rituelProduction: rituelParse.production } : {}),
      ...(rituelParse.termine ? { rituelTermine: rituelParse.termine } : {}),
      ...(microBatch.length ? { microBatch } : {}),
      ...(reserve.length ? { reserve } : {}),
    },
    warnings,
  };
}

function splitH2(raw: string, warnings: string[]): Map<string, string> {
  const map = new Map<string, string>();
  let cur = '';
  let buf: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      if (cur) map.set(cur, buf.join('\n'));
      cur = slugify(h[1]);
      if (map.has(cur)) warnings.push(`Section dupliquée « ${cur} » — la seconde écrase la première.`);
      buf = [];
    } else if (cur) buf.push(line);
  }
  if (cur) map.set(cur, buf.join('\n'));
  return map;
}

function parseCourses(
  text: string,
  section: string,
  warnings: string[],
  seen: Set<string>,
): { items: CourseItem[]; budget?: string } {
  const out: { items: CourseItem[]; budget?: string } = { items: [] };
  let rayon = 'divers';
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^###\s+(.+?)\s*$/);
    if (h) {
      rayon = slugify(h[1]);
      continue;
    }
    const budget = line.match(/^\s*[-*]\s+budget\s*:\s*(.+?)\s*$/);
    if (budget) {
      out.budget = budget[1];
      continue;
    }
    const it = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (it) {
      const withBox = it[1].match(/^\[( |x|X)\]\s+(.+)$/);
      const labelBrut = withBox ? withBox[2] : it[1];
      // v2 : suffixes optionnels en fin de ligne — ` · rituel` (alimente le batch)
      // et ` | note` (note de fraîcheur). La note est retirée d'abord (dernier « | »),
      // puis le marqueur rituel — l'id est calculé sur le libellé nettoyé des deux.
      const parts = labelBrut.split(/\s+\|\s+(?=[^|]*$)/, 2);
      const rituel = / · rituel$/.test(parts[0]);
      const label = parts[0].replace(/ · rituel$/, '').trim();
      const note = parts[1];
      const id = `courses:${rayon}:${slugify(label)}`;
      registerId(id, section, seen, warnings);
      out.items.push({
        id,
        rayon,
        label,
        ...(rituel ? { rituel: true } : {}),
        ...(note ? { note } : {}),
      });
      continue;
    }
    if (line.trim()) warnings.push(`Ligne ignorée (${section}) : « ${preview(line)} »`);
  }
  return out;
}

function parseMenu(text: string, section: string, warnings: string[]): MenuDay[] {
  const days: MenuDay[] = [];
  let day: MenuDay | null = null;
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^###\s+(.+?)\s*$/);
    if (h) {
      if (day) days.push(day);
      day = { jour: h[1] };
      continue;
    }
    if (!line.trim()) continue;
    const kv = line.match(/^\s*[-*]\s+([a-z-]+)\s*:\s*(.+?)\s*$/);
    if (kv && day) {
      const key = MENU_KEYS[kv[1]];
      if (key) {
        const ref = kv[2].match(REF_SHAPE);
        const texte = ref ? kv[2].slice(0, ref.index).trimEnd() : kv[2];
        (day as MenuDay & Record<string, string | undefined>)[key] = texte;
        if (ref) {
          day.recetteRefs = { ...day.recetteRefs, [key]: ref[1] };
        }
      } else warnings.push(`Clé menu inconnue « ${kv[1]} » ignorée (${day.jour}).`);
    } else {
      warnings.push(`Ligne ignorée (${section}) : « ${preview(line)} »`);
    }
  }
  if (day) days.push(day);
  return days;
}

function parseProfile(text: string, section: string, warnings: string[], seen: Set<string>): ProfileData {
  const res: ProfileData = { cibles: [], seances: [], rappels: [] };
  let cur: 'cibles' | 'seances' | 'rappels' | null = null;
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^###\s+(.+?)\s*$/);
    if (h) {
      const k = slugify(h[1]);
      cur = k === 'cibles' || k === 'seances' || k === 'rappels' ? k : null;
      continue;
    }
    if (!line.trim()) continue;
    const plain = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (plain && cur) {
      if (cur === 'cibles' || cur === 'rappels') res[cur].push(plain[1]);
      else {
        const withBox = plain[1].match(/^\[( |x|X)\]\s+(.+)$/);
        const label = withBox ? withBox[2] : plain[1];
        const id = `seances:${section}:${slugify(label)}`;
        registerId(id, section, seen, warnings);
        res.seances.push({ id, label });
      }
      continue;
    }
    warnings.push(`Ligne ignorée (${section}) : « ${preview(line)} »`);
  }
  return res;
}

const BATCH_SUBS = new Set(['rituel-dimanche', 'micro-batch', 'reserve']);
const SUB_IGNOREE = '__ignore__';

type LigneBatch = [line: string, cur: string | null];

const RITUEL_SHAPE = /^\s*[-*]\s+(\S.*?min)\s*·\s*(.+?)(?:\s*—\s*(.+?))?\s*$/;
const MICRO_SHAPE =
  /^\s*[-*]\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s*:\s*(.+?)\s*$/;

function parseBatch(
  lignes: LigneBatch[],
  warnings: string[],
  seen: Set<string>,
  recettes: Recette[],
): ChecklistItem[] {
  const out: ChecklistItem[] = [];
  for (const [line, cur] of lignes) {
    if (cur) continue;
    const plain = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (!plain) {
      if (line.trim()) warnings.push(`Ligne ignorée (batch) : « ${preview(line)} »`);
      continue;
    }
    const withBox = plain[1].match(/^\[( |x|X)\]\s+(.+)$/);
    if (!withBox) {
      if (RITUEL_SHAPE.test(line)) {
        warnings.push('Ligne rituel hors sous-section « Rituel dimanche » ignorée (batch).');
        continue;
      }
      if (/^\s*[-*]\s+(production|termine)\s*:/.test(line)) {
        warnings.push('Ligne production/termine hors sous-section « Rituel dimanche » ignorée (batch).');
        continue;
      }
      if (MICRO_SHAPE.test(line)) {
        warnings.push('Ligne micro-batch hors sous-section « Micro-batch » ignorée (batch).');
        continue;
      }
    }
    const brut = withBox ? withBox[2] : plain[1];
    // Ref optionnelle « → slug », retirée AVANT le slug d'id : l'état de coche
    // survit à l'ajout ou au retrait d'une ref.
    const { texte: label, ref } = extraireRef(brut, recettes);
    const id = `batch:${slugify(label)}`;
    registerId(id, 'batch', seen, warnings);
    out.push({ id, label, ...(ref ? { ref } : {}) });
  }
  return out;
}

function lignesBatch(text: string, warnings: string[]): LigneBatch[] {
  const out: LigneBatch[] = [];
  let cur: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^###\s+(.+?)\s*$/);
    if (h) {
      const k = slugify(h[1]);
      if (BATCH_SUBS.has(k)) cur = k;
      else {
        warnings.push(`Sous-section « ${h[1]} » ignorée (batch).`);
        cur = SUB_IGNOREE;
      }
      continue;
    }
    if (!line.trim()) cur = null;
    out.push([line, cur]);
  }
  return out;
}

function parseRituel(
  lignes: LigneBatch[],
  section: string,
  warnings: string[],
  seen: Set<string>,
  recettes: Recette[],
): { etapes: RituelEtape[]; production?: string; termine?: string } {
  const etapes: RituelEtape[] = [];
  let production: string | undefined;
  let termine: string | undefined;
  for (const [line, cur] of lignes) {
    if (cur !== 'rituel-dimanche') continue;
    if (!line.trim()) continue;
    const prod = line.match(/^\s*[-*]\s+production\s*:\s*(.*?)\s*$/);
    if (prod) {
      if (!prod[1]) warnings.push(`Ligne ignorée (${section}/rituel) : « production: » sans contenu.`);
      else if (production !== undefined)
        warnings.push(`« production » dupliquée (${section}/rituel) — la première gagne.`);
      else production = prod[1];
      continue;
    }
    const fin = line.match(/^\s*[-*]\s+termine\s*:\s*(.*?)\s*$/);
    if (fin) {
      if (!fin[1]) warnings.push(`Ligne ignorée (${section}/rituel) : « termine: » sans contenu.`);
      else if (termine !== undefined)
        warnings.push(`« termine » dupliqué (${section}/rituel) — le premier gagne.`);
      else termine = fin[1];
      continue;
    }
    // Ref optionnelle en fin de ligne, avant le découpage créneau · label — détail.
    const { texte: ligneNet, ref } = extraireRef(line, recettes);
    const m = ligneNet.match(RITUEL_SHAPE);
    if (!m) {
      warnings.push(`Ligne ignorée (${section}/rituel) : « ${preview(line)} »`);
      continue;
    }
    const [, creneau, label, detail] = m;
    const id = `batch:rituel:${slugify(label)}`;
    registerId(id, `${section}/rituel`, seen, warnings);
    etapes.push({
      id,
      creneau,
      label,
      ...(detail ? { detail } : {}),
      ...(ref ? { ref } : {}),
    });
  }
  return {
    etapes,
    ...(production !== undefined ? { production } : {}),
    ...(termine !== undefined ? { termine } : {}),
  };
}

// Segment « durée » strict du micro-batch : « 10 min », « 1 h ». Un segment plus long (« 10 min · détail ») ou une durée composée (« 1h30 ») reste un détail.
const DUREE_SEG = /^\d+\s*(?:min|h|minutes?|heures?)\s*$/i;

function parseMicroBatch(
  lignes: LigneBatch[],
  warnings: string[],
  recettes: Recette[],
): MicroBatchJour[] {
  const out: MicroBatchJour[] = [];
  for (const [line, cur] of lignes) {
    if (cur !== 'micro-batch') continue;
    if (!line.trim()) continue;
    const m = line.match(/^\s*[-*]\s+([a-z-]+)\s*:\s*(.+?)\s*$/);
    if (!m) {
      warnings.push(`Ligne ignorée (batch/micro-batch) : « ${preview(line)} »`);
      continue;
    }
    const segs = m[2].split(/\s*\|\s*/).filter((s) => s.length > 0);
    const quoi = segs[0] ?? '';
    const rest = segs.slice(1);
    let i = 0;
    let duree: string | undefined;
    let quantite: string | undefined;
    let ref: string | undefined;
    if (rest[i] && DUREE_SEG.test(rest[i])) {
      duree = rest[i];
      i++;
    }
    if (rest[i]) {
      const ex = extraireRef(rest[i], recettes);
      // La quantité n'est reconnue qu'accompagnée de sa ref recette
      // (« 2 boîtes → r2 ») — un segment libre reste un détail (v1).
      if (ex.ref) {
        quantite = ex.texte;
        ref = ex.ref;
        i++;
      }
    }
    const detail = rest[i] ? rest.slice(i).join(' | ') : undefined;
    out.push({
      jour: m[1],
      quoi,
      ...(duree ? { duree } : {}),
      ...(quantite ? { quantite } : {}),
      ...(ref ? { ref } : {}),
      ...(detail ? { detail } : {}),
    });
  }
  return out;
}

const JOURS_RESERVE = new Set(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche', 'mel']);

function parseReserve(lignes: LigneBatch[], warnings: string[], seen: Set<string>): ReserveLigne[] {
  const out: ReserveLigne[] = [];
  for (const [line, cur] of lignes) {
    if (cur !== 'reserve') continue;
    if (!line.trim()) continue;
    const m = line.match(/^\s*[-*]\s+([a-z-]+)\s*:\s*(.+?)\s*$/);
    if (!m) {
      warnings.push(`Ligne réserve ignorée : « ${preview(line)} »`);
      continue;
    }
    const [, cle, reste] = m;
    const pipe = reste.indexOf('|');
    const plat = pipe === -1 ? reste.trim() : reste.slice(0, pipe).trim();
    const conservation = pipe === -1 ? undefined : reste.slice(pipe + 1).trim();
    if (!JOURS_RESERVE.has(cle)) {
      warnings.push(`Ligne réserve ignorée : clé « ${cle} » inconnue (jour ou mel).`);
      continue;
    }
    if (!plat || !conservation) {
      warnings.push(`Ligne réserve ignorée (plat ou conservation vide) : « ${preview(line)} »`);
      continue;
    }
    // Id de coche composé comme lib/batch.ts (reserveId) : dérive de la clé et du
    // plat — deux lignes identiques partagent leur état → warning comme ailleurs.
    registerId(`reserve:${cle}:${slugify(plat)}`, 'batch/réserve', seen, warnings);
    out.push({ cle, plat, conservation });
  }
  return out;
}

function nombreValide(raw: string): number | undefined {
  const n = Number(raw.replace(/\s/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function registerHeadingId(id: string, seen: Set<string>, warnings: string[]): void {
  if (seen.has(id)) warnings.push(`Identifiant « ${id} » déjà utilisé.`);
  seen.add(id);
}

function parseRecettes(text: string, warnings: string[], seen: Set<string>): Recette[] {
  const recettes: Recette[] = [];
  let rec: Recette | null = null;
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^###\s+(.+?)\s*$/);
    if (h) {
      if (rec) recettes.push(rec);
      const id = slugify(h[1]);
      registerHeadingId(id, seen, warnings);
      rec = { id, nom: h[1] };
      continue;
    }
    if (!line.trim()) continue;
    if (!rec) {
      warnings.push(`Ligne ignorée (recettes) : « ${preview(line)} »`);
      continue;
    }
    const kv = line.match(/^(temps|kcal|proteines|glucides|lipides|score|image|bases|fraicheur)\s*:\s*(.+?)\s*$/);
    if (kv) {
      if (kv[1] === 'temps') rec.temps = kv[2];
      else if (kv[1] === 'bases') rec.bases = kv[2].split(',').map((b) => b.trim());
      else if (kv[1] === 'fraicheur') rec.fraicheur = kv[2];
      else if (kv[1] === 'image') {
        if (kv[2].startsWith('https://')) rec.image = kv[2];
        else
          warnings.push(
            `Valeur image invalide pour la recette « ${rec.nom} » : ligne ignorée.`,
          );
      } else if (kv[1] === 'score') {
        const n = Number(kv[2]);
        if (Number.isInteger(n) && n >= 0 && n <= 10) rec.score = n;
        else
          warnings.push(
            `Valeur score invalide pour la recette « ${rec.nom} » : ligne ignorée.`,
          );
      } else {
        const n = nombreValide(kv[2]);
        if (n === undefined)
          warnings.push(
            `Valeur ${kv[1]} invalide pour la recette « ${rec.nom} » : ligne ignorée.`,
          );
        else if (kv[1] === 'kcal') rec.kcal = n;
        else if (kv[1] === 'proteines') rec.proteines = n;
        else if (kv[1] === 'glucides') rec.glucides = n;
        else rec.lipides = n;
      }
      continue;
    }
    const portions = line.match(/^\s*[-*]\s+portions\s+(marc|melanie)\s*:\s*(.+?)\s*$/);
    if (portions) {
      rec.portions = { ...rec.portions, [portions[1]]: portions[2] };
      continue;
    }
    const pour = line.match(/^\s*[-*]\s+pour\s*(?:\d+\s*)?\s*:\s*(.+?)\s*$/);
    if (pour) {
      rec.pour = pour[1];
      continue;
    }
    const mel = line.match(/^\s*[-*]\s+mel\s*:\s*(.+?)\s*$/);
    if (mel) {
      rec.mel = mel[1];
      continue;
    }
    const bat = line.match(/^\s*[-*]\s+batch\s*:\s*(.+?)\s*$/);
    if (bat) {
      rec.batch = bat[1];
      continue;
    }
    const etape = line.match(/^\s*\d+[.)]\s+(.+?)\s*$/);
    if (etape) {
      rec.etapes = [...(rec.etapes ?? []), etape[1]];
      continue;
    }
    warnings.push(`Ligne ignorée (recettes) : « ${preview(line)} »`);
  }
  if (rec) recettes.push(rec);
  return recettes;
}

function parseBases(text: string, warnings: string[], seen: Set<string>): BaseCuisine[] {
  const bases: BaseCuisine[] = [];
  let base: BaseCuisine | null = null;
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^###\s+(.+?)\s*$/);
    if (h) {
      if (base) bases.push(base);
      const id = slugify(h[1]);
      registerHeadingId(id, seen, warnings);
      base = { id, nom: h[1], texte: '' };
      continue;
    }
    if (!line.trim()) continue;
    if (!base) {
      warnings.push(`Ligne ignorée (bases) : « ${preview(line)} »`);
      continue;
    }
    base.texte = base.texte ? `${base.texte} ${line.trim()}` : line.trim();
  }
  if (base) bases.push(base);
  return bases;
}
