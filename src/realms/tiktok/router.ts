import { Hono } from 'hono';
import { getBranding } from '../../helpers/branding';
import { activityRequest } from './routes/activity';
import { tiktokVideoRequest } from './routes/video';
import { oembed } from './routes/oembed';
import { tiktokVideoProxy, tiktokVideoProxyOptions } from './routes/proxy';
import { trimTrailingSlash } from 'hono/trailing-slash';

export const tiktok = new Hono();
tiktok.use(trimTrailingSlash());

// https://www.tiktok.com/@harbeehooves/video/7571171661639175454
tiktok.get('/oembed', oembed);
tiktok.get('/api/v1/statuses/:snowcode', activityRequest);

// Video proxy for TikTok CDN videos that need proper headers/cookies
tiktok.get('/proxy', tiktokVideoProxy);
tiktok.options('/proxy', tiktokVideoProxyOptions);

// Regular video URLs: /@username/video/1234567890
tiktok.get('/:handle/video/:id', tiktokVideoRequest);

// Shorthand URLs: /t/ZP8yxgATu
// The :id parameter will be detected as a shorthand code and resolved in tiktokVideoRequest
tiktok.get('/t/:id', tiktokVideoRequest);
tiktok.get('/t/:id/', tiktokVideoRequest);

tiktok.all('*', async c => c.redirect(getBranding(c).redirect, 302));
