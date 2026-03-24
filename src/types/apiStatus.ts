/**
 * Hand-written status / thread shapes (recursive `quote`, provider variants).
 * Field types shared with the public API are imported from Zod `z.infer` in `realms/api/schemas.ts`.
 */
import { DataProvider } from '../enum';
import type {
  APIBroadcast,
  APIExternalMedia,
  APIFacet,
  APIMedia,
  APIPhoto,
  APIPoll,
  APITranslate,
  APITwitterCommunity,
  APIUser,
  APIVideo,
  APIMosaicPhoto
} from '../realms/api/schemas';

/** Matches runtime Birdwatch payloads on community notes (see vendor twitter types). */
export interface APITwitterCommunityNote {
  text: string;
  entities: BirdwatchEntity[];
}

export interface APIStatus {
  id: string;
  url: string;
  text: string;
  created_at: string;
  created_timestamp: number;

  likes: number;
  reposts: number;
  replies: number;

  quote?: APIStatus;
  poll?: APIPoll;
  author: APIUser;

  media: {
    external?: APIExternalMedia;
    photos?: APIPhoto[];
    videos?: APIVideo[];
    all?: APIMedia[];
    mosaic?: APIMosaicPhoto;
    broadcast?: APIBroadcast;
  };

  raw_text: {
    text: string;
    facets: APIFacet[];
  };

  lang: string | null;
  translation?: APITranslate;

  possibly_sensitive: boolean;

  replying_to: {
    screen_name: string;
    post: string;
  } | null;

  source: string | null;

  embed_card: 'tweet' | 'summary' | 'summary_large_image' | 'player';
  provider: DataProvider;
}

export interface APITwitterStatus extends APIStatus {
  views?: number | null;
  bookmarks?: number | null;
  community?: APITwitterCommunity;
  article?: {
    created_at: string;
    modified_at?: string;
    id: string;
    title: string;
    preview_text: string;
    cover_media: TwitterApiMedia;
    content: TwitterArticleContentState;
    media_entities: TwitterApiMedia[];
  };
  is_note_tweet: boolean;
  community_note: APITwitterCommunityNote | null;
  provider: DataProvider.Twitter;
}

export interface APIBlueskyStatus extends APIStatus {
  provider: DataProvider.Bsky;
}

export interface APITikTokStatus extends APIStatus {
  provider: DataProvider.TikTok;
  views?: number | null;
}

export interface SocialPost {
  status: APIStatus | APITwitterStatus | null;
  author: APIUser | null;
}

/** Used by Twitter v2 API, embed pipeline, Bluesky/TikTok conversations (broader than OpenAPI `SocialThreadSchema`). */
export interface SocialThread {
  status: APIStatus | APITwitterStatus | null;
  thread: (APIStatus | APITwitterStatus)[] | null;
  author: APIUser | null;
  code: number;
}
