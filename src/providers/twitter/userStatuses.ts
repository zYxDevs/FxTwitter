import { Context } from 'hono';
import { buildAPITwitterStatus } from './processor';
import { ProfileTimelineQuery, UserTweetsQuery } from './graphql/queries';
import { graphQLOrchestrator } from './graphql/orchestrator';
import {
  getProfileStatusesTimelineInstructions,
  validateProfileTimelineResponse,
  validateUserTweetsTimeline
} from './graphql/validators';
import { getTwitterUserRestIdByScreenName, type ProfileHandleOrId } from './profile';
import { processTimelineInstructions } from './search';
import type { APITwitterStatus } from '../../realms/api/schemas';

export const profileStatusesAPI = async (
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
      key: 'tweets',
      required: true,
      methods: [
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
