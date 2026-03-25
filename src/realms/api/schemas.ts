/**
 * Zod + OpenAPI schemas for FxTwitter API v2 JSON responses.
 * Exported `z.infer` types are the canonical shapes for shared API fields (including `APITwitterStatus`).
 */
import { z } from '@hono/zod-openapi';

const indicesTuple = z
  .tuple([z.number(), z.number()])
  .openapi({ description: 'Start and end UTF-16 indices' });

export const APIFacetSchema = z.object({
  type: z.string(),
  indices: indicesTuple,
  original: z.string().optional(),
  replacement: z.string().optional(),
  display: z.string().optional(),
  id: z.string().optional()
});

export const APITranslateSchema = z.object({
  text: z.string(),
  source_lang: z.string(),
  source_lang_en: z.string(),
  target_lang: z.string(),
  provider: z.string()
});

export const APIPollChoiceSchema = z.object({
  label: z.string(),
  count: z.number(),
  percentage: z.number()
});

export const APIPollSchema = z.object({
  choices: z.array(APIPollChoiceSchema),
  total_votes: z.number(),
  ends_at: z.string(),
  time_left_en: z.string()
});

export const TweetMediaVariantSchema = z.object({
  bitrate: z.number(),
  content_type: z.string(),
  url: z.string()
});

export const APIVideoFormatSchema = z.object({
  container: z.enum(['mp4', 'webm', 'm3u8']).optional(),
  codec: z.enum(['h264', 'hevc', 'vp9', 'av1']).optional(),
  bitrate: z.number().optional(),
  url: z.string(),
  size: z.number().optional(),
  height: z.number().optional(),
  width: z.number().optional()
});

export const APIMediaBaseSchema = z.object({
  id: z.string().optional(),
  format: z.string().optional(),
  type: z.enum(['photo', 'video', 'gif']),
  url: z.string(),
  width: z.number(),
  height: z.number()
});

export const APIPhotoSchema = z.object({
  id: z.string().optional(),
  format: z.string().optional(),
  type: z.enum(['photo']),
  url: z.string(),
  width: z.number(),
  height: z.number(),
  transcode_url: z.string().optional(),
  altText: z.string().optional()
});

export const APIVideoSchema = z.object({
  id: z.string().optional(),
  format: z.string().optional(),
  type: z.enum(['video', 'gif']),
  url: z.string(),
  width: z.number(),
  height: z.number(),
  thumbnail_url: z.string(),
  duration: z.number(),
  filesize: z.number().optional(),
  variants: z.array(TweetMediaVariantSchema).optional(),
  formats: z.array(APIVideoFormatSchema)
});

export const APIExternalMediaSchema = z.object({
  type: z.literal('video'),
  url: z.string(),
  thumbnail_url: z.string().optional(),
  height: z.number().optional(),
  width: z.number().optional()
});

export const APIMosaicPhotoSchema = z.object({
  id: z.string().optional(),
  format: z.string().optional(),
  type: z.literal('mosaic_photo'),
  url: z.string(),
  width: z.number(),
  height: z.number(),
  formats: z.object({
    webp: z.string(),
    jpeg: z.string()
  })
});

export const APIBroadcastSchema = z.object({
  url: z.string(),
  width: z.number(),
  height: z.number(),
  state: z.enum(['LIVE', 'ENDED']),
  broadcaster: z.object({
    username: z.string(),
    display_name: z.string(),
    id: z.string()
  }),
  stream: z.object({ url: z.string() }).optional(),
  title: z.string(),
  source: z.string(),
  orientation: z.enum(['landscape', 'portrait']),
  broadcast_id: z.string(),
  media_id: z.string(),
  media_key: z.string(),
  is_high_latency: z.boolean(),
  thumbnail: z.object({
    original: z.object({ url: z.string() }),
    small: z.object({ url: z.string() }).optional(),
    medium: z.object({ url: z.string() }).optional(),
    large: z.object({ url: z.string() }).optional(),
    x_large: z.object({ url: z.string() }).optional()
  })
});

export const APIMediaContainerSchema = z.object({
  external: APIExternalMediaSchema.optional(),
  photos: z.array(APIPhotoSchema).optional(),
  videos: z.array(APIVideoSchema).optional(),
  all: z
    .array(
      z.union([
        APIPhotoSchema,
        APIVideoSchema,
        APIMosaicPhotoSchema,
        z.object({
          id: z.string().optional(),
          format: z.string().optional(),
          type: z.string(),
          url: z.string(),
          width: z.number(),
          height: z.number()
        })
      ])
    )
    .optional(),
  mosaic: APIMosaicPhotoSchema.optional(),
  broadcast: APIBroadcastSchema.optional()
});

export const APIUserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    screen_name: z.string(),
    avatar_url: z.string().nullable(),
    banner_url: z.string().nullable(),
    description: z.string(),
    location: z.string(),
    url: z.string(),
    protected: z.boolean(),
    followers: z.number(),
    following: z.number(),
    statuses: z.number(),
    media_count: z.number(),
    likes: z.number(),
    joined: z.string(),
    website: z
      .object({
        url: z.string(),
        display_url: z.string()
      })
      .nullable(),
    birthday: z.object({
      day: z.number().optional(),
      month: z.number().optional(),
      year: z.number().optional()
    }),
    verification: z
      .object({
        verified: z.boolean(),
        type: z.enum(['organization', 'government', 'individual']).nullable(),
        verified_at: z.string().nullable().optional(),
        identity_verified: z.boolean().optional()
      })
      .optional(),
    about_account: z
      .object({
        based_in: z.string().nullable().optional(),
        location_accurate: z.boolean().optional(),
        created_country_accurate: z.boolean().nullable().optional(),
        source: z.string().nullable().optional(),
        username_changes: z
          .object({
            count: z.number(),
            last_changed_at: z.string().nullable()
          })
          .optional()
      })
      .optional()
  })
  .openapi('APIUser');

export const APITwitterCommunitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  created_at: z.string(),
  search_tags: z.array(z.string()),
  is_nsfw: z.boolean(),
  topic: z.string().nullable(),
  admin: APIUserSchema.nullable().optional(),
  creator: APIUserSchema.nullable().optional(),
  join_policy: z.enum(['Open', 'Closed']),
  invites_policy: z.enum(['MemberInvitesAllowed', 'MemberInvitesDisabled']),
  is_pinned: z.boolean()
});

export const APITwitterCommunityNoteSchema = z.object({
  text: z.string(),
  entities: z.array(z.record(z.string(), z.unknown()))
});

/** Twitter GraphQL media entity — shape varies; kept loose for OpenAPI. */
export const TwitterApiMediaLooseSchema = z.record(z.string(), z.unknown());

export const TwitterArticleSchema = z.object({
  created_at: z.string(),
  modified_at: z.string().optional(),
  id: z.string(),
  title: z.string(),
  preview_text: z.string(),
  cover_media: TwitterApiMediaLooseSchema,
  content: z.record(z.string(), z.unknown()),
  media_entities: z.array(TwitterApiMediaLooseSchema)
});

/** Explicit recursive output type so consumers are not stuck with `unknown` from `z.ZodTypeAny` + `z.lazy`. */
export type APITwitterStatus = {
  id: string;
  url: string;
  text: string;
  created_at: string;
  created_timestamp: number;
  likes: number;
  reposts: number;
  replies: number;
  quote?: APITwitterStatus;
  poll?: z.infer<typeof APIPollSchema>;
  author: z.infer<typeof APIUserSchema>;
  media: z.infer<typeof APIMediaContainerSchema>;
  raw_text: {
    text: string;
    facets: z.infer<typeof APIFacetSchema>[];
  };
  lang: string | null;
  translation?: z.infer<typeof APITranslateSchema>;
  possibly_sensitive: boolean;
  replying_to: {
    screen_name: string;
    post: string;
  } | null;
  source: string | null;
  embed_card: 'tweet' | 'summary' | 'summary_large_image' | 'player';
  provider: 'twitter';
  views?: number | null;
  bookmarks?: number | null;
  community?: z.infer<typeof APITwitterCommunitySchema>;
  article?: z.infer<typeof TwitterArticleSchema>;
  is_note_tweet: boolean;
  community_note: z.infer<typeof APITwitterCommunityNoteSchema> | null;
};

/* Self-referential `z.lazy` needs `z.ZodType<APITwitterStatus>` so output is not widened to `unknown`. */
export const APITwitterStatusSchema: z.ZodType<APITwitterStatus> = z
  .lazy(() =>
    z.object({
      id: z.string(),
      url: z.string(),
      text: z.string(),
      created_at: z.string(),
      created_timestamp: z.number(),
      likes: z.number(),
      reposts: z.number(),
      replies: z.number(),
      quote: APITwitterStatusSchema.optional(),
      poll: APIPollSchema.optional(),
      author: APIUserSchema,
      media: APIMediaContainerSchema,
      raw_text: z.object({
        text: z.string(),
        facets: z.array(APIFacetSchema)
      }),
      lang: z.string().nullable(),
      translation: APITranslateSchema.optional(),
      possibly_sensitive: z.boolean(),
      replying_to: z
        .object({
          screen_name: z.string(),
          post: z.string()
        })
        .nullable(),
      source: z.string().nullable(),
      embed_card: z.enum(['tweet', 'summary', 'summary_large_image', 'player']),
      provider: z.literal('twitter'),
      views: z.number().nullable().optional(),
      bookmarks: z.number().nullable().optional(),
      community: APITwitterCommunitySchema.optional(),
      article: TwitterArticleSchema.optional(),
      is_note_tweet: z.boolean(),
      community_note: APITwitterCommunityNoteSchema.nullable()
    })
  )
  .openapi('APITwitterStatus');

export const SocialThreadSchema = z
  .object({
    code: z.number().openapi({ description: 'HTTP-style status; mirrors response status code' }),
    status: APITwitterStatusSchema.nullable(),
    thread: z.array(APITwitterStatusSchema).nullable(),
    author: APIUserSchema.nullable()
  })
  .openapi('SocialThread');

export const UserAPIResponseSchema = z
  .object({
    code: z.number(),
    message: z.string(),
    user: APIUserSchema.optional()
  })
  .openapi('UserAPIResponse');

export const SearchCursorSchema = z.object({
  top: z.string().nullable(),
  bottom: z.string().nullable()
});

export const APISearchResultsSchema = z
  .object({
    code: z.number(),
    results: z.array(APITwitterStatusSchema),
    cursor: SearchCursorSchema
  })
  .openapi('APISearchResults');

export const APITrendGroupedTopicSchema = z.object({
  name: z.string(),
  url: z.string().nullable()
});

export const APITrendSchema = z.object({
  name: z.string(),
  rank: z.string().nullable(),
  context: z.string().nullable(),
  grouped_topics: z.array(APITrendGroupedTopicSchema).optional()
});

export const APITrendsResponseSchema = z
  .object({
    code: z.number(),
    message: z.string().optional(),
    timeline_type: z.string(),
    trends: z.array(APITrendSchema),
    cursor: SearchCursorSchema
  })
  .openapi('APITrendsResponse');

export const ApiQueryErrorSchema = z
  .object({
    code: z.literal(400),
    message: z.string()
  })
  .openapi('ApiQueryError');

export type APIFacet = z.infer<typeof APIFacetSchema>;
export type APITranslate = z.infer<typeof APITranslateSchema>;
export type APIPollChoice = z.infer<typeof APIPollChoiceSchema>;
export type APIPoll = z.infer<typeof APIPollSchema>;
export type APIVideoFormat = z.infer<typeof APIVideoFormatSchema>;
export type APIMedia = z.infer<typeof APIMediaBaseSchema>;
export type APIPhoto = z.infer<typeof APIPhotoSchema>;
export type APIVideo = z.infer<typeof APIVideoSchema>;
export type APIExternalMedia = z.infer<typeof APIExternalMediaSchema>;
export type APIMosaicPhoto = z.infer<typeof APIMosaicPhotoSchema>;
export type APIBroadcast = z.infer<typeof APIBroadcastSchema>;
export type APIUser = z.infer<typeof APIUserSchema>;
export type APITwitterCommunityNote = z.infer<typeof APITwitterCommunityNoteSchema>;
export type APITwitterCommunity = z.infer<typeof APITwitterCommunitySchema>;
export type UserAPIResponse = z.infer<typeof UserAPIResponseSchema>;
export type SearchCursor = z.infer<typeof SearchCursorSchema>;
export type APISearchResults = z.infer<typeof APISearchResultsSchema>;
export type APITrendGroupedTopic = z.infer<typeof APITrendGroupedTopicSchema>;
export type APITrend = z.infer<typeof APITrendSchema>;
export type APITrendsResponse = z.infer<typeof APITrendsResponseSchema>;
export type ApiQueryError = z.infer<typeof ApiQueryErrorSchema>;
