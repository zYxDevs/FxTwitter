# AGENTS.md

## Cursor Cloud specific instructions

**Product**: FxEmbed — a Cloudflare Worker that generates rich embeds for social media posts (X/Twitter, Bluesky, TikTok, Mastodon) for chat platforms like Discord and Telegram. Single serverless app, not a multi-service architecture.

### Prerequisites

- **Node.js 24.x** (CI uses `24.14.1`). The VM uses nvm; run `source ~/.nvm/nvm.sh && nvm use 24.14.1` before any npm commands.
- Config files must exist before build/test: copy `wrangler.example.toml` → `wrangler.toml` and `.env.example` → `.env` if they don't already exist. `branding.json` is auto-copied from `branding.example.json` during build if missing.

### Key commands

| Task | Command |
|---|---|
| Install deps | `npm install` |
| Lint | `npm run lint:eslint` |
| Format | `npm run prettier` |
| Build (local) | `npm run build-local` |
| Test | `npx vitest run` |
| Dev server | `npx wrangler dev --local` (serves on `http://localhost:8787`) |

### Dev server testing notes

- The worker routes by `Host` header. Use `-H "Host: fxtwitter.com"` (or `fxbsky.app`, `api.fxtwitter.com`, etc.) with curl to hit different realms.
- Embed responses require a bot User-Agent (e.g. `-H "User-Agent: Discordbot/2.0"`); otherwise the worker redirects to the original platform.
- Tests run inside Miniflare (local Cloudflare Workers simulator) via `@cloudflare/vitest-pool-workers` and use extensive mocks in `test/mocks/` — no real API credentials needed.
- No Cloudflare account or authentication is required for build, test, or local dev.

### Gotchas

- The repo has 8 pre-existing Prettier formatting errors in `src/` that cause `npm run lint:eslint` to exit non-zero. These are in the existing codebase, not introduced by changes.
- `credentials.enc.json` is optional; build gracefully falls back to empty strings if missing.
- `wrangler dev` triggers a build automatically (via the `[build]` section in `wrangler.toml`).
