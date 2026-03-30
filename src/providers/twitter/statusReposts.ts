import { Context } from 'hono';
import { convertToApiUser } from './profile';
import { RetweetersQuery, RetweetersTimelineQuery } from './graphql/queries';
import { graphQLOrchestrator } from './graphql/orchestrator';
import {
  getRetweetersTimelineInstructions,
  validateRetweetersTimelineResponse
} from './graphql/validators';
import { processRetweetersUserTimelineInstructions } from './search';
import type { APIUserListResults } from '../../realms/api/schemas';

export const statusRepostsAPI = async (
  statusId: string,
  count: number,
  cursor: string | null,
  c: Context
): Promise<APIUserListResults> => {
  const orchestration = await graphQLOrchestrator(c, [
    {
      key: 'reposts',
      required: true,
      methods: [
        {
          name: 'Retweeters',
          query: RetweetersQuery,
          weight: 500,
          validator: validateRetweetersTimelineResponse
        },
        {
          name: 'RetweetersTimeline',
          query: RetweetersTimelineQuery,
          weight: 500,
          validator: validateRetweetersTimelineResponse
        }
      ],
      variables: {
        tweetId: statusId,
        tweet_id: statusId,
        count,
        cursor: cursor ?? null
      }
    }
  ]);

  if (!orchestration.reposts?.success) {
    console.error('Status reposts request failed', orchestration.reposts?.error);
    return { code: 500, results: [], cursor: { top: null, bottom: null } };
  }

  const instructions = getRetweetersTimelineInstructions(orchestration.reposts.data);
  if (!instructions) {
    return { code: 404, results: [], cursor: { top: null, bottom: null } };
  }

  const { users, cursors } = processRetweetersUserTimelineInstructions(instructions);
  const topCursor = cursors.find(cur => cur.cursorType === 'Top')?.value ?? null;
  const bottomCursor = cursors.find(cur => cur.cursorType === 'Bottom')?.value ?? null;

  const results = users.map(user => convertToApiUser(user));

  return {
    code: 200,
    results,
    cursor: {
      top: topCursor,
      bottom: bottomCursor
    }
  };
};
