import type { Context } from 'hono';
import { Constants } from '../../constants';
import { linkFixerBluesky } from '../../helpers/linkFixer';
import type { APIProfileRelationshipList, APIUser } from '../../realms/api/schemas';
import { fetchFollowers, fetchFollows, fetchProfilesDetailedBatched } from './client';
import { blueskyProfileToApiUser } from './profile';

const relationshipListNotFound = (): APIProfileRelationshipList => ({
  code: 404,
  results: [],
  cursor: { top: null, bottom: null }
});

const relationshipListUpstreamError = (): APIProfileRelationshipList => ({
  code: 500,
  results: [],
  cursor: { top: null, bottom: null }
});

export const blueskyProfileViewToApiUser = (view: BlueskyProfileView): APIUser => {
  const handle = view.handle;
  const rawText = view.description ?? '';
  const description = linkFixerBluesky([], rawText);
  const joined = view.createdAt ?? view.indexedAt ?? '';

  const apiUser: APIUser = {
    id: handle,
    name: view.displayName?.trim() || handle,
    screen_name: handle,
    avatar_url: view.avatar ?? null,
    banner_url: null,
    description,
    raw_description: {
      text: rawText,
      facets: []
    },
    location: '',
    url: `${Constants.BLUESKY_ROOT}/profile/${handle}`,
    protected: false,
    followers: 0,
    following: 0,
    statuses: 0,
    media_count: 0,
    likes: 0,
    joined,
    birthday: { day: 0, month: 0, year: 0 },
    website: null,
    profile_embed: false
  };

  if (view.verification?.verifiedStatus === 'valid') {
    apiUser.verification = {
      verified: true,
      type: null,
      verified_at: null
    };
  }

  return apiUser;
};

export const blueskyProfileFollowersAPI = async (
  actor: string,
  options: { count: number; cursor: string | null },
  _c: Context
): Promise<APIProfileRelationshipList> => {
  const result = await fetchFollowers({
    actor,
    limit: options.count,
    cursor: options.cursor ?? undefined
  });

  if (!result.ok) {
    if (result.status === 400 || result.status === 404) {
      return relationshipListNotFound();
    }
    return relationshipListUpstreamError();
  }

  const followers = result.data.followers ?? [];
  const nextCursor = result.data.cursor ?? null;

  const dids = followers.map(f => f.did);
  const detailedByDid = await fetchProfilesDetailedBatched(dids);

  const results: APIUser[] = followers.map(f => {
    const detailed = detailedByDid.get(f.did);
    if (detailed?.handle) {
      return blueskyProfileToApiUser(detailed);
    }
    return blueskyProfileViewToApiUser(f);
  });

  return {
    code: 200,
    results,
    cursor: { top: null, bottom: nextCursor }
  };
};

export const blueskyProfileFollowingAPI = async (
  actor: string,
  options: { count: number; cursor: string | null },
  _c: Context
): Promise<APIProfileRelationshipList> => {
  const result = await fetchFollows({
    actor,
    limit: options.count,
    cursor: options.cursor ?? undefined
  });

  if (!result.ok) {
    if (result.status === 400 || result.status === 404) {
      return relationshipListNotFound();
    }
    return relationshipListUpstreamError();
  }

  const follows = result.data.follows ?? [];
  const nextCursor = result.data.cursor ?? null;

  const dids = follows.map(f => f.did);
  const detailedByDid = await fetchProfilesDetailedBatched(dids);

  const results: APIUser[] = follows.map(f => {
    const detailed = detailedByDid.get(f.did);
    if (detailed?.handle) {
      return blueskyProfileToApiUser(detailed);
    }
    return blueskyProfileViewToApiUser(f);
  });

  return {
    code: 200,
    results,
    cursor: { top: null, bottom: nextCursor }
  };
};
