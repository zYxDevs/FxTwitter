import { Context } from 'hono';
import { buildAPITwitterStatus } from './processor';
import { SearchTimelineQuery } from './graphql/queries';
import { graphqlRequest } from './graphql/request';
import type { APITwitterStatus } from '../../realms/api/schemas';

type SearchFeed = 'latest' | 'top' | 'media';

const feedToProduct = (feed: SearchFeed): string => {
  switch (feed) {
    case 'top':
      return 'Top';
    case 'media':
      return 'Media';
    case 'latest':
    default:
      return 'Latest';
  }
};

function isGraphQLTimelineCursor(obj: unknown): obj is GraphQLTimelineCursor {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    '__typename' in obj &&
    (obj as { __typename?: string }).__typename === 'TimelineTimelineCursor'
  );
}

/** Shared by SearchTimeline, UserTweets, and other GraphQL timeline instruction streams */
export const processTimelineInstructions = (
  instructions: TimelineInstruction[]
): { statuses: GraphQLTwitterStatus[]; cursors: GraphQLTimelineCursor[] } => {
  const statuses: GraphQLTwitterStatus[] = [];
  const cursors: GraphQLTimelineCursor[] = [];

  type ItemContentWithTweet = {
    __typename?: string;
    tweet_results?: { result?: { __typename?: string; tweet?: unknown } };
  };
  const extractTweetFromItemContent = (itemContent: ItemContentWithTweet) => {
    if (itemContent?.__typename !== 'TimelineTweet') return;
    const result = itemContent.tweet_results?.result;
    const entryType = result?.__typename;
    if (entryType === 'Tweet') {
      statuses.push(result as GraphQLTwitterStatus);
    } else if (entryType === 'TweetWithVisibilityResults') {
      statuses.push((result as { tweet: GraphQLTwitterStatus }).tweet);
    }
  };

  instructions?.forEach(instruction => {
    // Paginated responses replace existing cursor entries rather than adding new ones
    if (instruction.type === 'TimelineReplaceEntry') {
      const content = instruction.entry?.content;
      if (content?.__typename === 'TimelineTimelineCursor') {
        cursors.push(content);
      }
      return;
    }

    // Media feed pagination uses TimelineAddToModule (search-grid) instead of TimelineAddEntries
    if (instruction.type === 'TimelineAddToModule') {
      instruction.moduleItems?.forEach(_moduleItem => {
        const moduleItem = _moduleItem as { item?: { itemContent?: unknown } };
        const itemContent = moduleItem?.item?.itemContent;
        if (itemContent) {
          extractTweetFromItemContent(itemContent as ItemContentWithTweet);
        }
      });
      return;
    }

    if (instruction.type === 'TimelineAddEntries') {
      instruction.entries?.forEach(_entry => {
        const entry = _entry as GraphQLTimelineTweetEntry | GraphQLConversationThread;
        const content = (entry as GraphQLTimelineTweetEntry)?.content;

        if (typeof content === 'undefined') return;

        if (content.__typename === 'TimelineTimelineItem') {
          extractTweetFromItemContent(content.itemContent as ItemContentWithTweet);
          const itemContentType = content.itemContent?.__typename;
          if (itemContentType === 'TimelineTimelineCursor') {
            cursors.push(content.itemContent as GraphQLTimelineCursor);
          }
        } else if (isGraphQLTimelineCursor(content)) {
          // In search timeline, cursors appear directly as entry content rather than
          // nested inside a TimelineTimelineItem wrapper as seen in TweetDetail
          cursors.push(content);
        } else if (
          (content as unknown as GraphQLTimelineModule).__typename === 'TimelineTimelineModule'
        ) {
          (content as unknown as GraphQLTimelineModule).items?.forEach(item => {
            const itemContentType = item.item.itemContent.__typename;
            if (itemContentType === 'TimelineTweet') {
              extractTweetFromItemContent(item.item.itemContent as ItemContentWithTweet);
            } else if (itemContentType === 'TimelineTimelineCursor') {
              cursors.push(item.item.itemContent as GraphQLTimelineCursor);
            }
          });
        }
      });
    }
  });

  return { statuses, cursors };
};

export const searchAPI = async (
  query: string,
  feed: SearchFeed,
  count: number,
  cursor: string | null,
  c: Context
): Promise<APISearchResults> => {
  const product = feedToProduct(feed);

  let response: TwitterSearchTimelineResponse | null;

  try {
    response = (await graphqlRequest(c, {
      query: SearchTimelineQuery,
      variables: {
        rawQuery: query,
        count,
        product,
        cursor: cursor ?? null
      },
      validator: (_response: unknown) => {
        const r = _response as TwitterSearchTimelineResponse;
        return Array.isArray(r?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions);
      }
    })) as TwitterSearchTimelineResponse;
  } catch (e) {
    console.error('Search request failed', e);
    return { code: 500, results: [], cursor: { top: null, bottom: null } };
  }

  if (!response?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions) {
    return { code: 404, results: [], cursor: { top: null, bottom: null } };
  }

  const instructions = response.data.search_by_raw_query.search_timeline.timeline.instructions;
  const { statuses, cursors } = processTimelineInstructions(instructions);

  const topCursor = cursors.find(cursor => cursor.cursorType === 'Top')?.value ?? null;
  const bottomCursor = cursors.find(cursor => cursor.cursorType === 'Bottom')?.value ?? null;

  const builtStatuses = (
    await Promise.all(
      statuses.map(status => {
        try {
          const result = buildAPITwitterStatus(c, status, undefined, null, false);
          return result;
        } catch (e) {
          console.error('Error building status', e);
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
