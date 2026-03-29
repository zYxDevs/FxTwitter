/**
 * Hand-written status / thread shapes (provider variants).
 * Twitter API v2 tweet payloads use `APITwitterStatus` from `z.infer` in `realms/api/schemas.ts`.
 */
import { DataProvider } from '../enum';
import type {
  APIBroadcast,
  APIExternalMedia,
  APIFacet,
  APIPhoto,
  APIPoll,
  APITranslate,
  APITwitterStatus,
  APIUser,
  APIVideo,
  APIMosaicPhoto
} from '../realms/api/schemas';

export interface APIStatus {
  id: string;
  url: string;
  text: string;
  created_at: string;
  created_timestamp: number;

  likes: number;
  reposts: number;
  quotes: number;
  replies: number;

  quote?: APIStatus;
  poll?: APIPoll;
  author: APIUser;

  media: {
    external?: APIExternalMedia;
    photos?: APIPhoto[];
    videos?: APIVideo[];
    all?: (APIPhoto | APIVideo)[];
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

/** Thread + replies with cursor-based pagination for the conversation endpoint. */
export interface SocialConversation extends SocialThread {
  replies: (APIStatus | APITwitterStatus)[] | null;
  cursor: {
    bottom: string | null;
  } | null;
}
