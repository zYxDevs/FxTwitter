import type { Context } from 'hono';
import { Constants } from '../../constants';
import type {
  APIBlueskyStatus,
  APIRepostedBy,
  APISearchResultsBluesky
} from '../../realms/api/schemas';
import { buildAPIBlueskyPost } from './processor';
import { fetchActorLikes, fetchAuthorFeed } from './client';

const REASON_REPOST = 'app.bsky.feed.defs#reasonRepost';

function repostedByFromFeedReason(reason: unknown): APIRepostedBy | undefined {
  if (!reason || typeof reason !== 'object') return undefined;
  const r = reason as BlueskyFeedReasonRepost;
  if (r.$type !== REASON_REPOST || !r.by) return undefined;
  const b = r.by;
  const handle = b.handle || b.did;
  return {
    id: handle,
    name: (b.displayName?.trim() || handle) as string,
    screen_name: handle,
    avatar_url: b.avatar ?? null,
    url: `${Constants.BLUESKY_ROOT}/profile/${handle}`
  };
}

function normalizePostView(post: BlueskyPost): BlueskyPost {
  return {
    ...post,
    labels: post.labels ?? [],
    likeCount: post.likeCount ?? 0,
    repostCount: post.repostCount ?? 0,
    indexedAt: post.indexedAt ?? ''
  };
}

async function feedViewPostsToTimeline(
  c: Context,
  feed: BlueskyFeedViewPost[],
  language?: string
): Promise<APIBlueskyStatus[]> {
  const built = await Promise.all(
    feed.map(async item => {
      const raw = item.post;
      if (!raw?.uri || !raw.cid) return null;
      const post = normalizePostView(raw);
      try {
        const status = await buildAPIBlueskyPost(c, post, language);
        const rb = repostedByFromFeedReason(item.reason);
        return (rb ? { ...status, reposted_by: rb } : status) as APIBlueskyStatus;
      } catch (err) {
        console.error('Error building Bluesky profile timeline post', err);
        return null;
      }
    })
  );
  return built.filter((s): s is APIBlueskyStatus => s !== null);
}

async function blueskyAuthorFeedSearchPage(
  actor: string,
  options: {
    count: number;
    cursor: string | null;
    filter: BlueskyAuthorFeedFilter;
    language?: string;
  },
  c: Context
): Promise<APISearchResultsBluesky> {
  const result = await fetchAuthorFeed({
    actor,
    limit: options.count,
    cursor: options.cursor ?? undefined,
    filter: options.filter
  });

  if (!result.ok) {
    if (result.status === 400 || result.status === 404) {
      return { code: 404, results: [], cursor: { top: null, bottom: null } };
    }
    return { code: 500, results: [], cursor: { top: null, bottom: null } };
  }

  const feed = result.data.feed ?? [];
  const nextCursor = result.data.cursor ?? null;
  const results = await feedViewPostsToTimeline(c, feed, options.language);

  return {
    code: 200,
    results,
    cursor: { top: null, bottom: nextCursor }
  };
}

export const blueskyProfileStatusesAPI = async (
  actor: string,
  options: {
    count: number;
    cursor: string | null;
    withReplies: boolean;
    language?: string;
  },
  c: Context
): Promise<APISearchResultsBluesky> => {
  const filter: BlueskyAuthorFeedFilter = options.withReplies
    ? 'posts_with_replies'
    : 'posts_no_replies';

  return blueskyAuthorFeedSearchPage(
    actor,
    { count: options.count, cursor: options.cursor, filter, language: options.language },
    c
  );
};

export const blueskyProfileMediaAPI = async (
  actor: string,
  options: { count: number; cursor: string | null; language?: string },
  c: Context
): Promise<APISearchResultsBluesky> =>
  blueskyAuthorFeedSearchPage(
    actor,
    {
      count: options.count,
      cursor: options.cursor,
      filter: 'posts_with_media',
      language: options.language
    },
    c
  );

export const blueskyProfileLikesAPI = async (
  actor: string,
  options: { count: number; cursor: string | null; language?: string },
  c: Context
): Promise<APISearchResultsBluesky> => {
  const result = await fetchActorLikes({
    actor,
    limit: options.count,
    cursor: options.cursor ?? undefined
  });

  if (!result.ok) {
    if (result.status === 400 || result.status === 404) {
      return { code: 404, results: [], cursor: { top: null, bottom: null } };
    }
    if (result.status === 401) {
      return { code: 401, results: [], cursor: { top: null, bottom: null } };
    }
    return { code: 500, results: [], cursor: { top: null, bottom: null } };
  }

  const feed = result.data.feed ?? [];
  const nextCursor = result.data.cursor ?? null;
  const results = await feedViewPostsToTimeline(c, feed, options.language);

  return {
    code: 200,
    results,
    cursor: { top: null, bottom: nextCursor }
  };
};
