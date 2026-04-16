import type { RouteHandler } from '@hono/zod-openapi';
import { Constants } from '../../constants';
import { jsonAfterNormalize, normalizeApiJsonResponse } from '../api/normalizeApiJsonResponse';
import { isParamTruthy } from '../../helpers/utils';
import {
  constructBlueskyConversation,
  constructBlueskyThread
} from '../../providers/bluesky/conversation';
import { blueskyUserProfileAPI } from '../../providers/bluesky/profile';
import {
  blueskyProfileLikesAPI,
  blueskyProfileMediaAPI,
  blueskyProfileStatusesAPI
} from '../../providers/bluesky/profileStatuses';
import {
  blueskyProfileFollowersAPI,
  blueskyProfileFollowingAPI
} from '../../providers/bluesky/profileFollowers';
import { blueskySearchAPI } from '../../providers/bluesky/search';
import { blueskyTrendsAPI } from '../../providers/bluesky/trends';
import { blueskyStatusLikesAPI } from '../../providers/bluesky/statusLikes';
import { blueskyStatusRepostsAPI } from '../../providers/bluesky/statusReposts';
import {
  blueskyConversationV2Route,
  blueskyProfileFollowersV2Route,
  blueskyProfileFollowingV2Route,
  blueskyProfileLikesV2Route,
  blueskyProfileMediaV2Route,
  blueskyProfileStatusesV2Route,
  blueskyProfileV2Route,
  blueskySearchV2Route,
  blueskyTrendsV2Route,
  blueskyStatusLikesV2Route,
  blueskyStatusRepostsV2Route,
  blueskyStatusV2Route,
  blueskyThreadV2Route
} from './routes';

const unixTimestampParamToMs = (unix: number): number =>
  unix >= 1_000_000_000_000 ? unix : unix * 1000;

export const blueskyStatusAPIRequest: RouteHandler<typeof blueskyStatusV2Route> = async c => {
  const { handle, rkey } = c.req.valid('param');
  const { lang } = c.req.valid('query');
  const processedResponse = await constructBlueskyThread(rkey, handle, false, c, lang);
  const { httpStatus, payload } = normalizeApiJsonResponse(
    processedResponse,
    [200, 400, 404, 500] as const,
    'blueskyStatusAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof blueskyStatusV2Route>(c, payload, httpStatus);
};

export const blueskyStatusRepostsAPIRequest: RouteHandler<
  typeof blueskyStatusRepostsV2Route
> = async c => {
  const { handle, rkey } = c.req.valid('param');
  const query = c.req.valid('query');
  const count = query.count ?? 20;
  const cursor = query.cursor ?? null;

  const response = await blueskyStatusRepostsAPI(handle, rkey, { count, cursor }, c);
  const { httpStatus, payload } = normalizeApiJsonResponse(
    response,
    [200, 400, 404, 500] as const,
    'blueskyStatusRepostsAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof blueskyStatusRepostsV2Route>(c, payload, httpStatus);
};

export const blueskyStatusLikesAPIRequest: RouteHandler<
  typeof blueskyStatusLikesV2Route
> = async c => {
  const { handle, rkey } = c.req.valid('param');
  const query = c.req.valid('query');
  const count = query.count ?? 20;
  const cursor = query.cursor ?? null;

  const response = await blueskyStatusLikesAPI(handle, rkey, { count, cursor }, c);
  const { httpStatus, payload } = normalizeApiJsonResponse(
    response,
    [200, 400, 404, 500] as const,
    'blueskyStatusLikesAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof blueskyStatusLikesV2Route>(c, payload, httpStatus);
};

export const blueskyThreadAPIRequest: RouteHandler<typeof blueskyThreadV2Route> = async c => {
  const { handle, rkey } = c.req.valid('param');
  const { lang } = c.req.valid('query');
  const processedResponse = await constructBlueskyThread(rkey, handle, true, c, lang);
  const { httpStatus, payload } = normalizeApiJsonResponse(
    processedResponse,
    [200, 400, 404, 500] as const,
    'blueskyThreadAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof blueskyThreadV2Route>(c, payload, httpStatus);
};

export const blueskyConversationAPIRequest: RouteHandler<
  typeof blueskyConversationV2Route
> = async c => {
  const { handle, rkey } = c.req.valid('param');
  const query = c.req.valid('query');

  const result = await constructBlueskyConversation(handle, rkey, c, {
    rankingMode: query.ranking_mode ?? 'likes',
    cursor: query.cursor ?? null,
    count: query.count ?? 20,
    language: query.lang
  });

  if (!result.ok) {
    for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
      c.header(header, value);
    }
    return c.json({ code: 400 as const, message: result.message }, 400);
  }

  const processedResponse = result.data;
  const { httpStatus, payload } = normalizeApiJsonResponse(
    processedResponse,
    [200, 400, 404, 500] as const,
    'blueskyConversationAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof blueskyConversationV2Route>(c, payload, httpStatus);
};

export const blueskyProfileAPIRequest: RouteHandler<typeof blueskyProfileV2Route> = async c => {
  const { handle } = c.req.valid('param');
  const processedResponse = await blueskyUserProfileAPI(handle, c);
  const { httpStatus, payload } = normalizeApiJsonResponse(
    processedResponse,
    [200, 400, 404, 500] as const,
    'blueskyProfileAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof blueskyProfileV2Route>(c, payload, httpStatus);
};

export const blueskySearchAPIRequest: RouteHandler<typeof blueskySearchV2Route> = async c => {
  const query = c.req.valid('query');
  const searchResponse = await blueskySearchAPI(c, {
    q: query.q,
    feed: query.feed ?? 'latest',
    count: query.count ?? 30,
    cursor: query.cursor ?? null,
    language: query.lang
  });

  const { httpStatus, payload } = normalizeApiJsonResponse(
    searchResponse,
    [200, 400, 404, 500] as const,
    'blueskySearchAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof blueskySearchV2Route>(c, payload, httpStatus);
};

export const blueskyTrendsAPIRequest: RouteHandler<typeof blueskyTrendsV2Route> = async c => {
  const query = c.req.valid('query');
  const type = query.type ?? 'trending';
  const count = query.count ?? 20;
  const trendsResponse = await blueskyTrendsAPI(type, count);
  const { httpStatus, payload } = normalizeApiJsonResponse(
    trendsResponse,
    [200, 400, 404, 500] as const,
    'blueskyTrendsAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof blueskyTrendsV2Route>(c, payload, httpStatus);
};

export const blueskyProfileFollowersAPIRequest: RouteHandler<
  typeof blueskyProfileFollowersV2Route
> = async c => {
  const { handle } = c.req.valid('param');
  const query = c.req.valid('query');
  const count = query.count ?? 20;
  const cursor = query.cursor ?? null;

  const response = await blueskyProfileFollowersAPI(handle, { count, cursor }, c);
  const { httpStatus, payload } = normalizeApiJsonResponse(
    response,
    [200, 400, 404, 500] as const,
    'blueskyProfileFollowersAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof blueskyProfileFollowersV2Route>(c, payload, httpStatus);
};

export const blueskyProfileFollowingAPIRequest: RouteHandler<
  typeof blueskyProfileFollowingV2Route
> = async c => {
  const { handle } = c.req.valid('param');
  const query = c.req.valid('query');
  const count = query.count ?? 20;
  const cursor = query.cursor ?? null;

  const response = await blueskyProfileFollowingAPI(handle, { count, cursor }, c);
  const { httpStatus, payload } = normalizeApiJsonResponse(
    response,
    [200, 400, 404, 500] as const,
    'blueskyProfileFollowingAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof blueskyProfileFollowingV2Route>(c, payload, httpStatus);
};

export const blueskyProfileMediaAPIRequest: RouteHandler<
  typeof blueskyProfileMediaV2Route
> = async c => {
  const { handle } = c.req.valid('param');
  const query = c.req.valid('query');

  const mediaResponse = await blueskyProfileMediaAPI(
    handle,
    {
      count: query.count ?? 20,
      cursor: query.cursor ?? null,
      language: query.lang
    },
    c
  );

  const { httpStatus, payload } = normalizeApiJsonResponse(
    mediaResponse,
    [200, 400, 404, 500] as const,
    'blueskyProfileMediaAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof blueskyProfileMediaV2Route>(c, payload, httpStatus);
};

export const blueskyProfileLikesAPIRequest: RouteHandler<
  typeof blueskyProfileLikesV2Route
> = async c => {
  const { handle } = c.req.valid('param');
  const query = c.req.valid('query');

  const likesResponse = await blueskyProfileLikesAPI(
    handle,
    {
      count: query.count ?? 20,
      cursor: query.cursor ?? null,
      language: query.lang
    },
    c
  );

  const { httpStatus, payload } = normalizeApiJsonResponse(
    likesResponse,
    [200, 400, 401, 404, 500] as const,
    'blueskyProfileLikesAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof blueskyProfileLikesV2Route>(c, payload, httpStatus);
};

type BlueskyProfileStatusesResult = Awaited<
  ReturnType<RouteHandler<typeof blueskyProfileStatusesV2Route>>
>;

export const blueskyProfileStatusesAPIRequest = (async (
  c
): Promise<BlueskyProfileStatusesResult> => {
  const { handle } = c.req.valid('param');
  const query = c.req.valid('query');

  const count = query.count ?? 20;
  const cursor = query.cursor ?? null;
  const withReplies = isParamTruthy(query.with_replies ?? c.req.query('withReplies'));
  const sinceParam = query.since;

  const statusesResponse = await blueskyProfileStatusesAPI(
    handle,
    {
      count,
      cursor,
      withReplies,
      language: query.lang
    },
    c
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
      return c.body(null, 204) as BlueskyProfileStatusesResult;
    }
  }

  const { httpStatus, payload } = normalizeApiJsonResponse(
    statusesResponse,
    [200, 400, 404, 500] as const,
    'blueskyProfileStatusesAPIRequest'
  );
  c.status(httpStatus);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return jsonAfterNormalize<typeof blueskyProfileStatusesV2Route>(c, payload, httpStatus);
}) as RouteHandler<typeof blueskyProfileStatusesV2Route>;
