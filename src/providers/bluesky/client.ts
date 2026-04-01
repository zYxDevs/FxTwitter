import { Constants } from '../../constants';

const DEFAULT_TIMEOUT_MS = 12_000;

export type XrpcErrorBody = {
  error?: string;
  message?: string;
};

async function fetchXrpc<T>(
  path: string,
  searchParams: Record<string, string | number | undefined>
): Promise<{ ok: true; data: T } | { ok: false; status: number; body: string }> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v === undefined) continue;
    qs.set(k, String(v));
  }
  const url = `${Constants.BLUESKY_API_ROOT}/xrpc/${path}?${qs.toString()}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      signal: ac.signal,
      headers: { Accept: 'application/json' }
    });
  } catch (e) {
    clearTimeout(t);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 504, body: msg };
  }
  clearTimeout(t);

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, status: res.status, body };
  }
  try {
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, status: 502, body: 'invalid JSON from Bluesky' };
  }
}

export const fetchPostThread = async (
  atUri: string,
  depth = 10,
  parentHeight?: number
): Promise<BlueskyThreadResponse | null> => {
  const result = await fetchXrpc<BlueskyThreadResponse>('app.bsky.feed.getPostThread', {
    uri: atUri,
    depth,
    parentHeight
  });
  if (!result.ok) {
    console.log('Bluesky getPostThread failed', result.status, result.body?.slice?.(0, 200));
    return null;
  }
  return result.data;
};

/** Batch-resolve post views (quotes not hydrated in thread, etc.). */
export const fetchPostsByUris = async (uris: string[]): Promise<BlueskyPost[]> => {
  if (!uris.length) return [];
  const qs = new URLSearchParams();
  for (const u of uris) qs.append('uris', u);
  const url = `${Constants.BLUESKY_API_ROOT}/xrpc/app.bsky.feed.getPosts?${qs.toString()}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { signal: ac.signal, headers: { Accept: 'application/json' } });
  } catch {
    clearTimeout(t);
    return [];
  }
  clearTimeout(t);
  if (!res.ok) return [];
  try {
    const j = (await res.json()) as { posts?: BlueskyPost[] };
    return j.posts ?? [];
  } catch {
    return [];
  }
};

export const fetchProfilesByActors = async (
  actors: string[]
): Promise<Map<string, { handle: string; displayName?: string; avatar?: string }>> => {
  const out = new Map<string, { handle: string; displayName?: string; avatar?: string }>();
  if (!actors.length) return out;
  const qs = new URLSearchParams();
  for (const a of actors) qs.append('actors', a);
  const url = `${Constants.BLUESKY_API_ROOT}/xrpc/app.bsky.actor.getProfiles?${qs.toString()}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { signal: ac.signal, headers: { Accept: 'application/json' } });
  } catch {
    clearTimeout(t);
    return out;
  }
  clearTimeout(t);
  if (!res.ok) return out;
  try {
    const j = (await res.json()) as {
      profiles?: {
        did: string;
        handle: string;
        displayName?: string;
        avatar?: string;
      }[];
    };
    for (const p of j.profiles ?? []) {
      out.set(p.did, { handle: p.handle, displayName: p.displayName, avatar: p.avatar });
    }
  } catch {
    /* ignore */
  }
  return out;
};

export const fetchActorProfile = async (
  actor: string
): Promise<
  { ok: true; data: BlueskyProfileViewDetailed } | { ok: false; status: number; body: string }
> => {
  const result = await fetchXrpc<BlueskyProfileViewDetailed>('app.bsky.actor.getProfile', {
    actor
  });
  if (!result.ok) {
    console.log('Bluesky getProfile failed', result.status, result.body?.slice?.(0, 200));
  }
  return result;
};

export const fetchAuthorFeed = async (params: {
  actor: string;
  limit: number;
  cursor?: string;
  filter: BlueskyAuthorFeedFilter;
}): Promise<
  { ok: true; data: BlueskyAuthorFeedResponse } | { ok: false; status: number; body: string }
> => {
  const result = await fetchXrpc<BlueskyAuthorFeedResponse>('app.bsky.feed.getAuthorFeed', {
    actor: params.actor,
    limit: params.limit,
    cursor: params.cursor,
    filter: params.filter
  });
  if (!result.ok) {
    console.log('Bluesky getAuthorFeed failed', result.status, result.body?.slice?.(0, 200));
  }
  return result;
};

export const fetchActorLikes = async (params: {
  actor: string;
  limit: number;
  cursor?: string;
}): Promise<
  { ok: true; data: BlueskyGetActorLikesResponse } | { ok: false; status: number; body: string }
> => {
  const result = await fetchXrpc<BlueskyGetActorLikesResponse>('app.bsky.feed.getActorLikes', {
    actor: params.actor,
    limit: params.limit,
    cursor: params.cursor
  });
  if (!result.ok) {
    console.log('Bluesky getActorLikes failed', result.status, result.body?.slice?.(0, 200));
  }
  return result;
};

/** `app.bsky.feed.searchPosts` against public AppView (cursor may be restricted on some hosts). */
export const fetchSearchPosts = async (params: {
  q: string;
  sort: 'latest' | 'top';
  limit: number;
  cursor?: string;
}): Promise<
  { ok: true; data: BlueskySearchPostsResponse } | { ok: false; status: number; body: string }
> => {
  const result = await fetchXrpc<BlueskySearchPostsResponse>('app.bsky.feed.searchPosts', {
    q: params.q,
    sort: params.sort,
    limit: params.limit,
    cursor: params.cursor
  });
  if (!result.ok) {
    console.log('Bluesky searchPosts failed', result.status, result.body?.slice?.(0, 200));
  }
  return result;
};

const GET_PROFILES_MAX_ACTORS = 25;

/** Batch `app.bsky.actor.getProfiles` (max 25 actors per request per lexicon). */
export const fetchProfilesDetailedBatched = async (
  actors: string[]
): Promise<Map<string, BlueskyProfileViewDetailed>> => {
  const out = new Map<string, BlueskyProfileViewDetailed>();
  if (!actors.length) return out;
  const unique = [...new Set(actors)];

  for (let i = 0; i < unique.length; i += GET_PROFILES_MAX_ACTORS) {
    const chunk = unique.slice(i, i + GET_PROFILES_MAX_ACTORS);
    const qs = new URLSearchParams();
    for (const a of chunk) qs.append('actors', a);
    const url = `${Constants.BLUESKY_API_ROOT}/xrpc/app.bsky.actor.getProfiles?${qs.toString()}`;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), DEFAULT_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, { signal: ac.signal, headers: { Accept: 'application/json' } });
    } catch {
      clearTimeout(t);
      continue;
    }
    clearTimeout(t);
    if (!res.ok) continue;
    try {
      const j = (await res.json()) as { profiles?: BlueskyProfileViewDetailed[] };
      for (const p of j.profiles ?? []) {
        if (p?.did) out.set(p.did, p);
      }
    } catch {
      /* ignore */
    }
  }

  return out;
};

export const fetchFollowers = async (params: {
  actor: string;
  limit: number;
  cursor?: string;
}): Promise<
  { ok: true; data: BlueskyGetFollowersResponse } | { ok: false; status: number; body: string }
> => {
  const result = await fetchXrpc<BlueskyGetFollowersResponse>('app.bsky.graph.getFollowers', {
    actor: params.actor,
    limit: params.limit,
    cursor: params.cursor
  });
  if (!result.ok) {
    console.log('Bluesky getFollowers failed', result.status, result.body?.slice?.(0, 200));
  }
  return result;
};

export const fetchFollows = async (params: {
  actor: string;
  limit: number;
  cursor?: string;
}): Promise<
  { ok: true; data: BlueskyGetFollowsResponse } | { ok: false; status: number; body: string }
> => {
  const result = await fetchXrpc<BlueskyGetFollowsResponse>('app.bsky.graph.getFollows', {
    actor: params.actor,
    limit: params.limit,
    cursor: params.cursor
  });
  if (!result.ok) {
    console.log('Bluesky getFollows failed', result.status, result.body?.slice?.(0, 200));
  }
  return result;
};

export const fetchRepostedBy = async (params: {
  uri: string;
  limit: number;
  cursor?: string;
  cid?: string;
}): Promise<
  { ok: true; data: BlueskyGetRepostedByResponse } | { ok: false; status: number; body: string }
> => {
  const result = await fetchXrpc<BlueskyGetRepostedByResponse>('app.bsky.feed.getRepostedBy', {
    uri: params.uri,
    limit: params.limit,
    cursor: params.cursor,
    cid: params.cid
  });
  if (!result.ok) {
    console.log('Bluesky getRepostedBy failed', result.status, result.body?.slice?.(0, 200));
  }
  return result;
};

export const fetchGetLikes = async (params: {
  uri: string;
  limit: number;
  cursor?: string;
  cid?: string;
}): Promise<
  { ok: true; data: BlueskyGetLikesResponse } | { ok: false; status: number; body: string }
> => {
  const result = await fetchXrpc<BlueskyGetLikesResponse>('app.bsky.feed.getLikes', {
    uri: params.uri,
    limit: params.limit,
    cursor: params.cursor,
    cid: params.cid
  });
  if (!result.ok) {
    console.log('Bluesky getLikes failed', result.status, result.body?.slice?.(0, 200));
  }
  return result;
};
