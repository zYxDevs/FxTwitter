import type { Context } from 'hono';
import type { APIUserListResults } from '../../realms/api/schemas';
import { fetchGetLikes, fetchProfilesDetailedBatched } from './client';
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

export const blueskyStatusLikesAPI = async (
  handle: string,
  rkey: string,
  options: { count: number; cursor: string | null },
  c: Context
): Promise<APIUserListResults> => {
  const fetchOpts = { credentialKey: c.env?.CREDENTIAL_KEY };
  const uri = atUriForFeedPost(handle, rkey);
  const result = await fetchGetLikes(
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

  const likes = result.data.likes ?? [];
  const nextCursor = result.data.cursor ?? null;

  const dids = likes.map(l => l.actor.did);
  const detailedByDid = await fetchProfilesDetailedBatched(dids, fetchOpts);

  const results = likes.map(l => {
    const detailed = detailedByDid.get(l.actor.did);
    if (detailed?.handle) {
      return blueskyProfileToApiUser(detailed);
    }
    return blueskyProfileViewToApiUser(l.actor);
  });

  return {
    code: 200,
    results,
    cursor: { top: null, bottom: nextCursor }
  };
};
