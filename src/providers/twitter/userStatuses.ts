import { Context } from 'hono';
import { buildAPITwitterStatus } from './processor';
import {
  FollowersByUserIDTimelineQuery,
  FollowersQuery,
  FollowingByUserIDTimelineQuery,
  FollowingQuery,
  ProfileArticlesTimelineQuery,
  ProfileTimelineQuery,
  ProfileWithRepliesTimelineQuery,
  UserArticlesTweetsQuery,
  UserMediaQuery,
  UserTweetsAndRepliesQuery,
  UserTweetsQuery
} from './graphql/queries';
import { graphQLOrchestrator } from './graphql/orchestrator';
import {
  getFollowersFollowingInstructions,
  getProfileArticlesTimelineInstructions,
  getProfileStatusesTimelineInstructions,
  validateFollowersByUserIDTimelineResponse,
  validateFollowingByUserIDTimelineResponse,
  validateProfileArticlesTimelineResponse,
  validateProfileTimelineResponse,
  validateProfileWithRepliesTimelineResponse,
  validateUserArticlesTweetsResponse,
  validateUserMediaTimelineResponse,
  validateUserTweetsTimeline
} from './graphql/validators';
import { buildLanguageHeaders } from '../../helpers/language';
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
  withReplies = false,
  language?: string
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
      headers: buildLanguageHeaders(language),
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
      statuses.map(status =>
        buildAPITwitterStatus(c, status, language, null, false, false).catch(err => {
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

/** Max timeline pages to merge for feeds (100 posts × ~20/slice → cap rounds). */
const PROFILE_STATUSES_FEED_MAX_PAGES = 10;

const PROFILE_STATUSES_FEED_PER_PAGE = 100;
const PROFILE_STATUSES_FEED_TARGET_CAP = 100;

async function paginateAndMerge(
  fetchPage: (cursor: string | null) => Promise<APISearchResults>,
  target: number,
  maxPages = PROFILE_STATUSES_FEED_MAX_PAGES
): Promise<APISearchResults> {
  const merged: APITwitterStatus[] = [];
  const seenIds = new Set<string>();
  let cursor: string | null = null;
  let lastCursors: APISearchResults['cursor'] = { top: null, bottom: null };
  let pages = 0;
  let anySuccessfulPage = false;

  while (merged.length < target && pages < maxPages) {
    pages += 1;
    const page = await fetchPage(cursor);

    if (page.code === 404) {
      if (merged.length === 0) {
        return page;
      }
      break;
    }

    if (page.code !== 200) {
      if (merged.length === 0) {
        return page;
      }
      break;
    }

    anySuccessfulPage = true;
    lastCursors = page.cursor;

    if (page.results.length === 0) {
      break;
    }

    for (const s of page.results) {
      if (seenIds.has(s.id)) continue;
      seenIds.add(s.id);
      merged.push(s);
      if (merged.length >= target) break;
    }

    if (merged.length >= target) break;

    const bottom = page.cursor.bottom;
    if (!bottom || bottom === cursor) break;
    cursor = bottom;
  }

  if (merged.length === 0) {
    if (anySuccessfulPage) {
      return { code: 200, results: [], cursor: { top: null, bottom: null } };
    }
    return { code: 404, results: [], cursor: { top: null, bottom: null } };
  }

  return {
    code: 200,
    results: merged.slice(0, target),
    cursor: lastCursors
  };
}

/**
 * Fetches up to `maxTotal` statuses (cap 100) by walking `cursor.bottom` across
 * multiple `profileStatusesAPI` calls. Dedupes by tweet id. Stops when the
 * target count is reached, there is no bottom cursor, or a page returns no rows.
 */
export const profileStatusesAPIPaginated = async (
  handleOrId: ProfileHandleOrId,
  maxTotal: number,
  c: Context,
  withReplies = false,
  language?: string
): Promise<APISearchResults> => {
  const target = Math.min(PROFILE_STATUSES_FEED_TARGET_CAP, Math.max(1, maxTotal));
  return paginateAndMerge(
    cursor =>
      profileStatusesAPI(
        handleOrId,
        PROFILE_STATUSES_FEED_PER_PAGE,
        cursor,
        c,
        withReplies,
        language
      ),
    target
  );
};

export const profileArticlesAPI = async (
  handleOrId: ProfileHandleOrId,
  count: number,
  cursor: string | null,
  c: Context,
  language?: string
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
      key: 'articles',
      required: true,
      headers: buildLanguageHeaders(language),
      methods: [
        {
          name: 'ProfileArticlesTimeline',
          query: ProfileArticlesTimelineQuery,
          weight: 500,
          validator: validateProfileArticlesTimelineResponse
        },
        {
          name: 'UserArticlesTweets',
          query: UserArticlesTweetsQuery,
          weight: 500,
          validator: validateUserArticlesTweetsResponse
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

  if (!results.articles?.success) {
    console.error('Profile articles timeline request failed', results.articles?.error);
    return { code: 500, results: [], cursor: { top: null, bottom: null } };
  }

  const instructions = getProfileArticlesTimelineInstructions(results.articles.data);
  if (!instructions) {
    return { code: 404, results: [], cursor: { top: null, bottom: null } };
  }

  const { statuses, cursors } = processTimelineInstructions(instructions);
  const topCursor = cursors.find(cur => cur.cursorType === 'Top')?.value ?? null;
  const bottomCursor = cursors.find(cur => cur.cursorType === 'Bottom')?.value ?? null;

  const builtStatuses = (
    await Promise.all(
      statuses.map(status =>
        buildAPITwitterStatus(c, status, language, null, false, false).catch(err => {
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

export const profileMediaAPI = async (
  handleOrId: ProfileHandleOrId,
  count: number,
  cursor: string | null,
  c: Context,
  language?: string
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
      headers: buildLanguageHeaders(language),
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
      statuses.map(status =>
        buildAPITwitterStatus(c, status, language, null, false, false).catch(err => {
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

/**
 * Same pagination strategy as `profileStatusesAPIPaginated`, for the profile media tab timeline.
 */
export const profileMediaAPIPaginated = async (
  handleOrId: ProfileHandleOrId,
  maxTotal: number,
  c: Context,
  language?: string
): Promise<APISearchResults> => {
  const target = Math.min(PROFILE_STATUSES_FEED_TARGET_CAP, Math.max(1, maxTotal));
  return paginateAndMerge(
    cursor => profileMediaAPI(handleOrId, PROFILE_STATUSES_FEED_PER_PAGE, cursor, c, language),
    target
  );
};

const relationshipListUserNotFound = (): APIProfileRelationshipList => ({
  code: 404,
  results: [],
  cursor: { top: null, bottom: null }
});

const emptySuccessRelationshipList = (): APIProfileRelationshipList => ({
  code: 200,
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
    return relationshipListUserNotFound();
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
    return emptySuccessRelationshipList();
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
