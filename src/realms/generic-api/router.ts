import { OpenAPIHono } from '@hono/zod-openapi';
import { trimTrailingSlash } from 'hono/trailing-slash';
import { Constants } from '../../constants';
import { Strings } from '../../strings';
import { apiOpenapiValidationHook } from '../api/openapi-validation-hook';
import {
  mastodonConversationAPIRequest,
  mastodonProfileAPIRequest,
  mastodonProfileFollowersAPIRequest,
  mastodonProfileFollowingAPIRequest,
  mastodonProfileMediaAPIRequest,
  mastodonProfileStatusesAPIRequest,
  mastodonSearchAPIRequest,
  mastodonStatusAPIRequest,
  mastodonStatusLikesAPIRequest,
  mastodonStatusRepostsAPIRequest,
  mastodonThreadAPIRequest
} from './handlers';
import {
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

export const genericApi = new OpenAPIHono({ defaultHook: apiOpenapiValidationHook });

genericApi.use('*', async (c, next) => {
  if (!c.req.header('user-agent')) {
    return c.json(
      {
        error:
          "You must identify yourself with a User-Agent header in order to use the FxEmbed generic API. We recommend using a descriptive User-Agent header to identify your app, such as 'MyAwesomeBot/1.0 (+http://example.com/myawesomebot)'."
      },
      401
    );
  }
  await next();
});

genericApi.use(trimTrailingSlash());

genericApi.openapi(mastodonStatusV2Route, mastodonStatusAPIRequest);
genericApi.openapi(mastodonStatusRepostsV2Route, mastodonStatusRepostsAPIRequest);
genericApi.openapi(mastodonStatusLikesV2Route, mastodonStatusLikesAPIRequest);
genericApi.openapi(mastodonThreadV2Route, mastodonThreadAPIRequest);
genericApi.openapi(mastodonConversationV2Route, mastodonConversationAPIRequest);
genericApi.openapi(mastodonSearchV2Route, mastodonSearchAPIRequest);
genericApi.openapi(mastodonProfileV2Route, mastodonProfileAPIRequest);
genericApi.openapi(mastodonProfileFollowersV2Route, mastodonProfileFollowersAPIRequest);
genericApi.openapi(mastodonProfileFollowingV2Route, mastodonProfileFollowingAPIRequest);
genericApi.openapi(mastodonProfileMediaV2Route, mastodonProfileMediaAPIRequest);
genericApi.openapi(mastodonProfileStatusesV2Route, mastodonProfileStatusesAPIRequest);

genericApi.doc('/2/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'FxEmbed generic API',
    version: '2.0.0',
    description:
      'Multi-provider JSON API (Mastodon / ActivityPub instances). Paths are prefixed with `/2/mastodon/{instance}/…`.'
  },
  servers: Constants.GENERIC_API_HOST_ROOT
    ? [
        {
          url: Constants.GENERIC_API_HOST_ROOT,
          description: 'FxEmbed generic API host'
        }
      ]
    : []
});

genericApi.get('/robots.txt', async c => c.text(Strings.ROBOTS_TXT_API));

genericApi.all('*', async c => c.json({ code: 404, message: 'Not found' }, 404));
