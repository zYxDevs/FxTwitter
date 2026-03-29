import { Constants } from '../../constants';
import { buildAPITwitterStatus } from './processor';
import { Experiment, experimentCheck } from '../../experiments';
import { isGraphQLTwitterStatus } from '../../helpers/graphql';
import { Context } from 'hono';
import { ContentfulStatusCode } from 'hono/utils/http-status';
import type { APITwitterStatus } from '../../realms/api/schemas';
import { InputFlags } from '../../types/types';
import {
  ConversationTimelineQuery,
  TweetDetailQuery,
  TweetResultByIdQuery,
  TweetResultByRestIdQuery,
  TweetResultsByIdsQuery,
  TweetResultsByRestIdsQuery
} from './graphql/queries';
import { graphqlRequest } from './graphql/request';
import { graphQLOrchestrator } from './graphql/orchestrator';

const writeDataPoint = (
  c: Context,
  language: string | undefined,
  nsfw: boolean | null,
  returnCode: string,
  flags?: InputFlags
) => {
  console.log('Writing data point...');
  if (typeof c.env?.AnalyticsEngine !== 'undefined') {
    const flagString =
      Object.keys(flags || {})
        // @ts-expect-error - TypeScript doesn't like iterating over the keys, but that's OK
        .filter(flag => flags?.[flag])[0] || 'standard';

    console.log(flagString);

    c.env?.AnalyticsEngine.writeDataPoint({
      blobs: [
        c.req.raw.cf?.colo as string /* Datacenter location */,
        c.req.raw.cf?.country as string /* Country code */,
        c.req.header('user-agent') ?? '' /* User agent (for aggregating bots calling) */,
        returnCode /* Return code */,
        flagString /* Type of request */,
        language ?? '' /* For translate feature */
      ],
      doubles: [nsfw ? 1 : 0 /* NSFW media = 1, No NSFW Media = 0 */]
    });
  }
};

const getResultFromResponse = (
  response:
    | TweetResultByRestIdResponse
    | TweetResultsByRestIdsResponse
    | TweetResultsByIdsResponse
    | TweetResultByIdResponse
    | TweetDetailResponse
    | null
) => {
  if ((response as TweetResultByRestIdResponse)?.data?.tweetResult?.result) {
    return (response as TweetResultByRestIdResponse)?.data?.tweetResult
      ?.result as GraphQLTwitterStatus;
  } else if ((response as TweetResultsByRestIdsResponse)?.data?.tweetResult?.[0]?.result) {
    return (response as TweetResultsByRestIdsResponse)?.data?.tweetResult?.[0]
      ?.result as GraphQLTwitterStatus;
  } else if ((response as TweetResultsByIdsResponse)?.data?.tweet_results?.[0]?.result) {
    return (response as TweetResultsByIdsResponse)?.data?.tweet_results?.[0]
      ?.result as GraphQLTwitterStatus;
  } else if ((response as TweetResultByIdResponse)?.data?.tweet_result?.result) {
    return (response as TweetResultByIdResponse)?.data?.tweet_result
      ?.result as GraphQLTwitterStatus;
  }
  return null;
};

const isTweetUnavailable = (response: unknown): response is TweetStub => {
  return (
    typeof response === 'object' &&
    response !== null &&
    '__typename' in response &&
    (response as { __typename?: string }).__typename === 'TweetUnavailable'
  );
};

export type TweetDetailRankingMode = 'Relevance' | 'Recency' | 'Likes';

const validateThreadedConversationResponse = (_conversation: unknown): boolean => {
  const conversation = _conversation as TweetDetailResponse;
  const instructions = conversation?.data?.threaded_conversation_with_injections_v2?.instructions;
  if (Array.isArray(instructions)) {
    return true;
  }
  return Array.isArray(conversation?.errors);
};

/**
 * TweetDetail (50/period) vs ConversationTimeline (150/period) at 1:3 to level rate limits.
 * Uses graphQLOrchestrator weighted selection (same distribution as the former Math.random split).
 * @param processThread - When true, uses the same 1000/3000 weights as fetchSingleStatus for these two endpoints.
 */
export const fetchTweetDetail = async (
  c: Context,
  status: string,
  cursor: string | null = null,
  rankingMode?: TweetDetailRankingMode
): Promise<TweetDetailResponse> => {
  const results = await graphQLOrchestrator(c, [
    {
      key: 'threadedConversation',
      methods: [
        {
          name: 'ConversationTimeline',
          query: ConversationTimelineQuery,
          weight: 150,
          validator: validateThreadedConversationResponse,
          variables: {
            focal_tweet_id: status,
            cursor,
            ...(rankingMode ? { ranking_mode: rankingMode } : {})
          }
        },
        {
          name: 'TweetDetail',
          query: TweetDetailQuery,
          weight: 150,
          validator: validateThreadedConversationResponse,
          variables: {
            focalTweetId: status,
            cursor,
            ...(rankingMode ? { rankingMode } : {})
          }
        }
      ],
      required: true
    }
  ]);

  const entry = results.threadedConversation;
  if (entry?.success && entry.data) {
    return entry.data as TweetDetailResponse;
  }
  return (entry?.data ?? { data: undefined }) as TweetDetailResponse;
};

export const fetchByRestId = async (
  status: string,
  c: Context,
  useElongator = experimentCheck(
    Experiment.ELONGATOR_BY_DEFAULT,
    typeof c.env?.TwitterProxy !== 'undefined'
  )
): Promise<TweetResultByRestIdResponse> => {
  return graphqlRequest(c, {
    query: TweetResultByRestIdQuery,
    variables: {
      tweetId: status
    },
    useElongator: useElongator,
    validator: (_conversation: unknown) => {
      const conversation = _conversation as TweetResultByRestIdResponse;
      // If we get a not found error it's still a valid response
      const tweet = conversation?.data?.tweetResult?.result;
      if (isGraphQLTwitterStatus(tweet)) {
        return true;
      }
      console.log('invalid graphql tweet');
      if (
        !tweet &&
        typeof conversation.data?.tweetResult === 'object' &&
        Object.keys(conversation.data?.tweetResult || {}).length === 0
      ) {
        console.log('tweet was not found');
        return true;
      }
      if (tweet?.__typename === 'TweetUnavailable' && tweet.reason === 'NsfwLoggedOut') {
        console.log('status is nsfw');
        return true;
      }
      if (tweet?.__typename === 'TweetUnavailable' && tweet.reason === 'Protected') {
        console.log('status is protected');
        return true;
      }
      if (tweet?.__typename === 'TweetUnavailable') {
        console.log('generic tweet unavailable error');
        return true;
      }
      // Final clause for checking if it's valid is if there's errors
      return Array.isArray(conversation.errors);
    }
  }) as Promise<TweetResultByRestIdResponse>;
};

export const fetchByRestIds = async (
  statuses: string[],
  c: Context,
  useElongator = experimentCheck(
    Experiment.ELONGATOR_BY_DEFAULT,
    typeof c.env?.TwitterProxy !== 'undefined'
  )
): Promise<TweetResultsByRestIdsResponse> => {
  return graphqlRequest(c, {
    query: TweetResultsByRestIdsQuery,
    variables: {
      tweetIds: statuses
    },
    useElongator: useElongator,
    validator: (_conversation: unknown) => {
      const conversation = _conversation as TweetResultsByRestIdsResponse;
      // If we get a not found error it's still a valid response
      const tweet = conversation?.data?.tweetResult?.[0]?.result;
      if (isGraphQLTwitterStatus(tweet)) {
        return true;
      }
      console.log('invalid graphql tweet');
      if (
        !tweet &&
        typeof conversation.data?.tweetResult === 'object' &&
        Object.keys(conversation.data?.tweetResult || {}).length === 0
      ) {
        console.log('tweet was not found');
        return true;
      }
      if (tweet?.__typename === 'TweetUnavailable' && tweet.reason === 'NsfwLoggedOut') {
        console.log('status is nsfw');
        return true;
      }
      if (tweet?.__typename === 'TweetUnavailable' && tweet.reason === 'Protected') {
        console.log('status is protected');
        return true;
      }
      if (tweet?.__typename === 'TweetUnavailable') {
        console.log('generic tweet unavailable error');
        return true;
      }
      // Final clause for checking if it's valid is if there's errors
      return Array.isArray(conversation.errors);
    }
  }) as Promise<TweetResultsByRestIdsResponse>;
};

export const fetchByIds = async (
  statuses: string[],
  c: Context,
  useElongator = experimentCheck(
    Experiment.ELONGATOR_BY_DEFAULT,
    typeof c.env?.TwitterProxy !== 'undefined'
  )
): Promise<TweetResultsByIdsResponse> => {
  return graphqlRequest(c, {
    query: TweetResultsByIdsQuery,
    variables: {
      rest_ids: statuses
    },
    useElongator: useElongator,
    validator: (_conversation: unknown) => {
      const conversation = _conversation as TweetResultsByIdsResponse;
      // If we get a not found error it's still a valid response
      const status = getResultFromResponse(conversation) as unknown;
      if (isGraphQLTwitterStatus(status)) {
        return true;
      }
      console.log('invalid graphql tweet');
      if (
        !status &&
        typeof conversation.data?.tweet_results === 'object' &&
        Object.keys(conversation.data?.tweet_results || {}).length === 0
      ) {
        console.log('status not found');
        return true;
      }
      if (isTweetUnavailable(status) && status.reason === 'NsfwLoggedOut') {
        console.log('status is nsfw');
        return true;
      }
      if (isTweetUnavailable(status) && status.reason === 'Protected') {
        console.log('status is protected');
        return true;
      }
      if (isTweetUnavailable(status)) {
        console.log('generic tweet unavailable error');
        return true;
      }
      // Final clause for checking if it's valid is if there's errors
      return Array.isArray(conversation.errors);
    }
  }) as Promise<TweetResultsByIdsResponse>;
};

export const fetchById = async (
  status: string,
  c: Context,
  useElongator = experimentCheck(
    Experiment.ELONGATOR_BY_DEFAULT,
    typeof c.env?.TwitterProxy !== 'undefined'
  )
): Promise<TweetResultByIdResponse> => {
  return graphqlRequest(c, {
    query: TweetResultByIdQuery,
    variables: {
      rest_id: status
    },
    useElongator: useElongator,
    validator: (_conversation: unknown) => {
      const conversation = _conversation as TweetResultByIdResponse;
      // If we get a not found error it's still a valid response
      const tweet = conversation.data?.tweet_result?.result;
      if (isGraphQLTwitterStatus(tweet)) {
        return true;
      }
      console.log('invalid graphql tweet');
      if (
        !tweet &&
        typeof conversation.data?.tweet_result === 'object' &&
        Object.keys(conversation.data?.tweet_result || {}).length === 0
      ) {
        console.log('status not found');
        return true;
      }
      // Final clause for checking if it's valid is if there's errors
      return Array.isArray(conversation.errors);
    }
  }) as Promise<TweetResultByIdResponse>;
};

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * ConversationTimeline (iOS) uses snake_case field names while TweetDetail (web)
 * uses camelCase. These helpers normalise access so both formats work.
 */
const getItemContent = (obj: any): any => obj?.itemContent ?? obj?.content;

const getEntryId = (obj: any): string | undefined => obj?.entryId ?? obj?.entry_id;

const getInstructionType = (obj: any): string | undefined => obj?.type ?? obj?.__typename;

const normalizeCursor = (raw: any): GraphQLTimelineCursor => {
  if (raw.cursorType) return raw as GraphQLTimelineCursor;
  return { ...raw, cursorType: raw.cursor_type } as GraphQLTimelineCursor;
};

/* eslint-enable @typescript-eslint/no-explicit-any */

const pushTweetFromContent = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  itemContent: any,
  target: GraphQLTwitterStatus[]
) => {
  if (itemContent?.__typename !== 'TimelineTweet') return;
  const entryType = itemContent.tweet_results?.result?.__typename;
  if (entryType === 'Tweet') {
    target.push(itemContent.tweet_results.result as GraphQLTwitterStatus);
  } else if (entryType === 'TweetWithVisibilityResults') {
    target.push(itemContent.tweet_results.result.tweet as GraphQLTwitterStatus);
  }
};

const processResponse = (instructions: TimelineInstruction[]): GraphQLProcessBucket => {
  const bucket: GraphQLProcessBucket = {
    statuses: [],
    allStatuses: [],
    cursors: []
  };
  instructions?.forEach?.(instruction => {
    const itype = getInstructionType(instruction);
    if (itype === 'TimelineAddEntries' || itype === 'TimelineAddToModule') {
      (
        (instruction as TimelineAddEntriesInstruction)?.entries ??
        (instruction as TimelineAddModulesInstruction)?.moduleItems
      )?.forEach(_entry => {
        const entry = _entry as
          | GraphQLTimelineTweetEntry
          | GraphQLConversationThread
          | GraphQLModuleTweetEntry;
        const content =
          (entry as GraphQLModuleTweetEntry)?.item ?? (entry as GraphQLTimelineTweetEntry)?.content;

        if (typeof content === 'undefined') {
          return;
        }

        const typename = (content as { __typename: string }).__typename;

        if (typename === 'TimelineTimelineCursor') {
          bucket.cursors.push(normalizeCursor(content));
        } else if (typename === 'TimelineTimelineItem') {
          const itemContent = getItemContent(content);
          if (itemContent?.__typename === 'TimelineTweet') {
            pushTweetFromContent(itemContent, bucket.statuses);
          } else if (itemContent?.__typename === 'TimelineTimelineCursor') {
            bucket.cursors.push(normalizeCursor(itemContent));
          }
        } else if (typename === 'TimelineTimelineModule') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (content as any).items?.forEach((item: { item: Record<string, unknown> }) => {
            const itemContent = getItemContent(item.item);
            if (itemContent?.__typename === 'TimelineTweet') {
              pushTweetFromContent(itemContent, bucket.statuses);
            } else if (itemContent?.__typename === 'TimelineTimelineCursor') {
              bucket.cursors.push(normalizeCursor(itemContent));
            }
          });
        }
      });
    }
  });

  return bucket;
};

interface GraphQLConversationBucket {
  /** Top-level tweet-* entries: ancestor chain + focal tweet */
  chainStatuses: GraphQLTwitterStatus[];
  /** Tweets inside conversationthread-* modules: actual replies */
  replyStatuses: GraphQLTwitterStatus[];
  cursors: GraphQLTimelineCursor[];
}

/**
 * Processes TweetDetail / ConversationTimeline instructions while preserving
 * the structural distinction between the ancestor chain (top-level tweet-*
 * entries) and replies (conversationthread-* module entries).
 */
const processConversationResponse = (
  instructions: TimelineInstruction[]
): GraphQLConversationBucket => {
  const bucket: GraphQLConversationBucket = {
    chainStatuses: [],
    replyStatuses: [],
    cursors: []
  };

  instructions?.forEach?.(instruction => {
    const itype = getInstructionType(instruction);
    if (itype === 'TimelineAddEntries' || itype === 'TimelineAddToModule') {
      (
        (instruction as TimelineAddEntriesInstruction)?.entries ??
        (instruction as TimelineAddModulesInstruction)?.moduleItems
      )?.forEach(_entry => {
        const entry = _entry as
          | GraphQLTimelineTweetEntry
          | GraphQLConversationThread
          | GraphQLModuleTweetEntry;
        const entryId = getEntryId(entry);
        const isReplyEntry = entryId?.startsWith('conversationthread-');

        const content =
          (entry as GraphQLModuleTweetEntry)?.item ?? (entry as GraphQLTimelineTweetEntry)?.content;

        if (typeof content === 'undefined') return;

        const typename = (content as { __typename: string }).__typename;

        if (typename === 'TimelineTimelineCursor') {
          bucket.cursors.push(normalizeCursor(content));
        } else if (typename === 'TimelineTimelineItem') {
          const itemContent = getItemContent(content);
          if (itemContent?.__typename === 'TimelineTweet') {
            pushTweetFromContent(
              itemContent,
              isReplyEntry ? bucket.replyStatuses : bucket.chainStatuses
            );
          } else if (itemContent?.__typename === 'TimelineTimelineCursor') {
            bucket.cursors.push(normalizeCursor(itemContent));
          }
        } else if (typename === 'TimelineTimelineModule') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (content as any).items?.forEach((item: { item: Record<string, unknown> }) => {
            const itemContent = getItemContent(item.item);
            if (itemContent?.__typename === 'TimelineTweet') {
              pushTweetFromContent(itemContent, bucket.replyStatuses);
            } else if (itemContent?.__typename === 'TimelineTimelineCursor') {
              bucket.cursors.push(normalizeCursor(itemContent));
            }
          });
        }
      });
    }
  });

  return bucket;
};

const findStatusInBucket = (
  id: string,
  bucket: GraphQLProcessBucket
): GraphQLTwitterStatus | null => {
  return bucket.statuses.find(status => (status.rest_id ?? status.legacy?.id_str) === id) ?? null;
};

const findNextStatus = (id: string, bucket: GraphQLProcessBucket): number => {
  return bucket.statuses.findIndex(status => status.legacy?.in_reply_to_status_id_str === id);
};

const findPreviousStatus = (id: string, bucket: GraphQLProcessBucket): number => {
  const status = bucket.allStatuses.find(
    status => (status.rest_id ?? status.legacy?.id_str ?? status.legacy?.conversation_id_str) === id
  );
  if (!status) {
    console.log('uhhh, we could not even find that tweet, dunno how that happened');
    return -1;
  }
  if (
    (status.rest_id ?? status.legacy?.id_str ?? status.legacy?.conversation_id_str) ===
    status.legacy?.in_reply_to_status_id_str
  ) {
    console.log('Tweet does not have a parent');
    return 0;
  }
  return bucket.allStatuses.findIndex(
    _status =>
      (_status.rest_id ?? _status.legacy?.id_str ?? _status.legacy?.conversation_id_str) ===
      status.legacy?.in_reply_to_status_id_str
  );
};

const consolidateCursors = (
  oldCursors: GraphQLTimelineCursor[],
  newCursors: GraphQLTimelineCursor[]
): GraphQLTimelineCursor[] => {
  /* Update the Bottom/Top cursor with the new one if applicable. Otherwise, keep the old one */
  return oldCursors.map(cursor => {
    const newCursor = newCursors.find(_cursor => _cursor.cursorType === cursor.cursorType);
    if (newCursor) {
      return newCursor;
    }
    return cursor;
  });
};

const filterBucketStatuses = (tweets: GraphQLTwitterStatus[], original: GraphQLTwitterStatus) => {
  return tweets.filter(
    tweet =>
      tweet.core?.user_results?.result?.rest_id === original.core?.user_results?.result?.rest_id
  );
};

/**
 * Fetches a single status using the orchestrator with dynamic endpoint selection
 * @param id - Status ID to fetch
 * @param c - Hono context
 * @param processThread - Whether this is for thread processing (affects TweetDetail priority)
 * @returns The status response or null
 */
const fetchSingleStatus = async (
  id: string,
  c: Context,
  processThread = false
): Promise<
  | TweetDetailResponse
  | TweetResultByRestIdResponse
  | TweetResultsByIdsResponse
  | TweetResultsByRestIdsResponse
  | null
> => {
  // Determine weights based on context
  const isApiHost = (() => {
    try {
      const url = new URL(c.req.url);
      return Constants.API_HOST_LIST.includes(url.hostname);
    } catch (e) {
      console.error(e);
      return false;
    }
  })();

  const hasElongator = experimentCheck(
    Experiment.ELONGATOR_BY_DEFAULT,
    typeof c.env?.TwitterProxy !== 'undefined'
  );

  // If elongator is not enabled, only use TweetResultByRestId
  if (!hasElongator) {
    try {
      return await fetchByRestId(id, c);
    } catch (_e) {
      return null;
    }
  }

  // Build methods with dynamic weights
  const results = await graphQLOrchestrator(c, [
    {
      key: 'status',
      methods: [
        {
          name: 'TweetDetail',
          query: TweetDetailQuery,
          weight: 150,
          fallbackOnly: !processThread,
          variables: { focalTweetId: id },
          validator: (response: unknown) => {
            const conversation = response as TweetDetailResponse;
            const instructions =
              conversation?.data?.threaded_conversation_with_injections_v2?.instructions;
            return Boolean(instructions && Array.isArray(instructions));
          }
        },
        {
          name: 'ConversationTimeline',
          query: ConversationTimelineQuery,
          weight: 150,
          fallbackOnly: !processThread,
          variables: { focal_tweet_id: id },
          validator: (response: unknown) => {
            const conversation = response as TweetDetailResponse;
            const instructions =
              conversation?.data?.threaded_conversation_with_injections_v2?.instructions;
            return Boolean(instructions && Array.isArray(instructions));
          }
        },
        {
          name: 'TweetResultByRestId',
          query: TweetResultByRestIdQuery,
          weight: 50,
          fallbackOnly: processThread,
          variables: { tweetId: id },
          validator: (response: unknown) => {
            const r = response as TweetResultByRestIdResponse;
            return Boolean(r?.data?.tweetResult?.result?.__typename);
          }
        },
        {
          name: 'TweetResultsByIdsQuery',
          query: TweetResultsByIdsQuery,
          weight: 500,
          fallbackOnly: processThread || isApiHost,
          variables: { rest_ids: [id] },
          validator: (response: unknown) => {
            const r = (response as TweetResultsByIdsResponse)?.data?.tweet_results?.[0]?.result as
              | GraphQLTwitterStatus
              | TweetStub
              | undefined;
            return Boolean((r as GraphQLTwitterStatus)?.__typename || (r as TweetStub)?.reason);
          }
        },
        {
          name: 'TweetResultsByRestIds',
          query: TweetResultsByRestIdsQuery,
          weight: 500,
          fallbackOnly: processThread,
          variables: { tweetIds: [id] },
          validator: (response: unknown) => {
            const r = (response as TweetResultsByRestIdsResponse)?.data?.tweetResult?.[0]
              ?.result as GraphQLTwitterStatus | TweetStub | undefined;
            return Boolean((r as GraphQLTwitterStatus)?.__typename || (r as TweetStub)?.reason);
          }
        }
      ],
      required: true
    }
  ]);

  return results.status?.success
    ? (results.status.data as
        | TweetDetailResponse
        | TweetResultByRestIdResponse
        | TweetResultsByIdsResponse
        | TweetResultsByRestIdsResponse)
    : null;
};

/* Fetch and construct a Twitter thread */
export const constructTwitterThread = async (
  id: string,
  processThread = false,
  c: Context,
  language: string | undefined,
  legacyAPI = false
): Promise<SocialThread> => {
  console.log('language', language);

  // Fetch status using orchestrator with appropriate method prioritization
  let response:
    | TweetDetailResponse
    | TweetResultByRestIdResponse
    | TweetResultsByRestIdsResponse
    | TweetResultsByIdsResponse
    | TweetResultByIdResponse
    | null = await fetchSingleStatus(id, c, processThread);
  let status: APITwitterStatus;

  if (!response) {
    writeDataPoint(c, language, null, '404');
    return { status: null, thread: null, author: null, code: 404 };
  }

  // Check if we got TweetDetail response (for thread processing)
  const triedTweetDetail = !!(response as TweetDetailResponse)?.data
    ?.threaded_conversation_with_injections_v2;

  const isTweetDetailResponse = (
    resp:
      | TweetDetailResponse
      | TweetResultByRestIdResponse
      | TweetResultsByRestIdsResponse
      | TweetResultsByIdsResponse
      | TweetResultByIdResponse
      | null
  ) => {
    return (
      resp &&
      'data' in resp &&
      resp.data !== null &&
      'threaded_conversation_with_injections_v2' in (resp.data || {})
    );
  };

  if (response && response.data && !triedTweetDetail) {
    const result = getResultFromResponse(response);

    if (!result) {
      writeDataPoint(c, language, null, '404');
      return { status: null, thread: null, author: null, code: 404 };
    }

    const buildStatus = await buildAPITwitterStatus(c, result, language, null, legacyAPI);

    if ((buildStatus as FetchResults)?.status === 401) {
      writeDataPoint(c, language, null, '401');
      return { status: null, thread: null, author: null, code: 401 };
    } else if (buildStatus === null || (buildStatus as FetchResults)?.status === 404) {
      writeDataPoint(c, language, null, '404');
      return { status: null, thread: null, author: null, code: 404 };
    }

    status = buildStatus as APITwitterStatus;

    // Check if article exists but lacks content blocks (TweetResultsByIds doesn't include full article data)
    if (
      status.article &&
      (!status.article.content?.blocks || status.article.content.blocks.length === 0)
    ) {
      console.log('Article lacks content blocks, re-fetching with TweetResultByRestId...');
      const articleResponse = await fetchByRestIds([id], c);
      if (articleResponse?.data?.tweetResult?.[0]?.result) {
        const rebuiltStatus = await buildAPITwitterStatus(
          c,
          articleResponse.data.tweetResult[0].result as GraphQLTwitterStatus,
          language,
          null,
          legacyAPI
        );
        if (rebuiltStatus && !(rebuiltStatus as FetchResults)?.status) {
          status = rebuiltStatus as APITwitterStatus;
        }
      }
    }

    // If not processing thread, return single tweet
    if (!processThread) {
      writeDataPoint(c, language, status.possibly_sensitive, '200');
      return { status: status, thread: null, author: status.author, code: 200 };
    } // If we need thread but have TweetResultByRestId response, try TweetDetail
    else if (typeof c.env?.TwitterProxy !== 'undefined') {
      console.log('Need thread data, trying TweetDetail...');
      if (experimentCheck(Experiment.TWEET_DETAIL_API)) {
        const threadResponse = await fetchTweetDetail(c, id, null);
        if (threadResponse?.data) {
          response = threadResponse;
        }
      }
      // Return single tweet if TweetDetail fails; otherwise fall through to thread processing
      if (!isTweetDetailResponse(response)) {
        writeDataPoint(c, language, status.possibly_sensitive, '200');
        return { status: status, thread: null, author: status.author, code: 200 };
      }
    } else if (processThread) {
      // Can't process thread without TweetDetail
      writeDataPoint(c, language, status.possibly_sensitive, '200');
      return { status: status, thread: null, author: status.author, code: 200 };
    }
  }

  // Process TweetDetail response for thread data
  if (response && !isTweetDetailResponse(response)) {
    writeDataPoint(c, language, null, '404');
    return { status: null, thread: null, author: null, code: 404 };
  }

  const bucket = processResponse(
    (response as TweetDetailResponse).data?.threaded_conversation_with_injections_v2
      ?.instructions ?? []
  );
  const originalStatus = findStatusInBucket(id, bucket);

  /* Don't bother processing thread on a null tweet */
  if (originalStatus === null) {
    writeDataPoint(c, language, null, '404');
    return { status: null, thread: null, author: null, code: 404 };
  }

  status = (await buildAPITwitterStatus(
    c,
    originalStatus,
    language,
    null,
    legacyAPI
  )) as APITwitterStatus;

  if (status === null) {
    writeDataPoint(c, language, null, '404');
    return { status: null, thread: null, author: null, code: 404 };
  }

  const author = status.author;

  /* If we're not processing threads, let's be done here */
  if (!processThread) {
    writeDataPoint(c, language, status.possibly_sensitive, '200');
    return { status: status, thread: null, author: author, code: 200 };
  }

  const threadStatuses = [originalStatus];
  bucket.allStatuses = bucket.statuses;
  bucket.statuses = filterBucketStatuses(bucket.statuses, originalStatus);

  let currentId = id;

  /* Process tweets that are following the current one in the thread */
  while (findNextStatus(currentId, bucket) !== -1) {
    const index = findNextStatus(currentId, bucket);
    const tweet = bucket.statuses[index];

    const newCurrentId = tweet.rest_id ?? tweet.legacy?.id_str;

    console.log(
      'adding next tweet to thread',
      newCurrentId,
      'from',
      currentId,
      'at index',
      index,
      'in bucket'
    );

    threadStatuses.push(tweet);

    currentId = newCurrentId;

    console.log('Current index', index, 'of', bucket.statuses.length);

    /* Reached the end of the current list of statuses in thread) */
    if (index >= bucket.statuses.length - 1) {
      /* See if we have a cursor to fetch more statuses */
      const cursor = bucket.cursors.find(
        cursor => cursor.cursorType === 'Bottom' || cursor.cursorType === 'ShowMore'
      );
      console.log('current cursors: ', bucket.cursors);
      if (!cursor) {
        console.log('No cursor present, stopping pagination down');
        break;
      }
      console.log('Cursor present, fetching more tweets down');

      let loadCursor: TweetDetailResponse;

      try {
        loadCursor = await fetchTweetDetail(c, id, cursor.value);

        if (
          typeof loadCursor?.data?.threaded_conversation_with_injections_v2?.instructions ===
          'undefined'
        ) {
          console.log('Unknown data while fetching cursor', loadCursor);
          break;
        }
      } catch (e) {
        console.log('Error fetching cursor', e);
        break;
      }

      const cursorResponse = processResponse(
        loadCursor?.data?.threaded_conversation_with_injections_v2?.instructions ?? []
      );
      bucket.statuses = bucket.statuses.concat(
        filterBucketStatuses(cursorResponse.statuses, originalStatus)
      );
      /* Remove old cursor and add new bottom cursor if necessary */
      consolidateCursors(bucket.cursors, cursorResponse.cursors);
      console.log('updated bucket of cursors', bucket.cursors);
    }

    console.log('Preview of next status:', findNextStatus(currentId, bucket));
  }

  currentId = id;

  while (findPreviousStatus(currentId, bucket) !== -1) {
    const index = findPreviousStatus(currentId, bucket);
    const status = bucket.allStatuses[index];
    const newCurrentId =
      status.rest_id ?? status.legacy?.id_str ?? status.legacy?.conversation_id_str;

    console.log(
      'adding previous status to thread',
      newCurrentId,
      'from',
      currentId,
      'at index',
      index,
      'in bucket'
    );

    threadStatuses.unshift(status);

    currentId = newCurrentId;

    if (index === 0) {
      /* See if we have a cursor to fetch more statuses */
      const cursor = bucket.cursors.find(
        cursor => cursor.cursorType === 'Top' || cursor.cursorType === 'ShowMore'
      );
      console.log('current cursors: ', bucket.cursors);
      if (!cursor) {
        console.log('No cursor present, stopping pagination up');
        break;
      }
      console.log('Cursor present, fetching more statuses up');

      let loadCursor: TweetDetailResponse;

      try {
        loadCursor = await fetchTweetDetail(c, id, cursor.value);

        if (
          typeof loadCursor?.data?.threaded_conversation_with_injections_v2?.instructions ===
          'undefined'
        ) {
          console.log('Unknown data while fetching cursor', loadCursor);
          break;
        }
      } catch (e) {
        console.log('Error fetching cursor', e);
        break;
      }
      const cursorResponse = processResponse(
        loadCursor?.data?.threaded_conversation_with_injections_v2?.instructions ?? []
      );
      bucket.statuses = cursorResponse.statuses.concat(
        filterBucketStatuses(bucket.statuses, originalStatus)
      );
      /* Remove old cursor and add new top cursor if necessary */
      consolidateCursors(bucket.cursors, cursorResponse.cursors);

      // console.log('updated bucket of statuses', bucket.statuses);
      console.log('updated bucket of cursors', bucket.cursors);
    }

    console.log('Preview of previous status:', findPreviousStatus(currentId, bucket));
  }

  const socialThread: SocialThread = {
    status: status,
    thread: [],
    author: author,
    code: 200
  };

  await Promise.all(
    threadStatuses.map(async status => {
      const builtStatus = (await buildAPITwitterStatus(
        c,
        status,
        language,
        author,
        false
      )) as APITwitterStatus;
      socialThread.thread?.push(builtStatus);
    })
  );

  // Sort socialThread.thread by id converted to bigint
  socialThread.thread?.sort((a: APIStatus | APITwitterStatus, b: APIStatus | APITwitterStatus) => {
    const aId = BigInt(a.id);
    const bId = BigInt(b.id);
    if (aId < bId) {
      return -1;
    }
    if (aId > bId) {
      return 1;
    }
    return 0;
  });

  return socialThread;
};

/* Fetch and construct a conversation view: full ancestor chain + replies from others */
export const constructTwitterConversation = async (
  id: string,
  c: Context,
  rankingMode: TweetDetailRankingMode = 'Likes',
  cursor: string | null = null
): Promise<SocialConversation> => {
  const response = await fetchTweetDetail(c, id, cursor, rankingMode);

  if (!response?.data?.threaded_conversation_with_injections_v2?.instructions) {
    return { status: null, thread: null, replies: null, author: null, cursor: null, code: 404 };
  }

  const bucket = processConversationResponse(
    response.data.threaded_conversation_with_injections_v2.instructions
  );

  const originalStatus =
    bucket.chainStatuses.find(s => (s.rest_id ?? s.legacy?.id_str) === id) ?? null;

  if (originalStatus === null) {
    return { status: null, thread: null, replies: null, author: null, cursor: null, code: 404 };
  }

  const status = (await buildAPITwitterStatus(
    c,
    originalStatus,
    undefined,
    null,
    false
  )) as APITwitterStatus;

  if (status === null) {
    return { status: null, thread: null, replies: null, author: null, cursor: null, code: 404 };
  }

  const author = status.author;

  /*
   * Thread = all chainStatuses (ancestor chain from TweetDetail top-level entries).
   * These are already in conversation order from the API.
   * On cursor pages (reply pagination), chainStatuses will just have the focal tweet.
   */
  const threadStatuses = cursor ? [originalStatus] : [...bucket.chainStatuses];

  /* Build the thread */
  const socialConversation: SocialConversation = {
    status: status,
    thread: [],
    replies: [],
    author: author,
    cursor: null,
    code: 200
  };

  await Promise.all(
    threadStatuses.map(async s => {
      const builtStatus = (await buildAPITwitterStatus(
        c,
        s,
        undefined,
        author,
        false
      )) as APITwitterStatus;
      socialConversation.thread?.push(builtStatus);
    })
  );

  socialConversation.thread?.sort((a, b) => {
    const aId = BigInt(a.id);
    const bId = BigInt(b.id);
    if (aId < bId) return -1;
    if (aId > bId) return 1;
    return 0;
  });

  /* Build the replies (from conversationthread-* modules) */
  await Promise.all(
    bucket.replyStatuses.map(async s => {
      const builtStatus = (await buildAPITwitterStatus(
        c,
        s,
        undefined,
        null,
        false
      )) as APITwitterStatus;
      if (builtStatus) {
        socialConversation.replies?.push(builtStatus);
      }
    })
  );

  /* Expose the bottom cursor for reply pagination */
  const bottomCursor = bucket.cursors.find(
    c => c.cursorType === 'Bottom' || c.cursorType === 'ShowMore'
  );
  if (bottomCursor) {
    socialConversation.cursor = { bottom: bottomCursor.value };
  }

  return socialConversation;
};

export const threadAPIProvider = async (c: Context) => {
  const id = c.req.param('id') as string;

  const processedResponse = await constructTwitterThread(id, true, c, undefined);

  // Add every header from Constants.API_RESPONSE_HEADERS
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(processedResponse, processedResponse.code as ContentfulStatusCode);
};
