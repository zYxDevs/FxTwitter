import type { Context } from 'hono';
import type { APIUserListResults } from '../../realms/api/schemas';
import { fetchProfilesDetailedBatched, fetchRepostedBy } from './client';
import { blueskyProfileToApiUser } from './profile';
import { blueskyProfileViewToApiUser } from './profileFollowers';
import { atUriForFeedPost } from './uris';

const userListNotFound = (): APIUserListResults => ({
  code: 404,
  results: [],
  cursor: { top: null, bottom: null }
});

const userListUpstreamError = (): APIUserListResults => ({
  code: 500,
  results: [],
  cursor: { top: null, bottom: null }
});

export const blueskyStatusRepostsAPI = async (
  handle: string,
  rkey: string,
  options: { count: number; cursor: string | null },
  c: Context
): Promise<APIUserListResults> => {
  const fetchOpts = { credentialKey: c.env?.CREDENTIAL_KEY };
  const uri = atUriForFeedPost(handle, rkey);
  const result = await fetchRepostedBy(
    {
      uri,
      limit: options.count,
      cursor: options.cursor ?? undefined
    },
    fetchOpts
  );

  if (!result.ok) {
    if (result.status === 400 || result.status === 404) {
      return userListNotFound();
    }
    return userListUpstreamError();
  }

  const repostedBy = result.data.repostedBy ?? [];
  const nextCursor = result.data.cursor ?? null;

  const dids = repostedBy.map(p => p.did);
  const detailedByDid = await fetchProfilesDetailedBatched(dids, fetchOpts);

  const results = repostedBy.map(p => {
    const detailed = detailedByDid.get(p.did);
    if (detailed?.handle) {
      return blueskyProfileToApiUser(detailed);
    }
    return blueskyProfileViewToApiUser(p);
  });

  return {
    code: 200,
    results,
    cursor: { top: null, bottom: nextCursor }
  };
};
