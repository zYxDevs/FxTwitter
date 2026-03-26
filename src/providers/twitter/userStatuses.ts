import { Context } from 'hono';
import { buildAPITwitterStatus } from './processor';
import { UserTweetsQuery } from './graphql/queries';
import { graphqlRequest } from './graphql/request';
import { getTwitterUserRestIdByScreenName } from './profile';
import { processTimelineInstructions } from './search';
import type { APITwitterStatus } from '../../realms/api/schemas';

export const profileStatusesAPI = async (
  screenName: string,
  count: number,
  cursor: string | null,
  c: Context
): Promise<APISearchResults> => {
  const userId = await getTwitterUserRestIdByScreenName(c, screenName);
  if (!userId) {
    return { code: 404, results: [], cursor: { top: null, bottom: null } };
  }

  let response: TwitterUserTweetsResponse | null;

  try {
    response = (await graphqlRequest(c, {
      query: UserTweetsQuery,
      variables: {
        userId,
        count,
        cursor: cursor ?? null
      },
      validator: (_response: unknown) => {
        const r = _response as TwitterUserTweetsResponse;
        return Array.isArray(r?.data?.user?.result?.timeline?.timeline?.instructions);
      }
    })) as TwitterUserTweetsResponse;
  } catch (e) {
    console.error('UserTweets request failed', e);
    return { code: 500, results: [], cursor: { top: null, bottom: null } };
  }

  const instructions = response?.data?.user?.result?.timeline?.timeline?.instructions;
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
