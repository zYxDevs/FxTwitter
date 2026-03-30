import { Context } from 'hono';
import { ContentfulStatusCode } from 'hono/utils/http-status';
import {
  profileMediaAPIPaginated,
  profileStatusesAPIPaginated
} from '../../../providers/twitter/userStatuses';
import { parseHandleOrId } from '../../../providers/twitter/profile';
import { isParamTruthy } from '../../../helpers/utils';
import type { APITwitterStatus } from '../../../realms/api/schemas';
import {
  statusesToFeedItems,
  toAtomFeedXml,
  toRss20Xml,
  type SyndicationFeedMeta
} from '../../../helpers/syndicationFeeds';
import { getBranding } from '../../../helpers/branding';

const DEFAULT_FEED_COUNT = 90;
const FEED_CACHE_CONTROL = 'public, max-age=120';

type SyndicationFeedKind = 'timeline' | 'media';

function clampCount(raw: string | undefined): number {
  const n = raw === undefined ? DEFAULT_FEED_COUNT : parseInt(raw, 10);
  if (Number.isNaN(n)) return DEFAULT_FEED_COUNT;
  return Math.min(100, Math.max(1, n));
}

function parseFeedQuery(c: Context): { count: number; withReplies: boolean; safe: boolean } {
  const q = c.req.query();
  return {
    count: clampCount(q.count),
    withReplies: isParamTruthy(q.with_replies ?? q.withReplies),
    safe: isParamTruthy(q.safe)
  };
}

function parseMediaFeedQuery(c: Context): { count: number; safe: boolean } {
  const q = c.req.query();
  return {
    count: clampCount(q.count),
    safe: isParamTruthy(q.safe)
  };
}

function feedAuthorName(handle: string, results: APITwitterStatus[]): string {
  const screen = handle.replace(/^@/, '');
  const fromPost = results.find(s => s.author?.name?.trim())?.author?.name?.trim();
  return fromPost ?? `@${screen}`;
}

function buildMeta(
  c: Context,
  handle: string,
  kind: SyndicationFeedKind,
  results: APITwitterStatus[]
): SyndicationFeedMeta {
  const origin = new URL(c.req.url).origin;
  const branding = getBranding(c);
  const enc = encodeURIComponent(handle);
  const profileWebUrl = `${origin}/${enc}`;
  const authorName = feedAuthorName(handle, results);

  if (kind === 'media') {
    const selfUrlRss = `${origin}/${enc}/media.xml`;
    const selfUrlAtom = `${origin}/${enc}/media.atom.xml`;
    return {
      channelTitle: `@${handle} (media) — ${branding.name}`,
      channelDescription: `Media from @${handle}.`,
      profileWebUrl,
      selfUrlRss,
      selfUrlAtom,
      authorName
    };
  }

  const selfUrlRss = `${origin}/${enc}/feed.xml`;
  const selfUrlAtom = `${origin}/${enc}/feed.atom.xml`;

  return {
    channelTitle: `@${handle} — ${branding.name}`,
    channelDescription: `Posts by @${handle}`,
    profileWebUrl,
    selfUrlRss,
    selfUrlAtom,
    authorName
  };
}

async function serveFeed(
  c: Context,
  handle: string | undefined,
  format: 'rss' | 'atom',
  kind: SyndicationFeedKind
): Promise<Response> {
  if (!handle) {
    c.header('Cache-Control', 'no-store');
    return c.body('', 404);
  }
  const parsed = parseHandleOrId(handle);

  let apiResult;
  let omitSensitive: boolean;

  if (kind === 'timeline') {
    const q = parseFeedQuery(c);
    omitSensitive = q.safe;
    apiResult = await profileStatusesAPIPaginated(parsed, q.count, c, q.withReplies);
  } else {
    const q = parseMediaFeedQuery(c);
    omitSensitive = q.safe;
    apiResult = await profileMediaAPIPaginated(parsed, q.count, c);
  }

  const meta = buildMeta(c, handle, kind, apiResult.results);
  const items = statusesToFeedItems(apiResult.results, { omitSensitive });

  c.header('Access-Control-Allow-Origin', '*');

  if (apiResult.code === 404) {
    c.header('Cache-Control', 'no-store');
    return c.body('', 404);
  }

  if (apiResult.code !== 200) {
    c.header('Cache-Control', 'no-store');
    return c.body('', apiResult.code as ContentfulStatusCode);
  }

  const contentType =
    format === 'rss' ? 'application/rss+xml; charset=utf-8' : 'application/atom+xml; charset=utf-8';
  c.header('Content-Type', contentType);
  c.header('Cache-Control', FEED_CACHE_CONTROL);

  const xml = format === 'rss' ? toRss20Xml(meta, items) : toAtomFeedXml(meta, items);
  return c.body(xml, 200);
}

export const profileFeedRssTwitter = (c: Context) =>
  serveFeed(c, c.req.param('handle'), 'rss', 'timeline');
export const profileFeedAtomTwitter = (c: Context) =>
  serveFeed(c, c.req.param('handle'), 'atom', 'timeline');

export const profileMediaFeedRssTwitter = (c: Context) =>
  serveFeed(c, c.req.param('handle'), 'rss', 'media');
export const profileMediaFeedAtomTwitter = (c: Context) =>
  serveFeed(c, c.req.param('handle'), 'atom', 'media');
