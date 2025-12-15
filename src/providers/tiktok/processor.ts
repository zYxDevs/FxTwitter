import { DataProvider } from '../../enum';
import { APIStatus, APIPhoto, APIVideo } from '../../types/types';

const TIKTOK_ROOT = 'https://www.tiktok.com';

/**
 * Type guard to check if video data is from web API (TikTokItemInfo)
 * Note: createTime can be either a number or string depending on TikTok's A/B testing
 */
const isWebApiData = (video: TikTokItemInfo | TikTokAwemeDetail): video is TikTokItemInfo => {
  return 'createTime' in video && video.createTime !== undefined;
};

/**
 * Type guard to check if video data is from mobile API (TikTokAwemeDetail)
 */
const isMobileApiData = (video: TikTokItemInfo | TikTokAwemeDetail): video is TikTokAwemeDetail => {
  return 'create_time' in video || 'aweme_id' in video;
};

/**
 * Check if a URL is from a regional CDN (preferred) vs maliva CDN (often 403s)
 */
const isRegionalCdnUrl = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname;
    // Regional CDNs have .us., .eu., useast, uswest etc. in the hostname
    return (
      hostname.includes('.us.') ||
      hostname.includes('.eu.') ||
      hostname.includes('useast') ||
      hostname.includes('uswest')
    );
  } catch {
    return false;
  }
};

/**
 * Check if a URL is from the maliva CDN (often 403s from non-browser requests)
 */
const isMalivaCdnUrl = (url: string): boolean => {
  return url.includes('maliva');
};

/**
 * Extract the best quality video URL from video data
 * Prefers regional CDN URLs over maliva URLs which often 403
 */
const extractVideoUrl = (video: TikTokItemInfo | TikTokAwemeDetail): string => {
  const candidateUrls: string[] = [];

  if (isWebApiData(video)) {
    // Web API format - collect all available URLs
    if (video.video?.playAddr) candidateUrls.push(video.video.playAddr);
    if (video.video?.downloadAddr) candidateUrls.push(video.video.downloadAddr);

    // Check bitrateInfo for additional URLs (may have regional CDN)
    if (video.video?.bitrateInfo) {
      for (const format of video.video.bitrateInfo) {
        if (format.url) candidateUrls.push(format.url);
      }
    }
  } else if (isMobileApiData(video)) {
    // Mobile API format - collect all URLs from bit_rate variants
    const bitRates = video.video?.bit_rate;
    if (bitRates && bitRates.length > 0) {
      // Sort by bitrate descending
      const sorted = [...bitRates].sort((a, b) => b.bit_rate - a.bit_rate);
      for (const rate of sorted) {
        if (rate?.play_addr?.url_list) {
          candidateUrls.push(...rate.play_addr.url_list);
        }
      }
    }
    // Also check standard play/download addresses
    if (video.video?.play_addr?.url_list) {
      candidateUrls.push(...video.video.play_addr.url_list);
    }
    if (video.video?.download_addr?.url_list) {
      candidateUrls.push(...video.video.download_addr.url_list);
    }
  }

  // Log all candidates for debugging
  console.log(
    'Video URL candidates:',
    candidateUrls.map(u => {
      try {
        return new URL(u).hostname;
      } catch {
        return 'invalid';
      }
    })
  );

  // Prioritize regional CDN URLs
  const regionalUrl = candidateUrls.find(url => isRegionalCdnUrl(url));
  if (regionalUrl) {
    console.log('Using regional CDN URL');
    return regionalUrl;
  }

  // Fall back to non-maliva URLs
  const nonMalivaUrl = candidateUrls.find(url => !isMalivaCdnUrl(url));
  if (nonMalivaUrl) {
    console.log('Using non-maliva URL');
    return nonMalivaUrl;
  }

  // Last resort: use whatever we have
  if (candidateUrls.length > 0) {
    console.log('Using maliva URL (last resort)');
    return candidateUrls[0];
  }

  return '';
};

/**
 * Extract thumbnail URL from video data
 */
const extractThumbnailUrl = (video: TikTokItemInfo | TikTokAwemeDetail): string => {
  if (isWebApiData(video)) {
    return video.video?.originCover || video.video?.cover || video.video?.dynamicCover || '';
  } else if (isMobileApiData(video)) {
    return (
      video.video?.origin_cover?.url_list?.[0] ||
      video.video?.cover?.url_list?.[0] ||
      video.video?.dynamic_cover?.url_list?.[0] ||
      ''
    );
  }
  return '';
};

/**
 * Extract video dimensions
 */
const extractVideoDimensions = (
  video: TikTokItemInfo | TikTokAwemeDetail
): { width: number; height: number } => {
  if (isWebApiData(video)) {
    return {
      width: video.video?.width || 720,
      height: video.video?.height || 1280
    };
  } else if (isMobileApiData(video)) {
    return {
      width: video.video?.width || 720,
      height: video.video?.height || 1280
    };
  }
  return { width: 720, height: 1280 };
};

/**
 * Extract video duration in seconds
 */
const extractDuration = (video: TikTokItemInfo | TikTokAwemeDetail): number => {
  if (isWebApiData(video)) {
    return video.video?.duration || 0;
  } else if (isMobileApiData(video)) {
    // Mobile API duration is in milliseconds
    return Math.floor((video.video?.duration || 0) / 1000);
  }
  return 0;
};

/**
 * Extract author information
 */
const extractAuthor = (video: TikTokItemInfo | TikTokAwemeDetail) => {
  if (isWebApiData(video)) {
    const author = video.author;
    return {
      id: author?.id || author?.secUid || '',
      name: author?.nickname || author?.uniqueId || '',
      screen_name: author?.uniqueId || '',
      avatar_url: author?.avatarLarger || author?.avatarMedium || author?.avatarThumb || null,
      banner_url: null,
      description: author?.signature || '',
      location: '',
      followers: author?.followerCount || 0,
      following: author?.followingCount || 0,
      media_count: author?.videoCount || 0,
      likes: author?.heartCount || 0,
      url: `${TIKTOK_ROOT}/@${author?.uniqueId || ''}`,
      protected: false,
      statuses: author?.videoCount || 0,
      joined: '',
      birthday: { day: 0, month: 0, year: 0 },
      website: null
    };
  } else if (isMobileApiData(video)) {
    const author = video.author;
    return {
      id: author?.uid || author?.sec_uid || '',
      name: author?.nickname || author?.unique_id || '',
      screen_name: author?.unique_id || '',
      avatar_url:
        author?.avatar_larger?.url_list?.[0] ||
        author?.avatar_medium?.url_list?.[0] ||
        author?.avatar_thumb?.url_list?.[0] ||
        null,
      banner_url: null,
      description: author?.signature || '',
      location: '',
      followers: author?.follower_count || 0,
      following: author?.following_count || 0,
      media_count: author?.aweme_count || 0,
      likes: author?.total_favorited || 0,
      url: `${TIKTOK_ROOT}/@${author?.unique_id || ''}`,
      protected: false,
      statuses: author?.aweme_count || 0,
      joined: '',
      birthday: { day: 0, month: 0, year: 0 },
      website: null
    };
  }
  return {
    id: '',
    name: '',
    screen_name: '',
    avatar_url: null,
    banner_url: null,
    description: '',
    location: '',
    followers: 0,
    following: 0,
    media_count: 0,
    likes: 0,
    url: '',
    protected: false,
    statuses: 0,
    joined: '',
    birthday: { day: 0, month: 0, year: 0 },
    website: null
  };
};

/**
 * Extract statistics
 */
const extractStats = (video: TikTokItemInfo | TikTokAwemeDetail) => {
  if (isWebApiData(video)) {
    return {
      likes: video.stats?.diggCount || 0,
      reposts: video.stats?.shareCount || 0,
      replies: video.stats?.commentCount || 0,
      views: video.stats?.playCount || 0
    };
  } else if (isMobileApiData(video)) {
    return {
      likes: video.statistics?.digg_count || 0,
      reposts: video.statistics?.share_count || 0,
      replies: video.statistics?.comment_count || 0,
      views: video.statistics?.play_count || 0
    };
  }
  return { likes: 0, reposts: 0, replies: 0, views: 0 };
};

/**
 * Extract video ID
 */
const extractVideoId = (video: TikTokItemInfo | TikTokAwemeDetail): string => {
  if (isWebApiData(video)) {
    return video.id || '';
  } else if (isMobileApiData(video)) {
    return video.aweme_id || '';
  }
  return '';
};

/**
 * Extract description/text
 */
const extractDescription = (video: TikTokItemInfo | TikTokAwemeDetail): string => {
  if (isWebApiData(video)) {
    // Check for contents array first (newer format)
    if (video.contents && video.contents.length > 0) {
      return video.contents.map(c => c.desc).join(' ');
    }
    return video.desc || '';
  } else if (isMobileApiData(video)) {
    return video.desc || '';
  }
  return '';
};

/**
 * Extract creation timestamp
 */
const extractCreatedAt = (video: TikTokItemInfo | TikTokAwemeDetail): number => {
  if (isWebApiData(video)) {
    // createTime can be a number or string
    const ct = video.createTime;
    return typeof ct === 'string' ? parseInt(ct, 10) || 0 : ct || 0;
  } else if (isMobileApiData(video)) {
    return video.create_time || 0;
  }
  return 0;
};

/**
 * Check if this is an image slideshow post
 */
const isImagePost = (video: TikTokItemInfo | TikTokAwemeDetail): boolean => {
  if (isWebApiData(video)) {
    return !!(video.imagePost?.images && video.imagePost.images.length > 0);
  } else if (isMobileApiData(video)) {
    return !!(video.image_post_info?.images && video.image_post_info.images.length > 0);
  }
  return false;
};

/**
 * Extract images from slideshow post
 */
const extractImages = (video: TikTokItemInfo | TikTokAwemeDetail): APIPhoto[] => {
  if (isWebApiData(video) && video.imagePost?.images) {
    return video.imagePost.images.map(img => ({
      type: 'photo' as const,
      url: img.imageURL?.urlList?.[0] || '',
      width: img.imageWidth || 0,
      height: img.imageHeight || 0
    }));
  } else if (isMobileApiData(video) && video.image_post_info?.images) {
    return video.image_post_info.images.map(img => ({
      type: 'photo' as const,
      url: img.display_image?.url_list?.[0] || '',
      width: img.display_image?.width || 0,
      height: img.display_image?.height || 0
    }));
  }
  return [];
};

/**
 * Extract music/audio information
 */
const extractMusic = (
  video: TikTokItemInfo | TikTokAwemeDetail
): { title: string; author: string } | null => {
  if (isWebApiData(video) && video.music) {
    return {
      title: video.music.title || '',
      author: video.music.authorName || ''
    };
  } else if (isMobileApiData(video) && video.music) {
    return {
      title: video.music.title || '',
      author: video.music.author || ''
    };
  }
  return null;
};

/**
 * Generate a proxy URL for TikTok videos
 * This routes videos through our worker to add proper headers/cookies
 */
const generateProxyUrl = (
  videoUrl: string,
  cookies: string | null,
  proxyBase: string,
  videoId: string
): string => {
  const params = new URLSearchParams({ url: videoUrl });
  if (cookies) {
    params.set('cookies', cookies);
  }
  // Include videoId so proxy can fetch fresh data if URL fails
  if (videoId) {
    params.set('videoId', videoId);
  }
  return `${proxyBase}/proxy?${params.toString()}`;
};

/**
 * Build API status object from TikTok video data
 * @param video - The TikTok video data
 * @param cookies - Cookies captured from TikTok page (for video proxy)
 * @param proxyBase - Base URL for the proxy endpoint (e.g., https://fxtwitter.com)
 */
export const buildAPITikTokStatus = async (
  video: TikTokItemInfo | TikTokAwemeDetail,
  cookies: string | null = null,
  proxyBase: string | null = null
): Promise<APIStatus> => {
  console.log('building tiktok status', JSON.stringify(video));
  const videoId = extractVideoId(video);
  const author = extractAuthor(video);
  const stats = extractStats(video);
  const description = extractDescription(video);
  const createdAt = extractCreatedAt(video);
  const music = extractMusic(video);
  console.log('author', JSON.stringify(author));
  console.log('stats', JSON.stringify(stats));
  console.log('description', JSON.stringify(description));
  console.log('createdAt', JSON.stringify(createdAt));
  console.log('music', JSON.stringify(music));

  const apiStatus: APIStatus = {
    id: videoId,
    url: `${TIKTOK_ROOT}/@${author.screen_name}/video/${videoId}`,
    text: description,
    created_at: new Date(createdAt * 1000).toISOString(),
    created_timestamp: createdAt,
    likes: stats.likes,
    reposts: stats.reposts,
    replies: stats.replies,
    author: author,
    media: {},
    raw_text: {
      text: description,
      facets: []
    },
    lang: null, // TikTok doesn't provide language info directly
    possibly_sensitive: false,
    replying_to: null,
    source: music ? `♪ ${music.title} - ${music.author}` : 'TikTok',
    embed_card: 'tweet',
    provider: DataProvider.TikTok
  };

  // Handle image slideshow posts
  if (isImagePost(video)) {
    const images = extractImages(video);
    if (images.length > 0) {
      apiStatus.media.photos = images;
      apiStatus.media.all = images;
      apiStatus.embed_card = 'summary_large_image';
    }
  } else {
    // Regular video post
    let videoUrl = extractVideoUrl(video);
    const thumbnailUrl = extractThumbnailUrl(video);
    const dimensions = extractVideoDimensions(video);
    const duration = extractDuration(video);

    if (videoUrl) {
      // Route through our proxy if a proxy base is provided
      // This ensures proper headers/cookies are sent to TikTok's CDN
      if (proxyBase) {
        console.log('Routing TikTok video through proxy:', proxyBase);
        videoUrl = generateProxyUrl(videoUrl, cookies, proxyBase, videoId);
      }

      const videoMedia: APIVideo = {
        type: 'video',
        url: videoUrl,
        thumbnail_url: thumbnailUrl,
        width: dimensions.width,
        height: dimensions.height,
        duration: duration,
        format: 'video/mp4',
        variants: []
      };

      apiStatus.media.videos = [videoMedia];
      apiStatus.media.all = [videoMedia];
      apiStatus.embed_card = 'player';
    }
  }

  // TODO: Add translation support similar to Twitter/Bluesky if needed

  console.log('Built TikTok API status:', JSON.stringify(apiStatus));
  return apiStatus;
};
