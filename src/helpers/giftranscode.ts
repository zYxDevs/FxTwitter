import { Constants } from '../constants';

export const getGIFTranscodeDomain = (twitterId: string): string | null => {
  const gifTranscoderList = Constants.GIF_TRANSCODE_DOMAIN_LIST;

  if (gifTranscoderList.length === 0) {
    return null;
  }

  let hash = 0;
  for (let i = 0; i < twitterId.length; i++) {
    const char = twitterId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
  }
  return gifTranscoderList[Math.abs(hash) % gifTranscoderList.length];
};
