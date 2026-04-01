import { Constants } from '../../constants';

/** Record key segment from an AT URI like `at://did/app.bsky.feed.post/<rkey>`. */
export const rkeyFromPostAtUri = (uri: string | undefined | null): string | null => {
  if (!uri) return null;
  const m = uri.match(/\/app\.bsky\.feed\.post\/([^/]+)\/?$/);
  return m?.[1] ?? null;
};

/** AT-URI for a feed post; `repo` may be a handle or DID (AppView resolves). */
export const atUriForFeedPost = (repo: string, rkey: string): string =>
  `at://${repo}/app.bsky.feed.post/${rkey}`;

/** DID from AT URI `at://<did>/...`. */
export const didFromAtUri = (uri: string | undefined | null): string | null => {
  if (!uri?.startsWith('at://')) return null;
  const rest = uri.slice('at://'.length);
  const did = rest.split('/')[0];
  return did || null;
};

export const blueskyWebPostUrl = (handle: string, rkey: string): string =>
  `${Constants.BLUESKY_ROOT}/profile/${handle}/post/${rkey}`;
