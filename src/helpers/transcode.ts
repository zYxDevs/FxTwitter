import { Constants } from '../constants';

export const getVideoTranscodeDomain = (twitterId: string): string | null => {
  const videoTranscoderList = Constants.VIDEO_TRANSCODE_DOMAIN_LIST;

  if (videoTranscoderList.length === 0) {
    return null;
  }

  let hash = 0;
  for (let i = 0; i < twitterId.length; i++) {
    const char = twitterId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
  }
  return videoTranscoderList[Math.abs(hash) % videoTranscoderList.length];
};

export const getVideoTranscodeDomainBluesky = (bskyDid: string): string | null => {
  const videoTranscoderList = Constants.VIDEO_TRANSCODE_BSKY_DOMAIN_LIST;

  if (videoTranscoderList.length === 0) {
    return null;
  }

  let hash = 0;
  for (let i = 0; i < bskyDid.length; i++) {
    const char = bskyDid.charCodeAt(i);
    hash = (hash << 5) - hash + char;
  }
  return videoTranscoderList[Math.abs(hash) % videoTranscoderList.length];
};
