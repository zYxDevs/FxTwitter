import { Context } from 'hono';
import { Constants } from '../../constants';
import { DataProvider } from '../../enum';
import { handleMosaic } from '../../helpers/mosaic';
import { linkFixerBluesky } from '../../helpers/linkFixer';
import i18next from 'i18next';
import { translateStatusAI } from '../../helpers/translateAI';
import { translateStatus } from '../../helpers/translate';
import { unescapeText } from '../../helpers/utils';
import { blueskyFacetsToApiFacets } from './facets';
import { fetchPostsByUris, fetchProfilesByActors } from './client';
import { blueskyWebPostUrl, didFromAtUri, rkeyFromPostAtUri } from './uris';

const isPossiblySensitive = (labels: ATProtoLabel[] | undefined | null): boolean =>
  !!labels?.some(l => /nsfw|porn|sexual|nudity|graphic|!warn/i.test(l.val ?? ''));

const apiUserFromAuthor = (author: BlueskyAuthor): APIUser => ({
  id: author.handle,
  name: author.displayName || author.handle,
  screen_name: author.handle,
  avatar_url: author.avatar ?? null,
  banner_url: null,
  description: '',
  raw_description: { text: '', facets: [] },
  location: '',
  followers: 0,
  following: 0,
  media_count: 0,
  likes: 0,
  url: `${Constants.BLUESKY_ROOT}/profile/${author.handle}`,
  protected: false,
  statuses: 0,
  joined: author.createdAt,
  birthday: { day: 0, month: 0, year: 0 },
  website: null,
  profile_embed: true
});

const tombstoneAuthor = (handleOrDid: string): APIUser => ({
  id: handleOrDid,
  name: handleOrDid,
  screen_name: handleOrDid,
  avatar_url: null,
  banner_url: null,
  description: '',
  raw_description: { text: '', facets: [] },
  location: '',
  followers: 0,
  following: 0,
  media_count: 0,
  likes: 0,
  url: `${Constants.BLUESKY_ROOT}/profile/${handleOrDid}`,
  protected: false,
  statuses: 0,
  joined: '',
  birthday: { day: 0, month: 0, year: 0 },
  website: null,
  profile_embed: true
});

/** Map a hydrated record embed view into the `BlueskyPost` shape our pipeline expects. */
const viewRecordToPost = (v: BlueskyEmbedViewRecord): BlueskyPost | null => {
  if (!v.uri || !v.cid || !v.author) return null;
  const rec = (v.value ?? v.record) as BlueskyRecord | undefined;
  return {
    uri: v.uri,
    cid: v.cid,
    author: v.author,
    record: rec,
    value: v.value,
    embed: v.embed,
    embeds: v.embeds,
    indexedAt: v.indexedAt ?? '',
    labels: [],
    likeCount: v.likeCount ?? 0,
    repostCount: v.repostCount ?? 0,
    replyCount: v.replyCount,
    quoteCount: v.quoteCount
  };
};

const nestedLegacyPost = (o: unknown): BlueskyPost | null => {
  if (!o || typeof o !== 'object') return null;
  const p = o as BlueskyPost;
  if (p.uri && p.cid && p.author) return p;
  return null;
};

/** Unwrap `app.bsky.embed.record` shapes to something we can pass to `buildAPIBskyPost`. */
const quoteCandidateFromEmbedRecord = (
  embedRecord: NonNullable<BlueskyEmbed['record']>
): {
  post: BlueskyPost | null;
  stubUri: string | null;
  stubReason: 'not_found' | 'blocked' | null;
} => {
  if (embedRecord.notFound) {
    return { post: null, stubUri: embedRecord.uri ?? null, stubReason: 'not_found' };
  }
  if (embedRecord.blocked) {
    return { post: null, stubUri: embedRecord.uri ?? null, stubReason: 'blocked' };
  }
  const inner = embedRecord.record ?? embedRecord.value ?? embedRecord;
  if (inner && typeof inner === 'object') {
    const vr = inner as BlueskyEmbedViewRecord;
    if (vr.notFound) {
      return { post: null, stubUri: embedRecord.uri ?? vr.uri ?? null, stubReason: 'not_found' };
    }
    if (vr.blocked) {
      return { post: null, stubUri: embedRecord.uri ?? vr.uri ?? null, stubReason: 'blocked' };
    }
    const asNested = nestedLegacyPost(embedRecord.record);
    if (asNested) return { post: asNested, stubUri: null, stubReason: null };
    const asNestedVal = nestedLegacyPost(embedRecord.value);
    if (asNestedVal) return { post: asNestedVal, stubUri: null, stubReason: null };
    const fromView = viewRecordToPost(vr);
    if (fromView) return { post: fromView, stubUri: null, stubReason: null };
    if (vr.uri && vr.cid && vr.author) {
      const hybrid = viewRecordToPost(vr);
      if (hybrid) return { post: hybrid, stubUri: null, stubReason: null };
    }
  }
  if (embedRecord.uri && !embedRecord.notFound && !embedRecord.blocked) {
    return { post: null, stubUri: embedRecord.uri, stubReason: null };
  }
  return { post: null, stubUri: embedRecord.uri ?? null, stubReason: null };
};

const resolveReplyingTo = async (
  status: BlueskyPost
): Promise<{ screen_name: string; status: string } | null> => {
  const parentUri = status.record?.reply?.parent?.uri;
  if (!parentUri) return null;
  const parentRkey = rkeyFromPostAtUri(parentUri);
  const parentDid = didFromAtUri(parentUri);
  if (!parentRkey || !parentDid) return null;
  const profiles = await fetchProfilesByActors([parentDid]);
  const handle = profiles.get(parentDid)?.handle ?? parentDid;
  return { screen_name: handle, status: parentRkey };
};

const applyEmbedsToStatus = async (apiStatus: APIStatus, status: BlueskyPost): Promise<void> => {
  const primary = status.embed ?? status.embeds?.[0];
  const media = primary?.media ?? status.embeds?.[0]?.media;
  const authorDid = status.author?.did;

  if (primary?.media?.images?.length || status.embeds?.[0]?.images?.length) {
    apiStatus.embed_card = 'summary_large_image';
    const images = primary?.media?.images ?? (status.embeds?.[0]?.images as BlueskyImage[]);
    apiStatus.media.photos = images.map(image => ({
      type: 'photo' as const,
      width: image.aspectRatio?.width,
      height: image.aspectRatio?.height,
      url: image.fullsize,
      altText: image.alt
    }));
  }

  if (status.embeds?.[0]?.video || primary?.video) {
    apiStatus.embed_card = 'player';
    const video = primary?.video ?? status.embeds?.[0]?.video;
    const pl = status.embeds?.[0]?.playlist ?? primary?.playlist ?? '';
    apiStatus.media.videos = [
      {
        type: 'video',
        url: pl,
        format: video?.mimeType ?? 'video/mp4',
        thumbnail_url: status.embeds?.[0]?.thumbnail ?? primary?.thumbnail ?? '',
        formats: [{ url: pl, container: 'm3u8' as const }],
        width: status.embeds?.[0]?.aspectRatio?.width ?? primary?.aspectRatio?.width ?? 0,
        height: status.embeds?.[0]?.aspectRatio?.height ?? primary?.aspectRatio?.height ?? 0,
        duration: 0
      }
    ];
  }

  if (media?.external || status.record?.embed?.external) {
    const external = media?.external ?? status.record?.embed?.external;
    const uri = external?.uri ?? '';
    if (uri.startsWith('https://media.tenor.com')) {
      apiStatus.media.photos = [
        {
          type: 'gif',
          url: uri,
          format: 'image/gif',
          width: 0,
          height: 0
        }
      ];
    } else if (uri) {
      apiStatus.media.photos = [
        {
          type: 'photo',
          url: uri,
          altText: external?.description ?? '',
          width: 0,
          height: 0
        }
      ];
    }
    if (apiStatus.media.photos?.length) {
      apiStatus.embed_card = 'summary_large_image';
    }
  }

  if (primary?.images?.length) {
    apiStatus.embed_card = 'summary_large_image';
    apiStatus.media.photos = primary.images.map(image => ({
      type: 'photo' as const,
      width: image.aspectRatio?.width,
      height: image.aspectRatio?.height,
      url: image.fullsize,
      altText: image.alt
    }));
  }

  if (
    status.record?.embed?.video ||
    status.value?.embed?.video ||
    primary?.media?.$type === 'app.bsky.embed.video#view'
  ) {
    const video =
      status.record?.embed?.video ??
      status.value?.embed?.video ??
      status.record?.embed?.media ??
      status.value?.embed?.media;
    const cid =
      status.record?.embed?.video?.ref?.$link ??
      status.record?.embed?.media?.ref?.$link ??
      status.record?.embed?.media?.video?.ref?.$link ??
      status.value?.embed?.video?.ref?.$link ??
      status.value?.embed?.media?.ref?.$link ??
      status.value?.embed?.media?.video?.ref?.$link ??
      primary?.video?.ref?.$link;
    if (cid && authorDid) {
      apiStatus.embed_card = 'player';
      const videoUrl = `https://pds-cache.fxbsky.app/${authorDid}/${cid}`;
      const aspectRatio =
        primary?.aspectRatio ??
        primary?.media?.aspectRatio ??
        primary?.record?.value?.embed?.aspectRatio;
      apiStatus.media.videos = [
        {
          type: 'video',
          url: videoUrl,
          format: (video as BlueskyVideo | undefined)?.mimeType ?? 'video/mp4',
          thumbnail_url: primary?.thumbnail ?? primary?.media?.thumbnail ?? '',
          formats: [
            {
              url: videoUrl,
              container: 'mp4' as const,
              codec: 'h264' as const
            }
          ],
          width: aspectRatio?.width ?? 0,
          height: aspectRatio?.height ?? 0,
          duration: 0
        }
      ];
    }
  }
};

const resolveQuote = async (
  c: Context,
  status: BlueskyPost,
  language: string | undefined,
  quoteDepth: number
): Promise<APIStatus | undefined> => {
  if (quoteDepth > 10) return undefined;
  const embedRecord = status.embed?.record ?? status.embeds?.find(e => e.record)?.record;
  if (!embedRecord) return undefined;

  const cand = quoteCandidateFromEmbedRecord(embedRecord);
  let { post } = cand;
  const { stubUri, stubReason } = cand;

  if (!post && stubUri && stubReason) {
    return undefined; // buildUnavailableQuote(stubUri, stubReason);
  }

  if (!post && stubUri) {
    const fetched = await fetchPostsByUris([stubUri]);
    post = fetched[0] ?? null;
  }

  if (!post) {
    // if (stubUri) return buildUnavailableQuote(stubUri, 'not_found');
    return undefined;
  }

  const q = await buildAPIBlueskyPost(c, post, language, quoteDepth + 1);
  return q;
};

export const buildAPIBlueskyPost = async (
  c: Context,
  status: BlueskyPost,
  language: string | undefined,
  quoteDepth = 0
): Promise<APIStatus> => {
  const rkey = rkeyFromPostAtUri(status.uri) ?? status.cid;
  const record = status.record ?? status.value;
  const rawText = record?.text ?? '';
  const facets = record?.facets ?? [];
  const text = linkFixerBluesky(facets, rawText);
  const apiFacets = blueskyFacetsToApiFacets(rawText, facets);

  const author = status.author
    ? apiUserFromAuthor(status.author)
    : tombstoneAuthor(didFromAtUri(status.uri) ?? 'unknown');

  const apiStatus: APIStatus = {
    id: rkey,
    cid: status.cid,
    at_uri: status.uri,
    url: status.author?.handle
      ? blueskyWebPostUrl(status.author.handle, rkey)
      : `${Constants.BLUESKY_ROOT}/profile/${didFromAtUri(status.uri) ?? 'unknown'}/post/${rkey}`,
    text,
    raw_text: { text: rawText, facets: apiFacets },
    created_at: record?.createdAt ?? status.indexedAt ?? new Date().toISOString(),
    created_timestamp:
      (record?.createdAt ? new Date(record.createdAt).getTime() : Date.parse(status.indexedAt)) /
        1000 || 0,
    likes: status.likeCount ?? 0,
    reposts: status.repostCount ?? 0,
    quotes: status.quoteCount ?? 0,
    replies: status.replyCount ?? 0,
    author,
    media: {},
    lang: record?.langs?.[0] ?? null,
    possibly_sensitive: isPossiblySensitive(status.labels),
    replying_to: await resolveReplyingTo(status),
    source: 'Bluesky Social',
    embed_card: 'tweet',
    provider: DataProvider.Bluesky
  };

  await applyEmbedsToStatus(apiStatus, status);

  const quote = await resolveQuote(c, status, language, quoteDepth);
  if (quote) {
    apiStatus.quote = quote;
    if (quote.embed_card && quote.embed_card !== 'tweet') {
      apiStatus.embed_card = quote.embed_card;
    }
  }

  apiStatus.media.all = [...(apiStatus.media.photos ?? []), ...(apiStatus.media.videos ?? [])];

  if ((apiStatus.media.photos?.length || 0) > 1 && Constants.MOSAIC_BSKY_DOMAIN_LIST.length > 0) {
    apiStatus.embed_card = 'summary_large_image';
    const mosaic = await handleMosaic(apiStatus.media?.photos || [], ':3', DataProvider.Bluesky);
    if (mosaic !== null) {
      apiStatus.media.mosaic = mosaic;
    }
  }

  if (
    typeof language === 'string' &&
    (language.length === 2 || language.length === 5) &&
    language !== record?.langs?.[0]
  ) {
    let didTranslate = false;
    if (Constants.POLYGLOT_DOMAIN_LIST.length > 0) {
      const translatePolyglot = await translateStatus(apiStatus, language, c);
      if (translatePolyglot !== null) {
        apiStatus.translation = {
          text: unescapeText(linkFixerBluesky([], translatePolyglot?.translated_text || '')),
          source_lang: (translatePolyglot?.source_lang ?? 'en').toLowerCase(),
          target_lang: language.toLowerCase(),
          source_lang_en: i18next.t(
            `language_${(translatePolyglot?.source_lang ?? 'en').toLowerCase()}`,
            {
              lng: 'en'
            }
          ),
          provider: translatePolyglot?.provider ?? 'polyglot'
        };
        didTranslate = true;
      }
    }
    if (c.env.AI && !didTranslate) {
      const translateAPI = await translateStatusAI(apiStatus, language, c);
      if (translateAPI !== null && translateAPI?.translated_text) {
        apiStatus.translation = {
          text: unescapeText(linkFixerBluesky([], translateAPI.translated_text || '')),
          source_lang: (apiStatus.lang ?? 'en').toLowerCase(),
          target_lang: language.toLowerCase(),
          source_lang_en: i18next.t(`language_${(apiStatus.lang ?? 'en').toLowerCase()}`, {
            lng: 'en'
          }),
          provider: 'llm'
        };
      }
    }
  }

  return apiStatus;
};
