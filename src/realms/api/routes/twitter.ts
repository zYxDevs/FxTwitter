import {
  constructTwitterThread,
  constructTwitterConversation,
  type TweetDetailRankingMode
} from '../../../providers/twitter/conversation';
import { Constants } from '../../../constants';
import {
  userAPI,
  userAPIById,
  parseHandleOrId,
  profileAboutAPI
} from '../../../providers/twitter/profile';
import { attachAboutAccountData } from '../../../providers/twitter/aboutAccount';
import { searchAPI } from '../../../providers/twitter/search';
import {
  profileArticlesAPI,
  profileFollowersAPI,
  profileFollowingAPI,
  profileMediaAPI,
  profileStatusesAPI
} from '../../../providers/twitter/userStatuses';
import { statusRepostsAPI } from '../../../providers/twitter/statusReposts';
import { statusQuotesAPI } from '../../../providers/twitter/statusQuotes';
import { trendsAPI } from '../../../providers/twitter/trends';
import { typeaheadAPI } from '../../../providers/twitter/typeahead';
import { Context } from 'hono';
import { jsonAfterNormalize, normalizeApiJsonResponse } from '../normalizeApiJsonResponse';
import { isParamTruthy } from '../../../helpers/utils';
import type { RouteHandler } from '@hono/zod-openapi';
import {
  conversationV2Route,
  profileMediaV2Route,
  profileArticlesV2Route,
  profileFollowersV2Route,
  profileFollowingV2Route,
  profileAboutV2Route,
  profileStatusesV2Route,
  profileV2Route,
  searchV2Route,
  statusV2Route,
  statusRepostsV2Route,
  statusQuotesV2Route,
  threadV2Route,
  trendsV2Route,
  typeaheadV2Route
} from '../routes';

const shouldIncludeAboutAccount = (c: Context) => {
  return isParamTruthy(c.req.query('about_account') ?? c.req.query('aboutAccount'));
};

export const statusAPIRequest: RouteHandler<typeof statusV2Route> = async c => {
  const { id } = c.req.valid('param');
  const { lang } = c.req.valid('query');

  let processedResponse = await constructTwitterThread(id, false, c, lang, undefined);
  if (processedResponse.code === 200 && shouldIncludeAboutAccount(c)) {
    processedResponse = await attachAboutAccountData(c, processedResponse);
  }

  const { httpStatus, payload } = normalizeApiJsonResponse(
    processedResponse,
    [200, 400, 401, 404, 500] as const,
    'statusAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof statusV2Route>(c, payload, httpStatus);
};

export const statusRepostsAPIRequest: RouteHandler<typeof statusRepostsV2Route> = async c => {
  const { id } = c.req.valid('param');
  const query = c.req.valid('query');

  const count = query.count ?? 20;
  const cursor = query.cursor ?? null;

  const response = await statusRepostsAPI(id, count, cursor, c);
  const { httpStatus, payload } = normalizeApiJsonResponse(
    response,
    [200, 400, 404, 500] as const,
    'statusRepostsAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof statusRepostsV2Route>(c, payload, httpStatus);
};

export const statusQuotesAPIRequest: RouteHandler<typeof statusQuotesV2Route> = async c => {
  const { id } = c.req.valid('param');
  const query = c.req.valid('query');

  const count = query.count ?? 20;
  const cursor = query.cursor ?? null;

  const response = await statusQuotesAPI(id, count, cursor, c, query.lang);
  const { httpStatus, payload } = normalizeApiJsonResponse(
    response,
    [200, 400, 404, 500] as const,
    'statusQuotesAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof statusQuotesV2Route>(c, payload, httpStatus);
};

export const threadAPIRequest: RouteHandler<typeof threadV2Route> = async c => {
  const { id } = c.req.valid('param');
  const { lang } = c.req.valid('query');

  let processedResponse = await constructTwitterThread(id, true, c, lang);
  if (processedResponse.code === 200 && shouldIncludeAboutAccount(c)) {
    processedResponse = await attachAboutAccountData(c, processedResponse);
  }

  const { httpStatus, payload } = normalizeApiJsonResponse(
    processedResponse,
    [200, 400, 401, 404, 500] as const,
    'threadAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof threadV2Route>(c, payload, httpStatus);
};

const rankingModeMap: Record<string, TweetDetailRankingMode> = {
  likes: 'Likes',
  recency: 'Recency',
  relevance: 'Relevance'
};

export const conversationAPIRequest: RouteHandler<typeof conversationV2Route> = async c => {
  const { id } = c.req.valid('param');
  const query = c.req.valid('query');

  const rankingMode = rankingModeMap[query.ranking_mode ?? 'likes'] ?? 'Likes';
  const cursor = query.cursor ?? null;

  const processedResponse = await constructTwitterConversation(
    id,
    c,
    rankingMode,
    cursor,
    query.lang
  );
  const { httpStatus, payload } = normalizeApiJsonResponse(
    processedResponse,
    [200, 400, 401, 404, 500] as const,
    'conversationAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof conversationV2Route>(c, payload, httpStatus);
};

export const profileAPIRequest: RouteHandler<typeof profileV2Route> = async c => {
  const { handle } = c.req.valid('param');
  const parsed = parseHandleOrId(handle);

  const profileResponse =
    parsed.type === 'userId'
      ? await userAPIById(parsed.value, c, false, shouldIncludeAboutAccount(c))
      : await userAPI(parsed.value, c, false, shouldIncludeAboutAccount(c));
  const { httpStatus, payload } = normalizeApiJsonResponse(
    profileResponse,
    [200, 400, 404] as const,
    'profileAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof profileV2Route>(c, payload, httpStatus);
};

export const profileAboutAPIRequest: RouteHandler<typeof profileAboutV2Route> = async c => {
  const { handle } = c.req.valid('param');
  const aboutResponse = await profileAboutAPI(handle, c);
  const { httpStatus, payload } = normalizeApiJsonResponse(
    aboutResponse,
    [200, 400, 404] as const,
    'profileAboutAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof profileAboutV2Route>(c, payload, httpStatus);
};

const unixTimestampParamToMs = (unix: number): number =>
  unix >= 1_000_000_000_000 ? unix : unix * 1000;

type TwitterProfileStatusesResult = Awaited<
  ReturnType<RouteHandler<typeof profileStatusesV2Route>>
>;

export const profileStatusesAPIRequest = (async (
  c
): Promise<TwitterProfileStatusesResult> => {
  const { handle } = c.req.valid('param');
  const query = c.req.valid('query');

  const count = query.count ?? 20;
  const cursor = query.cursor ?? null;
  const withReplies = isParamTruthy(query.with_replies ?? c.req.query('withReplies'));
  const sinceParam = query.since;

  const statusesResponse = await profileStatusesAPI(
    parseHandleOrId(handle),
    count,
    cursor,
    c,
    withReplies,
    query.lang
  );

  const applySinceNoContent =
    sinceParam !== undefined && cursor === null && statusesResponse.code === 200;

  if (applySinceNoContent) {
    const sinceMs = unixTimestampParamToMs(sinceParam);
    const hasNewerPost = statusesResponse.results.some(s => {
      const tMs = s.created_timestamp * 1000;
      return Number.isFinite(tMs) && tMs > sinceMs;
    });
    if (!hasNewerPost) {
      c.status(204);
      for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
        c.header(header, value);
      }
      return c.body(null, 204) as TwitterProfileStatusesResult;
    }
  }

  const { httpStatus, payload } = normalizeApiJsonResponse(
    statusesResponse,
    [200, 400, 404, 500] as const,
    'profileStatusesAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof profileStatusesV2Route>(c, payload, httpStatus);
}) as RouteHandler<typeof profileStatusesV2Route>;

export const profileArticlesAPIRequest: RouteHandler<typeof profileArticlesV2Route> = async c => {
  const { handle } = c.req.valid('param');
  const query = c.req.valid('query');

  const count = query.count ?? 20;
  const cursor = query.cursor ?? null;

  const articlesResponse = await profileArticlesAPI(
    parseHandleOrId(handle),
    count,
    cursor,
    c,
    query.lang
  );

  const { httpStatus, payload } = normalizeApiJsonResponse(
    articlesResponse,
    [200, 400, 404, 500] as const,
    'profileArticlesAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof profileArticlesV2Route>(c, payload, httpStatus);
};

export const profileMediaAPIRequest: RouteHandler<typeof profileMediaV2Route> = async c => {
  const { handle } = c.req.valid('param');
  const query = c.req.valid('query');

  const count = query.count ?? 20;
  const cursor = query.cursor ?? null;

  const mediaResponse = await profileMediaAPI(
    parseHandleOrId(handle),
    count,
    cursor,
    c,
    query.lang
  );

  const { httpStatus, payload } = normalizeApiJsonResponse(
    mediaResponse,
    [200, 400, 404, 500] as const,
    'profileMediaAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof profileMediaV2Route>(c, payload, httpStatus);
};

export const profileFollowersAPIRequest: RouteHandler<typeof profileFollowersV2Route> = async c => {
  const { handle } = c.req.valid('param');
  const query = c.req.valid('query');

  const count = query.count ?? 20;
  const cursor = query.cursor ?? null;

  const response = await profileFollowersAPI(parseHandleOrId(handle), count, cursor, c);
  const { httpStatus, payload } = normalizeApiJsonResponse(
    response,
    [200, 400, 404, 500] as const,
    'profileFollowersAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof profileFollowersV2Route>(c, payload, httpStatus);
};

export const profileFollowingAPIRequest: RouteHandler<typeof profileFollowingV2Route> = async c => {
  const { handle } = c.req.valid('param');
  const query = c.req.valid('query');

  const count = query.count ?? 20;
  const cursor = query.cursor ?? null;

  const response = await profileFollowingAPI(parseHandleOrId(handle), count, cursor, c);
  const { httpStatus, payload } = normalizeApiJsonResponse(
    response,
    [200, 400, 404, 500] as const,
    'profileFollowingAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof profileFollowingV2Route>(c, payload, httpStatus);
};

export const searchAPIRequest: RouteHandler<typeof searchV2Route> = async c => {
  const query = c.req.valid('query');
  const q = query.q;

  const feed = query.feed ?? 'latest';
  const count = query.count ?? 30;
  const cursor = query.cursor ?? null;

  const searchResponse = await searchAPI(q, feed, count, cursor, c, query.lang);
  const { httpStatus, payload } = normalizeApiJsonResponse(
    searchResponse,
    [200, 400, 404, 500] as const,
    'searchAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof searchV2Route>(c, payload, httpStatus);
};

export const trendsAPIRequest: RouteHandler<typeof trendsV2Route> = async c => {
  const query = c.req.valid('query');
  const type = query.type ?? 'trending';
  const count = query.count ?? 20;

  const trendsResponse = await trendsAPI(c, type, count);
  const { httpStatus, payload } = normalizeApiJsonResponse(
    trendsResponse,
    [200, 400, 404, 500] as const,
    'trendsAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof trendsV2Route>(c, payload, httpStatus);
};

export const typeaheadAPIRequest: RouteHandler<typeof typeaheadV2Route> = async c => {
  const query = c.req.valid('query');
  const response = await typeaheadAPI(query.q, c, {
    resultType: query.result_type,
    src: query.src
  });
  const { httpStatus, payload } = normalizeApiJsonResponse(
    response,
    [200, 400, 404, 500] as const,
    'typeaheadAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof typeaheadV2Route>(c, payload, httpStatus);
};
