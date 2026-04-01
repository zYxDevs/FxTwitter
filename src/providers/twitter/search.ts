import { Context } from 'hono';
import { buildLanguageHeaders } from '../../helpers/language';
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

/** Normalize cursor_type (ProfileTimeline) and cursorType (UserTweets/Search) */
const normalizeCursor = (cursor: GraphQLTimelineCursor): GraphQLTimelineCursor => {
  if (!cursor.cursorType && cursor.cursor_type) {
    cursor.cursorType = cursor.cursor_type;
  }
  return cursor;
};

/** Shared by SearchTimeline, UserTweets, ProfileTimeline, and other GraphQL timeline instruction streams */
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

  /** ProfileTimeline nests tweet content as `content`, UserTweets/Search use `itemContent` */
  const getItemContent = (
    item: GraphQLTimelineItem
  ): GraphQLTimelineTweet | GraphQLTimelineCursor | undefined => {
    return item.itemContent ?? item.content;
  };

  instructions?.forEach(instruction => {
    // ProfileTimeline uses __typename, UserTweets/SearchTimeline use type
    const kind =
      (instruction as { type?: string }).type ??
      (instruction as { __typename?: string }).__typename;

    // Paginated responses replace existing cursor entries rather than adding new ones
    if (kind === 'TimelineReplaceEntry') {
      const content = (instruction as TimelineReplaceEntryInstruction).entry?.content;
      if (content?.__typename === 'TimelineTimelineCursor') {
        cursors.push(normalizeCursor(content));
      }
      return;
    }

    // Media feed pagination uses TimelineAddToModule (search-grid) instead of TimelineAddEntries
    if (kind === 'TimelineAddToModule') {
      (instruction as TimelineAddModulesInstruction).moduleItems?.forEach(_moduleItem => {
        const moduleItem = _moduleItem as {
          item?: { itemContent?: unknown; content?: unknown };
        };
        const itemContent = moduleItem?.item?.itemContent ?? moduleItem?.item?.content;
        if (itemContent) {
          extractTweetFromItemContent(itemContent as ItemContentWithTweet);
        }
      });
      return;
    }

    if (kind === 'TimelineAddEntries') {
      (instruction as TimelineAddEntriesInstruction).entries?.forEach(_entry => {
        const entry = _entry as GraphQLTimelineTweetEntry | GraphQLConversationThread;
        const content = (entry as GraphQLTimelineTweetEntry)?.content;

        if (typeof content === 'undefined') return;

        if (content.__typename === 'TimelineTimelineItem') {
          const inner = getItemContent(content as GraphQLTimelineItem);
          if (inner) {
            extractTweetFromItemContent(inner as ItemContentWithTweet);
            if (inner.__typename === 'TimelineTimelineCursor') {
              cursors.push(normalizeCursor(inner as GraphQLTimelineCursor));
            }
          }
        } else if (isGraphQLTimelineCursor(content)) {
          // Cursors may appear directly as entry content (SearchTimeline, ProfileTimeline)
          cursors.push(normalizeCursor(content));
        } else if (
          (content as unknown as GraphQLTimelineModule).__typename === 'TimelineTimelineModule'
        ) {
          (content as unknown as GraphQLTimelineModule).items?.forEach(item => {
            const inner = getItemContent(item.item);
            if (!inner) return;
            if (inner.__typename === 'TimelineTweet') {
              extractTweetFromItemContent(inner as ItemContentWithTweet);
            } else if (inner.__typename === 'TimelineTimelineCursor') {
              cursors.push(normalizeCursor(inner as GraphQLTimelineCursor));
            }
          });
        }
      });
    }
  });

  return { statuses, cursors };
};

type ItemContentWithUser = {
  __typename?: string;
  user_results?: { result?: { __typename?: string } };
};

const extractUserFromItemContent = (itemContent: unknown, users: GraphQLUser[]): void => {
  const ic = itemContent as ItemContentWithUser;
  if (ic?.__typename !== 'TimelineUser') return;
  const result = ic.user_results?.result;
  if (!result || typeof result !== 'object' || result.__typename !== 'User') return;
  users.push(result as GraphQLUser);
};

/** Followers/following and reposters timelines: TimelineUser rows plus pagination cursors */
const processUserRelationshipTimelineInstructionsImpl = (
  instructions: TimelineInstruction[]
): { users: GraphQLUser[]; cursors: GraphQLTimelineCursor[] } => {
  const users: GraphQLUser[] = [];
  const cursors: GraphQLTimelineCursor[] = [];

  const getItemContent = (
    item: GraphQLTimelineItem
  ): GraphQLTimelineTweet | GraphQLTimelineCursor | undefined => {
    return item.itemContent ?? item.content;
  };

  instructions?.forEach(instruction => {
    const kind =
      (instruction as { type?: string }).type ??
      (instruction as { __typename?: string }).__typename;

    if (kind === 'TimelineReplaceEntry') {
      const content = (instruction as TimelineReplaceEntryInstruction).entry?.content;
      if (content?.__typename === 'TimelineTimelineCursor') {
        cursors.push(normalizeCursor(content));
      }
      return;
    }

    if (kind === 'TimelineAddToModule') {
      (instruction as TimelineAddModulesInstruction).moduleItems?.forEach(_moduleItem => {
        const moduleItem = _moduleItem as {
          item?: { itemContent?: unknown; content?: unknown };
        };
        const itemContent = moduleItem?.item?.itemContent ?? moduleItem?.item?.content;
        if (!itemContent) return;
        extractUserFromItemContent(itemContent, users);
        if (
          typeof itemContent === 'object' &&
          itemContent !== null &&
          (itemContent as { __typename?: string }).__typename === 'TimelineTimelineCursor'
        ) {
          cursors.push(normalizeCursor(itemContent as GraphQLTimelineCursor));
        }
      });
      return;
    }

    if (kind === 'TimelineAddEntries') {
      (instruction as TimelineAddEntriesInstruction).entries?.forEach(_entry => {
        const entry = _entry as GraphQLTimelineTweetEntry | GraphQLConversationThread;
        const content = (entry as GraphQLTimelineTweetEntry)?.content;

        if (typeof content === 'undefined') return;

        if (content.__typename === 'TimelineTimelineItem') {
          const inner = getItemContent(content as GraphQLTimelineItem);
          if (inner) {
            extractUserFromItemContent(inner, users);
            if (inner.__typename === 'TimelineTimelineCursor') {
              cursors.push(normalizeCursor(inner as GraphQLTimelineCursor));
            }
          }
        } else if (isGraphQLTimelineCursor(content)) {
          cursors.push(normalizeCursor(content));
        } else if (
          (content as unknown as GraphQLTimelineModule).__typename === 'TimelineTimelineModule'
        ) {
          (content as unknown as GraphQLTimelineModule).items?.forEach(item => {
            const inner = getItemContent(item.item);
            if (!inner) return;
            extractUserFromItemContent(inner, users);
            if (inner.__typename === 'TimelineTimelineCursor') {
              cursors.push(normalizeCursor(inner as GraphQLTimelineCursor));
            }
          });
        }
      });
    }
  });

  return { users, cursors };
};

export const processUserRelationshipTimelineInstructions =
  processUserRelationshipTimelineInstructionsImpl;
export const processRetweetersUserTimelineInstructions =
  processUserRelationshipTimelineInstructionsImpl;

export const searchAPI = async (
  query: string,
  feed: SearchFeed,
  count: number,
  cursor: string | null,
  c: Context,
  language?: string
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
      headers: buildLanguageHeaders(language),
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
      statuses.map(status =>
        buildAPITwitterStatus(c, status, language, null, false).catch(err => {
          console.error('Error building status', err);
          return null;
        })
      )
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
