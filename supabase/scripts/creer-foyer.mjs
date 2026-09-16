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
