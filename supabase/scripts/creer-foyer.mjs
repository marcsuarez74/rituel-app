// Crée le foyer (hash du code + insert households) — usage unique au setup.
// Usage : node supabase/scripts/creer-foyer.mjs <SUPABASE_URL> <SERVICE_ROLE_KEY> [code]
// Sans code : génère une phrase aléatoire et l'affiche.
import { pbkdf2Sync, randomBytes, randomInt } from 'node:crypto';

const [url, serviceKey, codeArg] = process.argv.slice(2);
if (!url || !serviceKey) {
  console.error('Usage : node supabase/scripts/creer-foyer.mjs <SUPABASE_URL> <SERVICE_ROLE_KEY> [code]');
  process.exit(1);
}

const MOTS = ['basilic', 'citron', 'sauge', 'romarin', 'thym', 'menthe', 'origan', 'estragon'];
const code =
  codeArg ??
  `${MOTS[randomInt(MOTS.length)]}-${MOTS[randomInt(MOTS.length)]}-${randomBytes(2).toString('hex')}`;

// Phase avec l'edge function : un code < 6 caractères serait refusé (401).
if (code.length < 6) {
  console.error('Code de foyer trop court : 6 caractères minimum (exigé par la connexion).');
  process.exit(1);
}

// L'edge function exige UN foyer unique (data.length === 1) : on refuse
// d'en créer un second.
const deja = await fetch(`${url}/rest/v1/households?select=id`, {
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
});
if (!deja.ok) {
  console.error(`Échec lecture households (${deja.status}) : ${await deja.text()}`);
  process.exit(1);
}
const existants = await deja.json();
if (existants.length > 0) {
  console.error(
    `Un foyer existe déjà (id ${existants[0].id}) — la connexion exige un foyer unique. Purge-le d'abord si besoin.`,
  );
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(code, salt, 100000, 32, 'sha256');
const b64url = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const code_hash = `pbkdf2-sha256$100000$${b64url(salt)}$${b64url(hash)}`;

const res = await fetch(`${url}/rest/v1/households`, {
  method: 'POST',
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify({ code_hash }),
});
if (!res.ok) {
  console.error(`Échec insert (${res.status}) : ${await res.text()}`);
  process.exit(1);
}
const [foyer] = await res.json();
console.log(`Foyer créé : ${foyer.id}\nCode de foyer : ${code}\n→ à saisir dans l'app (une fois par téléphone).`);
