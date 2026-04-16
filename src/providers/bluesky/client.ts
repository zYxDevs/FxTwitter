import { Constants } from '../../constants';
import {
  getShuffledBlueskyAccounts,
  hasBlueskyProxyAccounts,
  hasBundledEncryptedCredentials,
  initCredentials
} from '../twitter/proxy/credentials';
import { getBlueskyAccessJwt, invalidateBlueskySession } from './session';

/** Per-upstream request cap during partial outages (public first, then proxy PDS). */
export const BLUESKY_UPSTREAM_TIMEOUT_MS = 4_000;

export type BlueskyFetchOpts = {
  credentialKey?: string;
};

export type XrpcErrorBody = {
  error?: string;
  message?: string;
};

type BlueskyXrpcParams = Record<string, string | number | undefined | string[]>;

function trimBaseUrl(base: string): string {
  return base.replace(/\/$/, '');
}

function paramsToSearchString(params: BlueskyXrpcParams): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      for (const item of v) qs.append(k, String(item));
    } else {
      qs.set(k, String(v));
    }
  }
  return qs.toString();
}

function buildXrpcUrl(baseUrl: string, path: string, params: BlueskyXrpcParams): string {
  const qs = paramsToSearchString(params);
  return `${trimBaseUrl(baseUrl)}/xrpc/${path}?${qs}`;
}

type XrpcAttemptFail = {
  ok: false;
  status: number;
  body: string;
  aborted?: boolean;
};

type XrpcAttemptOk<T> = { ok: true; data: T };

async function fetchXrpcOnce<T>(
  baseUrl: string,
  path: string,
  params: BlueskyXrpcParams,
  options: { authorization?: string; timeoutMs: number }
): Promise<XrpcAttemptOk<T> | XrpcAttemptFail> {
  const url = buildXrpcUrl(baseUrl, path, params);
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), options.timeoutMs);
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.authorization) headers['Authorization'] = options.authorization;
    const res = await fetch(url, { signal: ac.signal, headers });
    const body = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, body };
    }
    try {
      return { ok: true, data: JSON.parse(body) as T };
    } catch {
      return { ok: false, status: 502, body: 'invalid JSON from Bluesky' };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const aborted = e instanceof Error && e.name === 'AbortError';
    return { ok: false, status: 504, body: msg, aborted };
  } finally {
    clearTimeout(t);
  }
}

function isNotFoundError(status: number, body: string): boolean {
  if (status === 404) return true;
  try {
    const j = JSON.parse(body) as { error?: string };
    const err = j.error ?? '';
    if (err === 'NotFound' || err === 'RecordNotFound') return true;
  } catch {
    /* ignore */
  }
  return false;
}

function isFallbackEligible(status: number, body: string, aborted?: boolean): boolean {
  if (isNotFoundError(status, body)) return false;
  if (aborted) return true;
  if (status === 429 || status === 502 || status === 503 || status === 504) return true;
  if (status === 401) return true;
  return false;
}

async function executeBlueskyXrpc<T>(
  path: string,
  params: BlueskyXrpcParams,
  credentialKey: string | undefined
): Promise<{ ok: true; data: T } | { ok: false; status: number; body: string }> {
  const publicBase = Constants.BLUESKY_API_ROOT;
  const timeoutMs = BLUESKY_UPSTREAM_TIMEOUT_MS;

  const first = await fetchXrpcOnce<T>(publicBase, path, params, { timeoutMs });
  if (first.ok) {
    return { ok: true, data: first.data };
  }
  if (isNotFoundError(first.status, first.body)) {
    return { ok: false, status: first.status, body: first.body };
  }
  if (
    !isFallbackEligible(first.status, first.body, first.aborted) ||
    !credentialKey?.trim() ||
    !hasBundledEncryptedCredentials()
  ) {
    return { ok: false, status: first.status, body: first.body };
  }

  try {
    await initCredentials(credentialKey);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(
      'Bluesky proxy credentials init failed',
      msg,
      `(credentialKey length: ${credentialKey.trim().length})`
    );
  }
  if (!hasBlueskyProxyAccounts()) {
    return { ok: false, status: first.status, body: first.body };
  }

  for (const cred of getShuffledBlueskyAccounts()) {
    const accessJwt = await getBlueskyAccessJwt(cred);
    if (!accessJwt) continue;

    const attempt = await fetchXrpcOnce<T>(cred.service, path, params, {
      authorization: `Bearer ${accessJwt}`,
      timeoutMs
    });

    if (attempt.ok) {
      return { ok: true, data: attempt.data };
    }

    if (isNotFoundError(attempt.status, attempt.body)) {
      return { ok: false, status: attempt.status, body: attempt.body };
    }

    if (attempt.status === 401) {
      invalidateBlueskySession(cred);
      continue;
    }
  }

  return { ok: false, status: first.status, body: first.body };
}

/** Parse JSON body after a successful logical XRPC (used by helpers that return empty defaults). */
async function executeBlueskyGetJson<T>(
  path: string,
  params: BlueskyXrpcParams,
  credentialKey: string | undefined
): Promise<T | null> {
  const r = await executeBlueskyXrpc<T>(path, params, credentialKey);
  if (!r.ok) return null;
  return r.data;
}

export const fetchPostThread = async (
  atUri: string,
  depth = 10,
  parentHeight?: number,
  opts?: BlueskyFetchOpts
): Promise<BlueskyThreadResponse | null> => {
  const result = await executeBlueskyXrpc<BlueskyThreadResponse>(
    'app.bsky.feed.getPostThread',
    {
      uri: atUri,
      depth,
      parentHeight
    },
    opts?.credentialKey
  );
  if (!result.ok) {
    console.log('Bluesky getPostThread failed', result.status, result.body?.slice?.(0, 200));
    return null;
  }
  return result.data;
};

/** Batch-resolve post views (quotes not hydrated in thread, etc.). */
export const fetchPostsByUris = async (
  uris: string[],
  opts?: BlueskyFetchOpts
): Promise<BlueskyPost[]> => {
  if (!uris.length) return [];
  const j = await executeBlueskyGetJson<{ posts?: BlueskyPost[] }>(
    'app.bsky.feed.getPosts',
    { uris },
    opts?.credentialKey
  );
  return j?.posts ?? [];
};

export const fetchProfilesByActors = async (
  actors: string[],
  opts?: BlueskyFetchOpts
): Promise<Map<string, { handle: string; displayName?: string; avatar?: string }>> => {
  const out = new Map<string, { handle: string; displayName?: string; avatar?: string }>();
  if (!actors.length) return out;
  const j = await executeBlueskyGetJson<{
    profiles?: {
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
    }[];
  }>('app.bsky.actor.getProfiles', { actors }, opts?.credentialKey);
  for (const p of j?.profiles ?? []) {
    out.set(p.did, { handle: p.handle, displayName: p.displayName, avatar: p.avatar });
  }
  return out;
};

export const fetchActorProfile = async (
  actor: string,
  opts?: BlueskyFetchOpts
): Promise<
  { ok: true; data: BlueskyProfileViewDetailed } | { ok: false; status: number; body: string }
> => {
  const result = await executeBlueskyXrpc<BlueskyProfileViewDetailed>(
    'app.bsky.actor.getProfile',
    { actor },
    opts?.credentialKey
  );
  if (!result.ok) {
    console.log('Bluesky getProfile failed', result.status, result.body?.slice?.(0, 200));
  }
  return result;
};

export const fetchAuthorFeed = async (
  params: {
    actor: string;
    limit: number;
    cursor?: string;
    filter: BlueskyAuthorFeedFilter;
  },
  opts?: BlueskyFetchOpts
): Promise<
  { ok: true; data: BlueskyAuthorFeedResponse } | { ok: false; status: number; body: string }
> => {
  const result = await executeBlueskyXrpc<BlueskyAuthorFeedResponse>(
    'app.bsky.feed.getAuthorFeed',
    {
      actor: params.actor,
      limit: params.limit,
      cursor: params.cursor,
      filter: params.filter
    },
    opts?.credentialKey
  );
  if (!result.ok) {
    console.log('Bluesky getAuthorFeed failed', result.status, result.body?.slice?.(0, 200));
  }
  return result;
};

export const fetchActorLikes = async (
  params: {
    actor: string;
    limit: number;
    cursor?: string;
  },
  opts?: BlueskyFetchOpts
): Promise<
  { ok: true; data: BlueskyGetActorLikesResponse } | { ok: false; status: number; body: string }
> => {
  const result = await executeBlueskyXrpc<BlueskyGetActorLikesResponse>(
    'app.bsky.feed.getActorLikes',
    {
      actor: params.actor,
      limit: params.limit,
      cursor: params.cursor
    },
    opts?.credentialKey
  );
  if (!result.ok) {
    console.log('Bluesky getActorLikes failed', result.status, result.body?.slice?.(0, 200));
  }
  return result;
};

/** `app.bsky.feed.searchPosts` against public AppView (cursor may be restricted on some hosts). */
export const fetchSearchPosts = async (
  params: {
    q: string;
    sort: 'latest' | 'top';
    limit: number;
    cursor?: string;
  },
  opts?: BlueskyFetchOpts
): Promise<
  { ok: true; data: BlueskySearchPostsResponse } | { ok: false; status: number; body: string }
> => {
  const result = await executeBlueskyXrpc<BlueskySearchPostsResponse>(
    'app.bsky.feed.searchPosts',
    {
      q: params.q,
      sort: params.sort,
      limit: params.limit,
      cursor: params.cursor
    },
    opts?.credentialKey
  );
  if (!result.ok) {
    console.log('Bluesky searchPosts failed', result.status, result.body?.slice?.(0, 200));
  }
  return result;
};

const GET_PROFILES_MAX_ACTORS = 25;

/** Batch `app.bsky.actor.getProfiles` (max 25 actors per request per lexicon). */
export const fetchProfilesDetailedBatched = async (
  actors: string[],
  opts?: BlueskyFetchOpts
): Promise<Map<string, BlueskyProfileViewDetailed>> => {
  const out = new Map<string, BlueskyProfileViewDetailed>();
  if (!actors.length) return out;
  const unique = [...new Set(actors)];

  for (let i = 0; i < unique.length; i += GET_PROFILES_MAX_ACTORS) {
    const chunk = unique.slice(i, i + GET_PROFILES_MAX_ACTORS);
    const j = await executeBlueskyGetJson<{ profiles?: BlueskyProfileViewDetailed[] }>(
      'app.bsky.actor.getProfiles',
      { actors: chunk },
      opts?.credentialKey
    );
    for (const p of j?.profiles ?? []) {
      if (p?.did) out.set(p.did, p);
    }
  }

  return out;
};

export const fetchFollowers = async (
  params: {
    actor: string;
    limit: number;
    cursor?: string;
  },
  opts?: BlueskyFetchOpts
): Promise<
  { ok: true; data: BlueskyGetFollowersResponse } | { ok: false; status: number; body: string }
> => {
  const result = await executeBlueskyXrpc<BlueskyGetFollowersResponse>(
    'app.bsky.graph.getFollowers',
    {
      actor: params.actor,
      limit: params.limit,
      cursor: params.cursor
    },
    opts?.credentialKey
  );
  if (!result.ok) {
    console.log('Bluesky getFollowers failed', result.status, result.body?.slice?.(0, 200));
  }
  return result;
};

export const fetchFollows = async (
  params: {
    actor: string;
    limit: number;
    cursor?: string;
  },
  opts?: BlueskyFetchOpts
): Promise<
  { ok: true; data: BlueskyGetFollowsResponse } | { ok: false; status: number; body: string }
> => {
  const result = await executeBlueskyXrpc<BlueskyGetFollowsResponse>(
    'app.bsky.graph.getFollows',
    {
      actor: params.actor,
      limit: params.limit,
      cursor: params.cursor
    },
    opts?.credentialKey
  );
  if (!result.ok) {
    console.log('Bluesky getFollows failed', result.status, result.body?.slice?.(0, 200));
  }
  return result;
};

export const fetchRepostedBy = async (
  params: {
    uri: string;
    limit: number;
    cursor?: string;
    cid?: string;
  },
  opts?: BlueskyFetchOpts
): Promise<
  { ok: true; data: BlueskyGetRepostedByResponse } | { ok: false; status: number; body: string }
> => {
  const result = await executeBlueskyXrpc<BlueskyGetRepostedByResponse>(
    'app.bsky.feed.getRepostedBy',
    {
      uri: params.uri,
      limit: params.limit,
      cursor: params.cursor,
      cid: params.cid
    },
    opts?.credentialKey
  );
  if (!result.ok) {
    console.log('Bluesky getRepostedBy failed', result.status, result.body?.slice?.(0, 200));
  }
  return result;
};

export const fetchGetLikes = async (
  params: {
    uri: string;
    limit: number;
    cursor?: string;
    cid?: string;
  },
  opts?: BlueskyFetchOpts
): Promise<
  { ok: true; data: BlueskyGetLikesResponse } | { ok: false; status: number; body: string }
> => {
  const result = await executeBlueskyXrpc<BlueskyGetLikesResponse>(
    'app.bsky.feed.getLikes',
    {
      uri: params.uri,
      limit: params.limit,
      cursor: params.cursor,
      cid: params.cid
    },
    opts?.credentialKey
  );
  if (!result.ok) {
    console.log('Bluesky getLikes failed', result.status, result.body?.slice?.(0, 200));
  }
  return result;
};
