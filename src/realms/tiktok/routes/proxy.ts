import { Context } from 'hono';
import { fetchTikTokVideo } from '../../../providers/tiktok/conversation';

/**
 * TikTok video proxy endpoint
 * Fetches TikTok videos with proper headers/cookies and streams them back
 * This is needed because TikTok's CDN often 403s direct requests without proper auth
 *
 * Usage: /tiktok/proxy?url=<encoded_video_url>&cookies=<encoded_cookies>&videoId=<id>
 * If videoId is provided and the original URL 403s, will try to fetch fresh video data
 */
export const tiktokVideoProxy = async (c: Context) => {
  const videoUrl = c.req.query('url');
  const cookies = c.req.query('cookies');
  const videoId = c.req.query('videoId'); // For re-fetching if URL fails

  if (!videoUrl) {
    return c.json({ error: 'Missing url parameter' }, 400);
  }

  try {
    // Validate the URL is from TikTok's CDN
    const url = new URL(videoUrl);
    if (
      !url.hostname.includes('tiktok') &&
      !url.hostname.includes('bytedance') &&
      !url.hostname.includes('musical.ly')
    ) {
      return c.json({ error: 'Invalid video URL - must be from TikTok CDN' }, 400);
    }

    console.log('Proxying TikTok video:', url.hostname + url.pathname.substring(0, 50) + '...');

    // Decode cookies if they were URL-encoded (+ becomes space)
    const decodedCookies = cookies ? decodeURIComponent(cookies.replace(/\+/g, ' ')) : '';
    console.log(
      'Using cookies:',
      decodedCookies ? decodedCookies.substring(0, 100) + '...' : 'none'
    );

    // Build headers to mimic a real browser request
    const requestHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'identity',
      'Referer': 'https://www.tiktok.com/',
      'Origin': 'https://www.tiktok.com',
      // Sec-Fetch headers to appear as legitimate browser media request
      'Sec-Fetch-Dest': 'video',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
      // Chrome client hints
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"'
    };

    // Add cookies if provided
    if (decodedCookies) {
      requestHeaders['Cookie'] = decodedCookies;
    }

    // Add range header if client is seeking
    const rangeHeader = c.req.header('Range');
    if (rangeHeader) {
      requestHeaders['Range'] = rangeHeader;
    }

    console.log('Request headers:', Object.keys(requestHeaders).join(', '));

    // Helper to try fetching a video URL
    const tryFetchVideo = async (targetUrl: string) => {
      return await fetch(targetUrl, {
        headers: requestHeaders
      });
    };

    // Try the original URL first
    let response = await tryFetchVideo(videoUrl);
    console.log('TikTok CDN response:', response.status, response.statusText);

    // If we get a 403 and have a videoId, try to fetch fresh video data
    if (response.status === 403 && videoId) {
      console.log('Got 403, attempting to fetch fresh video data for:', videoId);
      try {
        const freshData = await fetchTikTokVideo(videoId);
        if (freshData.video && freshData.code === 200) {
          // Extract video URL from fresh data (simplified - check web format)
          const freshVideo = freshData.video as { video?: { playAddr?: string } };
          const freshUrl = freshVideo?.video?.playAddr;
          if (freshUrl && freshUrl !== videoUrl) {
            console.log('Got fresh video URL, retrying...');
            response = await tryFetchVideo(freshUrl);
            console.log('Fresh URL response:', response.status, response.statusText);
          }
        }
      } catch (e) {
        console.error('Failed to fetch fresh video data:', e);
      }
    }

    if (!response.ok && response.status !== 206) {
      // 206 is Partial Content for range requests
      console.error('TikTok CDN error:', response.status, await response.text().catch(() => ''));
      return c.json(
        { error: `TikTok CDN returned ${response.status}` },
        response.status as 400 | 403 | 404 | 500
      );
    }

    // Build response headers
    const headers = new Headers();

    // Pass through important headers
    const contentType = response.headers.get('Content-Type');
    if (contentType) headers.set('Content-Type', contentType);

    const contentLength = response.headers.get('Content-Length');
    if (contentLength) headers.set('Content-Length', contentLength);

    const contentRange = response.headers.get('Content-Range');
    if (contentRange) headers.set('Content-Range', contentRange);

    const acceptRanges = response.headers.get('Accept-Ranges');
    if (acceptRanges) headers.set('Accept-Ranges', acceptRanges);

    // Add CORS headers for embeds
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

    // Cache for 1 hour (TikTok URLs expire, so don't cache too long)
    headers.set('Cache-Control', 'public, max-age=3600');

    // Stream the video response
    return new Response(response.body, {
      status: response.status,
      headers
    });
  } catch (error) {
    console.error('TikTok proxy error:', error);
    return c.json({ error: 'Failed to proxy video' }, 500);
  }
};

/**
 * Handle CORS preflight requests
 */
export const tiktokVideoProxyOptions = async (_c: Context) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Max-Age': '86400'
    }
  });
};
