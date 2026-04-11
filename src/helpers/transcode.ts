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

export const getVideoTranscodeDomainBluesky = (blueskyDid: string): string | null => {
  const videoTranscoderList = Constants.VIDEO_TRANSCODE_BSKY_DOMAIN_LIST;

  if (videoTranscoderList.length === 0) {
    return null;
  }

  let hash = 0;
  for (let i = 0; i < blueskyDid.length; i++) {
    const char = blueskyDid.charCodeAt(i);
    hash = (hash << 5) - hash + char;
  }
  return videoTranscoderList[Math.abs(hash) % videoTranscoderList.length];
};
