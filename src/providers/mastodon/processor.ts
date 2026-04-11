import type { Context } from 'hono';
import i18next from 'i18next';
import { Constants } from '../../constants';
import { DataProvider } from '../../enum';
import { handleMosaic } from '../../helpers/mosaic';
import { translateStatusAI } from '../../helpers/translateAI';
import { translateStatus } from '../../helpers/translate';
import { unescapeText } from '../../helpers/utils';
import type { APIFacet, APIRepostedBy, APIUser, APIMastodonStatus } from '../../realms/api/schemas';
import { assertSafeMastodonDomain } from './client';

const decodeBasicEntities = (s: string): string =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

/** Strip HTML to plain text; preserve line breaks from `<br>` / `<p>` */
const htmlToPlainText = (html: string): string => {
  let s = html.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
  s = s.replace(/<p[^>]*>/gi, '');
  s = s.replace(/<\/p>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  return decodeBasicEntities(s)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const buildFacetsFromStatus = (plain: string, status: MastodonStatus): APIFacet[] => {
  const facets: APIFacet[] = [];
  for (const m of status.mentions ?? []) {
    const needle = `@${m.acct}`;
    let from = 0;
    while (from < plain.length) {
      const i = plain.indexOf(needle, from);
      if (i === -1) break;
      facets.push({
        type: 'mention',
        indices: [i, i + needle.length],
        display: needle,
        id: m.id
      });
      from = i + needle.length;
    }
    const shortNeedle = `@${m.username}`;
    if (shortNeedle !== needle) {
      from = 0;
      while (from < plain.length) {
        const i = plain.indexOf(shortNeedle, from);
        if (i === -1) break;
        if (facets.some(f => f.type === 'mention' && f.indices[0] <= i && i < f.indices[1])) {
          from = i + shortNeedle.length;
          continue;
        }
        facets.push({
          type: 'mention',
          indices: [i, i + shortNeedle.length],
          display: shortNeedle,
          id: m.id
        });
        from = i + shortNeedle.length;
      }
    }
  }
  for (const tag of status.tags ?? []) {
    const needle = `#${tag.name}`;
    let from = 0;
    while (from < plain.length) {
      const i = plain.indexOf(needle, from);
      if (i === -1) break;
      facets.push({
        type: 'hashtag',
        indices: [i, i + needle.length],
        display: needle,
        replacement: tag.url
      });
      from = i + needle.length;
    }
  }
  facets.sort((a, b) => a.indices[0] - b.indices[0]);
  return facets;
};

export const mastodonAccountToApiUser = (account: MastodonAccount, domain: string): APIUser => {
  const safe = assertSafeMastodonDomain(domain);
  const rawNote = account.note ? htmlToPlainText(account.note) : '';
  const webUrl = account.url || `https://${safe}/@${account.username}`;
  return {
    id: account.id,
    name: (account.display_name || account.username).trim() || account.username,
    screen_name: account.acct,
    avatar_url: account.avatar_static || account.avatar || null,
    banner_url: account.header_static || account.header || null,
    description: rawNote,
    raw_description: { text: rawNote, facets: [] },
    location: '',
    url: webUrl,
    protected: account.locked,
    followers: account.followers_count ?? 0,
    following: account.following_count ?? 0,
    statuses: account.statuses_count ?? 0,
    media_count: 0,
    likes: 0,
    joined: account.created_at ?? '',
    birthday: { day: 0, month: 0, year: 0 },
    website: null,
    ...(account.verified
      ? {
          verification: {
            verified: true,
            type: null,
            verified_at: null
          }
        }
      : {})
  };
};

const repostedByFromAccount = (account: MastodonAccount, domain: string): APIRepostedBy => {
  const u = mastodonAccountToApiUser(account, domain);
  return {
    id: u.screen_name,
    name: u.name,
    screen_name: u.screen_name,
    avatar_url: u.avatar_url,
    url: u.url
  };
};

const applyMedia = (api: APIMastodonStatus, status: MastodonStatus): void => {
  const photos: NonNullable<APIMastodonStatus['media']['photos']> = [];
  const videos: NonNullable<APIMastodonStatus['media']['videos']> = [];

  for (const m of status.media_attachments ?? []) {
    if (m.type === 'image' || m.type === 'unknown') {
      photos.push({
        type: 'photo',
        url: m.url || m.preview_url,
        width: m.meta?.original?.width ?? 0,
        height: m.meta?.original?.height ?? 0,
        altText: m.description ?? undefined
      });
    } else if (m.type === 'gifv') {
      photos.push({
        type: 'gif',
        url: m.url,
        format: 'image/gif',
        width: m.meta?.original?.width ?? 0,
        height: m.meta?.original?.height ?? 0
      });
    } else if (m.type === 'video' || m.type === 'audio') {
      const w = m.meta?.original?.width ?? 0;
      const h = m.meta?.original?.height ?? 0;
      const dur = m.meta?.original?.duration ?? 0;
      videos.push({
        type: 'video',
        url: m.url,
        width: w,
        height: h,
        duration: dur,
        thumbnail_url: m.preview_url ?? null,
        formats: [{ url: m.url, container: 'mp4' }]
      });
    }
  }

  if (photos.length) {
    api.media.photos = photos;
    api.embed_card = 'summary_large_image';
  }
  if (videos.length) {
    api.media.videos = videos;
    api.embed_card = 'player';
  }

  if (status.card?.image && !photos.length && !videos.length) {
    photos.push({
      type: 'photo',
      url: status.card.image,
      width: typeof status.card.width === 'number' ? status.card.width : 0,
      height: typeof status.card.height === 'number' ? status.card.height : 0,
      altText: status.card.title || ''
    });
    api.media.photos = photos;
    api.embed_card = 'summary_large_image';
  }
};

export const buildAPIMastodonPost = async (
  c: Context,
  status: MastodonStatus,
  domain: string,
  language: string | undefined,
  quoteDepth = 0
): Promise<APIMastodonStatus> => {
  if (quoteDepth > 10) {
    throw new Error('mastodon quote depth exceeded');
  }

  let outerBoost: MastodonAccount | null = null;
  let core = status;
  if (status.reblog) {
    outerBoost = status.account;
    core = status.reblog;
  }

  const rawHtml = core.content ?? '';
  const rawText = core.text ?? htmlToPlainText(rawHtml);
  const text = htmlToPlainText(rawHtml) || rawText;
  const facets = buildFacetsFromStatus(text, core);

  const created = Date.parse(core.created_at);
  const createdTs = Number.isFinite(created) ? created / 1000 : 0;

  let replying_to: APIMastodonStatus['replying_to'] = null;
  if (core.in_reply_to_id && core.in_reply_to_account_id) {
    const uname =
      core.mentions?.find(m => m.id === core.in_reply_to_account_id)?.acct ||
      core.mentions?.find(m => m.id === core.in_reply_to_account_id)?.username ||
      core.in_reply_to_account_id;
    replying_to = { screen_name: uname, status: core.in_reply_to_id };
  }

  const author = mastodonAccountToApiUser(core.account, domain);
  const statusUrl =
    core.url || `https://${assertSafeMastodonDomain(domain)}/@${core.account.username}/${core.id}`;

  const apiStatus: APIMastodonStatus = {
    id: core.id,
    url: statusUrl,
    text,
    raw_text: { text, facets },
    created_at: core.created_at,
    created_timestamp: createdTs,
    likes: core.favourites_count ?? 0,
    reposts: core.reblogs_count ?? 0,
    replies: core.replies_count ?? 0,
    author,
    media: {},
    lang: core.language ?? null,
    possibly_sensitive: core.sensitive === true,
    replying_to,
    source: core.application?.name ?? 'Mastodon',
    embed_card: 'tweet',
    provider: 'mastodon'
  };

  applyMedia(apiStatus, core);

  if (outerBoost) {
    apiStatus.reposted_by = repostedByFromAccount(outerBoost, domain);
  }

  const quoted = core.quoted_status;
  if (quoted && quoteDepth < 10) {
    const q = await buildAPIMastodonPost(c, quoted, domain, language, quoteDepth + 1);
    apiStatus.quote = q;
    if (q.embed_card && q.embed_card !== 'tweet') {
      apiStatus.embed_card = q.embed_card;
    }
  }

  apiStatus.media.all = [...(apiStatus.media.photos ?? []), ...(apiStatus.media.videos ?? [])];

  if ((apiStatus.media.photos?.length || 0) > 1 && Constants.MOSAIC_DOMAIN_LIST.length > 0) {
    apiStatus.embed_card = 'summary_large_image';
    const mosaic = await handleMosaic(apiStatus.media?.photos || [], ':3', DataProvider.Mastodon);
    if (mosaic !== null) {
      apiStatus.media.mosaic = mosaic;
    }
  }

  if (
    typeof language === 'string' &&
    (language.length === 2 || language.length === 5) &&
    language !== (core.language ?? '').slice(0, 2)
  ) {
    let didTranslate = false;
    if (Constants.POLYGLOT_DOMAIN_LIST.length > 0) {
      const translatePolyglot = await translateStatus(apiStatus, language, c);
      if (translatePolyglot !== null) {
        apiStatus.translation = {
          text: unescapeText(translatePolyglot?.translated_text || ''),
          source_lang: (translatePolyglot?.source_lang ?? 'en').toLowerCase(),
          target_lang: language.toLowerCase(),
          source_lang_en: i18next.t(
            `language_${(translatePolyglot?.source_lang ?? 'en').toLowerCase()}`,
            { lng: 'en' }
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
          text: unescapeText(translateAPI.translated_text || ''),
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
