import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

const configDir = path.dirname(fileURLToPath(import.meta.url));
/** Always use this config so local gitignored wrangler.toml (with legacy service bindings) does not break Miniflare. */
const wranglerConfigPath = path.join(configDir, 'wrangler.vitest.toml');

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: wranglerConfigPath },
      // Disable remote bindings so tests don't require Cloudflare login (AI binding
      // in wrangler.toml would otherwise trigger a remote proxy session in CI).
      remoteBindings: false,
      miniflare: {}
    })
  ],
  define: {
    // Build-time replacements for global variables
    RELEASE_NAME: JSON.stringify('fixtweet-test'),
    TEXT_ONLY_DOMAINS: JSON.stringify('t.fxtwitter.com,t.twittpr.com,t.fixupx.com'),
    INSTANT_VIEW_DOMAINS: JSON.stringify('i.fxtwitter.com,i.twittpr.com,i.fixupx.com'),
    GALLERY_DOMAINS: JSON.stringify('g.fxtwitter.com,g.twittpr.com,g.fixupx.com'),
    FORCE_MOSAIC_DOMAINS: JSON.stringify('m.fxtwitter.com,m.twittpr.com,m.fixupx.com'),
    OLD_EMBED_DOMAINS: JSON.stringify('o.fxtwitter.com,o.twittpr.com,o.fixupx.com'),
    STANDARD_DOMAIN_LIST: JSON.stringify('fxtwitter.com,fixupx.com,twittpr.com'),
    STANDARD_TIKTOK_DOMAIN_LIST: JSON.stringify('dxtiktok.com,cocktiktok.com'),
    STANDARD_BSKY_DOMAIN_LIST: JSON.stringify('fxbsky.app'),
    DIRECT_MEDIA_DOMAINS: JSON.stringify(
      'd.fxtwitter.com,dl.fxtwitter.com,d.fixupx.com,dl.fixupx.com'
    ),
    MOSAIC_DOMAIN_LIST: JSON.stringify('mosaic.fxtwitter.com'),
    POLYGLOT_DOMAIN_LIST: JSON.stringify('polyglot.fxembed.com'),
    POLYGLOT_ACCESS_TOKEN: JSON.stringify('example-token'),
    MOSAIC_BSKY_DOMAIN_LIST: JSON.stringify('mosaic.fxbsky.app'),
    API_HOST_LIST: JSON.stringify('api.fxtwitter.com'),
    BLUESKY_API_HOST_LIST: JSON.stringify('api.fxbsky.app'),
    GENERIC_API_HOST_LIST: JSON.stringify('api.fxembed.com'),
    GIF_TRANSCODE_DOMAIN_LIST: JSON.stringify('gif.fxtwitter.com'),
    VIDEO_TRANSCODE_DOMAIN_LIST: JSON.stringify('video.fxtwitter.com'),
    VIDEO_TRANSCODE_BSKY_DOMAIN_LIST: JSON.stringify('video.fxbsky.app'),
    SENTRY_DSN: null,
    TWITTER_ROOT: JSON.stringify('https://x.com'),
    ENCRYPTED_CREDENTIALS: JSON.stringify(''),
    CREDENTIALS_IV: JSON.stringify('')
  },
  test: {
    include: ['test/*.ts'],
    globals: true,
    coverage: {
      include: ['src/**/*.{ts,js}']
    }
  }
});
