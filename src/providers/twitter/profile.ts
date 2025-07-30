import { Context } from 'hono';
import { Constants } from '../../constants';
import { linkFixer } from '../../helpers/linkFixer';
import { APIUser, UserAPIResponse } from '../../types/types';
import { UserByScreenNameQuery } from './graphql/queries';
import { graphqlRequest } from './graphql/request';

export const convertToApiUser = (user: GraphQLUser, legacyAPI = false): APIUser => {
  const apiUser = {} as APIUser;
  apiUser.screen_name = user.core?.screen_name ?? user.legacy.screen_name;
  /* Populating a lot of the basics */
  apiUser.url = `${Constants.TWITTER_ROOT}/${apiUser.screen_name}`;
  apiUser.id = user.rest_id;
  apiUser.followers = user.legacy.followers_count;
  apiUser.following = user.legacy.friends_count;
  apiUser.likes = user.legacy.favourites_count;
  apiUser.listed_count = user.legacy.listed_count;
  apiUser.media_count = user.legacy.media_count;
  if (legacyAPI) {
    // @ts-expect-error Use tweets for legacy API
    apiUser.tweets = user.legacy.statuses_count;
  } else {
    apiUser.statuses = user.legacy.statuses_count;
  }
  apiUser.name = user.core?.name ?? user.legacy.name;
  apiUser.description = user.legacy.description
    ? linkFixer(user.legacy.entities?.description?.urls, user.legacy.description)
    : '';
  apiUser.location = user.location?.location ?? user.legacy.location ?? '';
  apiUser.banner_url = user.legacy.profile_banner_url ? user.legacy.profile_banner_url : '';
  apiUser.avatar_url = user.avatar?.image_url ?? user.legacy.profile_image_url_https ?? null;
  apiUser.joined = user.core?.created_at ?? user.legacy.created_at ?? '';
  apiUser.protected = user.privacy?.protected ?? user.legacy.protected ?? false;
  if (user.legacy_extended_profile?.birthdate) {
    const { birthdate } = user.legacy_extended_profile;
    apiUser.birthday = {};
    if (typeof birthdate.day === 'number') apiUser.birthday.day = birthdate.day;
    if (typeof birthdate.month === 'number') apiUser.birthday.month = birthdate.month;
    if (typeof birthdate.year === 'number') apiUser.birthday.year = birthdate.year;
  }
  const website = user.legacy.entities?.url?.urls?.[0];

  if (website) {
    apiUser.website = {
      url: website.expanded_url,
      display_url: website.display_url
    };
  } else {
    apiUser.website = null;
  }
  /* Fun fact: verification.verified always returns false in Twitter GraphQL even if the account is verified.
     They moved legacy.verified into verification.verified but didn't bother to reimplement it
     with Twitter Blue / X Premium verification */
  if (user.is_blue_verified) {
    apiUser.verification = {
      verified: true,
      type: 'individual'
    };
    if (user.verification?.verified_type === 'Business') {
      apiUser.verification.type = 'organization';
    } else if (user.verification?.verified_type === 'Government') {
      apiUser.verification.type = 'government';
    }
  } else {
    apiUser.verification = {
      verified: false,
      type: null
    };
  }

  return apiUser;
};

/* This function does the heavy lifting of processing data from Twitter API
   and using it to create FixTweet's streamlined API responses */
const populateUserProperties = async (
  response: GraphQLUserResponse,
  legacyAPI = false
): Promise<APIUser | null> => {
  const user = response?.data?.user?.result;
  if (user) {
    return convertToApiUser(user, legacyAPI);
  }

  return null;
};

/* API for Twitter profiles (Users)
   Used internally by FixTweet's embed service, or
   available for free using api.fxtwitter.com. */
export const userAPI = async (
  username: string,
  c: Context
  // flags?: InputFlags
): Promise<UserAPIResponse> => {
  const userResponse: GraphQLUserResponse = (await graphqlRequest(c, {
    query: UserByScreenNameQuery,
    variables: {
      screen_name: username
    },
    useElongator: typeof c.env?.TwitterProxy !== 'undefined',
    validator: (response: unknown) => {
      const userResponse = response as GraphQLUserResponse;
      return !(
        userResponse?.data?.user?.result?.__typename !== 'User' ||
        typeof userResponse?.data?.user?.result?.legacy === 'undefined'
      );
    }
  })) as GraphQLUserResponse;
  if (!userResponse || !Object.keys(userResponse).length) {
    return {
      code: 404,
      message: 'User not found'
    };
  }
  /* Creating the response objects */
  const response: UserAPIResponse = { code: 200, message: 'OK' } as UserAPIResponse;
  const apiUser: APIUser = (await populateUserProperties(userResponse, true)) as APIUser;

  /* Finally, staple the User to the response and return it */
  response.user = apiUser;

  return response;
};
