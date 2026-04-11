import type { Context } from 'hono';
import { Constants } from '../../constants';
import { linkFixerBluesky } from '../../helpers/linkFixer';
import type { APIUser, UserAPIResponse } from '../../realms/api/schemas';
import { blueskyFacetsToApiFacets } from './facets';
import { detectBlueskyDescriptionFacets } from './detectDescriptionFacets';
import { fetchActorProfile } from './client';

export const blueskyProfileToApiUser = (profile: BlueskyProfileViewDetailed): APIUser => {
  const handle = profile.handle;
  const rawText = profile.description ?? '';
  const facets = profile.descriptionFacets?.length
    ? profile.descriptionFacets
    : detectBlueskyDescriptionFacets(rawText);
  const description = linkFixerBluesky(facets, rawText);
  const joined = profile.createdAt ?? profile.indexedAt ?? '';

  const apiUser: APIUser = {
    id: handle,
    name: profile.displayName?.trim() || handle,
    screen_name: handle,
    avatar_url: profile.avatar ?? null,
    banner_url: profile.banner ?? null,
    description,
    raw_description: {
      text: rawText,
      facets: blueskyFacetsToApiFacets(rawText, facets)
    },
    location: '',
    url: `${Constants.BLUESKY_ROOT}/profile/${handle}`,
    protected: false,
    followers: profile.followersCount ?? 0,
    following: profile.followsCount ?? 0,
    statuses: profile.postsCount ?? 0,
    media_count: 0,
    likes: 0,
    joined,
    birthday: { day: 0, month: 0, year: 0 },
    website: null
  };

  if (profile.verification?.verifiedStatus === 'valid') {
    apiUser.verification = {
      verified: true,
      type: null,
      verified_at: null
    };
  }

  return apiUser;
};

export const blueskyUserProfileAPI = async (
  actor: string,
  _c: Context
): Promise<UserAPIResponse> => {
  const result = await fetchActorProfile(actor);
  if (!result.ok) {
    if (result.status === 400 || result.status === 404) {
      return { code: 404, message: 'User not found' };
    }
    return { code: 500, message: 'Bluesky profile request failed' };
  }
  if (!result.data?.handle) {
    return { code: 404, message: 'User not found' };
  }
  return {
    code: 200,
    message: 'OK',
    user: blueskyProfileToApiUser(result.data)
  };
};
