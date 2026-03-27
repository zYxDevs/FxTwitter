import { createRoute, z } from '@hono/zod-openapi';
import {
  PUBLIC_EXPLORE_TIMELINE_KINDS,
  type PublicExploreTimelineKind
} from '../../providers/twitter/trends';
import {
  APISearchResultsSchema,
  APITrendsResponseSchema,
  ApiQueryErrorSchema,
  SocialConversationSchema,
  SocialThreadSchema,
  UserAPIResponseSchema
} from './schemas';

const aboutAccountQuery = z.object({
  about_account: z.string().optional().openapi({
    description: 'If truthy, include `about_account` on author when available',
    example: '1'
  }),
  aboutAccount: z.string().optional().openapi({
    description: 'Alias for about_account'
  })
});

export const statusV2Route = createRoute({
  method: 'get',
  path: '/2/status/{id}',
  summary: 'Get a single post',
  description:
    'Returns one X/Twitter post by snowflake ID. Optional `about_account` / `aboutAccount` adds account metadata when present.',
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'Tweet/post snowflake ID', example: '20' })
    }),
    query: aboutAccountQuery
  },
  responses: {
    200: {
      description: 'Post payload (check `code` for upstream errors mirrored as HTTP status)',
      content: { 'application/json': { schema: SocialThreadSchema } }
    },
    400: {
      description: 'Invalid path or query parameters',
      content: { 'application/json': { schema: ApiQueryErrorSchema } }
    },
    401: {
      description: 'Private or unavailable post',
      content: { 'application/json': { schema: SocialThreadSchema } }
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: SocialThreadSchema } }
    },
    500: {
      description: 'Server or upstream failure',
      content: { 'application/json': { schema: SocialThreadSchema } }
    }
  }
});

export const threadV2Route = createRoute({
  method: 'get',
  path: '/2/thread/{id}',
  summary: 'Get a post and its reply thread',
  description:
    'Same as `/2/status/{id}` but includes the conversation thread when available. Supports `about_account` / `aboutAccount`.',
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'Root tweet/post snowflake ID' })
    }),
    query: aboutAccountQuery
  },
  responses: {
    200: {
      description: 'Thread payload',
      content: { 'application/json': { schema: SocialThreadSchema } }
    },
    400: {
      description: 'Invalid path or query parameters',
      content: { 'application/json': { schema: ApiQueryErrorSchema } }
    },
    401: {
      description: 'Private or unavailable',
      content: { 'application/json': { schema: SocialThreadSchema } }
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: SocialThreadSchema } }
    },
    500: {
      description: 'Server or upstream failure',
      content: { 'application/json': { schema: SocialThreadSchema } }
    }
  }
});

export const conversationV2Route = createRoute({
  method: 'get',
  path: '/2/conversation/{id}',
  summary: 'Get a post with its full thread and replies',
  description:
    'Returns a post, its full thread chain (walking all the way to the root), and replies from other users. Replies are sorted by the chosen ranking mode (default: Likes). Use the returned bottom cursor to paginate through more replies.',
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'Focal tweet/post snowflake ID' })
    }),
    query: z.object({
      ranking_mode: z.enum(['likes', 'recency']).optional().openapi({
        description: 'How replies are ranked (default: likes)',
        default: 'likes'
      }),
      cursor: z.string().optional().openapi({
        description: 'Pagination cursor from a prior response'
      }),
      ...aboutAccountQuery.shape
    })
  },
  responses: {
    200: {
      description: 'Conversation payload with thread, replies, and pagination cursor',
      content: { 'application/json': { schema: SocialConversationSchema } }
    },
    400: {
      description: 'Invalid path or query parameters',
      content: { 'application/json': { schema: ApiQueryErrorSchema } }
    },
    401: {
      description: 'Private or unavailable post',
      content: { 'application/json': { schema: SocialConversationSchema } }
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: SocialConversationSchema } }
    },
    500: {
      description: 'Server or upstream failure',
      content: { 'application/json': { schema: SocialConversationSchema } }
    }
  }
});

export const profileV2Route = createRoute({
  method: 'get',
  path: '/2/profile/{handle}',
  summary: 'Get user profile',
  request: {
    params: z.object({
      handle: z.string().openapi({ description: 'Username without @', example: 'X' })
    }),
    query: aboutAccountQuery
  },
  responses: {
    200: {
      description: 'Profile (check `code`)',
      content: { 'application/json': { schema: UserAPIResponseSchema } }
    },
    400: {
      description: 'Invalid path or query parameters',
      content: { 'application/json': { schema: ApiQueryErrorSchema } }
    },
    404: {
      description: 'User not found',
      content: { 'application/json': { schema: UserAPIResponseSchema } }
    }
  }
});

export const profileStatusesV2Route = createRoute({
  method: 'get',
  path: '/2/profile/{handle}/statuses',
  summary: 'List posts for a user',
  request: {
    params: z.object({
      handle: z.string().openapi({ description: 'Username without @' })
    }),
    query: z.object({
      count: z.coerce.number().int().min(1).max(100).optional().openapi({
        description: 'Page size (default 20)',
        default: 20
      }),
      cursor: z
        .string()
        .optional()
        .openapi({ description: 'Pagination cursor from prior response' })
    })
  },
  responses: {
    200: {
      description: 'Timeline page',
      content: { 'application/json': { schema: APISearchResultsSchema } }
    },
    400: {
      description: 'Invalid path or query parameters (e.g. `count` out of range)',
      content: { 'application/json': { schema: ApiQueryErrorSchema } }
    },
    404: {
      description: 'User not found or empty timeline',
      content: { 'application/json': { schema: APISearchResultsSchema } }
    },
    500: {
      description: 'Upstream or processing error',
      content: { 'application/json': { schema: APISearchResultsSchema } }
    }
  }
});

export const searchV2Route = createRoute({
  method: 'get',
  path: '/2/search',
  summary: 'Search posts',
  request: {
    query: z.object({
      q: z.string().min(1).openapi({ description: 'Search query (non-empty)', example: 'neo' }),
      feed: z.enum(['latest', 'top', 'media']).optional().openapi({
        description: 'Search tab (default latest)',
        default: 'latest'
      }),
      count: z.coerce.number().int().min(1).max(100).optional().openapi({
        description: 'Page size (default 30)',
        default: 30
      }),
      cursor: z.string().optional()
    })
  },
  responses: {
    200: {
      description: 'Search results',
      content: { 'application/json': { schema: APISearchResultsSchema } }
    },
    400: {
      description: 'Invalid `q` parameter',
      content: { 'application/json': { schema: ApiQueryErrorSchema } }
    },
    404: {
      description: 'No results or timeline unavailable',
      content: { 'application/json': { schema: APISearchResultsSchema } }
    },
    500: {
      description: 'Upstream or processing error',
      content: { 'application/json': { schema: APISearchResultsSchema } }
    }
  }
});

const trendsTypeDescription = `Explore timeline kind. Supported: ${PUBLIC_EXPLORE_TIMELINE_KINDS.join(', ')}`;

export const trendsV2Route = createRoute({
  method: 'get',
  path: '/2/trends',
  summary: 'Trending topics',
  request: {
    query: z.object({
      type: z
        .enum(
          PUBLIC_EXPLORE_TIMELINE_KINDS as [
            PublicExploreTimelineKind,
            ...PublicExploreTimelineKind[]
          ]
        )
        .optional()
        .openapi({
          description: trendsTypeDescription,
          default: 'trending',
          example: 'trending'
        }),
      count: z.coerce.number().int().min(1).max(50).optional().openapi({
        description: 'Number of trends (default 20, max 50)',
        default: 20
      })
    })
  },
  responses: {
    200: {
      description: 'Trends payload',
      content: { 'application/json': { schema: APITrendsResponseSchema } }
    },
    400: {
      description: 'Invalid query parameters (e.g. `type` or `count` out of allowed range)',
      content: { 'application/json': { schema: ApiQueryErrorSchema } }
    },
    404: {
      description: 'Trends unavailable',
      content: { 'application/json': { schema: APITrendsResponseSchema } }
    },
    500: {
      description: 'Upstream or processing error',
      content: { 'application/json': { schema: APITrendsResponseSchema } }
    }
  }
});
