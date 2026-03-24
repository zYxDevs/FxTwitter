import { constructTwitterThread } from '../../../providers/twitter/conversation';
import { Constants } from '../../../constants';
import { userAPI } from '../../../providers/twitter/profile';
import { attachAboutAccountData } from '../../../providers/twitter/aboutAccount';
import { searchAPI } from '../../../providers/twitter/search';
import { profileStatusesAPI } from '../../../providers/twitter/userStatuses';
import {
  isPublicExploreTimelineKind,
  PUBLIC_EXPLORE_TIMELINE_KINDS,
  trendsAPI
} from '../../../providers/twitter/trends';
import { ContentfulStatusCode } from 'hono/utils/http-status';
import { Context } from 'hono';
import { isParamTruthy } from '../../../helpers/utils';
import type { RouteHandler } from '@hono/zod-openapi';
import {
  profileStatusesV2Route,
  profileV2Route,
  searchV2Route,
  statusV2Route,
  threadV2Route,
  trendsV2Route
} from '../routes';

const shouldIncludeAboutAccount = (c: Context) => {
  return isParamTruthy(c.req.query('about_account') ?? c.req.query('aboutAccount'));
};

export const statusAPIRequest: RouteHandler<typeof statusV2Route> = async c => {
  const { id } = c.req.valid('param');

  let processedResponse = await constructTwitterThread(id, false, c, undefined, undefined);
  if (processedResponse.code === 200 && shouldIncludeAboutAccount(c)) {
    processedResponse = await attachAboutAccountData(c, processedResponse);
  }

  c.status(processedResponse.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(processedResponse, processedResponse.code as 200 | 401 | 404 | 500);
};

export const threadAPIRequest: RouteHandler<typeof threadV2Route> = async c => {
  const { id } = c.req.valid('param');

  let processedResponse = await constructTwitterThread(id, true, c, undefined);
  if (processedResponse.code === 200 && shouldIncludeAboutAccount(c)) {
    processedResponse = await attachAboutAccountData(c, processedResponse);
  }

  c.status(processedResponse.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(processedResponse, processedResponse.code as 200 | 401 | 404 | 500);
};

export const profileAPIRequest: RouteHandler<typeof profileV2Route> = async c => {
  const { handle } = c.req.valid('param');

  const profileResponse = await userAPI(handle, c);

  c.status(profileResponse.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(profileResponse, profileResponse.code as 200 | 404);
};

export const profileStatusesAPIRequest: RouteHandler<typeof profileStatusesV2Route> = async c => {
  const { handle } = c.req.valid('param');
  const query = c.req.valid('query');

  const count = query.count ?? 20;
  const cursor = query.cursor ?? null;

  const statusesResponse = await profileStatusesAPI(handle, count, cursor, c);

  c.status(statusesResponse.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(statusesResponse, statusesResponse.code as 200 | 404 | 500);
};

export const searchAPIRequest: RouteHandler<typeof searchV2Route> = async c => {
  const query = c.req.valid('query');
  const q = query.q;

  if (!q) {
    c.status(400);
    for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
      c.header(header, value);
    }
    return c.json({ code: 400 as const, message: 'Missing required query parameter: q' }, 400);
  }

  const feed = query.feed ?? 'latest';
  const count = query.count ?? 30;
  const cursor = query.cursor ?? null;

  const searchResponse = await searchAPI(q, feed, count, cursor, c);

  c.status(searchResponse.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(searchResponse, searchResponse.code as 200 | 404 | 500);
};

export const trendsAPIRequest: RouteHandler<typeof trendsV2Route> = async c => {
  const query = c.req.valid('query');
  const rawType = query.type ?? 'trending';
  if (!isPublicExploreTimelineKind(rawType)) {
    c.status(400);
    for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
      c.header(header, value);
    }
    return c.json(
      {
        code: 400 as const,
        message: `Invalid type parameter. Supported values: ${PUBLIC_EXPLORE_TIMELINE_KINDS.join(', ')}`,
        timeline_type: rawType,
        trends: [],
        cursor: { top: null, bottom: null }
      },
      400
    );
  }

  const count = query.count ?? 20;

  const trendsResponse = await trendsAPI(c, rawType, count);

  c.status(trendsResponse.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(trendsResponse, trendsResponse.code as 200 | 404 | 500);
};
