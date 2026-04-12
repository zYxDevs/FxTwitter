#!/usr/bin/env node
/**
 * Encrypt multi-provider credentials for FixTweet worker bundle (AES-256-GCM).
 * Subcommands: encrypt | push | encrypt-push
 */
import { execFileSync } from 'node:child_process';
import { createCipheriv, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

config();

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEY_PATH = join(repoRoot, '.credential-key');
const PLAINTEXT_PATH = join(repoRoot, 'credentials.json');
const ENCRYPTED_PATH = join(repoRoot, 'credentials.enc.json');
const R2_OBJECT_KEY = process.env.R2_OBJECT_KEY || 'credentials.enc.json';

function base64UrlToBuffer(b64url) {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

function encrypt() {
  if (!existsSync(PLAINTEXT_PATH)) {
    console.error(
      `Missing ${PLAINTEXT_PATH}. Create it with the multi-provider schema (e.g. { "twitter": { "accounts": [...] } }).`
    );
    process.exit(1);
  }

  const plaintext = readFileSync(PLAINTEXT_PATH, 'utf-8');
  const parsed = JSON.parse(plaintext);
  if (!parsed?.twitter?.accounts || !Array.isArray(parsed.twitter.accounts)) {
    console.error(
      'credentials.json must use the multi-provider shape, e.g. { "twitter": { "accounts": [...] } } (see credentials.example.json).'
    );
    process.exit(1);
  }

  let keyB64url;
  if (existsSync(KEY_PATH)) {
    keyB64url = readFileSync(KEY_PATH, 'utf-8').trim();
  } else {
    const rawKey = randomBytes(32);
    keyB64url = rawKey.toString('base64url');
    writeFileSync(KEY_PATH, keyB64url + '\n', 'utf-8');
    console.log('\nNew encryption key written to .credential-key');
    console.log('Set Worker secret: wrangler secret put CREDENTIAL_KEY');
    console.log('Paste this value (base64url, one line):\n');
    console.log(keyB64url);
    console.log('');
  }

  const key = base64UrlToBuffer(keyB64url);
  if (key.length !== 32) {
    console.error('.credential-key must decode to 32 bytes (AES-256). Use base64url.');
    process.exit(1);
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([encrypted, tag]);

  const out = {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64')
  };
  writeFileSync(ENCRYPTED_PATH, JSON.stringify(out) + '\n', 'utf-8');
  console.log(`Wrote ${ENCRYPTED_PATH}`);
}

function push() {
  if (!existsSync(ENCRYPTED_PATH)) {
    console.error(`Missing ${ENCRYPTED_PATH}. Run: npm run credentials:encrypt`);
    process.exit(1);
  }

  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    console.error(
      'Set R2_BUCKET_NAME in .env (optional R2_OBJECT_KEY). Authenticate with wrangler (e.g. wrangler login or CLOUDFLARE_API_TOKEN with R2 write).'
    );
    process.exit(1);
  }

  const wranglerBin = join(repoRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  if (!existsSync(wranglerBin)) {
    console.error('Missing wrangler. Run npm install.');
    process.exit(1);
  }

  const objectPath = `${bucket}/${R2_OBJECT_KEY}`;
  try {
    execFileSync(
      process.execPath,
      [
        wranglerBin,
        'r2',
        'object',
        'put',
        objectPath,
        '--file',
        ENCRYPTED_PATH,
        '--content-type',
        'application/json',
        '--remote',
        '-y'
      ],
      { stdio: 'inherit', cwd: repoRoot, env: process.env }
    );
  } catch {
    process.exit(1);
  }

  console.log(`Uploaded r2://${objectPath}`);
}

const cmd = process.argv[2];
if (cmd === 'encrypt') {
  encrypt();
} else if (cmd === 'push') {
  push();
} else if (cmd === 'encrypt-push') {
  encrypt();
  push();
} else {
  console.error('Usage: node credential-tools.mjs <encrypt|push|encrypt-push>');
  process.exit(1);
}
