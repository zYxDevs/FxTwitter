import { Context } from 'hono';
import { buildAPITwitterStatus } from './processor';
import {
  ProfileTimelineQuery,
  ProfileUserPhotoTimelineQuery,
  ProfileUserVideoTimelineQuery,
  ProfileWithRepliesTimelineQuery,
  UserMediaQuery,
  UserTweetsAndRepliesQuery,
  UserTweetsQuery
} from './graphql/queries';
import { graphQLOrchestrator } from './graphql/orchestrator';
import {
  getProfilePhotoTimelineInstructions,
  getProfileStatusesTimelineInstructions,
  validateProfileTimelineResponse,
  validateProfileUserPhotoTimelineResponse,
  validateProfileUserVideoTimelineResponse,
  validateProfileWithRepliesTimelineResponse,
  validateUserTweetsTimeline
} from './graphql/validators';
import { getTwitterUserRestIdByScreenName, type ProfileHandleOrId } from './profile';
import { processTimelineInstructions } from './search';
import type { APITwitterStatus } from '../../realms/api/schemas';

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
      validator: validateUserTweetsTimeline,
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

export const profilePhotosAPI = async (
  handleOrId: ProfileHandleOrId,
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
      key: 'photos',
      required: true,
      query: ProfileUserPhotoTimelineQuery,
      validator: validateProfileUserPhotoTimelineResponse,
      variables: {
        userId,
        rest_id: userId,
        cursor: cursor ?? null
      }
    }
  ]);

  if (!results.photos?.success) {
    console.error('Profile photo timeline request failed', results.photos?.error);
    return { code: 500, results: [], cursor: { top: null, bottom: null } };
  }

  const instructions = getProfilePhotoTimelineInstructions(results.photos.data);
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

export const profileUserVideosAPI = async (
  handleOrId: ProfileHandleOrId,
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
      key: 'videos',
      required: true,
      query: ProfileUserVideoTimelineQuery,
      validator: validateProfileUserVideoTimelineResponse,
      variables: {
        userId,
        rest_id: userId,
        cursor: cursor ?? null
      }
    }
  ]);

  if (!results.videos?.success) {
    console.error('Profile user video timeline request failed', results.videos?.error);
    return { code: 500, results: [], cursor: { top: null, bottom: null } };
  }

  const instructions = getProfileStatusesTimelineInstructions(results.videos.data);
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
