import { Context } from 'hono';
import { ContentfulStatusCode } from 'hono/utils/http-status';
import {
  profileMediaAPIPaginated,
  profileStatusesAPIPaginated
} from '../../../providers/twitter/userStatuses';
import { parseHandleOrId } from '../../../providers/twitter/profile';
import { isParamTruthy } from '../../../helpers/utils';
import {
  statusesToFeedItems,
  toAtomFeedXml,
  toRss20Xml,
  type SyndicationFeedMeta
} from '../../../helpers/syndicationFeeds';
import { getBranding } from '../../../helpers/branding';
import { Constants } from '../../../constants';

const DEFAULT_FEED_COUNT = 100;
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

function buildMeta(
  c: Context,
  handle: string,
  pathKind: 'twitter' | 'api',
  kind: SyndicationFeedKind
): SyndicationFeedMeta {
  const origin = new URL(c.req.url).origin;
  const branding = getBranding(c);
  const enc = encodeURIComponent(handle);
  const publicHost = Constants.STANDARD_DOMAIN_LIST[0];
  const profileWebUrl = pathKind === 'api' ? `https://${publicHost}/${enc}` : `${origin}/${enc}`;

  if (kind === 'media') {
    const selfUrlRss =
      pathKind === 'api' ? `${origin}/2/profile/${enc}/media.xml` : `${origin}/${enc}/media.xml`;
    const selfUrlAtom =
      pathKind === 'api'
        ? `${origin}/2/profile/${enc}/media.atom.xml`
        : `${origin}/${enc}/media.atom.xml`;
    return {
      channelTitle: `@${handle} (media) — ${branding.name}`,
      channelDescription: `Media from @${handle}.`,
      profileWebUrl,
      selfUrlRss,
      selfUrlAtom
    };
  }

  const selfUrlRss =
    pathKind === 'api' ? `${origin}/2/profile/${enc}/feed.xml` : `${origin}/${enc}/feed.xml`;
  const selfUrlAtom =
    pathKind === 'api'
      ? `${origin}/2/profile/${enc}/feed.atom.xml`
      : `${origin}/${enc}/feed.atom.xml`;

  return {
    channelTitle: `@${handle} — ${branding.name}`,
    channelDescription: `Posts by @${handle}`,
    profileWebUrl,
    selfUrlRss,
    selfUrlAtom
  };
}

async function serveFeed(
  c: Context,
  handle: string | undefined,
  format: 'rss' | 'atom',
  pathKind: 'twitter' | 'api',
  kind: SyndicationFeedKind
): Promise<Response> {
  const parsed = parseHandleOrId(handle ?? '');

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

  const meta = buildMeta(c, handle ?? '', pathKind, kind);
  const items = statusesToFeedItems(apiResult.results, { omitSensitive });

  c.header('Cache-Control', FEED_CACHE_CONTROL);
  c.header('Access-Control-Allow-Origin', '*');

  const contentType =
    format === 'rss' ? 'application/rss+xml; charset=utf-8' : 'application/atom+xml; charset=utf-8';
  c.header('Content-Type', contentType);

  const notFoundDesc =
    kind === 'media'
      ? 'User not found or media timeline unavailable.'
      : 'User not found or timeline unavailable.';
  const errorDesc =
    kind === 'media'
      ? 'Media timeline temporarily unavailable.'
      : 'Timeline temporarily unavailable.';

  if (apiResult.code === 404) {
    const empty = statusesToFeedItems([], {});
    const branding = getBranding(c);
    const xml =
      format === 'rss'
        ? toRss20Xml(
            {
              ...meta,
              channelTitle: `@${handle} (not found) — ${branding.name}`,
              channelDescription: notFoundDesc
            },
            empty
          )
        : toAtomFeedXml(
            {
              ...meta,
              channelTitle: `@${handle} (not found) — ${branding.name}`,
              channelDescription: notFoundDesc
            },
            empty
          );
    return c.body(xml, 404);
  }

  if (apiResult.code !== 200) {
    const empty = statusesToFeedItems([], {});
    const branding = getBranding(c);
    const xml =
      format === 'rss'
        ? toRss20Xml(
            {
              ...meta,
              channelTitle: `@${handle} — ${branding.name}`,
              channelDescription: errorDesc
            },
            empty
          )
        : toAtomFeedXml(
            {
              ...meta,
              channelTitle: `@${handle} — ${branding.name}`,
              channelDescription: errorDesc
            },
            empty
          );
    return c.body(xml, apiResult.code as ContentfulStatusCode);
  }

  const xml = format === 'rss' ? toRss20Xml(meta, items) : toAtomFeedXml(meta, items);
  return c.body(xml, 200);
}

export const profileFeedRssTwitter = (c: Context) =>
  serveFeed(c, c.req.param('handle'), 'rss', 'twitter', 'timeline');
export const profileFeedAtomTwitter = (c: Context) =>
  serveFeed(c, c.req.param('handle'), 'atom', 'twitter', 'timeline');
export const profileFeedRssApi = (c: Context) =>
  serveFeed(c, c.req.param('handle'), 'rss', 'api', 'timeline');
export const profileFeedAtomApi = (c: Context) =>
  serveFeed(c, c.req.param('handle'), 'atom', 'api', 'timeline');

export const profileMediaFeedRssTwitter = (c: Context) =>
  serveFeed(c, c.req.param('handle'), 'rss', 'twitter', 'media');
export const profileMediaFeedAtomTwitter = (c: Context) =>
  serveFeed(c, c.req.param('handle'), 'atom', 'twitter', 'media');
export const profileMediaFeedRssApi = (c: Context) =>
  serveFeed(c, c.req.param('handle'), 'rss', 'api', 'media');
export const profileMediaFeedAtomApi = (c: Context) =>
  serveFeed(c, c.req.param('handle'), 'atom', 'api', 'media');
