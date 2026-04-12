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

if (!Array.isArray(accounts) || accounts.length === 0) {
  console.error(
    'credentials.complete.json must have twitter.accounts or legacy top-level accounts as a non-empty array'
  );
  process.exit(1);
}

const requiredStringFields = ['username', 'authToken', 'csrfToken'];

for (let i = 0; i < accounts.length; i++) {
  const cred = accounts[i];
  const id =
    cred != null &&
    typeof cred === 'object' &&
    !Array.isArray(cred) &&
    typeof cred.username === 'string' &&
    cred.username.length > 0
      ? `accounts[${i}] (username: ${JSON.stringify(cred.username)})`
      : `accounts[${i}]`;

  if (cred === null || typeof cred !== 'object' || Array.isArray(cred)) {
    console.error(`${id}: each account must be a plain object`);
    process.exit(1);
  }

  for (const field of requiredStringFields) {
    const v = cred[field];
    if (v === undefined || v === null) {
      console.error(`${id}: missing required field "${field}"`);
      process.exit(1);
    }
    if (typeof v !== 'string') {
      console.error(
        `${id}: "${field}" must be a non-empty string, got ${typeof v}`
      );
      process.exit(1);
    }
    if (v.length === 0) {
      console.error(`${id}: "${field}" must be non-empty`);
      process.exit(1);
    }
  }
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
