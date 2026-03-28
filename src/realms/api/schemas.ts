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
  type: z.enum(['photo', 'video', 'gif', 'mosaic_photo']),
  url: z.string(),
  transcode_url: z.string().optional().nullable(),
  width: z.number(),
  height: z.number()
});

export const APIPhotoSchema = z.object({
  id: z.string().optional(),
  format: z.string().optional(),
  type: z.enum(['photo', 'gif']),
  url: z.string(),
  width: z.number(),
  height: z.number(),
  transcode_url: z.string().optional().nullable(),
  altText: z.string().optional()
});

export const APIVideoSchema = z.object({
  id: z.string().optional(),
  format: z.string().optional(),
  type: z.enum(['video', 'gif']),
  url: z.string(),
  width: z.number(),
  height: z.number(),
  thumbnail_url: z.string().optional().nullable(),
  transcode_url: z.string().optional().nullable(),
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

/** Link preview from Twitter GraphQL (`summary_large_image`, `summary`, etc.). Exposed as `card` on `APITwitterStatus`. */
export const APICardSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  domain: z.string().optional(),
  card_name: z.string().optional(),
  image: z
    .object({
      width: z.number().optional(),
      height: z.number().optional(),
      url: z.string().optional(),
      alt: z.string().optional()
    })
    .optional()
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
    birthday: z
      .object({
        day: z.number().optional(),
        month: z.number().optional(),
        year: z.number().optional()
      })
      .nullable()
      .optional(),
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

/** User who reposted/retweeted this status (outer wrapper); null when the payload is the original post. */
export const APIRepostedBySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    screen_name: z.string(),
    avatar_url: z.string().nullable().optional(),
    url: z.string().optional()
  })
  .openapi('APIRepostedBy');

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

/** Draft.js-style article body block (Twitter `content_state.blocks`). */
export const TwitterArticleContentBlockSchema = z.object({
  key: z.string(),
  data: z.record(z.string(), z.unknown()),
  entityRanges: z.array(
    z.object({
      key: z.number(),
      length: z.number(),
      offset: z.number()
    })
  ),
  inlineStyleRanges: z.array(
    z.object({
      length: z.number(),
      offset: z.number(),
      style: z.string()
    })
  ),
  text: z.string(),
  type: z.string()
});

const TwitterArticleEntityMarkdownSchema = z.object({
  key: z.string(),
  value: z.object({
    type: z.literal('MARKDOWN'),
    mutability: z.literal('Mutable'),
    data: z.object({
      entityKey: z.string(),
      markdown: z.string()
    })
  })
});

const TwitterArticleEntityMediaSchema = z.object({
  key: z.string(),
  value: z.object({
    type: z.literal('MEDIA'),
    mutability: z.literal('Immutable'),
    data: z.object({
      entityKey: z.string(),
      mediaItems: z.array(
        z.object({
          localMediaId: z.string(),
          mediaCategory: z.string(),
          mediaId: z.string()
        })
      )
    })
  })
});

const TwitterArticleEntityTweetSchema = z.object({
  key: z.string(),
  value: z.object({
    type: z.literal('TWEET'),
    mutability: z.literal('Immutable'),
    data: z.object({
      tweetId: z.string()
    })
  })
});

export const TwitterApiImageSchema = z.object({
  __typename: z.literal('ApiImage'),
  original_img_height: z.number(),
  original_img_width: z.number(),
  original_img_url: z.string(),
  color_info: z.object({
    palette: z.array(
      z.object({
        percentage: z.number(),
        rgb: z.object({ red: z.number(), green: z.number(), blue: z.number() })
      })
    )
  })
});

export const TwitterApiVideoSchema = z.object({
  __typename: z.union([z.literal('ApiVideo'), z.literal('ApiGif')]),
  type: z.union([z.literal('video'), z.literal('animated_gif')]),
  id: z.string(),
  id_str: z.string(),
  ext_alt_text: z.string().nullable(),
  ext_media_color: z.object({
    palette: z.array(
      z.object({
        percentage: z.number(),
        rgb: z.object({ red: z.number(), green: z.number(), blue: z.number() })
      })
    )
  }),
  media_url: z.string(),
  media_url_https: z.string(),
  url: z.string(),
  display_url: z.string(),
  expanded_url: z.string(),
  original_info: z.object({
    height: z.number(),
    width: z.number()
  }),
  sizes: z.object({
    original: z.object({
      h: z.number(),
      resize: z.literal('fit'),
      w: z.number()
    })
  }),
  video_info: z.object({
    aspect_ratio: z.tuple([z.number(), z.number()]),
    duration_millis: z.number(),
    variants: z.array(
      z.object({
        bitrate: z.number(),
        content_type: z.string(),
        url: z.string()
      })
    )
  })
});

const TwitterApiMediaSchema = z.object({
  id: z.string(),
  media_key: z.string(),
  media_id: z.string(),
  media_info: z.union([TwitterApiImageSchema, TwitterApiVideoSchema])
});

export const TwitterArticleEntityMapEntrySchema = z.union([
  TwitterArticleEntityMarkdownSchema,
  TwitterArticleEntityMediaSchema,
  TwitterArticleEntityTweetSchema
]);

/** Mirrors Twitter `content_state`. Empty fallbacks use `default([])` so `blocks` / `entityMap` are always arrays. */
export const TwitterArticleContentStateSchema = z.object({
  blocks: z.array(TwitterArticleContentBlockSchema).default([]),
  entityMap: z.array(TwitterArticleEntityMapEntrySchema).default([])
});

export type TwitterArticleContentBlock = z.infer<typeof TwitterArticleContentBlockSchema>;
export type TwitterArticleContentState = z.infer<typeof TwitterArticleContentStateSchema>;
export type TwitterArticleEntityMapEntry = z.infer<typeof TwitterArticleEntityMapEntrySchema>;

export const TwitterArticleSchema = z.object({
  created_at: z.string(),
  modified_at: z.string().optional(),
  id: z.string(),
  title: z.string(),
  preview_text: z.string(),
  cover_media: TwitterApiMediaSchema,
  content: TwitterArticleContentStateSchema,
  media_entities: z.array(TwitterApiMediaSchema)
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
  reposted_by: z.infer<typeof APIRepostedBySchema> | null;
  card?: z.infer<typeof APICardSchema>;
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
      community_note: APITwitterCommunityNoteSchema.nullable(),
      reposted_by: APIRepostedBySchema.nullable(),
      card: APICardSchema.optional()
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

export const SocialConversationSchema = z
  .object({
    code: z.number().openapi({ description: 'HTTP-style status; mirrors response status code' }),
    status: APITwitterStatusSchema.nullable(),
    thread: z.array(APITwitterStatusSchema).nullable(),
    replies: z.array(APITwitterStatusSchema).nullable(),
    author: APIUserSchema.nullable(),
    cursor: z
      .object({
        bottom: z.string().nullable()
      })
      .nullable()
  })
  .openapi('SocialConversation');

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
  name: z.string()
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

export const APITypeaheadTopicResultContextTypeSchema = z.object({
  type: z.string()
});

export const APITypeaheadTopicResultContextSchema = z.object({
  display_string: z.string().optional(),
  redirect_url: z.string().optional(),
  types: z.array(APITypeaheadTopicResultContextTypeSchema).optional()
});

export const APITypeaheadTopicSchema = z
  .object({
    topic: z.string(),
    result_context: APITypeaheadTopicResultContextSchema.optional()
  })
  .openapi('APITypeaheadTopic');

export const APITypeaheadEventImageSchema = z.object({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional()
});

export const APITypeaheadEventSchema = z
  .object({
    topic: z.string(),
    url: z.string().optional(),
    supporting_text: z.string().optional(),
    primary_image: APITypeaheadEventImageSchema.optional()
  })
  .openapi('APITypeaheadEvent');

export const APITypeaheadResponseSchema = z
  .object({
    code: z.number(),
    query: z.string(),
    num_results: z.number(),
    users: z.array(APIUserSchema),
    topics: z.array(APITypeaheadTopicSchema),
    events: z.array(APITypeaheadEventSchema)
  })
  .openapi('APITypeaheadResponse');

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
export type APIRepostedBy = z.infer<typeof APIRepostedBySchema>;
export type APITwitterCommunityNote = z.infer<typeof APITwitterCommunityNoteSchema>;
export type APITwitterCommunity = z.infer<typeof APITwitterCommunitySchema>;
export type UserAPIResponse = z.infer<typeof UserAPIResponseSchema>;
export type SearchCursor = z.infer<typeof SearchCursorSchema>;
export type APISearchResults = z.infer<typeof APISearchResultsSchema>;
export type APITrendGroupedTopic = z.infer<typeof APITrendGroupedTopicSchema>;
export type APITrend = z.infer<typeof APITrendSchema>;
export type APITrendsResponse = z.infer<typeof APITrendsResponseSchema>;
export type APITypeaheadTopic = z.infer<typeof APITypeaheadTopicSchema>;
export type APITypeaheadEvent = z.infer<typeof APITypeaheadEventSchema>;
export type APITypeaheadResponse = z.infer<typeof APITypeaheadResponseSchema>;
export type ApiQueryError = z.infer<typeof ApiQueryErrorSchema>;
