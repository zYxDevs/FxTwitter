import { Context } from 'hono';
import { buildAPITwitterStatus } from './processor';
import {
  FollowersByUserIDTimelineQuery,
  FollowersQuery,
  FollowingByUserIDTimelineQuery,
  FollowingQuery,
  ProfileTimelineQuery,
  ProfileWithRepliesTimelineQuery,
  UserMediaQuery,
  UserTweetsAndRepliesQuery,
  UserTweetsQuery
} from './graphql/queries';
import { graphQLOrchestrator } from './graphql/orchestrator';
import {
  getFollowersFollowingInstructions,
  getProfileStatusesTimelineInstructions,
  validateFollowersByUserIDTimelineResponse,
  validateFollowingByUserIDTimelineResponse,
  validateProfileTimelineResponse,
  validateProfileWithRepliesTimelineResponse,
  validateUserMediaTimelineResponse,
  validateUserTweetsTimeline
} from './graphql/validators';
import {
  convertToApiUser,
  getTwitterUserRestIdByScreenName,
  type ProfileHandleOrId
} from './profile';
import { processTimelineInstructions, processUserRelationshipTimelineInstructions } from './search';
import type {
  APIProfileRelationshipList,
  APISearchResults,
  APITwitterStatus
} from '../../realms/api/schemas';

export const profileStatusesAPI = async (
  handleOrId: ProfileHandleOrId,
  count: number,
  cursor: string | null,
  c: Context,
  withReplies = false
): Promise<APISearchResults> => {
  const userId =
    handleOrId.type === 'userId'
      ? handleOrId.value
      : await getTwitterUserRestIdByScreenName(c, handleOrId.value);
  if (!userId) {
    return { code: 404, results: [], cursor: { top: null, bottom: null } };
  }

  const results = await graphQLOrchestrator(c, [
    {
      key: 'tweets',
      required: true,
      methods: withReplies
        ? [
            {
              name: 'ProfileWithRepliesTimeline',
              query: ProfileWithRepliesTimelineQuery,
              weight: 10,
              validator: validateProfileWithRepliesTimelineResponse
            },
            {
              name: 'UserTweetsAndReplies',
              query: UserTweetsAndRepliesQuery,
              weight: 1,
              validator: validateUserTweetsTimeline
            }
          ]
        : [
            {
              name: 'ProfileTimeline',
              query: ProfileTimelineQuery,
              weight: 10,
              validator: validateProfileTimelineResponse
            },
            {
              name: 'UserTweets',
              query: UserTweetsQuery,
              weight: 1,
              validator: validateUserTweetsTimeline
            }
          ],
      variables: {
        userId,
        rest_id: userId,
        count,
        cursor: cursor ?? null
      }
    }
  ]);

  if (!results.tweets?.success) {
    console.error('Profile statuses timeline request failed', results.tweets?.error);
    return { code: 500, results: [], cursor: { top: null, bottom: null } };
  }

  const instructions = getProfileStatusesTimelineInstructions(results.tweets.data);
  if (!instructions) {
    return { code: 404, results: [], cursor: { top: null, bottom: null } };
  }

  const { statuses, cursors } = processTimelineInstructions(instructions);
  const topCursor = cursors.find(cur => cur.cursorType === 'Top')?.value ?? null;
  const bottomCursor = cursors.find(cur => cur.cursorType === 'Bottom')?.value ?? null;

  const builtStatuses = (
    await Promise.all(
      statuses.map(status => {
        try {
          return buildAPITwitterStatus(c, status, undefined, null, false);
        } catch (err) {
          console.error('Error building status', err);
          return Promise.resolve(null);
        }
      })
    )
  ).filter((s): s is APITwitterStatus => s !== null && !(s as FetchResults)?.status);

  return {
    code: 200,
    results: builtStatuses,
    cursor: {
      top: topCursor,
      bottom: bottomCursor
    }
  };
};

export const profileMediaAPI = async (
  handleOrId: ProfileHandleOrId,
  count: number,
  cursor: string | null,
  c: Context
): Promise<APISearchResults> => {
  const userId =
    handleOrId.type === 'userId'
      ? handleOrId.value
      : await getTwitterUserRestIdByScreenName(c, handleOrId.value);
  if (!userId) {
    return { code: 404, results: [], cursor: { top: null, bottom: null } };
  }

  const results = await graphQLOrchestrator(c, [
    {
      key: 'media',
      required: true,
      query: UserMediaQuery,
      validator: validateUserMediaTimelineResponse,
      variables: {
        userId,
        count,
        cursor: cursor ?? null
      }
    }
  ]);

  if (!results.media?.success) {
    console.error('Profile media timeline request failed', results.media?.error);
    return { code: 500, results: [], cursor: { top: null, bottom: null } };
  }

  const instructions = getProfileStatusesTimelineInstructions(results.media.data);
  if (!instructions) {
    return { code: 404, results: [], cursor: { top: null, bottom: null } };
  }

  const { statuses, cursors } = processTimelineInstructions(instructions);
  const topCursor = cursors.find(cur => cur.cursorType === 'Top')?.value ?? null;
  const bottomCursor = cursors.find(cur => cur.cursorType === 'Bottom')?.value ?? null;

  const builtStatuses = (
    await Promise.all(
      statuses.map(status => {
        try {
          return buildAPITwitterStatus(c, status, undefined, null, false);
        } catch (err) {
          console.error('Error building status', err);
          return Promise.resolve(null);
        }
      })
    )
  ).filter((s): s is APITwitterStatus => s !== null && !(s as FetchResults)?.status);

  return {
    code: 200,
    results: builtStatuses,
    cursor: {
      top: topCursor,
      bottom: bottomCursor
    }
  };
};

const emptyRelationshipList = (): APIProfileRelationshipList => ({
  code: 404,
  results: [],
  cursor: { top: null, bottom: null }
});

const profileRelationshipListAPI = async (
  handleOrId: ProfileHandleOrId,
  count: number,
  cursor: string | null,
  c: Context,
  kind: 'followers' | 'following'
): Promise<APIProfileRelationshipList> => {
  const userId =
    handleOrId.type === 'userId'
      ? handleOrId.value
      : await getTwitterUserRestIdByScreenName(c, handleOrId.value);
  if (!userId) {
    return emptyRelationshipList();
  }

  const methods =
    kind === 'followers'
      ? [
          {
            name: 'Followers',
            query: FollowersQuery,
            weight: 500,
            validator: validateUserTweetsTimeline
          },
          {
            name: 'FollowersByUserIDTimeline',
            query: FollowersByUserIDTimelineQuery,
            weight: 500,
            validator: validateFollowersByUserIDTimelineResponse
          }
        ]
      : [
          {
            name: 'Following',
            query: FollowingQuery,
            weight: 500,
            validator: validateUserTweetsTimeline
          },
          {
            name: 'FollowingByUserIDTimeline',
            query: FollowingByUserIDTimelineQuery,
            weight: 500,
            validator: validateFollowingByUserIDTimelineResponse
          }
        ];

  const results = await graphQLOrchestrator(c, [
    {
      key: 'list',
      required: true,
      methods,
      variables: {
        userId,
        rest_id: userId,
        count,
        cursor: cursor ?? null
      }
    }
  ]);

  if (!results.list?.success) {
    console.error(`Profile ${kind} request failed`, results.list?.error);
    return {
      code: 500,
      results: [],
      cursor: { top: null, bottom: null }
    };
  }

  const instructions = getFollowersFollowingInstructions(results.list.data, kind);
  if (!instructions) {
    return emptyRelationshipList();
  }

  const { users, cursors } = processUserRelationshipTimelineInstructions(instructions);
  const topCursor = cursors.find(cur => cur.cursorType === 'Top')?.value ?? null;
  const bottomCursor = cursors.find(cur => cur.cursorType === 'Bottom')?.value ?? null;

  const builtUsers = users
    .map(u => {
      try {
        return convertToApiUser(u, false);
      } catch (err) {
        console.error('Error building user for relationship list', err);
        return null;
      }
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);

  return {
    code: 200,
    results: builtUsers,
    cursor: {
      top: topCursor,
      bottom: bottomCursor
    }
  };
};

export const profileFollowersAPI = async (
  handleOrId: ProfileHandleOrId,
  count: number,
  cursor: string | null,
  c: Context
): Promise<APIProfileRelationshipList> =>
  profileRelationshipListAPI(handleOrId, count, cursor, c, 'followers');

export const profileFollowingAPI = async (
  handleOrId: ProfileHandleOrId,
  count: number,
  cursor: string | null,
  c: Context
): Promise<APIProfileRelationshipList> =>
  profileRelationshipListAPI(handleOrId, count, cursor, c, 'following');
