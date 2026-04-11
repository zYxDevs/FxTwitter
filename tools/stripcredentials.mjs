/**
 * Strip sensitive fields from credentials.complete.json → credentials.json
 * Output shape: { "twitter": { "accounts": [{ username, authToken, csrfToken }] } }
 *
 * Accepts complete file as either:
 *   - { "twitter": { "accounts": [...] } }  (preferred)
 *   - { "accounts": [...] }                  (legacy elongator export)
 */
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const completePath = join(repoRoot, 'credentials.complete.json');
const outPath = join(repoRoot, 'credentials.json');

const raw = JSON.parse(fs.readFileSync(completePath, 'utf8'));
const accounts = Array.isArray(raw.twitter?.accounts)
  ? raw.twitter.accounts
  : Array.isArray(raw.accounts)
    ? raw.accounts
    : null;

if (!accounts) {
  console.error(
    'credentials.complete.json must have twitter.accounts[] or legacy top-level accounts[]'
  );
  process.exit(1);
}

const stripped = accounts.map(cred => ({
  username: cred.username,
  authToken: cred.authToken,
  csrfToken: cred.csrfToken
}));

const out = { ...raw };
delete out.accounts;
out.twitter = { accounts: stripped };

fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`Wrote ${outPath} (${stripped.length} twitter account(s))`);
