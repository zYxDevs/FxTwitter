import { Context } from 'hono';
import { Constants } from '../../constants';
import { linkFixer } from '../../helpers/linkFixer';
import { APIUser, UserAPIResponse } from '../../types/types';
import { UserByScreenNameQuery, UserResultByScreenNameQuery } from './graphql/queries';
import { graphqlRequest } from './graphql/request';
import { tryBalancedEndpoints, BalancedEndpoint } from '../../helpers/endpointBalancing';

export const convertToApiUser = (user: GraphQLUser, legacyAPI = false): APIUser => {
  const apiUser = {} as APIUser;
  apiUser.screen_name = user.core?.screen_name ?? user.legacy?.screen_name ?? '';
  /* Populating a lot of the basics */
  apiUser.url = `${Constants.TWITTER_ROOT}/${apiUser.screen_name}`;
  apiUser.id = user.rest_id;
  apiUser.followers = user.relationship_counts?.followers ?? user.legacy?.followers_count ?? 0;
  apiUser.following = user.relationship_counts?.following ?? user.legacy?.friends_count ?? 0;
  apiUser.likes = user.action_counts?.favorites_count ?? user.legacy?.favourites_count ?? 0;
  apiUser.media_count = user.tweet_counts?.media_tweets ?? user.legacy?.media_count ?? 0;
  if (legacyAPI) {
    // @ts-expect-error Use tweets for legacy API
    apiUser.tweets = user.tweet_counts?.tweets ?? user.legacy?.statuses_count;
  } else {
    apiUser.statuses = user.tweet_counts?.tweets ?? user.legacy?.statuses_count;
  }
  apiUser.name = user.core?.name ?? user.legacy?.name ?? '';
  const description = user.profile_bio?.description ?? user.legacy?.description;
  apiUser.description = description
    ? linkFixer(user.profile_bio?.entities?.url?.urls, description)
    : '';
  apiUser.location = user.location?.location ?? user.legacy?.location ?? '';
  apiUser.banner_url = user.banner?.image_url ?? user.legacy?.profile_banner_url ?? null;
  apiUser.avatar_url = user.avatar?.image_url ?? user.legacy?.profile_image_url_https ?? null;
  apiUser.joined = user.core?.created_at ?? user.legacy?.created_at ?? '';
  apiUser.protected = user.privacy?.protected ?? user.legacy?.protected ?? false;
  // if (user.legacy_extended_profile?.birthdate) {
  //   const { birthdate } = user.legacy_extended_profile;
  //   apiUser.birthday = {};
  //   if (typeof birthdate.day === 'number') apiUser.birthday.day = birthdate.day;
  //   if (typeof birthdate.month === 'number') apiUser.birthday.month = birthdate.month;
  //   if (typeof birthdate.year === 'number') apiUser.birthday.year = birthdate.year;
  // }
  const website =
    user.profile_bio?.entities?.url?.urls?.[0] ?? user.legacy?.entities?.url?.urls?.[0];

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
  if (user.verification?.is_blue_verified || user.is_blue_verified) {
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
   and using it to create FxTwitter's streamlined API responses */
const populateUserProperties = async (
  response: GraphQLUserResponse | UserResultByScreenNameResponse,
  legacyAPI = false
): Promise<APIUser | null> => {
  const user =
    (response as GraphQLUserResponse).data?.user?.result ??
    (response as UserResultByScreenNameResponse).data?.user_results?.result;
  if (user) {
    return convertToApiUser(user, legacyAPI);
  }

  return null;
};

const fetchByScreenName = async (c: Context, screenName: string): Promise<GraphQLUserResponse> => {
  return (await graphqlRequest(c, {
    query: UserByScreenNameQuery,
    variables: { screen_name: screenName },
    validator: (response: unknown) => {
      const userResponse = response as GraphQLUserResponse;
      const result = userResponse?.data?.user?.result;
      return Boolean(result && (result.__typename === 'User' || result.rest_id || result.core));
    }
  })) as GraphQLUserResponse;
};

const fetchResultByScreenName = async (
  c: Context,
  screenName: string
): Promise<UserResultByScreenNameResponse> => {
  return (await graphqlRequest(c, {
    query: UserResultByScreenNameQuery,
    variables: { screen_name: screenName },
    validator: (response: unknown) => {
      const userResponse = response as UserResultByScreenNameResponse;
      const result = userResponse?.data?.user_results?.result;
      return Boolean(result && result.__typename === 'User' && (result.legacy || result.rest_id));
    }
  })) as UserResultByScreenNameResponse;
};

const fetchUserBalanced = async (
  c: Context,
  screenName: string
): Promise<GraphQLUserResponse | UserResultByScreenNameResponse | null> => {
  const endpoints: BalancedEndpoint<GraphQLUserResponse | UserResultByScreenNameResponse>[] = [
    {
      name: 'UserByScreenName',
      weight: 150,
      handler: () => fetchByScreenName(c, screenName),
      resultCheck: (response: GraphQLUserResponse | UserResultByScreenNameResponse) => {
        const result = (response as GraphQLUserResponse)?.data?.user?.result;
        return Boolean(result && (result.__typename === 'User' || result.rest_id || result.core));
      }
    },
    {
      name: 'UserResultByScreenName',
      weight: 500,
      handler: () => fetchResultByScreenName(c, screenName),
      resultCheck: (response: GraphQLUserResponse | UserResultByScreenNameResponse) => {
        const result = (response as UserResultByScreenNameResponse)?.data?.user_results?.result;
        return Boolean(result && result.__typename === 'User' && (result.legacy || result.rest_id));
      }
    }
  ];

  return tryBalancedEndpoints(endpoints);
};

/* API for Twitter profiles (Users)
   Available for free using api.fxtwitter.com. */
export const userAPI = async (
  username: string,
  c: Context
  // flags?: InputFlags
): Promise<UserAPIResponse> => {
  const userResponse = await fetchUserBalanced(c, username);
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
