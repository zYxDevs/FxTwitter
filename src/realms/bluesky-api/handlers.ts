import type { RouteHandler } from '@hono/zod-openapi';
import { ContentfulStatusCode } from 'hono/utils/http-status';
import { Constants } from '../../constants';
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
import { blueskyStatusLikesAPI } from '../../providers/bluesky/statusLikes';
import { blueskyStatusRepostsAPI } from '../../providers/bluesky/statusReposts';
import type {
  blueskyConversationV2Route,
  blueskyProfileFollowersV2Route,
  blueskyProfileFollowingV2Route,
  blueskyProfileLikesV2Route,
  blueskyProfileMediaV2Route,
  blueskyProfileStatusesV2Route,
  blueskyProfileV2Route,
  blueskySearchV2Route,
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

  c.status(processedResponse.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(processedResponse, processedResponse.code as 200 | 404 | 500);
};

export const blueskyStatusRepostsAPIRequest: RouteHandler<
  typeof blueskyStatusRepostsV2Route
> = async c => {
  const { handle, rkey } = c.req.valid('param');
  const query = c.req.valid('query');
  const count = query.count ?? 20;
  const cursor = query.cursor ?? null;

  const response = await blueskyStatusRepostsAPI(handle, rkey, { count, cursor }, c);

  c.status(response.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(response, response.code as 200 | 404 | 500);
};

export const blueskyStatusLikesAPIRequest: RouteHandler<
  typeof blueskyStatusLikesV2Route
> = async c => {
  const { handle, rkey } = c.req.valid('param');
  const query = c.req.valid('query');
  const count = query.count ?? 20;
  const cursor = query.cursor ?? null;

  const response = await blueskyStatusLikesAPI(handle, rkey, { count, cursor }, c);

  c.status(response.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(response, response.code as 200 | 404 | 500);
};

export const blueskyThreadAPIRequest: RouteHandler<typeof blueskyThreadV2Route> = async c => {
  const { handle, rkey } = c.req.valid('param');
  const { lang } = c.req.valid('query');
  const processedResponse = await constructBlueskyThread(rkey, handle, true, c, lang);

  c.status(processedResponse.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(processedResponse, processedResponse.code as 200 | 404 | 500);
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
  c.status(processedResponse.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(processedResponse, processedResponse.code as 200 | 404 | 500);
};

export const blueskyProfileAPIRequest: RouteHandler<typeof blueskyProfileV2Route> = async c => {
  const { handle } = c.req.valid('param');
  const processedResponse = await blueskyUserProfileAPI(handle, c);

  c.status(processedResponse.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(processedResponse, processedResponse.code as 200 | 404 | 500);
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

  c.status(searchResponse.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(searchResponse, searchResponse.code as 200 | 404 | 500);
};

export const blueskyProfileFollowersAPIRequest: RouteHandler<
  typeof blueskyProfileFollowersV2Route
> = async c => {
  const { handle } = c.req.valid('param');
  const query = c.req.valid('query');
  const count = query.count ?? 20;
  const cursor = query.cursor ?? null;

  const response = await blueskyProfileFollowersAPI(handle, { count, cursor }, c);

  c.status(response.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(response, response.code as 200 | 404 | 500);
};

export const blueskyProfileFollowingAPIRequest: RouteHandler<
  typeof blueskyProfileFollowingV2Route
> = async c => {
  const { handle } = c.req.valid('param');
  const query = c.req.valid('query');
  const count = query.count ?? 20;
  const cursor = query.cursor ?? null;

  const response = await blueskyProfileFollowingAPI(handle, { count, cursor }, c);

  c.status(response.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(response, response.code as 200 | 404 | 500);
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

  c.status(mediaResponse.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(mediaResponse, mediaResponse.code as 200 | 404 | 500);
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

  c.status(likesResponse.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(likesResponse, likesResponse.code as 200 | 401 | 404 | 500);
};

export const blueskyProfileStatusesAPIRequest: RouteHandler<
  typeof blueskyProfileStatusesV2Route
> = async c => {
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
      return c.body(null, 204);
    }
  }

  c.status(statusesResponse.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(statusesResponse, statusesResponse.code as 200 | 404 | 500);
};
