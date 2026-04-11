import { Constants } from '../../constants';

const DEFAULT_TIMEOUT_MS = 12_000;

/** Basic hostname guard against SSRF / junk input */
export const assertSafeMastodonDomain = (domain: string): string => {
  const d = domain.trim().toLowerCase();
  if (!d || d.length > 253) {
    throw new Error('invalid_domain');
  }
  if (d.includes('/') || d.includes('\\') || d.includes('..')) {
    throw new Error('invalid_domain');
  }
  if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/i.test(d) && !/^[a-z0-9]+$/i.test(d)) {
    throw new Error('invalid_domain');
  }
  return d;
};

const instanceBase = (domain: string): string => `https://${assertSafeMastodonDomain(domain)}`;

export type MastodonFetchOk<T> = { ok: true; data: T; link: string | null };
export type MastodonFetchErr = { ok: false; status: number; body: string };
export type MastodonFetchResult<T> = MastodonFetchOk<T> | MastodonFetchErr;

async function mastodonFetch<T>(
  domain: string,
  path: string,
  searchParams: Record<string, string | number | boolean | undefined>
): Promise<MastodonFetchResult<T>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v === undefined) continue;
    qs.set(k, String(v));
  }
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    const url = `${instanceBase(domain)}${path}${qs.size ? `?${qs.toString()}` : ''}`;
    res = await fetch(url, {
      signal: ac.signal,
      redirect: 'error',
      headers: {
        'Accept': 'application/json',
        'User-Agent': Constants.FRIENDLY_USER_AGENT
      }
    });
  } catch (e) {
    clearTimeout(t);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 504, body: msg };
  }
  clearTimeout(t);

  const link = res.headers.get('Link');
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, status: res.status, body };
  }
  try {
    const data = (await res.json()) as T;
    return { ok: true, data, link };
  } catch {
    return { ok: false, status: 502, body: 'invalid JSON from Mastodon' };
  }
}

/** Extract `max_id` from the `rel="next"` URL in a Mastodon `Link` header */
export const nextMaxIdFromLinkHeader = (linkHeader: string | null): string | null => {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const m = part.match(/<([^>]+)>;\s*rel="next"/);
    if (!m?.[1]) continue;
    try {
      const u = new URL(m[1]);
      const maxId = u.searchParams.get('max_id');
      if (maxId) return maxId;
    } catch {
      /* ignore */
    }
  }
  return null;
};

export const fetchStatus = async (
  domain: string,
  id: string
): Promise<MastodonFetchResult<MastodonStatus>> =>
  mastodonFetch<MastodonStatus>(domain, `/api/v1/statuses/${encodeURIComponent(id)}`, {});

export const fetchStatusContext = async (
  domain: string,
  id: string
): Promise<MastodonFetchResult<MastodonContext>> =>
  mastodonFetch<MastodonContext>(domain, `/api/v1/statuses/${encodeURIComponent(id)}/context`, {});

export const fetchFavouritedBy = async (
  domain: string,
  id: string,
  params: { limit: number; max_id?: string }
): Promise<MastodonFetchResult<MastodonAccount[]>> =>
  mastodonFetch<MastodonAccount[]>(
    domain,
    `/api/v1/statuses/${encodeURIComponent(id)}/favourited_by`,
    { limit: params.limit, max_id: params.max_id }
  );

export const fetchRebloggedBy = async (
  domain: string,
  id: string,
  params: { limit: number; max_id?: string }
): Promise<MastodonFetchResult<MastodonAccount[]>> =>
  mastodonFetch<MastodonAccount[]>(
    domain,
    `/api/v1/statuses/${encodeURIComponent(id)}/reblogged_by`,
    { limit: params.limit, max_id: params.max_id }
  );

export const lookupAccount = async (
  domain: string,
  acct: string
): Promise<MastodonFetchResult<MastodonAccount>> =>
  mastodonFetch<MastodonAccount>(domain, '/api/v1/accounts/lookup', { acct });

export const fetchAccount = async (
  domain: string,
  accountId: string
): Promise<MastodonFetchResult<MastodonAccount>> =>
  mastodonFetch<MastodonAccount>(domain, `/api/v1/accounts/${encodeURIComponent(accountId)}`, {});

export const fetchAccountStatuses = async (
  domain: string,
  accountId: string,
  params: {
    limit: number;
    max_id?: string;
    only_media?: boolean;
    exclude_replies?: boolean;
  }
): Promise<MastodonFetchResult<MastodonStatus[]>> =>
  mastodonFetch<MastodonStatus[]>(
    domain,
    `/api/v1/accounts/${encodeURIComponent(accountId)}/statuses`,
    {
      limit: params.limit,
      max_id: params.max_id,
      only_media: params.only_media === true ? true : undefined,
      exclude_replies: params.exclude_replies === true ? true : undefined
    }
  );

export const fetchAccountFollowers = async (
  domain: string,
  accountId: string,
  params: { limit: number; max_id?: string }
): Promise<MastodonFetchResult<MastodonAccount[]>> =>
  mastodonFetch<MastodonAccount[]>(
    domain,
    `/api/v1/accounts/${encodeURIComponent(accountId)}/followers`,
    { limit: params.limit, max_id: params.max_id }
  );

export const fetchAccountFollowing = async (
  domain: string,
  accountId: string,
  params: { limit: number; max_id?: string }
): Promise<MastodonFetchResult<MastodonAccount[]>> =>
  mastodonFetch<MastodonAccount[]>(
    domain,
    `/api/v1/accounts/${encodeURIComponent(accountId)}/following`,
    { limit: params.limit, max_id: params.max_id }
  );

export const searchStatuses = async (
  domain: string,
  q: string,
  params: { limit: number; offset?: number; max_id?: string; min_id?: string }
): Promise<MastodonFetchResult<MastodonSearchResponse>> =>
  mastodonFetch<MastodonSearchResponse>(domain, '/api/v2/search', {
    q,
    type: 'statuses',
    resolve: false,
    limit: params.limit,
    offset: params.offset,
    max_id: params.max_id,
    min_id: params.min_id
  });
