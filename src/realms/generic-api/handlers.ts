import type { RouteHandler } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { ContentfulStatusCode } from 'hono/utils/http-status';
import { Constants } from '../../constants';
import type { APISearchResultsMastodon } from '../api/schemas';
import { isParamTruthy } from '../../helpers/utils';
import {
  constructMastodonConversation,
  constructMastodonThread
} from '../../providers/mastodon/conversation';
import { mastodonUserProfileAPI } from '../../providers/mastodon/profile';
import {
  mastodonProfileFollowersAPI,
  mastodonProfileFollowingAPI
} from '../../providers/mastodon/profileFollowers';
import {
  mastodonProfileMediaAPI,
  mastodonProfileStatusesAPI
} from '../../providers/mastodon/profileStatuses';
import { mastodonSearchAPI } from '../../providers/mastodon/search';
import { mastodonStatusLikesAPI } from '../../providers/mastodon/statusLikes';
import { mastodonStatusRepostsAPI } from '../../providers/mastodon/statusReposts';
import type {
  mastodonConversationV2Route,
  mastodonProfileFollowersV2Route,
  mastodonProfileFollowingV2Route,
  mastodonProfileMediaV2Route,
  mastodonProfileStatusesV2Route,
  mastodonProfileV2Route,
  mastodonSearchV2Route,
  mastodonStatusLikesV2Route,
  mastodonStatusRepostsV2Route,
  mastodonStatusV2Route,
  mastodonThreadV2Route
} from './routes';

const setApiHeaders = (c: Context, options?: { skipContentType?: boolean }) => {
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    if (options?.skipContentType && header.toLowerCase() === 'content-type') {
      continue;
    }
    c.header(header, value);
  }
};

export const mastodonStatusAPIRequest: RouteHandler<typeof mastodonStatusV2Route> = async c => {
  const { domain, id } = c.req.valid('param');
  const { lang } = c.req.valid('query');
  const processedResponse = await constructMastodonThread(id, domain, false, c, lang);
  c.status(processedResponse.code as ContentfulStatusCode);
  setApiHeaders(c);
  return c.json(processedResponse, processedResponse.code as 200 | 404 | 500);
};

export const mastodonStatusRepostsAPIRequest: RouteHandler<
  typeof mastodonStatusRepostsV2Route
> = async c => {
  const { domain, id } = c.req.valid('param');
  const query = c.req.valid('query');
  const response = await mastodonStatusRepostsAPI(
    id,
    domain,
    {
      count: query.count ?? 20,
      cursor: query.cursor ?? null
    },
    c
  );
  c.status(response.code as ContentfulStatusCode);
  setApiHeaders(c);
  return c.json(response, response.code as 200 | 401 | 404 | 500);
};

export const mastodonStatusLikesAPIRequest: RouteHandler<
  typeof mastodonStatusLikesV2Route
> = async c => {
  const { domain, id } = c.req.valid('param');
  const query = c.req.valid('query');
  const response = await mastodonStatusLikesAPI(
    id,
    domain,
    {
      count: query.count ?? 20,
      cursor: query.cursor ?? null
    },
    c
  );
  c.status(response.code as ContentfulStatusCode);
  setApiHeaders(c);
  return c.json(response, response.code as 200 | 401 | 404 | 500);
};

export const mastodonThreadAPIRequest: RouteHandler<typeof mastodonThreadV2Route> = async c => {
  const { domain, id } = c.req.valid('param');
  const { lang } = c.req.valid('query');
  const processedResponse = await constructMastodonThread(id, domain, true, c, lang);
  c.status(processedResponse.code as ContentfulStatusCode);
  setApiHeaders(c);
  return c.json(processedResponse, processedResponse.code as 200 | 404 | 500);
};

export const mastodonConversationAPIRequest: RouteHandler<
  typeof mastodonConversationV2Route
> = async c => {
  const { domain, id } = c.req.valid('param');
  const query = c.req.valid('query');
  const result = await constructMastodonConversation(id, domain, c, {
    rankingMode: query.ranking_mode ?? 'likes',
    cursor: query.cursor ?? null,
    count: query.count ?? 20,
    language: query.lang
  });
  if (!result.ok) {
    setApiHeaders(c);
    return c.json({ code: 400 as const, message: result.message }, 400);
  }
  const processedResponse = result.data;
  c.status(processedResponse.code as ContentfulStatusCode);
  setApiHeaders(c);
  return c.json(processedResponse, processedResponse.code as 200 | 404 | 500);
};

export const mastodonSearchAPIRequest: RouteHandler<typeof mastodonSearchV2Route> = async c => {
  const { domain } = c.req.valid('param');
  const query = c.req.valid('query');
  const searchResponse = await mastodonSearchAPI(domain, c, {
    q: query.q,
    feed: query.feed ?? 'latest',
    count: query.count ?? 30,
    cursor: query.cursor ?? null,
    language: query.lang
  });
  c.status(searchResponse.code as ContentfulStatusCode);
  setApiHeaders(c);
  return c.json(searchResponse, searchResponse.code as 200 | 401 | 404 | 500);
};

export const mastodonProfileAPIRequest: RouteHandler<typeof mastodonProfileV2Route> = async c => {
  const { domain, handle } = c.req.valid('param');
  const processedResponse = await mastodonUserProfileAPI(handle, domain, c);
  c.status(processedResponse.code as ContentfulStatusCode);
  setApiHeaders(c);
  return c.json(processedResponse, processedResponse.code as 200 | 404);
};

export const mastodonProfileFollowersAPIRequest: RouteHandler<
  typeof mastodonProfileFollowersV2Route
> = async c => {
  const { domain, handle } = c.req.valid('param');
  const query = c.req.valid('query');
  const response = await mastodonProfileFollowersAPI(
    handle,
    domain,
    {
      count: query.count ?? 20,
      cursor: query.cursor ?? null
    },
    c
  );
  c.status(response.code as ContentfulStatusCode);
  setApiHeaders(c);
  return c.json(response, response.code as 200 | 404 | 500);
};

export const mastodonProfileFollowingAPIRequest: RouteHandler<
  typeof mastodonProfileFollowingV2Route
> = async c => {
  const { domain, handle } = c.req.valid('param');
  const query = c.req.valid('query');
  const response = await mastodonProfileFollowingAPI(
    handle,
    domain,
    {
      count: query.count ?? 20,
      cursor: query.cursor ?? null
    },
    c
  );
  c.status(response.code as ContentfulStatusCode);
  setApiHeaders(c);
  return c.json(response, response.code as 200 | 404 | 500);
};

export const mastodonProfileMediaAPIRequest: RouteHandler<
  typeof mastodonProfileMediaV2Route
> = async c => {
  const { domain, handle } = c.req.valid('param');
  const query = c.req.valid('query');
  const mediaResponse = await mastodonProfileMediaAPI(
    handle,
    domain,
    {
      count: query.count ?? 20,
      cursor: query.cursor ?? null,
      language: query.lang
    },
    c
  );
  c.status(mediaResponse.code as ContentfulStatusCode);
  setApiHeaders(c);
  return c.json(mediaResponse, mediaResponse.code as 200 | 404 | 500);
};

export const mastodonProfileStatusesAPIRequest: RouteHandler<
  typeof mastodonProfileStatusesV2Route
> = async c => {
  const { domain, handle } = c.req.valid('param');
  const query = c.req.valid('query');
  const withReplies = isParamTruthy(query.with_replies ?? c.req.query('withReplies'));

  const statusesResponse = await mastodonProfileStatusesAPI(
    handle,
    domain,
    {
      count: query.count ?? 20,
      cursor: query.cursor ?? null,
      withReplies,
      language: query.lang,
      since: query.since
    },
    c
  );

  if ('noContent' in statusesResponse && statusesResponse.noContent) {
    c.status(204);
    setApiHeaders(c, { skipContentType: true });
    return c.body(null, 204);
  }

  const body = statusesResponse as APISearchResultsMastodon;
  c.status(body.code as ContentfulStatusCode);
  setApiHeaders(c);
  return c.json(body, body.code as 200 | 404 | 500);
};
