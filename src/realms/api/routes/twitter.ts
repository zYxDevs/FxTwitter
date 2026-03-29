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
import { profileMediaAPI, profileStatusesAPI } from '../../../providers/twitter/userStatuses';
import { trendsAPI } from '../../../providers/twitter/trends';
import { typeaheadAPI } from '../../../providers/twitter/typeahead';
import { ContentfulStatusCode } from 'hono/utils/http-status';
import { Context } from 'hono';
import { isParamTruthy } from '../../../helpers/utils';
import type { RouteHandler } from '@hono/zod-openapi';
import {
  conversationV2Route,
  profileMediaV2Route,
  profileAboutV2Route,
  profileStatusesV2Route,
  profileV2Route,
  searchV2Route,
  statusV2Route,
  threadV2Route,
  trendsV2Route,
  typeaheadV2Route
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

  const processedResponse = await constructTwitterConversation(id, c, rankingMode, cursor);

  c.status(processedResponse.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(processedResponse, processedResponse.code as 200 | 401 | 404 | 500);
};

export const profileAPIRequest: RouteHandler<typeof profileV2Route> = async c => {
  const { handle } = c.req.valid('param');
  const parsed = parseHandleOrId(handle);

  const profileResponse =
    parsed.type === 'userId'
      ? await userAPIById(parsed.value, c, false, shouldIncludeAboutAccount(c))
      : await userAPI(parsed.value, c, false, shouldIncludeAboutAccount(c));

  c.status(profileResponse.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(profileResponse, profileResponse.code as 200 | 404);
};

export const profileAboutAPIRequest: RouteHandler<typeof profileAboutV2Route> = async c => {
  const { handle } = c.req.valid('param');
  const aboutResponse = await profileAboutAPI(handle, c);

  c.status(aboutResponse.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(aboutResponse, aboutResponse.code as 200 | 404);
};

export const profileStatusesAPIRequest: RouteHandler<typeof profileStatusesV2Route> = async c => {
  const { handle } = c.req.valid('param');
  const query = c.req.valid('query');

  const count = query.count ?? 20;
  const cursor = query.cursor ?? null;
  const withReplies = isParamTruthy(query.with_replies ?? c.req.query('withReplies'));

  const statusesResponse = await profileStatusesAPI(
    parseHandleOrId(handle),
    count,
    cursor,
    c,
    withReplies
  );

  c.status(statusesResponse.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(statusesResponse, statusesResponse.code as 200 | 404 | 500);
};

export const profileMediaAPIRequest: RouteHandler<typeof profileMediaV2Route> = async c => {
  const { handle } = c.req.valid('param');
  const query = c.req.valid('query');

  const count = query.count ?? 20;
  const cursor = query.cursor ?? null;

  const mediaResponse = await profileMediaAPI(parseHandleOrId(handle), count, cursor, c);

  c.status(mediaResponse.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(mediaResponse, mediaResponse.code as 200 | 404 | 500);
};

export const searchAPIRequest: RouteHandler<typeof searchV2Route> = async c => {
  const query = c.req.valid('query');
  const q = query.q;

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
  const type = query.type ?? 'trending';
  const count = query.count ?? 20;

  const trendsResponse = await trendsAPI(c, type, count);

  c.status(trendsResponse.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(trendsResponse, trendsResponse.code as 200 | 404 | 500);
};

export const typeaheadAPIRequest: RouteHandler<typeof typeaheadV2Route> = async c => {
  const query = c.req.valid('query');
  const response = await typeaheadAPI(query.q, c, {
    resultType: query.result_type,
    src: query.src
  });

  c.status(response.code as ContentfulStatusCode);
  for (const [header, value] of Object.entries(Constants.API_RESPONSE_HEADERS)) {
    c.header(header, value);
  }
  return c.json(response, response.code as 200 | 404 | 500);
};
