import { Hono } from 'hono';
import { fetchTikTokVideo } from '../../providers/tiktok/conversation';
import { getBranding } from '../../helpers/branding';
import { activityRequest } from './routes/activity';
import { tiktokVideoRequest } from './routes/video';
import { oembed } from './routes/oembed';
import { tiktokVideoProxy, tiktokVideoProxyOptions } from './routes/proxy';

export const tiktok = new Hono();

// https://www.tiktok.com/@harbeehooves/video/7571171661639175454
tiktok.get('/oembed', oembed);
tiktok.get('/api/v1/statuses/:snowcode', activityRequest);

// Video proxy for TikTok CDN videos that need proper headers/cookies
tiktok.get('/proxy', tiktokVideoProxy);
tiktok.options('/proxy', tiktokVideoProxyOptions);

tiktok.get('/raw/:id', async c => {
  const { id } = c.req.param();
  if (!id) {
    return c.json({ error: 'Invalid request' }, 400);
  }
  const thread = await fetchTikTokVideo(id);
  return c.json(thread);
});

tiktok.get('/:handle/video/:id', tiktokVideoRequest);

tiktok.all('*', async c => c.redirect(getBranding(c).redirect, 302));
